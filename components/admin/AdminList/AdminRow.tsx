import type { ReactNode } from "react";

/**
 * `.admin-row`/`.admin-row__*` are shared with the public event page's match
 * history list (app/events/[slug]/page.tsx), so this wraps the existing
 * global classes rather than owning a CSS module. Defaults to `<li>` for use
 * inside an AdminList; pass `as="div"` for a standalone row (e.g. a single
 * status card) that isn't part of a list.
 */
function AdminRow({
  children,
  className,
  as = "li",
}: {
  children: ReactNode;
  className?: string;
  as?: "li" | "div";
}) {
  const Component = as;
  return (
    <Component className={["admin-row panel", className].filter(Boolean).join(" ")}>
      {children}
    </Component>
  );
}

function Main({ children }: { children: ReactNode }) {
  return <div className="admin-row__main">{children}</div>;
}

function Actions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["admin-row__actions", className].filter(Boolean).join(" ")}>{children}</div>;
}

AdminRow.Main = Main;
AdminRow.Actions = Actions;

export default AdminRow;
