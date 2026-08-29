import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./AdminPageHead.module.css";

export default function AdminPageHead({
  title,
  back,
  action,
  position,
}: {
  title?: ReactNode;
  position?: string;
  back?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <div className={styles.head}>
      {title && <h1 className={styles.heading}>{title}</h1>}
      {back ? (
        <Link className={styles.back} href={back.href}>
          {back.label}
        </Link>
      ) : null}
      {action ? <div data-position={position} className={styles.actions}>{action}</div> : null}
    </div>
  );
}
