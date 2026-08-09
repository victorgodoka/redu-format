import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SiteHeader from "../site-header";
import LoginForm from "./form";

export const metadata: Metadata = {
  title: "Sign in | REDU Format",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await getSession();
  if (session.token) redirect("/dashboard");

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
            <LoginForm />
          </div>
        </div>
      </main>
    </>
  );
}
