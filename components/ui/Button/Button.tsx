import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import clsx from "clsx";

export type Variant = "default" | "solid" | "danger" | "quiet";

const variantClass = {
  solid: "btn--solid",
  danger: "btn--danger",
  quiet: "btn--quiet",
  default: ""
}

type LinkProps = ComponentPropsWithoutRef<typeof Link>;

type ButtonAsLink = {
  href: LinkProps["href"];
  variant?: Variant;
  className?: string;
  children: ReactNode;
} & Omit<LinkProps, "href" | "className" | "children">;

type ButtonAsButton = {
  href?: undefined;
  variant?: Variant;
  className?: string;
  children: ReactNode;
  /** Disables the button and swaps its label to `pendingLabel` while a form action is in flight. */
  pending?: boolean;
  pendingLabel?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"button">, "className" | "children">;

export type ButtonProps = ButtonAsLink | ButtonAsButton;

/** Renders as a `<Link>` styled like a button when `href` is given, otherwise a native `<button>`. */
export default function Button(props: ButtonProps) {
  const variant: Variant = props.variant ?? "default"

  if (props.href !== undefined) {
    const { href, className, children, ...rest } = props;
    return (
      <Link href={href} className={clsx("btn", variantClass[variant], className)} {...rest}>
        {children}
      </Link>
    );
  }

  const { className, children, pending, pendingLabel, disabled, ...rest } = props;
  return (
    <button className={clsx("btn", variantClass[variant], className)} disabled={disabled ?? pending} {...rest}>
      {pending && pendingLabel !== undefined ? pendingLabel : children}
    </button>
  );
}
