"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import Select from "@/components/ui/Select";
import { PRIZE_TIER_ORDER, PRIZE_TIERS, type PrizeTier } from "@/lib/prizing";

type Row = { key: number; code: string; tier: PrizeTier };

const blank = (key: number): Row => ({ key, code: "", tier: "participation" });

/**
 * The code entry: a row per code, "+" for one more, and one Save that posts
 * the whole batch. Rows post as parallel `code`/`tier` arrays, paired back up
 * by position on the server - blank ones are dropped there rather than
 * blocking the save, so an extra empty row is harmless.
 */
export default function PrizeCodeFields({
  slug,
  action,
}: {
  slug: string;
  action: (form: FormData) => void | Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>([blank(0)]);

  function update(key: number, patch: Partial<Row>) {
    setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <form action={action} className="form">
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
              onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
            >
              −
            </Button>
          ) : null}

          {i === rows.length - 1 ? (
            <Button
              type="button"
              className="prize-row__btn"
              aria-label="Add another code"
              onClick={() => setRows([...rows, blank(Math.max(...rows.map((r) => r.key)) + 1)])}
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
