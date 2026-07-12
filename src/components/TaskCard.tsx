"use client";

import { useState } from "react";
import { MemberChip, useActiveMember } from "@/components/ActiveMember";
import { relativeDayLabel } from "@/lib/date";
import type {
  Category,
  Member,
  OccurrenceWithDefinition,
} from "@/lib/types";

function recurrenceLabel(occ: OccurrenceWithDefinition): string | null {
  const d = occ.definition;
  if (d.recurrence_type === "on_completion" && d.interval_count && d.interval_unit) {
    const unit =
      d.interval_count === 1 ? d.interval_unit : `${d.interval_unit}s`;
    return `every ${d.interval_count} ${unit}`;
  }
  if (d.recurrence_type === "fixed") return "scheduled";
  return null;
}

export function TaskCard({
  occ,
  today,
  members,
  category,
  onComplete,
  onSkip,
}: {
  occ: OccurrenceWithDefinition;
  today: string;
  members: Member[];
  category: Category | undefined;
  onComplete: (occ: OccurrenceWithDefinition, memberId: string) => void;
  onSkip: (occ: OccurrenceWithDefinition, memberId: string) => void;
}) {
  const { activeId, active } = useActiveMember();
  const [busy, setBusy] = useState(false);

  const owner =
    occ.definition.scope === "personal"
      ? members.find((m) => m.id === occ.definition.owner_member_id)
      : undefined;
  const assignee = occ.assignee_id
    ? members.find((m) => m.id === occ.assignee_id)
    : undefined;
  const overdue = occ.due_date < today;
  const isEvent = occ.definition.kind === "event";
  const recur = recurrenceLabel(occ);

  async function handle(action: "complete" | "skip") {
    if (!activeId || busy) return;
    setBusy(true);
    try {
      if (action === "complete") onComplete(occ, activeId);
      else onSkip(occ, activeId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex items-center gap-3 p-3">
      {occ.definition.completable ? (
        <button
          aria-label="Complete"
          onClick={() => handle("complete")}
          disabled={busy || !active}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition active:scale-95 disabled:opacity-40"
          style={{ borderColor: category?.color ?? "var(--accent)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12l5 5L20 7"
              stroke={category?.color ?? "var(--accent)"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : (
        <span
          className="h-11 w-2 shrink-0 rounded-full"
          style={{ background: category?.color ?? "var(--accent)" }}
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-medium">
            {occ.definition.title}
          </span>
          {isEvent && (
            <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
              event
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--muted)]">
          <span style={{ color: overdue ? "var(--overdue)" : undefined }}>
            {relativeDayLabel(occ.due_date, today)}
          </span>
          {category && <span>{category.name}</span>}
          {recur && <span>· {recur}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {owner && <MemberChip member={owner} size={28} />}
        {assignee && !owner && <MemberChip member={assignee} size={28} />}
        {occ.definition.completable && (
          <button
            onClick={() => handle("skip")}
            disabled={busy || !active}
            className="text-xs text-[var(--muted)] underline-offset-2 hover:underline disabled:opacity-40"
          >
            skip
          </button>
        )}
      </div>
    </div>
  );
}
