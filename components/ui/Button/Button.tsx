import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "default" | "solid" | "danger" | "quiet";

function variantClass(variant?: Variant): string {
  switch (variant) {
    case "solid":
      return "btn--solid";
    case "danger":
      return "btn--danger";
    case "quiet":
      return "btn--quiet";
    default:
      return "";
  }
}

function classNames(variant: Variant | undefined, className: string | undefined): string {
  return ["btn", variantClass(variant), className].filter(Boolean).join(" ");
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
  if (props.href !== undefined) {
    const { href, variant, className, children, ...rest } = props;
    return (
      <Link href={href} className={classNames(variant, className)} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant, className, children, pending, pendingLabel, disabled, ...rest } = props;
  return (
    <button className={classNames(variant, className)} disabled={disabled ?? pending} {...rest}>
      {pending && pendingLabel !== undefined ? pendingLabel : children}
    </button>
  );
}
