import type { ReactNode } from "react";

export default function AdminList({
  children,
  as = "ul",
  className,
}: {
  children: ReactNode;
  as?: "ul" | "ol";
  className?: string;
}) {
  const Component = as;
  return <Component className={["admin-list", className].filter(Boolean).join(" ")}>{children}</Component>;
}
