import AdminList, { AdminRow } from "@/components/admin/AdminList";
import DeleteButton from "@/components/admin/DeleteButton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { formatDate, formatTime } from "@/lib/events";
import type { PrizeRow } from "@/lib/backend/services/prizing.service";
import { PRIZE_TIER_ORDER, PRIZE_TIERS } from "@/lib/prizing";
import type { TournamentStatus } from "@/lib/tournaments";

type FormAction = (form: FormData) => void | Promise<void>;

/**
 * The prize codes for one tournament: added one at a time while it is still
 * scheduled or running, then mailed out in a single pass once it is finished.
 * Every control here is a plain form, so the whole panel stays a server
 * component (the confirm dialog on the buttons is the only client bit).
 */
export default function PrizingPanel({
  slug,
  status,
  prizes,
  prizesSentAt,
  addPrizeAction,
  removePrizeAction,
  sendPrizesAction,
}: {
  slug: string;
  status: TournamentStatus;
  prizes: PrizeRow[];
  prizesSentAt: string | null;
  addPrizeAction: FormAction;
  removePrizeAction: FormAction;
  sendPrizesAction: FormAction;
}) {
  const open = status === "scheduled" || status === "running";
  const unsent = prizes.filter((p) => !p.sentAt).length;

  return (
    <div className="section__content" style={{ marginTop: "24px" }}>
      <h2 className="section__subtitle">Prizing</h2>

      {open ? (
        <form action={addPrizeAction} className="form form--flex">
          <input type="hidden" name="slug" value={slug} />
          <FormField label="Redemption code" htmlFor="code">
            <Input id="code" name="code" type="text" autoComplete="off" required />
          </FormField>
          <FormField label="Prize type" htmlFor="tier">
            <Select id="tier" name="tier" defaultValue="participation">
              {PRIZE_TIER_ORDER.map((tier) => (
                <option key={tier} value={tier}>
                  {PRIZE_TIERS[tier].label}
                </option>
              ))}
            </Select>
          </FormField>
          <Button variant="solid" type="submit">
            Add code
          </Button>
        </form>
      ) : null}

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
