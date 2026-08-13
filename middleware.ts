import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyAdminToken } from "@/lib/auth/session";

/**
 * Tournament CRUD (list, create, edit, delete, participants) has no other
 * gate: the pages were built before Discord admin auth existed. One check
 * here covers every current and future page under the prefix, plus the
 * Server Actions they post back to, instead of repeating getAdminSession()
 * in each page component.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminToken(token) : null;

  if (!session) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/tournaments/:path*", "/admin/logs/:path*"],
};
