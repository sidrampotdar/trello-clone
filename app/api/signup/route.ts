import { NextResponse } from "next/server";
import { createUser } from "@/lib/user-store";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const key = clientKey(req, "signup");
  const r = rateLimit(key, { capacity: 5, refillPerSec: 1 / 60 });
  if (!r.ok) {
    return NextResponse.json(
      { error: `Too many signup attempts. Retry in ${r.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(r.retryAfter) } }
    );
  }
  try {
    const { name, email, password } = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };
    if (!name || !email || !password) {
      return NextResponse.json({ error: "name, email, password required" }, { status: 400 });
    }
    if (name.length > 80) {
      return NextResponse.json({ error: "name too long" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "password must be at least 8 chars" }, { status: 400 });
    }
    if (password.length > 200) {
      return NextResponse.json({ error: "password too long" }, { status: 400 });
    }
    const user = await createUser({ name: name.trim(), email: email.trim(), password });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
