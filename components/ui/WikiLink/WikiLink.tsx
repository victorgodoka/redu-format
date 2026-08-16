import type { ComponentPropsWithoutRef } from "react";

interface WikiLinkProps extends ComponentPropsWithoutRef<"a"> {
  cardName: string;
}

export const WikiLink = ({ cardName, children, ...rest }: WikiLinkProps) => {
  return <a href={`https://duelingnexus.com/wiki/${cardName}`} target="_blank" {...rest}>
    {children}
  </a>
}
