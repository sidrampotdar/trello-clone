import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
  var _mongooseConn: Promise<typeof mongoose> | undefined;
}

export const hasMongo = Boolean(MONGODB_URI);

export async function connectMongo() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI not set");
  if (!global._mongooseConn) {
    global._mongooseConn = mongoose.connect(MONGODB_URI, { dbName: "trello_clone" });
  }
  return global._mongooseConn;
}
