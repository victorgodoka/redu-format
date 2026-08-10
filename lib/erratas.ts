/**
 * Cards that have received an errata, carrying their ORIGINAL pre-errata text.
 *
 * Generated from cards.csv, which is the source of truth for this table.
 *
 * - `id` is the passcode printed on the card. Its scan on yugi.wiki shows the
 *   current, post-errata text.
 * - `errataId` is our internal id for the pre-errata printing (always id + 20).
 *   Its scan shows the original text, which matches `desc` below, so it is the
 *   image to display for a format frozen before the errata.
 * - `koid` is Konami's own id, which the rulings database keys on. It is not
 *   the passcode.
 * - `desc` is the pre-errata text, occasionally with [b]...[/b] around defined
 *   game terms.
 */
export type ErrataCard = {
  id: number;
  name: string;
  errataId: number;
  koid: number;
  desc: string;
};

export const ERRATAS: readonly ErrataCard[] = [
  {
    id: 7391448,
    name: "Goyo Guardian",
    errataId: 7391468,
    koid: 7736,
    desc: `1 Tuner + 1 or more non-Tuner monsters
When this card destroys an opponent's monster by battle and sends it to the Graveyard, you can Special Summon that monster to your side of the field in face-up Defense Position.`,
  },
  {
    id: 8131171,
    name: "Sinister Serpent",
    errataId: 8131191,
    koid: 4481,
    desc: `During your Standby Phase, if a "Sinister Serpent" exists in your Graveyard, you can return the "Sinister Serpent" to your hand.`,
  },
  {
    id: 9596126,
    name: "Chaos Sorcerer",
    errataId: 9596146,
    koid: 5833,
    desc: `This card cannot be Normal Summoned or Set. This card can only be Special Summoned by removing from play 1 LIGHT and 1 DARK monster in your Graveyard. Once per turn, during your Main Phase, you can remove from play 1 face-up monster on the field. If you activate this effect, this card cannot attack this turn.`,
  },
  {
    id: 14878871,
    name: "Rescue Cat",
    errataId: 14878891,
    koid: 6262,
    desc: `You can send this face-up card to the Graveyard to Special Summon 2 Level 3 or lower Beast-Type monsters from your Deck. Those monsters are destroyed during the End Phase.`,
  },
  {
    id: 16226786,
    name: "Night Assailant",
    errataId: 16226806,
    koid: 6042,
    desc: `FLIP: Select 1 monster on your opponent's side of the field and destroy it. When this card is sent directly from your hand to the Graveyard, return 1 Flip Effect Monster from your Graveyard to your hand.`,
  },
  {
    id: 17484499,
    name: "Exchange of the Spirit",
    errataId: 17484519,
    koid: 5360,
    desc: `Activate only while there are 15 or more cards in your Graveyard. Pay 1000 Life Points. Both players swap the card(s) in their Graveyard with the card(s) in their Deck. Then, both players shuffle their Decks.`,
  },
  {
    id: 21593977,
    name: "Makyura the Destructor",
    errataId: 21593997,
    koid: 5285,
    desc: `During the turn this card is sent to the Graveyard, the owner of this card can activate Trap Card(s) from his/her hand.`,
  },
  {
    id: 26202165,
    name: "Sangan",
    errataId: 26202185,
    koid: 4054,
    desc: `When this card is sent from the field to the Graveyard, add 1 monster with 1500 or less ATK from your Deck to your hand.`,
  },
  {
    id: 29762407,
    name: "Temple of the Kings",
    errataId: 29762427,
    koid: 5231,
    desc: `The controller of this card can activate Trap Cards the same turn they are Set. If you control "Mystical Beast of Serket" and this card, you can send both to the Graveyard to Special Summon 1 monster from your hand, Deck, or Extra Deck.`,
  },
  {
    id: 32646477,
    name: "Dark Strike Fighter",
    errataId: 32646497,
    koid: 8035,
    desc: `1 Tuner + 1 or more non-Tuner monsters
You can Tribute 1 monster to inflict damage to your opponent equal to its Level x 200.`,
  },
  {
    id: 40044918,
    name: "Elemental HERO Stratos",
    errataId: 40044938,
    koid: 6784,
    desc: `When this card is Normal or Special Summoned, you can select and activate 1 of these effects:
● Destroy Spell or Trap Cards on the field up to the number of "Elemental Hero", "Destiny Hero" and "Evil Hero" monsters you control (not counting this card).
● Select and add 1 "Elemental Hero", "Destiny Hero" or "Evil Hero" monster from your Deck to your hand.`,
  },
  {
    id: 40737112,
    name: "Dark Magician of Chaos",
    errataId: 40737132,
    koid: 5880,
    desc: `When this card is Normal or Special Summoned, you can select and add 1 Spell Card from your Graveyard to your hand. Monsters this card destroys by battle are removed from play instead of going to the Graveyard. If this face-up card is destroyed or removed from the field, it is removed from play.`,
  },
  {
    id: 50321796,
    name: "Brionac, Dragon of the Ice Barrier",
    errataId: 50321816,
    koid: 7548,
    desc: `1 Tuner + 1 or more non-Tuner monsters
You can discard any number of cards to the Graveyard, to return the same number of cards from the field to the hand.`,
  },
  {
    id: 56570271,
    name: "Destiny HERO - Disk Commander",
    errataId: 56570291,
    koid: 7095,
    desc: `When this card is Special Summoned from the Graveyard, draw 2 cards.`,
  },
  {
    id: 57728570,
    name: "Crush Card Virus",
    errataId: 57728590,
    koid: 4667,
    desc: `Tribute 1 DARK monster with 1000 or less ATK. Check all monsters your opponent controls, your opponent's hand, and all cards they draw (until the end of your opponent's 3rd turn after this card's activation), and destroy all monsters with 1500 or more ATK.`,
  },
  {
    id: 61740673,
    name: "Imperial Order",
    errataId: 61740693,
    koid: 4960,
    desc: `As long as this card remains face-up on the field, negate the effects of all Spell Cards on the field. Pay 700 Life Points during each of your Standby Phases. If you do not, this card is destroyed.`,
  },
  {
    id: 70583986,
    name: "Dewloren, Tiger King of the Ice Barrier",
    errataId: 70584006,
    koid: 7970,
    desc: `1 Tuner + 1 or more non-Tuner WATER monsters
Once per turn, you can return any number of face-up cards you control to the owner's hand. This card gains 500 ATK for each card returned to the owner's hand by this effect until the End Phase of this turn.`,
  },
  {
    id: 72989439,
    name: "Black Luster Soldier - Envoy of the Beginning",
    errataId: 72989459,
    koid: 5835,
    desc: `This card cannot be Normal Summoned or Set. This card can only be Special Summoned by removing from play 1 LIGHT and 1 DARK monster in your Graveyard. Once during each of your turns, you can select and activate 1 of the following effects:
● Remove from play 1 monster on the field. If you activate this effect, this card cannot attack during this turn.
● If this card destroyed your opponent's monster as a result of battle, it can attack once again in a row.`,
  },
  {
    id: 77565204,
    name: "Future Fusion",
    errataId: 77565224,
    koid: 6782,
    desc: `Send, from your Deck to the Graveyard, Fusion Material Monsters that are listed on a Fusion Monster Card, and select that 1 Fusion Monster from your Extra Deck. Special Summon a Fusion Monster from your Extra Deck with the same name as the selected Fusion Monster during your 2nd Standby Phase after this card's activation. (This Special Summon is treated as a Fusion Summon.) When this card is removed from the field, destroy the monster. When the monster is destroyed, destroy this card.`,
  },
  {
    id: 78010363,
    name: "Witch of the Black Forest",
    errataId: 78010383,
    koid: 4580,
    desc: `When this card is sent from the field to the Graveyard, select 1 monster with a DEF of 1500 or less from your Deck, show it to your opponent, and add it to your hand. Then shuffle your Deck.`,
  },
  {
    id: 80604091,
    name: "Ultimate Offering",
    errataId: 80604111,
    koid: 4851,
    desc: `At the cost of 500 Life Points per monster, a player is allowed an extra Normal Summon or Set.`,
  },
  {
    id: 82301904,
    name: "Chaos Emperor Dragon - Envoy of the End",
    errataId: 82301924,
    koid: 5860,
    desc: `This card cannot be Normal Summoned or Set. This card can only be Special Summoned by removing from play 1 LIGHT and 1 DARK monster in your Graveyard. You can pay 1000 Life Points to send all cards in both players' hands and on the field to the Graveyard. Inflict 300 damage to your opponent for each card sent to the Graveyard by this effect.`,
  },
  {
    id: 83555666,
    name: "Ring of Destruction",
    errataId: 83555686,
    koid: 5005,
    desc: `Destroy 1 face-up monster and inflict damage to both players equal to its ATK.`,
  },
  {
    id: 95503687,
    name: "Lumina, Lightsworn Summoner",
    errataId: 95503707,
    koid: 7594,
    desc: `Once per turn, you can discard 1 card to Special Summon 1 Level 4 or lower "Lightsworn" monster from your Graveyard. During each of your End Phases, send the top 3 cards of your Deck to the Graveyard.`,
  },
];
