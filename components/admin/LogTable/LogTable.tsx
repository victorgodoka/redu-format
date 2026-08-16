import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Panel from "@/components/ui/Panel";
import styles from "./LogTable.module.css";

export type LogEntry = {
  id: string | number;
  time: string;
  action: string;
  tone: BadgeTone;
  actorDisplayName: string;
  actorUsername: string;
  actorId: string | number;
  target: string;
  detail: string;
};

export default function LogTable({ entries }: { entries: LogEntry[] }) {
  return (
    <Panel className={styles.log}>
      <div className={`${styles.line} ${styles.lineHead}`}>
        <span>Time / Action</span>
        <span>Actor</span>
        <span>Target</span>
        <span>Detail</span>
      </div>
      {entries.map((entry) => (
        <div className={styles.line} key={entry.id}>
          <div className={styles.group}>
            <span className={styles.time}>{entry.time}</span>
            <Badge tone={entry.tone}>{entry.action}</Badge>
          </div>
          <div className={styles.actor}>
            <span className={styles.actorName}>{entry.actorDisplayName}</span>
            <span>(@{entry.actorUsername})</span>
            <span>ID: {entry.actorId}</span>
          </div>
          <span className={styles.target}>{entry.target}</span>
          <span className={styles.detail}>{entry.detail}</span>
        </div>
      ))}
    </Panel>
  );
}
