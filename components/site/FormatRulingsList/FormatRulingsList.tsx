import Panel from "@/components/ui/Panel";
import { FORMAT_RULES } from "@/lib/rulings";
import styles from "./FormatRulingsList.module.css";

export default function FormatRulingsList() {
  return (
    <ol className={styles.rulings}>
      {FORMAT_RULES.map((rule) => (
        <Panel as="li" className={styles.ruling} key={rule.n}>
          <p className={styles.n}>Rule {rule.n}</p>
          <h3 className={styles.title}>{rule.title}</h3>
          <p className={styles.body}>{rule.body}</p>

          {rule.note ? <p className={styles.note}>{rule.note}</p> : null}

          {rule.examples?.map((example) => (
            <div className={styles.example} key={example.text}>
              {example.label ? <p className={styles.exampleLabel}>{example.label}</p> : null}
              <p>{example.text}</p>
            </div>
          ))}
        </Panel>
      ))}
    </ol>
  );
}
