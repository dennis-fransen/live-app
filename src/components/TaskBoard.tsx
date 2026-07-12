"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchOpenOccurrences } from "@/lib/board";
import { TaskCard } from "@/components/TaskCard";
import { todayInTimezone, addDays } from "@/lib/date";
import type {
  Category,
  Member,
  OccurrenceWithDefinition,
} from "@/lib/types";

type View = "today" | "upcoming" | "all";

export function TaskBoard({
  householdId,
  timezone,
  members,
  categories,
  view,
}: {
  householdId: string;
  timezone: string;
  members: Member[];
  categories: Category[];
  view: View;
}) {
  const [occurrences, setOccurrences] = useState<OccurrenceWithDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const today = todayInTimezone(timezone);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const reload = useCallback(async () => {
    const rows = await fetchOpenOccurrences(supabaseRef.current, householdId);
    setOccurrences(rows);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    reload();
    // Realtime: any change to this household's occurrences refreshes the board,
    // so the mounted tablet reflects a completion made on a phone within ~1s.
    const channel = supabaseRef.current
      .channel(`occurrences:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_occurrences",
          filter: `household_id=eq.${householdId}`,
        },
        () => reload(),
      )
      .subscribe();
    return () => {
      supabaseRef.current.removeChannel(channel);
    };
  }, [householdId, reload]);

  const complete = useCallback(
    async (occ: OccurrenceWithDefinition, memberId: string) => {
      setOccurrences((prev) => prev.filter((o) => o.id !== occ.id)); // optimistic
      const { error } = await supabaseRef.current.rpc("complete_occurrence", {
        p_occurrence: occ.id,
        p_member: memberId,
      });
      if (error) reload(); // roll back to server truth on failure
      else reload(); // pick up any respawned occurrence
    },
    [reload],
  );

  const skip = useCallback(
    async (occ: OccurrenceWithDefinition, memberId: string) => {
      setOccurrences((prev) => prev.filter((o) => o.id !== occ.id));
      const { error } = await supabaseRef.current.rpc("skip_occurrence", {
        p_occurrence: occ.id,
        p_member: memberId,
      });
      reload();
      if (error) console.error(error);
    },
    [reload],
  );

  const groups = useMemo(
    () => groupForView(occurrences, view, today),
    [occurrences, view, today],
  );

  if (loading) {
    return <p className="py-12 text-center text-[var(--muted)]">Loading…</p>;
  }

  const isEmpty = groups.every((g) => g.items.length === 0);
  if (isEmpty) {
    return (
      <p className="py-12 text-center text-[var(--muted)]">
        Nothing here — you&apos;re all caught up. 🎉
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.key} className="flex flex-col gap-2">
              <h2
                className="px-1 text-sm font-semibold uppercase tracking-wide"
                style={{ color: g.tone === "overdue" ? "var(--overdue)" : "var(--muted)" }}
              >
                {g.label}
                <span className="ml-2 font-normal opacity-60">
                  {g.items.length}
                </span>
              </h2>
              {g.items.map((occ) => (
                <TaskCard
                  key={occ.id}
                  occ={occ}
                  today={today}
                  members={members}
                  category={
                    occ.definition.category_id
                      ? categoryById.get(occ.definition.category_id)
                      : undefined
                  }
                  onComplete={complete}
                  onSkip={skip}
                />
              ))}
            </section>
          ),
      )}
    </div>
  );
}

interface Group {
  key: string;
  label: string;
  tone?: "overdue";
  items: OccurrenceWithDefinition[];
}

function groupForView(
  occ: OccurrenceWithDefinition[],
  view: View,
  today: string,
): Group[] {
  const overdue = occ.filter((o) => o.due_date < today);
  const todayItems = occ.filter((o) => o.due_date === today);

  if (view === "today") {
    return [
      { key: "overdue", label: "Overdue", tone: "overdue", items: overdue },
      { key: "today", label: "Today", items: todayItems },
    ];
  }

  if (view === "upcoming") {
    const horizon = addDays(today, 7);
    const upcoming = occ.filter(
      (o) => o.due_date > today && o.due_date <= horizon,
    );
    const byDay = new Map<string, OccurrenceWithDefinition[]>();
    for (const o of upcoming) {
      const list = byDay.get(o.due_date) ?? [];
      list.push(o);
      byDay.set(o.due_date, list);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ key: date, label: labelDay(date, today), items }));
  }

  // all
  return [
    { key: "overdue", label: "Overdue", tone: "overdue", items: overdue },
    { key: "today", label: "Today", items: todayItems },
    {
      key: "later",
      label: "Upcoming",
      items: occ.filter((o) => o.due_date > today),
    },
  ];
}

function labelDay(date: string, today: string): string {
  if (date === addDays(today, 1)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
}
