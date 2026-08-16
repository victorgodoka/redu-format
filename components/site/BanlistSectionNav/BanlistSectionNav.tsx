import Panel from "@/components/ui/Panel";
import styles from "./BanlistSectionNav.module.css";

export default function BanlistSectionNav({
  sections,
}: {
  sections: { slug: string; label: string; count: number }[];
}) {
  return (
    <Panel as="nav" className={styles.banjump} aria-label="Banlist sections">
      {sections.map((section) => (
        <a className={styles.item} key={section.slug} href={`#${section.slug}`}>
          <span>{section.label}</span>
          <b>{section.count}</b>
        </a>
      ))}
    </Panel>
  );
}
