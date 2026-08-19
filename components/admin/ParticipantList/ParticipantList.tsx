import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import AdminList, { AdminRow } from "@/components/admin/AdminList";
import DeleteButton from "@/components/admin/DeleteButton";
import { formatDate, formatTime } from "@/lib/events";
import type { Participant } from "@/lib/tournaments";

const NEXUS_EDITOR = "https://duelingnexus.com/editor/";

type FormAction = (formData: FormData) => void | Promise<void>;

export default function ParticipantList({
  slug,
  participants,
  isPaid,
  started,
  confirmPaymentAction,
  contestPaymentAction,
  editParticipantDeckAction,
  overrideParticipantDeckAction,
  removeParticipantAction,
  disqualifyParticipantAction,
  reinstateParticipantAction,
}: {
  slug: string;
  participants: Participant[];
  isPaid: boolean;
  started: boolean;
  confirmPaymentAction: FormAction;
  contestPaymentAction: FormAction;
  editParticipantDeckAction: FormAction;
  overrideParticipantDeckAction: FormAction;
  removeParticipantAction: FormAction;
  disqualifyParticipantAction: FormAction;
  reinstateParticipantAction: FormAction;
}) {
  return (
    <AdminList className="participants">
      {participants.map((p) => (
        <AdminRow key={p.id}>
          <AdminRow.Main>
            <span className="admin-row__title">
              {p.name}{" "}
              <a
                className="admin-row__uuid"
                href={`${NEXUS_EDITOR}${p.deckName}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                ({p.deckName})
              </a>
            </span>
            <span className="admin-row__meta">
              {p.source === "public_signup" ? "Public signup" : "Added by admin"}
            </span>
            {p.disqualifiedAt ? (
              <span className="payment-status">
                <Badge tone="negative">Disqualified</Badge>
                {p.dqReason ?? "Deck violation"} · {formatDate(p.disqualifiedAt)}{" "}
                {formatTime(p.disqualifiedAt)}
              </span>
            ) : p.droppedAt ? (
              <span className="payment-status">
                <Badge tone="muted">Dropped</Badge>
                {formatDate(p.droppedAt)} {formatTime(p.droppedAt)}
              </span>
            ) : null}
            {isPaid ? (
              <span className="payment-status">
                <Badge
                  tone={
                    p.paymentStatus === "confirmed"
                      ? "positive"
                      : p.paymentStatus === "contested"
                        ? "negative"
                        : "neutral"
                  }
                >
                  {p.paymentStatus === "confirmed"
                    ? "Confirmed entry"
                    : p.paymentStatus === "contested"
                      ? "Contested"
                      : "Payment pending"}
                </Badge>
                {p.paymentBy && p.paymentAt
                  ? `by ${p.paymentBy} · ${formatDate(p.paymentAt)} ${formatTime(p.paymentAt)}`
                  : ""}
                {p.proofUrl ? (
                  <>
                    {" · "}
                    <a href={p.proofUrl} target="_blank" rel="noopener noreferrer">
                      View proof
                    </a>
                  </>
                ) : null}
              </span>
            ) : null}
          </AdminRow.Main>

          {isPaid ? (
            <AdminRow.Actions className="payment-controls">
              <form action={confirmPaymentAction} className="payment-controls__confirm">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="participantId" value={p.id} />
                <input
                  type="url"
                  name="proofUrl"
                  placeholder={p.proofUrl ? "New proof URL (optional)" : "Proof URL"}
                  required={!p.proofUrl}
                />
                <Button variant="solid" type="submit">
                  {p.paymentStatus === "confirmed" ? "Re-confirm" : "Confirm entry"}
                </Button>
              </form>
              {p.paymentStatus === "confirmed" ? (
                <form action={contestPaymentAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="participantId" value={p.id} />
                  <Button variant="danger" type="submit">
                    Contest
                  </Button>
                </form>
              ) : null}
            </AdminRow.Actions>
          ) : null}

          <AdminRow.Actions>
            {started ? (
              <details className="admin-row__override">
                <summary className="admin-row__meta">Deck locked - tournament in progress</summary>
                <form action={overrideParticipantDeckAction} className="payment-controls__confirm">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="participantId" value={p.id} />
                  <input type="text" name="deckName" placeholder="New deck UUID" required />
                  <Button variant="danger" type="submit">
                    Override deck (exceptional)
                  </Button>
                </form>
              </details>
            ) : (
              <form action={editParticipantDeckAction} className="payment-controls__confirm">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="participantId" value={p.id} />
                <input type="text" name="deckName" placeholder="New deck UUID" required />
                <Button type="submit">Edit deck</Button>
              </form>
            )}
            {p.disqualifiedAt ? (
              <form action={reinstateParticipantAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="participantId" value={p.id} />
                <Button type="submit">Undo disqualification</Button>
              </form>
            ) : started ? (
              <details className="admin-row__override">
                <summary className="admin-row__meta">Disqualify</summary>
                <form action={disqualifyParticipantAction} className="payment-controls__confirm">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="participantId" value={p.id} />
                  <input type="text" name="reason" placeholder="Reason (the player sees this)" required />
                  <Button variant="danger" type="submit">
                    Disqualify
                  </Button>
                </form>
              </details>
            ) : null}

            {p.droppedAt || p.disqualifiedAt ? null : (
              <DeleteButton
                action={removeParticipantAction}
                hidden={{ slug, participantId: p.id }}
                confirmText={
                  started
                    ? `Drop ${p.name} from this tournament? Their current match counts as a loss, and they're out for the rest of the event.`
                    : `Remove ${p.name} from this tournament?`
                }
                label={started ? "Drop" : "Remove"}
              />
            )}
          </AdminRow.Actions>
        </AdminRow>
      ))}
    </AdminList>
  );
}
