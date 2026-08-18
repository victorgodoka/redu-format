import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminPageHead from "@/components/admin/AdminPageHead";
import Inbox from "@/components/site/Inbox";
import DeckMismatch, { readDeckMismatch } from "@/components/site/Inbox/DeckMismatch";
import { getAdminSession } from "@/lib/auth/session";
import { adminReader, listInbox, openMessage } from "@/lib/backend/services/notifications.service";

export const metadata: Metadata = {
  title: "Admin inbox | REDU Format",
  robots: { index: false, follow: false },
};

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  const raw = await searchParams;
  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id;
  const reader = adminReader(session.userId);

  // openMessage() runs first: it marks the message read, and the list rendered
  // afterwards has to reflect that or the row stays bold until the next reload.
  const selected = id ? await openMessage(reader, id) : null;
  const messages = await listInbox(reader);

  const payload = selected ? readDeckMismatch(selected.metadata) : null;

  return (
    <>
      <AdminPageHead title="Inbox" />

      <Inbox
        messages={messages}
        selected={selected}
        basePath="/admin/inbox"
        emptyMessage="Empty inbox"
      >
        {payload ? <DeckMismatch data={payload} /> : null}
      </Inbox>
    </>
  );
}
