"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShoppingItem } from "@/lib/types";

export function ShoppingList({ householdId }: { householdId: string }) {
  const supabaseRef = useRef(createClient());
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Ignore realtime echoes of our own writes briefly, so optimistic edits
  // aren't clobbered by the slower round-trip.
  const suppressUntil = useRef(0);
  const suppress = (ms = 1200) => (suppressUntil.current = Date.now() + ms);

  const reload = useCallback(async () => {
    const { data } = await supabaseRef.current
      .from("shopping_items")
      .select("id,household_id,name,note,is_bought,created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true });
    setItems((data ?? []) as ShoppingItem[]);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    reload();
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`shopping:${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items", filter: `household_id=eq.${householdId}` },
        () => Date.now() > suppressUntil.current && reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, reload]);

  const toBuy = items.filter((i) => !i.is_bought);
  const bought = items.filter((i) => i.is_bought);

  const toggle = useCallback(async (item: ShoppingItem) => {
    suppress();
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_bought: !i.is_bought } : i)),
    );
    const { error } = await supabaseRef.current
      .from("shopping_items")
      .update({ is_bought: !item.is_bought })
      .eq("id", item.id);
    if (error) reload();
  }, [reload]);

  const remove = useCallback(async (item: ShoppingItem) => {
    suppress();
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error } = await supabaseRef.current
      .from("shopping_items")
      .delete()
      .eq("id", item.id);
    if (error) reload();
  }, [reload]);

  const markAllBought = useCallback(async () => {
    if (toBuy.length === 0) return;
    suppress();
    setItems((prev) => prev.map((i) => ({ ...i, is_bought: true })));
    const { error } = await supabaseRef.current
      .from("shopping_items")
      .update({ is_bought: true })
      .eq("household_id", householdId)
      .eq("is_bought", false);
    if (error) reload();
  }, [toBuy.length, householdId, reload]);

  const clearBought = useCallback(async () => {
    if (bought.length === 0) return;
    suppress();
    setItems((prev) => prev.filter((i) => !i.is_bought));
    const { error } = await supabaseRef.current
      .from("shopping_items")
      .delete()
      .eq("household_id", householdId)
      .eq("is_bought", true);
    if (error) reload();
  }, [bought.length, householdId, reload]);

  return (
    <div className="flex flex-col gap-4">
      <AddItemForm
        householdId={householdId}
        supabase={supabaseRef.current}
        onAdded={() => {
          suppress();
          reload();
        }}
      />

      {loading ? (
        <p className="py-10 text-center text-[var(--muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-[var(--muted)]">
          List is empty — add something you&apos;re out of. 🥛
        </p>
      ) : (
        <>
          {(toBuy.length > 0 || bought.length > 0) && (
            <div className="flex items-center justify-between px-1 text-sm text-[var(--muted)]">
              <span>
                {toBuy.length} to buy
                {bought.length > 0 && ` · ${bought.length} in the basket`}
              </span>
              <div className="flex gap-3">
                {toBuy.length > 0 && (
                  <button onClick={markAllBought} className="hover:text-[var(--text)]">
                    Mark all bought
                  </button>
                )}
                {bought.length > 0 && (
                  <button onClick={clearBought} className="text-[var(--overdue)] hover:underline">
                    Clear bought
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {toBuy.map((item) => (
              <ItemRow key={item.id} item={item} onToggle={toggle} onRemove={remove} />
            ))}
          </div>

          {bought.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                In the basket
              </div>
              {bought.map((item) => (
                <ItemRow key={item.id} item={item} onToggle={toggle} onRemove={remove} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ShoppingItem;
  onToggle: (i: ShoppingItem) => void;
  onRemove: (i: ShoppingItem) => void;
}) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <input
        type="checkbox"
        checked={item.is_bought}
        onChange={() => onToggle(item)}
        className="h-6 w-6 shrink-0 accent-[var(--accent)]"
        aria-label={item.is_bought ? "Mark as still needed" : "Mark as bought"}
      />
      <div className="min-w-0 flex-1">
        <div
          className="truncate font-medium"
          style={{
            textDecoration: item.is_bought ? "line-through" : undefined,
            color: item.is_bought ? "var(--muted)" : undefined,
          }}
        >
          {item.name}
        </div>
        {item.note && <div className="truncate text-xs text-[var(--muted)]">{item.note}</div>}
      </div>
      <button
        onClick={() => onRemove(item)}
        className="shrink-0 px-1 text-[var(--muted)] hover:text-[var(--overdue)]"
        aria-label="Remove"
      >
        ✕
      </button>
    </div>
  );
}

function AddItemForm({
  householdId,
  supabase,
  onAdded,
}: {
  householdId: string;
  supabase: ReturnType<typeof createClient>;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = "card px-3 py-2 outline-none focus:border-[var(--accent)]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("shopping_items").insert({
      household_id: householdId,
      name: name.trim(),
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setNote("");
    onAdded();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className={`${field} flex-1`}
          placeholder="Add an item… (e.g. Milk)"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={`${field} w-24 sm:w-32`}
          placeholder="qty/note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Quantity or note"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="shrink-0 rounded-2xl bg-[var(--accent)] px-5 py-2 font-medium text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {error && <p className="text-sm text-[var(--overdue)]">{error}</p>}
    </form>
  );
}
