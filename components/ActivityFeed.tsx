"use client";

import { useEffect, useState } from "react";
import { useBoardStore } from "@/lib/store";
import type { Activity } from "@/lib/types";

const TYPE_LABEL: Record<Activity["type"], string> = {
  card_created: "created",
  card_moved: "moved",
  card_updated: "updated",
  card_archived: "archived",
  card_deleted: "deleted",
  list_created: "added list",
  comment_added: "commented on",
  due_date_set: "set due date on",
  assignee_added: "updated assignees on",
  assignee_removed: "removed assignee from",
  member_added: "added member",
};

export function ActivityFeed({ boardId }: { boardId: string }) {
  const activity = useBoardStore((s) => s.activity);
  const setActivity = useBoardStore((s) => s.setActivity);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/boards/${boardId}/activity`)
      .then((r) => (r.ok ? r.json() : []))
      .then((items: Activity[]) => {
        if (!cancelled) setActivity(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [boardId, setActivity]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open activity feed"
        className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-200 hover:border-emerald-400 hover:text-emerald-300"
      >
        Activity ({activity.length})
      </button>
      {open && (
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Board activity feed"
          className="fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-50">Activity</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              esc
            </button>
          </header>
          <ul className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
            {activity.length === 0 ? (
              <li className="px-2 py-4 text-center text-xs text-zinc-500">No activity yet.</li>
            ) : (
              activity.map((a) => (
                <li
                  key={a.id}
                  className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="font-semibold text-zinc-300">{a.userName ?? "system"}</span>
                    <time dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleString()}</time>
                  </div>
                  <p className="mt-1 text-xs text-zinc-200">
                    <span className="text-zinc-400">{TYPE_LABEL[a.type]}</span>{" "}
                    {a.detail && <span className="text-zinc-100">{a.detail}</span>}
                  </p>
                </li>
              ))
            )}
          </ul>
        </aside>
      )}
    </>
  );
}
