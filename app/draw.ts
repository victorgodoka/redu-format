/**
 * Draws from a shuffled deck without replacement, so every image shows once
 * before any repeats. `onScreen` is how many are visible at a time: when the
 * deck is reshuffled, that many leading slots are kept clear of what is still
 * displayed, otherwise a cycle boundary can put the same art up twice.
 */
export function createDrawer<T>(items: T[], onScreen = 1) {
  let deck: T[] = [];
  const recent: T[] = [];
  const avoid = Math.max(0, onScreen - 1);

  return (): T => {
    if (deck.length === 0) {
      deck = shuffle(items);
      for (let i = 0; i < avoid && i < deck.length; i++) {
        if (!recent.includes(deck[i])) continue;
        const swap = deck.findIndex((x, j) => j >= avoid && !recent.includes(x));
        if (swap > -1) [deck[i], deck[swap]] = [deck[swap], deck[i]];
      }
    }

    const pick = deck.shift() as T;
    recent.push(pick);
    if (recent.length > avoid) recent.shift();
    return pick;
  };
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
