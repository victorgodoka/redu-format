import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasBracket } from "@/lib/backend/services/results.service";
import { formatDate, formatTime } from "@/lib/events";
import { getTournament, listParticipants } from "@/lib/tournaments";
import DeleteButton from "../../../delete-button";
import {
  addParticipantAction,
  confirmPaymentAction,
  contestPaymentAction,
  editParticipantDeckAction,
  removeParticipantAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Tournament participants | REDU Format",
  robots: { index: false, follow: false },
};

const NEXUS_EDITOR = "https://duelingnexus.com/editor/";

export default async function ParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  const [participants, started] = await Promise.all([listParticipants(slug), hasBracket(slug)]);
  const isPaid = tournament.entry.type === "paid";

  return (
    <>
      <div className="admin-page-head">
        <h1 className="admin-heading">{tournament.name} · Participants</h1>
        <Link className="admin-back" href={`/admin/tournaments/${slug}`}>
          ← Back to tournament
        </Link>
      </div>

      {error ? (
        <p role="alert" className="form__error">
          {error}
        </p>
      ) : null}

      <form action={addParticipantAction} className="form form--flex">
        <input type="hidden" name="slug" value={slug} />
        <div className="form__field">
          <label htmlFor="name">Duelist name</label>
          <input id="name" name="name" type="text" required />
        </div>
        <div className="form__field">
          <label htmlFor="deckName">Deck UUID</label>
          <input
            id="deckName"
            name="deckName"
            type="text"
            placeholder="Dueling Nexus deck UUID"
            required
          />
        </div>
        <button className="btn btn--solid" type="submit">
          Add participant
        </button>
      </form>

      {participants.length === 0 ? (
        <div className="empty panel">
          <p className="lede">No participants registered yet.</p>
        </div>
      ) : (
        <ul className="admin-list participants">
          {participants.map((p) => (
            <li className="admin-row panel" key={p.id}>
              <div className="admin-row__main">
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
                {isPaid ? (
                  <span className="payment-status">
                    <span
                      className={`badge badge--${
                        p.paymentStatus === "confirmed"
                          ? "positive"
                          : p.paymentStatus === "contested"
                            ? "negative"
                            : "neutral"
                      }`}
                    >
                      {p.paymentStatus === "confirmed"
                        ? "Confirmed entry"
                        : p.paymentStatus === "contested"
                          ? "Contested"
                          : "Payment pending"}
                    </span>
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
              </div>

              {isPaid ? (
                <div className="admin-row__actions payment-controls">
                  <form action={confirmPaymentAction} className="payment-controls__confirm">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="participantId" value={p.id} />
                    <input
                      type="url"
                      name="proofUrl"
                      placeholder={p.proofUrl ? "New proof URL (optional)" : "Proof URL"}
                      required={!p.proofUrl}
                    />
                    <button className="btn btn--solid" type="submit">
                      {p.paymentStatus === "confirmed" ? "Re-confirm" : "Confirm entry"}
                    </button>
                  </form>
                  {p.paymentStatus === "confirmed" ? (
                    <form action={contestPaymentAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="participantId" value={p.id} />
                      <button className="btn btn--danger" type="submit">
                        Contest
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}

              <div className="admin-row__actions">
                {started ? (
                  <span className="admin-row__meta">Deck locked - tournament in progress</span>
                ) : (
                  <form action={editParticipantDeckAction} className="payment-controls__confirm">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="participantId" value={p.id} />
                    <input
                      type="text"
                      name="deckName"
                      placeholder="New deck UUID"
                      required
                    />
                    <button className="btn" type="submit">
                      Edit deck
                    </button>
                  </form>
                )}
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
