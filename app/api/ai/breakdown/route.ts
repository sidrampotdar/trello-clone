import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

interface Result {
  estimate: string;
  difficulty: "Easy" | "Medium" | "Hard";
  subtasks: { id: string; text: string; done: boolean }[];
}

function fallback(description: string): Result {
  const seed = description.toLowerCase();
  const tag = (s: string, kw: string[]) => kw.some((k) => s.includes(k));
  const difficulty: Result["difficulty"] = tag(seed, ["migrate", "refactor", "websocket", "auth", "performance"])
    ? "Hard"
    : tag(seed, ["bug", "fix", "validate", "test"])
    ? "Medium"
    : "Easy";
  const estimate = difficulty === "Hard" ? "1-2 days" : difficulty === "Medium" ? "4 hrs" : "1 hr";
  const subtasks = [
    "Clarify acceptance criteria",
    "Sketch implementation approach",
    "Implement core change",
    "Write tests",
    "Manual QA pass",
  ].map((text, i) => ({ id: `st-${i}`, text, done: false }));
  return { estimate, difficulty, subtasks };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = rateLimit(`ai:${session.user.id}`, { capacity: 20, refillPerSec: 0.1 });
  if (!r.ok) {
    return NextResponse.json(
      { error: `AI rate limit. Retry in ${r.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(r.retryAfter) } }
    );
  }
  const { description } = (await req.json()) as { description?: string };
  if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });
  if (description.length > 4_000) {
    return NextResponse.json({ error: "description too long" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(fallback(description));
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system:
        'You break engineering tasks into atomic subtasks. Respond ONLY with JSON: {"estimate":"<time>","difficulty":"Easy|Medium|Hard","subtasks":[{"id":"st-1","text":"...","done":false}]}.',
      messages: [{ role: "user", content: `Task: ${description}` }],
    });
    const text = msg.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    const json = text.replace(/^```json\n?|```$/g, "").trim();
    const parsed = JSON.parse(json) as Result;
    return NextResponse.json(parsed);
  } catch (e) {
    console.warn("[ai/breakdown] LLM failed, using fallback:", (e as Error).message);
    return NextResponse.json(fallback(description));
  }
}
