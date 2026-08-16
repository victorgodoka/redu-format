import { NextResponse } from "next/server";
import { recordAction } from "@/lib/audit-log";
import { destroyAdminSession, getAdminSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const session = await getAdminSession();
  await destroyAdminSession();

  // if (session) {
  //   await recordAction({
  //     actorId: session.userId,
  //     actorUsername: session.username,
  //     actorDisplayName: session.displayName,
  //     action: "admin.logout",
  //     detail: "Signed out",
  //   });
  // }

  return NextResponse.redirect(
    new URL("/admin", request.url),
  );
}
