export interface Card {
  id: string;
  description?: string;
  title: string;
  createdAt: string;
  assignee?: string;
  priority?: "Low" | "Medium" | "High";
  labels?: string[];
}

export interface List {
  id: string;
  title: string;
  cards: Card[];
}

export interface Board {
  id: string;
  title: string;
  lists: List[];
}
