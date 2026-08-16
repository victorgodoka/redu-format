import type { ReactNode } from "react";
import AdminNav from "../AdminNav";
import styles from "./AdminShell.module.css";

export default function AdminShell({
  displayName,
  username,
  children,
}: {
  displayName: string;
  username: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <p className={styles.brand}>Admin</p>
        <AdminNav displayName={displayName} username={username} />
      </aside>

      <main className={styles.main} id="main">
        <div className={`${styles.content} wrap`}>{children}</div>
      </main>
    </div>
  );
}
