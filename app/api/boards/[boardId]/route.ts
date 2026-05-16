import { NextResponse } from "next/server";
import { getBoard } from "@/lib/repository";

export async function GET(_req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const board = await getBoard(boardId);
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(board);
}
