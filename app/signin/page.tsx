"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function SignInForm() {
  const params = useSearchParams();
  const from = params.get("from") ?? "/boards";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasGithub = process.env.NEXT_PUBLIC_HAS_GITHUB === "1";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false, redirectTo: from });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    window.location.href = from;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h1 className="text-xl font-semibold text-zinc-50">Sign in</h1>
        <p className="mt-1 text-xs text-zinc-500">Welcome back. Next-Gen Kanban.</p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400"
            />
          </label>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {hasGithub && (
          <>
            <div className="my-4 flex items-center gap-3 text-[11px] text-zinc-500">
              <div className="h-px flex-1 bg-zinc-800" />
              or
              <div className="h-px flex-1 bg-zinc-800" />
            </div>
            <button
              type="button"
              onClick={() => signIn("github", { redirectTo: from })}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 hover:border-zinc-500"
            >
              Continue with GitHub
            </button>
          </>
        )}

        <p className="mt-4 text-center text-xs text-zinc-500">
          No account?{" "}
          <Link href="/signup" className="text-emerald-400 hover:text-emerald-300">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
