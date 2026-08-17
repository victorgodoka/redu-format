/**
 * A payment proof link is rendered as a clickable href, so only http(s) is
 * trusted - shared between the admin confirm/contest actions and the
 * player-facing proof submission so both sides agree on what counts as safe.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
