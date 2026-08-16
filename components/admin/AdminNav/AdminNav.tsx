"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./AdminNav.module.css";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/logs", label: "Logs" },
];

export default function AdminNav({
  displayName,
  username,
}: {
  displayName: string;
  username: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls="admin-nav-panel"
        aria-label="Toggle admin menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.toggleBar} />
        <span className={styles.toggleBar} />
        <span className={styles.toggleBar} />
      </button>

      <div className={styles.panel} id="admin-nav-panel" data-open={open}>
        <nav className={styles.links} aria-label="Admin sections">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={styles.link}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.identity}>
          <p className={styles.name}>{displayName}</p>
          <p className={styles.handle}>@{username}</p>
          <form action="/admin/logout" method="post">
            <button className={styles.signOut} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
