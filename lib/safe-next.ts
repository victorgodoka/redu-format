/**
 * Validates a post-login return path.
 *
 * The value arrives from the query string, so it is attacker controlled: a bare
 * redirect to it would let anyone send `?next=https://evil.example` and bounce a
 * freshly authenticated user off-site. Only same-origin absolute paths pass.
 */
export function safeNext(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;

  const path = value.trim();
  if (path.length === 0 || path.length > 512) return fallback;

  // Must be a path on this origin.
  if (!path.startsWith("/")) return fallback;
  // "//host" and "/\host" are protocol-relative and leave the origin.
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  // Backslashes and control characters get normalised inconsistently by browsers.
  if (path.includes("\\")) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(path)) return fallback;

  return path;
}
