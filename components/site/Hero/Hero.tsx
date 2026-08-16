import Link from "next/link";
import Lede from "@/components/ui/Lede";
import Panel from "@/components/ui/Panel";
import Wrap from "@/components/ui/Wrap";
import { DISCORD_URL } from "@/lib/site";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <Wrap>
      <Panel as="section" className={styles.hero}>
        <h1 className={styles.title}>
          REDU
          <span>Format</span>
        </h1>
        <Lede>
          Explore the Zexal-era retro format set in October 2012, with a card
          pool that extends up to the Return of the Duelist set, exclusively
          on Dueling Nexus.
        </Lede>
        <div className={styles.actions}>
          <a className="btn btn--solid" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
            Start dueling today
          </a>
          <Link className="btn" href="/events">
            View the latest events
          </Link>
        </div>
      </Panel>
    </Wrap>
  );
}
