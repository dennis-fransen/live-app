"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchProjects, formatMoney, projectTotal } from "@/lib/projects";
import { ProjectCard } from "@/components/ProjectCard";
import type { ProjectWithParts } from "@/lib/types";

export function ProjectsBoard({ householdId }: { householdId: string }) {
  const supabaseRef = useRef(createClient());
  const [items, setItems] = useState<ProjectWithParts[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // Reads of the live list from inside pointer handlers, without re-binding them.
  const itemsRef = useRef<ProjectWithParts[]>([]);
  itemsRef.current = items;

  // After our own writes we briefly ignore realtime echoes so an in-flight
  // optimistic edit isn't clobbered by a slower round-trip.
  const suppressUntil = useRef(0);
  const suppress = useCallback((ms = 1500) => {
    suppressUntil.current = Date.now() + ms;
  }, []);

  const reload = useCallback(async () => {
    const rows = await fetchProjects(supabaseRef.current, householdId);
    setItems(rows);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    reload();
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`projects:${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects", filter: `household_id=eq.${householdId}` },
        () => Date.now() > suppressUntil.current && reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_parts", filter: `household_id=eq.${householdId}` },
        () => Date.now() > suppressUntil.current && reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, reload]);

  const active = items.filter((p) => !p.is_done);
  const archived = items.filter((p) => p.is_done);

  // ----- Drag-to-reorder (pointer-based, so it works with touch on the tablet) -----
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const dragRef = useRef<{ id: string } | null>(null);

  const registerRow = useCallback((id: string, el: HTMLElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const onGripDown = useCallback((e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { id };
    setDraggingId(id);
  }, []);

  const onGripMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const id = dragRef.current.id;
    const y = e.clientY;
    const list = itemsRef.current.filter((p) => !p.is_done);
    const fromIndex = list.findIndex((p) => p.id === id);
    if (fromIndex < 0) return;

    // Target index = how many *other* rows have their midpoint above the pointer.
    let target = 0;
    for (const p of list) {
      if (p.id === id) continue;
      const el = rowRefs.current.get(p.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y > rect.top + rect.height / 2) target++;
    }
    if (target === fromIndex) return;

    const reordered = list.filter((p) => p.id !== id);
    reordered.splice(target, 0, list[fromIndex]);
    // Splice the reordered active set back in front of the archived tail.
    setItems([...reordered, ...itemsRef.current.filter((p) => p.is_done)]);
  }, []);

  const onGripUp = useCallback(async () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDraggingId(null);

    const list = itemsRef.current.filter((p) => !p.is_done);
    const changed = list
      .map((p, i) => ({ id: p.id, sort_order: i, was: p.sort_order }))
      .filter((u) => u.sort_order !== u.was);
    if (changed.length === 0) return;

    // Reflect the new sort_order locally so a later reload doesn't reshuffle.
    setItems((prev) =>
      prev.map((p) => {
        const u = changed.find((c) => c.id === p.id);
        return u ? { ...p, sort_order: u.sort_order } : p;
      }),
    );
    suppress();
    await Promise.all(
      changed.map((u) =>
        supabaseRef.current.from("projects").update({ sort_order: u.sort_order }).eq("id", u.id),
      ),
    );
  }, [suppress]);

  const grandTotal = active.reduce((s, p) => s + projectTotal(p.base_cost, p.parts), 0);

  if (loading) {
    return <p className="py-12 text-center text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <NewProjectForm
        householdId={householdId}
        nextOrder={active.length ? Math.max(...active.map((p) => p.sort_order)) + 1 : 0}
        supabase={supabaseRef.current}
        onCreated={() => {
          suppress();
          reload();
        }}
      />

      {active.length === 0 ? (
        <p className="py-10 text-center text-[var(--muted)]">
          No projects yet — add the first thing you want to do to the house. 🛠️
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between px-1 text-sm text-[var(--muted)]">
            <span>{active.length} project{active.length === 1 ? "" : "s"} · drag ⠿ to reorder</span>
            <span>
              Total planned:{" "}
              <span className="font-semibold text-[var(--text)]">{formatMoney(grandTotal)}</span>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {active.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                supabase={supabaseRef.current}
                dragging={draggingId === p.id}
                registerRow={registerRow}
                onGripDown={onGripDown}
                onGripMove={onGripMove}
                onGripUp={onGripUp}
                onChanged={() => {
                  suppress();
                  reload();
                }}
              />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowArchived((s) => !s)}
            className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            {showArchived ? "▾" : "▸"} Done ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-2 flex flex-col gap-2">
              {archived.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  supabase={supabaseRef.current}
                  dragging={false}
                  registerRow={registerRow}
                  onGripDown={onGripDown}
                  onGripMove={onGripMove}
                  onGripUp={onGripUp}
                  onChanged={() => {
                    suppress();
                    reload();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Compact create form. Collapsed to a single button until you start adding.
function NewProjectForm({
  householdId,
  nextOrder,
  supabase,
  onCreated,
}: {
  householdId: string;
  nextOrder: number;
  supabase: ReturnType<typeof createClient>;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [room, setRoom] = useState("");
  const [baseCost, setBaseCost] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = "card px-3 py-2 outline-none focus:border-[var(--accent)]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("projects").insert({
      household_id: householdId,
      title: title.trim(),
      room: room.trim() || null,
      base_cost: baseCost ? Number(baseCost) : 0,
      description: description.trim() || null,
      sort_order: nextOrder,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setRoom("");
    setBaseCost("");
    setDescription("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white"
      >
        ＋ New project
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
      <h2 className="font-semibold">New project</h2>
      <input
        className={field}
        placeholder="e.g. Lay new floor in guestroom"
        value={title}
        required
        autoFocus
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Room / area
          <input
            className={field}
            placeholder="Guestroom"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Base cost (labor, delivery…)
          <input
            className={field}
            type="number"
            min={0}
            step="1"
            placeholder="0"
            value={baseCost}
            onChange={(e) => setBaseCost(e.target.value)}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Description (optional)
        <textarea
          className={field}
          rows={3}
          placeholder="What's the plan, why, any decisions…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-[var(--overdue)]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add project"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-2xl px-4 py-3 font-medium text-[var(--muted)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
