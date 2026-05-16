import { Schema, models, model } from "mongoose";

const SubtaskSchema = new Schema(
  { id: String, text: String, done: Boolean },
  { _id: false }
);

const CommentSchema = new Schema(
  {
    id: String,
    userId: String,
    userName: String,
    text: String,
    createdAt: String,
  },
  { _id: false }
);

const CardSchema = new Schema(
  {
    id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: String,
    createdAt: String,
    createdBy: String,
    assignees: [String],
    priority: { type: String, enum: ["Low", "Medium", "High"] },
    labelIds: [String],
    cover: { type: String, enum: ["none", "emerald", "sky", "violet", "amber", "rose", "slate"] },
    dueDate: String,
    archived: { type: Boolean, default: false },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"] },
    estimate: String,
    subtasks: [SubtaskSchema],
    comments: [CommentSchema],
    listId: { type: String, required: true, index: true },
    boardId: { type: String, required: true, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CardSchema.index({ boardId: 1, listId: 1, order: 1 });

const ListSchema = new Schema(
  {
    id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    archived: { type: Boolean, default: false },
    boardId: { type: String, required: true, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const LabelSchema = new Schema(
  {
    id: String,
    name: String,
    color: { type: String, enum: ["none", "emerald", "sky", "violet", "amber", "rose", "slate"] },
  },
  { _id: false }
);

const BoardMemberSchema = new Schema(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
  },
  { _id: false }
);

const BoardSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    workspaceId: { type: String, index: true },
    ownerId: { type: String, index: true },
    members: [BoardMemberSchema],
    labels: [LabelSchema],
    visibility: { type: String, enum: ["private", "workspace", "public"], default: "private" },
  },
  { timestamps: true }
);

const WorkspaceSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    boardIds: [String],
  },
  { timestamps: true }
);

const UserSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    image: String,
    passwordHash: String,
  },
  { timestamps: true }
);

const ActivitySchema = new Schema(
  {
    id: { type: String, required: true, index: true },
    boardId: { type: String, required: true, index: true },
    cardId: String,
    userId: String,
    userName: String,
    type: { type: String, required: true },
    detail: String,
    createdAt: String,
  },
  { timestamps: true }
);

ActivitySchema.index({ boardId: 1, createdAt: -1 });

export const CardModel = models.Card || model("Card", CardSchema);
export const ListModel = models.List || model("List", ListSchema);
export const BoardModel = models.Board || model("Board", BoardSchema);
export const WorkspaceModel = models.Workspace || model("Workspace", WorkspaceSchema);
export const UserModel = models.User || model("User", UserSchema);
export const ActivityModel = models.Activity || model("Activity", ActivitySchema);
