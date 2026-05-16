"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useTransition } from "react";
import { createBoardAction } from "@/lib/actions";

interface UserShape {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export function Sidebar({
  boards,
  user,
}: {
  boards: { id: string; title: string }[];
  user?: UserShape;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  function isActive(href: string) {
    if (href === "/boards") return pathname === "/boards" || pathname === "/board";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      const r = await createBoardAction({ title: t });
      setTitle("");
      setCreating(false);
      if (r.ok) router.push(`/board/${r.board.id}`);
    });
  }

  return (
    <aside
      aria-label="Workspace navigation"
      className="hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 px-3 py-4 md:flex"
    >
      <div className="px-2 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Workspace</p>
        <h2 className="mt-1 text-sm font-semibold text-zinc-100">Engineering</h2>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Boards">
        <Link
          href="/boards"
          className={`block rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide ${
            isActive("/boards") ? "bg-zinc-800 text-emerald-300" : "text-zinc-500 hover:text-zinc-200"
          }`}
        >
          All boards
        </Link>
        <ul className="space-y-0.5">
          {boards.map((b) => (
            <li key={b.id}>
              <Link
                href={`/board/${b.id}`}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition ${
                  isActive(`/board/${b.id}`)
                    ? "bg-emerald-500/10 text-emerald-200"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
                }`}
              >
                <span className="truncate">{b.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-zinc-800 pt-3">
        {creating ? (
          <form onSubmit={submit} className="space-y-2">
            <label className="block">
              <span className="sr-only">New board title</span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Board title…"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-md bg-emerald-500 px-2 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setTitle("");
                }}
                className="rounded-md border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full rounded-md border border-dashed border-zinc-700 px-2 py-1.5 text-xs font-semibold text-zinc-300 hover:border-emerald-500 hover:text-emerald-300"
          >
            + New board
          </button>
        )}
      </div>

      <p className="mt-3 px-2 text-[11px] text-zinc-600">
        <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 text-[10px] text-zinc-300">⌘K</kbd>{" "}
        opens command palette
      </p>

      {user && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-2">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-200"
            aria-hidden
          >
            {user.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-zinc-100">{user.name}</p>
            <p className="truncate text-[10px] text-zinc-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ redirectTo: "/signin" })}
            aria-label="Sign out"
            className="rounded-md border border-zinc-700 px-1.5 py-1 text-[10px] font-semibold text-zinc-300 hover:border-rose-500 hover:text-rose-300"
          >
            Out
          </button>
        </div>
      )}
    </aside>
  );
}
