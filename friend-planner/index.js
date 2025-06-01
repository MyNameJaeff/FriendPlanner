import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3001",
        methods: ["GET", "POST"]
    }
});

// In-memory storage for rooms and messages
const rooms = new Map(); // { roomName: { password: string, messages: [], createdAt: Date, users: Set, dateSelections: Map, suggestions: Map, votes: Map } }
const userRooms = new Map(); // { socketId: roomName }

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Friend Planner</title>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                socket.on('connect', () => {
                    console.log('Connected to server');
                });
            </script>
        </head>
        <body>
            <h1>Welcome to the Friend Planner</h1>
            <p>Use this app to plan your next get-together with friends!</p>
        </body>
        </html>
    `);
});

io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // Handle room creation or joining
    socket.on("joinRoom", ({ room, password, username }) => {
        const roomName = room.toLowerCase().trim();
        const normalizedUsername = username.toLowerCase().trim();

        if (!roomName || !normalizedUsername) {
            socket.emit("error", "Room name and username are required");
            return;
        }

        // Check if room exists
        if (rooms.has(roomName)) {
            const roomData = rooms.get(roomName);

            // Verify password
            if (roomData.password !== password) {
                socket.emit("error", "Incorrect password for room");
                return;
            }

            // Join existing room
            socket.join(roomName);
            roomData.users.add(socket.id);
            userRooms.set(socket.id, roomName);

            console.log(`Socket ${socket.id} (${normalizedUsername}) joined existing room ${roomName}`);

            // Convert Maps to arrays for sending
            const dateSelectionsArray = Array.from(roomData.dateSelections.entries()).map(([userId, data]) => ({
                userId,
                username: data.username,
                date: data.date,
                timestamp: data.timestamp
            }));

            const suggestionsArray = Array.from(roomData.suggestions.entries()).map(([userId, data]) => ({
                userId,
                username: data.username,
                suggestion: data.suggestion,
                timestamp: data.timestamp
            }));

            const votesArray = Array.from(roomData.votes.entries()).map(([userId, data]) => ({
                userId,
                username: data.username,
                votedFor: data.votedFor,
                timestamp: data.timestamp
            }));

            // Send room join confirmation
            socket.emit("roomJoined", {
                room: roomName,
                isCreator: false,
                message: `You joined room: ${roomName}`,
                messages: roomData.messages,
                dateSelections: dateSelectionsArray,
                suggestions: suggestionsArray,
                votes: votesArray
            });

            // Notify other users in the room
            socket.to(roomName).emit("userJoined", {
                username: normalizedUsername,
                message: `${normalizedUsername} joined the room`,
                timestamp: new Date().toISOString()
            });

        } else {
            // Create new room
            if (!password || password.trim() === "") {
                socket.emit("error", "Password is required to create a room");
                return;
            }

            const newRoom = {
                password: password.trim(),
                messages: [],
                dateSelections: new Map(), // userId -> { username, date, timestamp }
                suggestions: new Map(), // userId -> { username, suggestion, timestamp }
                votes: new Map(), // userId -> { username, votedFor, timestamp }
                createdAt: new Date(),
                users: new Set([socket.id])
            };

            rooms.set(roomName, newRoom);
            userRooms.set(socket.id, roomName);
            socket.join(roomName);

            console.log(`Socket ${socket.id} (${normalizedUsername}) created room ${roomName}`);

            socket.emit("roomJoined", {
                room: roomName,
                isCreator: true,
                message: `You created and joined room: ${roomName}`,
                dateSelections: [],
                suggestions: [],
                votes: []
            });
        }
    });

    socket.on("sendDateSelection", ({ room, date, username }) => {
        const roomName = room.toLowerCase().trim();
        const normalizedUsername = username.toLowerCase().trim();

        if (!rooms.has(roomName)) {
            socket.emit("error", "Room does not exist");
            return;
        }

        const roomData = rooms.get(roomName);

        // Check if user is in the room
        if (!roomData.users.has(socket.id)) {
            socket.emit("error", "You are not in this room");
            return;
        }

        const dateSelection = {
            username: normalizedUsername,
            date: date,
            timestamp: new Date().toISOString(),
        };

        // Store one date per user (overwrite if exists)
        roomData.dateSelections.set(socket.id, dateSelection);

        // Convert to array for broadcasting
        const dateSelectionsArray = Array.from(roomData.dateSelections.entries()).map(([userId, data]) => ({
            userId,
            username: data.username,
            date: data.date,
            timestamp: data.timestamp
        }));

        // Calculate most common date
        const dateCounts = {};
        dateSelectionsArray.forEach(selection => {
            dateCounts[selection.date] = (dateCounts[selection.date] || 0) + 1;
        });

        let mostCommonDate = null;
        let maxCount = 0;
        for (const [date, count] of Object.entries(dateCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostCommonDate = date;
            }
        }

        // Broadcast updated date selections to all users in the room
        io.to(roomName).emit("dateSelectionsUpdate", {
            dateSelections: dateSelectionsArray,
            mostCommonDate,
            mostCommonCount: maxCount
        });

        console.log(`Date selection in room "${roomName}" from "${normalizedUsername}": "${date}"`);
    });

    socket.on("sendSuggestion", ({ room, suggestion, username }) => {
        const roomName = room.toLowerCase().trim();
        const normalizedUsername = username.toLowerCase().trim();

        if (!rooms.has(roomName)) {
            socket.emit("error", "Room does not exist");
            return;
        }

        const roomData = rooms.get(roomName);

        // Check if user is in the room
        if (!roomData.users.has(socket.id)) {
            socket.emit("error", "You are not in this room");
            return;
        }

        const suggestionData = {
            username: normalizedUsername,
            suggestion: suggestion.trim(),
            timestamp: new Date().toISOString(),
        };

        // Store one suggestion per user (overwrite if exists)
        roomData.suggestions.set(socket.id, suggestionData);

        // Convert to array for broadcasting
        const suggestionsArray = Array.from(roomData.suggestions.entries()).map(([userId, data]) => ({
            userId,
            username: data.username,
            suggestion: data.suggestion,
            timestamp: data.timestamp
        }));

        // Broadcast updated suggestions to all users in the room
        io.to(roomName).emit("suggestionsUpdate", {
            suggestions: suggestionsArray
        });

        console.log(`Suggestion in room "${roomName}" from "${normalizedUsername}": "${suggestion}"`);
    });

    socket.on("sendVote", ({ room, votedFor, username }) => {
        const roomName = room.toLowerCase().trim();
        const normalizedUsername = username.toLowerCase().trim();

        if (!rooms.has(roomName)) {
            socket.emit("error", "Room does not exist");
            return;
        }

        const roomData = rooms.get(roomName);

        // Check if user is in the room
        if (!roomData.users.has(socket.id)) {
            socket.emit("error", "You are not in this room");
            return;
        }

        // Check if the suggestion exists
        const suggestionExists = Array.from(roomData.suggestions.values()).some(s => s.suggestion === votedFor);
        if (!suggestionExists) {
            socket.emit("error", "Cannot vote for non-existent suggestion");
            return;
        }

        const voteData = {
            username: normalizedUsername,
            votedFor: votedFor,
            timestamp: new Date().toISOString(),
        };

        // Store one vote per user (overwrite if exists)
        roomData.votes.set(socket.id, voteData);

        // Convert to array and calculate vote counts
        const votesArray = Array.from(roomData.votes.entries()).map(([userId, data]) => ({
            userId,
            username: data.username,
            votedFor: data.votedFor,
            timestamp: data.timestamp
        }));

        // Calculate vote counts
        const voteCounts = {};
        votesArray.forEach(vote => {
            voteCounts[vote.votedFor] = (voteCounts[vote.votedFor] || 0) + 1;
        });

        // Broadcast updated votes to all users in the room
        io.to(roomName).emit("votesUpdate", {
            votes: votesArray,
            voteCounts
        });

        console.log(`Vote in room "${roomName}" from "${normalizedUsername}" for: "${votedFor}"`);
    });

    socket.on("getRoomInfo", (roomName) => {
        const normalizedRoomName = roomName.toLowerCase().trim();

        if (rooms.has(normalizedRoomName)) {
            const roomData = rooms.get(normalizedRoomName);
            socket.emit("roomInfo", {
                exists: true,
                userCount: roomData.users.size,
                messageCount: roomData.messages.length,
                createdAt: roomData.createdAt
            });
        } else {
            socket.emit("roomInfo", { exists: false });
        }
    });

    socket.on("leaveRoom", () => {
        const roomName = userRooms.get(socket.id);
        if (roomName && rooms.has(roomName)) {
            const roomData = rooms.get(roomName);
            roomData.users.delete(socket.id);

            // Remove user's data
            roomData.dateSelections.delete(socket.id);
            roomData.suggestions.delete(socket.id);
            roomData.votes.delete(socket.id);

            socket.leave(roomName);
            userRooms.delete(socket.id);

            // Notify other users and send updated data
            socket.to(roomName).emit("userLeft", {
                message: "A user left the room",
                timestamp: new Date().toISOString()
            });

            // Send updated data to remaining users
            const dateSelectionsArray = Array.from(roomData.dateSelections.entries()).map(([userId, data]) => ({
                userId, username: data.username, date: data.date, timestamp: data.timestamp
            }));
            const suggestionsArray = Array.from(roomData.suggestions.entries()).map(([userId, data]) => ({
                userId, username: data.username, suggestion: data.suggestion, timestamp: data.timestamp
            }));
            const votesArray = Array.from(roomData.votes.entries()).map(([userId, data]) => ({
                userId, username: data.username, votedFor: data.votedFor, timestamp: data.timestamp
            }));

            socket.to(roomName).emit("dateSelectionsUpdate", { dateSelections: dateSelectionsArray });
            socket.to(roomName).emit("suggestionsUpdate", { suggestions: suggestionsArray });
            socket.to(roomName).emit("votesUpdate", { votes: votesArray });

            // If room is empty, delete it
            if (roomData.users.size === 0) {
                rooms.delete(roomName);
                console.log(`Room ${roomName} deleted (no users remaining)`);
            }

            console.log(`Socket ${socket.id} left room ${roomName}`);
        }
    });

    socket.on("disconnect", () => {
        console.log("🔴 User disconnected:", socket.id);

        // Remove user from their room
        const roomName = userRooms.get(socket.id);
        if (roomName && rooms.has(roomName)) {
            const roomData = rooms.get(roomName);
            roomData.users.delete(socket.id);

            // Remove user's data
            roomData.dateSelections.delete(socket.id);
            roomData.suggestions.delete(socket.id);
            roomData.votes.delete(socket.id);

            // Notify other users
            socket.to(roomName).emit("userLeft", {
                message: "A user disconnected",
                timestamp: new Date().toISOString()
            });

            // If room is empty, delete it
            if (roomData.users.size === 0) {
                rooms.delete(roomName);
                console.log(`Room ${roomName} deleted (no users remaining)`);
            }
        }

        userRooms.delete(socket.id);
    });

    // Debug endpoint to see current rooms (remove in production)
    socket.on("debugRooms", () => {
        const roomsList = Array.from(rooms.keys()).map(roomName => ({
            name: roomName,
            users: rooms.get(roomName).users.size,
            messages: rooms.get(roomName).messages.length,
            createdAt: rooms.get(roomName).createdAt
        }));
        socket.emit("debugRoomsResponse", roomsList);
    });
});

// Cleanup function to remove old empty rooms (optional)
setInterval(() => {
    const now = new Date();
    for (const [roomName, roomData] of rooms.entries()) {
        // Remove rooms that have been empty for more than 1 hour
        if (roomData.users.size === 0 && (now - roomData.createdAt) > 3600000) {
            rooms.delete(roomName);
            console.log(`Cleaned up old empty room: ${roomName}`);
        }
    }
}, 300000); // Check every 5 minutes
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at ${PORT}`);
    console.log('📝 Rooms will persist as long as they have users');
    console.log('🔒 Password protection enabled for all rooms');
});