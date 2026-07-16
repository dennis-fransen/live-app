"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  formatMoney,
  partLineTotal,
  partsRemaining,
  projectTotal,
} from "@/lib/projects";
import type { ProjectPart, ProjectWithParts } from "@/lib/types";

type Supabase = ReturnType<typeof createClient>;

const field = "card px-3 py-2 outline-none focus:border-[var(--accent)]";

export function ProjectCard({
  project,
  supabase,
  dragging,
  registerRow,
  onGripDown,
  onGripMove,
  onGripUp,
  onChanged,
}: {
  project: ProjectWithParts;
  supabase: Supabase;
  dragging: boolean;
  registerRow: (id: string, el: HTMLElement | null) => void;
  onGripDown: (e: React.PointerEvent, id: string) => void;
  onGripMove: (e: React.PointerEvent) => void;
  onGripUp: () => void;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  const total = projectTotal(project.base_cost, project.parts);
  const remaining = partsRemaining(project.parts);
  const boughtCount = project.parts.filter((p) => p.is_bought).length;

  async function toggleDone() {
    await supabase.from("projects").update({ is_done: !project.is_done }).eq("id", project.id);
    onChanged();
  }

  async function removeProject() {
    if (!confirm(`Delete "${project.title}" and its parts list?`)) return;
    await supabase.from("projects").delete().eq("id", project.id);
    onChanged();
  }

  return (
    <div
      ref={(el) => registerRow(project.id, el)}
      className="card p-3"
      style={{
        opacity: dragging ? 0.6 : 1,
        boxShadow: dragging ? "0 8px 24px rgba(0,0,0,0.18)" : undefined,
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        {!project.is_done && (
          <button
            aria-label="Drag to reorder"
            onPointerDown={(e) => onGripDown(e, project.id)}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={onGripUp}
            className="cursor-grab select-none px-1 text-lg text-[var(--muted)] active:cursor-grabbing"
            style={{ touchAction: "none" }}
          >
            ⠿
          </button>
        )}

        <button
          onClick={() => setExpanded((s) => !s)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="truncate font-medium"
                style={{ textDecoration: project.is_done ? "line-through" : undefined }}
              >
                {project.title}
              </span>
              {project.room && (
                <span className="shrink-0 rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
                  {project.room}
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {project.parts.length > 0
                ? `${boughtCount}/${project.parts.length} bought` +
                  (remaining > 0 ? ` · ${formatMoney(remaining)} still to buy` : " · all bought")
                : "no parts yet"}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-semibold">{formatMoney(total)}</div>
            <div className="text-xs text-[var(--muted)]">{expanded ? "▾" : "▸"}</div>
          </div>
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-[var(--border)] pt-3">
          {editing ? (
            <DetailsForm
              project={project}
              supabase={supabase}
              onDone={() => {
                setEditing(false);
                onChanged();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {project.description ? (
                <p className="whitespace-pre-wrap text-sm text-[var(--text)]">
                  {project.description}
                </p>
              ) : (
                <p className="text-sm italic text-[var(--muted)]">No description.</p>
              )}
              <button
                onClick={() => setEditing(true)}
                className="self-start text-xs text-[var(--accent)] hover:underline"
              >
                Edit details
              </button>
            </div>
          )}

          {/* Parts / shopping list */}
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Parts &amp; shopping list</div>
            {project.parts.map((part) => (
              <PartRow key={part.id} part={part} supabase={supabase} onChanged={onChanged} />
            ))}
            <AddPartRow
              project={project}
              supabase={supabase}
              nextOrder={
                project.parts.length
                  ? Math.max(...project.parts.map((p) => p.sort_order)) + 1
                  : 0
              }
              onChanged={onChanged}
            />
          </div>

          {/* Totals */}
          <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--bg)] p-3 text-sm">
            <Row label="Base cost" value={formatMoney(project.base_cost)} />
            <Row
              label={`Parts (${project.parts.length})`}
              value={formatMoney(total - project.base_cost)}
            />
            <div className="my-1 border-t border-[var(--border)]" />
            <Row label="Total" value={formatMoney(total)} strong />
            {remaining > 0 && (
              <Row label="Still to buy" value={formatMoney(remaining)} muted />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={toggleDone}
              className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
            >
              {project.is_done ? "↩ Reopen" : "✓ Mark done"}
            </button>
            <button
              onClick={removeProject}
              className="text-sm text-[var(--overdue)] hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-[var(--muted)]" : undefined}>{label}</span>
      <span
        className={strong ? "font-semibold" : undefined}
        style={{ color: muted ? "var(--muted)" : undefined }}
      >
        {value}
      </span>
    </div>
  );
}

function DetailsForm({
  project,
  supabase,
  onDone,
  onCancel,
}: {
  project: ProjectWithParts;
  supabase: Supabase;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [room, setRoom] = useState(project.room ?? "");
  const [baseCost, setBaseCost] = useState(String(project.base_cost ?? 0));
  const [description, setDescription] = useState(project.description ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    await supabase
      .from("projects")
      .update({
        title: title.trim(),
        room: room.trim() || null,
        base_cost: baseCost ? Number(baseCost) : 0,
        description: description.trim() || null,
      })
      .eq("id", project.id);
    setBusy(false);
    onDone();
  }

  return (
    <div className="flex flex-col gap-2">
      <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          Room / area
          <input className={field} value={room} onChange={(e) => setRoom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          Base cost
          <input
            className={field}
            type="number"
            min={0}
            step="1"
            value={baseCost}
            onChange={(e) => setBaseCost(e.target.value)}
          />
        </label>
      </div>
      <textarea
        className={field}
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} className="rounded-xl px-3 py-2 text-sm text-[var(--muted)]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function PartRow({
  part,
  supabase,
  onChanged,
}: {
  part: ProjectPart;
  supabase: Supabase;
  onChanged: () => void;
}) {
  async function patch(patch: Partial<ProjectPart>) {
    await supabase.from("project_parts").update(patch).eq("id", part.id);
    onChanged();
  }
  async function remove() {
    await supabase.from("project_parts").delete().eq("id", part.id);
    onChanged();
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-2 text-sm">
      <input
        type="checkbox"
        checked={part.is_bought}
        onChange={(e) => patch({ is_bought: e.target.checked })}
        className="h-5 w-5 shrink-0 accent-[var(--accent)]"
        aria-label="Bought"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="truncate"
            style={{ textDecoration: part.is_bought ? "line-through" : undefined }}
          >
            {part.title}
          </span>
          {part.url && (
            <a
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[var(--accent)]"
              aria-label="Open link"
            >
              ↗
            </a>
          )}
        </div>
        {part.store && <div className="text-xs text-[var(--muted)]">{part.store}</div>}
      </div>

      <input
        key={`qty:${part.id}:${part.quantity}`}
        type="number"
        min={1}
        step="1"
        defaultValue={part.quantity}
        onBlur={(e) => {
          const q = Math.max(1, Math.floor(Number(e.target.value) || 1));
          if (q !== part.quantity) patch({ quantity: q });
        }}
        className="w-12 rounded-lg border border-[var(--border)] bg-transparent px-1 py-1 text-center outline-none focus:border-[var(--accent)]"
        aria-label="Quantity"
      />
      <span className="text-[var(--muted)]">×</span>
      <input
        key={`price:${part.id}:${part.unit_price}`}
        type="number"
        min={0}
        step="1"
        defaultValue={part.unit_price}
        onBlur={(e) => {
          const p = Math.max(0, Number(e.target.value) || 0);
          if (p !== part.unit_price) patch({ unit_price: p });
        }}
        className="w-20 rounded-lg border border-[var(--border)] bg-transparent px-1 py-1 text-right outline-none focus:border-[var(--accent)]"
        aria-label="Unit price"
      />
      <span className="w-20 shrink-0 text-right font-medium">
        {formatMoney(partLineTotal(part))}
      </span>
      <button
        onClick={remove}
        className="shrink-0 px-1 text-[var(--overdue)] hover:opacity-70"
        aria-label="Remove part"
      >
        ✕
      </button>
    </div>
  );
}

function AddPartRow({
  project,
  supabase,
  nextOrder,
  onChanged,
}: {
  project: ProjectWithParts;
  supabase: Supabase;
  nextOrder: number;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [store, setStore] = useState("");
  const [url, setUrl] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await supabase.from("project_parts").insert({
      household_id: project.household_id,
      project_id: project.id,
      title: title.trim(),
      store: store.trim() || null,
      url: url.trim() || null,
      quantity: Math.max(1, Math.floor(Number(qty) || 1)),
      unit_price: price ? Number(price) : 0,
      sort_order: nextOrder,
    });
    setBusy(false);
    setTitle("");
    setStore("");
    setUrl("");
    setQty("1");
    setPrice("");
    onChanged();
  }

  const mini = "rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]";

  return (
    <form onSubmit={add} className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--border)] p-2">
      <div className="flex flex-wrap gap-2">
        <input
          className={`${mini} min-w-[8rem] flex-1`}
          placeholder="Part / item"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className={`${mini} min-w-[6rem] flex-1`}
          placeholder="Store"
          value={store}
          onChange={(e) => setStore(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className={`${mini} min-w-[10rem] flex-1`}
          placeholder="Link (https://…)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <input
          className={`${mini} w-14 text-center`}
          type="number"
          min={1}
          step="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          aria-label="Quantity"
        />
        <input
          className={`${mini} w-24 text-right`}
          type="number"
          min={0}
          step="1"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          aria-label="Unit price"
        />
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  );
}
