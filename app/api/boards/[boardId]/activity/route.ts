import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listActivity } from "@/lib/repository";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json([], { status: 401 });
  const { boardId } = await params;
  const items = await listActivity(boardId, 100);
  return NextResponse.json(items);
}
