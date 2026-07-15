"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MemberChip } from "@/components/ActiveMember";
import type { Member } from "@/lib/types";

export function MembersEditor({ members }: { members: Member[] }) {
  const [rows, setRows] = useState(members);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function rename(id: string, name: string) {
    setSavingId(id);
    await createClient().from("members").update({ name }).eq("id", id);
    setSavingId(null);
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <h2 className="font-semibold">Family members</h2>
      <p className="text-sm text-[var(--muted)]">
        Rename the placeholders to your family. These appear in the tap-to-pick.
      </p>
      {rows.map((m) => (
        <div key={m.id} className="flex items-center gap-3">
          <MemberChip member={m} size={32} />
          <input
            className="card flex-1 px-3 py-2 outline-none focus:border-[var(--accent)]"
            value={m.name}
            onChange={(e) =>
              setRows((r) =>
                r.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)),
              )
            }
            onBlur={(e) => rename(m.id, e.target.value.trim() || m.name)}
          />
          <span className="w-16 text-xs text-[var(--muted)]">
            {savingId === m.id ? "saving…" : m.is_child ? "kid" : "adult"}
          </span>
        </div>
      ))}
    </div>
  );
}
