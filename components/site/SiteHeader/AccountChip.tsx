import Link from "next/link";
import FallbackImage from "@/components/ui/FallbackImage";
import styles from "./AccountChip.module.css";

export default function AccountChip({
  name,
  avatar,
  fallbackAvatar,
  contributor,
  unread,
}: {
  name: string;
  avatar: string;
  fallbackAvatar: string;
  contributor: boolean;
  /** Unread alerts for this player - the count sitting over the avatar. */
  unread: number;
}) {
  return (
    <span className={styles.chip}>
      <Link className={styles.account} href="/dashboard">
      {avatar ? (
        <FallbackImage
          key={avatar}
          className={styles.avatar}
          src={avatar}
          fallbackSrc={fallbackAvatar}
          alt=""
          width={32}
          height={32}
        />
      ) : (
        <span className={`${styles.avatar} ${styles.avatarEmpty}`} aria-hidden="true">
          {name.slice(0, 1)}
        </span>
      )}
      <span className={styles.name}>{name}</span>
      {contributor ? <span className={styles.badge}>Contributor</span> : null}
      </Link>

      {/* Its own link, not part of the account link: the count is the way into
          the inbox, while the chip itself still goes to the dashboard. */}
      {unread > 0 ? (
        <Link className={styles.alerts} href="/inbox">
          {unread > 99 ? "99+" : unread}
          <span className={styles.srOnly}> unread alerts</span>
        </Link>
      ) : null}
    </span>
  );
}
