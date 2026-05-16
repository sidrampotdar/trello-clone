"use server";

import { revalidatePath } from "next/cache";
import {
  addCardToBoard,
  addListToBoard,
  appendCommentToCard,
  archiveCardInBoard,
  deleteCardFromBoard,
  moveCardInBoard,
  newId,
  recordActivity,
  reorderListsInBoard,
  saveBoard,
  updateCardInBoard,
} from "./repository";
import { broadcast } from "./realtime-server";
import { AuthzError, hasRole, requireBoardAccess, requireSession } from "./authz";
import { rateLimit } from "./rate-limit";
import type {
  Activity,
  ActivityType,
  Card,
  Comment,
  CoverColor,
  CardLabel,
  List,
  Priority,
} from "./types";

const today = () =>
  new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

type ActionFail = { ok: false; error: string };
type ActionOk<T = unknown> = { ok: true } & T;

function err(e: unknown): ActionFail {
  if (e instanceof AuthzError) {
    if (e.code === "unauthorized") return { ok: false, error: "Sign in required" };
    if (e.code === "forbidden") return { ok: false, error: "Not allowed on this board" };
    if (e.code === "not_found") return { ok: false, error: "Board not found" };
  }
  return { ok: false, error: (e as Error).message ?? "error" };
}

async function logActivity(
  boardId: string,
  type: ActivityType,
  userId: string,
  userName: string,
  detail?: string,
  cardId?: string
) {
  const activity: Activity = {
    id: newId("act"),
    boardId,
    cardId,
    userId,
    userName,
    type,
    detail,
    createdAt: new Date().toISOString(),
  };
  await recordActivity(activity);
  broadcast(boardId, { type: "activity", boardId, activity });
}

function checkActionRate(userId: string): ActionFail | null {
  const r = rateLimit(`action:${userId}`, { capacity: 60, refillPerSec: 5 });
  if (!r.ok) return { ok: false, error: `Slow down. Retry in ${r.retryAfter}s` };
  return null;
}

