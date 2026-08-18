import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminGate from "@/components/admin/AdminGate";
import { getAdminSession } from "@/lib/auth/session";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Admin | REDU Format",
  robots: { index: false, follow: false },
};

/**
 * The sign-in gate, and where the middleware sends anyone without a valid
 * session. `next` is where they were actually headed - carried through the
 * Discord round trip so they land there instead of on the dashboard, and run
 * through safeNext so it can only ever be a path on this origin.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next, "/admin/dashboard");

  const session = await getAdminSession();
  if (session) redirect(destination);

  return <AdminGate next={destination === "/admin/dashboard" ? undefined : destination} />;
}
