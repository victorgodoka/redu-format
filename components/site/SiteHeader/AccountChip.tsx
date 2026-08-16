import Link from "next/link";
import FallbackImage from "@/components/ui/FallbackImage";
import styles from "./AccountChip.module.css";

export default function AccountChip({
  name,
  avatar,
  fallbackAvatar,
  contributor,
}: {
  name: string;
  avatar: string;
  fallbackAvatar: string;
  contributor: boolean;
}) {
  return (
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
  );
}
