import Lede from "@/components/ui/Lede";
import Panel from "@/components/ui/Panel";
import Tab from "@/components/ui/Tab";
import { DISCORD_URL } from "@/lib/site";
import styles from "./Cta.module.css";

export default function Cta() {
  return (
    <Panel className={styles.cta}>
      <Tab>Join REDU community</Tab>
      <h2 className={styles.title}>Ready to play REDU Format?</h2>
      <Lede>
        Our platform hosts the biggest REDU Format tournaments and events, and
        our community of over 85,000 Discord members is as enthusiastic about
        REDU as it is about the TCG, Edison, Genesys and other formats. New
        and returning players are welcome, and you can choose between an
        automatic and a manual experience, all within Dueling Nexus.
      </Lede>
      <Lede>
        Discuss your favourite decks, strategies and tricks in our Discord,
        and join to catch the latest on events, tournaments, giveaways and
        collaborations.
      </Lede>
      <div className={styles.actions}>
        <a className="btn btn--solid" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
          Join our Discord
        </a>
      </div>
    </Panel>
  );
}
