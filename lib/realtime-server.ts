import type { RealtimeEvent } from "./types";

declare global {
  var _ioServer: { emit: (room: string, event: RealtimeEvent) => void } | undefined;
}

export function setIoServer(io: { emit: (room: string, event: RealtimeEvent) => void }) {
  global._ioServer = io;
}

export function broadcast(boardId: string, event: RealtimeEvent) {
  global._ioServer?.emit(`board:${boardId}`, event);
}
