"use client";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const useSocket = (url: string) => {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        console.log(process.env.NEXT_PUBLIC_SOCKET_URL || url);
        const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || url, {
            transports: ["websocket"]
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("✅ Connected to server:", socket.id);
        });

        socket.on("disconnect", () => {
            console.log("🔌 Disconnected from server");
        });

        return () => {
            socket.disconnect();
        };
    }, [url]);

    return socketRef;
};

export default useSocket;
