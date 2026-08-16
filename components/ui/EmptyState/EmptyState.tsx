import type { ReactNode } from "react";
import Panel from "../Panel";

export default function EmptyState({ message, action }: { message: ReactNode; action?: ReactNode }) {
  return (
    <Panel className="empty">
      <p className="lede">{message}</p>
      {action}
    </Panel>
  );
}
