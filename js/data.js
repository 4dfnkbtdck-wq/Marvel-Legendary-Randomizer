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
 *
 * To add an expansion: add one entry to EXPANSIONS, then push entries
 * into any of HEROES / MASTERMINDS / SCHEMES / VILLAIN_GROUPS / HENCHMEN
 * tagged with its id. A category can be sparse — the randomizer just
 * won't draw from an empty pool, and will warn if a pool is too small
 * for the setup size requested.
 *
 * A Mastermind entry can optionally carry `leads`, an array of entries
 * ("villains", "henchmen", or "heroes" `category`, plus either an exact
 * `name` or a `nameContains` array), matching the "always leads ___"
 * (and, rarely, "always include ___ as a Hero") text on the physical
 * Mastermind card. When set, the app auto-includes a matching card
 * whenever the Mastermind is in play (unless you've excluded it in Card
 * Pool, or every slot in that category is already manually locked).
 * Most entries use exact `name` — e.g. Doctor Doom always leads the
 * Doombot Legion, a Henchman, not a Villain Group. Use `nameContains`
 * instead for "leads any ___ with [word] in the name" text (e.g. Doctor
 * Octopus leading any Villain Group with "Sinister" in its name) — the
 * app picks randomly among whichever cards currently qualify, by a
 * case-insensitive substring match against the name, and re-picks if
 * more than one word can match (an array = OR, e.g. Magneto's
 * "Brotherhood" or "X-Men"). `leads` is an array on the entry itself
 * because a few Masterminds require more than one card simultaneously
 * (e.g. Killmonger, The Betrayer leads a Henchmen group AND always
 * includes a specific Hero). Omit `leads` entirely for a Mastermind with
 * no specific required card (e.g. one that "leads any villain group" —
 * that's not a forced requirement of any kind, just flavor text).
 *
 * A Mastermind entry can also carry `heroCountDelta` — a flat number
 * added to the Heroes count as part of its own setup (e.g. Alchemax
 * Executives' "add an extra hero to the Hero deck"), independent of and
 * stacking with any `heroCountDelta` a Scheme separately sets (see the
 * SCHEMES comment below) — this one just comes from the Mastermind card
 * instead. Similarly, `villainCountDelta` adds to the Villain Group count
 * as part of the Mastermind's own setup (e.g. Kang, Quantum Conqueror's
 * "set aside the villains from an extra Villain Group as Timeline
 * Variants") — the extra group is picked randomly from the pool exactly
 * like a Scheme's own `villainCountDelta` does, since neither names a
 * specific required group.
 *
 * A Hero entry can optionally carry `team` (e.g. "Avengers", "X-Men"),
 * shown as a tag and usable as a Team Theme filter to build an
 * all-one-team lineup. It's fine to leave it off — Deadpool, for
 * instance, isn't on a team — a hero without one just won't match any
 * team filter. It can also carry `keywords` (same idea as a Villain
 * Group's `keywords` below), a curated tag not printed on the card itself
 * but noting a trait shared across many Heroes from different
 * expansions (e.g. "Size-Changing", used by `extraHeroKeyword` below to
 * pick from just that subset) — most Heroes have none.
 *
 * A Villain Group entry can optionally carry `keywords`, an array of
 * printed-keyword strings (e.g. "Rise of the Living Dead"), for a Scheme
 * that requires "exactly one Villain Group with [keyword]" rather than
 * naming a specific group — see `requiredVillainGroupKeyword` below.
 * Rarely needed: most Villain Groups have no keywords at all.
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
  { id: "fantastic_four", name: "Fantastic Four", confidence: "verified" },
  { id: "paint_town_red", name: "Paint the Town Red", confidence: "moderate" },
  { id: "guardians", name: "Guardians of the Galaxy", confidence: "verified" },
  { id: "x_men", name: "X-Men", confidence: "moderate" },
  { id: "champions", name: "Champions", confidence: "verified" },
  { id: "civil_war", name: "Civil War", confidence: "verified" },
  { id: "secret_wars", name: "Secret Wars: Volume 1", confidence: "light" },
  { id: "annihilation", name: "Annihilation", confidence: "verified" },
  { id: "ant_man", name: "Ant-Man", confidence: "verified" },
  { id: "cap_75", name: "Captain America 75th Anniversary", confidence: "verified" },
  { id: "deadpool", name: "Deadpool", confidence: "verified" },
  { id: "dr_strange", name: "Doctor Strange and the Shadows of Nightmare", confidence: "verified" },
  { id: "fear_itself", name: "Fear Itself", confidence: "verified" },
  { id: "asgard", name: "Heroes of Asgard", confidence: "verified" },
  { id: "into_the_cosmos", name: "Into the Cosmos", confidence: "verified" },
  { id: "new_mutants", name: "New Mutants", confidence: "light" },
  { id: "noir", name: "Noir", confidence: "light" },
  { id: "realm_of_kings", name: "Realm of Kings", confidence: "light" },
  { id: "shield", name: "S.H.I.E.L.D.", confidence: "light" },
  { id: "spiderman_homecoming", name: "Spider-Man Homecoming", confidence: "light" },
  { id: "venom", name: "Venom", confidence: "light" },
  { id: "world_war_hulk", name: "World War Hulk", confidence: "light" },
  { id: "dimensions", name: "Dimensions", confidence: "verified" },
  { id: "revelations", name: "Revelations", confidence: "none" },
  { id: "villains", name: "Legendary: Villains", confidence: "verified" },
  { id: "first_ten_years", name: "Marvel Studios: The First Ten Years", confidence: "verified" },
  { id: "what_if", name: "Marvel Studios: What If...?", confidence: "verified" },
  { id: "core_2nd", name: "Core Set (2nd Edition)", confidence: "verified" },
  { id: "2099", name: "2099", confidence: "verified" },
  { id: "black_panther", name: "Black Panther", confidence: "verified" },
  { id: "black_widow", name: "Black Widow", confidence: "verified" },
  { id: "messiah_complex", name: "Messiah Complex", confidence: "verified" },
  { id: "ant_man_wasp", name: "Marvel Studios Ant-Man and the Wasp", confidence: "verified" },
];

const MASTERMINDS = [
  { name: "Doctor Doom", exp: "core", leads: [{ category: "henchmen", name: "Doombot Legion" }] },
  { name: "Loki", exp: "core", leads: [{ category: "villains", name: "Enemies of Asgard" }] },
  { name: "Magneto", exp: "core", leads: [{ category: "villains", name: "Brotherhood" }] },
  { name: "Red Skull", exp: "core", leads: [{ category: "villains", name: "Hydra" }] },

  { name: "Apocalypse", exp: "dark_city", leads: [{ category: "villains", name: "Four Horsemen" }] },
  { name: "Kingpin", exp: "dark_city", leads: [{ category: "villains", name: "Streets of New York" }] },
  { name: "Mephisto", exp: "dark_city", leads: [{ category: "villains", name: "Underworld" }] },
  { name: "Mr. Sinister", exp: "dark_city", leads: [{ category: "villains", name: "Marauders" }] },
  { name: "Stryfe", exp: "dark_city", leads: [{ category: "villains", name: "MLF" }] },

  { name: "Galactus", exp: "fantastic_four", leads: [{ category: "villains", name: "Heralds of Galactus" }] },
  { name: "Mole Man", exp: "fantastic_four", leads: [{ category: "villains", name: "Subterranea" }] },

  { name: "Supreme Intelligence of the Kree", exp: "guardians", leads: [{ category: "villains", name: "Kree Starforce" }] },
  { name: "Thanos", exp: "guardians", leads: [{ category: "villains", name: "Infinity Gems" }] },

  { name: "Hela, Goddess of Death", exp: "asgard", leads: [{ category: "villains", name: "Omens of Ragnarok" }] },
  { name: "Malekith the Accursed", exp: "asgard", leads: [{ category: "villains", name: "Dark Council" }] },

  { name: "The Beyonder", exp: "into_the_cosmos", leads: [{ category: "villains", name: "From Beyond" }] },
  { name: "The Grandmaster", exp: "into_the_cosmos", leads: [{ category: "villains", name: "Elders of the Universe" }] },
  { name: "Magus", exp: "into_the_cosmos", leads: [{ category: "henchmen", name: "Universal Church of Truth" }] },

  {
    name: "Bastion",
    exp: "messiah_complex",
    leads: [
      { category: "villains", name: "Purifiers" },
      { category: "henchmen", nameContains: ["Sentinel"] },
    ],
  },
  { name: "Exodus", exp: "messiah_complex", leads: [{ category: "villains", name: "Acolytes" }] },
  { name: "Lady Deathstrike", exp: "messiah_complex", leads: [{ category: "villains", name: "Reavers" }] },

  { name: "Dark Phoenix", exp: "x_men" },
  { name: "Onslaught", exp: "x_men" },

  { name: "Morgan Le Fay", exp: "ant_man", leads: [{ category: "villains", name: "Queen's Vengeance" }] },
  { name: "Ultron", exp: "ant_man", leads: [{ category: "villains", name: "Ultron's Legacy" }] },
  { name: "Carnage", exp: "venom" },
  { name: "Dormammu", exp: "dr_strange", leads: [{ category: "villains", name: "Lords of the Netherworld" }] },
  { name: "Nightmare", exp: "dr_strange", leads: [{ category: "villains", name: "Fear Lords" }] },
  { name: "Maestro", exp: "world_war_hulk" },
  { name: "Vulture", exp: "spiderman_homecoming" },
  { name: "Vulcan", exp: "realm_of_kings" },
  { name: "Annihilus", exp: "annihilation", leads: [{ category: "villains", name: "Annihilation Wave" }] },
  { name: "Kang the Conqueror", exp: "annihilation", leads: [{ category: "villains", name: "Timelines of Kang" }] },
  { name: "Uru-Enchanted Iron Man", exp: "fear_itself", leads: [{ category: "villains", name: "The Mighty" }] },
  { name: "Doctor Doom (Battleworld)", exp: "secret_wars" },

  { name: "Doctor Strange", exp: "villains", leads: [{ category: "villains", name: "Defenders" }] },
  { name: "Nick Fury", exp: "villains", leads: [{ category: "villains", name: "Avengers" }] },
  { name: "Odin", exp: "villains", leads: [{ category: "henchmen", name: "Asgardian Warrior" }] },
  { name: "Professor X", exp: "villains", leads: [{ category: "villains", name: "X-Men First Class" }] },

  { name: "Iron Monger", exp: "first_ten_years", leads: [{ category: "villains", name: "Iron Foes" }] },
  { name: "Loki", exp: "first_ten_years", leads: [{ category: "villains", name: "Enemies of Asgard" }] },
  { name: "Red Skull", exp: "first_ten_years", leads: [{ category: "villains", name: "HYDRA" }] },

  // Hank Pym, Yellowjacket "leads any villain group" — not a specific
  // named card, so there's nothing to force-include; `leads` stays empty.
  { name: "Hank Pym, Yellowjacket", exp: "what_if" },
  {
    name: "Killmonger, The Betrayer",
    exp: "what_if",
    leads: [
      { category: "henchmen", name: "Vibranium Liberator Drones" },
      { category: "heroes", name: "Killmonger, Spec Ops" },
    ],
  },
  { name: "Ultron Infinity", exp: "what_if", leads: [{ category: "henchmen", name: "Ultron Sentries" }] },
  { name: "Zombie Scarlet Witch", exp: "what_if", leads: [{ category: "villains", name: "Zombie Avengers" }] },

  { name: "Doctor Doom", exp: "core_2nd", leads: [{ category: "henchmen", name: "Doombot Legion" }] },
  { name: "Doctor Octopus", exp: "core_2nd", leads: [{ category: "villains", nameContains: ["Sinister"] }] },
  { name: "Loki", exp: "core_2nd", leads: [{ category: "villains", name: "Enemies of Asgard" }] },
  { name: "Magneto", exp: "core_2nd", leads: [{ category: "villains", nameContains: ["Brotherhood", "X-Men"] }] },
  { name: "Red Skull", exp: "core_2nd", leads: [{ category: "villains", nameContains: ["Hydra"] }] },

  { name: "Alchemax Executives", exp: "2099", leads: [{ category: "villains", name: "Alchemax Enforcers" }], heroCountDelta: 1 },
  { name: "Sinister Six 2099", exp: "2099", leads: [{ category: "villains", nameContains: ["Alchemax", "Sinister"] }] },

  { name: "Killmonger", exp: "black_panther", leads: [{ category: "villains", name: "Killmonger's League" }] },
  { name: "Klaw", exp: "black_panther", leads: [{ category: "villains", name: "Enemies of Wakanda" }] },

  { name: "Indestructible Man", exp: "black_widow", leads: [{ category: "villains", name: "Elite Assassins" }] },
  { name: "Taskmaster", exp: "black_widow", leads: [{ category: "villains", name: "Taskmaster's Thunderbolts" }] },

  { name: "Arnim Zola", exp: "cap_75", leads: [{ category: "villains", name: "Zola's Creations" }] },
  { name: "Baron Heinrich Zemo", exp: "cap_75", leads: [{ category: "villains", name: "Masters of Evil (WWII)" }] },

  { name: "Fing Fang Foom", exp: "champions", leads: [{ category: "villains", name: "Monsters Unleashed" }] },
  { name: "Pagliacci", exp: "champions", leads: [{ category: "villains", name: "Wrecking Crew" }] },

  { name: "Authoritarian Iron Man", exp: "civil_war", leads: [{ category: "villains", name: "Superhuman Registration Act" }] },
  { name: "Baron Helmut Zemo", exp: "civil_war", leads: [{ category: "villains", name: "Thunderbolts" }] },
  { name: "Maria Hill, Director of S.H.I.E.L.D.", exp: "civil_war", leads: [{ category: "villains", name: "S.H.I.E.L.D. Elite" }] },
  { name: "Misty Knight", exp: "civil_war", leads: [{ category: "villains", name: "Heroes for Hire" }] },
  { name: "Ragnarok", exp: "civil_war", leads: [{ category: "villains", name: "Registration Enforcers" }] },

  { name: "Evil Deadpool", exp: "deadpool", leads: [{ category: "villains", name: "Evil Deadpool Corpse" }] },
  { name: "Macho Gomez", exp: "deadpool", leads: [{ category: "villains", name: "Deadpool's \"Friends\"" }] },

  { name: "J. Jonah Jameson", exp: "dimensions", leads: [{ category: "henchmen", name: "Spider-Slayer" }] },

  { name: "Darren Cross", exp: "ant_man_wasp", leads: [{ category: "villains", name: "Cross Technologies" }] },
  { name: "Ghost, Master Thief", exp: "ant_man_wasp", leads: [{ category: "villains", name: "Ghost Chasers" }] },
  { name: "Kang, Quantum Conqueror", exp: "ant_man_wasp", leads: [{ category: "villains", name: "Armada of Kang" }], villainCountDelta: 1 },
];

// The eight Core Set (2012) schemes below are transcribed directly from
// the physical cards — unlike the rest of this file, treat these as
// verified. Each carries:
//   overrides    — mechanical deck-construction changes the app actually
//                  applies (see syncSchemeNumbers/syncRequiredCards in
//                  app.js): `twists` (or `twistsByPlayers`, or
//                  `twistsPerVillainGroup` — a multiplier times the
//                  resolved Villain Group count), `bystanders` (a flat
//                  override) / `bystandersDelta` (added to the base
//                  count unconditionally) / `bystandersDeltaByPlayers`
//                  (added to the base count, only at the listed player
//                  counts), `henchmenDelta`, `heroCount` /
//                  `heroCountByPlayers` (flat overrides) /
//                  `heroCountDelta` (added to the base, e.g. "add an
//                  extra Hero to the Hero Deck" — note this is a
//                  different mechanic from `extraHero` below: this one
//                  joins the normal Hero Deck and shows as one more card
//                  in the main Heroes result, `extraHero` doesn't),
//                  `villainCount` /
//                  `villainCountByPlayers` (flat overrides) /
//                  `villainCountDelta` (added to the base, e.g. "add an
//                  extra Villain Group"), `requiredVillainGroup` /
//                  `requiredHenchmen` / `requiredHero` (forced in like a
//                  Mastermind's "always leads", by exact name),
//                  `requiredVillainGroups` (same idea, but an array, for
//                  a Scheme that names more than one required Villain
//                  Group at once, e.g. Guardians of the Galaxy's "The
//                  Kree-Skrull War" always including both Kree Starforce
//                  and Skrulls — note "Skrulls" isn't part of this
//                  expansion's own Villain Groups; it's the same exact
//                  card already used by Core Set's own Skrull Scheme, so
//                  this one only resolves with a Skrulls-bearing
//                  expansion also switched on, same as `requiredHero`
//                  cross-expansion cases elsewhere in this file),
//                  `requiredVillainGroupKeyword` (same, but resolved to
//                  whichever available Villain Group(s) carry that
//                  keyword — see VILLAIN_GROUPS' `keywords` above), or
//                  `requiredHeroTeam` (same idea, but resolved to
//                  whichever available Hero(es) carry that `team` — for
//                  Setup text that names a Team rather than a specific
//                  Hero, e.g. Deadpool's "Everybody Hates Deadpool": "use
//                  at least 1 Mercs For Money Hero," printed as the
//                  team's icon rather than a card name),
//                  `extraHero` (a boolean, optionally paired with
//                  `extraHeroNote` — see syncExtraCard in app.js; for a
//                  Scheme whose extra Hero contributes its OWN cards
//                  straight into the Villain Deck without ever joining
//                  the normal Hero Deck, e.g. Marvel Zombies' "8 random
//                  cards." `extraHeroNote` overrides the default "8
//                  random cards go in the Villain Deck" display text for
//                  a Scheme that adds a different amount, e.g. "all 14
//                  cards" — see Trap Heroes in the Microverse; pair with
//                  `extraHeroKeyword` to narrow the random pick to only
//                  Heroes carrying a given `keywords` tag rather than any
//                  Hero, e.g. "Auction Shrink Tech to Highest Bidder"
//                  requiring "a random extra Hero that has any
//                  Size-Changing cards"), or
//                  `extraHeroName` (same idea, but for a Scheme that
//                  names one specific Hero rather than picking randomly,
//                  e.g. Dark City's "Transform Citizens into Demons"
//                  requiring Jean Grey's own cards in the Villain Deck —
//                  the app forces that exact Hero as the extra card
//                  instead of choosing one, and excludes it from the
//                  normal Hero Deck draw so it can't end up in both
//                  places at once; pair with `extraHeroNote` too, since
//                  there's no sensible generic default once it's a named
//                  card rather than a random one). If the
//                  extra Hero instead joins the normal Hero Deck, that's
//                  `heroCountDelta` above instead, not this), or
//                  `heroTeamSplit` (`{ count, perTeam }` — the Hero Deck
//                  must be `perTeam` Heroes from each of `count` distinct
//                  Teams, e.g. Civil War's "Avengers vs. X-Men": 3 Heroes
//                  each from 2 random Teams. The app picks `count` Teams
//                  at random from whichever currently have at least
//                  `perTeam` eligible Heroes, sticking with that pick
//                  until the Scheme changes or a Team stops qualifying;
//                  rerolling one Hero slot stays within that slot's Team
//                  so the split holds. Falls back to a plain random Hero
//                  Deck if fewer than `count` Teams currently qualify.
//                  Pair with `heroCount: count * perTeam`), or `unveils`
//                  (a boolean — for a "Veiled Scheme" whose last Twist
//                  Transforms it into one of several random "Unveiled
//                  Scheme" cards that carry the actual Evil Wins
//                  condition and have no Setup/Twist count of their own,
//                  e.g. Messiah Complex. The app rolls one at random from
//                  UNVEILED_SCHEMES — see the comment above that array —
//                  matching this Scheme's `exp`, the moment this Scheme
//                  is selected, and shows/rerolls it as its own card;
//                  see syncUnveiledScheme/rerollUnveiledScheme in
//                  app.js).
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

  // The eight Dark City schemes below are transcribed directly from the
  // physical cards — the previous bare-name entries here (Rise of
  // Apocalypse, Kingpin's Criminal Empire, etc.) didn't correspond to any
  // real card despite the expansion's "verified" tag; they've been
  // replaced entirely.
  {
    name: "Save Humanity",
    exp: "dark_city",
    overrides: { twists: 8, bystanders: 24, bystandersDeltaByPlayers: { 1: -12 } },
    setupNote:
      "24 Bystanders go in the Hero Deck (not the Villain Deck) — 12 at 1 player.\nSpecial Rules: You may spend 2 Recruit to rescue a Bystander from the HQ.",
    twist: "KO all Bystanders in the HQ. Then each player reveals a Victory Point Hero or KOs a Bystander from their Victory Pile.",
    evilWins: "When the number of Bystanders KO'd and/or carried off is 4 times the number of players.",
  },
  {
    name: "Steal the Weaponized Plutonium",
    exp: "dark_city",
    overrides: { twists: 8, villainCountDelta: 1 },
    setupNote:
      "8 Twists represent Plutonium.\nSpecial Rules: Each Villain gets +1 Attack for each Plutonium it has. When a Villain with any Plutonium is defeated, shuffle that Plutonium back into the Villain Deck.",
    twist:
      "This Plutonium is captured by the closest Villain to the Villain Deck. If there are no Villains in the city, KO this Plutonium. Either way, play another card from the Villain Deck.",
    evilWins: "When 4 Plutonium have been carried off by Villains.",
  },
  {
    name: "Transform Citizens into Demons",
    exp: "dark_city",
    overrides: { twists: 8, bystanders: 0, extraHeroName: "Jean Grey", extraHeroNote: "14 Jean Grey cards go in the Villain Deck" },
    setupNote:
      'Special Rules: Each Jean Grey card counts as a "Goblin Queen" Villain. It\'s worth 4 Victory Points. It has Attack equal to its Cost plus the number of Demon Goblins stacked next to the Scheme.',
    twist:
      'Stack 5 Bystanders face down next to the Scheme. Bystanders stacked here are "Demon Goblin" Villains. They have 2 Attack. Players can fight these Demon Goblins to rescue them as Bystanders.',
    evilWins: "When 4 Goblin Queen cards escape.",
  },
  {
    name: "X-Cutioner's Song",
    exp: "dark_city",
    overrides: { twists: 8, bystanders: 0, extraHero: true, extraHeroNote: "all 14 cards go in the Villain Deck" },
    setupNote:
      "Special Rules: Whenever you play a Hero from the Villain Deck, that Hero is captured by the closest enemy to the Villain Deck. Each Villain gets +2 Attack for each Hero it has. When you fight an enemy, gain all the Heroes captured by that enemy.",
    twist: "KO all Heroes captured by enemies. Then play another card from the Villain Deck.",
    evilWins: "9 non-grey Heroes are KO'd or carried off.",
  },
  {
    name: "Capture Baby Hope",
    exp: "dark_city",
    overrides: { twists: 8 },
    setupNote:
      "Put a token on this Scheme to represent the baby, Hope Summers.\nSpecial Rules: The Villain with the baby gets +4 Attack. If you defeat that Villain, rescue the baby to your Victory Pile (until the next Twist). The baby is worth 6 Victory Points at the end of the game. If a Villain escapes with the baby, stack a Twist next to the Mastermind and return the baby to this Scheme card.",
    twist:
      "If a Villain has the baby, that Villain escapes. Otherwise, the baby is captured by the closest Villain to the Villain Deck. (If there are no Villains, do nothing.)",
    evilWins: "When there are 3 Twists stacked next to the Mastermind.",
  },
  {
    name: "Detonate the Helicarrier",
    exp: "dark_city",
    overrides: { twists: 8, heroCount: 6 },
    setupNote:
      "Special Rules: Whenever a Hero is KO'd from the HQ, turn that Hero face down on that HQ space, representing an Explosion on the Helicarrier. When an HQ space has 6 Explosions, that space is Destroyed and can't hold Heroes anymore.",
    twist: "Stack this Twist next to the Scheme. Then for each Twist in that stack, KO the leftmost Hero in the HQ and immediately refill that HQ space.",
    evilWins: "When all HQ spaces are Destroyed or the Hero Deck runs out.",
  },
  {
    name: "Massive Earthquake Generator",
    exp: "dark_city",
    overrides: { twists: 8 },
    setupNote: "",
    twist: "Each player reveals an Instinct Hero or KOs the top card of their deck.",
    evilWins: "When the number of non-grey Heroes in the KO pile is 3 times the number of players.",
  },
  {
    name: "Organized Crime Wave",
    exp: "dark_city",
    overrides: { twists: 8, requiredHenchmen: "Maggia Goons" },
    setupNote: 'Include 10 Maggia Goons as one of the Henchman Groups.\nSpecial Rules: Goons also have the ability "Ambush: Play another card from the Villain Deck."',
    twist: "Each Goon in the city escapes. Shuffle all Goons from players' Victory Piles into the Villain Deck.",
    evilWins: "When 5 Goons escape.",
  },

  { name: "Web of Lies", exp: "paint_town_red" },

  { name: "The Dark Phoenix Saga", exp: "x_men" },
  { name: "Days of Future Past", exp: "x_men" },
  { name: "Fall of the Mutants", exp: "x_men" },

  // The four Champions schemes below are transcribed directly from the
  // physical cards.
  {
    name: "Clash of the Monsters Unleashed",
    exp: "champions",
    overrides: { twists: 10 },
    setupNote: '6 Wounds per player in the Wound Stack. Shuffle 8 Monsters Unleashed Villains into a face down "Monster Pit" deck.',
    twist:
      'Twists 3–10: Each player chooses a Villain from their Victory Pile as their "Gladiator." Then the top card of the Monster Pit enters the city. Each player whose Gladiator has a lower printed Attack than that Monster gains a Wound.',
    evilWins: "When the Wound Stack or Monster Pit Deck runs out.",
  },
  {
    name: "Divide and Conquer",
    exp: "champions",
    overrides: { twists: 8, heroCount: 7 },
    setupNote:
      "Sort the Hero Deck by Hero Class: Strength, Instinct, Covert, Tech, Ranged. (If a card has multiple Classes, break ties at random.) Put these 5 smaller, shuffled Hero Decks beneath the 5 HQ spaces.\nSpecial Rules: Whenever an HQ space is empty, fill it with the top card of the Hero Deck below that space.",
    twist: "Twists 1–3: KO all Heroes in the HQ.\nTwists 4–8: KO one of the Hero Decks.",
    evilWins: "When all Hero Decks are gone.",
  },
  {
    name: "Hypnotize Every Human",
    exp: "champions",
    overrides: { twists: 8, henchmenDelta: 1, bystanders: 0 },
    setupNote: "",
    twist:
      'Twists 1–6: Put a Bystander from the Bystander Stack above each city space as a face down 2 Attack "Hypno-Thrall" Villain. They don\'t move. When you fight one, rescue it as a Bystander. You can\'t fight a Villain in a city space that has any Hypno-Thralls above it.\nTwists 7–8: Each player puts a Villain from their Victory Pile into the Escape Pile.',
    evilWins: "When 8 Villains are in the Escape Pile.",
  },
  {
    name: "Steal All Oxygen on Earth",
    exp: "champions",
    overrides: { twists: 8 },
    setupNote: 'The "Oxygen Level" starts at 8.',
    twist: "Stack this Twist next to the Scheme. The Oxygen Level decreases by 1. Then KO each Hero from the HQ whose cost is greater than the Oxygen Level.",
    evilWins: "When 20 non-grey Heroes are KO'd.",
  },

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

  // The eight Marvel Studios: The First Ten Years schemes below are
  // transcribed directly from the physical cards. Several are the same
  // mechanical template as a Core Set scheme under a different MCU-movie
  // title (the set reuses Legendary's standard scheme shapes) — that's
  // an intentional duplicate, not a data error; see the file-level note
  // near the top about duplicates being fine, sorted by expansion.
  {
    name: "Radioactive Palladium Poisoning",
    exp: "first_ten_years",
    overrides: { twists: 8 },
    setupNote: "Wound stack holds 6 Wounds per player.",
    twist: "Each player reveals a Tech Hero or gains a Wound.",
    evilWins: "If the Wound stack runs out.",
  },
  {
    name: "Replace Earth's Leaders with Hydra",
    exp: "first_ten_years",
    overrides: { twists: 5, bystanders: 18 },
    setupNote:
      'Plus 3 additional Twists placed next to this Scheme (not in the Villain Deck).\nSpecial Rule: Bystanders in the Villain Deck count as "Infiltrator" Villains, with Attack equal to the number of Twists next to this Scheme.',
    twist: "Put this Twist next to this Scheme.",
    evilWins: 'If 5 "Infiltrator" escape.',
  },
  {
    name: "Super Hero Civil War",
    exp: "first_ten_years",
    overrides: { twistsByPlayers: { 2: 8, 3: 8, 4: 5, 5: 5 }, heroCountByPlayers: { 2: 4 } },
    setupNote: "",
    twist: "KO all the Heroes in the HQ.",
    evilWins: "If the Hero Deck runs out.",
  },
  {
    name: "Unleash the Power of the Cosmic Cube",
    exp: "first_ten_years",
    overrides: { twists: 8 },
    setupNote: "",
    twist: "Put the Twist next to this Scheme.\nTwists 5–6: Each player gains a Wound.\nTwist 7: Each player gains 3 Wounds.\nTwist 8: Evil Wins!",
    evilWins: "",
  },
  {
    name: "Asgard Under Siege",
    exp: "first_ten_years",
    overrides: { twists: 8, henchmenDelta: 1 },
    setupNote: "",
    twist: "Play the top 2 cards of the Villain Deck.",
    evilWins: "If 12 Villains escape.",
  },
  {
    name: "Destroy the Cities of Earth!",
    exp: "first_ten_years",
    overrides: { twists: 8, bystanders: 12 },
    setupNote: "Special Rule: Each Villain gets +1 Attack for each Bystander it has.",
    twist: "Any Villain in the Bank captures 2 Bystanders. Then play the top card of the Villain Deck.",
    evilWins: "When 8 Bystanders are carried away by escaping Villains.",
  },
  {
    name: "Enslave Minds with the Chitauri Scepter",
    exp: "first_ten_years",
    overrides: { twists: 8, heroCount: 6, requiredVillainGroup: "Chitauri" },
    setupNote:
      "Shuffle 12 random Heroes from the Hero Deck into the Villain Deck.\nSpecial Rule: Heroes in the Villain Deck count as \"Enslaved\" Villains with Attack equal to the Hero's Cost + 2. If you defeat that Hero, you gain it.",
    twist: 'The highest-cost Hero from the HQ moves into the Sewers as an "Enslaved" Villain, as above.',
    evilWins: "If 6 Heroes get into the Escaped Villains pile.",
  },
  {
    name: "Invade Asgard",
    exp: "first_ten_years",
    overrides: { twists: 7 },
    setupNote: "Each Twist is a Dark Portal.",
    twist:
      "Twist 1: Put the Dark Portal above the Mastermind; the Mastermind gets +1 Attack.\nTwists 2–6: Put the Dark Portal in the leftmost city space that doesn't yet have one; Villains there get +1 Attack.\nTwist 7: Evil Wins!",
    evilWins: "",
  },

  // The four Marvel Studios: What If...? schemes below are transcribed
  // directly from the physical cards. `requiredHero` (parallel to
  // `requiredVillainGroup`/`requiredHenchmen`) force-includes a specific
  // Hero the way a Scheme can already force a Villain Group or Henchmen
  // group. `requiredVillainGroupKeyword` force-includes whichever Villain
  // Group(s) currently in the pool carry a given `keywords` entry (see
  // VILLAIN_GROUPS below), picking randomly if more than one qualifies —
  // for a Scheme like Marvel Zombies that names a keyword rather than a
  // specific group, so it keeps working correctly as more expansions add
  // more cards with that keyword. `villainCount`/`villainCountByPlayers`
  // override the Villain Group count the same way `heroCount`/
  // `heroCountByPlayers` already did for Heroes. `twistsPerVillainGroup`
  // sets Twists to that multiplier times the (possibly just-overridden)
  // Villain Group count, for a Scheme whose Twist count scales with it.
  // `bystandersDeltaByPlayers` adds to the base per-player-count
  // Bystanders total only at the listed player counts (vs. `bystanders`,
  // a flat unconditional override). `extraHero` marks a Scheme that needs
  // one random Hero beyond the normal Heroes lineup (see syncExtraCard in
  // app.js) — shown in its own row in the Villain Deck section once
  // randomized. Where a card's Setup/Special Rules reference a specific
  // card by name that isn't one of this file's tracked Villain Groups/
  // Henchmen (e.g. "Frigga, Mother of Thor" — a card inside a Villain
  // Group, not a group of its own), that's left as setupNote/twist text
  // only — it doesn't fit this app's numeric-override shape.
  {
    name: "Trash Earth with Hugest Party Ever",
    exp: "what_if",
    overrides: { twists: 6, requiredHero: "Party Thor", requiredVillainGroup: "Intergalactic Party Animals" },
    setupNote: "Special Rules: You can't fight or defeat Frigga.",
    twist:
      'If Frigga, Mother of Thor, is in play, stack this Twist next to the Scheme as "Discovered Wreckage." Otherwise: Search the Villain Deck for Frigga and she does her Ambush ability. Then shuffle this Twist back into the Villain Deck.',
    evilWins: "When 5 Wreckages have been Discovered.",
  },
  {
    name: "Breach the Nexus of All Realities",
    exp: "what_if",
    overrides: { villainCountByPlayers: { 1: 3, 2: 3 }, twistsPerVillainGroup: 2 },
    setupNote:
      'Stack each Villain Group separately face down as its own "Reality." Shuffle together all the Henchmen, Master Strikes, and Bystanders for your player count and randomly distribute them amongst all the Realities, as evenly as possible. Shuffle each Reality separately.\nSpecial Rules: Each turn, you choose which Reality (Villain Deck) plays a card. They all play into the same city.',
    twist:
      'Stack this Twist next to this Reality as a "Dimensional Breach." If this was the second Breach for that Reality, destroy that Reality, KO\'ing all its cards.',
    evilWins: "When all Realities have been destroyed.",
  },
  {
    name: "Collect an Interstellar Zoo",
    exp: "what_if",
    overrides: { twists: 11 },
    setupNote: "",
    twist:
      'Each player reveals their hand. Starting with the current player, then clockwise, the first player to have one of this kind of Hero in their hand or discard pile stacks it next to this Scheme, "stolen for the Zoo."\nTwist 1: Strength Hero. Twist 2: Instinct Hero. Twist 3: Covert Hero. Twist 4: Tech Hero. Twist 5: Ranged Hero (assumed to follow this file\'s canonical Strength/Instinct/Covert/Tech/Ranged order — verify against the physical card if the exact icon match matters).\nTwist 6: 5-cost Hero. Twist 7: 4-cost Hero. Twist 8: 3-cost Hero. Twist 9: 0-cost Hero. Twist 10: a Hero with a Recruit icon.\nTwist 11: a Hero with an Attack icon.',
    evilWins: "When the Zoo has 5 Heroes.",
  },
  {
    name: "Marvel Zombies",
    exp: "what_if",
    overrides: {
      twists: 4,
      requiredVillainGroupKeyword: "Rise of the Living Dead",
      extraHero: true,
      bystandersDeltaByPlayers: { 1: 3, 2: 3 },
    },
    setupNote:
      'Add 8 random cards from the extra Hero (shown in the Villain Deck section) to the Villain Deck.\nSpecial Rules: Hero cards from the Villain Deck are "Zombie" Villains with Attack equal to their cost + 1, worth VP equal to their cost. They have "Ambush: Rise of the Living Dead. Fight: Play a copy of this card as a Hero, then put it into your Victory Pile as a Villain." (It still has Rise.)',
    twist: 'Each Villain in the city with "Rise of the Living Dead" escapes. Then play another card from the Villain Deck.',
    evilWins: "When there are 3 Villains per player in the Escape Pile or the Villain Deck runs out.",
  },

  // The nine Core Set (2nd Edition) schemes below are transcribed
  // directly from the physical cards. Several share a title with a Core
  // Set (2012) scheme but have meaningfully rewritten Setup/Twist/Evil
  // Wins text in this edition — transcribed fresh from the photos, not
  // copied from the 2012 entries above, since the numbers and mechanics
  // genuinely differ card to card (e.g. Portals to the Dark Dimension
  // reverses which Twists go to the Mastermind vs. the city, and flips
  // "leftmost" to "rightmost"). "Enshrouded Identity" is new to this
  // edition and has no 2012 counterpart at all.
  {
    name: "Unleash the Power of the Cosmic Cube",
    exp: "core_2nd",
    overrides: { twists: 8 },
    setupNote: "",
    twist:
      "Twists 1–3: Each player discards a card.\nTwist 4: Each player discards two cards.\nTwists 5–6: Each player gains a Wound.\nTwist 7: Each player gains two Wounds.\nTwist 8: Evil Wins!",
    evilWins: "",
  },
  {
    name: "Portals to the Dark Dimension",
    exp: "core_2nd",
    overrides: { twists: 7 },
    setupNote: 'Each Twist is a "Dark Portal."',
    twist:
      "Twists 1–5: Put this Dark Portal above the rightmost city space that doesn't yet have a Dark Portal. Villains in that city space get +1 Attack.\nTwist 6: Put this Dark Portal above the Mastermind. The Mastermind gets +1 Attack.\nTwist 7: Evil Wins!",
    evilWins: "",
  },
  {
    name: "Replace Earth's Leaders with Killbots",
    exp: "core_2nd",
    overrides: { twists: 10 },
    setupNote:
      'Stack 1 additional Twist next to this Scheme as a "Killgorithm."\nSpecial Rules: Bystanders in the Villain Deck are "Killbot" Villains with Attack equal to the number of Killgorithms. They have: "Fight: Rescue this as a Bystander."',
    twist: "Twists 1–9: Add this Twist to the Killgorithms. Two Killbots enter the city from the Bystander Deck.\nTwist 10: All Killbots in the city escape.",
    evilWins: "When there are 6 Bystander cards in the Escape Pile.",
  },
  {
    name: "Secret Invasion of the Skrull Shapeshifters",
    exp: "core_2nd",
    overrides: { twists: 6, requiredVillainGroup: "Skrulls", heroCountDelta: 1 },
    setupNote:
      'Shuffle 4 random cards from the Hero Deck into the Villain Deck.\nSpecial Rules: Hero cards in the Villain Deck and city are "Skrull Infiltrator" Villains with Attack equal to that Hero\'s cost + 3. They have "Fight: Either KO this card or choose a player to gain it as a Hero."',
    twist: "Twists 1–5: The leftmost Hero from the HQ enters the Sewers as a Skrull Infiltrator.\nTwist 6: All Skrulls in the city escape.",
    evilWins: "When there are 6 Hero cards in the Escape Pile.",
  },
  {
    name: "Super Hero Civil War",
    exp: "core_2nd",
    overrides: { twistsByPlayers: { 1: 6, 2: 6, 3: 6, 4: 5, 5: 5 }, heroCountByPlayers: { 2: 4 } },
    setupNote: "",
    twist: "KO all Heroes from the HQ.",
    evilWins: "When the Hero Deck runs out.",
  },
  {
    name: "Bank Robbery Hostage Crisis",
    exp: "core_2nd",
    overrides: { twists: 9, villainCountDelta: 1 },
    setupNote: "Special Rules: Each Villain gets +1 Attack for each Bystander it has.",
    twist:
      "Twists 1–8: Any Villain in the Bank captures 2 Bystanders. If the Bank is empty, move a Villain from another city space to the Bank instead. Either way, play another card from the Villain Deck.\nTwist 9: Put all Bystanders from the city into the Escape Pile.",
    evilWins: "When 5 Bystanders are in the Escape Pile or the Villain Deck runs out.",
  },
  {
    name: "Enshrouded Identity",
    exp: "core_2nd",
    overrides: { twistsByPlayers: { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 } },
    setupNote:
      'There is no Mastermind yet — this Scheme starts with 3 S.H.I.E.L.D. Officers as "Bodyguards" in the Mastermind\'s place instead. (The Mastermind below is still randomized as usual for whenever one gets added — just don\'t reveal or use it until the Special Rules below add it.)\nSpecial Rules: Bodyguards are Villains with 3 Attack and "Fight: Either KO this card or choose a player to gain it as a Hero." Whenever a Master Strike occurs, if there is no Mastermind yet, add a Bodyguard instead. The first time there are no Bodyguards, add a random Mastermind to the game. (Do any "Start of Game" effects it has.) You can\'t fight that Mastermind while it has any Bodyguards.',
    twist: "Add two Bodyguards.",
    evilWins: "When there are 9 Bodyguards or the Villain Deck runs out.",
  },
  {
    name: "The Legacy Virus",
    exp: "core_2nd",
    overrides: { twists: 9 },
    setupNote: "Wound Deck holds 6 Wounds per player.",
    twist:
      'Stack this Twist next to the Scheme as a "Virus Mutation." Then each player reveals a Hero whose cost is greater than the number of Virus Mutations or gains a Wound.',
    evilWins: "When the Wound Deck or the Villain Deck runs out.",
  },
  {
    name: "Negative Zone Prison Breakout",
    exp: "core_2nd",
    overrides: { twistsByPlayers: { 1: 7, 2: 8, 3: 9, 4: 10, 5: 11 }, villainCountDelta: 1, bystandersDelta: 4 },
    setupNote: "",
    twist: "Play two cards from the Villain Deck.",
    evilWins: "When there are 3 Villains per player in the Escape Pile or the Villain Deck runs out.",
  },

  // The four 2099 schemes below are transcribed directly from the
  // physical cards.
  {
    name: "Become President of the United States",
    exp: "2099",
    overrides: { twists: 11 },
    setupNote:
      'Special Rules: Once per turn, you may stack one of your non-grey Heroes next to this Scheme to earn "Ten Million Votes" for that Hero Name. If you do, you may also send one of your grey Heroes Undercover as "Secret Service."',
    twist:
      'If there\'s a Villain in the Bank or Streets, the Mastermind "vows to crush crime," and you stack this Twist next to the Mastermind as "Ten Million Votes." Otherwise, you may discard two cards to "counter negative advertising," shuffle this Twist back into the Villain Deck, and play another card from that deck. If you don\'t discard, stack this Twist next to the Mastermind as "Ten Million Votes."',
    evilWins: "When the Mastermind is elected President by having Forty Million more Votes than the highest-voted Hero Name.",
  },
  {
    name: "Befoul Earth into a Polluted Wasteland",
    exp: "2099",
    overrides: { twists: 8, heroCountDelta: 1 },
    setupNote:
      'The 8 Twists represent "Toxic Sludge."\nSpecial Rules: To recruit a Hero, you must also pay 2 Recruit for each Toxic Sludge under it. During your turn, if there is any Sludge under the HQ, you may "flush the Toxic Sludge into the river." If you do, then KO all the Sludge and the Heroes in those HQ spaces, and each player gains a Wound.',
    twist: "Put this Toxic Sludge under an HQ space. No space can have two Sludges unless all spaces already have one.",
    evilWins: "When the Hero Deck runs out or there are 8 Toxic Sludges under the HQ and/or in the river (KO pile).",
  },
  {
    name: "Pull Reality into Cyberspace",
    exp: "2099",
    overrides: { twists: 7 },
    setupNote:
      "The 7 Twists represent \"Cyberspace.\"\nSpecial Rules: Enemies under any Cyberspace get +1 Attack for each Cyberspace on the board, and they can be fought with any combination of Recruit and Attack.",
    twist: "Twists 1–5: Put this Cyberspace above the rightmost city space that isn't yet under Cyberspace.\nTwist 6: Put this Cyberspace above the Mastermind.\nTwist 7: Evil Wins!",
    evilWins: "",
  },
  {
    name: "Subjugate Earth with Mega-Corporations",
    exp: "2099",
    overrides: { twists: 11, heroCountDelta: 1 },
    setupNote: "",
    twist:
      'Put the Hero from the HQ space under the Bank into a "Mega-Corp Domination" Stack matching its Hero Class (off of the board). Do the listed effect for that Mega-Corp:\nGreen Globe: Each player discards a card with a Recruit icon.\nAlchemax: Each player discards a Hero of the printed type or gains a Wound.\nPublic Eye: Each player discards two cards, then draws a card.\nD/MONIX: Each player discards a card with an Attack icon.\nStark-Fujikawa: A Villain from your Victory Pile reenters the city.',
    evilWins: "When a single Mega-Corp has 3 Dominations.",
  },

  // The four Annihilation schemes below are transcribed directly from
  // the physical cards.
  {
    name: "Breach Parallel Dimensions",
    exp: "annihilation",
    overrides: { twists: 6, bystandersDelta: 4 },
    setupNote:
      'Deal the shuffled Villain Deck into several "Dimension" decks where the first Dimension has 1 card, the next has 2 cards, then 3, 4, etc. (The final Dimension might not have enough cards to reach its full number.)\nSpecial Rules: Each turn, you choose which Dimension you play a card from. All players have "Focus 1 Recruit → Reveal the top card of any Dimension and put it back on the top or bottom of that deck." If a Dimension ever has no cards left, even in the middle of a card ability, it is destroyed. Mark it with a face up Wound.',
    twist: "Choose a Dimension and play two cards from it. (It's ok if it only has 1.)",
    evilWins: "When at least half of the original Dimensions are destroyed.",
  },
  {
    name: "Pulse Waves from the Negative Zone",
    exp: "annihilation",
    overrides: { twists: 9 },
    setupNote: "",
    twist:
      'Twists 1, 3, 5, 7: "Negative Pulse" — this turn, Heroes in the HQ cost -1 Recruit and Villains and Masterminds get -1 Attack.\nTwists 2, 4, 6, 8: "Positive Pulse" — this turn, Heroes in the HQ cost +1 Recruit and Villains and Masterminds get +1 Attack.\nTwist 9: Evil Wins!',
    evilWins: "",
  },
  {
    name: "Put Humanity on Trial",
    exp: "annihilation",
    overrides: { twists: 11 },
    setupNote:
      'Stack 11 Bystanders next to the Scheme face down as "Galactic Jurors."\nSpecial Rules: Each Twist gives you a challenge to achieve this turn. If you do it, you have convinced a Juror, and you rescue them. If you don\'t, put that Juror face up next to the Villain Deck, voting to condemn Humanity.',
    twist:
      'Twists 1–2: "Opening Arguments" — discard three cards with different names.\nTwists 3, 5, 7: "Question Witnesses" — recruit a Hero that costs 5 or more.\nTwists 4, 6, 8: "Introduce Evidence" — defeat Villain(s) worth 3VP or more.\nTwists 9–11: "Closing Arguments" — defeat the Mastermind.',
    evilWins: "When 6 Jurors vote to condemn Humanity.",
  },
  {
    name: "Sneak Attack the Heroes' Homes",
    exp: "annihilation",
    overrides: { twists: 6 },
    setupNote:
      "Each player chooses a Hero to be part of the Hero Deck. Randomly select other Heroes up to the normal number of Heroes. Each player adds to their starting deck three non-rare cards with different names from the Hero they chose and three Wounds.",
    twist: "Twists 1–5: Each player discards a non-grey Hero or gains a Wound.\nTwist 6: Evil Wins!",
    evilWins: "",
  },

  // The four Ant-Man schemes below are transcribed directly from the
  // physical cards.
  {
    name: "Age of Ultron",
    exp: "ant_man",
    overrides: { twists: 11, heroCountByPlayers: { 4: 6, 5: 7 } },
    setupNote: "Special Rules: Evolved Ultrons have 4 Attack and are Empowered by each color in the Evolution pile. They're worth 6VP.",
    twist: 'Put the top card of the Hero Deck next to the Scheme in an "Evolution" pile. Then this Twist enters the city as an "Evolved Ultron" Villain.',
    evilWins: "When 7 Evolved Ultrons are in the city and/or Escape Pile.",
  },
  {
    name: "Pull Earth into Medieval Times",
    exp: "ant_man",
    overrides: { twists: 9 },
    setupNote: "",
    twist:
      "Twists 1–6: Until the start of your next turn, all Villains and Masterminds everywhere have Chivalrous Duel.\nTwists 7–9: Each player puts a Villain from their Victory Pile into the Escape Pile.",
    evilWins: "When 3 Villains per player have escaped.",
  },
  {
    name: "Transform Commuters into Giant Ants",
    exp: "ant_man",
    overrides: { twistsByPlayers: { 1: 7, 2: 8, 3: 9, 4: 10, 5: 11 } },
    setupNote: "",
    twist:
      'Stack this Twist next to the Scheme. Then for each Twist in that stack, put a Bystander face down next to the Mastermind as a 2 Attack "Giant Ant" Villain. When you fight one, rescue it as a Bystander.',
    evilWins: "When there are 10 Giant Ants next to the Mastermind.",
  },
  {
    name: "Trap Heroes in the Microverse",
    exp: "ant_man",
    overrides: { twists: 11, extraHero: true, extraHeroNote: "all 14 cards go in the Villain Deck" },
    setupNote:
      'Special Rules: Heroes in the Villain Deck are "Micro-Sized" Villains with Attack equal to their printed cost. They have Size-Changing for their card color and no other abilities while in the city. When you fight one, choose any player to gain it as a Hero.',
    twist: "Play two cards from the Villain Deck.",
    evilWins: "When 3 Villains per player have escaped or the Villain Deck runs out.",
  },

  // The four Black Panther schemes below are transcribed directly from
  // the physical cards.
  {
    name: "Poison Lakes with Nanite Microbots",
    exp: "black_panther",
    overrides: { twistsByPlayers: { 1: 6, 2: 7, 3: 8, 4: 9, 5: 10 } },
    setupNote:
      "30 Wounds in the Wound Stack.\nSpecial Rules: Whenever you recruit a Hero (or it leaves the HQ), pay 1 Recruit less for each Wound on it and choose players to gain those Wounds, dividing them as evenly as possible. Whenever a Wound is KO'd from anywhere, return it to the bottom of the Wound Stack.",
    twist:
      'Stack this Twist next to the Scheme as an "Infected Nanite." Wound the Mastermind. Then for each Infected Nanite, Wound a Hero in the HQ, dividing these new Wounds as evenly as possible.',
    evilWins: "When the Wound Stack or Villain Deck runs out.",
  },
  {
    name: "Plunder Wakanda's Vibranium",
    exp: "black_panther",
    overrides: { twists: 10 },
    setupNote:
      "Special Rules: A Villain holding Vibranium is Empowered by the colors of the Vibranium Attunement. When you defeat them, put the Vibranium in your Victory Pile, worth 3VP.",
    twist:
      'Put any Vibranium from the city into the Escape Pile. A Bystander enters the city as a 3 Attack "Smuggler" Villain with "Fight: Rescue this as a Bystander." Then the highest-Attack Villain captures this Twist. Put the top card of the Hero Deck next to the Scheme as a "Vibranium Attunement," putting any previous Attunement on the bottom of the Hero Deck.',
    evilWins: "When 4 Vibranium are in the Escape Pile or the Villain Deck runs out.",
  },
  {
    name: "Provoke a Clash of Nations",
    exp: "black_panther",
    overrides: { twists: 11 },
    setupNote: "",
    twist:
      'Twists 1–8: Without talking, all players simultaneously vote with a Fist, Palm, or 2 Fingers. Break ties at random. Then only you discard your hand and draw six cards. You must do the voted task below by the end of this turn or stack this Twist next to the Mastermind as an "International Crisis".\n• Fist: "War" — defeat a non-Henchman Villain or Mastermind Tactic.\n• Palm: "Diplomacy" — play three Heroes that share a Hero Class.\n• Two Fingers: "Commerce" — recruit two Heroes from the HQ.\nTwists 9–11: Do all three tasks this turn or add an International Crisis.',
    evilWins: "At 6 International Crises.",
  },
  {
    name: "Seize the Wakandan Throne",
    exp: "black_panther",
    overrides: { twists: 6 },
    setupNote: "Special Rules: Whenever you fight the Mastermind, you gain the Throne's Favor.",
    twist:
      'If the Mastermind has the Throne\'s Favor, they spend it to stack this Twist next to the Scheme as a "Tribe of Wakanda Defeated." Otherwise: The Mastermind gains the Throne\'s Favor, shuffle this Twist back into the Villain Deck, and then play a card from the Villain Deck.',
    evilWins: "When the 5 Tribes of Wakanda have been defeated.",
  },

  // The four Black Widow schemes below are transcribed directly from
  // the physical cards.
  {
    name: "Frame Heroes for Murder",
    exp: "black_widow",
    overrides: { twists: 7, heroCount: 6 },
    setupNote: "",
    twist:
      'Twists 1–6: Stack a card from the HQ next to the Scheme as "Incriminating Evidence" that has a different cost than any card already in that stack.\nTwist 7: Add any card from the HQ to the Incriminating Evidence.',
    evilWins: "When there are 5 pieces of Incriminating Evidence.",
  },
  {
    name: "Corrupt the Spy Agencies",
    exp: "black_widow",
    overrides: { twists: 7 },
    setupNote: "",
    twist:
      "Twists 1–6: Each player sends one of their non-grey Heroes Undercover. Then each player may Unleash a Hero from Undercover with a lower cost than the one that player just sent Undercover.\nTwist 7: Evil Wins!",
    evilWins: "",
  },
  {
    name: "Sniper Rifle Assassins",
    exp: "black_widow",
    overrides: { twistsByPlayers: { 1: 10, 2: 9, 3: 8, 4: 7, 5: 6 } },
    setupNote: "",
    twist: "Each player must Dodge with a Hero from their hand, revealing the card they drew. KO each non-grey Hero drawn this way.",
    evilWins: "When there are four non-grey Heroes per player in the KO pile.",
  },
  {
    name: "Train Black Widows in the Red Room",
    exp: "black_widow",
    overrides: { twistsByPlayers: { 1: 7, 2: 6, 3: 5, 4: 4, 5: 3 } },
    setupNote:
      'Add 8 S.H.I.E.L.D. Officers to the Villain Deck.\nSpecial Rules: Officers in the Villain Deck and city are "Black Widow Initiate" Villains with 3+ Attack and "Dark Memories. Fight: Gain this as an Officer (without Dark Memories) or send it Undercover."',
    twist: "A Black Widow Initiate enters the city from the Officer Stack. Play another card from the Villain Deck.",
    evilWins: "When there are 3 Villains per player in the Escape Pile or the Villain Deck runs out.",
  },

  // The four Captain America 75th Anniversary schemes below are
  // transcribed directly from the physical cards.
  {
    name: "Brainwash the Military",
    exp: "cap_75",
    overrides: { twists: 7 },
    setupNote:
      "Add 12 S.H.I.E.L.D. Officers to the Villain Deck.\nSpecial Rules: S.H.I.E.L.D. Officers in the Villain Deck are Villains. Their Attack is 3 plus the number of Twists stacked next to this Scheme. When you defeat a S.H.I.E.L.D. Officer, gain it as a Hero.",
    twist: 'Twists 1–6: Stack this Twist next to the Scheme as a "Traitor Battalion." Play another card from the Villain Deck.\nTwist 7: All S.H.I.E.L.D. Officers in the city escape.',
    evilWins: "When 5 S.H.I.E.L.D. Officers escape.",
  },
  {
    name: "Change the Outcome of WWII",
    exp: "cap_75",
    overrides: { twists: 7, villainCountDelta: 1 },
    setupNote: "",
    twist:
      'The Axis invades a new country. Put all Villains and Bystanders from the city on the bottom of the Villain Deck. The number of city spaces changes. Play 2 cards from the Villain Deck. If any Villains escape this country, stack a Twist next to the Scheme as a "conquered capital."\nTwist 1: Poland — 4 spaces.\nTwist 2: France — 3 spaces.\nTwist 3: USSR — 6 spaces.\nTwist 4: England — 3 spaces.\nTwist 5: USA — 5 spaces.\nTwist 6: Australia — 2 spaces.\nTwist 7: Switzerland — 1 space.',
    evilWins: "When 3 capitals are conquered.",
  },
  {
    name: "Go Back in Time to Slay Heroes' Ancestors",
    exp: "cap_75",
    overrides: { twists: 9, heroCount: 8 },
    setupNote: "Special Rules: Whenever a Hero is in the HQ whose Hero Name has been Purged from the Timestream, KO that Hero.",
    twist: 'Put a Hero from the HQ next to the Scheme, "Purged from the Timestream."',
    evilWins: "When the Hero Deck runs out.",
  },
  {
    name: "The Unbreakable Enigma Code",
    exp: "cap_75",
    overrides: { twists: 6 },
    setupNote:
      "Special Rules: Whenever you fight a Villain, you may pay 1 Recruit to look at one of the face-down Enigma cards. When you fight the Mastermind, first guess the color of each Enigma card, and then reveal them. If you guessed them right, fight the Mastermind as normal. If not, your turn ends, and mix up the Enigma cards face-down.",
    twist: 'Twists 1–5: Put a card from the Hero Deck face down next to the Scheme as part of the "Enigma Code." Mix up those cards face-down.\nTwist 6: Evil Wins!',
    evilWins: "",
  },

  // The eight Civil War schemes below are transcribed directly from the
  // physical cards.
  {
    name: "Nitro the Supervillain Threatens Crowds",
    exp: "civil_war",
    overrides: { twists: 8 },
    setupNote: "",
    twist: "KO all Bystanders held by Villains. Then, the Villain with the highest Attack captures 3 Bystanders.",
    evilWins: "When 15 Bystanders are in the KO pile and/or Escape Pile.",
  },
  {
    name: "Predict Future Crime",
    exp: "civil_war",
    overrides: { twists: 6, villainCountDelta: 1 },
    setupNote: "Add an extra Villain Group.",
    twist: "Reveal the top 3 cards of the Villain Deck. Play each Villain you revealed. Put the rest back in any order.",
    evilWins: "When there are 2 Villains per player in the Escape Pile.",
  },
  {
    name: "Reveal Heroes' Secret Identities",
    exp: "civil_war",
    overrides: { twists: 6, heroCount: 7 },
    setupNote: "",
    twist:
      'Put a Hero from the HQ next to the Scheme as an "Unmasked" Hero. All cards with "Unmasked" Hero Names cost +1 Recruit to recruit. You can\'t Unmask a Hero Name that has already been Unmasked.',
    evilWins: "When 5 Heroes are Unmasked.",
  },
  {
    name: "United States Split by Civil War",
    exp: "civil_war",
    overrides: { twists: 10 },
    setupNote: "",
    twist:
      'If there is a Villain on the Streets or Bridge, put this Twist in a stack of "Western States Victories." Otherwise, if there is a Villain in the Sewers, put this Twist in a stack of "Eastern States Victories."',
    evilWins: "When there are 3 Western Victories or 3 Eastern Victories.",
  },
  {
    name: "Avengers vs. X-Men",
    exp: "civil_war",
    overrides: { twists: 9, heroCount: 6, heroTeamSplit: { count: 2, perTeam: 3 } },
    setupNote: "Hero Deck has 3 Heroes of one Team and 3 Heroes of another Team (Avengers, X-Men, Guardians, Marvel Knights, etc.).",
    twist:
      "Twists 1–7: Each player reveals their hand. Each player that has cards of both those Teams gains a Wound.\nTwist 8: Evil wins!",
    evilWins: "See Twist 8.",
  },
  {
    name: "Dark Reign of H.A.M.M.E.R. Officers",
    exp: "civil_war",
    overrides: { twists: 7 },
    setupNote: "",
    twist:
      "Stack this Twist next to the Scheme. Then, for each Twist in that stack, put a S.H.I.E.L.D. Officer next to the Mastermind as a 3-Attack Villain with S.H.I.E.L.D. Clearance. You can fight them to gain them as Heroes.",
    evilWins: "When there are 7 Officers next to the Mastermind.",
  },
  {
    name: "Epic Super Hero Civil War",
    exp: "civil_war",
    overrides: { twistsByPlayers: { 1: 9, 2: 9, 3: 9, 4: 6, 5: 6 }, heroCountByPlayers: { 1: 4 } },
    setupNote: "",
    twist: "Stack this Twist next to the Scheme. Then, for each Twist in that stack, KO a Hero from the HQ and immediately refill that HQ space.",
    evilWins: "When the Hero Deck runs out.",
  },
  {
    name: "Imprison Unregistered Superhumans",
    exp: "civil_war",
    overrides: { twists: 11 },
    setupNote: "",
    twist:
      "Twists 1, 3, 5, 7, 9: This Scheme fortifies the city space to its right, starting with the Bridge. Villains in that space get +1 Attack.\nOther Twists: If there's a Villain in that fortified city space, KO a Bystander.",
    evilWins: "When 3 Bystanders are in the KO pile and/or Escape Pile.",
  },

  // The four Deadpool schemes below are transcribed directly from the
  // physical cards.
  {
    name: "Deadpool Kills the Marvel Universe",
    exp: "deadpool",
    overrides: { requiredHero: "Deadpool", heroCountByPlayers: { 2: 4 }, twistsByPlayers: { 1: 6, 2: 6, 3: 6, 4: 5, 5: 5 } },
    setupNote: "Use Deadpool as one of the Heroes.\n2 players: Use 4 Heroes total.",
    twist: "Reveal cards from the Hero Deck until you reveal a Deadpool card. KO all the cards you revealed.",
    evilWins: "When the Hero Deck runs out.",
  },
  {
    name: "Deadpool Wants a Chimichanga",
    exp: "deadpool",
    overrides: { twists: 6, bystanders: 12, villainCountByPlayers: { 3: 4, 4: 5, 5: 6 } },
    setupNote:
      'All Bystanders represent "Chimichangas" (they\'re Bystanders too). 3-5 players: add a Villain Group.\n"Nobody Eats Just One Chimichanga!": Whenever you play a Chimichanga from the Villain Deck, play another card from the Villain Deck.',
    twist:
      "Put each Chimichanga from the city into the Escape Pile. Then, each player shuffles a Chimichanga from their Victory Pile back into the Villain Deck. Any player who cannot do so gains a Wound.",
    evilWins: "When 6 Chimichangas are in the Escape Pile.",
  },
  {
    name: "Deadpool Writes a Scheme",
    exp: "deadpool",
    overrides: { requiredHero: "Deadpool", twists: 6 },
    setupNote: 'Use the best Hero in the game: Deadpool! Add 6 Twists of Lemon, shake vigorously, and I\'ll make it up as I go.',
    twist:
      'Twist 1: Everybody draws 1 card.\nTwist 2: Anyone without a Deadpool in hand discards 2 cards.\nTwist 3: Play 3 cards from the Villain Deck.\nTwist 4: Each Villain captures 4 Bystanders.\nTwist 5: Each player gains 5 Wounds.\nTwist 6: Deadpool wins 6 times!',
    evilWins: "See Twist 6.",
  },
  {
    name: "Everybody Hates Deadpool",
    exp: "deadpool",
    overrides: { requiredHeroTeam: "Mercs For Money", twists: 6 },
    setupNote:
      "Use at least 1 Mercs For Money Hero.\nSpecial Rules: All Villains have Revenge for their own Villain Groups. (If they already have Revenge, double it.)",
    twist: "Each player reveals their hand. Whoever reveals the fewest Mercs For Money cards (or tied for fewest) gains a Wound.",
    evilWins: "When 3 Villains per player have escaped.",
  },

  // The four Doctor Strange and the Shadows of Nightmare schemes below
  // are transcribed directly from the physical cards.
  {
    name: "Cursed Pages of the Darkhold Tome",
    exp: "dr_strange",
    overrides: { twists: 11, villainCountDelta: 1 },
    setupNote:
      '11 Twists represent Cursed Pages of the Darkhold Tome.\nSpecial Rules: Cursed Pages are Ritual Artifacts with "If you fought a Villain or Mastermind, you may discard this to get +3 Recruit."',
    twist:
      "Put this Cursed Page next to the Mastermind, plus a Cursed Page from any player's control or discard pile or the KO pile. For this turn only, the first time you fight a Villain or Mastermind, put one of the Mastermind's Cursed Pages into your discard pile.",
    evilWins: "When the Mastermind has 7 Cursed Pages at the end of any player's turn or the Villain Deck runs out.",
  },
  {
    name: "Duels of Science and Magic",
    exp: "dr_strange",
    overrides: { twistsByPlayers: { 1: 10, 2: 9, 3: 11, 4: 10, 5: 11 } },
    setupNote: "",
    twist:
      'Twist 1, 3, and 5 ("Duel of Science"): Each player reveals a Tech or Ranged Hero or discards down to 4 cards. If at least half the players (round up) failed to reveal, put this Twist next to the Mastermind as a "Duel Won."\nTwist 2, 4, and 6 ("Duel of Magic"): Same effect, but with Strength or Instinct.\nTwist 7-11 ("Duel of Science and Magic"): Same effect, but each player must reveal at least three of these types: Strength, Instinct, Tech, Ranged.',
    evilWins: "When the Mastermind has won 5 Duels.",
  },
  {
    name: "Claim Souls for Demons",
    exp: "dr_strange",
    overrides: { twists: 8 },
    setupNote: "",
    twist:
      'Twist 1-3: Each player makes a Demonic Bargain to rescue a Bystander. If that Bargain wounds that player, stack that Bystander next to the Scheme as a "Tormented Soul" instead.\nTwist 4-8: Each player makes a Demonic Bargain to gain a S.H.I.E.L.D. Officer. If that Bargain wounds that player, stack that Officer next to the Scheme as a "Tormented Soul" instead.',
    evilWins: "When the number of Tormented Souls is four times the number of players.",
  },
  {
    name: "War for the Dream Dimension",
    exp: "dr_strange",
    overrides: { twists: 7, villainCountDelta: 1 },
    setupNote: "",
    twist:
      "Reveal the top two cards of the Villain Deck. The Villain you revealed with the highest printed Attack enters the Astral Plane. (It does not do any Ambush abilities.) If you revealed a second Villain this way, that Villain enters the city. Put the rest of the revealed cards back in any order.",
    evilWins: "When there are 3 Villains per player in the Escape Pile or the Villain Deck runs out.",
  },

  // The four Fantastic Four schemes below are transcribed directly from
  // the physical cards.
  {
    name: "Bathe Earth in Cosmic Rays",
    exp: "fantastic_four",
    overrides: { twists: 6 },
    setupNote: "",
    twist:
      "Each player in turn does the following: Reveal your hand. KO one of your non-grey Heroes. Choose a Hero from the HQ with the same or lower cost and put it into your hand.",
    evilWins: "When the number of non-grey Heroes in the KO pile is six times the number of players.",
  },
  {
    name: "Flood the Planet with Melted Glaciers",
    exp: "fantastic_four",
    overrides: { twists: 8 },
    setupNote: "",
    twist:
      'Stack this Twist next to the Scheme as "Rising Waters." Then KO each Hero from the HQ whose cost is less than or equal to the number of Rising Waters in that stack.',
    evilWins: "When 20 non-grey Heroes are KO'd.",
  },
  {
    name: "Invincible Force Field",
    exp: "fantastic_four",
    overrides: { twists: 7 },
    setupNote: "",
    twist:
      'Stack this Twist next to the Mastermind as a "Force Field."\nSpecial Rules: To fight the Mastermind, you must also spend 1 Recruit or 1 Attack for each Force Field next to them.\nTwist 7: Evil wins!',
    evilWins: "See Twist 7.",
  },
  {
    name: "Pull Reality into the Negative Zone",
    exp: "fantastic_four",
    overrides: { twists: 8 },
    setupNote: "",
    twist: "Twist 2, 4, and 6: Until the next Twist, Enemies cost Recruit to fight and Heroes cost Attack to recruit.\nTwist 7: Evil wins!",
    evilWins: "See Twist 7.",
  },

  // The three Legendary: Villains — Fear Itself Plots below are
  // transcribed directly from the physical cards. Like the base
  // "villains" expansion, these use "Good Wins" instead of "Evil Wins" —
  // see `winLabel` above.
  {
    name: "Last Stand at Avengers Tower",
    exp: "fear_itself",
    overrides: { twists: 6 },
    setupNote: "",
    twist:
      'Stack this Twist above the Rooftops as "StarkTech Defenses." If there is an Adversary on the Rooftops, choose 3 Allies from the Lair & KO them.\nSpecial Rules: While an Adversary is on the Rooftops, it gets +1 Attack for each StarkTech Defenses.',
    evilWins: "When there are 13 non-grey Allies in the KO pile.",
    winLabel: "Good Wins",
  },
  {
    name: "Fear Itself",
    exp: "fear_itself",
    overrides: { twists: 10, heroCount: 8 },
    setupNote: 'Earth\'s "Fear Level" starts at 8. The number of Allies in the Lair is always equal to the Fear Level.',
    twist: "KO an Ally from the Lair. The Fear Level goes down by 1.",
    evilWins: "When the Fear Level is 0.",
    winLabel: "Good Wins",
  },
  {
    name: "The Traitor",
    exp: "fear_itself",
    overrides: { twists: 8 },
    setupNote:
      "2+ players only. Shuffle a 'Betrayal Deck' of 3 Bindings per player and a 9th Twist.\nSpecial Rules: During your turn, you may reveal a Twist from your Betrayal Cards to become 'the Traitor.' If you do, each other player gains all the Bindings from their Betrayal Cards. During your turns, you may spend 4 Attack any number of times to play an additional card from the Adversary Deck.\nWhen the players win: the Traitor reveals themself and loses (despite their team winning).",
    twist: "Twists 1-3: If there is no revealed Traitor, each player puts a 'Betrayal Card' from the Betrayal Deck face down in front of them and looks at it.",
    evilWins: "Twist 8: Good wins! The Traitor reveals themself and also wins.",
    winLabel: "Good Wins",
  },

  // The four Guardians of the Galaxy schemes below are transcribed
  // directly from the physical cards.
  {
    name: "Forge the Infinity Gauntlet",
    exp: "guardians",
    overrides: { twists: 8, requiredVillainGroup: "Infinity Gems" },
    setupNote: "",
    twist:
      "Starting to your left and going clockwise, the first player with an Infinity Gem Artifact card in play or in their discard pile chooses one of those Infinity Gems to enter the city. Then put a Shard on each Infinity Gem in the city.",
    evilWins:
      "When 6 Infinity Gem Villains are in the city and/or the Escape Pile.\nAlso: When a player controls 4 Infinity Gem Artifacts, that player is corrupted by power. That player wins, Evil wins, and all other players lose.",
  },
  {
    name: "Intergalactic Kree Nega-Bomb",
    exp: "guardians",
    overrides: { twists: 8 },
    setupNote: "Make a face-down 'Nega-Bomb Deck' of 6 Bystanders.",
    twist:
      "Shuffle this Twist into the Nega-Bomb Deck. Then reveal a random card from that deck. If it's a Bystander, rescue it. If it's a Twist, KO it, KO all Heroes from the HQ, and each player gains a Wound.",
    evilWins: "When 16 non-grey Heroes are in the KO pile.",
  },
  {
    name: "The Kree-Skrull War",
    exp: "guardians",
    overrides: { twists: 8, requiredVillainGroups: ["Kree Starforce", "Skrulls"] },
    setupNote: "",
    twist:
      "Twists 1-7: All Kree and Skrulls escape from the city. Then, if there are more Kree than Skrulls in the Escape Pile, stack this Twist next to the Mastermind as a Kree Conquest. If there are more Skrulls than Kree in the Escape Pile, stack this Twist next to the Villain Deck as a Skrull Conquest.\nTwist 8: Stack this Twist on the side with the most Conquests.",
    evilWins: "When there are 4 Kree Conquests or 4 Skrull Conquests.",
  },
  {
    name: "Unite the Shards",
    exp: "guardians",
    overrides: { twistsByPlayers: { 1: 6, 2: 7, 3: 8, 4: 9, 5: 10 } },
    setupNote: "30 Shards in the supply.\nSpecial Rules: During your turn, any number of times, you may spend 2 Recruit to gain one of the Mastermind's Shards.",
    twist: "Stack this Twist next to the Scheme. Then for each Twist in that stack, the Mastermind gains a Shard.",
    evilWins: "When the Mastermind has 10 Shards or when there are no more Shards in the supply.",
  },

  // The four Heroes of Asgard schemes below are transcribed directly
  // from the physical cards.
  {
    name: "Asgardian Test of Worth",
    exp: "asgard",
    overrides: { twists: 11 },
    setupNote: "",
    twist:
      'Twists 1-7: Each player who is not Worthy discards a card. Then, if at least half the players (round up) are not Worthy, put this Twist next to the Scheme as a "Moral Failing."\nTwists 8-11: Put this Twist next to the Scheme as a "Moral Failing."',
    evilWins: "When there are 5 Moral Failings.",
  },
  {
    name: "The Dark World of Svartalfheim",
    exp: "asgard",
    overrides: { twists: 10 },
    setupNote: "",
    twist:
      'Put this Twist next to a city space or HQ space that doesn\'t already have one, as "Eternal Darkness."\nSpecial Rules: Villains in city spaces with Eternal Darkness get +1 Attack. To recruit a Hero in an HQ space with Eternal Darkness, you must pay an extra 1 Recruit.',
    evilWins: "When all city spaces or all HQ spaces are covered in Eternal Darkness.",
  },
  {
    name: "Ragnarok, Twilight of the Gods",
    exp: "asgard",
    overrides: { twists: 11 },
    setupNote: "",
    twist:
      'Choose a Villain from your Victory Pile worth at least 2VP to enter the city. Then, if the total Attack of Villains in the city is at least as high as the Guardian Attack listed below, put this Twist next to the Scheme as a "Guardian Defeated."\nTwist 1: Balder, 11 Attack\nTwist 2: Odin, 24 Attack\nTwist 3: Vidar, 19 Attack\nTwist 4: Tyr, 16 Attack\nTwist 5: Heimdall, 12 Attack\nTwist 6: Frey, 7 Attack\nTwist 7: Frigga, 8 Attack\nTwist 8-11: Warriors of Valhalla, 6 Attack',
    evilWins: "When there are 5 Guardians Defeated.",
  },
  {
    name: "War of the Frost Giants",
    exp: "asgard",
    overrides: { twists: 9 },
    setupNote: "",
    twist:
      'Twists 1-7: This Twist enters the city as a "Frost Giant Invader" Villain worth 6VP with 6 Attack and the ability "If you are not Worthy, this gets +4 Attack."\nTwists 8-9: Same effect, then a Frost Giant Invader from each player\'s Victory Pile enters the city.',
    evilWins: "When there are 5 Frost Giant Invaders in the city and/or Escape Pile.",
  },

  // The four Into the Cosmos schemes below are transcribed directly from
  // the physical cards.
  {
    name: "Annihilation: Conquest",
    exp: "into_the_cosmos",
    overrides: { twists: 11, heroCountDelta: 1 },
    setupNote: "",
    twist:
      'Put this Twist next to the Scheme as a "Phalanx Conquest." The highest-cost Hero from the HQ enters the city as a "Phalanx-Infected" Villain.\nSpecial Rules: Each "Phalanx-Infected" Villain has Attack equal to its cost, +1 Attack for each two Phalanx Conquests. If you fight one, choose a player to gain it as a Hero.',
    evilWins: "When there are 6 Phalanx-Infected in the city and/or Escape Pile, or the Villain Deck runs out.",
  },
  {
    name: "The Contest of Champions",
    exp: "into_the_cosmos",
    overrides: { twists: 11, heroCountDelta: 1 },
    setupNote: 'Put 11 random cards from the Hero Deck face up in a "Contest Row."',
    twist:
      'Twist 1-4: KO the leftmost card from the Contest Row, then Contest of Champions for that card\'s color(s). Each player that loses discards a card. If the Mastermind wins, put a Wound next to this Scheme as an "Evil Triumph."\nTwist 5-8: Same effect, but in the Contest, Evil selects from 4 cards from the Hero Deck.\nTwist 9-11: Same effect, but in the Contest, Evil selects from 6 cards from the Hero Deck.',
    evilWins: "When there are 6 Evil Triumphs.",
  },
  {
    name: "Destroy the Nova Corps",
    exp: "into_the_cosmos",
    overrides: { twists: 9, requiredHero: "Nova", heroCountByPlayers: { 1: 5 } },
    setupNote:
      "Each player's starting deck adds 2 Wounds, 1 S.H.I.E.L.D. Officer, and a Nova card that costs 2.\nSpecial Rules: All S.H.I.E.L.D. Officers and Nova Heroes count as \"Nova Centurions.\"",
    twist:
      "Twist 1-5: Each player must reveal their hand and discard a Nova Centurion. Each player that discarded this way gains a Shard. Each player that didn't discard this way must KO a card from the S.H.I.E.L.D. Officer Stack.\nTwist 6-9: Each player must KO a Nova Centurion from the S.H.I.E.L.D. Officer Stack or from their hand or discard pile.",
    evilWins: "When there are 5 KO'd Nova Centurions per player.",
  },
  {
    name: "Turn the Soul of Adam Warlock",
    exp: "into_the_cosmos",
    overrides: {
      twists: 14,
      extraHeroName: "Adam Warlock",
      extraHeroNote: "14 cards form a face-up stack next to the Scheme (lowest-cost on top) — not the Villain Deck. See Twist.",
    },
    setupNote: "14 Twists (using 3 Wounds to represent extra Scheme Twists).",
    twist:
      'Set aside the top card of the Adam Warlock stack. This turn you may "Purify" it by spending Attack equal to double its cost. If you do, choose a player to gain that card, then you rescue a Bystander, and you may KO one of your Heroes. If you don\'t do this by the end of your turn, put that Adam Warlock card into a "Soul\'s Corruption" stack next to the Scheme.',
    evilWins: "When there are 8 Soul's Corruptions.",
  },

  // The four Messiah Complex "Veiled Scheme" cards below are transcribed
  // directly from the physical cards. Setup/Twists are the Veiled
  // Scheme's own — its last Twist Transforms it into one of four random
  // "Unveiled Scheme" cards (see UNVEILED_SCHEMES below), which carry
  // the actual Evil Wins condition and have no Setup/Twist count of
  // their own, so they're never independently selectable — instead,
  // `overrides.unveils: true` tells the app to roll one at random from
  // UNVEILED_SCHEMES (matching this Scheme's `exp`) the moment this
  // Scheme is selected, and display/reroll it as its own card (see
  // syncUnveiledScheme/rerollUnveiledScheme in app.js).
  {
    name: "Drain Mutants' Powers to...",
    exp: "messiah_complex",
    overrides: { twists: 11, unveils: true },
    setupNote: "",
    twist:
      'Twists 1-6: Stack the top two cards of the Sidekick Stack face down next to the Scheme as "Kidnapped Mutants." If there were any Kidnapped Mutants already there, put those on the bottom of the Sidekick Stack and put this Twist next to the Mastermind as a "Drained Power."\nSpecial Rules: Players may spend 3 Recruit or 3 Attack to gain a Kidnapped Mutant.\nTwist 7: KO all Kidnapped Mutants. This Scheme Transforms into a random Unveiled Scheme. Do its Twist effect.',
  },
  {
    name: "Hack Cerebro Servers to...",
    exp: "messiah_complex",
    overrides: { twists: 10, unveils: true },
    setupNote: "",
    twist:
      'Twists 1-5: Put a card from the Bystander Stack next to this Scheme as a "Hacker." KO a Hero from the HQ with cost equal to the number of Hackers. If you KO\'d a Hero this way, stack this Twist next to the Mastermind as "Stolen Cerebro Data."\nTwist 6: Put the Hackers on the bottom of the Bystander Stack. This Scheme Transforms into a random Unveiled Scheme. Do its Twist effect.',
  },
  {
    name: "Hire Singularity Investigations to...",
    exp: "messiah_complex",
    overrides: { twists: 9, unveils: true },
    setupNote: "",
    twist:
      'Twists 1-4: If there are any "Singularity Investigators" in the city, stack this Twist next to the Mastermind as a "Dark Discovery." Whether you did that or not, Investigate the Bystander Stack for a card and have it enter the city as a "Singularity Investigator" Villain. It has 6 Attack and "Fight: Rescue this as a Bystander. Then KO one of your Heroes. Then Investigate your deck for a card with a Recruit icon."\nTwist 5: This Scheme Transforms into a random Unveiled Scheme. Do its Twist effect.',
  },
  {
    name: "Raid Gene Banks to...",
    exp: "messiah_complex",
    overrides: { twists: 8, unveils: true },
    setupNote: "",
    twist:
      'Twists 1-3: If there is a Villain in the Bank, stack this Twist next to the Mastermind as a "Mutant Genome." Otherwise, move a Villain from another city space to the Bank.\nTwist 4: This Scheme Transforms into a random Unveiled Scheme. Do its Twist effect.',
  },

  // The four "Marvel Studios Ant-Man and the Wasp" Schemes below blend two
  // movie sub-brands' cards under one expansion (see "Marvel Studios: The
  // First Ten Years" for the same precedent) — two are from Ant-Man and
  // the Wasp, two are from Ant-Man and the Wasp: Quantumania.
  {
    name: "Auction Shrink Tech to Highest Bidder",
    exp: "ant_man_wasp",
    overrides: {
      twists: 11,
      extraHero: true,
      extraHeroKeyword: "Size-Changing",
      extraHeroNote: "all 14 cards form a \"Shrink Tech\" stack next to the Scheme — not the Villain Deck. See Twist.",
    },
    setupNote: 'Set aside all 14 cards of a random extra Hero that has any Size-Changing cards as "Shrink Tech."',
    twist:
      'Stack this Twist next to the Scheme as a "Hostile Bid." Reveal a random Hero from the Shrink Tech. This turn you may recruit that Hero, but it costs 1 Recruit more for each Hostile Bid. If you recruit it, either KO that Hero or choose any player to gain it. If you don\'t recruit it by the end of this turn, stack it next to the Scheme as "Controlled by Arms Dealers."',
    evilWins: "When 8 Shrink Tech cards are Controlled by Arms Dealers.",
  },
  {
    name: "Escape an Imprisoning Dimension",
    exp: "ant_man_wasp",
    overrides: { twists: 5 },
    setupNote:
      'Special Rules: During your turn, any number of times, you may spend 1 Attack to "Seal" an unsealed city space or unsealed Mastermind space by putting a card above it from the Wound Stack.',
    twist:
      'If any city space with a Villain in it or the Mastermind space is not "sealed," stack this Twist next to the Mastermind as a "Discovered Escape Route." Otherwise, return 3 Seals from above spaces to the Wound Deck, shuffle this Twist into the Villain Deck, and play another card from the Villain Deck.',
    evilWins: "When 3 Escape Routes have been discovered.",
  },
  {
    name: "Safeguard Dark Secrets",
    exp: "ant_man_wasp",
    overrides: { twists: 5 },
    setupNote:
      'Special Rules: You have the ability "Heist: You get +1 Recruit." Shuffle a Secret from next to the Mastermind into the Villain Deck.',
    twist: 'Stack this Twist next to the Mastermind as a "Secret," then play another card from the Villain Deck.',
    evilWins: "When the Mastermind has 5 Secrets.",
  },
  {
    name: "Siphon Energy from the Quantum Realm",
    exp: "ant_man_wasp",
    overrides: { twists: 9, requiredVillainGroup: "Quantum Realm", villainCountDelta: 1 },
    setupNote:
      'Set aside the "Quantum Realm" Villain Group as an extra group. Shuffle its Ambush Scheme into the Villain Deck.\nSpecial Rules: You may fight Villains on the Quantum Siphons. They get +1 Attack for each two Siphons.',
    twist:
      'Stack this Twist next to the Mastermind as a "Quantum Siphon." Put a random set aside Quantum Realm Villain on the Siphons. Do its Ambush effect. If there was already a Quantum Realm Villain on the Siphons, KO it.',
    evilWins: "When 4 Quantum Realm Villains have been KO'd or there are 9 Quantum Siphons.",
  },
];

// The four Messiah Complex "Unveiled Scheme" cards, transcribed directly
// from the physical cards. These aren't in SCHEMES since they can't be
// selected on their own (no Setup/Twist count of their own) — a
// `overrides.unveils` Scheme above rolls one at random and the app shows
// it alongside that Scheme's own info. `whenRevealed` covers the "When
// revealed" text (shown the moment the Scheme transforms); `twist` and
// `evilWins` behave exactly like a normal Scheme's.
const UNVEILED_SCHEMES = [
  {
    name: "...Open Rifts to Future Timelines",
    exp: "messiah_complex",
    whenRevealed: 'Shuffle a random additional Villain Group into the Villain Deck. Twists stacked next to the Mastermind are "Temporal Rifts."',
    twist:
      "Add this Twist to the Temporal Rifts. Then reveal and set aside cards from the Villain Deck equal to the number of Temporal Rifts. Play a Henchman you revealed, then play the Villain you revealed that is worth the most VP. Shuffle the other set aside cards into the Villain Deck. (If the Villain Deck runs out during this, that doesn't end the game.)",
    evilWins: "When there are 7 Temporal Rifts or the Villain Deck runs out.",
  },
  {
    name: "...Control the Mutant Messiah",
    exp: "messiah_complex",
    whenRevealed: 'Twists stacked next to the Mastermind are "Manipulations." Shuffle a random extra Hero into a face-down "Mutant Messiah" stack.',
    twist:
      'Add this Twist to the Manipulations. Investigate the Mutant Messiah stack for a card and set it aside. This turn you may gain that card to the top of your deck by spending Recruit equal to its cost, +1 Recruit for each Manipulation. If you don\'t, then put that card into a "Fallen Messiah" stack next to the Scheme.',
    evilWins: "When there are 3 cards in the Fallen Messiah stack or the Villain Deck runs out.",
  },
  {
    name: "...Reveal the Heroes' Evil Clones",
    exp: "messiah_complex",
    whenRevealed: 'Twists stacked next to the Mastermind are "Cloning Breakthroughs."',
    twist:
      'Add this Twist to the Cloning Breakthroughs. The top card of the Hero Deck enters the city as an "Evil Clone" Villain. Clone a copy of it from the HQ or Hero Deck as another Evil Clone.\nSpecial Rules: Each Evil Clone has Attack equal to its cost plus the number of Cloning Breakthroughs. It has "Fight: A player gains this as a Hero. KO one of your Heroes."',
    evilWins: "When there are 7 Evil Clones in the city and/or Escape Pile, or the Villain Deck or Hero Deck runs out.",
  },
  {
    name: "...Unleash an Anti-Mutant Bioweapon",
    exp: "messiah_complex",
    whenRevealed: 'Twists stacked next to the Mastermind are "Bioweapon Adaptations."',
    twist:
      "Add this Twist to the Bioweapon Adaptations. Then for each card in that stack, choose a different number from 2-6. KO all Heroes from the HQ that have any of those costs.",
    evilWins: "When there are 15 non-grey Heroes in the KO pile or the Villain Deck or Hero Deck runs out.",
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

  { name: "Emissaries of Evil", exp: "dark_city" },
  { name: "Four Horsemen", exp: "dark_city" },
  { name: "Marauders", exp: "dark_city" },
  { name: "MLF", exp: "dark_city" },
  { name: "Streets of New York", exp: "dark_city" },
  { name: "Underworld", exp: "dark_city" },

  { name: "Heralds of Galactus", exp: "fantastic_four" },
  { name: "Subterranea", exp: "fantastic_four" },

  { name: "Sinister Syndicate", exp: "paint_town_red" },

  { name: "Infinity Gems", exp: "guardians" },
  { name: "Kree Starforce", exp: "guardians" },

  { name: "Dark Council", exp: "asgard" },
  { name: "Omens of Ragnarok", exp: "asgard" },

  { name: "Black Order of Thanos", exp: "into_the_cosmos" },
  { name: "Celestials", exp: "into_the_cosmos" },
  { name: "Elders of the Universe", exp: "into_the_cosmos" },
  { name: "From Beyond", exp: "into_the_cosmos" },

  { name: "Acolytes", exp: "messiah_complex" },
  { name: "Clan Yashida", exp: "messiah_complex" },
  { name: "Purifiers", exp: "messiah_complex" },
  { name: "Reavers", exp: "messiah_complex" },

  { name: "Reavers", exp: "x_men" },
  { name: "Marauders", exp: "x_men" },

  { name: "Queen's Vengeance", exp: "ant_man" },
  { name: "Ultron's Legacy", exp: "ant_man" },
  { name: "Klyntar Symbiotes", exp: "venom" },
  { name: "Fear Lords", exp: "dr_strange" },
  { name: "Lords of the Netherworld", exp: "dr_strange" },
  { name: "The Mighty", exp: "fear_itself" },

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

  { name: "Chitauri", exp: "first_ten_years" },
  { name: "Enemies of Asgard", exp: "first_ten_years" },
  { name: "Gamma Hunters", exp: "first_ten_years" },
  { name: "HYDRA", exp: "first_ten_years" },
  { name: "Iron Foes", exp: "first_ten_years" },

  { name: "Black Order Guards", exp: "what_if" },
  { name: "Intergalactic Party Animals", exp: "what_if" },
  { name: "Rival Overlords", exp: "what_if" },
  { name: "Strange's Demons", exp: "what_if" },
  { name: "Zombie Avengers", exp: "what_if", keywords: ["Rise of the Living Dead"] },

  // Doctor Octopus (core_2nd) leads any group with "Sinister" in its
  // name, and Magneto any with "Brotherhood" or "X-Men" — a name-match,
  // not a curated `keywords` tag, so nothing extra needs setting on
  // these entries beyond the name itself; see Mastermind `leads` above.
  { name: "Brotherhood of Mutants", exp: "core_2nd" },
  { name: "Enemies of Asgard", exp: "core_2nd" },
  { name: "Hydra", exp: "core_2nd" },
  { name: "Masters of Evil", exp: "core_2nd" },
  { name: "Radiation", exp: "core_2nd" },
  { name: "Sinister Spider-Foes", exp: "core_2nd" },
  { name: "Skrulls", exp: "core_2nd" },
  { name: "Sinister Syndicate", exp: "core_2nd" },

  { name: "Alchemax Enforcers", exp: "2099" },
  { name: "False Aesir of Alchemax", exp: "2099" },

  { name: "Annihilation Wave", exp: "annihilation" },
  { name: "Timelines of Kang", exp: "annihilation" },

  { name: "Enemies of Wakanda", exp: "black_panther" },
  { name: "Killmonger's League", exp: "black_panther" },

  { name: "Elite Assassins", exp: "black_widow" },
  { name: "Taskmaster's Thunderbolts", exp: "black_widow" },

  { name: "Masters of Evil (WWII)", exp: "cap_75" },
  { name: "Zola's Creations", exp: "cap_75" },

  { name: "Monsters Unleashed", exp: "champions" },
  { name: "Wrecking Crew", exp: "champions" },

  { name: "CSA Special Marshals", exp: "civil_war" },
  { name: "Great Lake Avengers", exp: "civil_war" },
  { name: "Heroes for Hire", exp: "civil_war" },
  { name: "Registration Enforcers", exp: "civil_war" },
  { name: "S.H.I.E.L.D. Elite", exp: "civil_war" },
  { name: "Superhuman Registration Act", exp: "civil_war" },
  { name: "Thunderbolts", exp: "civil_war" },

  { name: "Deadpool's \"Friends\"", exp: "deadpool" },
  { name: "Evil Deadpool Corpse", exp: "deadpool" },

  { name: "Armada of Kang", exp: "ant_man_wasp" },
  { name: "Cross Technologies", exp: "ant_man_wasp" },
  { name: "Ghost Chasers", exp: "ant_man_wasp" },
  { name: "Quantum Realm", exp: "ant_man_wasp" },
];

const HENCHMEN = [
  { name: "Doombot Legion", exp: "core" },
  { name: "Hand Ninjas", exp: "core" },
  { name: "Sentinel", exp: "core" },
  { name: "Savage Land Mutates", exp: "core" },

  { name: "Maggia Goons", exp: "dark_city" },
  { name: "Phalanx", exp: "dark_city" },

  { name: "Prime Sentinels", exp: "x_men" },

  // Legendary: Villains — these are the good guys' Adversary squads.
  { name: "Asgardian Warrior", exp: "villains" },
  { name: "Cops", exp: "villains" },
  { name: "Multiple Man", exp: "villains" },
  { name: "S.H.I.E.L.D. Assault Squad", exp: "villains" },

  { name: "Hydra Pilots", exp: "first_ten_years" },
  { name: "Hammer Drone Army", exp: "first_ten_years" },
  { name: "Hydra Spies", exp: "first_ten_years" },
  { name: "Ten Rings Fanatics", exp: "first_ten_years" },

  { name: "Giants of Jotunheim", exp: "what_if" },
  { name: "Ultron Sentries", exp: "what_if" },
  { name: "Vibranium Liberator Drones", exp: "what_if" },

  { name: "Doombot Legion", exp: "core_2nd" },
  { name: "Hand Ninjas", exp: "core_2nd" },
  { name: "Savage Land Mutates", exp: "core_2nd" },
  { name: "Sentinel", exp: "core_2nd" },

  { name: "Cape-Killers", exp: "civil_war" },
  { name: "Mandroid", exp: "civil_war" },

  { name: "Circus of Crime", exp: "dimensions" },
  { name: "Spider-Slayer", exp: "dimensions" },

  { name: "Sidera Maris, Bridge Builders", exp: "into_the_cosmos" },
  { name: "Universal Church of Truth", exp: "into_the_cosmos" },

  { name: "Mr. Sinister Clones", exp: "messiah_complex" },
  { name: "Sentinel Squad O*N*E*", exp: "messiah_complex" },

  { name: "Quantumnauts", exp: "ant_man_wasp" },
  { name: "Quantum Hound", exp: "ant_man_wasp" },
  { name: "Tardigrade", exp: "ant_man_wasp" },
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

  { name: "Angel", exp: "dark_city", team: "X-Men" },
  { name: "Bishop", exp: "dark_city", team: "X-Men" },
  { name: "Blade", exp: "dark_city", team: "Marvel Knights" },
  { name: "Cable", exp: "dark_city", team: "X-Force" },
  { name: "Colossus", exp: "dark_city", team: "X-Force" },
  { name: "Daredevil", exp: "dark_city", team: "Marvel Knights" },
  { name: "Domino", exp: "dark_city", team: "X-Force" },
  { name: "Elektra", exp: "dark_city", team: "Marvel Knights" },
  { name: "Forge", exp: "dark_city", team: "X-Force" },
  { name: "Ghost Rider", exp: "dark_city", team: "Marvel Knights" },
  { name: "Iceman", exp: "dark_city", team: "X-Men" },
  { name: "Iron Fist", exp: "dark_city", team: "Marvel Knights" },
  { name: "Jean Grey", exp: "dark_city", team: "X-Men" },
  { name: "Nightcrawler", exp: "dark_city", team: "X-Men" },
  { name: "Professor X", exp: "dark_city", team: "X-Men" },
  { name: "Punisher", exp: "dark_city", team: "Marvel Knights" },
  { name: "Wolverine", exp: "dark_city", team: "X-Force" },

  { name: "Human Torch", exp: "fantastic_four", team: "Fantastic Four" },
  { name: "Invisible Woman", exp: "fantastic_four", team: "Fantastic Four" },
  { name: "Mr. Fantastic", exp: "fantastic_four", team: "Fantastic Four" },
  { name: "Silver Surfer", exp: "fantastic_four" },
  { name: "Thing", exp: "fantastic_four", team: "Fantastic Four" },

  // Legendary: Villains — Fear Itself: like the base "villains" expansion,
  // these are the player-controlled Villain characters (going in HEROES —
  // see the exclusiveMode note at the top of this file).
  { name: "Greithoth, Breaker of Wills", exp: "fear_itself", team: "Foes of Asgard" },
  { name: "Kuurth, Breaker of Stone", exp: "fear_itself", team: "Foes of Asgard" },
  { name: "Nerkkod, Breaker of Oceans", exp: "fear_itself", team: "Foes of Asgard" },
  { name: "Nul, Breaker of Worlds", exp: "fear_itself", team: "Foes of Asgard" },
  { name: "Skadi", exp: "fear_itself", team: "HYDRA" },
  { name: "Skirn, Breaker of Men", exp: "fear_itself", team: "Foes of Asgard" },

  { name: "Spider-Woman", exp: "paint_town_red" },
  { name: "Silk", exp: "paint_town_red" },
  { name: "Spider-Man 2099", exp: "paint_town_red" },
  { name: "Scarlet Spider", exp: "paint_town_red" },
  { name: "Agent Venom", exp: "paint_town_red" },

  { name: "Drax the Destroyer", exp: "guardians", team: "Guardians of the Galaxy" },
  { name: "Gamora", exp: "guardians", team: "Guardians of the Galaxy" },
  { name: "Groot", exp: "guardians", team: "Guardians of the Galaxy" },
  { name: "Rocket Raccoon", exp: "guardians", team: "Guardians of the Galaxy" },
  { name: "Star-Lord", exp: "guardians", team: "Guardians of the Galaxy" },

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

  { name: "Gwenpool", exp: "champions", team: "Champions", keywords: ["Size-Changing"] },
  { name: "Ms. Marvel", exp: "champions", team: "Champions", keywords: ["Size-Changing"] },
  { name: "Nova", exp: "champions", team: "Champions", keywords: ["Size-Changing"] },
  { name: "Totally Awesome Hulk", exp: "champions", team: "Champions", keywords: ["Size-Changing"] },
  { name: "Viv Vision", exp: "champions", team: "Champions", keywords: ["Size-Changing"] },

  { name: "Captain America, Secret Avenger", exp: "civil_war", team: "Avengers" },
  { name: "Cloak & Dagger", exp: "civil_war", team: "Avengers" },
  { name: "Daredevil", exp: "civil_war", team: "Avengers" },
  { name: "Falcon", exp: "civil_war", team: "Avengers" },
  { name: "Goliath", exp: "civil_war", team: "Avengers", keywords: ["Size-Changing"] },
  { name: "Hercules", exp: "civil_war", team: "Avengers" },
  { name: "Hulkling", exp: "civil_war", team: "Avengers", keywords: ["Size-Changing"] },
  { name: "Luke Cage", exp: "civil_war", team: "Avengers" },
  { name: "Patriot", exp: "civil_war", team: "Avengers" },
  { name: "Peter Parker", exp: "civil_war", team: "Avengers" },
  { name: "Speedball", exp: "civil_war", team: "New Warriors" },
  { name: "Stature", exp: "civil_war", team: "Avengers", keywords: ["Size-Changing"] },
  { name: "Storm & Black Panther", exp: "civil_war", team: "Avengers" },
  { name: "Tigra", exp: "civil_war", team: "Avengers" },
  { name: "Vision", exp: "civil_war", team: "Avengers", keywords: ["Size-Changing"] },
  { name: "Wiccan", exp: "civil_war", team: "Avengers" },

  { name: "Brainstorm", exp: "annihilation", team: "Fantastic Four" },
  { name: "Fantastic Four United", exp: "annihilation", team: "Fantastic Four" },
  { name: "Heralds of Galactus", exp: "annihilation" },
  { name: "Psi-Lord", exp: "annihilation", team: "Fantastic Four" },
  { name: "Super-Skrull", exp: "annihilation" },

  { name: "Ant-Man", exp: "ant_man", team: "Avengers", keywords: ["Size-Changing"] },
  { name: "Black Knight", exp: "ant_man", team: "Avengers" },
  { name: "Jocasta", exp: "ant_man", team: "Avengers", keywords: ["Size-Changing"] },
  { name: "Wasp", exp: "ant_man", team: "Avengers", keywords: ["Size-Changing"] },
  { name: "Wonder Man", exp: "ant_man", team: "Avengers", keywords: ["Size-Changing"] },

  { name: "Agent X-13", exp: "cap_75", team: "S.H.I.E.L.D." },
  { name: "Captain America (Falcon)", exp: "cap_75", team: "Avengers" },
  { name: "Captain America 1941", exp: "cap_75", team: "Avengers" },
  { name: "Steve Rogers, Director of S.H.I.E.L.D.", exp: "cap_75", team: "S.H.I.E.L.D." },
  { name: "Winter Soldier", exp: "cap_75" },

  { name: "Bob, Agent of HYDRA", exp: "deadpool", team: "HYDRA" },
  { name: "Deadpool", exp: "deadpool", team: "Mercs For Money" },
  { name: "Slapstick", exp: "deadpool", team: "Mercs For Money" },
  { name: "Solo", exp: "deadpool", team: "Mercs For Money" },
  { name: "Stingray", exp: "deadpool", team: "Mercs For Money" },

  { name: "Howard the Duck", exp: "dimensions" },
  { name: "Jessica Jones", exp: "dimensions", team: "Marvel Knights" },
  { name: "Man-Thing", exp: "dimensions" },
  { name: "Ms. America", exp: "dimensions", team: "Avengers" },
  { name: "Squirrel Girl", exp: "dimensions", team: "Avengers" },

  { name: "The Ancient One", exp: "dr_strange" },
  { name: "Clea", exp: "dr_strange", team: "Marvel Knights" },
  { name: "Doctor Strange", exp: "dr_strange", team: "Avengers" },
  { name: "Doctor Voodoo", exp: "dr_strange", team: "Avengers" },
  { name: "The Vishanti", exp: "dr_strange" },

  { name: "Beta Ray Bill", exp: "asgard", team: "Heroes of Asgard" },
  { name: "Lady Sif", exp: "asgard", team: "Heroes of Asgard" },
  { name: "Thor", exp: "asgard", team: "Heroes of Asgard" },
  { name: "Valkyrie", exp: "asgard", team: "Heroes of Asgard" },
  { name: "The Warriors Three", exp: "asgard", team: "Heroes of Asgard" },

  { name: "Adam Warlock", exp: "into_the_cosmos", team: "Avengers" },
  { name: "Captain Mar-Vell", exp: "into_the_cosmos", team: "Avengers" },
  { name: "Moondragon", exp: "into_the_cosmos", team: "Avengers" },
  { name: "Nebula", exp: "into_the_cosmos", team: "Guardians of the Galaxy" },
  { name: "Nova", exp: "into_the_cosmos", team: "Avengers" },
  { name: "Phyla-Vell", exp: "into_the_cosmos", team: "Guardians of the Galaxy" },
  { name: "Quasar", exp: "into_the_cosmos", team: "Avengers" },
  { name: "Ronan the Accuser", exp: "into_the_cosmos" },
  { name: "Yondu", exp: "into_the_cosmos", team: "Guardians of the Galaxy" },

  { name: "M", exp: "messiah_complex", team: "X-Factor Investigations" },
  { name: "Multiple Man", exp: "messiah_complex", team: "X-Factor Investigations" },
  { name: "Rictor", exp: "messiah_complex", team: "X-Factor Investigations" },
  { name: "Shatterstar", exp: "messiah_complex", team: "X-Force" },
  { name: "Siryn", exp: "messiah_complex", team: "X-Factor Investigations" },
  { name: "Stepford Cuckoos", exp: "messiah_complex", team: "X-Men" },
  { name: "Strong Guy", exp: "messiah_complex", team: "X-Factor Investigations" },
  { name: "Warpath", exp: "messiah_complex", team: "X-Force" },

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

  { name: "Black Widow", exp: "first_ten_years", team: "Avengers" },
  { name: "Captain America", exp: "first_ten_years", team: "Avengers" },
  { name: "Hawkeye", exp: "first_ten_years", team: "Avengers" },
  { name: "Hulk", exp: "first_ten_years", team: "Avengers" },
  { name: "Iron Man", exp: "first_ten_years", team: "Avengers" },
  { name: "Nick Fury", exp: "first_ten_years", team: "S.H.I.E.L.D." },
  { name: "Thor", exp: "first_ten_years", team: "Avengers" },

  { name: "Apocalyptic Black Widow", exp: "what_if", team: "Guardians of the Multiverse" },
  { name: "Captain Carter", exp: "what_if", team: "Guardians of the Multiverse" },
  { name: "Doctor Strange Supreme", exp: "what_if", team: "Guardians of the Multiverse" },
  { name: "Gamora, Destroyer of Thanos", exp: "what_if", team: "Guardians of the Multiverse" },
  { name: "Killmonger, Spec Ops", exp: "what_if", team: "Guardians of the Multiverse" },
  { name: "Party Thor", exp: "what_if", team: "Guardians of the Multiverse" },
  { name: "Star-Lord T'Challa", exp: "what_if", team: "Guardians of the Multiverse" },
  { name: "Uatu, The Watcher", exp: "what_if", team: "Guardians of the Multiverse" },

  { name: "Black Widow", exp: "core_2nd", team: "Avengers" },
  { name: "Captain America", exp: "core_2nd", team: "Avengers" },
  { name: "Cyclops", exp: "core_2nd", team: "X-Men" },
  { name: "Emma Frost", exp: "core_2nd", team: "X-Men" },
  { name: "Gambit", exp: "core_2nd", team: "X-Men" },
  { name: "Hawkeye", exp: "core_2nd", team: "Avengers" },
  { name: "Hulk", exp: "core_2nd", team: "Avengers" },
  { name: "Iron Man", exp: "core_2nd", team: "Avengers" },
  { name: "Nick Fury", exp: "core_2nd", team: "S.H.I.E.L.D." },
  { name: "Rogue", exp: "core_2nd", team: "X-Men" },
  { name: "Spider-Man", exp: "core_2nd", team: "Spider-Friends" },
  { name: "Spider-Man (Miles Morales)", exp: "core_2nd", team: "Spider-Friends" },
  { name: "Storm", exp: "core_2nd", team: "X-Men" },
  { name: "Thor", exp: "core_2nd", team: "Avengers" },
  { name: "Wolverine", exp: "core_2nd", team: "X-Men" },

  { name: "Doctor Doom 2099", exp: "2099" },
  { name: "Ghost Rider 2099", exp: "2099", team: "Marvel Knights" },
  { name: "Hulk 2099", exp: "2099", team: "Marvel Knights" },
  { name: "Ravage 2099", exp: "2099", team: "Marvel Knights" },
  { name: "Spider-Man 2099", exp: "2099", team: "Spider-Friends" },

  { name: "General Okoye", exp: "black_panther", team: "Heroes of Wakanda" },
  { name: "King Black Panther", exp: "black_panther", team: "Heroes of Wakanda" },
  { name: "Princess Shuri", exp: "black_panther", team: "Heroes of Wakanda" },
  { name: "Queen Storm of Wakanda", exp: "black_panther", team: "Heroes of Wakanda" },
  { name: "White Wolf", exp: "black_panther", team: "Heroes of Wakanda" },

  { name: "Black Widow", exp: "black_widow", team: "S.H.I.E.L.D." },
  { name: "Falcon & Winter Soldier", exp: "black_widow", team: "Avengers" },
  { name: "Red Guardian", exp: "black_widow" },
  { name: "White Tiger", exp: "black_widow", team: "Marvel Knights" },
  { name: "Yelena Belova", exp: "black_widow", team: "S.H.I.E.L.D." },

  { name: "Ant Army", exp: "ant_man_wasp", keywords: ["Size-Changing"] },
  { name: "Ant-Man", exp: "ant_man_wasp", team: "Avengers", keywords: ["Size-Changing"] },
  { name: "Cassie Lang", exp: "ant_man_wasp", team: "Avengers", keywords: ["Size-Changing"] },
  { name: "Freedom Fighters", exp: "ant_man_wasp" },
  { name: "Janet Van Dyne", exp: "ant_man_wasp", keywords: ["Size-Changing"] },
  { name: "Jentorra", exp: "ant_man_wasp" },
  { name: "Scott Lang, Cat Burglar", exp: "ant_man_wasp", team: "Crime Syndicate" },
  { name: "Wasp", exp: "ant_man_wasp", team: "Avengers", keywords: ["Size-Changing"] },
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
  module.exports = { EXPANSIONS, MASTERMINDS, SCHEMES, UNVEILED_SCHEMES, VILLAIN_GROUPS, HENCHMEN, HEROES, PLAYER_COUNT_TABLE };
}
