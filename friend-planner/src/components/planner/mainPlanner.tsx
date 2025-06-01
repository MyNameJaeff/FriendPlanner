import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface DateSelection {
    userId: string;
    username: string;
    dates: string[]; // Changed to array for multiple dates
    timestamp: string;
}

interface Suggestion {
    userId: string;
    username: string;
    suggestion: string;
    timestamp: string;
}

interface Vote {
    userId: string;
    username: string;
    votedFor: string;
    timestamp: string;
}

export default function ChatRoom() {
    const [room, setRoom] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [joinedRoom, setJoinedRoom] = useState("");
    const [isCreator, setIsCreator] = useState(false);
    const [error, setError] = useState("");
    const [roomInfo, setRoomInfo] = useState<{ exists: boolean; userCount?: number; messageCount?: number } | null>(null);
    const socketRef = useRef<Socket | null>(null);

    // Date selection state - now supports multiple dates
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [dateSelections, setDateSelections] = useState<DateSelection[]>([]);
    const [mostCommonDates, setMostCommonDates] = useState<{ date: string; count: number }[]>([]);

    // Suggestion and voting state
    const [newSuggestion, setNewSuggestion] = useState("");
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [votes, setVotes] = useState<Vote[]>([]);
    const [voteCounts, setVoteCounts] = useState<{ [key: string]: number }>({});

    // Load data from localStorage on component mount
    useEffect(() => {
        const savedUsername = localStorage.getItem('chatUsername');
        const savedRoom = localStorage.getItem('chatRoom');
        const savedJoinedRoom = localStorage.getItem('chatJoinedRoom');
        const savedPassword = localStorage.getItem('chatPassword');
        const savedIsCreator = localStorage.getItem('chatIsCreator');

        if (savedUsername) setUsername(savedUsername.toLowerCase());
        if (savedRoom) setRoom(savedRoom.toLowerCase());
        if (savedJoinedRoom) setJoinedRoom(savedJoinedRoom.toLowerCase());
        if (savedPassword) setPassword(savedPassword);
        if (savedIsCreator) setIsCreator(savedIsCreator === 'true');
    }, []);

    // Initialize socket connection
    useEffect(() => {
        socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000");

        // Handle successful room join
        socketRef.current.on("roomJoined", ({ room, isCreator: creator, message: joinMessage, dateSelections, suggestions, votes }) => {
            setJoinedRoom(room.toLowerCase());
            setIsCreator(creator);
            setError("");

            // DON'T clear local state - just update with server data
            setDateSelections(dateSelections || []);
            setSuggestions(suggestions || []);
            setVotes(votes || []);

            console.log(room, creator, joinMessage, dateSelections, suggestions, votes);
        });

        // Handle date selections update
        socketRef.current.on("dateSelectionsUpdate", ({ dateSelections, mostCommonDates }) => {
            setDateSelections(dateSelections);
            setMostCommonDates(mostCommonDates || []);

            // Update local selected dates to match server data for current user
            const currentUserSelection = dateSelections.find((sel: { username: string; }) => sel.username === username.toLowerCase());
            if (currentUserSelection) {
                const dates = currentUserSelection.dates.map((dateStr: string) => new Date(dateStr + 'T00:00:00'));
                setSelectedDates(dates);
            } else {
                setSelectedDates([]);
            }
        });

        // Handle suggestions update
        socketRef.current.on("suggestionsUpdate", ({ suggestions }) => {
            setSuggestions(suggestions);
        });

        // Handle votes update
        socketRef.current.on("votesUpdate", ({ votes, voteCounts }) => {
            setVotes(votes);
            setVoteCounts(voteCounts || {});
        });

        // Handle user join notifications
        socketRef.current.on("userJoined", ({ message: joinMessage, timestamp }) => {
            console.log(`${joinMessage} at ${timestamp}`);
        });

        // Handle user leave notifications
        socketRef.current.on("userLeft", ({ message: leaveMessage, timestamp }) => {
            console.log(`${leaveMessage} at ${timestamp}`);
        });

        // Handle errors
        socketRef.current.on("error", (errorMessage) => {
            setError(errorMessage);
        });

        // Handle room info response
        socketRef.current.on("roomInfo", (info) => {
            setRoomInfo(info);
        });

        // If user was previously in a room, try to rejoin
        const savedJoinedRoom = localStorage.getItem('chatJoinedRoom');
        const savedUsername = localStorage.getItem('chatUsername');
        const savedPassword = localStorage.getItem('chatPassword');

        if (savedJoinedRoom && savedUsername && savedPassword) {
            // Add a small delay to ensure socket is ready
            setTimeout(() => {
                socketRef.current?.emit("joinRoom", {
                    room: savedJoinedRoom.toLowerCase(),
                    username: savedUsername.toLowerCase(),
                    password: savedPassword
                });
            }, 100);
        }

        return () => {
            socketRef.current?.disconnect();
        };
    }, [username]); // Add username as dependency

    // Save data to localStorage whenever state changes
    useEffect(() => {
        if (username) {
            localStorage.setItem('chatUsername', username.toLowerCase());
        }
    }, [username]);

    useEffect(() => {
        if (room) {
            localStorage.setItem('chatRoom', room.toLowerCase());
        }
    }, [room]);

    useEffect(() => {
        if (password) {
            localStorage.setItem('chatPassword', password);
        }
    }, [password]);

    useEffect(() => {
        localStorage.setItem('chatJoinedRoom', joinedRoom);
        localStorage.setItem('chatIsCreator', isCreator.toString());
    }, [joinedRoom, isCreator]);

    const checkRoomExists = () => {
        if (room.trim()) {
            socketRef.current?.emit("getRoomInfo", room.toLowerCase().trim());
        }
    };

    const joinRoom = () => {
        const trimmedRoom = room.trim().toLowerCase();
        const trimmedUsername = username.trim().toLowerCase();
        const trimmedPassword = password.trim();

        if (!trimmedRoom || !trimmedUsername || !trimmedPassword) {
            setError("Room name, username, and password are required");
            return;
        }

        setError("");
        socketRef.current?.emit("joinRoom", {
            room: trimmedRoom,
            username: trimmedUsername,
            password: trimmedPassword
        });
    };

    // Helper function to format date consistently and avoid timezone issues
    const formatDateToString = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleDateChange = (dates: Date[]) => {
        setSelectedDates(dates);
        if (dates.length > 0 && joinedRoom) {
            const formattedDates = dates.map(date => formatDateToString(date));
            socketRef.current?.emit("sendDateSelection", {
                room: joinedRoom,
                dates: formattedDates,
                username: username.toLowerCase()
            });
        }
    };

    const deleteDateSelection = () => {
        if (!joinedRoom) return;

        socketRef.current?.emit("deleteDateSelection", {
            room: joinedRoom,
            username: username.toLowerCase()
        });

        setSelectedDates([]);
    };

    const sendSuggestion = () => {
        if (!newSuggestion.trim() || !joinedRoom) return;

        socketRef.current?.emit("sendSuggestion", {
            room: joinedRoom,
            suggestion: newSuggestion.trim(),
            username: username.toLowerCase()
        });

        // Vote for the suggestion immediately after sending it 
        socketRef.current?.emit("sendVote", {
            room: joinedRoom,
            votedFor: newSuggestion.trim(),
            username: username.toLowerCase()
        });

        setNewSuggestion("");
    };

    const deleteSuggestion = () => {
        if (!joinedRoom) return;

        socketRef.current?.emit("deleteSuggestion", {
            room: joinedRoom,
            username: username.toLowerCase()
        });
    };

    const sendVote = (suggestion: string) => {
        if (!joinedRoom) return;

        socketRef.current?.emit("sendVote", {
            room: joinedRoom,
            votedFor: suggestion,
            username: username.toLowerCase()
        });
    };

    const leaveRoom = () => {
        socketRef.current?.emit("leaveRoom");
        setJoinedRoom("");
        setRoom("");
        setPassword("");
        setIsCreator(false);
        setError("");
        setRoomInfo(null);
        setDateSelections([]);
        setSuggestions([]);
        setVotes([]);
        setVoteCounts({});
        setMostCommonDates([]);
        setSelectedDates([]);
        localStorage.removeItem('chatRoom');
        localStorage.removeItem('chatJoinedRoom');
        localStorage.removeItem('chatPassword');
        localStorage.removeItem('chatIsCreator');
    };

    const clearAllData = () => {
        if (joinedRoom) {
            socketRef.current?.emit("leaveRoom");
        }
        setUsername("");
        setRoom("");
        setPassword("");
        setJoinedRoom("");
        setIsCreator(false);
        setError("");
        setRoomInfo(null);
        setDateSelections([]);
        setSuggestions([]);
        setVotes([]);
        setVoteCounts({});
        setMostCommonDates([]);
        setSelectedDates([]);
        localStorage.clear();
    };

    // Get current user's selections
    const getCurrentUserDateSelection = () => {
        return dateSelections.find(selection => selection.username === username.toLowerCase());
    };

    const getCurrentUserSuggestion = () => {
        return suggestions.find(suggestion => suggestion.username === username.toLowerCase());
    };

    const getCurrentUserVote = () => {
        return votes.find(vote => vote.username === username.toLowerCase());
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            {!joinedRoom ? (
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-center mb-6">Join or Create Planning Room</h2>

                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                        <input
                            type="text"
                            placeholder="Enter your name (will be lowercase)"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase())}
                            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Room Name</label>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                placeholder="Enter room name (will be lowercase)"
                                value={room}
                                onChange={(e) => setRoom(e.target.value.toLowerCase())}
                                className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={checkRoomExists}
                                className="px-4 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                            >
                                Check
                            </button>
                        </div>
                    </div>

                    {roomInfo && (
                        <div className={`p-3 rounded-md ${roomInfo.exists ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {roomInfo.exists ? (
                                <div>
                                    <p><strong>Room exists!</strong></p>
                                    <p>Users: {roomInfo.userCount}</p>
                                    <p className="text-sm">You need the password to join.</p>
                                </div>
                            ) : (
                                <p><strong>New room!</strong> You&apos;ll be the creator and need to set a password.</p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password {roomInfo?.exists ? "(to join)" : "(to create room)"}
                        </label>
                        <input
                            type="password"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        onClick={joinRoom}
                        disabled={!username.trim() || !room.trim() || !password.trim()}
                        className="w-full bg-blue-500 text-white p-3 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {roomInfo?.exists ? 'Join Room' : 'Create & Join Room'}
                    </button>

                    <button
                        onClick={clearAllData}
                        className="w-full bg-red-500 text-white p-2 rounded-md hover:bg-red-600 transition-colors text-sm"
                    >
                        Clear All Saved Data
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-semibold">Room: {joinedRoom}</h3>
                            <p className="text-sm text-gray-600">
                                {isCreator ? '👑 You are the creator' : '👤 Member'} | User: {username}
                            </p>
                        </div>
                        <button
                            onClick={leaveRoom}
                            className="px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                        >
                            Leave Room
                        </button>
                    </div>

                    {/* Date Selection Section - Now supports multiple dates */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-4">📅 Select Your Preferred Dates (Multiple Selection)</h3>
                        <div className="flex flex-col lg:flex-row gap-6">
                            <div className="flex-1">
                                <DatePicker
                                    selected={null}
                                    onChange={(date) => {
                                        if (!date) return;
                                        const alreadySelected = selectedDates.some(
                                            (d) => d.toDateString() === date.toDateString()
                                        );
                                        const newDates = alreadySelected
                                            ? selectedDates.filter((d) => d.toDateString() !== date.toDateString())
                                            : [...selectedDates, date];

                                        handleDateChange(newDates);
                                    }}
                                    dateFormat="yyyy-MM-dd"
                                    minDate={new Date()}
                                    inline
                                    highlightDates={selectedDates || dateSelections}
                                />
                                <div className="mt-2 text-sm text-gray-600">
                                    <p>Click dates to select/deselect them</p>
                                    <p>Selected: {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>

                            <div className="flex-1">
                                <h4 className="font-medium mb-2">Date Selections:</h4>
                                {dateSelections.length === 0 ? (
                                    <p className="text-gray-500">No dates selected yet</p>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Display all individual date selections */}
                                        {dateSelections.map((selection) => (
                                            <div key={selection.userId} className="bg-white p-2 rounded border text-sm">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-medium">{selection.username}:</span>
                                                        <div className="mt-1">
                                                            {selection.dates.map((date) => (
                                                                <span key={date} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                                                    {new Date(date + 'T00:00:00').toLocaleDateString()}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <span className="text-gray-500 text-xs">
                                                        {new Date(selection.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Show most popular dates if there's consensus */}
                                        {mostCommonDates.length > 0 && mostCommonDates[0].count > 1 && (
                                            <div className="mt-3 p-3 bg-green-100 rounded border-l-4 border-green-400">
                                                <p className="font-semibold text-green-800">
                                                    🎯 Most Popular Dates:
                                                </p>
                                                <div className="text-sm text-green-600 mt-1">
                                                    {mostCommonDates.slice(0, 3).map(({ date, count }) => (
                                                        <div key={date} className="flex justify-between">
                                                            <span>{new Date(date + 'T00:00:00').toLocaleDateString()}</span>
                                                            <span>{count} vote{count !== 1 ? 's' : ''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {getCurrentUserDateSelection() && (
                            <div className="mt-3 p-2 bg-blue-100 rounded text-sm flex justify-between items-center">
                                <span>✅ Your selected dates: {getCurrentUserDateSelection()!.dates.map(date =>
                                    new Date(date + 'T00:00:00').toLocaleDateString()
                                ).join(', ')}</span>
                                <button
                                    onClick={deleteDateSelection}
                                    className="bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Suggestions Section */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-4">💡 Activity Suggestions</h3>

                        {!getCurrentUserSuggestion() ? (
                            <div className="flex space-x-2 mb-4">
                                <input
                                    type="text"
                                    placeholder="Suggest an activity (you can only suggest once)..."
                                    value={newSuggestion}
                                    onChange={(e) => setNewSuggestion(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && sendSuggestion()}
                                    className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    onClick={sendSuggestion}
                                    disabled={!newSuggestion.trim()}
                                    className="bg-green-500 text-white px-6 py-3 rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                >
                                    Suggest
                                </button>
                            </div>
                        ) : (
                            <div className="mb-4 p-2 bg-blue-100 rounded text-sm flex justify-between items-center">
                                <span>✅ Your suggestion: &quot;{getCurrentUserSuggestion()!.suggestion}&quot;</span>
                                <button
                                    onClick={deleteSuggestion}
                                    className="bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        )}

                        <div className="space-y-3">
                            <h4 className="font-medium">All Suggestions:</h4>
                            {suggestions.length === 0 ? (
                                <p className="text-gray-500">No suggestions yet</p>
                            ) : (
                                suggestions.map((suggestion) => (
                                    <div key={suggestion.userId} className="bg-white p-3 rounded border">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="font-medium">{suggestion.username}:</span>
                                                <span className="ml-2">{suggestion.suggestion}</span>
                                            </div>
                                            <small className="text-gray-500">
                                                {new Date(suggestion.timestamp).toLocaleTimeString()}
                                            </small>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">
                                                Votes: {voteCounts[suggestion.suggestion] || 0}
                                            </span>

                                            {getCurrentUserVote()?.votedFor === suggestion.suggestion ? (
                                                <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                                                    ✅ You voted for this
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => sendVote(suggestion.suggestion)}
                                                    className="cursor-pointer bg-blue-500 text-white text-sm px-3 py-1 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Vote
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {getCurrentUserVote() && (
                            <div className="mt-3 p-2 bg-blue-100 rounded text-sm">
                                🗳️ You voted for: &quot;{getCurrentUserVote()!.votedFor}&quot;
                            </div>
                        )}

                        {/* Vote Results */}
                        {Object.keys(voteCounts).length > 0 && (
                            <div className="mt-4 p-3 bg-yellow-50 rounded">
                                <h4 className="font-medium mb-2">🏆 Vote Results:</h4>
                                <div className="space-y-1">
                                    {Object.entries(voteCounts)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([suggestion, count]) => (
                                            <div key={suggestion} className="flex justify-between">
                                                <span className={count === Math.max(...Object.values(voteCounts)) ? "font-semibold" : ""}>
                                                    {suggestion}
                                                </span>
                                                <span className={`${count === Math.max(...Object.values(voteCounts)) ? "font-semibold text-green-600" : ""}`}>
                                                    {count} vote{count !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Summary Section */}
                    {(dateSelections.length > 0 || suggestions.length > 0) && (
                        <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                            <h3 className="text-lg font-semibold mb-2">📋 Planning Summary</h3>
                            <div className="text-sm space-y-1">
                                <p>👥 Active participants: {new Set([...dateSelections.map(d => d.username), ...suggestions.map(s => s.username)]).size}</p>
                                {mostCommonDates.length > 0 && mostCommonDates[0].count > 1 && (
                                    <p>📅 Most popular date: {new Date(mostCommonDates[0].date + 'T00:00:00').toLocaleDateString()} ({mostCommonDates[0].count} votes)</p>
                                )}
                                {Object.keys(voteCounts).length > 0 && (
                                    <p>🎯 Leading activity: {Object.entries(voteCounts).sort(([, a], [, b]) => b - a)[0][0]} ({Math.max(...Object.values(voteCounts))} votes)</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}