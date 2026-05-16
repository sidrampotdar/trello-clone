import type { Board, Card, Comment, List } from "./types";

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function moveCardInBoard(
  board: Board,
  cardId: string,
  targetListId: string,
  targetIndex: number
): Board {
  let found: Card | null = null;
  let sourceListId: string | null = null;
  for (const l of board.lists) {
    const i = l.cards.findIndex((c) => c.id === cardId);
    if (i >= 0) {
      found = l.cards[i];
      sourceListId = l.id;
      break;
    }
  }
  if (!found || !sourceListId) return board;

  const next: Board = {
    ...board,
    lists: board.lists.map((l) => ({
      ...l,
      cards: l.id === sourceListId ? l.cards.filter((c) => c.id !== cardId) : [...l.cards],
    })),
  };
  const targetList = next.lists.find((l) => l.id === targetListId);
  if (!targetList) return board;
  const idx = Math.max(0, Math.min(targetIndex, targetList.cards.length));
  targetList.cards.splice(idx, 0, found);
  return next;
}

export function addCardToBoard(board: Board, listId: string, card: Card): Board {
  return {
    ...board,
    lists: board.lists.map((l) => (l.id === listId ? { ...l, cards: [...l.cards, card] } : l)),
  };
}

export function updateCardInBoard(board: Board, card: Card): Board {
  return {
    ...board,
    lists: board.lists.map((l) => ({
      ...l,
      cards: l.cards.map((c) => (c.id === card.id ? { ...c, ...card } : c)),
    })),
  };
}

export function deleteCardFromBoard(board: Board, cardId: string): Board {
  return {
    ...board,
    lists: board.lists.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) })),
  };
}

export function addListToBoard(board: Board, list: List): Board {
  return { ...board, lists: [...board.lists, list] };
}

export function appendCommentToCard(board: Board, cardId: string, comment: Comment): Board {
  return {
    ...board,
    lists: board.lists.map((l) => ({
      ...l,
      cards: l.cards.map((c) =>
        c.id === cardId ? { ...c, comments: [...(c.comments ?? []), comment] } : c
      ),
    })),
  };
}

export function archiveCardInBoard(board: Board, cardId: string, archived: boolean): Board {
  return {
    ...board,
    lists: board.lists.map((l) => ({
      ...l,
      cards: l.cards.map((c) => (c.id === cardId ? { ...c, archived } : c)),
    })),
  };
}

export function reorderListsInBoard(board: Board, listIds: string[]): Board {
  const byId = new Map(board.lists.map((l) => [l.id, l]));
  const reordered = listIds.map((id) => byId.get(id)).filter((l): l is List => Boolean(l));
  const missing = board.lists.filter((l) => !listIds.includes(l.id));
  return { ...board, lists: [...reordered, ...missing] };
}
