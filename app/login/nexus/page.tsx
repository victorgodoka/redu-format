import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Footer from "@/components/site/Footer";
import LoginForm from "@/components/site/LoginForm";
import SiteHeader from "@/components/site/SiteHeader";
import Lede from "@/components/ui/Lede";
import Panel from "@/components/ui/Panel";
import Tab from "@/components/ui/Tab";
import Wrap from "@/components/ui/Wrap";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Link your Dueling Nexus account | REDU Format",
  robots: { index: false, follow: false },
};

/**
 * The second half of signing in. Discord says who you are; nothing behind the
 * sign-in works without a Nexus token, so this page is where a signed-in
 * player stays until they link one.
 */
export default async function LinkNexusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const next = safeNext(Array.isArray(raw.next) ? raw.next[0] : raw.next);

  const session = await getSession();
  if (session.token) redirect(next);
  if (!session.discord) redirect(`/login?next=${encodeURIComponent(next)}`);

  return (
    <>
      <SiteHeader />

      <main className="section" id="main">
        <Wrap>
          <Panel className="auth">
            <Tab>Account</Tab>
            <h1 className="auth__title">Link your Dueling Nexus account</h1>
            <Lede>
              Signed in as {session.discord.displayName}. Tournaments, decks, and your dashboard
              stay locked until a working Dueling Nexus token is linked to this account.
            </Lede>
            <LoginForm next={next} />
          </Panel>
        </Wrap>
      </main>

      <Footer />
    </>
  );
}
