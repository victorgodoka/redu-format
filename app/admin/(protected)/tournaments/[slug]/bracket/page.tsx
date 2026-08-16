import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminPageHead from "@/components/admin/AdminPageHead";
import BracketRounds from "@/components/admin/BracketRounds";
import StartBracketForm from "@/components/admin/StartBracketForm";
import StatBar from "@/components/admin/StatBar";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { getBracketView, getPlacings } from "@/lib/backend/services/results.service";
import { getTournament } from "@/lib/tournaments";
import { completeBracketAction, nextRoundAction } from "./actions";

export const metadata: Metadata = {
  title: "Tournament bracket | REDU Format",
  robots: { index: false, follow: false },
};

export default async function BracketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  const view = await getBracketView(slug);
  const placings = view?.status === "complete" ? await getPlacings(slug) : [];

  const hasOpenMatches = view
    ? view.matches.some((m) => m.active && !m.hasResult && !m.bye)
    : false;

  return (
    <>
      <AdminPageHead
        title={`${tournament.name} · Bracket`}
        back={{ href: `/admin/tournaments/${slug}`, label: "← Back to tournament" }}
      />

      {!view ? (
        <EmptyState
          message={
            <>
              No bracket started yet. Starting one locks in the {tournament.taken} currently
              registered {tournament.taken === 1 ? "participant" : "participants"} as the field -
              anyone who registers afterward won&apos;t be added automatically.
            </>
          }
          action={<StartBracketForm slug={slug} />}
        />
      ) : (
        <BracketRounds
          slug={slug}
          view={view}
          placings={placings}
          actions={
            view.status !== "complete" && !hasOpenMatches ? (
              <StatBar
                actions={
                  <>
                    <form action={nextRoundAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <Button type="submit">Generate next round</Button>
                    </form>
                    <form action={completeBracketAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <Button variant="solid" type="submit">
                        Complete tournament
                      </Button>
                    </form>
                  </>
                }
              />
            ) : null
          }
        />
      )}
    </>
  );
}
