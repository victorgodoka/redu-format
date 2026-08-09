import Link from "next/link";
import SiteHeader from "./site-header";

const DISCORD = "https://discord.gg/reduformat";
const EVENT_SIGNUP = DISCORD; // TODO: point at the actual signup page

const facts = [
  { k: "Banlist", v: "September 2012" },
  { k: "Newest legal set", v: "Return of the Duelist, 28 Aug 2012" },
  { k: "Reference event", v: "YCS Providence, October 2012" },
  { k: "New archetype", v: "Geargia" },
  { k: "Era", v: "Zexal" },
];

const decks = [
  { name: "Wind-Up", note: "Deck to beat" },
  { name: "Chaos Dragon", note: "Grind" },
  { name: "Dark World", note: "Punishes discard" },
  { name: "Dino Rabbit", note: "Laggia / Dolkka" },
  { name: "Hero Beat", note: "Toolbox" },
  { name: "Agent", note: "Swarm" },
  { name: "Geargia", note: "Gear Gigant X" },
];

const faq = [
  {
    q: "What is REDU Format?",
    a: "REDU Format is a retro Yu-Gi-Oh! format played on the September 2012 Forbidden & Limited List, with Return of the Duelist as the newest legal core set. Players also call it Wind-Up Format after the deck that came out of that banlist.",
  },
  {
    q: "What banlist does REDU Format use?",
    a: "The September 2012 Forbidden & Limited List, the same one duelists played at YCS Providence in October 2012.",
  },
  {
    q: "Which decks are competitive in REDU Format?",
    a: "Wind-Up, Chaos Dragon, Dark World, Dino Rabbit, Hero Beat, Agent and Geargia all put up results.",
  },
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map(({ q, a }) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          }),
        }}
      />

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <div className="wrap">
        <section className="hero panel">
          <p className="hero__kicker">
            <span>September 2012 banlist</span>
            <span>YCS Providence</span>
            <span>Zexal era</span>
          </p>
          <h1 className="hero__title">
            REDU
            <span>Format</span>
          </h1>
          <p className="lede">
            Retro Yu-Gi-Oh! frozen at Return of the Duelist. Wind-Up is the deck
            to beat. Six other decks beat it on a given weekend.
          </p>
          <div className="hero__actions">
            <a className="btn btn--solid" href={EVENT_SIGNUP}>
              Latest event
            </a>
            <a className="btn" href="#community">
              Join the Discord
            </a>
          </div>
        </section>
      </div>

      <main id="main">
        <section className="section" id="format">
          <div className="wrap">
            <p className="tab">The format</p>
            <h2 className="section__title">What is REDU Format?</h2>
            <div className="section__split">
              <div className="prose">
                <p>
                  Players call it REDU Format because Return of the Duelist is
                  the newest core set you can play. Konami put out REDU on
                  August 28, 2012 with 100 cards, and it handed the format
                  Geargia: Geargiarmor, Geargiaccelerator, Geargiarsenal,
                  Geargiano Mk-II and Gear Gigant X.
                </p>
                <p>
                  The format runs the September 2012 banlist and rebuilds the
                  card pool duelists brought to YCS Providence that October.
                  Wind-Up came out of that list without the hand loop and kept
                  the consistency, which is where the other name comes from.
                </p>
                <p>
                  You get a Zexal-era board with Xyz monsters on top of a card
                  pool that still runs Heavy Storm, Dark Hole and Monster
                  Reborn.
                </p>
              </div>
              <dl className="facts panel">
                {facts.map(({ k, v }) => (
                  <div className="facts__row" key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="section" id="why">
          <div className="wrap">
            <p className="tab">Why play REDU</p>
            <h2 className="section__title">
              A wide metagame and cards that answer things.
            </h2>
            <div className="prose">
              <p>
                Heavy Storm, Dark Hole and Monster Reborn are all legal, so a
                bad opening hand does not end the duel on turn two. You draw out
                of it and punish the board your opponent built.
              </p>
              <p>
                No single deck folds the room. Pick one and learn the mirror.
              </p>
            </div>
            <ul className="rows">
              {decks.map(({ name, note }) => (
                <li className="rows__item" key={name}>
                  <span className="rows__name">{name}</span>
                  <span className="rows__note">{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" id="community">
          <div className="wrap">
            <div className="cta panel">
              <p className="tab">Join REDU community</p>
              <h2 className="cta__title">Duelists run this format on Discord.</h2>
              <p className="lede">
                Our Discord runs frequent tournaments, deck talk and rulings
                threads. If you have never played the format, say so when you
                join and someone will hand you a starting list.
              </p>
              <div className="cta__actions">
                <a
                  className="btn btn--solid"
                  href={DISCORD}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  discord.gg/reduformat
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <div className="site-footer__inner panel">
            <p>REDU Format</p>
            <div className="site-footer__links">
              <Link href="/login">Sign in</Link>
              <Link href="/banlist">Banlist</Link>
              <a href={DISCORD} target="_blank" rel="noopener noreferrer">
                Discord
              </a>
              <a href="#format">Format</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
