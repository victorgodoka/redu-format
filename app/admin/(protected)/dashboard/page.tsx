import type { Metadata } from "next";
import FallbackImage from "@/components/ui/FallbackImage";
import { AdminRow } from "@/components/admin/AdminList";
import AdminPageHead from "@/components/admin/AdminPageHead";
import LinkNexusForm from "@/components/admin/LinkNexusForm";
import StatBar from "@/components/admin/StatBar";
import TournamentList from "@/components/admin/TournamentList";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { fetchProfile } from "@/lib/auth";
import { getAdminSession } from "@/lib/auth/session";
import { formatDate, formatTime, isPast } from "@/lib/events";
import { DEFAULT_AVATAR } from "@/lib/nexus-parse";
import { listTournaments } from "@/lib/tournaments";
import { unlinkNexusToken } from "./actions";

const UPCOMING_EVENTS = 5;

export const metadata: Metadata = {
  title: "Admin dashboard | REDU Format",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  // Auth is already gated by the (protected) layout; the session read here
  // is only to reach nexusToken for the account-linking card below.
  const session = await getAdminSession();

  const [tournaments, nexusProfile] = await Promise.all([
    listTournaments(),
    session?.nexusToken ? fetchProfile(session.nexusToken) : null,
  ]);
  const seatsFilled = tournaments.reduce((sum, t) => sum + t.taken, 0);

  const now = new Date();
  const upcoming = tournaments
    .filter((t) => !isPast(t, now))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .slice(0, UPCOMING_EVENTS);

  return (
    <>
      <AdminPageHead title="Dashboard" />

      <StatBar
        stats={[
          { label: "Tournaments", value: tournaments.length },
          { label: "Seats filled", value: seatsFilled },
        ]}
        actions={
          <>
            <Button variant="solid" href="/admin/tournaments">
              Manage tournaments
            </Button>
            <Button href="/admin/tournaments/new">New tournament</Button>
            <Button href="/admin/logs">Admin logs</Button>
          </>
        }
      />

      <div className="section__grid">
        <div className="section__content">
          <h2 className="section__subtitle">Upcoming events</h2>

          {upcoming.length === 0 ? (
            <EmptyState
              message="No upcoming tournaments scheduled."
              action={<Button href="/admin/tournaments/new">New tournament</Button>}
            />
          ) : (
            <TournamentList
              tournaments={upcoming}
              meta={(t) => (
                <>
                  {formatDate(t.startsAt)} · {formatTime(t.startsAt)} · {t.taken}/
                  {t.seats === null ? "unlimited" : t.seats} seats
                </>
              )}
              actions={(t) => <Button href={`/admin/tournaments/${t.slug}`}>Edit</Button>}
            />
          )}
        </div>
        <div className="section__content">
          <h2 className="section__subtitle">Dueling Nexus account</h2>

          {nexusProfile ? (
            <AdminRow as="div">
              <AdminRow.Main>
                <div className="profile-card__who">
                  {nexusProfile.avatar ? (
                    <FallbackImage
                      key={nexusProfile.avatar}
                      className="profile__avatar"
                      src={nexusProfile.avatar}
                      fallbackSrc={DEFAULT_AVATAR}
                      alt=""
                      width={56}
                      height={56}
                    />
                  ) : null}
                  <div>
                    <p className="profile-card__name">{nexusProfile.name}</p>
                  </div>
                </div>
              </AdminRow.Main>
              <AdminRow.Actions>
                <form action={unlinkNexusToken}>
                  <Button type="submit">Unlink</Button>
                </form>
              </AdminRow.Actions>
            </AdminRow>
          ) : session?.nexusToken ? (
            <div className="notice panel">
              <p className="lede">
                Dueling Nexus rejected the linked token. Link it again below.
              </p>
              <form action={unlinkNexusToken}>
                <Button type="submit">Clear it</Button>
              </form>
              <LinkNexusForm />
            </div>
          ) : (
            <div className="auth panel">
              <LinkNexusForm />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
