import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import DeckPicker from "@/components/site/DeckPicker";
import EventBanner from "@/components/site/EventBanner";
import Footer from "@/components/site/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import Button from "@/components/ui/Button";
import FactsList from "@/components/ui/FactsList";
import FallbackImage from "@/components/ui/FallbackImage";
import Lede from "@/components/ui/Lede";
import Notice from "@/components/ui/Notice";
import PageHeading from "@/components/ui/PageHeading";
import Tab from "@/components/ui/Tab";
import Wrap from "@/components/ui/Wrap";
import { fetchProfile, getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import { findMySignup } from "@/lib/backend/services/registration.service";
import { hasBracket } from "@/lib/backend/services/results.service";
import { Card } from "@/lib/cards";
import { formatDate, formatEntry, formatTime, isFinished, isPast, seatsLeft, STRUCTURES } from "@/lib/events";
import { DEFAULT_AVATAR } from "@/lib/nexus-parse";
import { getTournament } from "@/lib/tournaments";
import { validateDecks } from "@/lib/validateDecks";
import { cancel, submitProof } from "./actions";

export const metadata: Metadata = {
  title: "Event sign up | REDU Format",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getTournament(slug);
  if (!event) notFound();

  const session = await getSession();
  // Bounce through login, then come straight back to this signup.
  if (!session.token) {
    redirect(`/login?next=${encodeURIComponent(`/events/${slug}/signup`)}`);
  }

  const profile = await fetchProfile(session.token);
  if (!profile) redirect("/api/auth/logout");

  const validDecklists = validateDecks(profile.deckLists);
  // Cover art can point at an errata id; the original passcode is what the
  // fallback image retries if that specific print was never mirrored.
  const coverFallbackIds = Object.fromEntries(
    profile.decks
      .filter((deck) => deck.coverId !== null)
      .map((deck) => [deck.id, new Card(deck.coverId!).id]),
  );

  const now = new Date();
  const past = isPast(event, now);
  const finished = isFinished(event);
  const left = seatsLeft(event);
  const playerId = await findPlayerIdByToken(session.token);
  const signup = playerId ? await findMySignup(slug, playerId) : null;
  const registeredDeck = profile.decks.find((d) => d.id === signup?.deckId);
  const started = await hasBracket(slug);

  return (
    <>
      <SiteHeader />

      <main className="section" id="main">
        <Wrap>
          <PageHeading tab="Sign up" title={event.name} />
          <EventBanner event={event} />

          <div className="signup">
            <div className="signup__main">
              {past ? (
                <Notice>
                  <Lede>
                    {finished
                      ? `This event finished on ${formatDate(event.startsAt)}. Registration is closed.`
                      : "This tournament has already started. Registration is closed."}
                  </Lede>
                  <Button href="/events">Back to events</Button>
                </Notice>
              ) : left === 0 && !registeredDeck ? (
                <Notice>
                  <Lede>
                    Every seat is taken. Keep an eye on the event page in case
                    one opens up.
                  </Lede>
                  <Button href="/events">Back to events</Button>
                </Notice>
              ) : registeredDeck ? (
                <Notice variant="done">
                  <Tab>Registered</Tab>
                  <h2 className="notice__title">You are in with {registeredDeck.name}</h2>
                  <Lede>
                    {registeredDeck.main} main · {registeredDeck.extra} extra ·{" "}
                    {registeredDeck.side} side. Bring it to{" "}
                    {formatDate(event.startsAt)} at {formatTime(event.startsAt)}.
                  </Lede>
                  {started ? (
                    <details className="notice__drop">
                      <summary className="btn">Drop from tournament</summary>
                      <div className="notice__drop-body">
                        <Lede>
                          Dropping counts as a loss and negatively affects the tiebreakers of
                          the players still in it.
                          {event.entry.type === "paid" ? " There is no refund." : ""}
                        </Lede>
                        <form action={cancel}>
                          <input type="hidden" name="slug" value={slug} />
                          <Button variant="solid" type="submit">
                            Yes, drop me
                          </Button>
                        </form>
                      </div>
                    </details>
                  ) : signup?.paymentStatus === "confirmed" ? (
                    <Lede>
                      Your payment is already confirmed. Contact a Staff member if you need to
                      drop before the event starts.
                    </Lede>
                  ) : event.entry.type === "paid" ? (
                    <>
                      <Lede>
                        {signup?.paymentStatus === "contested"
                          ? "Staff contested your last payment proof - submit a new one below."
                          : `Payment pending (${formatEntry(event.entry)}). Submit a proof link once you've paid; a Staff member will confirm it.`}
                      </Lede>
                      {signup?.proofUrl ? (
                        <p className="payment-status">
                          Last submitted:{" "}
                          <a href={signup.proofUrl} target="_blank" rel="noopener noreferrer">
                            view proof
                          </a>
                        </p>
                      ) : null}
                      <form action={submitProof} className="form">
                        <input type="hidden" name="slug" value={slug} />
                        <label htmlFor="proofUrl">Payment proof URL</label>
                        <input id="proofUrl" name="proofUrl" type="url" placeholder="https://..." required />
                        <Button variant="solid" type="submit">
                          Submit proof
                        </Button>
                      </form>
                      <div className="notice__actions">
                        <form action={cancel}>
                          <input type="hidden" name="slug" value={slug} />
                          <Button variant="quiet" type="submit">
                            Cancel registration
                          </Button>
                        </form>
                      </div>
                    </>
                  ) : (
                    <div className="notice__actions">
                      <form action={cancel}>
                        <input type="hidden" name="slug" value={slug} />
                        <Button type="submit">Cancel registration</Button>
                      </form>
                      <Button variant="quiet" href="/events">
                        Back to events
                      </Button>
                    </div>
                  )}

                  {started ? null : (
                    <details className="notice__drop">
                      <summary className="btn">Change deck</summary>
                      <div className="notice__drop-body">
                        <DeckPicker
                          slug={slug}
                          decks={profile.decks}
                          deckLists={validDecklists}
                          coverFallbackIds={coverFallbackIds}
                          selectedDeckId={registeredDeck.id}
                          submitLabel="Save deck"
                        />
                      </div>
                    </details>
                  )}
                </Notice>
              ) : profile.decks.length === 0 ? (
                <Notice>
                  <Lede>
                    You have no decks on Dueling Nexus yet. Build one in the
                    editor, then come back to register.
                  </Lede>
                  <a
                    className="btn"
                    href="https://duelingnexus.com/editor"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open the editor
                  </a>
                </Notice>
              ) : (
                <DeckPicker
                  slug={slug}
                  decks={profile.decks}
                  deckLists={validDecklists}
                  coverFallbackIds={coverFallbackIds}
                />
              )}
            </div>

            <aside className="signup__side">
              <div className="profile-card panel">
                <Tab>Duelist</Tab>
                <div className="profile-card__who">
                  {profile.avatar ? (
                    <FallbackImage
                      key={profile.avatar}
                      className="profile__avatar"
                      src={profile.avatar}
                      fallbackSrc={DEFAULT_AVATAR}
                      alt=""
                      width={56}
                      height={56}
                    />
                  ) : null}
                  <div>
                    <p className="profile-card__name">{profile.name}</p>
                    <p className="profile-card__meta">
                      {profile.decks.length}{" "}
                      {profile.decks.length === 1 ? "deck" : "decks"}
                      {/* {profile.contributor ? " · Contributor" : ""} */}
                    </p>
                  </div>
                </div>
              </div>

              <FactsList
                rows={[
                  { label: "Starts", value: `${formatDate(event.startsAt)}, ${formatTime(event.startsAt)}` },
                  { label: "Structure", value: STRUCTURES[event.structure].label },
                  event.structure === "double-elim"
                    ? { label: "Format", value: `${event.matchFormat} · ${event.roundLimitDays}-day deadline` }
                    : {
                        label: "Rounds",
                        value: `${event.rounds} · ${event.matchFormat} · ${event.roundLimitDays}-day round deadline${
                          event.topCut ? ` · Top ${event.topCut}` : ""
                        }`,
                      },
                  {
                    label: "Seats",
                    value:
                      event.seats === null
                        ? `${event.taken} registered (unlimited)`
                        : past
                          ? `${event.taken} of ${event.seats} duelists`
                          : `${left} of ${event.seats} left`,
                  },
                  { label: "Host", value: `${event.host} · ${formatEntry(event.entry)}` },
                ]}
              />
            </aside>
          </div>
        </Wrap>
      </main>

      <Footer />
    </>
  );
}
