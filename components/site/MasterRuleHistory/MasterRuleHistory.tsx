import Panel from "@/components/ui/Panel";
import { MASTER_RULES } from "@/lib/rulings";
import styles from "./MasterRuleHistory.module.css";

export default function MasterRuleHistory() {
  return (
    <ol className={styles.mrules}>
      {MASTER_RULES.map((rule) => (
        <Panel
          as="li"
          className={`${styles.mrule}${rule.current ? ` ${styles.mruleCurrent}` : ""}`}
          key={rule.name}
        >
          <div className={styles.head}>
            <h3 className={styles.name}>{rule.name}</h3>
            {rule.current ? <span className={styles.badge}>This format</span> : null}
          </div>
          <p className={styles.when}>
            {rule.release} · {rule.date}
          </p>

          {rule.newTerms ? (
            <div className={styles.group}>
              <p className={styles.groupTitle}>New terminology</p>
              <ul className={styles.items}>
                {rule.newTerms.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {rule.renamed ? (
            <div className={styles.group}>
              <p className={styles.groupTitle}>Renamed</p>
              <ul className={styles.items}>
                {rule.renamed.map(({ from, to }) => (
                  <li key={from}>
                    {from} <span className={styles.arrow}>→</span> {to}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {rule.changes ? (
            <div className={styles.group}>
              <p className={styles.groupTitle}>Rule changes</p>
              <ul className={styles.items}>
                {rule.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      ))}
    </ol>
  );
}
