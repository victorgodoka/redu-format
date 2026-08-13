import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin | REDU Format",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin/dashboard");

  return (
      <main className="section" id="main">
        <div className="wrap">
          <div className="auth panel">
            <p className="tab">Admin</p>
            <h1 className="auth__title">Sign in with Discord</h1>
            <p className="lede">
              Tournament administration is restricted to REDU Format
              moderators. Sign in with the Discord account that holds that
              role.
            </p>
            <a className="btn btn--solid" href="/admin/login">
              Continue with Discord
            </a>
          </div>
        </div>
      </main>
  );
}
