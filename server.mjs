/* Custom Next.js server with Socket.io for realtime board sync. */
import { createServer } from "http";
import next from "next";
import { Server as IoServer } from "socket.io";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const io = new IoServer(server, { path: "/api/socketio", cors: { origin: "*" } });

  io.on("connection", (socket) => {
    socket.on("join", (room) => {
      if (typeof room === "string") socket.join(room);
    });
    socket.on("leave", (room) => {
      if (typeof room === "string") socket.leave(room);
    });
  });

  globalThis._ioServer = {
    emit: (room, event) => io.to(room).emit(room, event),
  };

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (socket.io: /api/socketio)`);
  });
});
