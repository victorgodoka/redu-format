import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ADMIN_ACTIONS,
  listAuditActors,
  listAuditLog,
  type AdminAction,
  type AuditLogQuery,
} from "@/lib/audit-log";
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

/** Rebuilds the query string for a page link, keeping the active filters. */
function pageHref(query: AuditLogQuery, page: number) {
  const params = new URLSearchParams();
  if (query.actor) params.set("actor", query.actor);
  if (query.action) params.set("action", query.action);
  if (query.target) params.set("target", query.target);
  if (page > 1) params.set("page", String(page));

  const qs = params.toString();
  return qs ? `/admin/logs?${qs}` : "/admin/logs";
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  const raw = await searchParams;
  const pick = (key: string) => (Array.isArray(raw[key]) ? raw[key][0] : raw[key]);

  const query: AuditLogQuery = {
    actor: pick("actor"),
    action: pick("action"),
    target: pick("target"),
    page: pick("page"),
  };

  const [{ items, page, pages, total }, actors] = await Promise.all([
    listAuditLog(query),
    listAuditActors(),
  ]);

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

        {/* GET form: filters live in the URL, so results are shareable and
            the page works with JavaScript disabled. */}
        <form className="filters panel" method="get">
          <div className="filters__field">
            <label htmlFor="actor">Actor</label>
            <select id="actor" name="actor" defaultValue={query.actor ?? ""}>
              <option value="">All actors</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} (@{a.username})
                </option>
              ))}
            </select>
          </div>

          <div className="filters__field">
            <label htmlFor="action">Action</label>
            <select id="action" name="action" defaultValue={query.action ?? ""}>
              <option value="">All actions</option>
              {ADMIN_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="filters__field">
            <label htmlFor="target">Target</label>
            <input
              id="target"
              name="target"
              type="text"
              defaultValue={query.target ?? ""}
              placeholder="Tournament slug or id"
            />
          </div>

          <div className="filters__actions">
            <button className="btn btn--solid" type="submit">
              Apply
            </button>
            <Link className="filters__reset" href="/admin/logs">
              Reset
            </Link>
          </div>
        </form>

        <p className="filters__count" role="status">
          {total === 0
            ? "No admin actions match these filters."
            : `${total} ${total === 1 ? "entry" : "entries"} · page ${page} of ${pages}`}
        </p>

        {items.length === 0 ? (
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
            {items.map((entry) => (
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

        {pages > 1 ? (
          <nav className="pager" aria-label="Pagination">
            {page > 1 ? (
              <Link className="pager__step" href={pageHref(query, page - 1)}>
                Previous
              </Link>
            ) : (
              <span className="pager__step pager__step--off">Previous</span>
            )}

            <span className="pager__pages">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
                n === page ? (
                  <span
                    className="pager__num pager__num--on"
                    key={n}
                    aria-current="page"
                  >
                    {n}
                  </span>
                ) : (
                  <Link className="pager__num" key={n} href={pageHref(query, n)}>
                    {n}
                  </Link>
                ),
              )}
            </span>

            {page < pages ? (
              <Link className="pager__step" href={pageHref(query, page + 1)}>
                Next
              </Link>
            ) : (
              <span className="pager__step pager__step--off">Next</span>
            )}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
