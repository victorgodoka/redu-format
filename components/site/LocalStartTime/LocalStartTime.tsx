"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/**
 * An ISO instant formatted in whoever's looking's own browser timezone,
 * instead of the fixed UTC formatDate()/formatTime() everyone gets
 * server-side. Renders `fallback` (the UTC text) until mounted, so the server
 * and the first client paint agree and there is no hydration mismatch - same
 * trick Countdown.tsx uses for the same reason (an unchanging value, so the
 * "subscription" here never actually fires - it only exists to tell the
 * client-only render from the server/first-paint one).
 */
export default function LocalStartTime({ iso, fallback }: { iso: string; fallback: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!mounted) return <span>{fallback}</span>;

  const formatted = new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return <span>{`${formatted} (${zone})`}</span>;
}
