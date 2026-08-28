"use client";

import { useState, useSyncExternalStore, useActionState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import Notice from "@/components/ui/Notice";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { addPrizesAction } from "@/app/admin/(protected)/tournaments/actions";
import type { ActionResult } from "@/lib/actions-utils";
import { isPrizeTier, PRIZE_TIER_ORDER, PRIZE_TIERS, type PrizeTier } from "@/lib/prizing";

type Row = { key: number; code: string; tier: PrizeTier };

const blank = (key: number): Row => ({ key, code: "", tier: "participation" });

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
  } catch {}
}

function clearDraft(slug: string): void {
  try {
    window.localStorage.removeItem(draftKey(slug));
  } catch {}
}

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

function subscribeNever() {
  return () => {};
}

const initialState: ActionResult = { success: true };

export default function PrizeCodeFields({ slug }: { slug: string }) {
  const [state, dispatch] = useActionState(addPrizesAction, initialState);
  const { toast } = useToast();

  const stored = useSyncExternalStore(
    subscribeNever,
    () => readDraft(slug),
    () => null,
  );

  const [edited, setEdited] = useState<Row[] | null>(null);
  const rows = edited ?? parseDraft(stored) ?? [blank(0)];

  useEffect(() => {
    if (state.success === false && state.error) {
      toast.error("Error", state.error);
    }
    if (state.success === true && state.description) {
      toast.success("Success", state.description);
      clearDraft(slug);
      setEdited(null); // Reset form to show blank row
    }
  }, [state, toast, slug]);

  function update(key: number, patch: Partial<Row>) {
    setEdited(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const next = [...rows, blank(Math.max(...rows.map((r) => r.key)) + 1)];
    setEdited(next);
    writeDraft(slug, next);
  }

  return (
    <form action={dispatch} className="form">
      <input type="hidden" name="slug" value={slug} />

      {rows.map((row, i) => (
        <div className="prize-row" key={row.key}>
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

      {state.success === false && state.error && (
        <Notice variant="error">{state.error}</Notice>
      )}

      <Button variant="solid" type="submit">
        Save codes
      </Button>
    </form>
  );
}
