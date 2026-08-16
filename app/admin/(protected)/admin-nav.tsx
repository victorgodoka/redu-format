"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
        className="admin-nav__toggle"
        aria-expanded={open}
        aria-controls="admin-nav-panel"
        aria-label="Toggle admin menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="admin-nav__toggle-bar" />
        <span className="admin-nav__toggle-bar" />
        <span className="admin-nav__toggle-bar" />
      </button>

      <div className="admin-nav__panel" id="admin-nav-panel" data-open={open}>
        <nav className="admin-nav__links" aria-label="Admin sections">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className="admin-nav__link"
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="admin-nav__identity">
          <p className="admin-nav__name">{displayName}</p>
          <p className="admin-nav__handle">@{username}</p>
          <form action="/admin/logout" method="post">
            <button className="admin-nav__signout" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
