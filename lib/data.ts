import { Board } from "./types";

export const boards: Board[] = [
  {
    id: "1",
    title: "Product Roadmap",
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
            assignee: "AN",
            priority: "High",
            labels: ["Research", "UX"],
          },
          {
            id: "task-2",
            title: "Write API error copy",
            description: "Tighten empty, loading, and failed request states.",
            createdAt: "May 2",
            assignee: "MR",
            priority: "Medium",
            labels: ["Content"],
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
            assignee: "LK",
            priority: "High",
            labels: ["Frontend", "DND"],
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
            assignee: "PS",
            priority: "Medium",
            labels: ["QA"],
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
            assignee: "TV",
            priority: "Low",
            labels: ["Data"],
          },
        ],
      },
    ],
  },
];
