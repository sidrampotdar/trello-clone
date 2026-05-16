"use client";

import { useState } from "react";

interface Result {
  estimate: string;
  difficulty: "Easy" | "Medium" | "Hard";
  subtasks: { id: string; text: string; done: boolean }[];
}

export function AIBreakdownButton({ description }: { description: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as Result;
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (!result) run();
        }}
        className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:border-emerald-400 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        AI breakdown
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI breakdown"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-zinc-100 shadow-2xl"
          >
            <h2 className="text-sm font-semibold text-zinc-100">AI Breakdown</h2>
            {loading && (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/6" />
              </div>
            )}
            {error && <p className="mt-3 text-xs text-rose-400">Failed: {error}</p>}
            {result && (
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5">{result.difficulty}</span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5">≈ {result.estimate}</span>
                </div>
                <ul className="space-y-1.5">
                  {result.subtasks.map((s) => (
                    <li key={s.id} className="flex items-start gap-2 text-zinc-200">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                      <span>{s.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-800 ${className}`} />;
}
