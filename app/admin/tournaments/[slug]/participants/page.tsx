import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatTime } from "@/lib/events";
import { getTournament, listParticipants } from "@/lib/tournaments";
import DeleteButton from "../../../delete-button";
import {
  addParticipantAction,
  confirmPaymentAction,
  contestPaymentAction,
  removeParticipantAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Tournament participants | REDU Format",
  robots: { index: false, follow: false },
};

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  const participants = await listParticipants(slug);
  const isPaid = tournament.entry.type === "paid";

  return (
    <>
      <main className="section" id="main">
        <div className="wrap">
          <p className="tab">Admin</p>

          <div className="admin-bar">
            <h1 className="section__title">{tournament.name} · Participants</h1>
            <Link className="filters__reset" href={`/admin/tournaments/${slug}`}>
              ← Back to tournament
            </Link>
          </div>

          <form action={addParticipantAction} className="form form--grid">
            <input type="hidden" name="slug" value={slug} />
            <div className="form__field">
              <label htmlFor="name">Duelist name</label>
              <input id="name" name="name" type="text" required />
            </div>
            <div className="form__field">
              <label htmlFor="deckName">Deck</label>
              <input id="deckName" name="deckName" type="text" required />
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
            <ul className="admin-list">
              {participants.map((p) => (
                <li className="admin-row panel" key={p.id}>
                  <div className="admin-row__main">
                    <span className="admin-row__title">{p.name}</span>
                    <span className="admin-row__meta">
                      {p.deckName} · {p.source === "public_signup" ? "Public signup" : "Added by admin"}
                    </span>
                    {isPaid ? (
                      <span className={`payment-status payment-status--${p.paymentStatus}`}>
                        {p.paymentStatus === "confirmed"
                          ? "Confirmed Entry"
                          : p.paymentStatus === "contested"
                            ? "Contested"
                            : "Payment pending"}
                        {p.paymentBy && p.paymentAt
                          ? ` · by ${p.paymentBy} · ${formatDate(p.paymentAt)} ${formatTime(p.paymentAt)}`
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
                    <DeleteButton
                      action={removeParticipantAction}
                      hidden={{ slug, participantId: p.id }}
                      confirmText={`Remove ${p.name} from this tournament?`}
                      label="Remove"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
