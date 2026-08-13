import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import FallbackImage from "@/app/fallback-image";
import { fetchProfile } from "@/lib/auth";
import { getAdminSession } from "@/lib/auth/session";
import { formatDate, formatTime, isPast } from "@/lib/events";
import { DEFAULT_AVATAR } from "@/lib/nexus-parse";
import { listTournaments } from "@/lib/tournaments";
import { unlinkNexusToken } from "./actions";
import LinkNexusForm from "./link-nexus-form";

const UPCOMING_EVENTS = 5;

export const metadata: Metadata = {
  title: "Admin dashboard | REDU Format",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  const [tournaments, nexusProfile] = await Promise.all([
    listTournaments(),
    session.nexusToken ? fetchProfile(session.nexusToken) : null,
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
    <main className="section" id="main">
      <div className="wrap">
        <div className="admin-bar">
          <p className="tab">Admin</p>
          <div className="admin-identity">
            <span>
              Signed in as {session.displayName} (@{session.username})
            </span>
            <form action="/admin/logout" method="post">
              <button
                className="admin-identity__link admin-identity__signout"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <h1 className="section__title">Admin dashboard</h1>

        <dl className="featured__stats dash-stats panel">
          <div>
            <dt>Tournaments</dt>
            <dd>{tournaments.length}</dd>
          </div>
          <div>
            <dt>Seats filled</dt>
            <dd>{seatsFilled}</dd>
          </div>
        </dl>

        <div className="dash-actions">
          <Link className="btn btn--solid" href="/admin/tournaments">
            Manage tournaments
          </Link>
          <Link className="btn" href="/admin/tournaments/new">
            New tournament
          </Link>
          <Link className="btn" href="/admin/logs">
            Admin logs
          </Link>
        </div>

        <div className="section__grid">
          <div className="section__content">
            <h2 className="section__subtitle">Upcoming events</h2>

            {upcoming.length === 0 ? (
              <div className="empty panel">
                <p className="lede">No upcoming tournaments scheduled.</p>
                <Link className="btn" href="/admin/tournaments/new">
                  New tournament
                </Link>
              </div>
            ) : (
              <ul className="admin-list">
                {upcoming.map((t) => (
                  <li className="admin-row panel" key={t.slug}>
                    <div className="admin-row__main">
                      <span className="admin-row__title">{t.name}</span>
                      <span className="admin-row__meta">
                        {formatDate(t.startsAt)} · {formatTime(t.startsAt)} ·{" "}
                        {t.taken}/{t.seats} seats
                      </span>
                    </div>
                    <div className="admin-row__actions">
                      <Link className="btn" href={`/admin/tournaments/${t.slug}`}>
                        Edit
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="section__content">

            <h2 className="section__subtitle">Dueling Nexus account</h2>

            {nexusProfile ? (
              <div className="admin-row panel">
                <div className="admin-row__main">
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
                      <p className="profile-card__meta">
                        Linked to this admin session
                      </p>
                    </div>
                  </div>
                </div>
                <div className="admin-row__actions">
                  <form action={unlinkNexusToken}>
                    <button className="btn" type="submit">
                      Unlink
                    </button>
                  </form>
                </div>
              </div>
            ) : session.nexusToken ? (
              <div className="notice panel">
                <p className="lede">
                  Dueling Nexus rejected the linked token. Link it again below.
                </p>
                <form action={unlinkNexusToken}>
                  <button className="btn" type="submit">
                    Clear it
                  </button>
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
      </div>
    </main>
  );
}
