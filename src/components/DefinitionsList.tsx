"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TaskDefinition } from "@/lib/types";

function summary(d: TaskDefinition): string {
  if (d.recurrence_type === "on_completion" && d.interval_count && d.interval_unit) {
    const unit = d.interval_count === 1 ? d.interval_unit : `${d.interval_unit}s`;
    return `every ${d.interval_count} ${unit} after completion`;
  }
  if (d.recurrence_type === "fixed") {
    const days = (d.fixed_rule?.weekdays ?? [])
      .map((i) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i])
      .join(", ");
    return days ? `every ${days}` : "scheduled";
  }
  return "one-off";
}

export function DefinitionsList({ householdId }: { householdId: string }) {
  const [defs, setDefs] = useState<TaskDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function load() {
    const { data } = await supabase
      .from("task_definitions")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });
    setDefs((data ?? []) as TaskDefinition[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  async function togglePaused(d: TaskDefinition) {
    await supabase
      .from("task_definitions")
      .update({ is_active: !d.is_active })
      .eq("id", d.id);
    load();
  }

  async function remove(d: TaskDefinition) {
    if (!confirm(`Delete "${d.title}" and its occurrences?`)) return;
    await supabase.from("task_definitions").delete().eq("id", d.id);
    load();
  }

  if (loading) return <p className="text-[var(--muted)]">Loading…</p>;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-semibold">All tasks &amp; events</h2>
      {defs.length === 0 && (
        <p className="text-sm text-[var(--muted)]">Nothing yet.</p>
      )}
      {defs.map((d) => (
        <div key={d.id} className="card flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{d.title}</span>
              {!d.is_active && (
                <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
                  paused
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {d.kind} · {d.scope} · {summary(d)}
            </div>
          </div>
          <button
            onClick={() => togglePaused(d)}
            className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
          >
            {d.is_active ? "pause" : "resume"}
          </button>
          <button
            onClick={() => remove(d)}
            className="text-xs text-[var(--overdue)] hover:underline"
          >
            delete
          </button>
        </div>
      ))}
    </div>
  );
}
