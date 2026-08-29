import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatTime } from "@/lib/events";
import type { PrizeRow } from "@/lib/backend/services/prizing.service";
import { PRIZE_TIERS } from "@/lib/prizing";
import type { TournamentStatus } from "@/lib/tournaments";
import PrizeCodeFields from "./PrizeCodeFields";
import RemovePrizeButton from "./RemovePrizeButton";
import SendPrizesButton from "./SendPrizesButton";

export default function PrizingPanel({
  slug,
  tournamentName,
  status,
  prizes,
  prizesSentAt,
}: {
  slug: string;
  tournamentName: string;
  status: TournamentStatus;
  prizes: PrizeRow[];
  prizesSentAt: string | null;
}) {
  const open = status === "scheduled" || status === "running";
  const unsent = prizes.filter((p) => !p.sentAt).length;

  return (
    <div className="prizing">
      <h2 className="prizing__title">Prizing</h2>

      {open ? <PrizeCodeFields slug={slug} /> : null}

      <p className="form__hint">
        Winner is 1st, Runner-up is 2nd, and each Top X covers the places down to the next tier
        (Top 4 is 3rd-4th, Top 8 is 5th-8th, Top 16 is 9th-16th, Top 32 is 17th-32nd).
        Participation goes to everyone else who finished - never to a drop or a disqualification.
        Each player receives exactly one code.
      </p>

      {prizes.length === 0 ? (
        <EmptyState message="No prize codes yet." />
      ) : (
        <ul className="prize-list">
          {prizes.map((prize) => (
            <li key={prize.id} className="prize-card">
              <div>
                <code className="prize-card__code">{prize.code}</code>
                <div className="prize-card__meta">
                  <Badge tone={prize.sentAt ? "positive" : "neutral"}>
                    {PRIZE_TIERS[prize.tier].label}
                  </Badge>
                  <span className="prize-card__status">
                    {prize.sentAt
                      ? `Sent to ${prize.sentTo ?? "a player"} on ${formatDate(prize.sentAt)} ${formatTime(prize.sentAt)}`
                      : "Not sent yet"}
                  </span>
                </div>
              </div>
              {open && !prize.sentAt ? (
                <RemovePrizeButton slug={slug} prizeId={prize.id} prizeCode={prize.code} />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {status === "finished" ? (
        prizesSentAt ? (
          <p className="form__hint">
            Prizing was sent on {formatDate(prizesSentAt)} {formatTime(prizesSentAt)}.
          </p>
        ) : (
          <SendPrizesButton slug={slug} unsentCount={unsent} />
        )
      ) : null}
    </div>
  );
}
