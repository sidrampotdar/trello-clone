import type { Board, Workspace } from "./types";

export const seedWorkspaces: Workspace[] = [
  { id: "ws-1", title: "Engineering", boardIds: ["1", "2"] },
];

export const seedBoards: Board[] = [
  {
    id: "1",
    title: "Product Roadmap",
    visibility: "workspace",
    labels: [
      { id: "lbl-research", name: "Research", color: "violet" },
      { id: "lbl-ux", name: "UX", color: "sky" },
      { id: "lbl-content", name: "Content", color: "amber" },
      { id: "lbl-frontend", name: "Frontend", color: "emerald" },
      { id: "lbl-qa", name: "QA", color: "rose" },
    ],
    lists: [
      {
        id: "todo",
        title: "To do",
        cards: [
          {
            id: "task-1",
            title: "Map onboarding card states",
            description: "Define the new user journey from invite to first board.",
            createdAt: "May 3",
            assignees: [],
            priority: "High",
            labelIds: ["lbl-research", "lbl-ux"],
            cover: "violet",
          },
          {
            id: "task-2",
            title: "Write API error copy",
            description: "Tighten empty, loading, and failed request states.",
            createdAt: "May 2",
            assignees: [],
            priority: "Medium",
            labelIds: ["lbl-content"],
          },
        ],
      },
      {
        id: "progress",
        title: "In progress",
        cards: [
          {
            id: "task-3",
            title: "Build kanban interactions",
            description: "Drag cards between lists with dnd-kit and keep board state synced.",
            createdAt: "Today",
            assignees: [],
            priority: "High",
            labelIds: ["lbl-frontend"],
            cover: "emerald",
          },
        ],
      },
      {
        id: "review",
        title: "Review",
        cards: [
          {
            id: "task-4",
            title: "Audit responsive board layout",
            description: "Check horizontal scrolling, dense cards, and mobile touch targets.",
            createdAt: "Apr 30",
            assignees: [],
            priority: "Medium",
            labelIds: ["lbl-qa"],
          },
        ],
      },
      {
        id: "done",
        title: "Done",
        cards: [
          {
            id: "task-5",
            title: "Seed starter board data",
            description: "Create a useful board so the UI has realistic task density.",
            createdAt: "Apr 29",
            assignees: [],
            priority: "Low",
            labelIds: [],
          },
        ],
      },
    ],
  },
  {
    id: "2",
    title: "Bug Triage",
    visibility: "workspace",
    labels: [
      { id: "lbl-bug", name: "Bug", color: "rose" },
      { id: "lbl-investigating", name: "Investigating", color: "amber" },
    ],
    lists: [
      { id: "new", title: "New", cards: [] },
      { id: "investigating", title: "Investigating", cards: [] },
      { id: "fixed", title: "Fixed", cards: [] },
    ],
  },
];

export const boards = seedBoards;
