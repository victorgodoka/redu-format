import Cta from "@/components/site/Cta";
import Footer from "@/components/site/Footer";
import Hero from "@/components/site/Hero";
import SiteHeader from "@/components/site/SiteHeader";
import FactsList from "@/components/ui/FactsList";
import PageHeading from "@/components/ui/PageHeading";
import Wrap from "@/components/ui/Wrap";

const facts = [
  { k: "Card pool", v: "Up to Return of the Duelist" },
  { k: "Banlist", v: "Sep. 2012 TCG" },
  { k: "Reference event", v: "YCS Providence Oct 2012" },
  { k: "Era", v: "Zexal" },
  { k: "Diverse meta", v: "Lot of different strategies to play" },
];

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
    a: "On Dueling Nexus, with both automatic and manual dueling. REDU is also a Konami-supported Time Wizard format, so sanctioned events run in OTS stores and at YCS events.",
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

      <SiteHeader />

      <Hero />

      <main id="main">
        <section className="section" id="format">
          <Wrap>
            <PageHeading tab="The format" title="What is REDU Format?" level="h2" />
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
              <FactsList rows={facts.map((f) => ({ label: f.k, value: f.v }))} />
            </div>
          </Wrap>
        </section>

        <section className="section" id="why">
          <Wrap>
            <PageHeading tab="Why play REDU" title="Why play REDU Format?" level="h2" />
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
          </Wrap>
        </section>

        <section className="section" id="community">
          <Wrap>
            <Cta />
          </Wrap>
        </section>
      </main>

      <Footer />
    </>
  );
}
