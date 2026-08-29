import Image from "next/image";
import Link from "next/link";
import Panel from "@/components/ui/Panel";
import Wrap from "@/components/ui/Wrap";
import { DISCORD_URL } from "@/lib/site";
import styles from "./Footer.module.css";
import { NEXUS_URL } from "@/lib/nexus-parse";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <Wrap>
        <Panel className={styles.inner}>
          <p className={styles.brand}>
            <Image src="/logo-icon.png" alt="" width={20} height={20} />
            REDU Format
          </p>
          <div className={styles.links}>
            <Link href="/banlist">Banlist</Link>
            <a href={NEXUS_URL} target="_blank" rel="noopener noreferrer">
              Dueling Nexus
            </a>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
              Discord
            </a>
          </div>
        </Panel>
      </Wrap>
    </footer>
  );
}
