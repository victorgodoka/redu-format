import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import AdminNav from "./admin-nav";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <p className="admin-nav__brand">Admin</p>
        <AdminNav displayName={session.displayName} username={session.username} />
      </aside>

      <main className="admin-shell__main" id="main">
        <div className="admin-shell__content wrap">{children}</div>
      </main>
    </div>
  );
}
