/**
 * Marvel Legendary Randomizer — card database.
 *
 * Data provenance: compiled from publicly available box-content summaries
 * and general knowledge of the game. It is a best-effort *starter* set,
 * not a verified transcription of every card. Before your first game,
 * skim each section against your own boxes and fix anything that's off —
 * the format below is intentionally flat and easy to hand-edit.
 *
 * Two expansions are deliberately NOT included: "Legendary: Villains" and
 * "Legendary: Civil War" use a different game mode (playing as villains,
 * or heroes vs. heroes) that doesn't fit the Mastermind/Scheme/Villain/
 * Hero shape this randomizer generates. Add your own section for them if
 * you want to model that mode.
 *
 * To add an expansion: add one entry to EXPANSIONS, then push entries
 * into any of HEROES / MASTERMINDS / SCHEMES / VILLAIN_GROUPS / HENCHMEN
 * tagged with its id. A category can be sparse (e.g. a small-box
 * expansion with heroes only) — the randomizer just won't draw from an
 * empty pool.
 */

const EXPANSIONS = [
  { id: "core", name: "Core Set (2012)" },
  { id: "dark_city", name: "Dark City" },
  { id: "fantastic_four", name: "Fantastic Four" },
  { id: "paint_town_red", name: "Paint the Town Red" },
  { id: "guardians", name: "Guardians of the Galaxy" },
  { id: "x_men", name: "X-Men" },
  { id: "champions", name: "Champions" },
];

const MASTERMINDS = [
  { name: "Doctor Doom", exp: "core" },
  { name: "Loki", exp: "core" },
  { name: "Magneto", exp: "core" },
  { name: "Red Skull", exp: "core" },

  { name: "Apocalypse", exp: "dark_city" },
  { name: "Kingpin", exp: "dark_city" },
  { name: "Mister Sinister", exp: "dark_city" },
  { name: "Mystique", exp: "dark_city" },
  { name: "Ultron", exp: "dark_city" },

  { name: "Galactus", exp: "fantastic_four" },

  { name: "Thanos", exp: "guardians" },
  { name: "Ronan the Accuser", exp: "guardians" },

  { name: "Dark Phoenix", exp: "x_men" },
  { name: "Onslaught", exp: "x_men" },
];

const SCHEMES = [
  { name: "Doombots Are Attacking the City!", exp: "core" },
  { name: "Whatever It Takes", exp: "core" },
  { name: "Save the Renegade S.H.I.E.L.D. Agents", exp: "core" },
  { name: "Even an Octopus Can Get Stuck in a Tree", exp: "core" },
  { name: "Under Attack by the Mutant Master", exp: "core" },
  { name: "Unleash the Kree Battle Sentries", exp: "core" },
  { name: "Master the Casket of Ancient Winters", exp: "core" },
  { name: "Assemble the Ultimate Cosmic Weapon", exp: "core" },

  { name: "Rise of Apocalypse", exp: "dark_city" },
  { name: "Kingpin's Criminal Empire", exp: "dark_city" },
  { name: "Mutant Massacre", exp: "dark_city" },
  { name: "Age of Apocalypse", exp: "dark_city" },
  { name: "Assault on Genosha", exp: "dark_city" },
  { name: "Reign of the Hellfire Club", exp: "dark_city" },
  { name: "War of the X-Men", exp: "dark_city" },
  { name: "Legacy Virus Outbreak", exp: "dark_city" },

  { name: "Galactus Hungers for Earth", exp: "fantastic_four" },
  { name: "Battle the Frightful Four", exp: "fantastic_four" },

  { name: "Web of Lies", exp: "paint_town_red" },

  { name: "Assemble the Infinity Gauntlet", exp: "guardians" },
  { name: "Collect the Infinity Stones", exp: "guardians" },

  { name: "The Dark Phoenix Saga", exp: "x_men" },
  { name: "Days of Future Past", exp: "x_men" },
  { name: "Fall of the Mutants", exp: "x_men" },

  { name: "Prove Yourselves, Champions", exp: "champions" },
];

const VILLAIN_GROUPS = [
  { name: "Brotherhood", exp: "core" },
  { name: "Enemies of Asgard", exp: "core" },
  { name: "Hydra", exp: "core" },
  { name: "Masters of Evil", exp: "core" },
  { name: "Radiation", exp: "core" },
  { name: "Skrulls", exp: "core" },
  { name: "Spider-Foes", exp: "core" },

  { name: "Acolytes", exp: "dark_city" },
  { name: "Hellfire Club", exp: "dark_city" },
  { name: "Sinister Six", exp: "dark_city" },
  { name: "Horsemen of Apocalypse", exp: "dark_city" },
  { name: "Kingpin's Crime Syndicate", exp: "dark_city" },
  { name: "Assassin's Guild", exp: "dark_city" },

  { name: "Frightful Four", exp: "fantastic_four" },

  { name: "Sinister Syndicate", exp: "paint_town_red" },

  { name: "Universal Church of Truth", exp: "guardians" },
  { name: "Black Order", exp: "guardians" },

  { name: "Reavers", exp: "x_men" },
  { name: "Marauders", exp: "x_men" },
];

