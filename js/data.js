/**
 * Marvel Legendary Randomizer — card database.
 *
 * Data provenance: compiled from publicly available box-content summaries
 * and general knowledge of the game. It is a best-effort *starter* set,
 * not a verified transcription of every card. Before your first game,
 * skim each section against your own boxes and fix anything that's off —
 * the format below is intentionally flat and easy to hand-edit.
 *
 * Every expansion is deliberately listed, even ones with sparse or no
 * card data yet, so the app is honest about what it does and doesn't
 * know — see each expansion's `confidence`:
 *   "verified" — cross-checked against public box-content summaries.
 *   "moderate" — compiled from general game knowledge, not cross-checked.
 *   "light"    — a handful of headline cards only, likely incomplete.
 *   "none"     — name only, no card data yet. Contributions welcome.
 *
 * "Legendary: Villains" is NOT included at all: it flips the game so
 * players control villains against a hero Mastermind, which doesn't fit
 * the Mastermind/Scheme/Villain/Hero shape this randomizer generates.
 * "Legendary: Civil War" IS included, but only for its ordinary Heroes —
 * its special "Team Iron Man vs. Team Cap" mode isn't modeled here.
 *
 * To add an expansion: add one entry to EXPANSIONS, then push entries
 * into any of HEROES / MASTERMINDS / SCHEMES / VILLAIN_GROUPS / HENCHMEN
 * tagged with its id. A category can be sparse — the randomizer just
 * won't draw from an empty pool, and will warn if a pool is too small
 * for the setup size requested.
 *
 * A Mastermind entry can optionally carry `leadsCategory` ("villains" or
 * "henchmen") + `leadsName`, matching the "always leads ___" text on the
 * physical Mastermind card. When set, the app auto-includes that card
 * whenever the Mastermind is in play (unless you've excluded it in Card
 * Pool, or every slot in that category is already manually locked). Note
 * it can point at either category — e.g. Doctor Doom always leads the
 * Doombot Legion, which is a Henchman, not a Villain Group.
 */

const EXPANSIONS = [
  { id: "core", name: "Core Set (2012)", confidence: "verified" },
  { id: "dark_city", name: "Dark City", confidence: "verified" },
  { id: "fantastic_four", name: "Fantastic Four", confidence: "moderate" },
  { id: "paint_town_red", name: "Paint the Town Red", confidence: "moderate" },
  { id: "guardians", name: "Guardians of the Galaxy", confidence: "moderate" },
  { id: "x_men", name: "X-Men", confidence: "moderate" },
  { id: "champions", name: "Champions", confidence: "moderate" },
  { id: "civil_war", name: "Civil War", confidence: "light" },
  { id: "secret_wars", name: "Secret Wars: Volume 1", confidence: "light" },
  { id: "annihilation", name: "Annihilation", confidence: "light" },
  { id: "ant_man", name: "Ant-Man", confidence: "light" },
  { id: "cap_75", name: "Captain America 75th Anniversary", confidence: "light" },
  { id: "deadpool", name: "Deadpool", confidence: "light" },
  { id: "dr_strange", name: "Doctor Strange and the Shadows of Nightmare", confidence: "light" },
  { id: "fear_itself", name: "Fear Itself", confidence: "light" },
  { id: "asgard", name: "Heroes of Asgard", confidence: "light" },
  { id: "into_the_cosmos", name: "Into the Cosmos", confidence: "light" },
  { id: "new_mutants", name: "New Mutants", confidence: "light" },
  { id: "noir", name: "Noir", confidence: "light" },
  { id: "realm_of_kings", name: "Realm of Kings", confidence: "light" },
  { id: "shield", name: "S.H.I.E.L.D.", confidence: "light" },
  { id: "spiderman_homecoming", name: "Spider-Man Homecoming", confidence: "light" },
  { id: "venom", name: "Venom", confidence: "light" },
  { id: "world_war_hulk", name: "World War Hulk", confidence: "light" },
  { id: "dimensions", name: "Dimensions", confidence: "none" },
  { id: "revelations", name: "Revelations", confidence: "none" },
];

const MASTERMINDS = [
  { name: "Doctor Doom", exp: "core", leadsCategory: "henchmen", leadsName: "Doombot Legion" },
  { name: "Loki", exp: "core", leadsCategory: "villains", leadsName: "Enemies of Asgard" },
  { name: "Magneto", exp: "core", leadsCategory: "villains", leadsName: "Brotherhood" },
  { name: "Red Skull", exp: "core", leadsCategory: "villains", leadsName: "Hydra" },

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

  { name: "MODOK", exp: "ant_man" },
  { name: "Carnage", exp: "venom" },
  { name: "Nightmare", exp: "dr_strange" },
  { name: "Maestro", exp: "world_war_hulk" },
  { name: "Vulture", exp: "spiderman_homecoming" },
  { name: "Vulcan", exp: "realm_of_kings" },
  { name: "Annihilus", exp: "annihilation" },
  { name: "Sin", exp: "fear_itself" },
  { name: "Doctor Doom (Battleworld)", exp: "secret_wars" },
];

// NOTE: the eight Core Set scheme titles below are still unverified
// best-effort guesses, unlike the rest of the Core Set data above (which
// is transcribed from the official quick-reference at
// legendarycardgame.com/core-set-at-a-glace). Replace these once the
// real scheme names/text are available.
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

  { name: "A.I.M.", exp: "ant_man" },
  { name: "Klyntar Symbiotes", exp: "venom" },
  { name: "Mindless Ones", exp: "dr_strange" },
  { name: "The Worthy", exp: "fear_itself" },
];

