"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
    socket = io(url, { path: "/api/socketio", transports: ["websocket", "polling"] });
  }
  return socket;
}
