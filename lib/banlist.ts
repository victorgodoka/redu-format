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

export const BANLIST_IDS: readonly BanSection[] = [
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
      [46052429, "Advanced Ritual Art"],
      [1475311, "Allure of Darkness"],
      [72989439, "Black Luster Soldier - Envoy of the Beginning"],
      [91351370, "Black Whirlwind"],
      [2009101, "Blackwing - Gale the Whirlwind"],
      [14087893, "Book of Moon"],
      [48976825, "Burial from a Different Dimension"],
      [72892473, "Card Destruction"],
      [36468556, "Ceasefire"],
      [9596126, "Chaos Sorcerer"],
      [94886282, "Charge of the Light Brigade"],
      [15341821, "Dandylion"],
      [65192027, "Dark Armed Dragon"],
      [53129443, "Dark Hole"],
      [40044918, "Elemental HERO Stratos"],
      [45222299, "Evigishki Gustkraken"],
      [33396948, "Exodia the Forbidden One"],
      [81439173, "Foolish Burial"],
      [50091196, "Formula Synchron"],
      [27970830, "Gateway of the Six"],
      [41470137, "Gladiator Beast Bestiari"],
      [44330098, "Gorz the Emissary of Darkness"],
      [19613556, "Heavy Storm"],
      [37742478, "Honest"],
      [66957584, "Infernity Launcher"],
      [68184115, "Inzektor Dragonfly"],
      [69207766, "Inzektor Hornet"],
      [7902349, "Left Arm of the Forbidden One"],
      [44519536, "Left Leg of the Forbidden One"],
      [29981921, "Legendary Six Samurai - Shi En"],
      [23171610, "Limiter Removal"],
      [48686504, "Lonefire Blossom"],
      [32723153, "Magical Explosion"],
      [92826944, "Mezuki"],
      [37520316, "Mind Control"],
      [43040603, "Monster Gate"],
      [83764719, "Monster Reborn"],
      [33508719, "Morphing Jar"],
      [28297833, "Necroface"],
      [80344569, "Neo-Spacian Grand Mole"],
      [16226786, "Night Assailant"],
      [2295440, "One for One"],
      [33420078, "Plaguespreader Zombie"],
      [67169062, "Pot of Avarice"],
      [23701465, "Primal Seed"],
      [88264978, "Red-Eyes Darkness Metal Dragon"],
      [32807846, "Reinforcement of the Army"],
      [27174286, "Return from the Different Dimension"],
      [70903634, "Right Arm of the Forbidden One"],
      [8124921, "Right Leg of the Forbidden One"],
      [26202165, "Sangan"],
      [73915051, "Scapegoat"],
      [41420027, "Solemn Judgment"],
      [11747708, "Spore"],
      [90953320, "T.G. Hyper Librarian"],
      [1315120, "T.G. Striker"],
      [46652477, "The Transmigration Prophecy"],
      [34853266, "Tsukuyomi"],
      [80604092, "Ultimate Offering"],
      [17078030, "Wall of Revealing Light"],
      [81122844, "Wind-Up Carrier Zenmaity"],
    ],
  },
  {
    slug: "semi-limited",
    label: "Semi-Limited",
    copies: "2 copies",
    note: "Two copies total across your main deck, extra deck and side deck.",
    cards: [
      [8949584, "A Hero Lives"],
      [59509952, "Archlord Kristya"],
      [85215458, "Blackwing - Kalut the Moon Shadow"],
      [29401950, "Bottomless Trap Hole"],
      [85087012, "Card Trooper"],
      [91623717, "Chain Strike"],
      [14943837, "Debris Dragon"],
      [9411399, "Destiny HERO - Malicious"],
      [70583986, "Dewloren, Tiger King of the Ice Barrier"],
      [213326, "E - Emergency Call"],
      [25377819, "Hieratic Seal of Convocation"],
      [95503687, "Lumina, Lightsworn Summoner"],
      [98494543, "Magical Stone Excavation"],
      [15800838, "Mind Crush"],
      [44095762, "Mirror Force"],
      [29843091, "Ojama Trio"],
      [98645731, "Pot of Duality"],
      [58577036, "Reasoning"],
      [10028593, "Reborn Tengu"],
      [85138716, "Rescue Rabbit"],
      [72405967, "Royal Tribute"],
      [54031490, "Shien's Smoke Signal"],
      [84749824, "Solemn Warning"],
      [423585, "Summoner Monk"],
      [91188343, "The Agent of Mystery - Earth"],
      [53582587, "Torrential Tribute"],
      [10802915, "Tour Guide From the Underworld"],
      [98777036, "Tragoedia"],
    ],
  },
  {
    slug: "unrestricted",
    label: "No longer restricted",
    copies: "3 copies",
    note: "Restricted on earlier lists, free to play at three in this format.",
    cards: [
      [45809008, "Destiny Draw"],
      [67723438, "Emergency Teleport"],
      [3136426, "Level Limit - Area B"],
      [62279055, "Magic Cylinder"],
      [31305911, "Marshmallon"],
      [4906301, "Necro Gardna"],
      [72302403, "Swords of Revealing Light"],
    ],
  },
];

/** Cropped artwork, no card frame. Ids are unpadded here too. */
export const CARD_ART = "https://ygopro.online/assets/card-arts";
export const CARD_IMAGE = "https://yugi.wiki/assets/card-images/common";
