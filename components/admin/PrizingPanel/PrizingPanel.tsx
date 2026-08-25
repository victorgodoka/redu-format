import AdminList, { AdminRow } from "@/components/admin/AdminList";
import DeleteButton from "@/components/admin/DeleteButton";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatTime } from "@/lib/events";
import type { PrizeRow } from "@/lib/backend/services/prizing.service";
import { PRIZE_TIERS } from "@/lib/prizing";
import type { TournamentStatus } from "@/lib/tournaments";
import PrizeCodeFields from "./PrizeCodeFields";

type FormAction = (form: FormData) => void | Promise<void>;

/**
 * The prize codes for one tournament: entered in a batch while it is still
 * scheduled or running, then mailed out in a single pass once it is finished.
 * Only the code entry needs client state (rows come and go); the list and the
 * buttons stay server-rendered.
 */
export default function PrizingPanel({
  slug,
  status,
  prizes,
  prizesSentAt,
  addPrizesAction,
  removePrizeAction,
  sendPrizesAction,
}: {
  slug: string;
  status: TournamentStatus;
  prizes: PrizeRow[];
  prizesSentAt: string | null;
  addPrizesAction: FormAction;
  removePrizeAction: FormAction;
  sendPrizesAction: FormAction;
}) {
  const open = status === "scheduled" || status === "running";
  const unsent = prizes.filter((p) => !p.sentAt).length;

  return (
    <div className="section__content" style={{ marginTop: "24px" }}>
      <h2 className="section__subtitle">Prizing</h2>

      {open ? <PrizeCodeFields slug={slug} action={addPrizesAction} /> : null}

      <p className="form__hint">
        Winner is 1st, Runner-up is 2nd, and each Top X covers the places down to the next tier
        (Top 4 is 3rd-4th, Top 8 is 5th-8th, Top 16 is 9th-16th, Top 32 is 17th-32nd).
        Participation goes to everyone else who finished - never to a drop or a disqualification.
        Each player receives exactly one code.
      </p>

      {prizes.length === 0 ? (
        <EmptyState message="No prize codes yet." />
      ) : (
        <AdminList>
          {prizes.map((prize) => (
            <AdminRow key={prize.id}>
              <AdminRow.Main>
                <span className="admin-row__title">
                  <code>{prize.code}</code>
                </span>
                <span className="admin-row__meta">
                  <Badge tone={prize.sentAt ? "positive" : "neutral"}>
                    {PRIZE_TIERS[prize.tier].label}
                  </Badge>{" "}
                  {prize.sentAt
                    ? `Sent to ${prize.sentTo ?? "a player"} on ${formatDate(prize.sentAt)} ${formatTime(prize.sentAt)}`
                    : "Not sent yet"}
                </span>
              </AdminRow.Main>
              {open && !prize.sentAt ? (
                <AdminRow.Actions>
                  <DeleteButton
                    action={removePrizeAction}
                    hidden={{ slug, prizeId: prize.id }}
                    confirmText={`Remove the code ${prize.code}?`}
                    label="Remove"
                  />
                </AdminRow.Actions>
              ) : null}
            </AdminRow>
          ))}
        </AdminList>
      )}

      {status === "finished" ? (
        prizesSentAt ? (
          <p className="form__hint">
            Prizing was sent on {formatDate(prizesSentAt)} {formatTime(prizesSentAt)}.
          </p>
        ) : (
          <DeleteButton
            action={sendPrizesAction}
            hidden={{ slug }}
            confirmText={`Send ${unsent} prize code(s) to the players' inboxes? This can only be done once.`}
            label="Send prizing"
            variant="solid"
          />
        )
      ) : null}
    </div>
  );
}
