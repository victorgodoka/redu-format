import Link from "next/link";
import Lede from "@/components/ui/Lede";
import Panel from "@/components/ui/Panel";
import Wrap from "@/components/ui/Wrap";
import { DISCORD_URL } from "@/lib/site";
import styles from "./Hero.module.css";
import Image from "next/image";

export default function Hero() {
  return (
    <Wrap>
      <Panel as="section" className={styles.hero}>
        <Image
          alt="REDU Formato Lettering Logo"
          src="/lettering_redu.png"
          width={942}
          height={419}
          className={styles.logo}
          priority
        />
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