export async function moveCardAction(input: {
  boardId: string;
  cardId: string;
  targetListId: string;
  targetIndex: number;
}): Promise<ActionOk | ActionFail> {
  try {
    const { session, board } = await requireBoardAccess(input.boardId);
    const limited = checkActionRate(session.userId);
    if (limited) return limited;
    const sourceListId = board.lists.find((l) => l.cards.some((c) => c.id === input.cardId))?.id ?? "";
    const card = board.lists.flatMap((l) => l.cards).find((c) => c.id === input.cardId);
    const targetTitle = board.lists.find((l) => l.id === input.targetListId)?.title ?? "";
    const next = moveCardInBoard(board, input.cardId, input.targetListId, input.targetIndex);
    await saveBoard(next);
    broadcast(input.boardId, {
      type: "card_moved",
      boardId: input.boardId,
      cardId: input.cardId,
      sourceListId,
      targetListId: input.targetListId,
      targetIndex: input.targetIndex,
    });
    await logActivity(input.boardId, "card_moved", session.userId, session.userName, `${card?.title ?? "card"} → ${targetTitle}`, input.cardId);
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function createCardAction(input: {
  boardId: string;
  listId: string;
  title: string;
  description?: string;
  priority?: Priority;
}): Promise<ActionOk<{ card: Card }> | ActionFail> {
  try {
    const { session, board } = await requireBoardAccess(input.boardId);
    const limited = checkActionRate(session.userId);
    if (limited) return limited;
    if (!input.title.trim()) return { ok: false, error: "Title required" };
    const card: Card = {
      id: newId("card"),
      title: input.title.trim().slice(0, 280),
      description: input.description?.slice(0, 10_000),
      priority: input.priority,
      createdAt: today(),
      createdBy: session.userId,
      assignees: [],
      labelIds: [],
    };
    const next = addCardToBoard(board, input.listId, card);
    await saveBoard(next);
    broadcast(input.boardId, { type: "card_created", boardId: input.boardId, listId: input.listId, card });
    await logActivity(input.boardId, "card_created", session.userId, session.userName, card.title, card.id);
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true, card };
  } catch (e) {
    return err(e);
  }
}

export async function updateCardAction(input: { boardId: string; card: Card }): Promise<ActionOk | ActionFail> {
  try {
    const { session, board } = await requireBoardAccess(input.boardId);
    const limited = checkActionRate(session.userId);
    if (limited) return limited;
    const sanitized: Card = {
      ...input.card,
      title: input.card.title.slice(0, 280),
      description: input.card.description?.slice(0, 10_000),
    };
    const next = updateCardInBoard(board, sanitized);
    await saveBoard(next);
    broadcast(input.boardId, { type: "card_updated", boardId: input.boardId, card: sanitized });
    await logActivity(input.boardId, "card_updated", session.userId, session.userName, sanitized.title, sanitized.id);
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function deleteCardAction(input: { boardId: string; cardId: string }): Promise<ActionOk | ActionFail> {
  try {
    const { session, board } = await requireBoardAccess(input.boardId);
    const card = board.lists.flatMap((l) => l.cards).find((c) => c.id === input.cardId);
    const next = deleteCardFromBoard(board, input.cardId);
    await saveBoard(next);
    broadcast(input.boardId, { type: "card_deleted", boardId: input.boardId, cardId: input.cardId });
    await logActivity(input.boardId, "card_deleted", session.userId, session.userName, card?.title, input.cardId);
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function archiveCardAction(input: { boardId: string; cardId: string; archived: boolean }): Promise<ActionOk | ActionFail> {
  try {
    const { session, board } = await requireBoardAccess(input.boardId);
    const card = board.lists.flatMap((l) => l.cards).find((c) => c.id === input.cardId);
    const next = archiveCardInBoard(board, input.cardId, input.archived);
    await saveBoard(next);
    if (input.archived) {
      broadcast(input.boardId, { type: "card_deleted", boardId: input.boardId, cardId: input.cardId });
    }
    await logActivity(
      input.boardId,
      "card_archived",
      session.userId,
      session.userName,
      `${card?.title ?? "card"} ${input.archived ? "archived" : "restored"}`,
      input.cardId
    );
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function setDueDateAction(input: { boardId: string; cardId: string; dueDate?: string }): Promise<ActionOk | ActionFail> {
  try {
    const { session, board } = await requireBoardAccess(input.boardId);
    const card = board.lists.flatMap((l) => l.cards).find((c) => c.id === input.cardId);
    if (!card) return { ok: false, error: "card not found" };
    const updated: Card = { ...card, dueDate: input.dueDate || undefined };
    const next = updateCardInBoard(board, updated);
    await saveBoard(next);
    broadcast(input.boardId, { type: "card_updated", boardId: input.boardId, card: updated });
    await logActivity(input.boardId, "due_date_set", session.userId, session.userName, input.dueDate ?? "cleared", input.cardId);
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function setAssigneesAction(input: { boardId: string; cardId: string; assignees: string[] }): Promise<ActionOk | ActionFail> {
  try {
    const { session, board } = await requireBoardAccess(input.boardId);
    const memberIds = new Set([...(board.members ?? []).map((m) => m.userId), board.ownerId].filter(Boolean) as string[]);
    const filtered = input.assignees.filter((id) => memberIds.has(id));
    const card = board.lists.flatMap((l) => l.cards).find((c) => c.id === input.cardId);
    if (!card) return { ok: false, error: "card not found" };
    const updated: Card = { ...card, assignees: filtered };
    const next = updateCardInBoard(board, updated);
    await saveBoard(next);
    broadcast(input.boardId, { type: "card_updated", boardId: input.boardId, card: updated });
    await logActivity(input.boardId, "assignee_added", session.userId, session.userName, `assignees: ${filtered.length}`, input.cardId);
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function setCoverAction(input: { boardId: string; cardId: string; cover?: CoverColor }): Promise<ActionOk | ActionFail> {
  try {
    const { board } = await requireBoardAccess(input.boardId);
    const card = board.lists.flatMap((l) => l.cards).find((c) => c.id === input.cardId);
    if (!card) return { ok: false, error: "card not found" };
    const updated: Card = { ...card, cover: input.cover };
    const next = updateCardInBoard(board, updated);
    await saveBoard(next);
    broadcast(input.boardId, { type: "card_updated", boardId: input.boardId, card: updated });
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function addCommentAction(input: { boardId: string; cardId: string; text: string }): Promise<ActionOk<{ comment: Comment }> | ActionFail> {
  try {
    const { session, board } = await requireBoardAccess(input.boardId);
    const limited = checkActionRate(session.userId);
    if (limited) return limited;
    const text = input.text.trim();
    if (!text) return { ok: false, error: "Empty comment" };
    if (text.length > 5_000) return { ok: false, error: "Comment too long" };
    const comment: Comment = {
      id: newId("c"),
      userId: session.userId,
      userName: session.userName,
      text,
      createdAt: new Date().toISOString(),
    };
    const next = appendCommentToCard(board, input.cardId, comment);
    await saveBoard(next);
    const updated = next.lists.flatMap((l) => l.cards).find((c) => c.id === input.cardId);
    if (updated) broadcast(input.boardId, { type: "card_updated", boardId: input.boardId, card: updated });
    await logActivity(input.boardId, "comment_added", session.userId, session.userName, text.slice(0, 80), input.cardId);
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true, comment };
  } catch (e) {
    return err(e);
  }
}

export async function reorderListsAction(input: { boardId: string; listIds: string[] }): Promise<ActionOk | ActionFail> {
  try {
    const { session, board } = await requireBoardAccess(input.boardId);
    const next = reorderListsInBoard(board, input.listIds);
    await saveBoard(next);
    broadcast(input.boardId, { type: "lists_reordered", boardId: input.boardId, listIds: input.listIds });
    await logActivity(input.boardId, "list_created", session.userId, session.userName, `reordered ${input.listIds.length} lists`);
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}

export async function createListAction(input: { boardId: string; title: string }): Promise<ActionOk<{ list: List }> | ActionFail> {
  try {
    const { session, board } = await requireBoardAccess(input.boardId);
    if (!input.title.trim()) return { ok: false, error: "Title required" };
    const list: List = { id: newId("list"), title: input.title.trim().slice(0, 120), cards: [] };
    const next = addListToBoard(board, list);
    await saveBoard(next);
    broadcast(input.boardId, { type: "list_created", boardId: input.boardId, list });
    await logActivity(input.boardId, "list_created", session.userId, session.userName, list.title);
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true, list };
  } catch (e) {
    return err(e);
  }
}

export async function createBoardAction(input: { title: string }): Promise<ActionOk<{ board: { id: string } }> | ActionFail> {
  try {
    const session = await requireSession();
    const limited = checkActionRate(session.userId);
    if (limited) return limited;
    if (!input.title.trim()) return { ok: false, error: "Title required" };
    const id = newId("board");
    const board = {
      id,
      title: input.title.trim().slice(0, 120),
      ownerId: session.userId,
      members: [{ userId: session.userId, role: "owner" as const }],
      labels: [] as CardLabel[],
      visibility: "private" as const,
      lists: [
        { id: newId("list"), title: "To do", cards: [] },
        { id: newId("list"), title: "In progress", cards: [] },
        { id: newId("list"), title: "Done", cards: [] },
      ],
    };
    await saveBoard(board);
    revalidatePath("/boards");
    revalidatePath("/");
    return { ok: true, board: { id } };
  } catch (e) {
    return err(e);
  }
}

export async function addBoardMemberAction(input: { boardId: string; email: string }): Promise<ActionOk<{ user: { id: string; name: string; email: string } }> | ActionFail> {
  try {
    const { session, board } = await requireBoardAccess(input.boardId, "admin");
    if (!hasRole(board, session.userId, "admin")) return { ok: false, error: "Admin role required" };
    const { getUserByEmail } = await import("./user-store");
    const user = await getUserByEmail(input.email);
    if (!user) return { ok: false, error: "user not found" };
    if ((board.members ?? []).some((m) => m.userId === user.id)) {
      return { ok: false, error: "already a member" };
    }
    const next = {
      ...board,
      members: [...(board.members ?? []), { userId: user.id, role: "member" as const }],
    };
    await saveBoard(next);
    await logActivity(input.boardId, "member_added", session.userId, session.userName, `${user.name} (${user.email})`);
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true, user: { id: user.id, name: user.name, email: user.email } };
  } catch (e) {
    return err(e);
  }
}

export async function upsertLabelAction(input: { boardId: string; label: CardLabel }): Promise<ActionOk | ActionFail> {
  try {
    const { board } = await requireBoardAccess(input.boardId, "admin");
    const labels = board.labels ?? [];
    const i = labels.findIndex((l) => l.id === input.label.id);
    const nextLabels = i >= 0 ? labels.map((l) => (l.id === input.label.id ? input.label : l)) : [...labels, input.label];
    await saveBoard({ ...board, labels: nextLabels });
    revalidatePath(`/board/${input.boardId}`);
    return { ok: true };
  } catch (e) {
    return err(e);
  }
}
