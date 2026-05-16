import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { seedBoards, seedWorkspaces } from "./data";
import type { Activity, Board, User, Workspace } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "memory.json");

interface DiskState {
  boards: Board[];
  workspaces: Workspace[];
  users: (User & { passwordHash?: string })[];
  activities: Activity[];
}

declare global {
  var _memState: DiskState | undefined;
}

function loadFromDisk(): DiskState {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<DiskState>;
      return {
        boards: parsed.boards ?? structuredClone(seedBoards),
        workspaces: parsed.workspaces ?? structuredClone(seedWorkspaces),
        users: parsed.users ?? [],
        activities: parsed.activities ?? [],
      };
    }
  } catch (e) {
    console.warn("[mem] load failed:", (e as Error).message);
  }
  return {
    boards: structuredClone(seedBoards),
    workspaces: structuredClone(seedWorkspaces),
    users: [],
    activities: [],
  };
}

function persist() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(global._memState, null, 2));
  } catch (e) {
    console.warn("[mem] persist failed:", (e as Error).message);
  }
}

if (!global._memState) global._memState = loadFromDisk();

export const memBoards = (): Board[] => global._memState!.boards;
export const memWorkspaces = (): Workspace[] => global._memState!.workspaces;
export const memUsers = (): (User & { passwordHash?: string })[] => global._memState!.users;
export const memActivities = (): Activity[] => global._memState!.activities;

export function setMemBoard(next: Board) {
  const arr = memBoards();
  const i = arr.findIndex((b) => b.id === next.id);
  if (i >= 0) arr[i] = next;
  else arr.push(next);
  persist();
}

export function addMemActivity(activity: Activity) {
  memActivities().push(activity);
  persist();
}

export function addMemUser(user: User & { passwordHash?: string }) {
  memUsers().push(user);
  persist();
}

export function findMemUserByEmail(email: string) {
  return memUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findMemUserById(id: string) {
  return memUsers().find((u) => u.id === id);
}
