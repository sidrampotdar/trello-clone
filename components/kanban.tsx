"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DragDropManager,
  Feedback,
  type DragEndEvent,
} from "@dnd-kit/dom";
import { OptimisticSortingPlugin, Sortable } from "@dnd-kit/dom/sortable";
import type { Board, Card } from "@/lib/types";
import { useBoardStore } from "@/lib/store";
import { moveCardAction, reorderListsAction } from "@/lib/actions";
import { getSocket } from "@/lib/socket-client";
import { useCardKeyboardReorder } from "@/lib/use-card-keyboard-reorder";
import { ActivityFeed } from "./ActivityFeed";

const priorityStyles: Record<NonNullable<Card["priority"]>, string> = {
  Low: "border-emerald-700/40 bg-emerald-500/10 text-emerald-300",
  Medium: "border-amber-700/40 bg-amber-500/10 text-amber-300",
  High: "border-rose-700/40 bg-rose-500/10 text-rose-300",
};

const coverBg: Record<NonNullable<Card["cover"]>, string> = {
  none: "bg-zinc-700",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

function isOverdue(card: Card) {
  if (!card.dueDate) return false;
  if (card.subtasks && card.subtasks.length > 0 && card.subtasks.every((s) => s.done)) return false;
  return new Date(card.dueDate).getTime() < Date.now();
}

function formatDue(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function findCard(board: Board, cardId: string) {
  for (const list of board.lists) {
    const index = list.cards.findIndex((card) => card.id === cardId);
    if (index !== -1) return { listId: list.id, index };
  }
  return null;
}

function computeDrop(board: Board, event: DragEndEvent) {
  const { source, target } = event.operation;
  if (!source || !target || event.canceled) return null;

  const sourceLocation = findCard(board, String(source.id));
  if (!sourceLocation) return null;

  const targetCardLocation = findCard(board, String(target.id));
  const targetListId = targetCardLocation?.listId ?? String(target.id);
  const targetList = board.lists.find((l) => l.id === targetListId);
  if (!targetList) return null;

  let nextIndex: number;
  if (targetCardLocation) {
    const isBelowTarget =
      target.shape &&
      event.operation.shape?.current.center.y &&
      event.operation.shape.current.center.y > target.shape.center.y;
    nextIndex = targetCardLocation.index + (isBelowTarget ? 1 : 0);
  } else {
    nextIndex = targetList.cards.length;
  }
  if (sourceLocation.listId === targetListId && sourceLocation.index < nextIndex) {
    nextIndex -= 1;
  }
  return {
    cardId: String(source.id),
    targetListId,
    targetIndex: Math.max(0, Math.min(nextIndex, targetList.cards.length)),
    sourceListId: sourceLocation.listId,
  };
}

export function Kanban({ initialBoard }: { initialBoard: Board }) {
  const board = useBoardStore((s) => s.board);
  const setBoard = useBoardStore((s) => s.setBoard);
  const optimisticMoveCard = useBoardStore((s) => s.optimisticMoveCard);
  const optimisticReorderLists = useBoardStore((s) => s.optimisticReorderLists);
  const applyEvent = useBoardStore((s) => s.applyEvent);
  const announce = useBoardStore((s) => s.announce);
  const setOpenCardId = useBoardStore((s) => s.setOpenCardId);
  const [, startTransition] = useTransition();
  const handleCardKeyDown = useCardKeyboardReorder();

  const [manager] = useState(
    () =>
      new DragDropManager({
        plugins: (defaults) =>
          defaults.map((plugin) =>
            plugin === Feedback ? Feedback.configure({ dropAnimation: null }) : plugin
          ),
      })
  );
  const pendingMoveTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const columnSortableRefs = useRef(new Map<string, HTMLElement>());
  const columnHandleRefs = useRef(new Map<string, HTMLElement>());
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard, setBoard]);

  const taskCount = useMemo(
    () => (board ? board.lists.reduce((t, l) => t + l.cards.length, 0) : 0),
    [board]
  );

  useEffect(() => {
    const cleanup = manager.monitor.addEventListener("dragend", (event) => {
      const timeout = setTimeout(() => {
        const current = useBoardStore.getState().board;
        if (!current) return;

        const sourceType = event.operation.source?.type;
        if (sourceType === "list") {
          const sourceId = String(event.operation.source?.id ?? "");
          const targetId = String(event.operation.target?.id ?? "");
          if (!sourceId || !targetId || event.canceled) return;
          const currentIds = current.lists.map((l) => l.id);
          const fromIdx = currentIds.indexOf(sourceId);
          const toIdx = currentIds.indexOf(targetId);
          if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
          const nextIds = [...currentIds];
          nextIds.splice(fromIdx, 1);
          nextIds.splice(toIdx, 0, sourceId);
          optimisticReorderLists(nextIds);
          announce(`Reordered list ${current.lists.find((l) => l.id === sourceId)?.title ?? ""}`);
          startTransition(async () => {
            await reorderListsAction({ boardId: current.id, listIds: nextIds });
          });
          return;
        }

        const move = computeDrop(current, event);
        if (!move) return;
        optimisticMoveCard(move.cardId, move.targetListId, move.targetIndex);
        const fromList = current.lists.find((l) => l.id === move.sourceListId)?.title ?? "";
        const toList = current.lists.find((l) => l.id === move.targetListId)?.title ?? "";
        announce(`Moved card from ${fromList} to ${toList}`);
        startTransition(async () => {
          await moveCardAction({
            boardId: current.id,
            cardId: move.cardId,
            targetListId: move.targetListId,
            targetIndex: move.targetIndex,
          });
        });
        pendingMoveTimeoutsRef.current = pendingMoveTimeoutsRef.current.filter(
          (t) => t !== timeout
        );
      }, 0);
      pendingMoveTimeoutsRef.current.push(timeout);
    });
    return () => {
      cleanup();
      for (const t of pendingMoveTimeoutsRef.current) clearTimeout(t);
      pendingMoveTimeoutsRef.current = [];
      manager.destroy();
    };
  }, [manager, optimisticMoveCard, optimisticReorderLists, announce]);

  useEffect(() => {
    if (!board) return;
    const cleanup: Array<() => void> = [];
    for (const [listIndex, list] of board.lists.entries()) {
      const sortableEl = columnSortableRefs.current.get(list.id);
      const handleEl = columnHandleRefs.current.get(list.id);
      const cardsContainerEl = columnRefs.current.get(list.id);
      if (sortableEl && handleEl) {
        const listSortable = new Sortable(
          {
            id: list.id,
            element: sortableEl,
            target: cardsContainerEl ?? sortableEl,
            handle: handleEl,
            index: listIndex,
            type: "list",
            accept: ["list", "card"],
            group: "lists",
            plugins: (defaults) => defaults.filter((p) => p !== OptimisticSortingPlugin),
          },
          manager
        );
        cleanup.push(listSortable.register());
      }
      for (const [index, card] of list.cards.entries()) {
        const cardElement = cardRefs.current.get(card.id);
        if (!cardElement) continue;
        const sortable = new Sortable(
          {
            id: card.id,
            element: cardElement,
            group: list.id,
            index,
            type: "card",
            accept: "card",
            plugins: (defaults) => defaults.filter((p) => p !== OptimisticSortingPlugin),
          },
          manager
        );
        cleanup.push(sortable.register());
      }
    }
    return () => {
      for (const dispose of cleanup.reverse()) dispose();
    };
  }, [board, manager]);

  useEffect(() => {
    if (!board) return;
    const socket = getSocket();
    const room = `board:${board.id}`;
    socket.emit("join", room);
    const onEvent = (event: Parameters<typeof applyEvent>[0]) => {
      applyEvent(event);
    };
    socket.on(room, onEvent);
    return () => {
      socket.off(room, onEvent);
      socket.emit("leave", room);
    };
  }, [board, applyEvent]);

  if (!board) return null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex flex-col gap-4 border-b border-zinc-800 bg-zinc-900/85 px-5 py-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400">Workspace board</p>
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-50">{board.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
          <label className="flex items-center gap-2">
            <span className="sr-only">Filter cards</span>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter cards…"
              className="w-44 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400"
            />
          </label>
          <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1">
            {board.lists.length} lists
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1">
            {taskCount} cards
          </span>
          <ActivityFeed boardId={board.id} />
          <kbd className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300">⌘K</kbd>
        </div>
      </header>

      <section
        aria-label="Kanban board"
        className="flex min-h-[calc(100vh-89px)] gap-4 overflow-x-auto px-4 py-5"
      >
        {board.lists.map((list) => {
          const q = filter.trim().toLowerCase();
          const filteredCards = q
            ? list.cards.filter(
                (c) =>
                  c.title.toLowerCase().includes(q) ||
                  (c.description ?? "").toLowerCase().includes(q) ||
                  (c.labelIds ?? []).some((lid) =>
                    (board.labels ?? []).find((l) => l.id === lid)?.name.toLowerCase().includes(q)
                  )
              )
            : list.cards;
          return (
          <section
            className="flex h-fit max-h-[calc(100vh-130px)] w-72 shrink-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/40"
            key={list.id}
            aria-labelledby={`list-${list.id}-title`}
            ref={(node) => {
              if (node) columnSortableRefs.current.set(list.id, node);
              else columnSortableRefs.current.delete(list.id);
            }}
          >
            <div
              className="flex items-center justify-between px-3 py-3 cursor-grab active:cursor-grabbing"
              ref={(node) => {
                if (node) columnHandleRefs.current.set(list.id, node);
                else columnHandleRefs.current.delete(list.id);
              }}
            >
              <h2 id={`list-${list.id}-title`} className="text-sm font-semibold text-zinc-100">
                {list.title}
              </h2>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400">
                {q ? `${filteredCards.length}/${list.cards.length}` : list.cards.length}
              </span>
            </div>

            <div
              role="list"
              aria-label={`${list.title} cards`}
              className="flex min-h-28 flex-col gap-3 overflow-y-auto px-3 pb-3"
              ref={(node) => {
                if (node) columnRefs.current.set(list.id, node);
                else columnRefs.current.delete(list.id);
              }}
            >
              {filteredCards.map((card) => (
                <div
                  className="cursor-pointer touch-none rounded-md border border-zinc-800 bg-zinc-950/70 p-3 shadow-sm outline-none transition hover:border-emerald-500/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-400"
                  key={card.id}
                  role="listitem"
                  aria-label={`Card ${card.title} in ${list.title}. Press Enter to edit, Ctrl arrow keys to move.`}
                  data-card-id={card.id}
                  ref={(node) => {
                    if (node) cardRefs.current.set(card.id, node);
                    else cardRefs.current.delete(card.id);
                  }}
                  tabIndex={0}
                  onClick={() => setOpenCardId(card.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenCardId(card.id);
                      return;
                    }
                    handleCardKeyDown(e, card.id, list.id);
                  }}
                >
                  {card.cover && card.cover !== "none" && (
                    <div className={`-mx-3 -mt-3 mb-3 h-2 rounded-t-md ${coverBg[card.cover]}`} aria-hidden />
                  )}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {(card.labelIds ?? []).map((lid) => {
                      const lbl = (board.labels ?? []).find((l) => l.id === lid);
                      if (!lbl) return null;
                      return (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${coverBg[lbl.color]}`}
                          key={lid}
                        >
                          {lbl.name}
                        </span>
                      );
                    })}
                  </div>

                  <h3 className="text-sm font-semibold leading-5 text-zinc-100">{card.title}</h3>

                  {card.description ? (
                    <p className="mt-2 text-xs leading-5 text-zinc-400">{card.description}</p>
                  ) : null}

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px]">
                      {card.dueDate && (
                        <span
                          className={`rounded-full border px-2 py-0.5 font-semibold ${
                            isOverdue(card)
                              ? "border-rose-700/50 bg-rose-500/10 text-rose-300"
                              : "border-zinc-700 bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {formatDue(card.dueDate)}
                        </span>
                      )}
                      {card.subtasks && card.subtasks.length > 0 && (
                        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-zinc-400">
                          ☑ {card.subtasks.filter((s) => s.done).length}/{card.subtasks.length}
                        </span>
                      )}
                      {card.comments && card.comments.length > 0 && (
                        <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-zinc-400">
                          💬 {card.comments.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {card.priority ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityStyles[card.priority]}`}
                        >
                          {card.priority}
                        </span>
                      ) : null}
                      <div className="flex -space-x-2">
                        {(card.assignees ?? []).slice(0, 3).map((a) => (
                          <span
                            key={a}
                            title={a}
                            className="grid size-6 place-items-center rounded-full border-2 border-zinc-900 bg-zinc-700 text-[10px] font-semibold text-zinc-100"
                          >
                            {a.slice(0, 2).toUpperCase()}
                          </span>
                        ))}
                        {(card.assignees ?? []).length > 3 && (
                          <span className="grid size-6 place-items-center rounded-full border-2 border-zinc-900 bg-zinc-800 text-[10px] font-semibold text-zinc-300">
                            +{(card.assignees ?? []).length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredCards.length === 0 ? (
                <div className="grid min-h-20 place-items-center rounded-md border border-dashed border-zinc-700 px-3 text-center text-sm text-zinc-500">
                  {q ? "No matches" : "Drop a card here"}
                </div>
              ) : null}
            </div>
          </section>
          );
        })}
      </section>
    </main>
  );
}
