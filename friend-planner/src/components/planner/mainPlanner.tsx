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
        <div className="min-w-1/2 max-w-4xl h-full grow mx-auto p-6 bg-[#C5A880] rounded-lg jetbrains-mono shadow-[-8px_8px_20px_rgba(0,0,0,0.3)]">
            {!joinedRoom ? (
                <div className="space-y-4">
                    <h2 className="text-3xl font-bold text-center mb-6 text-[#532E1C] tracking-wide">Join or Create Planning Room</h2>

                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-lg font-bold text-[#532E1C] mb-2 tracking-wide">Your Name</label>
                        <input
                            type="text"
                            placeholder="Enter your name (will be lowercase)"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase())}
                            className="focus:outline-2 outline-[#532E1C] w-full p-3 border-1 border-[#C5A880] rounded-md focus:ring-2 focus:ring-[#C5A880] bg-white text-[#0F0F0F] text-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-lg font-bold text-[#532E1C] mb-2 tracking-wide">Room Name</label>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                placeholder="Enter room name (will be lowercase)"
                                value={room}
                                onChange={(e) => setRoom(e.target.value.toLowerCase())}
                                className="flex-1 p-3 border-1 focus:outline-2 outline-[#532E1C] border-[#C5A880] rounded-md focus:ring-2 focus:ring-[#C5A880] bg-white text-[#0F0F0F] text-lg"
                            />
                            <button
                                onClick={checkRoomExists}
                                className="cursor-pointer px-6 py-3 bg-[#532E1C]/75 text-white rounded-md hover:bg-[#532E1C] transition-colors text-lg font-bold tracking-wide"
                            >
                                Check
                            </button>
                        </div>
                    </div>

                    {roomInfo && (
                        <div className={`p-4 rounded-md ${roomInfo.exists ? 'bg-[#E6E6E6] text-[#532E1C]' : 'bg-[#E6E6E6] text-[#532E1C]'}`}>
                            {roomInfo.exists ? (
                                <div>
                                    <p className="text-lg font-bold tracking-wide">Room exists!</p>
                                    <p className="text-lg tracking-wide">Users: {roomInfo.userCount}</p>
                                    <p className="text-base tracking-wide">You need the password to join.</p>
                                </div>
                            ) : (
                                <p className="text-lg font-bold tracking-wide">New room! You&apos;ll be the creator and need to set a password.</p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-lg font-bold text-[#532E1C] mb-2 tracking-wide">
                            Password {roomInfo?.exists ? "(to join)" : "(to create room)"}
                        </label>
                        <input
                            type="password"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 border-2 border-[#C5A880] rounded-md focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-white text-[#0F0F0F] text-lg"
                        />
                    </div>

                    <button
                        onClick={joinRoom}
                        disabled={!username.trim() || !room.trim() || !password.trim()}
                        className="w-full bg-[#532E1C]/75 text-white p-3 rounded-md hover:bg-[#532E1C] hover:text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-xl font-bold tracking-wide"
                    >
                        {roomInfo?.exists ? 'Join Room' : 'Create & Join Room'}
                    </button>

                    <button
                        onClick={clearAllData}
                        className="w-full bg-[#681f1f] text-white p-2 rounded-md hover:bg-[#8f2323] transition-colors text-lg font-bold tracking-wide"
                    >
                        Clear All Saved Data
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-bold text-[#532E1C] tracking-wide">Room: {joinedRoom}</h3>
                            <p className="text-lg text-[#532E1C] tracking-wide">
                                {isCreator ? '👑 You are the creator' : '👤 Member'} | User: {username}
                            </p>
                        </div>
                        <button
                            onClick={leaveRoom}
                            className="px-4 py-2 bg-[#532E1C] text-white text-lg rounded hover:bg-[#0F0F0F] transition-colors font-bold tracking-wide"
                        >
                            Leave Room
                        </button>
                    </div>

                    {/* Date Selection Section - Now supports multiple dates */}
                    <div className="bg-white p-6 rounded-lg border-2 border-[#C5A880]">
                        <h3 className="text-xl font-bold mb-4 text-[#532E1C] tracking-wide">📅 Select Your Preferred Dates (Multiple Selection)</h3>
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
                                <div className="mt-2 text-lg text-[#532E1C] tracking-wide">
                                    <p>Click dates to select/deselect them</p>
                                    <p>Selected: {selectedDates.length} date{selectedDates.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>

                            <div className="flex-1">
                                <h4 className="font-bold mb-2 text-[#532E1C] text-lg tracking-wide">Date Selections:</h4>
                                {dateSelections.length === 0 ? (
                                    <p className="text-[#532E1C] text-lg tracking-wide">No dates selected yet</p>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Display all individual date selections */}
                                        {dateSelections.map((selection) => (
                                            <div key={selection.userId} className="bg-[#E6E6E6] p-3 rounded border-2 border-[#C5A880] text-lg">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-bold text-[#532E1C] tracking-wide">{selection.username}:</span>
                                                        <div className="mt-1">
                                                            {selection.dates.map((date) => (
                                                                <span key={date} className="inline-block bg-[#C5A880] text-[#532E1C] px-2 py-1 rounded text-base mr-1 mb-1 font-bold tracking-wide">
                                                                    {new Date(date + 'T00:00:00').toLocaleDateString()}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <span className="text-[#532E1C] text-base tracking-wide">
                                                        {new Date(selection.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Show most popular dates if there's consensus */}
                                        {mostCommonDates.length > 0 && mostCommonDates[0].count > 1 && (
                                            <div className="mt-3 p-4 bg-[#C5A880] rounded border-l-4 border-[#532E1C]">
                                                <p className="font-bold text-[#532E1C] text-lg tracking-wide">
                                                    🎯 Most Popular Dates:
                                                </p>
                                                <div className="text-lg text-[#532E1C] mt-1 tracking-wide">
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
                            <div className="mt-3 p-3 bg-[#C5A880] rounded text-lg flex justify-between items-center">
                                <span className="text-[#532E1C] font-bold tracking-wide">✅ Your selected dates: {getCurrentUserDateSelection()!.dates.map(date =>
                                    new Date(date + 'T00:00:00').toLocaleDateString()
                                ).join(', ')}</span>
                                <button
                                    onClick={deleteDateSelection}
                                    className="bg-[#532E1C] text-white text-base px-3 py-1 rounded hover:bg-[#0F0F0F] transition-colors font-bold tracking-wide"
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Suggestions Section */}
                    <div className="bg-white p-6 rounded-lg border-2 border-[#C5A880]">
                        <h3 className="text-xl font-bold mb-4 text-[#532E1C] tracking-wide">💡 Activity Suggestions</h3>

                        {!getCurrentUserSuggestion() ? (
                            <div className="flex space-x-2 mb-4">
                                <input
                                    type="text"
                                    placeholder="Suggest an activity (you can only suggest once)..."
                                    value={newSuggestion}
                                    onChange={(e) => setNewSuggestion(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && sendSuggestion()}
                                    className="flex-1 p-3 border-2 border-[#C5A880] rounded-md focus:outline-none focus:ring-2 focus:ring-[#C5A880] text-[#0F0F0F] text-lg"
                                />
                                <button
                                    onClick={sendSuggestion}
                                    disabled={!newSuggestion.trim()}
                                    className="bg-[#C5A880] text-[#532E1C] px-6 py-3 rounded-md hover:bg-[#532E1C] hover:text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-bold text-lg tracking-wide"
                                >
                                    Suggest
                                </button>
                            </div>
                        ) : (
                            <div className="mb-4 p-3 bg-[#C5A880] rounded text-lg flex justify-between items-center">
                                <span className="text-[#532E1C] font-bold tracking-wide">✅ Your suggestion: &quot;{getCurrentUserSuggestion()!.suggestion}&quot;</span>
                                <button
                                    onClick={deleteSuggestion}
                                    className="bg-[#532E1C] text-white text-base px-3 py-1 rounded hover:bg-[#0F0F0F] transition-colors font-bold tracking-wide"
                                >
                                    Delete
                                </button>
                            </div>
                        )}

                        <div className="space-y-3">
                            <h4 className="font-bold text-[#532E1C] text-lg tracking-wide">All Suggestions:</h4>
                            {suggestions.length === 0 ? (
                                <p className="text-[#532E1C] text-lg tracking-wide">No suggestions yet</p>
                            ) : (
                                suggestions.map((suggestion) => (
                                    <div key={suggestion.userId} className="bg-[#E6E6E6] p-4 rounded border-2 border-[#C5A880]">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="font-bold text-[#532E1C] text-lg tracking-wide">{suggestion.username}:</span>
                                                <span className="ml-2 text-[#0F0F0F] text-lg tracking-wide">{suggestion.suggestion}</span>
                                            </div>
                                            <small className="text-[#532E1C] text-base tracking-wide">
                                                {new Date(suggestion.timestamp).toLocaleTimeString()}
                                            </small>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span className="text-lg text-[#532E1C] font-bold tracking-wide">
                                                Votes: {voteCounts[suggestion.suggestion] || 0}
                                            </span>

                                            {getCurrentUserVote()?.votedFor === suggestion.suggestion ? (
                                                <span className="text-lg bg-[#C5A880] text-[#532E1C] px-3 py-1 rounded font-bold tracking-wide">
                                                    ✅ You voted for this
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => sendVote(suggestion.suggestion)}
                                                    className="cursor-pointer bg-[#532E1C] text-white text-lg px-4 py-2 rounded hover:bg-[#0F0F0F] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-bold tracking-wide"
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
                            <div className="mt-3 p-3 bg-[#C5A880] rounded text-lg">
                                <span className="text-[#532E1C] font-bold tracking-wide">🗳️ You voted for: &quot;{getCurrentUserVote()!.votedFor}&quot;</span>
                            </div>
                        )}

                        {/* Vote Results */}
                        {Object.keys(voteCounts).length > 0 && (
                            <div className="mt-4 p-4 bg-[#E6E6E6] rounded border-2 border-[#C5A880]">
                                <h4 className="font-bold mb-2 text-[#532E1C] text-lg tracking-wide">🏆 Vote Results:</h4>
                                <div className="space-y-1">
                                    {Object.entries(voteCounts)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([suggestion, count]) => (
                                            <div key={suggestion} className="flex justify-between">
                                                <span className={`text-lg tracking-wide ${count === Math.max(...Object.values(voteCounts)) ? "font-bold text-[#532E1C]" : "text-[#0F0F0F]"}`}>
                                                    {suggestion}
                                                </span>
                                                <span className={`text-lg tracking-wide ${count === Math.max(...Object.values(voteCounts)) ? "font-bold text-[#532E1C]" : "text-[#0F0F0F]"}`}>
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
                        <div className="bg-[#C5A880] p-6 rounded-lg border-l-6 border-b-6 border-t-2 border-r-2 border-[#532E1C]">
                            <h3 className="text-xl font-bold mb-2 text-[#532E1C] tracking-wide">📋 Planning Summary</h3>
                            <div className="text-lg space-y-1 text-[#532E1C] tracking-wide">
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