import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournament, listParticipants } from "@/lib/tournaments";
import SiteHeader from "../../../../site-header";
import DeleteButton from "../../../delete-button";
import { addParticipantAction, removeParticipantAction } from "./actions";

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

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

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
                    <span className="admin-row__meta">{p.deckName}</span>
                  </div>
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
