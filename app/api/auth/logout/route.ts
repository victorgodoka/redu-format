import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * Clearing a session writes a cookie, which a Server Component render is not
 * allowed to do. Pages that discover a dead session redirect here instead.
 *
 * Never link to this with <Link>: prefetching would sign the user out. The
 * visible sign-out control is a POST server action for that reason.
 */
export async function GET(request: Request) {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL("/login", request.url));
}
