"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Life App</h1>
      <p className="mt-1 text-[var(--muted)]">
        Our family&apos;s shared tasks and events.
      </p>

      {sent ? (
        <div className="card mt-8 p-5">
          <p className="font-medium">Check your email</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            We sent a magic sign-in link to <strong>{email}</strong>. Open it on
            this device to continue.
          </p>
        </div>
      ) : (
        <form onSubmit={sendLink} className="mt-8 flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="card px-4 py-3 outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send magic link"}
          </button>
          {error && <p className="text-sm text-[var(--overdue)]">{error}</p>}
        </form>
      )}
    </div>
  );
}
