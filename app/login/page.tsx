import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/site/LoginForm";
import Footer from "@/components/site/Footer";
import SiteHeader from "@/components/site/SiteHeader";
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

  return (
    <>
      <SiteHeader />

      <main className="section" id="main">
        <Wrap>
          <Panel className="auth">
            <Tab>Account</Tab>
            <h1 className="auth__title">Sign in with Dueling Nexus</h1>
            {next !== "/dashboard" ? <Lede>Sign in to finish signing up for the event.</Lede> : null}
            <LoginForm next={next} />
          </Panel>
        </Wrap>
      </main>

      <Footer />
    </>
  );
}
