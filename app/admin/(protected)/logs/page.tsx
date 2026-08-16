import type { Metadata } from "next";
import Link from "next/link";
import AdminPageHead from "@/components/admin/AdminPageHead";
import LogTable from "@/components/admin/LogTable";
import type { BadgeTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import Pager from "@/components/ui/Pager";
import Select from "@/components/ui/Select";
import {
  ADMIN_ACTIONS,
  listAuditActors,
  listAuditLog,
  type AdminAction,
  type AuditLogQuery,
} from "@/lib/audit-log";
import { formatDate, formatTime } from "@/lib/events";

export const metadata: Metadata = {
  title: "Admin logs | REDU Format",
  robots: { index: false, follow: false },
};

/**
 * Colours the raw action key by what it did, not by which resource it
 * touched. "unlink" is checked before "link": it ends with "link" too.
 */
function actionTone(action: AdminAction): BadgeTone {
  if (action === "payment.confirm") return "positive";
  if (action === "payment.contest") return "negative";
  if (
    action.endsWith("delete") ||
    action.endsWith("remove") ||
    action.endsWith("unlink") ||
    action.endsWith("drop")
  ) {
    return "negative";
  }
  if (
    action.endsWith("create") ||
    action.endsWith("add") ||
    action.endsWith("link")
  ) {
    return "positive";
  }
  if (action.endsWith("update")) return "neutral";
  return "muted";
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
  const raw = await searchParams;
  const pick = (key: string) =>
    Array.isArray(raw[key]) ? raw[key][0] : raw[key];

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
    <>
      <AdminPageHead title="Admin logs" />

      {/* GET form: filters live in the URL, so results are shareable and
          the page works with JavaScript disabled. */}
      <form className="filters panel" method="get">
        <div className="filters__field">
          <Label htmlFor="actor">Actor</Label>
          <Select id="actor" name="actor" defaultValue={query.actor ?? ""}>
            <option value="">All actors</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName} (@{a.username})
              </option>
            ))}
          </Select>
        </div>

        <div className="filters__field">
          <Label htmlFor="action">Action</Label>
          <Select id="action" name="action" defaultValue={query.action ?? ""}>
            <option value="">All actions</option>
            {ADMIN_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>

        <div className="filters__field">
          <Label htmlFor="target">Target</Label>
          <Input
            id="target"
            name="target"
            type="text"
            defaultValue={query.target ?? ""}
            placeholder="Tournament slug or id"
          />
        </div>

        <div className="filters__actions">
          <Button variant="solid" type="submit">
            Apply
          </Button>
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
        <EmptyState message="No admin actions recorded yet." />
      ) : (
        <LogTable
          entries={items.map((entry) => ({
            id: entry.id,
            time: `${formatDate(entry.at)} ${formatTime(entry.at)}`,
            action: entry.action,
            tone: actionTone(entry.action),
            actorDisplayName: entry.actorDisplayName,
            actorUsername: entry.actorUsername,
            actorId: entry.actorId,
            target: entry.target ?? "-",
            detail: entry.detail,
          }))}
        />
      )}

      <Pager page={page} pages={pages} hrefFor={(n) => pageHref(query, n)} />
    </>
  );
}
