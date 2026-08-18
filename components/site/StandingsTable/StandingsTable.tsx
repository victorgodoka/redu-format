import type { PlacingWithTiebreak } from "@/lib/backend/services/results.service";
import styles from "./StandingsTable.module.css";

/**
 * The official Konami tiebreaker code (KDE-US Tournament Policy §V.C,
 * docs/fluxo-do-torneio.md §10) in the AABBBCCC form printed on real
 * standings sheets: AA match points, BBB opponents' match-win% to the tenth
 * of a percent, CCC opponents'-opponents' match-win%. Kept separate from
 * officialTiebreakScore() in results.service.ts, which pads those same
 * figures wide for safe sorting rather than compact display.
 */
function tiebreakerCode(points: number, omw: number, oomw: number): string {
  const AA = String(points).padStart(2, "0");
  const BBB = String(Math.round(omw * 1000)).padStart(3, "0");
  const CCC = String(Math.round(oomw * 1000)).padStart(3, "0");
  return `${AA}${BBB}${CCC}`;
}
export default function StandingsTable({ rows }: { rows: PlacingWithTiebreak[] }) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Place</th>
            <th>Duelist</th>
            <th>Record</th>
            <th>Points</th>
            <th>Tiebreaker</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.registrationId} className={r.place === 1 ? styles.winner : undefined}>
              <td>#{r.place}</td>
              <td>{r.displayName}</td>
              <td>
                {r.wins}-{r.losses}
                {r.draws > 0 ? `-${r.draws}` : ""}
              </td>
              <td>{r.points}</td>
              <td>{tiebreakerCode(r.points, r.omw, r.oomw)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
