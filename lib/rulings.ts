/**
 * Rules reference for REDU Format. Two things live here: the Master Rule
 * history that explains where MR2 came from, and the format's own rulings.
 */

export type MasterRule = {
  name: string;
  /** Set whose release put this rule set into effect in the OCG. */
  release: string;
  date: string;
  /** True for the rule set this format plays under. */
  current?: boolean;
  newTerms?: readonly string[];
  renamed?: readonly { from: string; to: string }[];
  changes?: readonly string[];
};

export const MASTER_RULES: readonly MasterRule[] = [
  {
    name: "Master Rule",
    release: "Starter Deck 2008",
    date: "March 15, 2008",
    newTerms: ["Tuner monster", "Synchro Monster", "Synchro Summon"],
    renamed: [
      { from: "Sacrifice Summon", to: "Advance Summon" },
      { from: "Sacrifice", to: "Release" },
      { from: "Fusion Deck", to: "Extra Deck" },
    ],
    changes: [
      "Introduced deck size limits: Main Deck 40-60, Extra Deck 0-15, Side Deck 0-15.",
    ],
  },
  {
    name: "Master Rule 2",
    release: "Starter Deck 2011",
    date: "March 19, 2011",
    current: true,
    newTerms: ["Xyz Monster", "Xyz Summon", "Rank"],
    changes: ["Removed Ignition Effect Priority."],
  },
];

export type FormatRule = {
  n: number;
  title: string;
  body: string;
  /** Extra qualifier shown under the body, when one line is not enough. */
  note?: string;
  examples?: readonly { label?: string; text: string }[];
};

export const FORMAT_RULES: readonly FormatRule[] = [
  {
    n: 1,
    title: "Starting player draws a card turn 1",
    body: "The player who goes first draws a card during their Draw Phase, starting with 6 cards in hand.",
  },
  {
    n: 2,
    title: "Only 1 active Field Spell",
    body: "Only 1 Field Spell Card can be face-up at a time. If a new Field Spell resolves while another is face-up, the previous one is destroyed.",
    examples: [
      {
        text: 'Player A activates "Mountain" while Player B\'s "Umi" is active. When "Mountain" resolves, "Umi" is destroyed by game mechanic.',
      },
    ],
  },
  {
    n: 3,
    title: "Union monster condition",
    body: "A monster can only be equipped with 1 Union Monster at a time. This prevents you from equipping a second Union Monster to a monster already equipped with one altogether.",
  },
  {
    n: 4,
    title: "Trap Monsters stay in the Spell/Trap Zone",
    body: "Trap Monsters occupy BOTH a Trap Card Zone AND a Monster Card Zone. You cannot activate a Trap Monster if there are no empty Monster Card Zones.",
  },
  {
    n: 5,
    title: "No Ignition Effect Priority",
    body: "Ignition Effect Priority was removed on April 25, 2012. Unlike prior Retro Formats, in REDU Format the opponent can respond to a Summon before the turn player can activate Ignition Effects.",
    note: "Trigger Effects still activate normally upon Summon. Only Ignition (Spell Speed 1) Effects lose Priority.",
    examples: [
      {
        text: 'Player A Normal Summons "Elemental HERO Stratos". Player B can immediately activate "Bottomless Trap Hole" — Player A does NOT get Priority to activate "Stratos"\'s search effect first.',
      },
    ],
  },
  {
    n: 6,
    title: "Infinite loops",
    body: "Voluntary infinite loops are illegal and cannot be activated. Involuntary loops will cause the primary cause to be destroyed.",
    examples: [
      {
        label: "Voluntary (illegal)",
        text: 'Player A has "Gemini Elf", "Luminous Spark", and "Pole Position". Player B cannot Summon "X-Head Cannon" because "Luminous Spark" would create an infinite ATK loop.',
      },
      {
        label: "Involuntary",
        text: 'Player B draws a card, raising "Muka Muka"\'s ATK above "Opticlops" equipped with "Axe of Despair" and "Pole Position" active. This is an unavoidable loop, so "Pole Position" is destroyed by game mechanics.',
      },
    ],
  },
];
