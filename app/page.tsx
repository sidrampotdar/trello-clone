import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listBoardsForUser } from "@/lib/repository";
import { Kanban } from "@/components/kanban";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const boards = await listBoardsForUser(session.user.id);
  if (boards.length === 0) redirect("/boards");
  return <Kanban initialBoard={boards[0]} />;
}
