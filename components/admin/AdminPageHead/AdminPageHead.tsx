import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./AdminPageHead.module.css";

export default function AdminPageHead({
  title,
  back,
  action,
}: {
  title: ReactNode;
  back?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <div className={styles.head}>
      <h1 className={styles.heading}>{title}</h1>
      {back ? (
        <Link className={styles.back} href={back.href}>
          {back.label}
        </Link>
      ) : null}
      {action ? <div className={styles.actions}>{action}</div> : null}
    </div>
  );
}
