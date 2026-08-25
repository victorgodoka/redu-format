"use client";

import { useState, useSyncExternalStore } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import Select from "@/components/ui/Select";
import { isPrizeTier, PRIZE_TIER_ORDER, PRIZE_TIERS, type PrizeTier } from "@/lib/prizing";

type Row = { key: number; code: string; tier: PrizeTier };

const blank = (key: number): Row => ({ key, code: "", tier: "participation" });

/** Draft rows survive a reload, per tournament, until they are actually saved. */
const draftKey = (slug: string) => `redu:prize-codes:${slug}`;

function readDraft(slug: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(slug));
  } catch {
    return null;
  }
}

function writeDraft(slug: string, rows: Row[]): void {
  try {
    window.localStorage.setItem(
      draftKey(slug),
      JSON.stringify(rows.map(({ code, tier }) => ({ code, tier }))),
    );
  } catch {
    // Storage full or blocked. The codes are still in the form, so this only
    // ever costs the convenience of surviving a reload, never a save.
  }
}

function clearDraft(slug: string): void {
  try {
    window.localStorage.removeItem(draftKey(slug));
  } catch {
    /* nothing to clean up if it was never written */
  }
}

/** Whatever is in storage is the admin's own typing, but it is still parsed defensively. */
function parseDraft(raw: string | null): Row[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const rows = parsed
      .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      .map((row, key) => ({
        key,
        code: typeof row.code === "string" ? row.code : "",
        tier:
          typeof row.tier === "string" && isPrizeTier(row.tier)
            ? row.tier
            : ("participation" as PrizeTier),
      }));
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

/** localStorage never changes behind this component's back, so there is nothing to subscribe to. */
function subscribeNever() {
  return () => {};
}

/**
 * The code entry: a row per code, "+" for one more, and one Save that posts
 * the whole batch. Rows post as parallel `code`/`tier` arrays, paired back up
 * by position on the server - blank ones are dropped there rather than
 * blocking the save, so an extra empty row is harmless.
 *
 * Clicking "+" also stashes the rows in localStorage, so a tab closed
 * mid-entry does not cost the codes already typed; saving clears it.
 */
export default function PrizeCodeFields({
  slug,
  action,
}: {
  slug: string;
  action: (form: FormData) => void | Promise<void>;
}) {
  // Same SSR-safe shape the tournament form uses for its Intl lists: the
  // server (and first paint) sees no draft, the browser sees the stored one
  // once hydrated. Reading it in render through this hook instead of in an
  // effect is what keeps the two from disagreeing.
  const stored = useSyncExternalStore(
    subscribeNever,
    () => readDraft(slug),
    () => null,
  );

  // null until the admin edits something - up to that point the stored draft
  // is what is on screen.
  const [edited, setEdited] = useState<Row[] | null>(null);
  const rows = edited ?? parseDraft(stored) ?? [blank(0)];

  function update(key: number, patch: Partial<Row>) {
    setEdited(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const next = [...rows, blank(Math.max(...rows.map((r) => r.key)) + 1)];
    setEdited(next);
    writeDraft(slug, next);
  }

  return (
    <form action={action} className="form" onSubmit={() => clearDraft(slug)}>
      <input type="hidden" name="slug" value={slug} />

      {rows.map((row, i) => (
        <div className="prize-row" key={row.key}>
          {/* Only the first row shows a visible label; every row still names
              its own controls, so a screen reader reads them all the same. */}
          <div className="form__field">
            {i === 0 ? <Label htmlFor={`code-${row.key}`}>Redemption code</Label> : null}
            <Input
              id={`code-${row.key}`}
              name="code"
              type="text"
              autoComplete="off"
              aria-label="Redemption code"
              value={row.code}
              onChange={(e) => update(row.key, { code: e.target.value })}
            />
          </div>

          <div className="form__field">
            {i === 0 ? <Label htmlFor={`tier-${row.key}`}>Prize type</Label> : null}
            <Select
              id={`tier-${row.key}`}
              name="tier"
              aria-label="Prize type"
              value={row.tier}
              onChange={(e) => update(row.key, { tier: e.target.value as PrizeTier })}
            >
              {PRIZE_TIER_ORDER.map((tier) => (
                <option key={tier} value={tier}>
                  {PRIZE_TIERS[tier].label}
                </option>
              ))}
            </Select>
          </div>

          {rows.length > 1 ? (
            <Button
              type="button"
              className="prize-row__btn"
              aria-label="Remove this code"
              onClick={() => setEdited(rows.filter((r) => r.key !== row.key))}
            >
              −
            </Button>
          ) : null}

          {i === rows.length - 1 ? (
            <Button
              type="button"
              className="prize-row__btn"
              aria-label="Add another code"
              onClick={addRow}
            >
              +
            </Button>
          ) : null}
        </div>
      ))}

      <Button variant="solid" type="submit">
        Save codes
      </Button>
    </form>
  );
}
