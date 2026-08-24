import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Footer from "@/components/site/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import Button from "@/components/ui/Button";
import Lede from "@/components/ui/Lede";
import Panel from "@/components/ui/Panel";
import Tab from "@/components/ui/Tab";
import Wrap from "@/components/ui/Wrap";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Sign in | REDU Format",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const next = safeNext(Array.isArray(raw.next) ? raw.next[0] : raw.next);

  const session = await getSession();
  if (session.token) redirect(next);
  // Signed in with Discord but no Nexus account behind it yet - that is the
  // only thing still missing, so go straight to asking for it.
  if (session.discord) redirect(`/login/nexus?next=${encodeURIComponent(next)}`);

  return (
    <>
      <SiteHeader />

      <main className="section" id="main">
        <Wrap>
          <Panel className="auth">
            <Tab>Account</Tab>
            <h1 className="auth__title">Sign in with Discord</h1>
            {next !== "/dashboard" ? <Lede>Sign in to finish signing up for the event.</Lede> : null}
            <Lede>
              Any Discord account works - there is no server or role to join first. You will be
              asked for your Dueling Nexus token afterwards, which is what unlocks tournaments,
              decks, and your dashboard.
            </Lede>
            {raw.error ? (
              <p role="alert" className="form__error">
                Discord sign-in did not go through. Try again.
              </p>
            ) : null}
            <Button variant="solid" href={`/login/discord?next=${encodeURIComponent(next)}`}>
              Continue with Discord
            </Button>
          </Panel>
        </Wrap>
      </main>

      <Footer />
    </>
  );
}
