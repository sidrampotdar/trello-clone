import "server-only";
import { hasMongo, connectMongo } from "./db";
import { addMemActivity, memActivities, memBoards, setMemBoard } from "./memory-store";
import type { Activity, Board, BoardMember, Card, CardLabel } from "./types";

export {
  newId,
  addCardToBoard,
  addListToBoard,
  appendCommentToCard,
  archiveCardInBoard,
  deleteCardFromBoard,
  moveCardInBoard,
  reorderListsInBoard,
  updateCardInBoard,
} from "./board-utils";

interface BoardDoc {
  id: string;
  title: string;
  ownerId?: string;
  members?: BoardMember[];
  labels?: CardLabel[];
  visibility?: "private" | "workspace" | "public";
}

async function loadBoardFromMongo(boardId: string): Promise<Board | null> {
  await connectMongo();
  const { BoardModel, ListModel, CardModel } = await import("./models");
  const b = await BoardModel.findOne({ id: boardId }).lean<BoardDoc>();
  if (!b) return null;
  const lists = await ListModel.find({ boardId }).sort({ order: 1 }).lean<{ id: string; title: string; order: number; archived?: boolean }[]>();
  const cards = await CardModel.find({ boardId }).sort({ order: 1 }).lean<(Card & { listId: string; order: number })[]>();
  return {
    id: b.id,
    title: b.title,
    ownerId: b.ownerId,
    members: b.members ?? [],
    labels: b.labels ?? [],
    visibility: b.visibility ?? "private",
    lists: lists
      .filter((l) => !l.archived)
      .map((l) => ({
        id: l.id,
        title: l.title,
        archived: l.archived,
        cards: cards
          .filter((c) => c.listId === l.id && !c.archived)
          .map((c) => {
            const { listId, order, ...rest } = c;
            void listId;
            void order;
            return rest as Card;
          }),
      })),
  };
}

async function saveBoardToMongo(board: Board) {
  await connectMongo();
  const { BoardModel, ListModel, CardModel } = await import("./models");
  await BoardModel.updateOne(
    { id: board.id },
    {
      $set: {
        id: board.id,
        title: board.title,
        ownerId: board.ownerId,
        members: board.members ?? [],
        labels: board.labels ?? [],
        visibility: board.visibility ?? "private",
      },
    },
    { upsert: true }
  );
  await ListModel.deleteMany({ boardId: board.id });
  await CardModel.deleteMany({ boardId: board.id });
  for (const [li, list] of board.lists.entries()) {
    await ListModel.create({
      id: list.id,
      title: list.title,
      archived: list.archived ?? false,
      boardId: board.id,
      order: li,
    });
    for (const [ci, card] of list.cards.entries()) {
      await CardModel.create({ ...card, listId: list.id, boardId: board.id, order: ci });
    }
  }
}

export async function getBoard(boardId: string): Promise<Board | null> {
  if (hasMongo) {
    try {
      const fromMongo = await loadBoardFromMongo(boardId);
      if (fromMongo) return fromMongo;
    } catch (e) {
      console.warn("[repo] mongo read failed, falling back to memory:", (e as Error).message);
    }
  }
  return memBoards().find((b) => b.id === boardId) ?? null;
}

export async function listBoards(): Promise<Board[]> {
  if (hasMongo) {
    try {
      await connectMongo();
      const { BoardModel } = await import("./models");
      const docs = await BoardModel.find({}).lean<{ id: string }[]>();
      const out: Board[] = [];
      for (const d of docs) {
        const b = await loadBoardFromMongo(d.id);
        if (b) out.push(b);
      }
      if (out.length) return out;
    } catch (e) {
      console.warn("[repo] mongo list failed, falling back:", (e as Error).message);
    }
  }
  return memBoards();
}

export async function listBoardsForUser(userId: string): Promise<Board[]> {
  const all = await listBoards();
  return all.filter(
    (b) =>
      !b.ownerId ||
      b.ownerId === userId ||
      (b.members ?? []).some((m) => m.userId === userId) ||
      b.visibility === "workspace" ||
      b.visibility === "public"
  );
}

export async function saveBoard(board: Board): Promise<void> {
  setMemBoard(board);
  if (hasMongo) {
    try {
      await saveBoardToMongo(board);
    } catch (e) {
      console.warn("[repo] mongo save failed:", (e as Error).message);
    }
  }
}

export async function recordActivity(activity: Activity): Promise<void> {
  addMemActivity(activity);
  if (hasMongo) {
    try {
      await connectMongo();
      const { ActivityModel } = await import("./models");
      await ActivityModel.create(activity);
    } catch (e) {
      console.warn("[repo] activity save failed:", (e as Error).message);
    }
  }
}

export async function listActivity(boardId: string, limit = 50): Promise<Activity[]> {
  if (hasMongo) {
    try {
      await connectMongo();
      const { ActivityModel } = await import("./models");
      const docs = await ActivityModel.find({ boardId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<Activity[]>();
      if (docs.length) return docs;
    } catch (e) {
      console.warn("[repo] activity list failed:", (e as Error).message);
    }
  }
  return memActivities()
    .filter((a) => a.boardId === boardId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
