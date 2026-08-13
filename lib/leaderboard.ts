/**
 * Mock community leaderboard. There is no backend yet, so standings are a
 * static list rather than a query. Replace RAW with a real read once
 * tournament results are tracked; rank() below needs no change.
 */

export type LeaderboardEntry = {
  rank: number;
  name: string;
  points: number;
  events: number;
  wins: number;
  topCuts: number;
  signatureDeck: string;
};

const RAW: readonly Omit<LeaderboardEntry, "rank">[] = [
  { name: "Marcus Reyes", points: 940, events: 14, wins: 9, topCuts: 12, signatureDeck: "Wind-Up" },
  { name: "Priya Nathan", points: 885, events: 13, wins: 7, topCuts: 11, signatureDeck: "Agent" },
  { name: "Tobias Krenn", points: 810, events: 15, wins: 6, topCuts: 10, signatureDeck: "Chaos Dragon" },
  { name: "Yuki Sorensen", points: 760, events: 11, wins: 7, topCuts: 9, signatureDeck: "Geargia" },
  { name: "Adaeze Okoro", points: 705, events: 12, wins: 5, topCuts: 8, signatureDeck: "Dino Rabbit" },
  { name: "Felix Marchetti", points: 660, events: 10, wins: 5, topCuts: 7, signatureDeck: "Dark World" },
  { name: "Sana Widjaja", points: 610, events: 12, wins: 4, topCuts: 7, signatureDeck: "Hero Beat" },
  { name: "Diego Fuentes", points: 555, events: 9, wins: 4, topCuts: 6, signatureDeck: "Wind-Up" },
  { name: "Ingrid Sorenstam", points: 520, events: 10, wins: 3, topCuts: 5, signatureDeck: "Madolche" },
  { name: "Kwame Asante", points: 470, events: 8, wins: 3, topCuts: 5, signatureDeck: "Six Samurai" },
  { name: "Lena Voss", points: 415, events: 9, wins: 2, topCuts: 4, signatureDeck: "Prophecy" },
  { name: "Ravi Chandran", points: 360, events: 7, wins: 2, topCuts: 3, signatureDeck: "Chaos Dragon" },
  { name: "Chidi Obi", points: 300, events: 6, wins: 1, topCuts: 3, signatureDeck: "Geargia" },
  { name: "Nora Lindqvist", points: 245, events: 6, wins: 1, topCuts: 2, signatureDeck: "Agent" },
  { name: "Theo Papadakis", points: 190, events: 5, wins: 1, topCuts: 1, signatureDeck: "Inzektor" },
];

export const LEADERBOARD: readonly LeaderboardEntry[] = [...RAW]
  .sort((a, b) => b.points - a.points)
  .map((entry, i) => ({ ...entry, rank: i + 1 }));
