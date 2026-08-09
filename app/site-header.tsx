import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth";

const nav = [
  { n: "01", label: "Home", href: "/" },
  { n: "02", label: "Banlist", href: "/banlist" },
  { n: "03", label: "Format", href: "/#format" },
  { n: "04", label: "Decks", href: "/#why" },
  { n: "05", label: "Community", href: "/#community" },
];

export default async function SiteHeader() {
  const session = await getSession();

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
          {session.name ? (
            <Link className="account" href="/dashboard">
              {session.avatar ? (
                <Image
                  className="account__avatar"
                  src={session.avatar}
                  alt=""
                  width={32}
                  height={32}
                />
              ) : (
                <span
                  className="account__avatar account__avatar--empty"
                  aria-hidden="true"
                >
                  {session.name.slice(0, 1)}
                </span>
              )}
              <span className="account__name">{session.name}</span>
              {session.contributor ? (
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
