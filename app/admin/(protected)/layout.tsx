import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminSession } from "@/lib/auth/session";
import { adminReader, countUnread } from "@/lib/backend/services/notifications.service";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  // Read state is per admin, so this count is this admin's - a global alert
  // another admin already opened is still unread here.
  const unread = await countUnread(adminReader(session.userId));

  return (
    <AdminShell displayName={session.displayName} username={session.username} unread={unread}>
      {children}
    </AdminShell>
  );
}
