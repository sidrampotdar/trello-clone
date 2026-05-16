export type Priority = "Low" | "Medium" | "High";

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export interface BoardMember {
  userId: string;
  role: "owner" | "admin" | "member";
}

export type CoverColor =
  | "none"
  | "emerald"
  | "sky"
  | "violet"
  | "amber"
  | "rose"
  | "slate";

export interface CardLabel {
  id: string;
  name: string;
  color: CoverColor;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Card {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  createdBy?: string;
  assignees?: string[];
  priority?: Priority;
  labelIds?: string[];
  cover?: CoverColor;
  dueDate?: string;
  archived?: boolean;
  difficulty?: "Easy" | "Medium" | "Hard";
  estimate?: string;
  subtasks?: Subtask[];
  comments?: Comment[];
}

export interface List {
  id: string;
  title: string;
  cards: Card[];
  archived?: boolean;
}

export interface Board {
  id: string;
  title: string;
  lists: List[];
  members?: BoardMember[];
  labels?: CardLabel[];
  visibility?: "private" | "workspace" | "public";
  ownerId?: string;
}

export interface Workspace {
  id: string;
  title: string;
  boardIds: string[];
}

export type ActivityType =
  | "card_created"
  | "card_moved"
  | "card_updated"
  | "card_archived"
  | "card_deleted"
  | "list_created"
  | "comment_added"
  | "due_date_set"
  | "assignee_added"
  | "assignee_removed"
  | "member_added";

export interface Activity {
  id: string;
  boardId: string;
  cardId?: string;
  userId?: string;
  userName?: string;
  type: ActivityType;
  detail?: string;
  createdAt: string;
}

export type RealtimeEvent =
  | { type: "card_moved"; boardId: string; cardId: string; sourceListId: string; targetListId: string; targetIndex: number }
  | { type: "card_created"; boardId: string; listId: string; card: Card }
  | { type: "card_updated"; boardId: string; card: Card }
  | { type: "card_deleted"; boardId: string; cardId: string }
  | { type: "list_created"; boardId: string; list: List }
  | { type: "lists_reordered"; boardId: string; listIds: string[] }
  | { type: "board_replaced"; board: Board }
  | { type: "activity"; boardId: string; activity: Activity };
