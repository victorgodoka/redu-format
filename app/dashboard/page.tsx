import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { fetchProfile, getSession } from "@/lib/auth";
import { CARD_ART } from "@/lib/banlist";
import { logout } from "../login/actions";
import SiteHeader from "../site-header";

export const metadata: Metadata = {
  title: "Your decks | REDU Format",
  robots: { index: false, follow: false },
};

const EDITOR = "https://duelingnexus.com/editor";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.token) redirect("/login");

  // A revoked token fails here rather than at login. Hand off to the logout
  // route, which is allowed to clear the cookie; clearing it during this render
  // would throw, and leaving it would bounce between /login and /dashboard.
  const profile = await fetchProfile(session.token);
  if (!profile) redirect("/api/auth/logout");

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <main className="section" id="main">
        <div className="wrap">
          <p className="tab">Your account</p>

          <div className="profile">
            {profile.avatar ? (
              <Image
                className="profile__avatar"
                src={profile.avatar}
                alt=""
                width={72}
                height={72}
              />
            ) : null}
            <div>
              <h1 className="profile__name">{profile.name}</h1>
              <p className="profile__meta">
                {profile.decks.length}{" "}
                {profile.decks.length === 1 ? "deck" : "decks"} on Dueling Nexus
                {profile.contributor ? " · Contributor" : ""}
              </p>
            </div>
            <form action={logout} className="profile__out">
              <button className="btn" type="submit">
                Sign out
              </button>
            </form>
          </div>

          {profile.decks.length === 0 ? (
            <div className="empty panel">
              <p className="lede">
                No decks on this account yet. Build one in the Dueling Nexus
                editor and it will show up here.
              </p>
              <a
                className="btn"
                href={EDITOR}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open the editor
              </a>
            </div>
          ) : (
            <ul className="decklist">
              {profile.decks.map((deck) => (
                <li className="deck panel" key={deck.id}>
                  <a
                    className="deck__link"
                    href={`${EDITOR}/${deck.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="deck__cover">
                      {deck.coverId ? (
                        <Image
                          src={`${CARD_ART}/${deck.coverId}.jpg`}
                          alt=""
                          width={200}
                          height={200}
                          sizes="200px"
                        />
                      ) : null}
                    </span>
                    <span className="deck__body">
                      <span className="deck__name">{deck.name}</span>
                      <span className="deck__counts">
                        <span>
                          <b>{deck.main}</b> main
                        </span>
                        <span>
                          <b>{deck.extra}</b> extra
                        </span>
                        <span>
                          <b>{deck.side}</b> side
                        </span>
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
