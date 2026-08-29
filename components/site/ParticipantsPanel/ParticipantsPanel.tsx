import AdminList, { AdminRow } from "@/components/admin/AdminList";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import type { ParticipantStatus, PublicParticipant } from "@/lib/tournaments";

const LABEL: Record<ParticipantStatus, { text: string; tone: BadgeTone }> = {
  registered: { text: "Registered", tone: "neutral" },
  active: { text: "Still in", tone: "positive" },
  eliminated: { text: "Eliminated", tone: "muted" },
  dropped: { text: "Dropped", tone: "muted" },
  disqualified: { text: "Disqualified", tone: "negative" },
};

/** Registered first, then still-in players, then everyone who is out - the order the list is actually read in. */
const ORDER: ParticipantStatus[] = ["active", "registered", "eliminated", "dropped", "disqualified"];

/**
 * Who is signed up, and where they stand - the participant list a Challonge
 * bracket page carries. Identity and tournament standing only: no payment
 * state, no deck ids, nothing that is staff's business alone.
 */
export default function ParticipantsPanel({
  participants,
}: {
  participants: PublicParticipant[];
}) {
  if (participants.length === 0) {
    return <EmptyState message="Nobody has registered for this tournament yet." />;
  }

  const sorted = [...participants].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.name.localeCompare(b.name),
  );

  return (
    <AdminList className="participants">
      {sorted.map((p) => (
        <AdminRow key={p.id}>
          <AdminRow.Main>
            <span className="admin-row__title">{p.name}</span>
            {p.status === "disqualified" && p.reason ? (
              <span className="admin-row__meta">{p.reason}</span>
            ) : null}
          </AdminRow.Main>
          <AdminRow.Actions>
            <Badge tone={LABEL[p.status].tone}>{LABEL[p.status].text}</Badge>
          </AdminRow.Actions>
        </AdminRow>
      ))}
    </AdminList>
  );
}
