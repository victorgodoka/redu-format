import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyAdminToken } from "@/lib/auth/session";

/**
 * Everything under /admin needs a valid session except the sign-in flow
 * itself, so the matcher takes the whole prefix and these four are let
 * through by name - a new protected admin page is then protected the moment
 * it exists, instead of the day someone remembers to extend a list.
 */
const PUBLIC_ADMIN_PATHS = new Set(["/admin", "/admin/login", "/admin/callback", "/admin/logout"]);

/**
 * One check here covers every page under /admin, plus the Server Actions they
 * post back to, instead of repeating getAdminSession() in each page component.
 * Rejected requests never reach page code, so no protected markup is rendered
 * before the session has been verified - direct URL, refresh, or back/forward
 * navigation alike.
 *
 * An expired or tampered token verifies to null exactly like a missing one,
 * so both land on the sign-in gate. Where they were headed rides along as
 * `next` so the gate can send them back there afterwards.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_ADMIN_PATHS.has(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminToken(token) : null;

  if (!session) {
    const gate = new URL("/admin", request.url);
    gate.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(gate);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
