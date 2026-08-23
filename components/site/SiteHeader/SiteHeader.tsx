import Image from "next/image";
import Link from "next/link";
import SkipLink from "@/components/ui/SkipLink";
import Wrap from "@/components/ui/Wrap";
import { fetchProfile, getSession } from "@/lib/auth";
import { FEATURED_EVENT } from "@/lib/events";
import { enforcePlayerDecks } from "@/lib/backend/services/deck-watch.service";
import { countUnread, playerReader } from "@/lib/backend/services/notifications.service";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import { DEFAULT_AVATAR } from "@/lib/nexus-parse";
import SessionExpiredRedirect from "@/components/site/SessionExpiredRedirect";
import AccountChip from "./AccountChip";
import styles from "./SiteHeader.module.css";

const nav = [
  { n: "01", label: "Home", href: "/" },
  { n: "02", label: "Events", href: "/events" },
  { n: "03", label: "Hall of Fame", href: `/events/${FEATURED_EVENT.slug}#decklists` },
  { n: "04", label: "Leaderboard", href: "/leaderboard" },
  { n: "05", label: "Banlist", href: "/banlist" },
  { n: "06", label: "Rulings", href: "/rulings" },
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

  // No player row yet (a session from before they ever registered) simply
  // means nothing has been addressed to them.
  const playerId = session.token ? await findPlayerIdByToken(session.token) : null;

  /**
   * The header renders on every page, which makes it the "every visit" hook
   * for the deck lock: any tournament this player has running is re-checked
   * against Dueling Nexus (throttled to once per 30 minutes per registration,
   * see enforcePlayerDecks) and a changed deck is disqualified on the spot.
   * Best-effort - a failed upstream read must never take the site down.
   */
  if (playerId) await enforcePlayerDecks(playerId).catch(() => 0);

  const unread = playerId ? await countUnread(playerReader(playerId)) : 0;

  const account = session.name
    ? {
        name: profile?.name ?? session.name,
        avatar: profile?.avatar ?? session.avatar ?? "",
        contributor: profile?.contributor ?? session.contributor ?? false,
      }
    : null;

  // A token that no longer works - revoked, or the account was deleted - is
  // caught right here, since this is the one fetchProfile() call every page
  // already makes. Nothing else about this render changes; the overlay is
  // what actually signs the player out, a couple seconds from now.
  const sessionInvalid = Boolean(session.token) && profile === null;

  return (
    <>
      {sessionInvalid ? <SessionExpiredRedirect /> : null}
      <SkipLink />
      <Wrap>
        <header className={styles.topbar}>
          <Link className={styles.mark} href="/">
            <Image src="/logo-icon.png" alt="" width={36} height={36} className={styles.markIcon} priority />
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
                unread={unread}
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
