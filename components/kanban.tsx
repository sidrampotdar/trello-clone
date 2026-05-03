"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DragDropManager,
  Droppable,
  Feedback,
  type DragEndEvent,
} from "@dnd-kit/dom";
import { OptimisticSortingPlugin, Sortable } from "@dnd-kit/dom/sortable";
import { boards } from "@/lib/data";
import type { Board, Card } from "@/lib/types";

type CardLocation = {
  listId: string;
  index: number;
};

const priorityStyles: Record<NonNullable<Card["priority"]>, string> = {
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  High: "border-rose-200 bg-rose-50 text-rose-700",
};

function findCard(board: Board, cardId: string): CardLocation | null {
  for (const list of board.lists) {
    const index = list.cards.findIndex((card) => card.id === cardId);

    if (index !== -1) {
      return { listId: list.id, index };
    }
  }

  return null;
}

function moveCard(board: Board, event: DragEndEvent): Board {
  const { source, target } = event.operation;

  if (!source || !target || event.canceled) {
    return board;
  }

  const sourceLocation = findCard(board, String(source.id));

  if (!sourceLocation) {
    return board;
  }

  const sourceList = board.lists.find((list) => list.id === sourceLocation.listId);
  const card = sourceList?.cards[sourceLocation.index];

  if (!card) {
    return board;
  }

  const targetCardLocation = findCard(board, String(target.id));
  const targetListId = targetCardLocation?.listId ?? String(target.id);
  const targetList = board.lists.find((list) => list.id === targetListId);

  if (!targetList) {
    return board;
  }

  const nextListId = targetListId;
  const nextList = board.lists.find((list) => list.id === nextListId);

  if (!nextList) {
    return board;
  }

  let nextIndex: number;

  if (targetCardLocation) {
    const isBelowTarget =
      target.shape &&
      event.operation.shape?.current.center.y &&
      event.operation.shape.current.center.y > target.shape.center.y;

    nextIndex = targetCardLocation.index + (isBelowTarget ? 1 : 0);
  } else {
    nextIndex = nextList.cards.length;
  }

  if (sourceLocation.listId === nextListId && sourceLocation.index < nextIndex) {
    nextIndex -= 1;
  }

  const withoutCard = board.lists.map((list) =>
    list.id === sourceLocation.listId
      ? {
          ...list,
          cards: list.cards.filter((item) => item.id !== card.id),
        }
      : list
  );

  return {
    ...board,
    lists: withoutCard.map((list) => {
      if (list.id !== nextListId) {
        return list;
      }

      const clampedIndex = Math.max(0, Math.min(nextIndex, list.cards.length));
      const cards = [...list.cards];
      cards.splice(clampedIndex, 0, card);

      return { ...list, cards };
    }),
  };
}

export const Kanban = () => {
  const [board, setBoard] = useState<Board>(boards[0]);
  const [manager] = useState(
    () =>
      new DragDropManager({
        plugins: (defaults) =>
          defaults.map((plugin) =>
            plugin === Feedback
              ? Feedback.configure({ dropAnimation: null })
              : plugin
          ),
      })
  );
  const pendingMoveTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const taskCount = useMemo(
    () => board.lists.reduce((total, list) => total + list.cards.length, 0),
    [board.lists]
  );

  useEffect(() => {
    const cleanup = manager.monitor.addEventListener("dragend", (event) => {
      const timeout = setTimeout(() => {
        setBoard((currentBoard) => moveCard(currentBoard, event));
        pendingMoveTimeoutsRef.current = pendingMoveTimeoutsRef.current.filter(
          (pendingTimeout) => pendingTimeout !== timeout
        );
      }, 0);

      pendingMoveTimeoutsRef.current.push(timeout);
    });

    return () => {
      cleanup();

      for (const timeout of pendingMoveTimeoutsRef.current) {
        clearTimeout(timeout);
      }

      pendingMoveTimeoutsRef.current = [];
      manager.destroy();
    };
  }, [manager]);

  useEffect(() => {
    const cleanup: Array<() => void> = [];

    for (const list of board.lists) {
      const columnElement = columnRefs.current.get(list.id);

      if (columnElement) {
        const column = new Droppable(
          {
            id: list.id,
            element: columnElement,
            type: "column",
            accept: "card",
          },
          manager
        );

        cleanup.push(manager.registry.register(column));
      }

      for (const [index, card] of list.cards.entries()) {
        const cardElement = cardRefs.current.get(card.id);

        if (!cardElement) {
          continue;
        }

        const sortable = new Sortable(
          {
            id: card.id,
            element: cardElement,
            group: list.id,
            index,
            type: "card",
            accept: "card",
            plugins: (defaults) =>
              defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
          },
          manager
        );

        cleanup.push(sortable.register());
      }
    }

    return () => {
      for (const dispose of cleanup.reverse()) {
        dispose();
      }
    };
  }, [board, manager]);

  return (
    <main className="min-h-screen bg-[#0f5338] text-slate-950">
      <header className="flex flex-col gap-4 border-b border-white/15 bg-[#0b3d2e]/85 px-5 py-4 text-white shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-100">Workspace board</p>
          <h1 className="text-2xl font-semibold tracking-normal">{board.title}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-emerald-50">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
            {board.lists.length} lists
          </span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
            {taskCount} cards
          </span>
        </div>
      </header>

      <section className="flex min-h-[calc(100vh-89px)] gap-4 overflow-x-auto px-4 py-5">
        {board.lists.map((list) => (
          <div
            className="flex h-fit max-h-[calc(100vh-130px)] w-72 shrink-0 flex-col rounded-lg bg-slate-100 shadow-xl shadow-slate-950/20"
            key={list.id}
          >
            <div className="flex items-center justify-between px-3 py-3">
              <h2 className="text-sm font-semibold text-slate-800">{list.title}</h2>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {list.cards.length}
              </span>
            </div>

            <div
              className="flex min-h-28 flex-col gap-3 overflow-y-auto px-3 pb-3"
              ref={(node) => {
                if (node) {
                  columnRefs.current.set(list.id, node);
                } else {
                  columnRefs.current.delete(list.id);
                }
              }}
            >
              {list.cards.map((card) => (
                <article
                  className="touch-none rounded-md border border-slate-200 bg-white p-3 shadow-sm outline-none transition hover:border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500"
                  key={card.id}
                  ref={(node) => {
                    if (node) {
                      cardRefs.current.set(card.id, node);
                    } else {
                      cardRefs.current.delete(card.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {card.labels?.map((label) => (
                      <span
                        className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
                        key={label}
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-sm font-semibold leading-5 text-slate-900">
                    {card.title}
                  </h3>

                  {card.description ? (
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {card.description}
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-500">
                      {card.createdAt}
                    </span>
                    <div className="flex items-center gap-2">
                      {card.priority ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityStyles[card.priority]}`}
                        >
                          {card.priority}
                        </span>
                      ) : null}
                      {card.assignee ? (
                        <span className="grid size-7 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-white">
                          {card.assignee}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}

              {list.cards.length === 0 ? (
                <div className="grid min-h-20 place-items-center rounded-md border border-dashed border-slate-300 px-3 text-center text-sm text-slate-500">
                  Drop a card here
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
};
