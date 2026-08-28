"use client"

import { Participant } from '@/lib/tournaments';
import ActionBanner from '../ActionBanner/ActionBanner';
import styles from './ParticipantCards.module.css'
import { disqualifyParticipantAction, overrideParticipantDeckAction, editParticipantDeckAction, linkParticipantAction, confirmPaymentAction, removeParticipantAction } from '@/app/admin/(protected)/tournaments/[slug]/participants/actions';
import Badge from '@/components/ui/Badge';
import { formatDate, formatTime } from '@/lib/events';
import ParticipantActions from '../ParticipantActions';
import { useState } from 'react';
import { NEXUS_EDITOR_URL } from '@/lib/nexus-parse';
import { Icon } from '@iconify/react';

export type ActionKind = "deck" | "link" | "drop" | "payment" | "dq";

interface ParticipantCardsProps {
  participants: Participant[]
  slug: string;
  isPaid: boolean;
  started: boolean;
  tournamentName: string;
}

const ParticipantCards = ({ participants, started, slug, isPaid, tournamentName }: ParticipantCardsProps) => {
  const [activeAction, setActiveAction] = useState<{ id: string; kind: ActionKind } | null>(null);
  const close = () => setActiveAction(null);

  return <ul className={styles.cards}>
    {participants.map((p) => {
      const active = !p.droppedAt && !p.disqualifiedAt;
      const canLink = p.source === "admin_manual" && !p.playerId;
      const acting = activeAction?.id === p.id ? activeAction.kind : null;

      return (
        <li key={p.id}>
          <div className="card">
            <div className="row">
              <div className="main">
                <span className="name">{p.name}</span>
                <a
                  className="deck"
                  href={`${NEXUS_EDITOR_URL}${p.deckUUID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {p.deckName ?? "Player's Deck"}
                  {started ? <Icon icon="material-symbols:lock " /> : null}
                </a>
                <span className="source">
                  {p.source === "public_signup" ? "Public signup" : "Admin signup"}
                </span>

                {p.disqualifiedAt || p.droppedAt || canLink || isPaid ? (
                  <div className="pills">
                    {p.disqualifiedAt ? (
                      <Badge tone="negative">
                        Disqualified · {p.dqReason ?? "Deck violation"} · {formatDate(p.disqualifiedAt)}{" "}
                        {formatTime(p.disqualifiedAt)}
                      </Badge>
                    ) : p.droppedAt ? (
                      <Badge tone="muted">
                        Dropped · {formatDate(p.droppedAt)} {formatTime(p.droppedAt)}
                      </Badge>
                    ) : null}
                    {canLink ? <Badge tone="neutral">No linked account</Badge> : null}
                    {isPaid ? (
                      <Badge
                        tone={
                          p.paymentStatus === "confirmed"
                            ? "positive"
                            : p.paymentStatus === "contested"
                              ? "negative"
                              : "neutral"
                        }
                      >
                        {p.paymentStatus === "confirmed"
                          ? "Confirmed entry"
                          : p.paymentStatus === "contested"
                            ? "Contested"
                            : "Payment pending"}
                        {p.proofUrl ? (
                          <>
                            {" · "}
                            <a href={p.proofUrl} target="_blank" rel="noopener noreferrer">
                              View proof
                            </a>
                          </>
                        ) : null}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <ParticipantActions
            acting={acting}
            active={active}
            canLink={canLink}
            started={started}
            p={p}
            open={setActiveAction}
            isPaid={isPaid}
            slug={slug}
            tournamentName={tournamentName}
          />

          {acting === "dq" ? (
            <ActionBanner color={"red"} started={started} participant={p} slug={slug} description={{
              started: `Override ${p.name}'s deck UUID - the tournament has already started, so this is exceptional.`,
              notStarted: `Change ${p.name}'s deck UUID.`
            }}
              action={disqualifyParticipantAction}
              inputData={{
                name: "reason",
                placeholder: "Reason (the player sees this)",
                autoComplete: "off",
              }}
              close={close}
            />
          ) : null}

          {acting === "deck" ? (
            <ActionBanner color={"amber"} started={started} participant={p} slug={slug} description={{
              started: `Override ${p.name}'s deck UUID - the tournament has already started, so this is exceptional.`,
              notStarted: `Change ${p.name}'s deck UUID.`
            }}
              action={started ? overrideParticipantDeckAction : editParticipantDeckAction}
              close={close}
            />
          ) : null}

          {acting === "link" ? (
            <ActionBanner color={"green"} started={started} participant={p} slug={slug} description={{
              started: `Override ${p.name}'s deck UUID - the tournament has already started, so this is exceptional.`,
              notStarted: `Change ${p.name}'s deck UUID.`
            }}
              action={linkParticipantAction}
              close={close}
              inputData={{
                name: "name",
                list: "registered-players",
                placeholder: "Duelist's account name",
                autoComplete: "off",
              }}
            />
          ) : null}

          {acting === "payment" ? (
            <ActionBanner
              color={"blue"}
              started={started}
              participant={p}
              slug={slug}
              description={
                p.paymentStatus === "confirmed"
                  ? `Re-confirm ${p.name}'s payment.`
                  : `Confirm ${p.name}'s payment.`
              }
              action={confirmPaymentAction}
              close={close}
              inputData={{
                type: "url",
                name: "proofUrl",
                placeholder: p.proofUrl ? "New proof URL (optional)" : "Proof URL",
                required: !p.proofUrl,
              }}
            />
          ) : null}

          {acting === "drop" ? (
            <ActionBanner
              color={"red"}
              started={started}
              participant={p}
              slug={slug}
              description={{
                started: `Drop ${p.name} from this tournament? Their current match counts as a loss, and they're out for the rest of the event.`,
                notStarted: `Remove ${p.name} from this tournament?`,
              }}
              action={removeParticipantAction}
              close={close}
            />
          ) : null}
        </li>
      );
    })}
  </ul>
}

export default ParticipantCards