import "server-only";
import { auth } from "@/auth";
import { getBoard } from "./repository";
import type { Board, BoardMember } from "./types";

export class AuthzError extends Error {
  constructor(public code: "unauthorized" | "forbidden" | "not_found", message?: string) {
    super(message ?? code);
  }
}

export interface AuthorizedSession {
  userId: string;
  userName: string;
  email: string;
}

export async function requireSession(): Promise<AuthorizedSession> {
  const s = await auth();
  if (!s?.user?.id) throw new AuthzError("unauthorized");
  return {
    userId: s.user.id,
    userName: s.user.name ?? s.user.email ?? "User",
    email: s.user.email ?? "",
  };
}

export type BoardRole = BoardMember["role"];

const ROLE_RANK: Record<BoardRole, number> = { member: 1, admin: 2, owner: 3 };

export function memberRole(board: Board, userId: string): BoardRole | null {
  if (board.ownerId && board.ownerId === userId) return "owner";
  const m = (board.members ?? []).find((x) => x.userId === userId);
  return m?.role ?? null;
}

export function canRead(board: Board, userId: string): boolean {
  if (memberRole(board, userId)) return true;
  if (!board.ownerId) return true;
  return board.visibility === "workspace" || board.visibility === "public";
}

export function canWrite(board: Board, userId: string): boolean {
  return Boolean(memberRole(board, userId));
}

export function hasRole(board: Board, userId: string, min: BoardRole): boolean {
  const r = memberRole(board, userId);
  if (!r) return false;
  return ROLE_RANK[r] >= ROLE_RANK[min];
}

export async function requireBoardAccess(
  boardId: string,
  mode: "read" | "write" | "admin" = "write"
): Promise<{ session: AuthorizedSession; board: Board }> {
  const session = await requireSession();
  const board = await getBoard(boardId);
  if (!board) throw new AuthzError("not_found");
  if (mode === "read" && !canRead(board, session.userId)) {
    throw new AuthzError("forbidden");
  }
  if (mode === "write" && !canWrite(board, session.userId)) {
    throw new AuthzError("forbidden");
  }
  if (mode === "admin" && !hasRole(board, session.userId, "admin")) {
    throw new AuthzError("forbidden");
  }
  return { session, board };
}
