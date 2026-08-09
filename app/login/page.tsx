import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logout } from "./actions";
import LoginForm from "./form";

export const metadata: Metadata = {
  title: "Sign in | REDU Format",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await getSession();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="wrap">
        <header className="topbar">
          <Link className="topbar__mark" href="/">
            REDU
          </Link>
          <nav className="topbar__nav" aria-label="Main">
            <Link className="topbar__link" data-n="01" href="/">
              Back to site
            </Link>
          </nav>
        </header>
      </div>

      <main className="section" id="main">
        <div className="wrap">
          <div className="auth panel">
            <p className="tab">Account</p>
            {session.name ? (
              <>
                <h1 className="auth__title">Signed in as {session.name}</h1>
                <p className="lede">
                  {session.contributor
                    ? `Contributor: ${session.contributor}`
                    : "Your Dueling Nexus profile is linked."}
                </p>
                <form action={logout} className="form">
                  <button className="btn" type="submit">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 className="auth__title">Sign in with Dueling Nexus</h1>
                <LoginForm />
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
