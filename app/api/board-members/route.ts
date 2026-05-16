import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addBoardMemberAction } from "@/lib/actions";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { boardId?: string; email?: string };
  if (!body.boardId || !body.email) {
    return NextResponse.json({ error: "boardId, email required" }, { status: 400 });
  }
  const r = await addBoardMemberAction({ boardId: body.boardId, email: body.email });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r.user);
}
