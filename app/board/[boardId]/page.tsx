import { Kanban } from "@/components/kanban";
import { getBoard } from "@/lib/repository";
import { notFound } from "next/navigation";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const board = await getBoard(boardId);
  if (!board) notFound();
  return <Kanban initialBoard={board} />;
}
