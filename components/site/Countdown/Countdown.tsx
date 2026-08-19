"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 1000);
  return () => clearInterval(timer);
}

function remaining(to: string, now: number): string {
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * A ticking clock for a deadline that lives on the server. The deadline is
 * the authority - this only renders it, so a paused tab, a wrong system
 * clock, or an edited DOM changes nothing about when the match actually
 * closes.
 *
 * Renders `fallback` (a plain absolute time) until it mounts, so the server
 * and the first client paint agree and there is no hydration mismatch.
 */
export default function Countdown({
  to,
  fallback,
  className,
  /** Below this many seconds the clock marks itself urgent, for styling. */
  urgentUnder = 300,
}: {
  to: string;
  fallback: string;
  className?: string;
  urgentUnder?: number;
}) {
  // A clock is an external source, not component state: subscribing to it is
  // what keeps this out of an effect-plus-setState loop. The server snapshot
  // is null, so the server and the first client paint both render `fallback`
  // and there is no hydration mismatch.
  const seconds = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000), () => null);

  if (seconds === null) {
    return <span className={className}>{fallback}</span>;
  }

  const now = seconds * 1000;
  const left = new Date(to).getTime() - now;
  const state = left <= 0 ? "over" : left < urgentUnder * 1000 ? "urgent" : "running";

  return (
    <span className={["countdown", className].filter(Boolean).join(" ")} data-state={state}>
      {left <= 0 ? "time's up" : remaining(to, now)}
    </span>
  );
}
