import type { Metadata } from "next";
import { Chakra_Petch, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face only: squared terminals carry the retro-tech tone the body text should not.
const display = Chakra_Petch({
  variable: "--font-display",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://reduformat.com"),
  title: "REDU Format | Retro Yu-Gi-Oh! Wind-Up Format",
  description:
    "REDU Format is retro Yu-Gi-Oh! on the September 2012 banlist and the Return of the Duelist card pool. Wind-Up, Dark World, Chaos Dragon and more.",
  keywords: [
    "REDU format",
    "Wind-Up format",
    "retro Yu-Gi-Oh",
    "September 2012 format",
    "Return of the Duelist",
  ],
  alternates: { canonical: "/" },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "REDU Format",
    title: "REDU Format | Retro Yu-Gi-Oh! Wind-Up Format",
    description:
      "Retro Yu-Gi-Oh! on the September 2012 banlist and the Return of the Duelist card pool.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
