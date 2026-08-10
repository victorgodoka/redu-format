import Link from "next/link";
import SiteHeader from "./site-header";

const DISCORD = "https://discord.gg/duelingnexus";

const facts = [
  { k: "Card pool", v: "Up to Return of the Duelist" },
  { k: "Banlist", v: "Sep. 2012 TCG" },
  { k: "Reference event", v: "YCS Providence Oct 2012" },
  { k: "Era", v: "Zexal" },
  { k: "Diverse meta", v: "Lot of different strategies to play" },
];

  // const decks = [
  //   { name: "Wind-Up", note: "Namesake" },
  //   { name: "Agent", note: "Swarm" },
  //   { name: "Geargia", note: "Gear Gigant X" },
  //   { name: "Chaos Dragon", note: "Grind" },
  //   { name: "Dino Rabbit", note: "Laggia / Dolkka" },
  //   { name: "Dark World", note: "Punishes discard" },
  //   { name: "Hero Beat", note: "Toolbox" },
  // ];

const faq = [
  {
    q: "What is REDU Format?",
    a: "REDU Format is a retro Yu-Gi-Oh! format that revisits YCS Providence of October 20, 2012. It runs the September 2012 TCG banlist with a card pool extending up to the Return of the Duelist core set.",
  },
  {
    q: "Why is it called REDU Format?",
    a: "It is named after Return of the Duelist, the newest legal core set, which introduced the Heroic Challenger, Madolche, Prophecy and Elemental Lord archetypes. It is also called Wind-Up Format because of how strongly that archetype shows up.",
  },
  {
    q: "Which decks are competitive in REDU Format?",
    a: "Wind-Up, Agent, Geargia, Chaos Dragon, Dino Rabbit, Dark World and Hero Beat all compete. YCS Providence saw six different decks in its top 8.",
  },
  {
    q: "Where can I play REDU Format?",
    a: "On Dueling Nexus, with both automatic and manual duelling. REDU is also a Konami-supported Time Wizard format, so sanctioned events run in OTS stores and at YCS events.",
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
          {/* <p className="hero__kicker">
            <span>Welcome to</span>
            <span>September 2012 banlist</span>
            <span>Zexal era</span>
          </p> */}
          <h1 className="hero__title">
            REDU
            <span>Format</span>
          </h1>
          <p className="lede">
            Explore the Zexal-era retro format set in October 2012, with a card
            pool that extends up to the Return of the Duelist set, exclusively
            on Dueling Nexus.
          </p>
          <div className="hero__actions">
            <a
              className="btn btn--solid"
              href={DISCORD}
              target="_blank"
              rel="noopener noreferrer"
            >
              Start duelling today
            </a>
            <Link className="btn" href="/events">
              View the latest events
            </Link>
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
                  REDU Format is a retro format that revisits the gameplay of
                  YCS Providence on October 20, 2012. The format features an
                  expansive card pool and a diverse meta, with decks such as
                  Wind-Up, Agent, Geargia, Chaos Dragon and Dino Rabbit all
                  competing for dominance.
                </p>
                <p>
                  It takes its name from the Return of the Duelist core set,
                  which introduced the Heroic Challenger, Madolche, Prophecy and
                  Elemental Lord archetypes. Players also call it Wind-Up Format
                  because of how strongly that archetype shows up.
                </p>
                <p>
                  The September 2012 TCG banlist restricted the Wind-Up loop and
                  the Inzektor loop, and hit powerful cards such as Brionac,
                  Dragon of the Ice Barrier, Future Fusion, Chaos Sorcerer and
                  Red-Eyes Darkness Metal Dragon, all of which proved too
                  oppressive in the previous format. Those changes and the new
                  releases made the format flexible: YCS Providence put six
                  different decks in its top 8, and none of them was the
                  previously all-encompassing Wind-Up.
                </p>
                <p>
                  The format&rsquo;s diversity, its resilience and its community
                  make it a pillar of the Yu-Gi-Oh! retro format scene. We hope
                  you will be part of it.
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
            <h2 className="section__title">Why play REDU Format?</h2>
            <div className="prose">
              <p>
                With the October 2012 card pool and the September 2012 banlist,
                you get a variety of Synchro and Xyz toolbox cards, strong
                engines, and legal power cards such as Dark Hole, Heavy Storm
                and Maxx &ldquo;C&rdquo;.
              </p>
              <p>
                REDU is also a Konami-supported Time Wizard format, so
                officially sanctioned REDU events take place in OTS stores and
                at YCS events.
              </p>
            </div>
            {/* <ul className="rows">
              {decks.map(({ name, note }) => (
                <li className="rows__item" key={name}>
                  <span className="rows__name">{name}</span>
                  <span className="rows__note">{note}</span>
                </li>
              ))}
            </ul> */}
          </div>
        </section>

        <section className="section" id="community">
          <div className="wrap">
            <div className="cta panel">
              <p className="tab">Join REDU community</p>
              <h2 className="cta__title">Ready to play REDU Format?</h2>
              <p className="lede">
                Our platform hosts the biggest REDU Format tournaments and
                events, and our community of over 85,000 Discord members is as
                enthusiastic about REDU as it is about the TCG, Edison, Genesys
                and other formats. New and returning players are welcome, and
                you can choose between an automatic and a manual experience,
                all within Dueling Nexus.
              </p>
              <p className="lede">
                Discuss your favourite decks, strategies and tricks in our
                Discord, and join to catch the latest on events, tournaments,
                giveaways and collaborations.
              </p>
              <div className="cta__actions">
                <a
                  className="btn btn--solid"
                  href={DISCORD}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join our Discord
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
              <Link href="/banlist">Banlist</Link>
              <a href={'https://duelingnexus.com/home'} target="_blank" rel="noopener noreferrer">
                Dueling Nexus
              </a>
              <a href={DISCORD} target="_blank" rel="noopener noreferrer">
                Discord
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
