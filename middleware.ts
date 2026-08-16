import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyAdminToken } from "@/lib/auth/session";

/**
 * One check here covers every page under the protected admin prefixes, plus
 * the Server Actions they post back to, instead of repeating
 * getAdminSession() in each page component. The (protected) layout also
 * checks the session for its own render, but middleware rejects unauthorized
 * requests before any page code runs.
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
  matcher: ["/admin/dashboard/:path*", "/admin/tournaments/:path*", "/admin/logs/:path*"],
};
