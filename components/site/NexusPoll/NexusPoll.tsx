"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The client half of "periodically verify unresolved tournament duels while
 * this page is open" - the server half (the 5-minute fetch cache/lock, which
 * duel actually get replay-checked) all lives in
 * duel-verification.service.ts. This component only decides *when* to ask;
 * every actual decision about whether that ask reaches Dueling Nexus is made
 * server-side, so overlapping tabs/users polling the same tournament never
 * cause more than one call every five minutes.
 *
 * `action` is a server action - passed by reference, called with `args` on
 * each tick. Skips firing while the tab isn't visible, since nobody's here to
 * see the result anyway.
 */
export default function NexusPoll<Args extends unknown[]>({
  intervalMs,
  action,
  args,
}: {
  intervalMs: number;
  action: (...args: Args) => Promise<void>;
  args: Args;
}) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void action(...args).then(() => router.refresh());
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return null;
}
