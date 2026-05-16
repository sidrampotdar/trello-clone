"use client";

import { create } from "zustand";
import type { Activity, Board, Card, List, RealtimeEvent } from "./types";
import {
  addCardToBoard,
  addListToBoard,
  deleteCardFromBoard,
  moveCardInBoard,
  reorderListsInBoard,
  updateCardInBoard,
} from "./board-utils";

type Announcer = (msg: string) => void;

interface BoardState {
  board: Board | null;
  setBoard: (b: Board) => void;
  applyEvent: (e: RealtimeEvent) => void;
  optimisticMoveCard: (cardId: string, targetListId: string, targetIndex: number) => void;
  optimisticAddCard: (listId: string, card: Card) => void;
  optimisticUpdateCard: (card: Card) => void;
  optimisticDeleteCard: (cardId: string) => void;
  optimisticAddList: (list: List) => void;
  optimisticReorderLists: (listIds: string[]) => void;
  openCardId: string | null;
  setOpenCardId: (id: string | null) => void;
  activity: Activity[];
  setActivity: (items: Activity[]) => void;
  pushActivity: (item: Activity) => void;
  announce: Announcer;
  setAnnouncer: (fn: Announcer) => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  board: null,
  setBoard: (b) => set({ board: b }),
  applyEvent: (e) => {
    const board = get().board;
    if (!board) return;
    switch (e.type) {
      case "card_moved":
        if (board.id !== e.boardId) return;
        set({ board: moveCardInBoard(board, e.cardId, e.targetListId, e.targetIndex) });
        get().announce(`Card moved to ${board.lists.find((l) => l.id === e.targetListId)?.title ?? "list"}`);
        break;
      case "card_created":
        if (board.id !== e.boardId) return;
        set({ board: addCardToBoard(board, e.listId, e.card) });
        get().announce(`Card created: ${e.card.title}`);
        break;
      case "card_updated":
        if (board.id !== e.boardId) return;
        set({ board: updateCardInBoard(board, e.card) });
        break;
      case "card_deleted":
        if (board.id !== e.boardId) return;
        set({ board: deleteCardFromBoard(board, e.cardId) });
        get().announce("Card deleted");
        break;
      case "list_created":
        if (board.id !== e.boardId) return;
        set({ board: addListToBoard(board, e.list) });
        break;
      case "lists_reordered":
        if (board.id !== e.boardId) return;
        set({ board: reorderListsInBoard(board, e.listIds) });
        break;
      case "board_replaced":
        if (board.id !== e.board.id) return;
        set({ board: e.board });
        break;
      case "activity":
        if (board.id !== e.boardId) return;
        set((s) => ({ activity: [e.activity, ...s.activity].slice(0, 100) }));
        break;
    }
  },
  optimisticMoveCard: (cardId, targetListId, targetIndex) => {
    const board = get().board;
    if (!board) return;
    set({ board: moveCardInBoard(board, cardId, targetListId, targetIndex) });
    get().announce(`Card moved to ${board.lists.find((l) => l.id === targetListId)?.title ?? "list"}`);
  },
  optimisticAddCard: (listId, card) => {
    const board = get().board;
    if (!board) return;
    set({ board: addCardToBoard(board, listId, card) });
  },
  optimisticUpdateCard: (card) => {
    const board = get().board;
    if (!board) return;
    set({ board: updateCardInBoard(board, card) });
  },
  optimisticDeleteCard: (cardId) => {
    const board = get().board;
    if (!board) return;
    set({ board: deleteCardFromBoard(board, cardId) });
  },
  optimisticAddList: (list) => {
    const board = get().board;
    if (!board) return;
    set({ board: addListToBoard(board, list) });
  },
  optimisticReorderLists: (listIds: string[]) => {
    const board = get().board;
    if (!board) return;
    set({ board: reorderListsInBoard(board, listIds) });
  },
  openCardId: null,
  setOpenCardId: (id) => set({ openCardId: id }),
  activity: [],
  setActivity: (items) => set({ activity: items }),
  pushActivity: (item) => set((s) => ({ activity: [item, ...s.activity].slice(0, 100) })),
  announce: () => {},
  setAnnouncer: (fn) => set({ announce: fn }),
}));
