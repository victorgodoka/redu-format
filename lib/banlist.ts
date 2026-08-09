/**
 * September 2012 Forbidden & Limited List, as played in REDU Format.
 *
 * Ids are card passcodes, unpadded: yugi.wiki serves /3078576.jpg and 404s on
 * /03078576.jpg, so leading zeros must not be added.
 */
export type BanCard = readonly [id: number, name: string];

export type BanSection = {
  slug: string;
  label: string;
  copies: string;
  note: string;
  cards: readonly BanCard[];
};

export const banlist: readonly BanSection[] = [
  {
    slug: "forbidden",
    label: "Forbidden",
    copies: "0 copies",
    note: "Cannot be used in your main deck, extra deck or side deck.",
    cards: [
      [
        87910978,
        "Brain Control"
      ],
      [
        50321796,
        "Brionac, Dragon of the Ice Barrier"
      ],
      [
        69243953,
        "Butterfly Dagger - Elma"
      ],
      [
        57953380,
        "Card of Safe Return"
      ],
      [
        4031928,
        "Change of Heart"
      ],
      [
        82301904,
        "Chaos Emperor Dragon - Envoy of the End"
      ],
      [
        60682203,
        "Cold Wave"
      ],
      [
        17375316,
        "Confiscation"
      ],
      [
        57728570,
        "Crush Card Virus"
      ],
      [
        34124316,
        "Cyber Jar"
      ],
      [
        69015963,
        "Cyber-Stein"
      ],
      [
        40737112,
        "Dark Magician of Chaos"
      ],
      [
        32646477,
        "Dark Strike Fighter"
      ],
      [
        44763025,
        "Delinquent Duo"
      ],
      [
        56570271,
        "Destiny HERO - Disk Commander"
      ],
      [
        23557835,
        "Dimension Fusion"
      ],
      [
        17484499,
        "Exchange of the Spirit"
      ],
      [
        78706415,
        "Fiber Jar"
      ],
      [
        93369354,
        "Fishborg Blaster"
      ],
      [
        77565204,
        "Future Fusion"
      ],
      [
        42703248,
        "Giant Trunade"
      ],
      [
        67441435,
        "Glow-Up Bulb"
      ],
      [
        7391448,
        "Goyo Guardian"
      ],
      [
        79571449,
        "Graceful Charity"
      ],
      [
        18144507,
        "Harpie's Feather Duster"
      ],
      [
        61740673,
        "Imperial Order"
      ],
      [
        28566710,
        "Last Turn"
      ],
      [
        85602018,
        "Last Will"
      ],
      [
        34206604,
        "Magical Scientist"
      ],
      [
        31560081,
        "Magician of Faith"
      ],
      [
        21593977,
        "Makyura the Destructor"
      ],
      [
        34906152,
        "Mass Driver"
      ],
      [
        46411259,
        "Metamorphosis"
      ],
      [
        96782886,
        "Mind Master"
      ],
      [
        41482598,
        "Mirage of Nightmare"
      ],
      [
        74191942,
        "Painful Choice"
      ],
      [
        55144522,
        "Pot of Greed"
      ],
      [
        70828912,
        "Premature Burial"
      ],
      [
        12580477,
        "Raigeki"
      ],
      [
        14878871,
        "Rescue Cat"
      ],
      [
        83555666,
        "Ring of Destruction"
      ],
      [
        93016201,
        "Royal Oppression"
      ],
      [
        8131171,
        "Sinister Serpent"
      ],
      [
        45986603,
        "Snatch Steal"
      ],
      [
        20663556,
        "Substitoad"
      ],
      [
        29762407,
        "Temple of the Kings"
      ],
      [
        42829885,
        "The Forceful Sentry"
      ],
      [
        63519819,
        "Thousand-Eyes Restrict"
      ],
      [
        35316708,
        "Time Seal"
      ],
      [
        64697231,
        "Trap Dustshoot"
      ],
      [
        33184167,
        "Tribe-Infecting Virus"
      ],
      [
        52687916,
        "Trishula, Dragon of the Ice Barrier"
      ],
      [
        44910027,
        "Victory Dragon"
      ],
      [
        78010363,
        "Witch of the Black Forest"
      ],
      [
        3078576,
        "Yata-Garasu"
      ]
    ],
  },
  {
    slug: "limited",
    label: "Limited",
    copies: "1 copy",
    note: "One copy total across your main deck, extra deck and side deck.",
    cards: [
      [46052429, "Black Luster Soldier - Envoy of the Beginning"],
      [1475311, "Blackwing - Gale the Whirlwind"],
      [72989439, "Chaos Sorcerer"],
      [91351370, "Dark Armed Dragon"],
      [2009101, "Dandylion"],
      [14087893, "Elemental HERO Stratos"],
      [48976825, "Evigishki Gustkraken"],
      [72892473, "Formula Synchron"],
      [36468556, "Exodia the Forbidden One"],
      [9596126, "Gladiator Beast Bestiari"],
      [94886282, "Gorz the Emissary of Darkness"],
      [15341821, "Honest"],
      [65192027, "Inzektor Dragonfly"],
      [53129443, "Inzektor Hornet"],
      [40044918, "Left Arm of the Forbidden One"],
      [45222299, "Left Leg of the Forbidden One"],
      [33396948, "Legendary Six Samurai - Shi En"],
      [81439173, "Lonefire Blossom"],
      [50091196, "Mezuki"],
      [27970830, "Morphing Jar"],
      [41470137, "Necroface"],
      [44330098, "Neo-Spacian Grand Mole"],
      [19613556, "Night Assailant"],
      [37742478, "Plaguespreader Zombie"],
      [66957584, "Right Arm of the Forbidden One"],
      [68184115, "Right Leg of the Forbidden One"],
      [69207766, "Red-Eyes Darkness Metal Dragon"],
      [7902349, "Sangan"],
      [44519536, "Spore"],
      [29981921, "T.G. Hyper Librarian"],
      [23171610, "T.G. Striker"],
      [48686504, "Tsukuyomi"],
      [32723153, "Wind-Up Carrier Zenmaity"],
      [92826944, "Advanced Ritual Art"],
      [37520316, "Allure of Darkness"],
      [43040603, "Black Whirlwind"],
      [83764719, "Book of Moon"],
      [33508719, "Burial from a Different Dimension"],
      [28297833, "Card Destruction"],
      [80344569, "Charge of the Light Brigade"],
      [16226786, "Dark Hole"],
      [2295440, "Foolish Burial"],
      [33420078, "Gateway of the Six"],
      [67169062, "Heavy Storm"],
      [23701465, "Infernity Launcher"],
      [88264978, "Limiter Removal"],
      [32807846, "Mind Control"],
      [27174286, "Monster Gate"],
      [70903634, "Monster Reborn"],
      [8124921, "One for One"],
      [26202165, "Pot of Avarice"],
      [73915051, "Primal Seed"],
      [41420027, "Reinforcement of the Army"],
      [11747708, "Scapegoat"],
      [90953320, "Ceasefire"],
      [1315120, "Magical Explosion"],
      [46652477, "Return from the Different Dimension"],
      [34853266, "Solemn Judgment"],
      [80604092, "The Transmigration Prophecy"],
      [17078030, "Ultimate Offering"],
      [81122844, "Wall of Revealing Light"],
    ],
  },
  {
    slug: "semi-limited",
    label: "Semi-Limited",
    copies: "2 copies",
    note: "Two copies total across your main deck, extra deck and side deck.",
    cards: [
      [8949584, "Archlord Kristya"],
      [59509952, "Blackwing - Kalut the Moon Shadow"],
      [85215458, "Card Trooper"],
      [29401950, "Debris Dragon"],
      [85087012, "Destiny HERO - Malicious"],
      [91623717, "Dewloren, Tiger King of the Ice Barrier"],
      [14943837, "Lumina, Lightsworn Summoner"],
      [9411399, "Reborn Tengu"],
      [70583986, "Rescue Rabbit"],
      [213326, "Summoner Monk"],
      [25377819, "The Agent of Mystery - Earth"],
      [95503687, "Tour Guide From the Underworld"],
      [98494543, "Tragoedia"],
      [15800838, "A Hero Lives"],
      [44095762, "Chain Strike"],
      [29843091, "E - Emergency Call"],
      [98645731, "Hieratic Seal of Convocation"],
      [58577036, "Magical Stone Excavation"],
      [10028593, "Pot of Duality"],
      [85138716, "Reasoning"],
      [72405967, "Royal Tribute"],
      [54031490, "Shien's Smoke Signal"],
      [84749824, "Bottomless Trap Hole"],
      [423585, "Mind Crush"],
      [91188343, "Mirror Force"],
      [53582587, "Ojama Trio"],
      [10802915, "Solemn Warning"],
      [98777036, "Torrential Tribute"],
    ],
  },
  {
    slug: "unrestricted",
    label: "No longer restricted",
    copies: "3 copies",
    note: "Restricted on earlier lists, free to play at three in this format.",
    cards: [
      [45809008, "Necro Gardna"],
      [67723438, "Marshmallon"],
      [3136426, "Destiny Draw"],
      [62279055, "Emergency Teleport"],
      [31305911, "Level Limit - Area B"],
      [4906301, "Swords of Revealing Light"],
      [72302403, "Magic Cylinder"],
    ],
  },
];

/** Cropped artwork, no card frame. Ids are unpadded here too. */
export const CARD_ART = "https://ygopro.online/assets/card-arts";
export const CARD_IMAGE = "https://yugi.wiki/assets/card-images/common";
