import type { Metadata } from "next";
import { Chakra_Petch, Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

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
  metadataBase: new URL(SITE_URL),
  title: "REDU Format | Retro Yu-Gi-Oh! Wind-Up Format",
  description:
    "The Zexal-era retro Yu-Gi-Oh! format set in October 2012, on the September 2012 banlist with a card pool up to Return of the Duelist. Play it on Dueling Nexus.",
  keywords: [
    "REDU format",
    "Wind-Up format",
    "retro Yu-Gi-Oh",
    "September 2012 format",
    "Return of the Duelist",
  ],
  alternates: { canonical: "/" },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "REDU Format",
    title: "REDU Format | Retro Yu-Gi-Oh! Wind-Up Format",
    description:
      "Retro Yu-Gi-Oh! on the September 2012 banlist and the Return of the Duelist card pool.",
    // Shallow-merges into every page's own openGraph block as the fallback
    // preview image, unless that page sets its own `images`.
    images: ["/android-chrome-512x512.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable}`}
    >
      {/* Extensions mutate <body> before hydration (e.g. adding a "vc-init"
          class). This only relaxes the check on body's own attributes; real
          mismatches inside the tree still surface. */}
      <body suppressHydrationWarning>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
