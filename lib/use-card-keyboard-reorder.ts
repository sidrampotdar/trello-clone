"use client";

import { useTransition, type KeyboardEvent } from "react";
import { useBoardStore } from "./store";
import { moveCardAction } from "./actions";

export function useCardKeyboardReorder() {
  const board = useBoardStore((s) => s.board);
  const optimisticMoveCard = useBoardStore((s) => s.optimisticMoveCard);
  const announce = useBoardStore((s) => s.announce);
  const [, startTransition] = useTransition();

  return function handleKey(
    event: KeyboardEvent<HTMLElement>,
    cardId: string,
    listId: string
  ) {
    if (!board) return;
    if (!event.ctrlKey && !event.metaKey) return;

    const list = board.lists.find((l) => l.id === listId);
    if (!list) return;
    const cardIndex = list.cards.findIndex((c) => c.id === cardId);
    const listIndex = board.lists.findIndex((l) => l.id === listId);
    if (cardIndex < 0 || listIndex < 0) return;

    let targetListId = listId;
    let targetIndex = cardIndex;

    switch (event.key) {
      case "ArrowUp":
        if (cardIndex === 0) return;
        targetIndex = cardIndex - 1;
        break;
      case "ArrowDown":
        if (cardIndex >= list.cards.length - 1) return;
        targetIndex = cardIndex + 1;
        break;
      case "ArrowLeft": {
        if (listIndex === 0) return;
        const prev = board.lists[listIndex - 1];
        targetListId = prev.id;
        targetIndex = prev.cards.length;
        break;
      }
      case "ArrowRight": {
        if (listIndex >= board.lists.length - 1) return;
        const next = board.lists[listIndex + 1];
        targetListId = next.id;
        targetIndex = next.cards.length;
        break;
      }
      default:
        return;
    }

    event.preventDefault();
    optimisticMoveCard(cardId, targetListId, targetIndex);
    const targetList = board.lists.find((l) => l.id === targetListId);
    announce(`Moved to ${targetList?.title ?? "list"} position ${targetIndex + 1}`);
    startTransition(async () => {
      await moveCardAction({ boardId: board.id, cardId, targetListId, targetIndex });
    });

    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
      el?.focus();
    });
  };
}
