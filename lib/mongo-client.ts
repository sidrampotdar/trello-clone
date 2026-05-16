import "server-only";
import { MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = process.env.MONGODB_URI;

export const mongoClientPromise: Promise<MongoClient> | null = uri
  ? (() => {
      if (!global._mongoClientPromise) {
        global._mongoClientPromise = new MongoClient(uri).connect();
      }
      return global._mongoClientPromise;
    })()
  : null;
