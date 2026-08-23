import type { Pool } from "mysql2/promise";
import type { DeckSnapshot } from "../../deck-diff.ts";
import { toMysqlDatetimeMs } from "../db/datetime.ts";

export type DeckSnapshotKind = "signup" | "round_start";

/**
 * Append-only audit trail of every deck snapshot a registration has ever had
 * frozen against it - signup, then one per round start. Nothing reads this
 * back today (validation reads the single "current" snapshot on the
 * registration row - see deck-watch.service.ts), so this is a plain insert
 * log, not a lookup table.
 */
export class DeckSnapshotsRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async record(input: { id: string; registrationId: string; kind: DeckSnapshotKind; roundNumber: number | null; snapshot: DeckSnapshot; now: Date }): Promise<void> {
    await this.pool.query(
      `INSERT INTO deck_snapshots (id, registration_id, kind, round_number, snapshot, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.id, input.registrationId, input.kind, input.roundNumber, JSON.stringify(input.snapshot), toMysqlDatetimeMs(input.now.toISOString())],
    );
  }

  /** Test seam. */
  async clear(): Promise<void> {
    await this.pool.query("DELETE FROM deck_snapshots");
  }
}
