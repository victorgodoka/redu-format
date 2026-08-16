import Link from "next/link";
import SkipLink from "@/components/ui/SkipLink";
import Wrap from "@/components/ui/Wrap";
import { fetchProfile, getSession } from "@/lib/auth";
import { DEFAULT_AVATAR } from "@/lib/nexus-parse";
import AccountChip from "./AccountChip";
import styles from "./SiteHeader.module.css";

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
    <>
      <SkipLink />
      <Wrap>
        <header className={styles.topbar}>
          <Link className={styles.mark} href="/">
            REDU
          </Link>

          <nav className={styles.nav} aria-label="Main">
            {nav.map(({ n, label, href }) => (
              <Link key={href} className={styles.link} data-n={n} href={href}>
                {label}
              </Link>
            ))}
          </nav>

          <div className={styles.auth}>
            {account ? (
              <AccountChip
                name={account.name}
                avatar={account.avatar}
                fallbackAvatar={DEFAULT_AVATAR}
                contributor={account.contributor}
              />
            ) : (
              <Link className={`${styles.link} ${styles.linkSignIn}`} href="/login">
                Sign in
              </Link>
            )}
          </div>
        </header>
      </Wrap>
    </>
  );
}
