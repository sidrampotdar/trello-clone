"use client";

import { useEffect, useState, useTransition } from "react";
import { useBoardStore } from "@/lib/store";
import {
  addCommentAction,
  archiveCardAction,
  deleteCardAction,
  setAssigneesAction,
  setCoverAction,
  setDueDateAction,
  updateCardAction,
} from "@/lib/actions";
import type { Card, CoverColor, Priority } from "@/lib/types";

const PRIORITIES: Priority[] = ["Low", "Medium", "High"];
const COVERS: CoverColor[] = ["none", "emerald", "sky", "violet", "amber", "rose", "slate"];

const coverBg: Record<CoverColor, string> = {
  none: "bg-zinc-700",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

export function CardDetailModal() {
  const board = useBoardStore((s) => s.board);
  const openCardId = useBoardStore((s) => s.openCardId);
  const setOpenCardId = useBoardStore((s) => s.setOpenCardId);
  const optimisticUpdateCard = useBoardStore((s) => s.optimisticUpdateCard);
  const optimisticDeleteCard = useBoardStore((s) => s.optimisticDeleteCard);
  const announce = useBoardStore((s) => s.announce);
  const [, startTransition] = useTransition();

  const [draft, setDraft] = useState<Card | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  // Sync draft from board state when modal opens or upstream card changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!openCardId || !board) {
      setDraft(null);
      return;
    }
    for (const l of board.lists) {
      const c = l.cards.find((x) => x.id === openCardId);
      if (c) {
        setDraft(c);
        return;
      }
    }
  }, [openCardId, board]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && openCardId) setOpenCardId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCardId, setOpenCardId]);

  if (!openCardId || !draft || !board) return null;

  const labels = board.labels ?? [];
  const members = board.members ?? [];

  function commit(next: Card) {
    setDraft(next);
    optimisticUpdateCard(next);
    startTransition(async () => {
      await updateCardAction({ boardId: board!.id, card: next });
    });
  }

  function close() {
    setOpenCardId(null);
  }

  function handleDelete() {
    optimisticDeleteCard(draft!.id);
    announce(`Deleted card: ${draft!.title}`);
    startTransition(async () => {
      await deleteCardAction({ boardId: board!.id, cardId: draft!.id });
    });
    close();
  }

  function handleArchive() {
    optimisticDeleteCard(draft!.id);
    startTransition(async () => {
      await archiveCardAction({ boardId: board!.id, cardId: draft!.id, archived: true });
    });
    close();
  }

  function handleDueDate(value: string) {
    const next = { ...draft!, dueDate: value || undefined };
    setDraft(next);
    optimisticUpdateCard(next);
    startTransition(async () => {
      await setDueDateAction({ boardId: board!.id, cardId: draft!.id, dueDate: value });
    });
  }

  function toggleAssignee(userId: string) {
    const has = (draft!.assignees ?? []).includes(userId);
    const nextList = has
      ? (draft!.assignees ?? []).filter((a) => a !== userId)
      : [...(draft!.assignees ?? []), userId];
    const next = { ...draft!, assignees: nextList };
    setDraft(next);
    optimisticUpdateCard(next);
    startTransition(async () => {
      await setAssigneesAction({ boardId: board!.id, cardId: draft!.id, assignees: nextList });
    });
  }

  function toggleLabel(labelId: string) {
    const has = (draft!.labelIds ?? []).includes(labelId);
    const next = {
      ...draft!,
      labelIds: has
        ? (draft!.labelIds ?? []).filter((id) => id !== labelId)
        : [...(draft!.labelIds ?? []), labelId],
    };
    commit(next);
  }

  function setCover(c: CoverColor) {
    const next = { ...draft!, cover: c === "none" ? undefined : c };
    setDraft(next);
    optimisticUpdateCard(next);
    startTransition(async () => {
      await setCoverAction({
        boardId: board!.id,
        cardId: draft!.id,
        cover: c === "none" ? undefined : c,
      });
    });
  }

  async function postComment() {
    const text = comment.trim();
    if (!text) return;
    setComment("");
    startTransition(async () => {
      const r = await addCommentAction({ boardId: board!.id, cardId: draft!.id, text });
      if (r.ok) {
        const next = { ...draft!, comments: [...(draft!.comments ?? []), r.comment] };
        setDraft(next);
        optimisticUpdateCard(next);
      }
    });
  }

  async function addMember() {
    const email = memberEmail.trim();
    if (!email) return;
    setMemberEmail("");
    const r = await fetch("/api/board-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId: board!.id, email }),
    });
    if (!r.ok) announce(`Failed to invite: ${(await r.json().catch(() => ({}))).error ?? "error"}`);
    else announce(`Invited ${email}`);
  }

  async function runAI() {
    setAiLoading(true);
    try {
      const r = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: draft!.description ?? draft!.title }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as {
        estimate: string;
        difficulty: "Easy" | "Medium" | "Hard";
        subtasks: { id: string; text: string; done: boolean }[];
      };
      commit({ ...draft!, estimate: data.estimate, difficulty: data.difficulty, subtasks: data.subtasks });
      announce(`AI breakdown applied: ${data.subtasks.length} subtasks`);
    } finally {
      setAiLoading(false);
    }
  }

  function toggleSubtask(id: string) {
    const next: Card = {
      ...draft!,
      subtasks: (draft!.subtasks ?? []).map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    };
    commit(next);
  }

  /* eslint-disable react-hooks/purity */
  // Recomputes on each render is intentional — used only for visual badge styling.
  const overdue = Boolean(
    draft.dueDate && !draft.subtasks?.every((s) => s.done) && new Date(draft.dueDate).getTime() < Date.now()
  );
  /* eslint-enable react-hooks/purity */

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit card ${draft.title}`}
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-2xl"
      >
        {draft.cover && draft.cover !== "none" && (
          <div className={`h-12 ${coverBg[draft.cover]}`} aria-hidden />
        )}

        <div className="flex items-start justify-between border-b border-zinc-800 px-5 py-3">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onBlur={(e) => commit({ ...draft, title: e.target.value })}
            aria-label="Card title"
            className="w-full bg-transparent text-base font-semibold text-zinc-50 outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="ml-3 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
          >
            esc
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 px-5 py-4 text-sm">
          <div className="col-span-2 space-y-4">
            <Field label="Description">
              <textarea
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                onBlur={(e) => commit({ ...draft, description: e.target.value })}
                rows={3}
                aria-label="Card description"
                className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-950/60 p-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400"
                placeholder="Describe the work…"
              />
            </Field>

            <section aria-labelledby="subtasks-heading" className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 id="subtasks-heading" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Checklist
                </h3>
                <button
                  type="button"
                  onClick={runAI}
                  disabled={aiLoading}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                >
                  {aiLoading ? "Generating…" : "AI breakdown"}
                </button>
              </div>
              {(draft.estimate || draft.difficulty) && (
                <div className="flex gap-2 text-[11px] text-zinc-400">
                  {draft.difficulty && <span className="rounded-full bg-zinc-800 px-2 py-0.5">{draft.difficulty}</span>}
                  {draft.estimate && <span className="rounded-full bg-zinc-800 px-2 py-0.5">≈ {draft.estimate}</span>}
                </div>
              )}
              {(draft.subtasks?.length ?? 0) === 0 ? (
                <p className="text-xs text-zinc-500">No checklist items. Run AI breakdown to generate.</p>
              ) : (
                <ul className="space-y-1">
                  {draft.subtasks!.map((s) => (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-zinc-800/60">
                        <input
                          type="checkbox"
                          checked={s.done}
                          onChange={() => toggleSubtask(s.id)}
                          className="mt-0.5 size-4 accent-emerald-500"
                          aria-label={`Toggle ${s.text}`}
                        />
                        <span className={s.done ? "text-zinc-500 line-through" : "text-zinc-200"}>{s.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="comments-heading" className="space-y-2">
              <h3 id="comments-heading" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Comments
              </h3>
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      postComment();
                    }
                  }}
                  placeholder="Add a comment…"
                  aria-label="Add comment"
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  onClick={postComment}
                  className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
                >
                  Post
                </button>
              </div>
              {(draft.comments?.length ?? 0) === 0 ? (
                <p className="text-xs text-zinc-500">No comments yet.</p>
              ) : (
                <ul className="space-y-2">
                  {[...(draft.comments ?? [])].reverse().map((c) => (
                    <li key={c.id} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span className="font-semibold text-zinc-300">{c.userName}</span>
                        <time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString()}</time>
                      </div>
                      <p className="mt-1 text-sm text-zinc-100">{c.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="col-span-1 space-y-3">
            <Field label="Priority">
              <select
                value={draft.priority ?? ""}
                onChange={(e) =>
                  commit({ ...draft, priority: (e.target.value || undefined) as Priority | undefined })
                }
                aria-label="Card priority"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950/60 px-2 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">—</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={overdue ? "Due (OVERDUE)" : "Due date"}>
              <input
                type="date"
                value={draft.dueDate ? draft.dueDate.slice(0, 10) : ""}
                onChange={(e) => handleDueDate(e.target.value)}
                aria-label="Due date"
                className={`w-full rounded-md border bg-zinc-950/60 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400 ${
                  overdue ? "border-rose-500 text-rose-300" : "border-zinc-700 text-zinc-100 focus:border-emerald-500"
                }`}
              />
            </Field>

            <Field label="Cover">
              <div className="flex flex-wrap gap-1.5">
                {COVERS.map((c) => {
                  const active = (draft.cover ?? "none") === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cover ${c}${active ? " (selected)" : ""}`}
                      onClick={() => setCover(c)}
                      className={`size-6 rounded-md ${coverBg[c]} ring-2 ring-offset-2 ring-offset-zinc-900 transition ${
                        active ? "ring-emerald-400" : "ring-transparent"
                      }`}
                    />
                  );
                })}
              </div>
            </Field>

            <Field label="Labels">
              <div className="flex flex-wrap gap-1.5">
                {labels.length === 0 && (
                  <p className="text-xs text-zinc-500">No board labels yet.</p>
                )}
                {labels.map((l) => {
                  const on = (draft.labelIds ?? []).includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLabel(l.id)}
                      aria-label={`Label ${l.name}${on ? " (selected)" : ""}`}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${coverBg[l.color]} ${
                        on ? "opacity-100 ring-2 ring-offset-2 ring-offset-zinc-900 ring-emerald-400" : "opacity-60"
                      }`}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Members">
              {members.length === 0 && (
                <p className="text-xs text-zinc-500">No board members yet.</p>
              )}
              <ul className="space-y-1">
                {members.map((m) => {
                    const on = (draft.assignees ?? []).includes(m.userId);
                    return (
                      <li key={m.userId}>
                        <button
                          type="button"
                          onClick={() => toggleAssignee(m.userId)}
                          aria-label={`${on ? "Unassign" : "Assign"} ${m.userId}`}
                          className={`flex w-full items-center justify-between rounded-md border px-2 py-1 text-xs ${
                            on
                              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                              : "border-zinc-700 bg-zinc-950/40 text-zinc-300 hover:border-zinc-500"
                          }`}
                        >
                          <span className="truncate">{m.userId}</span>
                          <span className="text-[10px] uppercase">{m.role}</span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
              <div className="mt-2 flex gap-1.5">
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="invite by email…"
                  aria-label="Invite member"
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-950/60 px-2 py-1 text-xs outline-none placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  onClick={addMember}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-semibold hover:border-emerald-400"
                >
                  Invite
                </button>
              </div>
            </Field>
          </aside>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/60 px-5 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleArchive}
              className="rounded-md border border-amber-700/50 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:border-amber-500"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md border border-rose-700/50 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:border-rose-500"
            >
              Delete
            </button>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
