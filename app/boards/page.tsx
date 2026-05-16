import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listBoardsForUser } from "@/lib/repository";

export default async function BoardsIndex() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const boards = await listBoardsForUser(session.user.id);
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400">Workspace</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-50">Your boards</h1>
        </div>
        <kbd className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300">⌘K</kbd>
      </header>
      {boards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-6 text-center text-sm text-zinc-400">
          No boards yet. Use the sidebar to create one.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {boards.map((b) => {
            const cardCount = b.lists.reduce((t, l) => t + l.cards.length, 0);
            return (
              <li key={b.id}>
                <Link
                  href={`/board/${b.id}`}
                  className="block rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition hover:border-emerald-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <h2 className="text-base font-semibold text-zinc-100">{b.title}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {b.lists.length} lists · {cardCount} cards
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
