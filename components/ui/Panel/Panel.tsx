import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export type PanelProps<T extends ElementType> = {
  as?: T;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

/** Wraps the chamfered `.panel` surface. Defaults to a `<div>`; pass `as` for `<dl>`, `<li>`, etc. */
export default function Panel<T extends ElementType = "div">({
  as,
  className,
  children,
  ...rest
}: PanelProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component className={["panel", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </Component>
  );
}
