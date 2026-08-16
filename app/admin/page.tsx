import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminGate from "@/components/admin/AdminGate";
import { getAdminSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin | REDU Format",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin/dashboard");

  return <AdminGate />;
}
