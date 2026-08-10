import type { Metadata } from "next";
import { FORMAT_RULES, MASTER_RULES } from "@/lib/rulings";
import SiteHeader from "../site-header";

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
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <main id="main">
        <section className="section">
          <div className="wrap">
            <p className="tab">Rules</p>
            <h1 className="section__title">Rulings</h1>
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
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <h2 className="section__subtitle">Master Rule history</h2>
            <p className="lede">
              Where Master Rule 2 came from, and what each revision changed.
            </p>

            <ol className="mrules">
              {MASTER_RULES.map((rule) => (
                <li
                  className={`mrule panel${rule.current ? " mrule--current" : ""}`}
                  key={rule.name}
                >
                  <div className="mrule__head">
                    <h3 className="mrule__name">{rule.name}</h3>
                    {rule.current ? (
                      <span className="mrule__badge">This format</span>
                    ) : null}
                  </div>
                  <p className="mrule__when">
                    {rule.release} · {rule.date}
                  </p>

                  {rule.newTerms ? (
                    <div className="mrule__group">
                      <p className="mrule__group-title">New terminology</p>
                      <ul className="mrule__items">
                        {rule.newTerms.map((term) => (
                          <li key={term}>{term}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {rule.renamed ? (
                    <div className="mrule__group">
                      <p className="mrule__group-title">Renamed</p>
                      <ul className="mrule__items">
                        {rule.renamed.map(({ from, to }) => (
                          <li key={from}>
                            {from} <span className="mrule__arrow">→</span> {to}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {rule.changes ? (
                    <div className="mrule__group">
                      <p className="mrule__group-title">Rule changes</p>
                      <ul className="mrule__items">
                        {rule.changes.map((change) => (
                          <li key={change}>{change}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <h2 className="section__subtitle">Format-only rulings</h2>
            <p className="lede">
              Rulings specific to REDU Format, on top of Master Rule 2.
            </p>

            <ol className="rulings">
              {FORMAT_RULES.map((rule) => (
                <li className="ruling panel" key={rule.n}>
                  <p className="ruling__n">Rule {rule.n}</p>
                  <h3 className="ruling__title">{rule.title}</h3>
                  <p className="ruling__body">{rule.body}</p>

                  {rule.note ? <p className="ruling__note">{rule.note}</p> : null}

                  {rule.examples?.map((example) => (
                    <div className="ruling__example" key={example.text}>
                      {example.label ? (
                        <p className="ruling__example-label">{example.label}</p>
                      ) : null}
                      <p>{example.text}</p>
                    </div>
                  ))}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
    </>
  );
}
