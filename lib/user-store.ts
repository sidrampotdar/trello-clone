import "server-only";
import bcrypt from "bcryptjs";
import { hasMongo, connectMongo } from "./db";
import { addMemUser, findMemUserByEmail, findMemUserById } from "./memory-store";
import { newId } from "./board-utils";
import type { User } from "./types";

export async function getUserByEmail(email: string) {
  if (hasMongo) {
    try {
      await connectMongo();
      const { UserModel } = await import("./models");
      const doc = await UserModel.findOne({ email: email.toLowerCase() }).lean<
        User & { passwordHash?: string }
      >();
      if (doc) return doc;
    } catch (e) {
      console.warn("[user] mongo lookup failed:", (e as Error).message);
    }
  }
  return findMemUserByEmail(email);
}

export async function getUserById(id: string) {
  if (hasMongo) {
    try {
      await connectMongo();
      const { UserModel } = await import("./models");
      const doc = await UserModel.findOne({ id }).lean<User & { passwordHash?: string }>();
      if (doc) return doc;
    } catch (e) {
      console.warn("[user] mongo lookup failed:", (e as Error).message);
    }
  }
  return findMemUserById(id);
}

export async function createUser(input: { name: string; email: string; password: string }) {
  const existing = await getUserByEmail(input.email);
  if (existing) throw new Error("Email already registered");
  const id = newId("user");
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = {
    id,
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash,
  };
  if (hasMongo) {
    try {
      await connectMongo();
      const { UserModel } = await import("./models");
      await UserModel.create(user);
    } catch (e) {
      console.warn("[user] mongo create failed, using memory:", (e as Error).message);
      addMemUser(user);
    }
  } else {
    addMemUser(user);
  }
  return user;
}

export async function verifyPassword(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}
