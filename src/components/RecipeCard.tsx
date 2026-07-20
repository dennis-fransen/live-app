"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  RECIPE_CATEGORIES,
  addIngredientsToShopping,
  formatTimes,
} from "@/lib/recipes";
import type {
  RecipeIngredient,
  RecipeStep,
  RecipeWithDetails,
} from "@/lib/types";

type Supabase = ReturnType<typeof createClient>;

const field = "card px-3 py-2 outline-none focus:border-[var(--accent)]";
const mini =
  "rounded-lg border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]";

export function RecipeCard({
  recipe,
  supabase,
  onChanged,
}: {
  recipe: RecipeWithDetails;
  supabase: Supabase;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  // Ephemeral "cooking mode" checkoff — resets when the card collapses or the
  // list reloads. Deliberately not persisted: it tracks tonight's cook, not
  // durable state.
  const [checkedIng, setCheckedIng] = useState<Set<string>>(new Set());
  const [checkedStep, setCheckedStep] = useState<Set<string>>(new Set());
  const [shopMsg, setShopMsg] = useState<string | null>(null);

  const times = formatTimes(recipe.prep_minutes, recipe.cook_minutes);

  function toggleSet(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) {
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function toggleFavorite() {
    await supabase
      .from("recipes")
      .update({ is_favorite: !recipe.is_favorite })
      .eq("id", recipe.id);
    onChanged();
  }

  async function toggleArchived() {
    await supabase
      .from("recipes")
      .update({ is_archived: !recipe.is_archived })
      .eq("id", recipe.id);
    onChanged();
  }

  async function removeRecipe() {
    if (!confirm(`Delete "${recipe.title}", its ingredients and steps?`)) return;
    await supabase.from("recipes").delete().eq("id", recipe.id);
    onChanged();
  }

  async function sendToShopping() {
    if (recipe.ingredients.length === 0) return;
    try {
      const n = await addIngredientsToShopping(supabase, recipe);
      setShopMsg(`Added ${n} item${n === 1 ? "" : "s"} to Shopping ✓`);
      setTimeout(() => setShopMsg(null), 2500);
    } catch {
      setShopMsg("Couldn’t add to Shopping");
      setTimeout(() => setShopMsg(null), 2500);
    }
  }

  return (
    <div className="card p-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleFavorite}
          aria-label={recipe.is_favorite ? "Unfavorite" : "Favorite"}
          className="shrink-0 px-1 text-lg"
          style={{ color: recipe.is_favorite ? "var(--accent)" : "var(--muted)" }}
        >
          {recipe.is_favorite ? "★" : "☆"}
        </button>

        <button
          onClick={() => setExpanded((s) => !s)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="truncate font-medium"
                style={{ textDecoration: recipe.is_archived ? "line-through" : undefined }}
              >
                {recipe.title}
              </span>
              {recipe.category && (
                <span className="shrink-0 rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
                  {recipe.category}
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {[
                recipe.recipe_yield,
                times || null,
                recipe.ingredients.length
                  ? `${recipe.ingredients.length} ingredient${recipe.ingredients.length === 1 ? "" : "s"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || "no details yet"}
            </div>
          </div>
          <div className="shrink-0 text-xs text-[var(--muted)]">{expanded ? "▾" : "▸"}</div>
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="mt-3 flex flex-col gap-4 border-t border-[var(--border)] pt-3">
          {editing ? (
            <DetailsForm
              recipe={recipe}
              supabase={supabase}
              onDone={() => {
                setEditing(false);
                onChanged();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {recipe.description ? (
                <p className="whitespace-pre-wrap text-sm text-[var(--text)]">
                  {recipe.description}
                </p>
              ) : (
                <p className="text-sm italic text-[var(--muted)]">No description.</p>
              )}
              {recipe.source && (
                <p className="text-xs text-[var(--muted)]">
                  Source:{" "}
                  {/^https?:\/\//.test(recipe.source) ? (
                    <a
                      href={recipe.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      {recipe.source}
                    </a>
                  ) : (
                    recipe.source
                  )}
                </p>
              )}
              <button
                onClick={() => setEditing(true)}
                className="self-start text-xs text-[var(--accent)] hover:underline"
              >
                Edit details
              </button>
            </div>
          )}

          {/* Ingredients */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Ingredients</div>
              {recipe.ingredients.length > 0 && (
                <button
                  onClick={sendToShopping}
                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--accent)] hover:border-[var(--accent)]"
                >
                  🛒 Add all to shopping
                </button>
              )}
            </div>
            {shopMsg && <p className="text-xs text-[var(--muted)]">{shopMsg}</p>}
            {recipe.ingredients.map((ing) => (
              <IngredientRow
                key={ing.id}
                ing={ing}
                checked={checkedIng.has(ing.id)}
                onCheck={() => toggleSet(setCheckedIng, ing.id)}
                supabase={supabase}
                onChanged={onChanged}
              />
            ))}
            <AddIngredientRow
              recipe={recipe}
              supabase={supabase}
              nextOrder={
                recipe.ingredients.length
                  ? Math.max(...recipe.ingredients.map((i) => i.sort_order)) + 1
                  : 0
              }
              onChanged={onChanged}
            />
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Steps</div>
            {recipe.steps.map((step, idx) => (
              <StepRow
                key={step.id}
                step={step}
                number={idx + 1}
                checked={checkedStep.has(step.id)}
                onCheck={() => toggleSet(setCheckedStep, step.id)}
                supabase={supabase}
                onChanged={onChanged}
              />
            ))}
            <AddStepRow
              recipe={recipe}
              supabase={supabase}
              nextOrder={
                recipe.steps.length
                  ? Math.max(...recipe.steps.map((s) => s.sort_order)) + 1
                  : 0
              }
              onChanged={onChanged}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={toggleArchived}
              className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
            >
              {recipe.is_archived ? "↩ Unarchive" : "🗄 Archive"}
            </button>
            <button
              onClick={removeRecipe}
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

function DetailsForm({
  recipe,
  supabase,
  onDone,
  onCancel,
}: {
  recipe: RecipeWithDetails;
  supabase: Supabase;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(recipe.title);
  const [category, setCategory] = useState(recipe.category ?? "");
  const [recipeYield, setRecipeYield] = useState(recipe.recipe_yield ?? "");
  const [prep, setPrep] = useState(
    recipe.prep_minutes != null ? String(recipe.prep_minutes) : "",
  );
  const [cook, setCook] = useState(
    recipe.cook_minutes != null ? String(recipe.cook_minutes) : "",
  );
  const [source, setSource] = useState(recipe.source ?? "");
  const [description, setDescription] = useState(recipe.description ?? "");
  const [busy, setBusy] = useState(false);

  function toInt(v: string): number | null {
    const n = Math.floor(Number(v));
    return v.trim() && Number.isFinite(n) && n >= 0 ? n : null;
  }

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    await supabase
      .from("recipes")
      .update({
        title: title.trim(),
        category: category.trim() || null,
        recipe_yield: recipeYield.trim() || null,
        prep_minutes: toInt(prep),
        cook_minutes: toInt(cook),
        source: source.trim() || null,
        description: description.trim() || null,
      })
      .eq("id", recipe.id);
    setBusy(false);
    onDone();
  }

  return (
    <div className="flex flex-col gap-2">
      <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          Category
          <input
            className={field}
            list="recipe-categories-edit"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="recipe-categories-edit">
            {RECIPE_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          Yield
          <input
            className={field}
            value={recipeYield}
            onChange={(e) => setRecipeYield(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          Prep (min)
          <input
            className={field}
            type="number"
            min={0}
            step="1"
            value={prep}
            onChange={(e) => setPrep(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          Cook (min)
          <input
            className={field}
            type="number"
            min={0}
            step="1"
            value={cook}
            onChange={(e) => setCook(e.target.value)}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
        Source (URL or book)
        <input className={field} value={source} onChange={(e) => setSource(e.target.value)} />
      </label>
      <textarea
        className={field}
        rows={3}
        placeholder="Notes, tips, what worked…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy || !title.trim()}
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

function IngredientRow({
  ing,
  checked,
  onCheck,
  supabase,
  onChanged,
}: {
  ing: RecipeIngredient;
  checked: boolean;
  onCheck: () => void;
  supabase: Supabase;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(ing.amount ?? "");
  const [name, setName] = useState(ing.name);

  async function save() {
    if (!name.trim()) return;
    await supabase
      .from("recipe_ingredients")
      .update({ amount: amount.trim() || null, name: name.trim() })
      .eq("id", ing.id);
    setEditing(false);
    onChanged();
  }
  async function remove() {
    await supabase.from("recipe_ingredients").delete().eq("id", ing.id);
    onChanged();
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] p-2">
        <input
          className={`${mini} w-24`}
          placeholder="500 g"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className={`${mini} min-w-[8rem] flex-1`}
          placeholder="flour"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          onClick={save}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
        >
          Save
        </button>
        <button
          onClick={() => setEditing(false)}
          className="px-2 py-1.5 text-sm text-[var(--muted)]"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onCheck}
        className="h-5 w-5 shrink-0 accent-[var(--accent)]"
        aria-label="Have it / done"
      />
      <button
        onClick={() => setEditing(true)}
        className="min-w-0 flex-1 break-words text-left"
        style={{ textDecoration: checked ? "line-through" : undefined, opacity: checked ? 0.6 : 1 }}
      >
        {ing.amount && <span className="text-[var(--muted)]">{ing.amount} </span>}
        {ing.name}
      </button>
      <button
        onClick={remove}
        className="shrink-0 px-1 text-[var(--overdue)] hover:opacity-70"
        aria-label="Remove ingredient"
      >
        ✕
      </button>
    </div>
  );
}

function AddIngredientRow({
  recipe,
  supabase,
  nextOrder,
  onChanged,
}: {
  recipe: RecipeWithDetails;
  supabase: Supabase;
  nextOrder: number;
  onChanged: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await supabase.from("recipe_ingredients").insert({
      household_id: recipe.household_id,
      recipe_id: recipe.id,
      amount: amount.trim() || null,
      name: name.trim(),
      sort_order: nextOrder,
    });
    setBusy(false);
    setAmount("");
    setName("");
    onChanged();
  }

  return (
    <form
      onSubmit={add}
      className="flex flex-wrap gap-2 rounded-xl border border-dashed border-[var(--border)] p-2"
    >
      <input
        className={`${mini} w-24`}
        placeholder="500 g"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label="Amount"
      />
      <input
        className={`${mini} min-w-[8rem] flex-1`}
        placeholder="Ingredient"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Ingredient name"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}

function StepRow({
  step,
  number,
  checked,
  onCheck,
  supabase,
  onChanged,
}: {
  step: RecipeStep;
  number: number;
  checked: boolean;
  onCheck: () => void;
  supabase: Supabase;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(step.body);

  async function save() {
    if (!body.trim()) return;
    await supabase.from("recipe_steps").update({ body: body.trim() }).eq("id", step.id);
    setEditing(false);
    onChanged();
  }
  async function remove() {
    await supabase.from("recipe_steps").delete().eq("id", step.id);
    onChanged();
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-2">
        <textarea
          className={mini}
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-2 py-1.5 text-sm text-[var(--muted)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-[var(--border)] p-2 text-sm">
      <button
        onClick={onCheck}
        aria-label="Step done"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{
          backgroundColor: checked ? "var(--accent)" : "transparent",
          color: checked ? "var(--bg)" : "var(--muted)",
          border: "1px solid var(--border)",
        }}
      >
        {checked ? "✓" : number}
      </button>
      <button
        onClick={() => setEditing(true)}
        className="min-w-0 flex-1 whitespace-pre-wrap break-words text-left"
        style={{ textDecoration: checked ? "line-through" : undefined, opacity: checked ? 0.6 : 1 }}
      >
        {step.body}
      </button>
      <button
        onClick={remove}
        className="shrink-0 px-1 text-[var(--overdue)] hover:opacity-70"
        aria-label="Remove step"
      >
        ✕
      </button>
    </div>
  );
}

function AddStepRow({
  recipe,
  supabase,
  nextOrder,
  onChanged,
}: {
  recipe: RecipeWithDetails;
  supabase: Supabase;
  nextOrder: number;
  onChanged: () => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    await supabase.from("recipe_steps").insert({
      household_id: recipe.household_id,
      recipe_id: recipe.id,
      body: body.trim(),
      sort_order: nextOrder,
    });
    setBusy(false);
    setBody("");
    onChanged();
  }

  return (
    <form
      onSubmit={add}
      className="flex flex-wrap gap-2 rounded-xl border border-dashed border-[var(--border)] p-2"
    >
      <input
        className={`${mini} min-w-[10rem] flex-1`}
        placeholder="Next step…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Step"
      />
      <button
        type="submit"
        disabled={busy || !body.trim()}
        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