const HENCHMEN = [
  { name: "Doombot Legion", exp: "core" },
  { name: "Hand Ninjas", exp: "core" },
  { name: "Sentinels", exp: "core" },
  { name: "Savage Land Mutates", exp: "core" },

  { name: "Reavers' Cyborgs", exp: "dark_city" },
  { name: "Maggia Enforcers", exp: "dark_city" },

  { name: "Chitauri Foot Soldiers", exp: "guardians" },

  { name: "Prime Sentinels", exp: "x_men" },
];

const HEROES = [
  { name: "Spider-Man", exp: "core" },
  { name: "Iron Man", exp: "core" },
  { name: "Wolverine", exp: "core" },
  { name: "Hulk", exp: "core" },
  { name: "Cyclops", exp: "core" },
  { name: "Nova", exp: "core" },
  { name: "Emma Frost", exp: "core" },
  { name: "Black Widow", exp: "core" },
  { name: "Ms. Marvel", exp: "core" },
  { name: "Iron Fist", exp: "core" },
  { name: "Nightcrawler", exp: "core" },
  { name: "Bishop", exp: "core" },
  { name: "Angel", exp: "core" },
  { name: "Colossus", exp: "core" },
  { name: "She-Hulk", exp: "core" },

  { name: "Cable", exp: "dark_city" },
  { name: "Daredevil", exp: "dark_city" },
  { name: "Professor X", exp: "dark_city" },
  { name: "Blade", exp: "dark_city" },
  { name: "Storm", exp: "dark_city" },
  { name: "Rogue", exp: "dark_city" },
  { name: "Gambit", exp: "dark_city" },
  { name: "Psylocke", exp: "dark_city" },
  { name: "Jean Grey", exp: "dark_city" },
  { name: "Beast", exp: "dark_city" },
  { name: "X-23", exp: "dark_city" },
  { name: "Elektra", exp: "dark_city" },
  { name: "Moon Knight", exp: "dark_city" },
  { name: "Punisher", exp: "dark_city" },
  { name: "Ghost Rider", exp: "dark_city" },
  { name: "Luke Cage", exp: "dark_city" },
  { name: "Shadowcat", exp: "dark_city" },

  { name: "Mister Fantastic", exp: "fantastic_four" },
  { name: "Invisible Woman", exp: "fantastic_four" },
  { name: "Human Torch", exp: "fantastic_four" },
  { name: "Thing", exp: "fantastic_four" },
  { name: "Silver Surfer", exp: "fantastic_four" },

  { name: "Spider-Woman", exp: "paint_town_red" },
  { name: "Silk", exp: "paint_town_red" },
  { name: "Spider-Man 2099", exp: "paint_town_red" },
  { name: "Scarlet Spider", exp: "paint_town_red" },
  { name: "Agent Venom", exp: "paint_town_red" },

  { name: "Star-Lord", exp: "guardians" },
  { name: "Gamora", exp: "guardians" },
  { name: "Drax", exp: "guardians" },
  { name: "Rocket Raccoon", exp: "guardians" },
  { name: "Groot", exp: "guardians" },

  { name: "Magik", exp: "x_men" },
  { name: "Cannonball", exp: "x_men" },
  { name: "Sunspot", exp: "x_men" },
  { name: "Warpath", exp: "x_men" },
  { name: "Boom-Boom", exp: "x_men" },
  { name: "Havok", exp: "x_men" },
  { name: "Polaris", exp: "x_men" },
  { name: "Multiple Man", exp: "x_men" },
  { name: "Domino", exp: "x_men" },
  { name: "Forge", exp: "x_men" },

  { name: "Ms. Marvel (Kamala Khan)", exp: "champions" },
  { name: "Spider-Man (Miles Morales)", exp: "champions" },
  { name: "Nova (Sam Alexander)", exp: "champions" },
  { name: "Viv Vision", exp: "champions" },
  { name: "Cyclops (Young)", exp: "champions" },
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { EXPANSIONS, MASTERMINDS, SCHEMES, VILLAIN_GROUPS, HENCHMEN, HEROES };
}
