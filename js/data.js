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
 * "Legendary: Villains" flips the game: players control Villain
 * characters (recruiting into their own deck) against a good-guy
 * Mastermind who leads a Hero Group, opposed by Adversaries (its
 * "Henchmen" equivalent). It's mapped onto this app's existing
 * Mastermind/Scheme/Villain Groups/Henchmen/Heroes shape by relabeling
 * roles into those slots (its Villain characters go in HEROES, its Hero
 * Groups go in VILLAIN_GROUPS, etc.) rather than modeling a second game
 * mode. It's deliberately left combinable with any other expansion —
 * mixing pools (e.g. a "Heroes" list with both Iron Man and Doctor
 * Octopus) is a real, if unusual, way to play, and it's the player's
 * call, not this app's, whether to select it alongside anything else.
 * Its Scheme ("Plot") cards use "Good Wins" instead of "Evil Wins" — see
 * `winLabel` below.
 * "Legendary: Civil War" IS included normally, but only for its ordinary
 * Heroes — its special "Team Iron Man vs. Team Cap" mode isn't modeled
 * here.
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
 *
 * A Hero entry can optionally carry `team` (e.g. "Avengers", "X-Men"),
 * shown as a tag and usable as a Team Theme filter to build an
 * all-one-team lineup. It's fine to leave it off — Deadpool, for
 * instance, isn't on a team — a hero without one just won't match any
 * team filter.
 *
 * A Scheme entry can optionally carry `overrides`, `setupNote`, `twist`,
 * `evilWins`, and `winLabel` — see the comment directly above the
 * SCHEMES array below for the full shape. `overrides` fields are
 * mechanically applied by the app (see syncSchemeNumbers/syncRequiredCards
 * in app.js); `setupNote`/`twist`/`evilWins` are shown as reference text
 * only. `evilWins` always holds the players' loss-condition text even
 * when the printed heading isn't literally "Evil Wins" (e.g. Legendary:
 * Villains' Plots say "Good Wins," since there the players ARE the
 * villains) — set `winLabel` to override the displayed heading in that
 * case. A Scheme with none of these behaves exactly like one with no
 * data at all — nothing here is required.
 *
 * Official icon/term legend (confirmed from a card-back reference image),
 * for transcribing future card text accurately:
 *   Stats  — Attack (claw-mark icon, was mistakenly called "Fight" in an
 *            earlier pass — if you see "Fight" anywhere it's a bug),
 *            Recruit (star), Cost (small circle), Victory Points (burst).
 *   Hero types — Strength, Instinct, Covert, Tech, Ranged. Printed on
 *            every Hero card and referenced by name in some Scheme Twist
 *            text (e.g. Core Set's "The Legacy Virus": "reveals a Tech
 *            Hero"). No Hero entry below has its type recorded yet — it'd
 *            be a natural `type` field alongside `team` if that data
 *            comes in, but don't guess it the way `team` risked being
 *            guessed; wait for a source.
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
  { id: "villains", name: "Legendary: Villains", confidence: "verified" },
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

  { name: "Doctor Strange", exp: "villains", leadsCategory: "villains", leadsName: "Defenders" },
  { name: "Nick Fury", exp: "villains", leadsCategory: "villains", leadsName: "Avengers" },
  { name: "Odin", exp: "villains", leadsCategory: "henchmen", leadsName: "Asgardian Warrior" },
  { name: "Professor X", exp: "villains", leadsCategory: "villains", leadsName: "X-Men First Class" },
];

// The eight Core Set (2012) schemes below are transcribed directly from
// the physical cards — unlike the rest of this file, treat these as
// verified. Each carries:
//   overrides    — mechanical deck-construction changes the app actually
//                  applies (see syncSchemeNumbers/syncRequiredCards in
//                  app.js): `twists` (or `twistsByPlayers`), `bystanders`,
//                  `henchmenDelta`, `heroCount` (or `heroCountByPlayers`),
//                  `requiredVillainGroup` / `requiredHenchmen` (forced in
//                  like a Mastermind's "always leads", by name).
//   setupNote    — remaining Setup text not covered by a mechanical
//                  override (e.g. "Skrull Villain Group required" is
//                  covered by `requiredVillainGroup`, but "shuffle 12
//                  random Heroes into the Villain Deck" isn't modeled and
//                  stays as a reminder here), plus any Special Rule text.
//   twist        — the Twist effect text, shown in the Scheme Twists
//                  section since it's referenced throughout the game.
//   evilWins     — the loss condition text.
const SCHEMES = [
  {
    name: "Replace Earth's Leaders with Killbots",
    exp: "core",
    overrides: { twists: 5, bystanders: 18 },
    setupNote: "Plus 3 additional Twists placed next to this Scheme (not in the Villain Deck).\nSpecial Rule: Bystanders in the Villain Deck count as Killbot Villains, with Attack equal to the number of Twists next to this Scheme.",
    twist: "Put the Twist next to this Scheme.",
    evilWins: "If 5 Killbots escape.",
  },
  {
    name: "Secret Invasion of the Skrull Shapeshifters",
    exp: "core",
    overrides: { twists: 8, heroCount: 6, requiredVillainGroup: "Skrulls" },
    setupNote: "Shuffle 12 random Heroes from the Hero Deck into the Villain Deck.\nSpecial Rule: Heroes in the Villain Deck count as Skrull Villains with Attack equal to the Hero's cost + 2. If you defeat that Hero, you gain it.",
    twist: "The highest-cost Hero from the HQ moves into the Sewers as a Skrull Villain, as above.",
    evilWins: "If 6 Heroes get into the Escaped Villains pile.",
  },
  {
    name: "Super Hero Civil War",
    exp: "core",
    overrides: { twistsByPlayers: { 2: 8, 3: 8, 4: 5, 5: 5 }, heroCountByPlayers: { 2: 4 } },
    setupNote: "",
    twist: "KO all the Heroes in the HQ.",
    evilWins: "If the Hero Deck runs out.",
  },
  {
    name: "Unleash the Power of the Cosmic Cube",
    exp: "core",
    overrides: { twists: 8 },
    setupNote: "",
    twist: "Put the Twist next to this Scheme.\nTwists 5–6: Each player gains a Wound.\nTwist 7: Each player gains 3 Wounds.\nTwist 8: Evil Wins!",
    evilWins: "",
  },
  {
    name: "The Legacy Virus",
    exp: "core",
    overrides: { twists: 8 },
    setupNote: "The Wound stack holds 6 Wounds per player.",
    twist: "Each player reveals a Tech Hero or gains a Wound.",
    evilWins: "If the Wound stack runs out.",
  },
  {
    name: "Midtown Bank Robbery",
    exp: "core",
    overrides: { twists: 8, bystanders: 12 },
    setupNote: "Special Rule: Each Villain gets +1 Attack for each Bystander it holds.",
    twist: "Any Villain in the Bank captures 2 Bystanders, then play the top card of the Villain Deck.",
    evilWins: "When 8 Bystanders are carried away by escaping Villains.",
  },
  {
    name: "Negative Zone Prison Breakout",
    exp: "core",
    overrides: { twists: 8, henchmenDelta: 1 },
    setupNote: "",
    twist: "Play the top 2 cards of the Villain Deck.",
    evilWins: "If 12 Villains escape.",
  },
  {
    name: "Portals to the Dark Dimension",
    exp: "core",
    overrides: { twists: 7 },
    setupNote: "Each Twist is a Dark Portal.",
    twist: "Twist 1: Put the Dark Portal above the Mastermind; the Mastermind gets +1 Attack.\nTwists 2–6: Put the Dark Portal in the leftmost city space without one yet; Villains there get +1 Attack.\nTwist 7: Evil Wins!",
    evilWins: "",
  },

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

  // The eight Legendary: Villains Plots below are transcribed directly
  // from the physical cards, same as Core Set. "Setup: 8 Twists" is
  // printed on all eight. Where a card stacks its own side-pile of
  // Bystanders/Bindings/Cops next to the Plot ("Stack 8 Bystanders...as
  // 'Young Mutants'"), that's a distinct physical stack the Plot itself
  // creates — not the ordinary Bystanders-in-the-deck count — so it's
  // captured in setupNote text only, not as a numeric override.
  {
    name: "Graduation at Xavier's X-Academy",
    exp: "villains",
    overrides: { twists: 8 },
    setupNote: 'Stack 8 Bystanders next to this Plot as "Young Mutants."',
    twist: "Put a Bystander from next to this Plot into the Overrun Pile.",
    evilWins: "When there are 8 Bystanders in the Overrun Pile.",
    winLabel: "Good Wins",
  },
  {
    name: "Infiltrate the Lair with Spies",
    exp: "villains",
    overrides: { twists: 8 },
    setupNote:
      'Stack 21 Bystanders next to this Plot as "Infiltrating Spies."\nSpecial Rules: When you recruit an Ally, kidnap any Bystander in that Lair space. When an Ally leaves the Lair in any other way, put any Bystander from that Lair space into the Overrun Pile.',
    twist: "Put all Bystanders from the Lair into the Overrun Pile. Then put a Bystander from next to this Plot into each Lair space under the Bridge, Streets, and Sewers.",
    evilWins: "When there are 12 Bystanders in the Overrun Pile.",
    winLabel: "Good Wins",
  },
  {
    name: "Mass Produce War Machine Armor",
    exp: "villains",
    overrides: { twists: 8, requiredHenchmen: "S.H.I.E.L.D. Assault Squad" },
    setupNote: "Special Rules: Assault Squads get +1 Attack for each War Machine Technology next to the Plot.",
    twist: 'Stack this Twist next to the Plot as "War Machine Technology." An Assault Squad from the current player\'s Victory Pile enters the Bridge.',
    evilWins: "When there are 3 Assault Squads in the Overrun Pile.",
    winLabel: "Good Wins",
  },
  {
    name: "Resurrect Heroes with the Norn Stones",
    exp: "villains",
    overrides: { twists: 8 },
    setupNote: "",
    twist:
      "Twists 1–6: An Adversary from the current player's Victory Pile enters the Bridge. Then play the top card of the Adversary Deck.\nTwists 7–8: Each player puts an Adversary from their Victory Pile into the Overrun Pile.",
    evilWins: "When there are 3 Adversaries per player in the Overrun Pile.",
    winLabel: "Good Wins",
  },
  {
    name: "Build an Underground Mega-Vault Prison",
    exp: "villains",
    overrides: { twists: 8 },
    setupNote: "The Bindings stack holds 5 Bindings per player.",
    twist:
      "If there is an Adversary in the Sewers, each player gains a Bindings. Otherwise, reveal the top card of the Adversary Deck. If that card is an Adversary, it enters the Sewers.",
    evilWins: "When the Bindings stack runs out.",
    winLabel: "Good Wins",
  },
  {
    name: "Cage Villains in Power-Suppressing Cells",
    exp: "villains",
    overrides: { twists: 8 },
    setupNote:
      "Stack 2 Cops per player next to this Plot.\nSpecial Rules: You can fight any Cop on top of Allies. If you do, the player of your choice gains that Ally.",
    twist:
      "Each player returns all Cops from their Victory Pile to the Cop Stack. Then each player puts a non-grey Ally from their hand in front of them. Put a Cop from the Cop Stack on top of each of those Allies.",
    evilWins: "When a Twist must put out a Cop, but the Cop Stack is already empty.",
    winLabel: "Good Wins",
  },
  {
    name: "Crown Thor King of Asgard",
    exp: "villains",
    overrides: { twists: 8 },
    setupNote:
      'Put the Thor Adversary next to this Plot.\nSpecial Rules: Whenever Thor overruns, stack a Plot Twist from the KO pile next to this Plot as a "Triumph of Asgard."',
    twist: "If Thor is in the city, he overruns. Otherwise, Thor enters the Bridge from wherever he is, and Thor guards 3 Bystanders.",
    evilWins: "When there are 3 Triumphs of Asgard next to this Plot.",
    winLabel: "Good Wins",
  },
  {
    name: "Crush Hydra",
    exp: "villains",
    overrides: { twists: 8 },
    setupNote: "Special Rules: An Adversary gets +1 Attack for each Ally it has captured. When you fight that Adversary, gain those Allies.",
    twist:
      "Twists 1–7: Each Adversary in the city captures a New Recruit, or if there are no more New Recruits, a Madame HYDRA.\nTwist 8: Put all captured Allies from the city into the Overrun Pile.",
    evilWins: "When there are 11 Allies in the Overrun Pile.",
    winLabel: "Good Wins",
  },
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

  // Legendary: Villains — these are Hero Groups (the opposition), not
  // Villain Groups in-fiction; see the exclusiveMode note at the top of
  // this file for why they live in this pool anyway.
  { name: "Avengers", exp: "villains" },
  { name: "Defenders", exp: "villains" },
  { name: "Marvel Knights", exp: "villains" },
  { name: "Spider-Friends", exp: "villains" },
  { name: "Uncanny Avengers", exp: "villains" },
  { name: "Uncanny X-Men", exp: "villains" },
  { name: "X-Men First Class", exp: "villains" },
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

  // Legendary: Villains — these are the good guys' Adversary squads.
  { name: "Asgardian Warrior", exp: "villains" },
  { name: "Cops", exp: "villains" },
  { name: "Multiple Man", exp: "villains" },
  { name: "S.H.I.E.L.D. Assault Squad", exp: "villains" },
];

const HEROES = [
  { name: "Black Widow", exp: "core", team: "Avengers" },
  { name: "Captain America", exp: "core", team: "Avengers" },
  { name: "Cyclops", exp: "core", team: "X-Men" },
  { name: "Deadpool", exp: "core" },
  { name: "Emma Frost", exp: "core", team: "X-Men" },
  { name: "Gambit", exp: "core", team: "X-Men" },
  { name: "Hawkeye", exp: "core", team: "Avengers" },
  { name: "Hulk", exp: "core", team: "Avengers" },
  { name: "Iron Man", exp: "core", team: "Avengers" },
  { name: "Nick Fury", exp: "core", team: "S.H.I.E.L.D." },
  { name: "Rogue", exp: "core", team: "X-Men" },
  { name: "Spider-Man", exp: "core", team: "Spider-Friends" },
  { name: "Storm", exp: "core", team: "X-Men" },
  { name: "Thor", exp: "core", team: "Avengers" },
  { name: "Wolverine", exp: "core", team: "X-Men" },

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

  // Legendary: Villains — these are Villain characters (the deck-building
  // pool players actually recruit from in this expansion), not Heroes
  // in-fiction; `team` here is each one's Villain Group affiliation.
  { name: "Bullseye", exp: "villains", team: "Crime Syndicate" },
  { name: "Dr. Octopus", exp: "villains", team: "Sinister Six" },
  { name: "Electro", exp: "villains", team: "Sinister Six" },
  { name: "Enchantress", exp: "villains", team: "Foes of Asgard" },
  { name: "Green Goblin", exp: "villains", team: "Sinister Six" },
  { name: "Juggernaut", exp: "villains", team: "Brotherhood" },
  { name: "Kingpin", exp: "villains", team: "Crime Syndicate" },
  { name: "Kraven", exp: "villains", team: "Sinister Six" },
  { name: "Loki", exp: "villains", team: "Foes of Asgard" },
  { name: "Magneto", exp: "villains", team: "Brotherhood" },
  { name: "Mysterio", exp: "villains", team: "Sinister Six" },
  { name: "Mystique", exp: "villains", team: "Brotherhood" },
  { name: "Sabretooth", exp: "villains", team: "Brotherhood" },
  { name: "Ultron", exp: "villains" },
  { name: "Venom", exp: "villains", team: "Sinister Six" },
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
