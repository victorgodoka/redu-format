import type { ReactNode } from "react";
import AdminNav from "../AdminNav";
import styles from "./AdminShell.module.css";

export default function AdminShell({
  displayName,
  username,
  unread,
  children,
}: {
  displayName: string;
  username: string;
  unread: number;
  children: ReactNode;
}) {
  return (
    <div className={`${styles.shell} admin-shell`}>
      <aside className={styles.rail}>
        <p className={styles.brand}>Admin</p>
        <AdminNav displayName={displayName} username={username} unread={unread} />
      </aside>

      <main className={styles.main} id="main">
        <div className={`${styles.content} wrap`}>{children}</div>
      </main>
    </div>
  );
}
