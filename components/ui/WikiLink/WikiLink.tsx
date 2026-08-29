import { NEXUS_WIKI_URL } from "@/lib/nexus-parse";
import type { ComponentPropsWithoutRef } from "react";

interface WikiLinkProps extends ComponentPropsWithoutRef<"a"> {
  cardName: string;
}

export const WikiLink = ({ cardName, children, ...rest }: WikiLinkProps) => {
  return <a href={`${NEXUS_WIKI_URL}/${cardName}`} target="_blank" {...rest}>
    {children}
  </a>
}
