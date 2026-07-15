"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  Category,
  IntervalUnit,
  ItemKind,
  ItemScope,
  Member,
  RecurrenceType,
} from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function NewTaskForm({
  householdId,
  members,
  categories,
}: {
  householdId: string;
  members: Member[];
  categories: Category[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ItemKind>("task");
  const [scope, setScope] = useState<ItemScope>("group");
  const [ownerId, setOwnerId] = useState<string>(members[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [intervalCount, setIntervalCount] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>("week");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleWeekday(d: number) {
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload: Record<string, unknown> = {
      household_id: householdId,
      title: title.trim(),
      kind,
      scope,
      owner_member_id: scope === "personal" ? ownerId : null,
      category_id: categoryId || null,
      default_assignee_id: assigneeId || null,
      recurrence_type: recurrence,
      start_date: startDate || null,
    };

    if (recurrence === "on_completion") {
      payload.interval_count = intervalCount;
      payload.interval_unit = intervalUnit;
    }
    if (recurrence === "fixed") {
      if (weekdays.length === 0) {
        setError("Pick at least one weekday for a scheduled item.");
        setBusy(false);
        return;
      }
      payload.fixed_rule = { weekdays };
    }

    const { error } = await createClient()
      .from("task_definitions")
      .insert(payload);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setWeekdays([]);
    router.refresh();
  }

  const field = "card px-3 py-2 outline-none focus:border-[var(--accent)]";

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
      <h2 className="font-semibold">Add something</h2>

      <input
        className={field}
        placeholder="e.g. Change water filter"
        value={title}
        required
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            className={field}
            value={kind}
            onChange={(e) => setKind(e.target.value as ItemKind)}
          >
            <option value="task">Task (a chore)</option>
            <option value="event">Event (a happening)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Scope
          <select
            className={field}
            value={scope}
            onChange={(e) => setScope(e.target.value as ItemScope)}
          >
            <option value="group">Group (whole household)</option>
            <option value="personal">Personal (one member)</option>
          </select>
        </label>
      </div>

      {scope === "personal" && (
        <label className="flex flex-col gap-1 text-sm">
          Whose?
          <select
            className={field}
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            className={field}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Assign to (optional)
          <select
            className={field}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Anyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Repeats
        <select
          className={field}
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
        >
          <option value="none">One-off</option>
          <option value="on_completion">
            Every N days/weeks/months after completion
          </option>
          <option value="fixed">On fixed weekdays</option>
        </select>
      </label>

      {recurrence === "on_completion" && (
        <div className="flex items-center gap-2 text-sm">
          <span>every</span>
          <input
            type="number"
            min={1}
            className={`${field} w-20`}
            value={intervalCount}
            onChange={(e) => setIntervalCount(Number(e.target.value))}
          />
          <select
            className={field}
            value={intervalUnit}
            onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}
          >
            <option value="day">day(s)</option>
            <option value="week">week(s)</option>
            <option value="month">month(s)</option>
          </select>
          <span className="text-[var(--muted)]">after it&apos;s done</span>
        </div>
      )}

      {recurrence === "fixed" && (
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((label, i) => (
            <button
              type="button"
              key={i}
              onClick={() => toggleWeekday(i)}
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={{
                borderColor: weekdays.includes(i)
                  ? "var(--accent)"
                  : "var(--border)",
                background: weekdays.includes(i)
                  ? "var(--accent)"
                  : "transparent",
                color: weekdays.includes(i) ? "#fff" : "var(--text)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Start date (optional — defaults to today)
        <input
          type="date"
          className={field}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </label>

      {error && <p className="text-sm text-[var(--overdue)]">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
