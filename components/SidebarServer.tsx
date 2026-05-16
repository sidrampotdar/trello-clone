import { auth } from "@/auth";
import { listBoardsForUser } from "@/lib/repository";
import { Sidebar } from "./Sidebar";

export async function SidebarServer() {
  const session = await auth();
  if (!session?.user) return null;
  const boards = await listBoardsForUser(session.user.id);
  return (
    <Sidebar
      boards={boards.map((b) => ({ id: b.id, title: b.title }))}
      user={{
        id: session.user.id,
        name: session.user.name ?? session.user.email ?? "User",
        email: session.user.email ?? "",
        image: session.user.image ?? undefined,
      }}
    />
  );
}
