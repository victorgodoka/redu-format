import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Footer from "@/components/site/Footer";
import Inbox from "@/components/site/Inbox";
import DeckMismatch, { readDeckMismatch } from "@/components/site/Inbox/DeckMismatch";
import SiteHeader from "@/components/site/SiteHeader";
import PageHeading from "@/components/ui/PageHeading";
import Wrap from "@/components/ui/Wrap";
import { getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import { listInbox, openMessage, playerReader } from "@/lib/backend/services/notifications.service";

export const metadata: Metadata = {
  title: "Inbox | REDU Format",
  robots: { index: false, follow: false },
};

export default async function PlayerInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session.token) redirect("/login?next=/inbox");

  const playerId = await findPlayerIdByToken(session.token);
  if (!playerId) redirect("/dashboard");

  const raw = await searchParams;
  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id;
  const reader = playerReader(playerId);

  const selected = id ? await openMessage(reader, id) : null;
  const messages = await listInbox(reader);

  const payload = selected ? readDeckMismatch(selected.metadata) : null;

  return (
    <>
      <SiteHeader />
      <Wrap>
        <main id="main">
          <PageHeading title="Inbox" />

          <Inbox
            messages={messages}
            selected={selected}
            basePath="/inbox"
            emptyMessage="Nothing to read yet."
          >
            {payload ? <DeckMismatch data={payload} /> : null}
          </Inbox>
        </main>
      </Wrap>
      <Footer />
    </>
  );
}
