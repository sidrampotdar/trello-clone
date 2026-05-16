"use client";

import { Command } from "cmdk";
import { useEffect, useState, useTransition } from "react";
import { useBoardStore } from "@/lib/store";
import {
  createCardAction,
  createListAction,
  deleteCardAction,
  moveCardAction,
} from "@/lib/actions";
import { newId } from "@/lib/board-utils";
import type { Card } from "@/lib/types";

type Mode = "root" | "new-card" | "move-card" | "select-list" | "new-list";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("root");
  const [search, setSearch] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const board = useBoardStore((s) => s.board);
  const optimisticAddCard = useBoardStore((s) => s.optimisticAddCard);
  const optimisticAddList = useBoardStore((s) => s.optimisticAddList);
  const optimisticMoveCard = useBoardStore((s) => s.optimisticMoveCard);
  const optimisticDeleteCard = useBoardStore((s) => s.optimisticDeleteCard);
  const announce = useBoardStore((s) => s.announce);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (v) {
            setMode("root");
            setSearch("");
            setSelectedCardId(null);
          }
          return !v;
        });
      }
      if (e.key === "Escape") {
        setOpen((v) => {
          if (v) {
            setMode("root");
            setSearch("");
            setSelectedCardId(null);
          }
          return false;
        });
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!board) return null;

  const allCards = board.lists.flatMap((l) =>
    l.cards.map((c) => ({ ...c, listId: l.id, listTitle: l.title }))
  );

  function close() {
    setMode("root");
    setSearch("");
    setSelectedCardId(null);
    setOpen(false);
  }

  function handleCreateCard(listId: string, title: string) {
    const card: Card = { id: newId("card"), title, createdAt: "today" };
    optimisticAddCard(listId, card);
    announce(`Created card: ${title}`);
    startTransition(async () => {
      await createCardAction({ boardId: board!.id, listId, title });
    });
    close();
  }

  function handleCreateList(title: string) {
    const id = newId("list");
    optimisticAddList({ id, title, cards: [] });
    announce(`Created list: ${title}`);
    startTransition(async () => {
      await createListAction({ boardId: board!.id, title });
    });
    close();
  }

  function handleMoveCard(targetListId: string) {
    if (!selectedCardId) return;
    const targetList = board!.lists.find((l) => l.id === targetListId);
    optimisticMoveCard(selectedCardId, targetListId, targetList?.cards.length ?? 0);
    announce(`Moved card to ${targetList?.title}`);
    startTransition(async () => {
      await moveCardAction({
        boardId: board!.id,
        cardId: selectedCardId,
        targetListId,
        targetIndex: targetList?.cards.length ?? 0,
      });
    });
    close();
  }

  function handleDeleteCard(cardId: string) {
    optimisticDeleteCard(cardId);
    announce("Card deleted");
    startTransition(async () => {
      await deleteCardAction({ boardId: board!.id, cardId });
    });
    close();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24 backdrop-blur-sm"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-2xl"
      >
        <Command shouldFilter className="flex flex-col">
          <Command.Input
            autoFocus
            placeholder={
              mode === "root"
                ? "Type a command or search…"
                : mode === "new-card"
                ? "New card title…"
                : mode === "new-list"
                ? "New list title…"
                : mode === "select-list"
                ? "Pick destination list…"
                : "Search cards to move…"
            }
            value={search}
            onValueChange={setSearch}
            className="border-b border-zinc-800 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-zinc-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (mode === "new-card" || mode === "new-list") && search.trim()) {
                e.preventDefault();
                if (mode === "new-card") {
                  const list = board!.lists[0];
                  if (list) handleCreateCard(list.id, search.trim());
                } else {
                  handleCreateList(search.trim());
                }
              }
            }}
          />
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-zinc-500">
              {pending ? "Working…" : "No results."}
            </Command.Empty>

            {mode === "root" && (
              <>
                <Command.Group heading="Actions" className="text-xs uppercase tracking-wide text-zinc-500">
                  <PaletteItem onSelect={() => setMode("new-card")} hint="N">
                    New card…
                  </PaletteItem>
                  <PaletteItem onSelect={() => setMode("new-list")} hint="L">
                    New list…
                  </PaletteItem>
                  <PaletteItem onSelect={() => setMode("move-card")} hint="M">
                    Move card…
                  </PaletteItem>
                </Command.Group>
                <Command.Group heading="Cards" className="text-xs uppercase tracking-wide text-zinc-500">
                  {allCards.map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`${c.title} ${c.description ?? ""} ${c.listTitle}`}
                      onSelect={() => {
                        setSelectedCardId(c.id);
                        setMode("select-list");
                        setSearch("");
                      }}
                      className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm aria-selected:bg-zinc-800"
                    >
                      <span className="truncate">{c.title}</span>
                      <span className="ml-3 shrink-0 text-xs text-zinc-500">{c.listTitle}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            )}

            {mode === "move-card" && (
              <Command.Group heading="Pick a card to move">
                {allCards.map((c) => (
                  <Command.Item
                    key={c.id}
                    value={`${c.title} ${c.listTitle}`}
                    onSelect={() => {
                      setSelectedCardId(c.id);
                      setMode("select-list");
                      setSearch("");
                    }}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-sm aria-selected:bg-zinc-800"
                  >
                    <span className="truncate">{c.title}</span>
                    <span className="ml-3 shrink-0 text-xs text-zinc-500">{c.listTitle}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {mode === "select-list" && selectedCardId && (
              <Command.Group heading="Move to list">
                {board.lists.map((l) => (
                  <PaletteItem key={l.id} onSelect={() => handleMoveCard(l.id)}>
                    {l.title}
                  </PaletteItem>
                ))}
                <PaletteItem onSelect={() => handleDeleteCard(selectedCardId)}>
                  Delete card
                </PaletteItem>
              </Command.Group>
            )}
          </Command.List>
          <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px] text-zinc-500">
            <span>↑↓ navigate · ↵ select · esc close</span>
            <span>⌘K</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

function PaletteItem({
  children,
  onSelect,
  hint,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  hint?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      value={typeof children === "string" ? children : undefined}
      className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm aria-selected:bg-zinc-800"
    >
      <span>{children}</span>
      {hint ? <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{hint}</kbd> : null}
    </Command.Item>
  );
}
