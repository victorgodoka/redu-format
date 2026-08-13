import Image from "next/image";
import Link from "next/link";
import { fetchProfile, getSession } from "@/lib/auth";

const nav = [
  { n: "01", label: "Home", href: "/" },
  { n: "02", label: "Events", href: "/events" },
  { n: "03", label: "Leaderboard", href: "/leaderboard" },
  { n: "04", label: "Banlist", href: "/banlist" },
  { n: "05", label: "Rulings", href: "/rulings" },
  { n: "06", label: "Decklists", href: "/events/ycs-providence-2012#decklists" },
  { n: "07", label: "Format", href: "/#format" },
  { n: "08", label: "Community", href: "/#community" },
];

export default async function SiteHeader() {
  const session = await getSession();

  /**
   * Nexus rotates the avatar URL whenever the picture changes, so the copy
   * saved at login goes stale and 404s. Read the live profile instead; it is
   * cached for a minute per token, and the session values stay as a fallback
   * for when the upstream call fails.
   */
  const profile = session.token ? await fetchProfile(session.token) : null;

  const account = session.name
    ? {
        name: profile?.name ?? session.name,
        avatar: profile?.avatar ?? session.avatar ?? "",
        contributor: profile?.contributor ?? session.contributor ?? false,
      }
    : null;

  return (
    <div className="wrap">
      <header className="topbar">
        <Link className="topbar__mark" href="/">
          REDU
        </Link>

        <nav className="topbar__nav" aria-label="Main">
          {nav.map(({ n, label, href }) => (
            <Link key={href} className="topbar__link" data-n={n} href={href}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="topbar__auth">
          {account ? (
            <Link className="account" href="/dashboard">
              {account.avatar ? (
                <Image
                  className="account__avatar"
                  src={account.avatar}
                  alt=""
                  width={32}
                  height={32}
                />
              ) : (
                <span
                  className="account__avatar account__avatar--empty"
                  aria-hidden="true"
                >
                  {account.name.slice(0, 1)}
                </span>
              )}
              <span className="account__name">{account.name}</span>
              {account.contributor ? (
                <span className="account__badge">Contributor</span>
              ) : null}
            </Link>
          ) : (
            <Link className="topbar__link topbar__link-sign-in" href="/login">
              Sign in
            </Link>
          )}
        </div>
      </header>
    </div>
  );
}
