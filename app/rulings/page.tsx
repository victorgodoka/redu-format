import type { Metadata } from "next";
import FormatRulingsList from "@/components/site/FormatRulingsList";
import Footer from "@/components/site/Footer";
import MasterRuleHistory from "@/components/site/MasterRuleHistory";
import SiteHeader from "@/components/site/SiteHeader";
import Lede from "@/components/ui/Lede";
import PageHeading from "@/components/ui/PageHeading";
import Wrap from "@/components/ui/Wrap";

export const metadata: Metadata = {
  title: "REDU Format rulings | Master Rule 2 and format rules",
  description:
    "REDU Format plays under Master Rule 2, with no Ignition Effect Priority. The full rules reference, plus the format-only rulings.",
  alternates: { canonical: "/rulings" },
  openGraph: {
    type: "website",
    url: "/rulings",
    siteName: "REDU Format",
    title: "REDU Format rulings | Master Rule 2 and format rules",
    description:
      "The rules REDU Format runs on: Master Rule 2, no Ignition Effect Priority, and six format-only rulings.",
  },
};

export default function RulingsPage() {
  return (
    <>
      <SiteHeader />

      <main id="main">
        <section className="section">
          <Wrap>
            <PageHeading tab="Rules" title="Rulings" />
            <div className="prose">
              <p>
                REDU Format is played under <b>Master Rule 2</b>, the rule set in
                effect when Return of the Duelist was legal. Xyz Monsters exist,
                Pendulum and Link mechanics do not, and the Extra Monster Zone
                was still years away.
              </p>
              <p>
                The consequence duelists notice first is Priority. Master Rule 2
                removed Ignition Effect Priority, so summoning a monster no
                longer protects its effect: your opponent answers the Summon
                before you get to use it.
              </p>
            </div>
          </Wrap>
        </section>

        <section className="section">
          <Wrap>
            <h2 className="section__subtitle">Master Rule history</h2>
            <Lede>Where Master Rule 2 came from, and what each revision changed.</Lede>

            <MasterRuleHistory />
          </Wrap>
        </section>

        <section className="section">
          <Wrap>
            <h2 className="section__subtitle">Format-only rulings</h2>
            <Lede>Rulings specific to REDU Format, on top of Master Rule 2.</Lede>

            <FormatRulingsList />
          </Wrap>
        </section>
      </main>

      <Footer />
    </>
  );
}
