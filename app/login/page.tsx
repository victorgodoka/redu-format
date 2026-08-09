import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import SiteHeader from "../site-header";
import LoginForm from "./form";

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
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <main className="section" id="main">
        <div className="wrap">
          <div className="auth panel">
            <p className="tab">Account</p>
            <h1 className="auth__title">Sign in with Dueling Nexus</h1>
            {next !== "/dashboard" ? (
              <p className="lede">
                Sign in to finish signing up for the event.
              </p>
            ) : null}
            <LoginForm next={next} />
          </div>
        </div>
      </main>
    </>
  );
}
