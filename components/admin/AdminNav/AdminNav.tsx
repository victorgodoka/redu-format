"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./AdminNav.module.css";

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 16 12" width="14" height="11" aria-hidden="true" focusable="false">
      <path
        d="M1 1h14v10H1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M1 1l7 5.5L15 1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/", label: "Home", target: "_blank" },
];

export default function AdminNav({
  displayName,
  username,
  unread,
}: {
  displayName: string;
  username: string;
  /** Unread alerts for this admin - drives the envelope beside the Inbox link. */
  unread: number;
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
          {LINKS.map(({ href, label, target }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                target={target ?? "_self"}
                className={styles.link}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
                {href === "/admin/inbox" && unread > 0 ? (
                  <span className={styles.alerts}>
                    <EnvelopeIcon />
                    <span className={styles.alertsCount}>{unread > 99 ? "99+" : unread}</span>
                    <span className={styles.srOnly}>unread alerts</span>
                  </span>
                ) : null}
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
