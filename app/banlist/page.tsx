import type { Metadata } from "next";
import Image from "next/image";
import { banlist, CARD_IMAGE } from "@/lib/banlist";
import SiteHeader from "../site-header";

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

const total = banlist.reduce((sum, section) => sum + section.cards.length, 0);

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
                  deck share the same allowance.
                </p>
              </div>
              <nav className="banjump panel" aria-label="Banlist sections">
                {banlist.map((section) => (
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

        {banlist.map((section) => (
          <section className="section" id={section.slug} key={section.slug}>
            <div className="wrap">
              <p className="tab">{section.copies}</p>
              <h2 className="section__title">
                {section.label}{" "}
                <span className="section__count">({section.cards.length})</span>
              </h2>
              <p className="lede">{section.note}</p>

              <ul className="cards">
                {section.cards.map(([id, name]) => (
                  <li className="card" key={id}>
                    <a target="_blank" className="card__art" href={`https://duelingnexus.com/wiki/${name}`}>
                      <Image
                        src={`${CARD_IMAGE}/${id}.jpg`}
                        alt={name}
                        width={421}
                        height={614}
                        sizes="(max-width: 640px) 40vw, 180px"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
