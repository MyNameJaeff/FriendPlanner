import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3001",
            "https://friendplanner-zezv.onrender.com"
        ],
        methods: ["GET", "POST"]
    }
});

// In-memory storage for rooms and messages
const rooms = new Map(); // { roomName: { password: string, messages: [], createdAt: Date, users: Set, dateSelections: Map, suggestions: Map, votes: Map, userData: Map } }
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

// Helper function to get user key (room + username combination)
function getUserKey(roomName, username) {
    return `${roomName}:${username.toLowerCase().trim()}`;
}

// Helper function to find user's existing data
function findUserData(roomData, username) {
    const normalizedUsername = username.toLowerCase().trim();
    for (const [userKey, userData] of roomData.userData.entries()) {
        if (userData.username === normalizedUsername) {
            return { userKey, userData };
        }
    }
    return null;
}

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

            // Check if user has existing data and restore it
            // Check if user has existing data and restore it
            const existingUserData = findUserData(roomData, normalizedUsername);
            const userKey = getUserKey(roomName, normalizedUsername);

            if (existingUserData) {
                // Remove old socket mappings first to prevent duplicates
                roomData.dateSelections.delete(existingUserData.userData.socketId);
                roomData.suggestions.delete(existingUserData.userData.socketId);
                roomData.votes.delete(existingUserData.userData.socketId);

                // Restore data with new socket ID if it exists
                if (existingUserData.userData.dateSelections) {
                    roomData.dateSelections.set(socket.id, existingUserData.userData.dateSelections);
                }
                if (existingUserData.userData.suggestions) {
                    roomData.suggestions.set(socket.id, existingUserData.userData.suggestions);
                }
                if (existingUserData.userData.votes) {
                    roomData.votes.set(socket.id, existingUserData.userData.votes);
                }

                // Update userData with new socket ID
                roomData.userData.set(userKey, {
                    username: normalizedUsername,
                    socketId: socket.id,
                    dateSelections: existingUserData.userData.dateSelections,
                    suggestions: existingUserData.userData.suggestions,
                    votes: existingUserData.userData.votes,
                    lastActive: new Date()
                });

                console.log(`Socket ${socket.id} (${normalizedUsername}) rejoined room ${roomName} with existing data`);
            } else {
                // New user
                roomData.userData.set(userKey, {
                    username: normalizedUsername,
                    socketId: socket.id,
                    dateSelections: null,
                    suggestions: null,
                    votes: null,
                    lastActive: new Date()
                });

                console.log(`Socket ${socket.id} (${normalizedUsername}) joined existing room ${roomName} as new user`);
            }

            // Convert Maps to arrays for sending
            const dateSelectionsArray = Array.from(roomData.dateSelections.entries()).map(([userId, data]) => ({
                userId,
                username: data.username,
                dates: data.dates, // Changed from date to dates for multiple selection
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
                message: existingUserData ?
                    `Welcome back to room: ${roomName}` :
                    `You joined room: ${roomName}`,
                messages: roomData.messages,
                dateSelections: dateSelectionsArray,
                suggestions: suggestionsArray,
                votes: votesArray
            });

            // Notify other users in the room
            socket.to(roomName).emit("userJoined", {
                username: normalizedUsername,
                message: existingUserData ?
                    `${normalizedUsername} rejoined the room` :
                    `${normalizedUsername} joined the room`,
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
                dateSelections: new Map(), // socketId -> { username, dates: [], timestamp }
                suggestions: new Map(), // socketId -> { username, suggestion, timestamp }
                votes: new Map(), // socketId -> { username, votedFor, timestamp }
                userData: new Map(), // userKey -> { username, socketId, dateSelections, suggestions, votes, lastActive }
                createdAt: new Date(),
                users: new Set([socket.id])
            };

            rooms.set(roomName, newRoom);
            userRooms.set(socket.id, roomName);
            socket.join(roomName);

            // Add user data
            const userKey = getUserKey(roomName, normalizedUsername);
            newRoom.userData.set(userKey, {
                username: normalizedUsername,
                socketId: socket.id,
                dateSelections: null,
                suggestions: null,
                votes: null,
                lastActive: new Date()
            });

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

    socket.on("deleteDateSelection", ({ room, username }) => {
        const roomName = room.toLowerCase().trim();
        const normalizedUsername = username.toLowerCase().trim();

        if (!rooms.has(roomName)) {
            socket.emit("error", "Room does not exist");
            return;
        }

        const roomData = rooms.get(roomName);

        if (!roomData.users.has(socket.id)) {
            socket.emit("error", "You are not in this room");
            return;
        }

        // Remove from dateSelections Map
        roomData.dateSelections.delete(socket.id);

        // Update userData
        const userKey = getUserKey(roomName, normalizedUsername);
        if (roomData.userData.has(userKey)) {
            const userData = roomData.userData.get(userKey);
            userData.dateSelections = null;
            userData.lastActive = new Date();
        }

        // Broadcast updated selections
        const dateSelectionsArray = Array.from(roomData.dateSelections.entries()).map(([userId, data]) => ({
            userId,
            username: data.username,
            dates: data.dates,
            timestamp: data.timestamp
        }));

        io.to(roomName).emit("dateSelectionsUpdate", {
            dateSelections: dateSelectionsArray,
            mostCommonDates: [],
            mostCommonCount: 0,
            dateCounts: {}
        });

        console.log(`Date selection deleted in room "${roomName}" by "${normalizedUsername}"`);
    });

    socket.on("deleteSuggestion", ({ room, username }) => {
        const roomName = room.toLowerCase().trim();
        const normalizedUsername = username.toLowerCase().trim();

        if (!rooms.has(roomName)) {
            socket.emit("error", "Room does not exist");
            return;
        }

        const roomData = rooms.get(roomName);

        if (!roomData.users.has(socket.id)) {
            socket.emit("error", "You are not in this room");
            return;
        }

        // Get the suggestion before deleting to remove votes
        const userSuggestion = roomData.suggestions.get(socket.id);

        // Remove from suggestions Map
        roomData.suggestions.delete(socket.id);

        // Remove all votes for this suggestion
        if (userSuggestion) {
            for (const [userId, voteData] of roomData.votes.entries()) {
                if (voteData.votedFor === userSuggestion.suggestion) {
                    roomData.votes.delete(userId);

                    // Update userData for voters
                    const voterUserKey = getUserKey(roomName, voteData.username);
                    if (roomData.userData.has(voterUserKey)) {
                        const voterUserData = roomData.userData.get(voterUserKey);
                        voterUserData.votes = null;
                        voterUserData.lastActive = new Date();
                    }
                }
            }
        }

        // Update userData for suggestion author
        const userKey = getUserKey(roomName, normalizedUsername);
        if (roomData.userData.has(userKey)) {
            const userData = roomData.userData.get(userKey);
            userData.suggestions = null;
            userData.lastActive = new Date();
        }

        // Broadcast updates
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

        const voteCounts = {};
        votesArray.forEach(vote => {
            voteCounts[vote.votedFor] = (voteCounts[vote.votedFor] || 0) + 1;
        });

        io.to(roomName).emit("suggestionsUpdate", { suggestions: suggestionsArray });
        io.to(roomName).emit("votesUpdate", { votes: votesArray, voteCounts });

        console.log(`Suggestion deleted in room "${roomName}" by "${normalizedUsername}"`);
    });

    socket.on("sendDateSelection", ({ room, dates, username }) => {
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

        // Ensure dates is an array and handle timezone properly
        const processedDates = Array.isArray(dates) ? dates : [dates];
        const normalizedDates = processedDates.map(date => {
            // Handle date properly to avoid timezone issues
            if (typeof date === 'string') {
                // If it's already a date string, use it as is
                return date;
            } else if (date instanceof Date) {
                // Convert to YYYY-MM-DD format in local timezone
                return date.getFullYear() + '-' +
                    String(date.getMonth() + 1).padStart(2, '0') + '-' +
                    String(date.getDate()).padStart(2, '0');
            }
            return date;
        });

        const dateSelection = {
            username: normalizedUsername,
            dates: normalizedDates, // Changed from date to dates
            timestamp: new Date().toISOString(),
        };

        // Store dates per user (overwrite if exists)
        roomData.dateSelections.set(socket.id, dateSelection);

        // Update userData
        const userKey = getUserKey(roomName, normalizedUsername);
        if (roomData.userData.has(userKey)) {
            const userData = roomData.userData.get(userKey);
            userData.dateSelections = dateSelection;
            userData.lastActive = new Date();
        }

        // Convert to array for broadcasting
        const dateSelectionsArray = Array.from(roomData.dateSelections.entries()).map(([userId, data]) => ({
            userId,
            username: data.username,
            dates: data.dates,
            timestamp: data.timestamp
        }));

        // Calculate most common dates
        const dateCounts = {};
        dateSelectionsArray.forEach(selection => {
            selection.dates.forEach(date => {
                dateCounts[date] = (dateCounts[date] || 0) + 1;
            });
        });

        let mostCommonDates = [];
        let maxCount = 0;
        for (const [date, count] of Object.entries(dateCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostCommonDates = [date];
            } else if (count === maxCount) {
                mostCommonDates.push(date);
            }
        }

        // Broadcast updated date selections to all users in the room
        io.to(roomName).emit("dateSelectionsUpdate", {
            dateSelections: dateSelectionsArray,
            mostCommonDates,
            mostCommonCount: maxCount,
            dateCounts
        });

        console.log(`Date selection in room "${roomName}" from "${normalizedUsername}": [${normalizedDates.join(', ')}]`);
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

        // Update userData
        const userKey = getUserKey(roomName, normalizedUsername);
        if (roomData.userData.has(userKey)) {
            const userData = roomData.userData.get(userKey);
            userData.suggestions = suggestionData;
            userData.lastActive = new Date();
        }

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

        // Update userData
        const userKey = getUserKey(roomName, normalizedUsername);
        if (roomData.userData.has(userKey)) {
            const userData = roomData.userData.get(userKey);
            userData.votes = voteData;
            userData.lastActive = new Date();
        }

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

            // Keep user's data but remove from active maps
            // Update userData to mark as inactive but keep the data
            const userKey = Array.from(roomData.userData.entries()).find(([/* key, */ userData]) =>
                userData.socketId === socket.id
            )?.[0];

            if (userKey) {
                const userData = roomData.userData.get(userKey);
                userData.socketId = null; // Mark as disconnected but keep data
                userData.lastActive = new Date();
            }

            socket.leave(roomName);

            // Notify other users
            socket.to(roomName).emit("userLeft", {
                message: "A user left the room",
                timestamp: new Date().toISOString()
            });

            // Send updated data to remaining users (data remains the same)
            const dateSelectionsArray = Array.from(roomData.dateSelections.entries()).map(([userId, data]) => ({
                userId, username: data.username, dates: data.dates, timestamp: data.timestamp
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

            console.log(`Socket ${socket.id} left room ${roomName} (data preserved)`);
        }
    });

    socket.on("disconnect", () => {
        console.log("🔴 User disconnected:", socket.id);

        // Remove user from their room but keep their data
        const roomName = userRooms.get(socket.id);
        if (roomName && rooms.has(roomName)) {
            const roomData = rooms.get(roomName);
            roomData.users.delete(socket.id);

            // Keep user's data but update userData to mark as inactive
            const userKey = Array.from(roomData.userData.entries()).find(([/* key, */ userData]) =>
                userData.socketId === socket.id
            )?.[0];

            if (userKey) {
                const userData = roomData.userData.get(userKey);
                userData.socketId = null; // Mark as disconnected but keep data
                userData.lastActive = new Date();
            }

            // Notify other users
            socket.to(roomName).emit("userLeft", {
                message: "A user disconnected",
                timestamp: new Date().toISOString()
            });
        }

        userRooms.delete(socket.id);
    });

    // Debug endpoint to see current rooms (remove in production)
    socket.on("debugRooms", () => {
        const roomsList = Array.from(rooms.keys()).map(roomName => ({
            name: roomName,
            users: rooms.get(roomName).users.size,
            messages: rooms.get(roomName).messages.length,
            dataEntries: rooms.get(roomName).userData.size,
            createdAt: rooms.get(roomName).createdAt
        }));
        socket.emit("debugRoomsResponse", roomsList);
    });
});

// Enhanced cleanup function
setInterval(() => {
    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    const oneHourMs = 60 * 60 * 1000; // 1 hour in milliseconds

    for (const [roomName, roomData] of rooms.entries()) {
        const hasData = roomData.userData.size > 0 ||
            roomData.messages.length > 0 ||
            roomData.dateSelections.size > 0 ||
            roomData.suggestions.size > 0 ||
            roomData.votes.size > 0;

        if (roomData.users.size === 0) {
            if (hasData) {
                // Room has data but no active users - delete after 30 days
                if ((now - roomData.createdAt) > thirtyDaysMs) {
                    rooms.delete(roomName);
                    console.log(`Cleaned up room with data after 30 days: ${roomName}`);
                }
            } else {
                // Room has no data and no users - delete after 1 hour
                if ((now - roomData.createdAt) > oneHourMs) {
                    rooms.delete(roomName);
                    console.log(`Cleaned up empty room after 1 hour: ${roomName}`);
                }
            }
        }
    }
}, 300000); // Check every 5 minutes

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at ${PORT}`);
    console.log('📝 Rooms with data persist for 30 days when empty');
    console.log('📝 Empty rooms persist for 1 hour when empty');
    console.log('🔒 Password protection enabled for all rooms');
    console.log('🔄 User data is preserved when they leave/disconnect');
});