import type { Metadata } from "next";
import { BANLIST_IDS } from "@/lib/banlist";
import { Card } from "@/lib/cards";
import SiteHeader from "../site-header";
import CardBrowser, { type BrowserSection } from "./card-browser";

export const metadata: Metadata = {
  title: "REDU Format banlist | September 2012 Forbidden & Limited List",
  description:
    "The full September 2012 banlist for REDU Format: every forbidden, limited and semi-limited card, plus what came off the list.",
  alternates: { canonical: "/banlist" },
  openGraph: {
    type: "website",
    url: "/banlist",
    siteName: "REDU Format",
    title: "REDU Format banlist | September 2012 Forbidden & Limited List",
    description:
      "Every forbidden, limited and semi-limited card in REDU Format, with the cards that came off the list.",
  },
};

/** Wording shown in the preview panel for each section. */
const LEGALITY: Record<string, string> = {
  forbidden: "Forbidden",
  limited: "Limited to 1",
  "semi-limited": "Semi-Limited to 2",
  unrestricted: "Unlimited",
};

// Resolved on the server: CARD_LIB is 1.4MB and must never reach the browser.
const sections: BrowserSection[] = BANLIST_IDS.map((section) => ({
  slug: section.slug,
  label: section.label,
  copies: section.copies,
  note: section.note,
  legality: LEGALITY[section.slug] ?? section.label,
  cards: section.cards.map(([id]) => new Card(id).toJSON()),
}));

const total = sections.reduce((sum, section) => sum + section.cards.length, 0);

export default function BanlistPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <main id="main">
        <section className="section">
          <div className="wrap">
            <p className="tab">Forbidden &amp; Limited</p>
            <h1 className="section__title">REDU Format banlist</h1>
            <div className="section__split">
              <div className="prose">
                <p>
                  REDU Format runs the September 2012 Forbidden &amp; Limited
                  List, the same one duelists played at YCS Providence that
                  October. {total} cards carry a restriction.
                </p>
                <p>
                  Counts are per deck total: your main deck, extra deck and side
                  deck share the same allowance. Errata&rsquo;d cards are shown
                  with their original printing and wording, which is what this
                  format plays.
                </p>
              </div>
              <nav className="banjump panel" aria-label="Banlist sections">
                {sections.map((section) => (
                  <a
                    className="banjump__item"
                    key={section.slug}
                    href={`#${section.slug}`}
                  >
                    <span>{section.label}</span>
                    <b>{section.cards.length}</b>
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </section>

        <div className="wrap">
          <CardBrowser sections={sections} />
        </div>
      </main>
    </>
  );
}