const HENCHMEN = [
  { name: "Doombot Legion", exp: "core" },
  { name: "Hand Ninjas", exp: "core" },
  { name: "Sentinel", exp: "core" },
  { name: "Savage Land Mutates", exp: "core" },

  { name: "Reavers' Cyborgs", exp: "dark_city" },
  { name: "Maggia Enforcers", exp: "dark_city" },

  { name: "Chitauri Foot Soldiers", exp: "guardians" },

  { name: "Prime Sentinels", exp: "x_men" },
];

const HEROES = [
  { name: "Black Widow", exp: "core" },
  { name: "Captain America", exp: "core" },
  { name: "Cyclops", exp: "core" },
  { name: "Deadpool", exp: "core" },
  { name: "Emma Frost", exp: "core" },
  { name: "Gambit", exp: "core" },
  { name: "Hawkeye", exp: "core" },
  { name: "Hulk", exp: "core" },
  { name: "Iron Man", exp: "core" },
  { name: "Nick Fury", exp: "core" },
  { name: "Rogue", exp: "core" },
  { name: "Spider-Man", exp: "core" },
  { name: "Storm", exp: "core" },
  { name: "Thor", exp: "core" },
  { name: "Wolverine", exp: "core" },

  { name: "Cable", exp: "dark_city" },
  { name: "Daredevil", exp: "dark_city" },
  { name: "Professor X", exp: "dark_city" },
  { name: "Blade", exp: "dark_city" },
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
  { name: "Iceman", exp: "x_men" },

  { name: "Ms. Marvel (Kamala Khan)", exp: "champions" },
  { name: "Spider-Man (Miles Morales)", exp: "champions" },
  { name: "Nova (Sam Alexander)", exp: "champions" },
  { name: "Viv Vision", exp: "champions" },
  { name: "Cyclops (Young)", exp: "champions" },

  { name: "Vision", exp: "civil_war" },
  { name: "War Machine", exp: "civil_war" },
  { name: "Black Panther", exp: "civil_war" },

  { name: "Nova (Richard Rider)", exp: "annihilation" },
  { name: "Quasar", exp: "annihilation" },
  { name: "Gladiator", exp: "annihilation" },

  { name: "Ant-Man", exp: "ant_man" },
  { name: "Wasp", exp: "ant_man" },
  { name: "Giant-Man", exp: "ant_man" },
  { name: "Yellowjacket", exp: "ant_man" },

  { name: "Captain America (Sam Wilson)", exp: "cap_75" },
  { name: "Captain America (Bucky Barnes)", exp: "cap_75" },

  { name: "Negasonic Teenage Warhead", exp: "deadpool" },

  { name: "Doctor Strange", exp: "dr_strange" },
  { name: "Scarlet Witch", exp: "dr_strange" },
  { name: "Wong", exp: "dr_strange" },
  { name: "Clea", exp: "dr_strange" },

  { name: "Valkyrie", exp: "asgard" },
  { name: "Sif", exp: "asgard" },
  { name: "Beta Ray Bill", exp: "asgard" },
  { name: "Balder", exp: "asgard" },

  { name: "Captain Marvel (Carol Danvers)", exp: "into_the_cosmos" },
  { name: "Adam Warlock", exp: "into_the_cosmos" },

  { name: "Wolfsbane", exp: "new_mutants" },
  { name: "Magma", exp: "new_mutants" },
  { name: "Karma", exp: "new_mutants" },

  { name: "Spider-Man Noir", exp: "noir" },

  { name: "Black Bolt", exp: "realm_of_kings" },
  { name: "Medusa", exp: "realm_of_kings" },

  { name: "Maria Hill", exp: "shield" },
  { name: "Phil Coulson", exp: "shield" },
  { name: "Mockingbird", exp: "shield" },
  { name: "Quake", exp: "shield" },

  { name: "Spider-Man (Homecoming)", exp: "spiderman_homecoming" },

  { name: "Toxin", exp: "venom" },
  { name: "Anti-Venom", exp: "venom" },

  { name: "Amadeus Cho", exp: "world_war_hulk" },
  { name: "Skaar", exp: "world_war_hulk" },
  { name: "Red Hulk", exp: "world_war_hulk" },
];

/** Real deck-construction table from the rulebook (Legendary: A Marvel Deck
 * Building Game), by number of players. Villain Groups / Henchmen / Heroes
 * feed the counts in this file's option steppers; Bystanders has no named
 * cards of its own so it's tracked as a plain number, not a card pool.
 * At 1 player the Henchman deck is built specially (2 cards in the deck,
 * 2 cards placed directly into the city) — see `henchmenNote`.
 */
const PLAYER_COUNT_TABLE = {
  1: { villainCount: 1, henchmenCount: 1, bystanders: 1, heroCount: 3, henchmenNote: "Solo (1 player): build the Henchman deck with only 2 cards, and place 2 more Henchman cards directly into the city instead of the usual pile." },
  2: { villainCount: 2, henchmenCount: 1, bystanders: 2, heroCount: 5 },
  3: { villainCount: 3, henchmenCount: 1, bystanders: 8, heroCount: 5 },
  4: { villainCount: 4, henchmenCount: 2, bystanders: 8, heroCount: 5 },
  5: { villainCount: 5, henchmenCount: 2, bystanders: 16, heroCount: 6 },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { EXPANSIONS, MASTERMINDS, SCHEMES, VILLAIN_GROUPS, HENCHMEN, HEROES, PLAYER_COUNT_TABLE };
}
