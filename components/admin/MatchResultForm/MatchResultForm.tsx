"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import FormGroup from "@/components/ui/FormGroup";
import Label from "@/components/ui/Label";
import Select from "@/components/ui/Select";
import { enterResultAction } from "@/app/admin/(protected)/tournaments/[slug]/bracket/actions";

type PlayerOption = { name: string; defaultValue: "1" | "0" | "draw" };

/**
 * A moderator writing the real result. There are no draws in this system, so
 * this asks the only two things a series can tell you: who won, and how the
 * games went (2-0 or 2-1 in a Bo3; a Bo1 has only 1-0).
 *
 * A settled result starts locked so a stray click can't resubmit it -
 * "Change result" unlocks the fields and turns into the button that saves.
 * A rejected correction comes back as a message at the top of the page (see
 * enterResultAction), rather than silently doing nothing.
 */
export default function MatchResultForm({
  slug,
  matchId,
  player1,
  player2,
  hasResult,
  winningGames,
}: {
  slug: string;
  matchId: string;
  player1: PlayerOption;
  player2: PlayerOption;
  hasResult: boolean;
  /** Games that win the series: 2 for Bo3, 1 for Bo1. */
  winningGames: number;
}) {
  const [editing, setEditing] = useState(!hasResult);
  const [winner, setWinner] = useState(player1.defaultValue === "1" ? "player1" : "player2");
  const [loserGames, setLoserGames] = useState("0");

  return (
    <form action={enterResultAction} className="payment-controls__confirm">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="winnerGames" value={winningGames} />
      <FormGroup>
        <div className="form__field">
          <Label>
            Winner
            <Select
              name="winner"
              value={winner}
              onChange={(e) => setWinner(e.target.value)}
              disabled={!editing}
              required
            >
              <option value="player1">{player1.name}</option>
              <option value="player2">{player2.name}</option>
            </Select>
          </Label>
        </div>

        {winningGames > 1 ? (
          <div className="form__field">
            <Label>
              Score
              <Select
                name="loserGames"
                value={loserGames}
                onChange={(e) => setLoserGames(e.target.value)}
                disabled={!editing}
                required
              >
                {Array.from({ length: winningGames }, (_, games) => (
                  <option key={games} value={games}>
                    {winningGames}-{games}
                  </option>
                ))}
              </Select>
            </Label>
          </div>
        ) : (
          <input type="hidden" name="loserGames" value="0" />
        )}

        <Button
          variant="solid"
          type={editing ? "submit" : "button"}
          onClick={editing ? undefined : () => setEditing(true)}
        >
          {editing ? "Save result" : "Change result"}
        </Button>
      </FormGroup>
    </form>
  );
}
