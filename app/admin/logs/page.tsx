import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listAuditLog, type AdminAction } from "@/lib/audit-log";
import { getAdminSession } from "@/lib/auth/session";
import { formatDate, formatTime } from "@/lib/events";

export const metadata: Metadata = {
  title: "Admin logs | REDU Format",
  robots: { index: false, follow: false },
};

/**
 * Colours the raw action key by what it did, not by which resource it
 * touched. "unlink" is checked before "link": it ends with "link" too.
 */
function actionTone(action: AdminAction): "create" | "update" | "delete" | "system" {
  if (action === "payment.confirm") return "create";
  if (action === "payment.contest") return "delete";
  if (action.endsWith("delete") || action.endsWith("remove") || action.endsWith("unlink")) {
    return "delete";
  }
  if (action.endsWith("create") || action.endsWith("add") || action.endsWith("link")) {
    return "create";
  }
  if (action.endsWith("update")) return "update";
  return "system";
}

export default async function AdminLogsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  const entries = await listAuditLog();

  return (
    <main className="section" id="main">
      <div className="wrap">
        <div className="admin-bar">
          <p className="tab">Admin</p>
          <div className="admin-identity">
            <span>
              Signed in as {session.displayName} (@{session.username})
            </span>
            <Link className="admin-identity__link" href="/admin/dashboard">
              Admin home
            </Link>
            <Link className="admin-identity__link" href="/admin/tournaments">
              Manage tournaments
            </Link>
            <form action="/admin/logout" method="post">
              <button
                className="admin-identity__link admin-identity__signout"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="admin-bar">
          <h1 className="section__title">Admin logs</h1>
        </div>

        <p className="lede">
          Every action taken from the admin panel, most recent first. Kept for
          this process only: {entries.length} entries.
        </p>

        {entries.length === 0 ? (
          <div className="empty panel">
            <p className="lede">No admin actions recorded yet.</p>
          </div>
        ) : (
          <div className="log panel">
            <div className="log__line log__line--head">
              <span>Time</span>
              <span>Action</span>
              <span>Actor</span>
              <span>Target</span>
              <span>Detail</span>
            </div>
            {entries.map((entry) => (
              <div className="log__line" key={entry.id}>
                <span className="log__time">
                  {formatDate(entry.at)} {formatTime(entry.at)}
                </span>
                <span className={`log__action log__action--${actionTone(entry.action)}`}>
                  {entry.action}
                </span>
                <span className="log__actor">
                  {entry.actorDisplayName} (@{entry.actorUsername}) [
                  {entry.actorId}]
                </span>
                <span className="log__target">{entry.target ?? "-"}</span>
                <span className="log__detail">{entry.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
