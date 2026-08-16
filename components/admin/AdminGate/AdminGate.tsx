import Panel from "@/components/ui/Panel";
import styles from "./AdminGate.module.css";

/**
 * The pre-auth gateway has no shell nav to sit inside (there's no session yet
 * to show identity for), so it's centered as its own full-height screen. The
 * Discord continue link is a plain `<a>`, not `next/link` - Link prefetches
 * on hover/viewport, which would hit `/admin/login` (and its OAuth redirect)
 * before the user actually clicks.
 */
export default function AdminGate() {
  return (
    <main className={styles.gate} id="main">
      <p className={styles.mark}>REDU Format</p>
      <Panel className={`${styles.panel} auth`}>
        <p className="tab">Admin</p>
        <h1 className="auth__title">Sign in with Discord</h1>
        <p className="lede">
          Tournament administration is restricted to REDU Format moderators.
          Sign in with the Discord account that holds that role.
        </p>
        <a className="btn btn--solid" href="/admin/login">
          Continue with Discord
        </a>
      </Panel>
    </main>
  );
}
