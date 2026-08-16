import type { ElementType, ReactNode } from "react";
import Lede from "../Lede";
import Tab from "../Tab";

export default function PageHeading({
  tab,
  title,
  lede,
  action,
  level = "h1",
}: {
  tab?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  /** Renders alongside the heading in a space-between row, e.g. a save button. */
  action?: ReactNode;
  level?: "h1" | "h2";
}) {
  const Heading = level as ElementType;
  const heading = <Heading className="section__title">{title}</Heading>;

  return (
    <>
      {tab ? <Tab>{tab}</Tab> : null}
      {action ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {heading}
          {action}
        </div>
      ) : (
        heading
      )}
      {lede ? <Lede>{lede}</Lede> : null}
    </>
  );
}
