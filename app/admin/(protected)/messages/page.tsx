import type { Metadata } from "next";
import AdminPageHead from "@/components/admin/AdminPageHead";
import MessageForm from "@/components/admin/MessageForm";
import { listPlayerNames } from "@/lib/backend/services/player.service";
import { listTournaments } from "@/lib/tournaments";
import { sendMessageAction } from "./actions";

export const metadata: Metadata = {
  title: "Messages | REDU Format",
  robots: { index: false, follow: false },
};

export default async function AdminMessagesPage() {
  const [tournaments, playerNames] = await Promise.all([listTournaments(), listPlayerNames()]);

  return (
    <>
      <AdminPageHead
        title="Messages"
        back={{ href: "/admin/dashboard", label: "← Back to dashboard" }}
      />

      <MessageForm
        action={sendMessageAction}
        tournaments={tournaments.map((t) => ({ slug: t.slug, name: t.name }))}
        playerNames={playerNames}
      />
    </>
  );
}
