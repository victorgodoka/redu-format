"use client";

import { useEffect } from "react";
import { destroySessionAndRedirect } from "@/app/login/actions";
import styles from "./SessionExpiredRedirect.module.css";

/**
 * Rendered by SiteHeader once it discovers the session cookie's Nexus token
 * no longer works (fetchProfile returned null - SiteHeader already makes
 * that call on every page, so this adds no extra Nexus request). A fullscreen
 * spinner for a beat, so the transition reads as "signing you out", not a
 * layout glitch, then the session is torn down and the player lands on
 * /login to authenticate again.
 */
export default function SessionExpiredRedirect() {
  useEffect(() => {
    const timer = setTimeout(() => {
      void destroySessionAndRedirect();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.message}>Your session expired - signing you out</p>
    </div>
  );
}
