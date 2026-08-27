(function () {
  "use strict";

  const STORAGE_KEY = "legendary-randomizer/v2";

  const CATEGORIES = [
    { key: "mastermind", label: "Mastermind", pool: MASTERMINDS, countKey: null, fixedCount: 1 },
    { key: "scheme", label: "Scheme", pool: SCHEMES, countKey: null, fixedCount: 1 },
    { key: "villains", label: "Villain Groups", pool: VILLAIN_GROUPS, countKey: "villainCount", fixedCount: null, min: 1, max: 10 },
    { key: "henchmen", label: "Henchmen", pool: HENCHMEN, countKey: "henchmenCount", fixedCount: null, min: 1, max: 4 },
    { key: "heroes", label: "Heroes", pool: HEROES, countKey: "heroCount", fixedCount: null, min: 3, max: 8 },
  ];

  const CATEGORY_BY_KEY = {};
  CATEGORIES.forEach((c) => (CATEGORY_BY_KEY[c.key] = c));

  /** Fresh per-card win/loss tally, one bucket per category, keyed by
   * card name (same identity convention as state.exclusions). Lives
   * outside state.history so it keeps accumulating across the 20-entry
   * History cap and survives "Clear All" — see setEntryOutcome below. */
  function emptyCardStats() {
    const stats = {};
    CATEGORIES.forEach((c) => (stats[c.key] = {}));
    return stats;
  }

  let state = loadState();

  function defaultState() {
    return {
      expansions: new Set(["core"]),
      options: { heroCount: 5, villainCount: 3, henchmenCount: 1, bystanders: 8, masterStrikes: 5, twists: 5, players: 3 },
      exclusions: { mastermind: new Set(), scheme: new Set(), villains: new Set(), henchmen: new Set(), heroes: new Set() },
      excludedTeams: new Set(),
      excludeUnaffiliated: false,
      history: [],
      cardStats: emptyCardStats(),
      gameLog: { heroWins: 0, evilWins: 0 },
      currentHistoryId: null,
      result: {},
      locks: {},
      keywordChoices: {},
      extraCard: null,
      extraVillainGroup: null,
      extraHeroGroup: [],
      extraHenchmenGroup: [],
      extraMastermindGroup: [],
      weddingHeroes: [],
      heroTeamSplit: null,
      heroTeamCount: null,
      unveiledScheme: null,
    };
  }

  function loadState() {
    const defaults = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      const exclusions = {};
      CATEGORIES.forEach((c) => {
        exclusions[c.key] = new Set((parsed.exclusions && parsed.exclusions[c.key]) || []);
      });
      const cardStats = emptyCardStats();
      CATEGORIES.forEach((c) => {
        const saved = (parsed.cardStats && parsed.cardStats[c.key]) || {};
        Object.keys(saved).forEach((name) => {
          const entry = saved[name];
          if (!entry || typeof entry !== "object") return;
          cardStats[c.key][name] = { wins: Number(entry.wins) || 0, losses: Number(entry.losses) || 0 };
        });
      });
      return {
        expansions: new Set(parsed.expansions && parsed.expansions.length ? parsed.expansions : defaults.expansions),
        options: { ...defaults.options, ...(parsed.options || {}) },
        exclusions,
        excludedTeams: new Set(parsed.excludedTeams || []),
        excludeUnaffiliated: !!parsed.excludeUnaffiliated,
        history: Array.isArray(parsed.history) ? parsed.history : [],
        cardStats,
        gameLog: {
          heroWins: Number(parsed.gameLog && parsed.gameLog.heroWins) || 0,
          evilWins: Number(parsed.gameLog && parsed.gameLog.evilWins) || 0,
        },
        currentHistoryId: null,
        result: {},
        locks: {},
        keywordChoices: {},
        extraCard: null,
        extraVillainGroup: null,
        extraHeroGroup: [],
        extraHenchmenGroup: [],
        extraMastermindGroup: [],
        weddingHeroes: [],
        heroTeamSplit: null,
        heroTeamCount: null,
        unveiledScheme: null,
      };
    } catch (e) {
      return defaults;
    }
  }

  function saveState() {
    try {
      const exclusions = {};
      CATEGORIES.forEach((c) => (exclusions[c.key] = Array.from(state.exclusions[c.key])));
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          expansions: Array.from(state.expansions),
          options: state.options,
          exclusions,
          excludedTeams: Array.from(state.excludedTeams),
          excludeUnaffiliated: state.excludeUnaffiliated,
          history: state.history,
          cardStats: state.cardStats,
          gameLog: state.gameLog,
        })
      );
    } catch (e) {
      /* localStorage unavailable — silently skip persistence */
    }
  }

  function availableTeams() {
    const teams = new Set();
    HEROES.forEach((h) => {
      if (h.team && state.expansions.has(h.exp)) teams.add(h.team);
    });
    return Array.from(teams).sort();
  }

  /** Whether any Hero in the currently enabled expansions has no known
   * Team — these are represented in the Hero Team Theme sheet as a
   * single "Unaffiliated" toggle (see teamRow/state.excludeUnaffiliated)
   * alongside the real Teams from availableTeams above. */
  function hasUnaffiliatedHeroes() {
    return HEROES.some((h) => !h.team && state.expansions.has(h.exp));
  }

  function poolFor(category) {
    const excluded = state.exclusions[category.key];
    let pool = category.pool.filter((card) => state.expansions.has(card.exp) && !excluded.has(card.name));
    if (category.key === "heroes") {
      pool = pool.filter((card) => (card.team ? !state.excludedTeams.has(card.team) : !state.excludeUnaffiliated));
    }
    return pool;
  }

  /** A Scheme's `extraHeroName` (see data.js) names one specific Hero
   * whose own cards go into the Villain Deck instead of the normal Hero
   * Deck (e.g. Dark City's "Transform Citizens into Demons" and its
   * Jean Grey cards) — null when the current Scheme has no such
   * requirement. Used to keep that Hero out of the normal Hero Deck draw
   * so it can't end up in both places at once; deliberately doesn't touch
   * poolFor/Card Pool management, so the Hero stays visible and
   * excludable there as normal, just not drafted while this Scheme is
   * in play. */
  function currentExtraHeroName() {
    const scheme = currentSchemeData();
    return (scheme && scheme.overrides && scheme.overrides.extraHeroName) || null;
  }

  /** Adds the current `extraHeroName` Hero (if any) to an exclude list for
   * a Heroes draw, so it never gets pulled into the normal Hero Deck —
   * see currentExtraHeroName above. Pass the category's own key; a no-op
   * for every other category. */
  function heroDrawExclusions(categoryKey, base) {
    if (categoryKey !== "heroes") return base;
    const extraName = currentExtraHeroName();
    return extraName ? base.concat([{ name: extraName }]) : base;
  }

  /** A Scheme's `extraVillainGroupName` (see data.js) names one specific
   * Villain Group set aside on its own rather than mixed into the main
   * Villain Groups lineup (e.g. "Siphon Energy from the Quantum Realm"
   * setting aside the Quantum Realm group) — null when the current
   * Scheme has no such requirement. Same idea as currentExtraHeroName
   * above, just for a Villain Group. */
  function currentExtraVillainGroupName() {
    const scheme = currentSchemeData();
    return (scheme && scheme.overrides && scheme.overrides.extraVillainGroupName) || null;
  }

  /** A Scheme's `extraVillainGroupFromExtraMastermind` (see data.js)
   * derives an extra Villain Group from whichever Mastermind is
   * currently the extra-group pick in `state.extraMastermindGroup[0]`
   * (see `extraMastermindCount`) — reads that Mastermind's own `leads`
   * entry for the villains category, e.g. Venom's "Symbiotic Absorption"
   * adding the Drained Mastermind's "Always Leads" Villains. That `leads`
   * entry can be an exact `name` (most Masterminds) or, for a Mastermind
   * that "leads any Villain Group with [word] in the name" (e.g. Doctor
   * Octopus's Sinister Six variants), a `nameContains` list — resolved
   * the same random-pick-with-cache way resolveNameMatchRequirement
   * already resolves it for the *main* Mastermind, reused here for
   * whichever Mastermind is Drained instead. Null when the current
   * Scheme has no such requirement, no Drained Mastermind is currently
   * picked, that Mastermind doesn't lead a Villain Group in this
   * database, or (for the `nameContains` case) nothing currently
   * available matches. Same idea as currentExtraVillainGroupName above,
   * just derived rather than named outright. */
  function currentExtraVillainGroupFromExtraMastermindName() {
    const scheme = currentSchemeData();
    if (!(scheme && scheme.overrides && scheme.overrides.extraVillainGroupFromExtraMastermind)) return null;
    const drained = (state.extraMastermindGroup || [])[0];
    const leadsVillain = drained && drained.leads && drained.leads.find((l) => l.category === "villains");
    if (!leadsVillain) return null;
    if (leadsVillain.name) return leadsVillain.name;
    if (leadsVillain.nameContains) return resolveNameMatchRequirement("villains", leadsVillain.nameContains);
    return null;
  }

  /** Adds the current `extraVillainGroupName` Villain Group (if any — see
   * currentExtraVillainGroupName above) and the current
   * `extraVillainGroupFromExtraMastermind` derived Villain Group (if any
   * — see currentExtraVillainGroupFromExtraMastermindName above) to an
   * exclude list for a Villain Groups draw, so neither gets pulled into
   * the normal Villain Groups lineup on top of already being set aside
   * on its own — mirrors heroDrawExclusions above. Also excludes
   * whichever names a `requiredVillainGroupOneOf` requirement (see
   * resolveOneOfRequirement below) did NOT pick, so "either X or Y, but
   * not both" actually keeps the other one out rather than just forcing
   * one in. Pass the category's own key; a no-op for every other
   * category. */
  function villainDrawExclusions(categoryKey, base) {
    if (categoryKey !== "villains") return base;
    let result = base;
    const extraName = currentExtraVillainGroupName();
    if (extraName) result = result.concat([{ name: extraName }]);
    const drainedExtraName = currentExtraVillainGroupFromExtraMastermindName();
    if (drainedExtraName) result = result.concat([{ name: drainedExtraName }]);
    const scheme = currentSchemeData();
    const oneOf = scheme && scheme.overrides && scheme.overrides.requiredVillainGroupOneOf;
    if (oneOf) {
      const chosen = resolveOneOfRequirement("villains", oneOf);
      const others = oneOf.filter((n) => n !== chosen);
      result = result.concat(others.map((name) => ({ name })));
    }
    return result;
  }

  /** A category can carry a whole separate "extra group" of its own random
   * cards, distinct from its normal counted result — e.g. Heroes' "Past
   * Hero Deck" (The Time Heist) or Henchmen's "Vampire Neonates" (Sire
   * Vampires at the Blood Bank). Each entry here names the Scheme
   * `overrides` fields that drive it (a count, an optional display label,
   * or — instead of a count — an explicit `namesKey` array for a Scheme
   * that names specific card(s) rather than picking randomly, e.g. World
   * War Hulk's "Cytoplasm Spike Invasion": "Shuffle together ... 10
   * Cytoplasm Spike Henchmen as an 'Infected Deck'" calls for that exact
   * Henchmen group set aside on its own, not a random extra Henchmen pick
   * — `extraHenchmenNames: ["Cytoplasm Spikes"]`), and an optional
   * `noteKey` for a short explanation appended to each card's own
   * sub-text ("Expansion · Team · note" — same "· note" treatment as the
   * single-card extraHeroName/extraVillainGroupName rows elsewhere), so
   * the group reads as clearly "extra"/set-aside rather than just another
   * plain category, e.g. `extraHenchmenGroupNote: "Shuffled into a
   * separate 'Infected Deck' with 20 Bystanders — not part of the normal
   * Henchmen result"`. The `state` key its picks are cached under is
   * named separately — see syncExtraGroup/rerollExtraGroupSlot/
   * extraGroupSection below. A named entry's reroll button is disabled
   * ("Fixed by this Scheme"), same treatment as extraHeroName/
   * extraVillainGroupName elsewhere. */
  const EXTRA_GROUP_CONFIG = {
    heroes: {
      countKey: "extraHeroCount",
      labelKey: "extraHeroGroupLabel",
      namesKey: "extraHeroNames",
      noteKey: "extraHeroGroupNote",
      stateKey: "extraHeroGroup",
    },
    henchmen: {
      countKey: "extraHenchmenCount",
      labelKey: "extraHenchmenGroupLabel",
      namesKey: "extraHenchmenNames",
      noteKey: "extraHenchmenGroupNote",
      stateKey: "extraHenchmenGroup",
    },
    mastermind: {
      countKey: "extraMastermindCount",
      labelKey: "extraMastermindGroupLabel",
      namesKey: "extraMastermindNames",
      noteKey: "extraMastermindGroupNote",
      stateKey: "extraMastermindGroup",
    },
  };

  /** Adds the current extra-group members (if any — see EXTRA_GROUP_CONFIG/
   * syncExtraGroup) to an exclude list for a draw in that same category, so
   * a card already sitting in the extra group never also gets pulled into
   * the normal result — mirrors heroDrawExclusions/villainDrawExclusions
   * above. Pass the category's own key; a no-op for any category with no
   * extra-group mechanic. */
  function extraGroupDrawExclusions(categoryKey, base) {
    const config = EXTRA_GROUP_CONFIG[categoryKey];
    if (!config) return base;
    const names = (state[config.stateKey] || []).map((c) => c.name);
    return names.length ? base.concat(names.map((name) => ({ name }))) : base;
  }

  function pickRandom(list, n, exclude) {
    const excludeNames = new Set((exclude || []).map((c) => c.name));
    const candidates = list.filter((c) => !excludeNames.has(c.name));
    const shuffled = candidates.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, n);
  }

  function countFor(category) {
    if (category.fixedCount) return category.fixedCount;
    return state.options[category.countKey];
  }

  function randomizeCategory(category, { keepLocked } = { keepLocked: true }) {
    const pool = poolFor(category);
    const n = countFor(category);
    const existing = state.result[category.key] || [];
    const locks = state.locks[category.key] || [];

    const lockedItems = keepLocked ? existing.filter((_, i) => locks[i]) : [];
    const needed = n - lockedItems.length;
    const fresh =
      needed > 0
        ? pickRandom(pool, needed, extraGroupDrawExclusions(category.key, villainDrawExclusions(category.key, heroDrawExclusions(category.key, lockedItems))))
        : [];
    const combined = lockedItems.concat(fresh);

    state.result[category.key] = combined;
    if (!keepLocked) {
      state.locks[category.key] = combined.map(() => false);
      if (signatureFlags[category.key]) signatureFlags[category.key] = [];
    }
  }

  /** Rolls every one of the 5 counted categories, keeping whatever's
   * currently locked — shared by randomizeAll (a fresh setup, saved as a
   * new History entry) and rerollAllUnlocked (rerolls what's left
   * unlocked in the current setup, overwriting its History entry
   * instead — see below). Mastermind and Scheme go first, so the
   * Scheme's numeric overrides (e.g. an extra Henchman group) are in
   * effect before Villains/Henchmen/Heroes get rolled against those
   * counts. */
  function rollAllCategories() {
    randomizeCategory(CATEGORY_BY_KEY.mastermind, { keepLocked: true });
    randomizeCategory(CATEGORY_BY_KEY.scheme, { keepLocked: true });
    syncSchemeNumbers();
    syncHeroTeamSplit();
    syncHeroTeamCount();
    randomizeCategory(CATEGORY_BY_KEY.villains, { keepLocked: true });
    randomizeCategory(CATEGORY_BY_KEY.henchmen, { keepLocked: true });
    randomizeCategory(CATEGORY_BY_KEY.heroes, { keepLocked: true });
    resyncAndReconcile();
  }

  function randomizeAll() {
    rollAllCategories();
    // Nothing gets saved to Past Setups until it's logged as a win or
    // loss — see createHistoryEntry/logCurrentOutcome — so a fresh
    // randomize just clears any link to whatever was previously current.
    state.currentHistoryId = null;
    render();
  }

  /** "Reroll All" — rerolls every unlocked card across all 5 categories
   * (randomizeCategory already leaves locked slots alone) and syncs the
   * result into the current setup's History entry in place, rather than
   * creating a new one: lock the Heroes you like, tap this, and the
   * Past Setup you already have — and its Win/Loss Stats, if already
   * logged — update to match instead of going stale. See
   * syncCurrentHistorySnapshot below. */
  function rerollAllUnlocked() {
    rollAllCategories();
    syncCurrentHistorySnapshot();
    render();
  }

  function toggleLock(categoryKey, index) {
    const locks = state.locks[categoryKey] || [];
    locks[index] = !locks[index];
    state.locks[categoryKey] = locks;
    render();
  }

  function chooseCard(categoryKey, index, card) {
    const existing = state.result[categoryKey] || [];
    existing[index] = card;
    state.result[categoryKey] = existing;
    if (signatureFlags[categoryKey]) signatureFlags[categoryKey][index] = false;
    const locks = state.locks[categoryKey] || [];
    locks[index] = true;
    state.locks[categoryKey] = locks;
    if (categoryKey === "mastermind" || categoryKey === "scheme") {
      resyncAndReconcile();
    }
    render();
  }

  // ---------- Mastermind "always leads" / Scheme requirements ----------

  // Runtime-only bookkeeping (not persisted): which result slots were filled
  // by forceIncludeSignature (a required card) rather than chosen by the
  // player, per category.
  const signatureFlags = { villains: [], henchmen: [], heroes: [] };

  // Not persisted — lets syncSchemeNumbers tell an actual Scheme change
  // (which should reroll keyword picks / the extra-Hero pick) apart from
  // a same-Scheme resync triggered by a Player-count change alone.
  let lastSchemeSignature = null;

  // Same idea, for a Mastermind's own "leads any ___ with [word] in the
  // name" pick (see resolveNameMatchRequirement) — reset only when the
  // Mastermind itself changes, tracked separately from lastSchemeSignature
  // above since either can change independently of the other.
  let lastMastermindSignature = null;

  function currentMastermindData() {
    const mm = (state.result.mastermind || [])[0];
    if (!mm) return null;
    return MASTERMINDS.find((m) => m.name === mm.name && m.exp === mm.exp) || null;
  }

  function currentSchemeData() {
    const sc = (state.result.scheme || [])[0];
    if (!sc) return null;
    return SCHEMES.find((s) => s.name === sc.name && s.exp === sc.exp) || null;
  }

  /** Drops every cached pick (see resolveFromCandidates) whose key starts
   * with `prefix` — "scheme:" when the Scheme changes, "mastermind:"
   * when the Mastermind changes — without disturbing the other's cache. */
  function clearKeywordChoicesWithPrefix(prefix) {
    Object.keys(state.keywordChoices).forEach((k) => {
      if (k.startsWith(prefix)) delete state.keywordChoices[k];
    });
  }

  /** Shared cache-and-pick logic for a "pick one qualifying card, then
   * stick with it" requirement (a Scheme's keyword requirement, or a
   * Mastermind's name-substring requirement below): reuse the cached
   * pick under `cacheKey` if it's still among today's candidates,
   * otherwise pick randomly and cache the result. Returns null if
   * nothing currently qualifies. */
  function resolveFromCandidates(cacheKey, candidates) {
    if (!candidates.length) return null;
    const cached = state.keywordChoices[cacheKey];
    if (cached && candidates.some((c) => c.name === cached)) return cached;
    const [picked] = pickRandom(candidates, 1, []);
    if (picked) state.keywordChoices[cacheKey] = picked.name;
    return picked ? picked.name : null;
  }

  /** Resolves a Scheme's "include exactly one [category] card with
   * [keyword]" requirement to a concrete card name — picking randomly
   * among whichever currently-available cards carry that keyword (there
   * may be more than one once enough expansions are on; right now only
   * one card in the whole database has any given keyword, but that's not
   * guaranteed to stay true). Re-picks automatically if the cached choice
   * becomes unavailable (excluded, expansion turned off) or hasn't been
   * made yet. */
  function resolveKeywordRequirement(categoryKey, keyword) {
    const pool = poolFor(CATEGORY_BY_KEY[categoryKey]);
    const candidates = pool.filter((c) => (c.keywords || []).includes(keyword));
    return resolveFromCandidates(`scheme:${categoryKey}:${keyword}`, candidates);
  }

  /** Resolves a Mastermind's "leads any [category] card whose name
   * contains one of these words" requirement (case-insensitive
   * substring match, e.g. Magneto leading any Villain Group with
   * "Brotherhood" or "X-Men" in its name) the same random-pick-with-
   * cache way as resolveKeywordRequirement — just matched by name
   * substring instead of a curated `keywords` tag, since there's nothing
   * to tag ahead of time; it just reads off whatever's actually named
   * that way, which is also why it can pick up a same-named group from a
   * completely different expansion if both happen to be selected. */
  function resolveNameMatchRequirement(categoryKey, nameContains) {
    const pool = poolFor(CATEGORY_BY_KEY[categoryKey]);
    const needles = nameContains.map((s) => s.toLowerCase());
    const candidates = pool.filter((c) => needles.some((n) => c.name.toLowerCase().includes(n)));
    const cacheKey = `mastermind:${categoryKey}:${needles.join("|")}`;
    return resolveFromCandidates(cacheKey, candidates);
  }

  /** Same idea as resolveNameMatchRequirement, but for a Scheme's "include
   * exactly N [category] cards whose name contains one of these words"
   * requirement (e.g. World War Hulk's "Fall of the Hulks": "Use exactly
   * two Heroes with 'Hulk' in their Hero Names") — picks `count` distinct
   * matching cards instead of just one, cached together (pipe-joined) under
   * a single keywordChoices entry so the same set survives re-renders, and
   * only tops up whichever slots are no longer valid (excluded, expansion
   * turned off) rather than reshuffling the whole set. Returns fewer than
   * `count` names if the matching pool is too small — callers just force in
   * however many are actually available. */
  function resolveNameMatchRequirementCount(categoryKey, nameContains, count) {
    const pool = poolFor(CATEGORY_BY_KEY[categoryKey]);
    const needles = nameContains.map((s) => s.toLowerCase());
    const candidates = pool.filter((c) => needles.some((n) => c.name.toLowerCase().includes(n)));
    const cacheKey = `scheme:${categoryKey}:multi:${needles.join("|")}`;
    const cachedNames = (state.keywordChoices[cacheKey] || "").split("|").filter(Boolean);
    const validCached = cachedNames.filter((name) => candidates.some((c) => c.name === name));
    if (validCached.length >= count) {
      const kept = validCached.slice(0, count);
      state.keywordChoices[cacheKey] = kept.join("|");
      return kept;
    }
    const excludeNames = new Set(validCached);
    const remaining = candidates.filter((c) => !excludeNames.has(c.name));
    const picked = pickRandom(remaining, count - validCached.length, []);
    const result = validCached.concat(picked.map((c) => c.name));
    state.keywordChoices[cacheKey] = result.join("|");
    return result;
  }

  /** Resolves a Scheme's "include at least one Hero from [Team]"
   * requirement (e.g. Deadpool's "Everybody Hates Deadpool": "use at
   * least 1 Mercs For Money Hero," printed as the team's icon rather
   * than a named card) to a concrete Hero name, the same random-pick-
   * with-cache way as resolveKeywordRequirement — just matched by the
   * `team` field instead of a `keywords` tag. */
  function resolveTeamRequirement(team) {
    const pool = poolFor(CATEGORY_BY_KEY.heroes);
    const candidates = pool.filter((c) => c.team === team);
    return resolveFromCandidates(`scheme:heroes:team:${team}`, candidates);
  }

  /** Resolves a Scheme's "include exactly one of these named [category]
   * cards, but not the others" requirement (e.g. S.H.I.E.L.D. vs. Hydra
   * War's "Include either the 'Hydra Elite' or 'A.I.M., Hydra Offshoot'
   * Villain Group, but not both") to a concrete card name, the same
   * random-pick-with-cache way as resolveKeywordRequirement — just
   * matched against an exact-name list instead of a `keywords` tag. The
   * names NOT picked are excluded from that category's normal random
   * draw entirely — see villainDrawExclusions below — so this doesn't
   * just force one in, it also keeps the others out. If the current
   * Mastermind's own "always leads" already names one of these same
   * cards (e.g. HYDRA Super-Adaptoid always leading "A.I.M., HYDRA
   * Offshoot" while the Scheme separately requires "either HYDRA Elite
   * or A.I.M., HYDRA Offshoot, but not both"), that forced name wins
   * instead of an independent random pick — otherwise the Mastermind
   * could force in one option while this resolved to the other,
   * landing both in play at once and breaking the "not both" rule. */
  function resolveOneOfRequirement(categoryKey, names) {
    const mmData = currentMastermindData();
    const forced =
      mmData && mmData.leads
        ? mmData.leads.find((req) => req.category === categoryKey && req.name && names.includes(req.name))
        : null;
    if (forced) return forced.name;
    const pool = poolFor(CATEGORY_BY_KEY[categoryKey]);
    const candidates = pool.filter((c) => names.includes(c.name));
    return resolveFromCandidates(`scheme:${categoryKey}:oneOf:${names.join("|")}`, candidates);
  }

  /** Every card name that MUST be in play for this category right now,
   * from the current Mastermind's "always leads" (its `leads` array — one
   * Mastermind can require more than one card, e.g. a Henchmen group AND
   * a specific Hero; each entry is either an exact `name` or, for "leads
   * any ___ with [word] in the name," a `nameContains` list) and/or the
   * current Scheme's required Villain Group / Henchmen group / Hero (by
   * exact name, or — for a Villain Group — by keyword). */
  function requiredCardNames(categoryKey) {
    const names = [];
    const mmData = currentMastermindData();
    (mmData && mmData.leads ? mmData.leads : []).forEach((req) => {
      if (req.category !== categoryKey) return;
      if (req.name) {
        names.push(req.name);
      } else if (req.nameContains) {
        const name = resolveNameMatchRequirement(categoryKey, req.nameContains);
        if (name) names.push(name);
      }
    });
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    if (categoryKey === "villains" && overrides.requiredVillainGroup) names.push(overrides.requiredVillainGroup);
    if (categoryKey === "villains" && overrides.requiredVillainGroups) names.push(...overrides.requiredVillainGroups);
    if (categoryKey === "villains" && overrides.requiredVillainGroupKeyword) {
      const name = resolveKeywordRequirement("villains", overrides.requiredVillainGroupKeyword);
      if (name) names.push(name);
    }
    if (categoryKey === "villains" && overrides.requiredVillainGroupOneOf) {
      const name = resolveOneOfRequirement("villains", overrides.requiredVillainGroupOneOf);
      if (name) names.push(name);
    }
    if (categoryKey === "henchmen" && overrides.requiredHenchmen) names.push(overrides.requiredHenchmen);
    if (categoryKey === "heroes" && overrides.requiredHero) names.push(overrides.requiredHero);
    if (categoryKey === "heroes" && overrides.requiredHeroTeam) {
      const name = resolveTeamRequirement(overrides.requiredHeroTeam);
      if (name) names.push(name);
    }
    if (categoryKey === "heroes" && overrides.requiredHeroNameContains) {
      if (overrides.requiredHeroNameContainsCount > 1) {
        resolveNameMatchRequirementCount("heroes", overrides.requiredHeroNameContains, overrides.requiredHeroNameContainsCount).forEach(
          (name) => names.push(name)
        );
      } else {
        const name = resolveNameMatchRequirement("heroes", overrides.requiredHeroNameContains);
        if (name) names.push(name);
      }
    }
    return names;
  }

  /** Release any slot a previously-required card claimed, if it's no longer
   * required (Mastermind or Scheme changed) or was excluded/expansion'd out
   * from under it — replacing it with a fresh random pick so a stale forced
   * card doesn't permanently squat a slot and starve room for whatever's
   * required now. */
  function clearStaleRequiredCards() {
    ["villains", "henchmen", "heroes"].forEach((categoryKey) => {
      const pool = poolFor(CATEGORY_BY_KEY[categoryKey]);
      const required = new Set(requiredCardNames(categoryKey).filter((name) => pool.some((c) => c.name === name)));
      const flags = signatureFlags[categoryKey];
      const items = state.result[categoryKey] || [];
      const locks = state.locks[categoryKey] || [];

      for (let i = 0; i < items.length; i++) {
        if (!flags[i]) continue;
        if (required.has(items[i].name)) continue;
        flags[i] = false;
        locks[i] = false;
        const [fresh] = pickRandom(pool, 1, extraGroupDrawExclusions(categoryKey, villainDrawExclusions(categoryKey, heroDrawExclusions(categoryKey, items))));
        if (fresh) items[i] = fresh;
      }
      state.result[categoryKey] = items;
      state.locks[categoryKey] = locks;
    });
  }

  /** Make sure one required card is in play: reuse it if already present,
   * otherwise fill the first unlocked slot (or an empty one), growing the
   * category's count by one first if every slot is already claimed by
   * another required card (e.g. a Mastermind's "always leads" and a
   * Scheme's requirement both landing on Henchmen with only 1 slot —
   * both are mandatory, so the slot count grows to fit rather than one
   * silently losing to whichever ran first). Never evicts a slot the
   * player locked themselves, and does nothing if that card is excluded
   * or its expansion isn't on. */
  function forceIncludeSignature(categoryKey, name) {
    const category = CATEGORY_BY_KEY[categoryKey];
    const pool = poolFor(category);
    const card = pool.find((c) => c.name === name);
    if (!card) return;

    const items = state.result[categoryKey] || [];
    const locks = state.locks[categoryKey] || [];
    const flags = signatureFlags[categoryKey];
    const existingIndex = items.findIndex((item) => item.name === card.name);
    if (existingIndex !== -1) {
      locks[existingIndex] = true;
      flags[existingIndex] = true;
      state.locks[categoryKey] = locks;
      return;
    }

    const n = countFor(category);
    let targetIndex = items.findIndex((_, i) => !locks[i]);
    if (targetIndex === -1 && items.length < n) targetIndex = items.length;
    if (targetIndex === -1) {
      if (category.countKey) state.options[category.countKey] = clampOption(state.options[category.countKey] + 1, category.min, category.max);
      targetIndex = items.length;
    }

    items[targetIndex] = card;
    locks[targetIndex] = true;
    flags[targetIndex] = true;
    state.result[categoryKey] = items;
    state.locks[categoryKey] = locks;
  }

  /** Reconciles Villain Groups / Henchmen against whatever the current
   * Mastermind and Scheme require. Safe to call any time either changes.
   * Also resets a Mastermind's name-substring pick (see
   * resolveNameMatchRequirement) whenever the Mastermind itself has
   * actually changed, the same way syncSchemeNumbers resets the Scheme's
   * keyword pick — so it re-rolls per Mastermind rather than reshuffling
   * on every resync. */
  function syncRequiredCards() {
    const mmData = currentMastermindData();
    const mmSignature = mmData ? `${mmData.name}|${mmData.exp}` : null;
    if (mmSignature !== lastMastermindSignature) {
      clearKeywordChoicesWithPrefix("mastermind:");
      state.extraVillainGroup = null;
      lastMastermindSignature = mmSignature;
    }

    clearStaleRequiredCards();
    ["villains", "henchmen", "heroes"].forEach((categoryKey) => {
      requiredCardNames(categoryKey).forEach((name) => forceIncludeSignature(categoryKey, name));
    });
    syncExtraCard();
    syncExtraGroup("mastermind");
    syncExtraVillainGroup();
    syncExtraGroup("heroes");
    syncExtraGroup("henchmen");
    syncWeddingHeroes();
    syncUnveiledScheme();
  }

  /** Some Schemes (e.g. What If...?'s Marvel Zombies, "add 8 random cards
   * from an extra Hero to the Villain Deck") call for a Hero beyond your
   * normal Hero Deck lineup, chosen at random and never duplicating one
   * of the main Heroes result. Kept in state.extraCard (not one of the
   * counted result categories, so it doesn't affect the Heroes stepper)
   * and left alone once picked, only clearing/re-picking when the Scheme
   * itself changes (see the schemeSignature check in syncSchemeNumbers)
   * or the current pick is no longer valid. A Scheme can instead set
   * `extraHeroName` (see data.js) to name one specific Hero rather than
   * picking randomly — that Hero is kept out of the main Heroes draw by
   * heroDrawExclusions above, so it's always safe to hand straight to
   * state.extraCard here; null (no extra card shown) if that Hero isn't
   * currently available (excluded, its expansion off, or filtered out by
   * the Team Theme filter). A Scheme can also set `extraHeroKeyword` to
   * narrow the random pick down to only Heroes carrying that `keywords`
   * tag (e.g. "Size-Changing" for Auction Shrink Tech to Highest Bidder)
   * rather than picking from every available Hero. */
  /** Narrows a Heroes pool for the random `extraHero` pick by whichever of
   * `extraHeroKeyword` (a curated `keywords` tag — see data.js) or
   * `extraHeroNameContains` (an array of name substrings, case-insensitive,
   * OR'd together — for "any [word] Hero" text with nothing to tag ahead
   * of time, e.g. Midnight Massacre's "any Blade Hero" matching both
   * "Blade" and "Blade, Daywalker" across expansions, the same
   * name-substring idea as a Mastermind's `nameContains`) a Scheme sets. */
  function filterExtraHeroPool(pool, overrides) {
    let filtered = pool;
    if (overrides.extraHeroKeyword) filtered = filtered.filter((c) => (c.keywords || []).includes(overrides.extraHeroKeyword));
    if (overrides.extraHeroNameContains) {
      const needles = overrides.extraHeroNameContains.map((s) => s.toLowerCase());
      filtered = filtered.filter((c) => needles.some((n) => c.name.toLowerCase().includes(n)));
    }
    return filtered;
  }

  function syncExtraCard() {
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    if (overrides.extraHeroName) {
      const pool = poolFor(CATEGORY_BY_KEY.heroes);
      state.extraCard = pool.find((c) => c.name === overrides.extraHeroName) || null;
      return;
    }
    if (!overrides.extraHero) {
      state.extraCard = null;
      return;
    }
    const pool = filterExtraHeroPool(poolFor(CATEGORY_BY_KEY.heroes), overrides);
    const mainNames = new Set((state.result.heroes || []).map((h) => h.name));
    const candidates = pool.filter((c) => !mainNames.has(c.name));
    if (state.extraCard && candidates.some((c) => c.name === state.extraCard.name)) return;
    const [picked] = pickRandom(candidates, 1, []);
    state.extraCard = picked || null;
  }

  function rerollExtraCard() {
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    const pool = filterExtraHeroPool(poolFor(CATEGORY_BY_KEY.heroes), overrides);
    const mainNames = new Set((state.result.heroes || []).map((h) => h.name));
    const candidates = pool.filter((c) => !mainNames.has(c.name));
    const [picked] = pickRandom(candidates, 1, state.extraCard ? [state.extraCard] : []);
    if (picked) state.extraCard = picked;
    saveState();
    renderResults();
  }

  /** A Scheme's `weddingHeroes` (see data.js) sets aside two extra Heroes
   * as a gendered pair — one Hero tagged `gender: "male"`, one tagged
   * `gender: "female"` (see the Hero doc comment in data.js) — kept in
   * state.weddingHeroes as a fixed-slot 2-element array (index 0 male,
   * index 1 female) so each slot's reroll button stays constrained to
   * its own gender. Heroes with no `gender` tag are simply never
   * eligible. Same "extra card, not part of the main Hero Deck" idea as
   * extraCard above, just two constrained picks instead of one. */
  function syncWeddingHeroes() {
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    if (!overrides.weddingHeroes) {
      state.weddingHeroes = [];
      return;
    }
    const pool = poolFor(CATEGORY_BY_KEY.heroes);
    const mainNames = new Set((state.result.heroes || []).map((h) => h.name));
    const prior = state.weddingHeroes || [];
    const genders = ["male", "female"];
    const kept = genders.map((gender, i) => {
      const current = prior[i];
      const stillValid = current && current.gender === gender && !mainNames.has(current.name) && pool.some((c) => c.name === current.name);
      return stillValid ? current : null;
    });
    genders.forEach((gender, i) => {
      if (kept[i]) return;
      const otherName = kept[1 - i] ? kept[1 - i].name : null;
      const candidates = pool.filter((c) => c.gender === gender && !mainNames.has(c.name) && c.name !== otherName);
      const [picked] = pickRandom(candidates, 1, []);
      kept[i] = picked || null;
    });
    state.weddingHeroes = kept;
  }

  function rerollWeddingHero(index) {
    const group = state.weddingHeroes || [];
    const current = group[index];
    if (!current) return;
    const gender = index === 0 ? "male" : "female";
    const pool = poolFor(CATEGORY_BY_KEY.heroes);
    const mainNames = new Set((state.result.heroes || []).map((h) => h.name));
    const otherName = group[1 - index] ? group[1 - index].name : null;
    const candidates = pool.filter((c) => c.gender === gender && !mainNames.has(c.name) && c.name !== otherName);
    const [picked] = pickRandom(candidates, 1, [current]);
    if (picked) group[index] = picked;
    state.weddingHeroes = group;
    saveState();
    renderResults();
  }

  /** A Villain Group beyond the normal Villain Groups lineup, set aside
   * on its own rather than mixed into the main pool or its count — same
   * idea as a Scheme's `extraHero`/`extraHeroName` above, just for a
   * Villain Group. Three sources, checked in this order: a Scheme's
   * `overrides.extraVillainGroupName` names one specific Villain Group
   * (e.g. "Siphon Energy from the Quantum Realm" setting aside the
   * Quantum Realm group itself); a Scheme's `overrides.
   * extraVillainGroupFromExtraMastermind` (boolean) derives it from
   * whichever Mastermind is currently sitting in `state.
   * extraMastermindGroup[0]` (see `extraMastermindCount` — e.g. Venom's
   * "Symbiotic Absorption": "Add [the Drained Mastermind's] 'Always
   * Leads' Villains as an extra Villain Group" — reads that Mastermind's
   * own `leads` entry for the villains category, the same way a
   * Mastermind's own `leads` forces a card in requiredCardNames below);
   * or a Mastermind's own `extraVillainGroup` (boolean) picks one at
   * random (e.g. Kang, Quantum Conqueror's "set aside the villains from
   * an extra Villain Group as Timeline Variants" — see data.js for all
   * three). Kept in state.extraVillainGroup (not one of the counted
   * result categories, so it doesn't affect the Villain Groups stepper
   * or count toward it) and left alone once picked, only clearing/re-
   * picking when the Scheme or Mastermind itself changes (see the
   * schemeSignature check in syncSchemeNumbers and the mmSignature check
   * in syncRequiredCards) or the current pick is no longer valid. Must
   * run after syncExtraGroup("mastermind") — see the call order in
   * syncRequiredCards — so the Drained Mastermind case has something to
   * read from. */
  function syncExtraVillainGroup() {
    const scheme = currentSchemeData();
    const schemeOverrides = (scheme && scheme.overrides) || {};
    if (schemeOverrides.extraVillainGroupName) {
      const pool = poolFor(CATEGORY_BY_KEY.villains);
      state.extraVillainGroup = pool.find((c) => c.name === schemeOverrides.extraVillainGroupName) || null;
      return;
    }
    if (schemeOverrides.extraVillainGroupFromExtraMastermind) {
      const drainedName = currentExtraVillainGroupFromExtraMastermindName();
      const pool = poolFor(CATEGORY_BY_KEY.villains);
      state.extraVillainGroup = (drainedName && pool.find((c) => c.name === drainedName)) || null;
      return;
    }
    const mmData = currentMastermindData();
    if (!(mmData && mmData.extraVillainGroup)) {
      state.extraVillainGroup = null;
      return;
    }
    const pool = poolFor(CATEGORY_BY_KEY.villains);
    const mainNames = new Set((state.result.villains || []).map((v) => v.name));
    const candidates = pool.filter((c) => !mainNames.has(c.name));
    if (state.extraVillainGroup && candidates.some((c) => c.name === state.extraVillainGroup.name)) return;
    const [picked] = pickRandom(candidates, 1, []);
    state.extraVillainGroup = picked || null;
  }

  function rerollExtraVillainGroup() {
    const pool = poolFor(CATEGORY_BY_KEY.villains);
    const mainNames = new Set((state.result.villains || []).map((v) => v.name));
    const candidates = pool.filter((c) => !mainNames.has(c.name));
    const [picked] = pickRandom(candidates, 1, state.extraVillainGroup ? [state.extraVillainGroup] : []);
    if (picked) state.extraVillainGroup = picked;
    saveState();
    renderResults();
  }

  /** A Scheme can carry a per-category extra-group count (`extraHeroCount`
   * for Heroes, `extraHenchmenCount` for Henchmen, `extraMastermindCount`
   * for Masterminds — see EXTRA_GROUP_CONFIG above), optionally paired with
   * a display label (`extraHeroGroupLabel`/`extraHenchmenGroupLabel`/
   * `extraMastermindGroupLabel`), for a Scheme that draws a whole second,
   * separate group of random cards beyond that category's normal result —
   * e.g. "The Time Heist"'s 4-Hero "Past Hero Deck" on top of a normal Hero
   * Deck reduced to 4 via `heroCount`, "Sire Vampires at the Blood Bank"'s
   * "Vampire Neonates" Henchman group, or Secret Wars' "Master of Tyrants"
   * picking 3 other Masterminds as "Tyrant Villains" (excluding whichever
   * Mastermind is actually leading the game, the same way the main Heroes/
   * Henchmen draws never duplicate into their own extra group). Same "extra
   * card" idea as `extraHero`/`extraVillainGroup` above, just for several
   * cards at once, and generalized across categories since Heroes,
   * Henchmen, and Masterminds all need it. Kept in state[stateKey] (not one
   * of the counted result categories)
   * and reused where still valid — not duplicated with the main result for
   * that category or with itself — only topping up or re-picking what's
   * missing, so a reroll of one slot (see rerollExtraGroupSlot) doesn't
   * reshuffle the others. Cleared/re-picked fresh when the Scheme itself
   * changes (see the schemeSignature check in syncSchemeNumbers). */
  /** The candidate pool for an extra-group pick (see EXTRA_GROUP_CONFIG/
   * syncExtraGroup below), narrowed further when the current Scheme
   * requires it — currently just `extraMastermindRequiresVillainLead`
   * (boolean), for a Scheme whose extra-Mastermind pick needs to actually
   * lead a Villain Group (e.g. Venom's "Symbiotic Absorption," which
   * derives an extra Villain Group from that Mastermind's own "Always
   * Leads" — see extraVillainGroupFromExtraMastermind above). A
   * Mastermind that only leads Henchmen, or leads nothing at all, has
   * nothing to derive, so it's excluded from the pick entirely rather
   * than landing on "No extra Villain Group available." A no-op for
   * every other category or when the current Scheme doesn't set the
   * override. */
  function extraGroupPoolFor(categoryKey) {
    const pool = poolFor(CATEGORY_BY_KEY[categoryKey]);
    if (categoryKey !== "mastermind") return pool;
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    if (!overrides.extraMastermindRequiresVillainLead) return pool;
    return pool.filter((mm) => (mm.leads || []).some((l) => l.category === "villains"));
  }

  function syncExtraGroup(categoryKey) {
    const config = EXTRA_GROUP_CONFIG[categoryKey];
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    const names = overrides[config.namesKey];
    if (names && names.length) {
      const pool = extraGroupPoolFor(categoryKey);
      state[config.stateKey] = names.map((name) => pool.find((c) => c.name === name)).filter(Boolean);
      return;
    }
    const n = overrides[config.countKey] || 0;
    if (!n) {
      state[config.stateKey] = [];
      return;
    }
    const pool = extraGroupPoolFor(categoryKey);
    const validNames = new Set(pool.map((c) => c.name));
    const mainNames = new Set((state.result[categoryKey] || []).map((c) => c.name));
    const kept = [];
    const keptNames = new Set();
    (state[config.stateKey] || []).forEach((c) => {
      if (kept.length >= n) return;
      if (!c || !validNames.has(c.name) || mainNames.has(c.name) || keptNames.has(c.name)) return;
      kept.push(c);
      keptNames.add(c.name);
    });
    const needed = n - kept.length;
    if (needed <= 0) {
      state[config.stateKey] = kept;
      return;
    }
    const exclude = kept.concat(Array.from(mainNames, (name) => ({ name })));
    const fresh = pickRandom(pool, needed, exclude);
    state[config.stateKey] = kept.concat(fresh);
  }

  /** Rerolls just one slot of the current extra group for `categoryKey`
   * (see syncExtraGroup above), leaving the rest of the group and the main
   * result for that category untouched. */
  function rerollExtraGroupSlot(categoryKey, index) {
    const config = EXTRA_GROUP_CONFIG[categoryKey];
    const group = state[config.stateKey] || [];
    const current = group[index];
    if (!current) return;
    const pool = extraGroupPoolFor(categoryKey);
    const mainNames = new Set((state.result[categoryKey] || []).map((c) => c.name));
    const exclude = group.filter((_, i) => i !== index).concat(Array.from(mainNames, (name) => ({ name }))).concat([current]);
    const [picked] = pickRandom(pool, 1, exclude);
    if (picked) group[index] = picked;
    state[config.stateKey] = group;
    if (categoryKey === "mastermind") {
      // A Drained Mastermind reroll can change what
      // extraVillainGroupFromExtraMastermind derives (see
      // syncExtraVillainGroup) — re-derive it and evict any stale copy
      // of the new pick from the main Villain Groups result now, rather
      // than waiting for the next Scheme/Mastermind/player-count sync.
      syncExtraVillainGroup();
      reconcileExtraVillainGroupFromExtraMastermind();
    }
    saveState();
    renderResults();
  }

  /** For a "Veiled Scheme" (`overrides.unveils` — see data.js), rolls
   * (and sticks with) which "Unveiled Scheme" it Transforms into, from
   * UNVEILED_SCHEMES matching the current Scheme's `exp`. Same
   * cache-and-pick shape as syncExtraCard: reuses the current pick as
   * long as it's still a valid candidate, otherwise picks fresh. null —
   * meaning no Unveiled Scheme shown — both when the current Scheme
   * doesn't unveil anything and when nothing in UNVEILED_SCHEMES matches
   * its `exp` (shouldn't normally happen, but fails safe rather than
   * crashing). */
  function syncUnveiledScheme() {
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    if (!overrides.unveils) {
      state.unveiledScheme = null;
      return;
    }
    const candidates = UNVEILED_SCHEMES.filter((u) => u.exp === scheme.exp);
    if (state.unveiledScheme && candidates.some((u) => u.name === state.unveiledScheme.name)) return;
    const [picked] = pickRandom(candidates, 1, []);
    state.unveiledScheme = picked || null;
  }

  function rerollUnveiledScheme() {
    const scheme = currentSchemeData();
    if (!scheme) return;
    const candidates = UNVEILED_SCHEMES.filter((u) => u.exp === scheme.exp);
    const [picked] = pickRandom(candidates, 1, state.unveiledScheme ? [state.unveiledScheme] : []);
    if (picked) state.unveiledScheme = picked;
    saveState();
    renderResults();
  }

  /** Picks (and sticks with) the Teams a `heroTeamSplit` Scheme (see
   * data.js) needs, e.g. Civil War's "Avengers vs. X-Men" — `count`
   * distinct Teams with at least `perTeam` eligible Heroes apiece.
   * Reuses the current pick as long as every chosen Team still qualifies
   * (same idea as resolveFromCandidates, just for a set of Teams instead
   * of a single card); otherwise re-picks. Sets state.heroTeamSplit to
   * null — meaning "no split enforced, Heroes randomize normally" — both
   * when the Scheme has no such requirement and when too few Teams
   * currently qualify to satisfy it (e.g. too many Heroes excluded). */
  function syncHeroTeamSplit() {
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    const split = overrides.heroTeamSplit;
    if (!split) {
      state.heroTeamSplit = null;
      return;
    }

    const pool = poolFor(CATEGORY_BY_KEY.heroes);
    const countByTeam = {};
    pool.forEach((h) => {
      if (h.team) countByTeam[h.team] = (countByTeam[h.team] || 0) + 1;
    });
    const eligible = Object.keys(countByTeam).filter((t) => countByTeam[t] >= split.perTeam);

    const current = state.heroTeamSplit;
    if (current && current.perTeam === split.perTeam && current.teams.every((t) => eligible.includes(t))) return;

    if (eligible.length < split.count) {
      state.heroTeamSplit = null;
      return;
    }
    const shuffled = eligible.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    state.heroTeamSplit = { teams: shuffled.slice(0, split.count), perTeam: split.perTeam };
  }

  /** Forces the current Heroes result back into a `heroTeamSplit`
   * Scheme's required shape (see syncHeroTeamSplit above) — exactly
   * `perTeam` Heroes from each of its chosen Teams. No-op if no split is
   * active. Never evicts a locked slot (those count toward their Team's
   * quota as-is); every unlocked Hero that isn't one of the chosen Teams,
   * or is beyond that Team's quota, gets discarded and replaced with a
   * fresh pick from whichever Team is still short. Call this any time the
   * Heroes result or the split itself may have just changed — a fresh
   * randomize, a Scheme switch with the old (mismatched) Heroes still on
   * screen, or a Player-count/exclusion change. If a locked slot belongs
   * to neither chosen Team (e.g. it was locked before this Scheme was
   * selected), it's kept as-is on top of the full split — growing the
   * Heroes count to fit, the same way a Mastermind/Scheme's required-card
   * conflict grows a category's count in forceIncludeSignature — rather
   * than either evicting the lock or shorting a Team's quota. */
  function reconcileHeroTeamSplit() {
    const split = state.heroTeamSplit;
    if (!split) return;

    const pool = poolFor(CATEGORY_BY_KEY.heroes);
    const items = state.result.heroes || [];
    const locks = state.locks.heroes || [];

    const keepCountByTeam = {};
    split.teams.forEach((t) => (keepCountByTeam[t] = 0));
    items.forEach((item, i) => {
      if (locks[i] && keepCountByTeam[item.team] != null) keepCountByTeam[item.team]++;
    });

    const keptIndexes = new Set();
    items.forEach((item, i) => {
      if (locks[i]) {
        keptIndexes.add(i);
        return;
      }
      if (keepCountByTeam[item.team] != null && keepCountByTeam[item.team] < split.perTeam) {
        keepCountByTeam[item.team]++;
        keptIndexes.add(i);
      }
    });

    const kept = items.filter((_, i) => keptIndexes.has(i));
    const keptLocks = locks.filter((_, i) => keptIndexes.has(i));

    const fresh = [];
    split.teams.forEach((t) => {
      const remaining = split.perTeam - keepCountByTeam[t];
      if (remaining <= 0) return;
      const candidates = pool.filter((c) => c.team === t);
      fresh.push(...pickRandom(candidates, remaining, kept.concat(fresh)));
    });

    state.result.heroes = kept.concat(fresh);
    state.locks.heroes = keptLocks.concat(fresh.map(() => false));
    const heroesCategory = CATEGORY_BY_KEY.heroes;
    if (state.result.heroes.length > state.options.heroCount) {
      state.options.heroCount = clampOption(state.result.heroes.length, heroesCategory.min, heroesCategory.max);
    }
  }

  /** Validates a `heroTeamCount` Scheme's requirement (see data.js) —
   * exactly `count` Heroes from one named Team, the rest of `heroCount`
   * from any Hero NOT on that Team (e.g. House of M's "4 X-Men Heroes
   * and 2 non-X-Men Heroes"). Unlike heroTeamSplit above, the Team here
   * is fixed by the Scheme itself rather than randomly chosen, so this
   * only needs to check the requirement is currently satisfiable — sets
   * state.heroTeamCount to null (meaning "not enforced, Heroes
   * randomize normally") both when the Scheme has no such requirement
   * and when the currently enabled pool can't supply enough Heroes on
   * one or both sides (e.g. no X-Men expansions switched on). */
  function syncHeroTeamCount() {
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    const spec = overrides.heroTeamCount;
    if (!spec) {
      state.heroTeamCount = null;
      return;
    }
    const pool = poolFor(CATEGORY_BY_KEY.heroes);
    const teamCount = pool.filter((c) => c.team === spec.team).length;
    const otherCount = pool.length - teamCount;
    const otherWanted = (state.options.heroCount || 0) - spec.count;
    if (teamCount < spec.count || otherCount < otherWanted) {
      state.heroTeamCount = null;
      return;
    }
    state.heroTeamCount = { team: spec.team, count: spec.count };
  }

  /** Forces the current Heroes result back into a `heroTeamCount`
   * Scheme's required shape (see syncHeroTeamCount above) — same idea as
   * reconcileHeroTeamSplit above, just two buckets (the named Team, and
   * everything else) instead of several named Teams. No-op if no
   * requirement is active. Never evicts a locked slot. */
  function reconcileHeroTeamCount() {
    const spec = state.heroTeamCount;
    if (!spec) return;

    const pool = poolFor(CATEGORY_BY_KEY.heroes);
    const items = state.result.heroes || [];
    const locks = state.locks.heroes || [];
    const bucketOf = (item) => (item.team === spec.team ? "team" : "other");
    const wanted = { team: spec.count, other: (state.options.heroCount || items.length) - spec.count };
    const keepCount = { team: 0, other: 0 };

    items.forEach((item, i) => {
      if (locks[i]) keepCount[bucketOf(item)]++;
    });

    const keptIndexes = new Set();
    items.forEach((item, i) => {
      if (locks[i]) {
        keptIndexes.add(i);
        return;
      }
      const bucket = bucketOf(item);
      if (keepCount[bucket] < wanted[bucket]) {
        keepCount[bucket]++;
        keptIndexes.add(i);
      }
    });

    const kept = items.filter((_, i) => keptIndexes.has(i));
    const keptLocks = locks.filter((_, i) => keptIndexes.has(i));

    const fresh = [];
    ["team", "other"].forEach((bucket) => {
      const remaining = wanted[bucket] - keepCount[bucket];
      if (remaining <= 0) return;
      const candidates = pool.filter((c) => bucketOf(c) === bucket);
      fresh.push(...pickRandom(candidates, remaining, kept.concat(fresh)));
    });

    state.result.heroes = kept.concat(fresh);
    state.locks.heroes = keptLocks.concat(fresh.map(() => false));
    const heroesCategory = CATEGORY_BY_KEY.heroes;
    if (state.result.heroes.length > state.options.heroCount) {
      state.options.heroCount = clampOption(state.result.heroes.length, heroesCategory.min, heroesCategory.max);
    }
  }

  /** Evicts the current `extraHeroName` Hero (if any — see
   * currentExtraHeroName above) from the main Heroes result, if it's
   * there and unlocked, replacing it with a fresh pick. heroDrawExclusions
   * only keeps that Hero out of *new* picks — it doesn't touch a copy
   * already sitting in the result from before this Scheme was selected
   * (e.g. leftover from whatever Scheme was active previously), so this
   * covers that case. No-op if the Hero isn't present, or is present but
   * locked (locks are never evicted). Call this alongside
   * reconcileHeroTeamSplit any time the Heroes result or the current
   * Scheme may have just changed. */
  function reconcileExtraHeroName() {
    const extraName = currentExtraHeroName();
    if (!extraName) return;
    const items = state.result.heroes || [];
    const locks = state.locks.heroes || [];
    const idx = items.findIndex((h) => h.name === extraName);
    if (idx === -1 || locks[idx]) return;
    const pool = poolFor(CATEGORY_BY_KEY.heroes);
    const [fresh] = pickRandom(pool, 1, heroDrawExclusions("heroes", items));
    if (fresh) {
      items[idx] = fresh;
      state.result.heroes = items;
    }
  }

  /** Evicts the current `extraVillainGroupName` Villain Group (if any —
   * see currentExtraVillainGroupName above) from the main Villain Groups
   * result, if it's there and unlocked, replacing it with a fresh pick.
   * Same idea as reconcileExtraHeroName above, just for a Villain Group:
   * villainDrawExclusions only keeps it out of *new* picks, not a copy
   * already sitting in the result from before this Scheme was selected.
   * Call this alongside reconcileExtraHeroName any time the Villain
   * Groups result or the current Scheme may have just changed. */
  function reconcileExtraVillainGroupName() {
    const extraName = currentExtraVillainGroupName();
    if (!extraName) return;
    const items = state.result.villains || [];
    const locks = state.locks.villains || [];
    const idx = items.findIndex((v) => v.name === extraName);
    if (idx === -1 || locks[idx]) return;
    const pool = poolFor(CATEGORY_BY_KEY.villains);
    const [fresh] = pickRandom(pool, 1, villainDrawExclusions("villains", items));
    if (fresh) {
      items[idx] = fresh;
      state.result.villains = items;
    }
  }

  /** Evicts the current `extraVillainGroupFromExtraMastermind` derived
   * Villain Group (if any — see currentExtraVillainGroupFromExtraMastermindName
   * above) from the main Villain Groups result, if it's there and
   * unlocked, replacing it with a fresh pick — same idea as
   * reconcileExtraVillainGroupName above, just for the Drained-Mastermind-
   * derived case. Call this alongside reconcileExtraVillainGroupName any
   * time the Villain Groups result, the current Scheme, or the current
   * Drained Mastermind pick may have just changed. */
  function reconcileExtraVillainGroupFromExtraMastermind() {
    const extraName = currentExtraVillainGroupFromExtraMastermindName();
    if (!extraName) return;
    const items = state.result.villains || [];
    const locks = state.locks.villains || [];
    const idx = items.findIndex((v) => v.name === extraName);
    if (idx === -1 || locks[idx]) return;
    const pool = poolFor(CATEGORY_BY_KEY.villains);
    const [fresh] = pickRandom(pool, 1, villainDrawExclusions("villains", items));
    if (fresh) {
      items[idx] = fresh;
      state.result.villains = items;
    }
  }

  /** Evicts a leftover copy of whichever `requiredVillainGroupOneOf` name
   * was NOT picked (see resolveOneOfRequirement/villainDrawExclusions
   * above) from the main Villain Groups result, if it's there and
   * unlocked, replacing it with a fresh pick — same idea as
   * reconcileExtraVillainGroupName above: villainDrawExclusions only
   * keeps it out of *new* picks, not a copy already sitting in the
   * result from before this Scheme was selected. No-op if the current
   * Scheme has no such requirement. */
  function reconcileVillainGroupOneOf() {
    const scheme = currentSchemeData();
    const oneOf = scheme && scheme.overrides && scheme.overrides.requiredVillainGroupOneOf;
    if (!oneOf) return;
    const chosen = resolveOneOfRequirement("villains", oneOf);
    const items = state.result.villains || [];
    const locks = state.locks.villains || [];
    const idx = items.findIndex((v) => oneOf.includes(v.name) && v.name !== chosen);
    if (idx === -1 || locks[idx]) return;
    const pool = poolFor(CATEGORY_BY_KEY.villains);
    const [fresh] = pickRandom(pool, 1, villainDrawExclusions("villains", items));
    if (fresh) {
      items[idx] = fresh;
      state.result.villains = items;
    }
  }

  /** Evicts a leftover copy of any current extra-group member (see
   * EXTRA_GROUP_CONFIG/syncExtraGroup above — Master of Tyrants' Lurking
   * Masterminds, Sire Vampires' Vampire Neonates, Cytoplasm Spike
   * Invasion's named Cytoplasm Spikes, etc.) from that same category's
   * own main result, if it's there and unlocked, replacing it with a
   * fresh pick. Same idea as reconcileExtraVillainGroupName above:
   * extraGroupDrawExclusions only keeps an extra-group member out of
   * *new* picks going forward — it doesn't fix a copy already sitting in
   * the main result from before the Scheme (or a reroll) put that same
   * card into the extra group, e.g. the main Henchmen draw already
   * having "Cytoplasm Spikes" in it from a previous Scheme, and then
   * switching to Cytoplasm Spike Invasion without this would show it
   * duplicated in both the normal Henchmen section and its own callout.
   * Call this alongside the other reconcile* functions any time a
   * category's main result or the current Scheme may have just changed. */
  function reconcileExtraGroupNames() {
    Object.keys(EXTRA_GROUP_CONFIG).forEach((categoryKey) => {
      const config = EXTRA_GROUP_CONFIG[categoryKey];
      const extraNames = new Set((state[config.stateKey] || []).map((c) => c.name));
      if (!extraNames.size) return;
      const items = state.result[categoryKey] || [];
      const locks = state.locks[categoryKey] || [];
      const pool = poolFor(CATEGORY_BY_KEY[categoryKey]);
      items.forEach((item, idx) => {
        if (!item || !extraNames.has(item.name) || locks[idx]) return;
        const exclude = extraGroupDrawExclusions(
          categoryKey,
          villainDrawExclusions(categoryKey, heroDrawExclusions(categoryKey, items))
        );
        const [fresh] = pickRandom(pool, 1, exclude);
        if (fresh) items[idx] = fresh;
      });
      state.result[categoryKey] = items;
    });
  }

  /** Runs the full "make everything consistent" sequence any time the
   * current Mastermind, Scheme, or player count may have just changed (or
   * a whole snapshot of `state.result` was just dropped in from outside —
   * see restoreHistoryEntry) — recomputes derived numbers (Scheme
   * overrides, Hero Team Split/Count), tops up/trims counted categories
   * to match, evicts anything that's become stale or duplicated (Team
   * Split/Count picks, a named extra Hero/Villain Group, an "either X or
   * Y" requirement, an extra-group member — see the individual reconcile*
   * functions above for what each covers), then re-derives required cards
   * and extra groups for whatever's current now. Every call site that
   * used to inline this same sequence by hand called it in this exact
   * order; kept as one function specifically so a future addition (like
   * reconcileExtraGroupNames itself) only has to be wired in once instead
   * of copy-pasted across every site — which is exactly how the
   * Cytoplasm Spikes duplicate bug happened: reconcileExtraGroupNames was
   * added correctly, but restoreHistoryEntry's own copy of this sequence
   * didn't exist at all, so restoring an old "Past Setup" saved before
   * that fix (or before this function existed) could bring a duplicate
   * right back. Idempotent to call more than once in a row or from a
   * context where some of it doesn't strictly apply — every piece here
   * either no-ops or safely recomputes the same answer. */
  function resyncAndReconcile() {
    syncSchemeNumbers();
    syncHeroTeamSplit();
    syncHeroTeamCount();
    reconcileCountedCategories();
    reconcileHeroTeamSplit();
    reconcileHeroTeamCount();
    reconcileExtraHeroName();
    reconcileExtraVillainGroupName();
    reconcileExtraVillainGroupFromExtraMastermind();
    reconcileVillainGroupOneOf();
    syncRequiredCards();
    reconcileExtraGroupNames();
  }

  function clampOption(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** Recomputes Heroes / Villain Groups / Twists / Bystanders / Henchmen
   * from the current Player count (falling back to the Core Set solo/
   * no-preset defaults) plus whatever the current Scheme's `overrides`
   * layer on top — e.g. Negative Zone Prison Breakout's extra Henchman
   * group, Secret Invasion's required 6 Heroes, or Breach the Nexus of
   * All Realities' 3-Villain-Groups-at-1-2-players and 2-Twists-per-
   * Villain-Group — plus, for Heroes specifically, the current
   * Mastermind's own `heroCountDelta` if it has one (e.g. Alchemax
   * Executives adding an extra Hero as part of its own setup, on top of
   * whatever the Scheme separately adds). Villain Group count is
   * untouched unless a Scheme overrides it — most don't. Called on a
   * Scheme, Mastermind, or Player-count change — never fights a manual
   * stepper edit.
   *
   * Also resets the keyword-requirement cache and the extra-Hero pick
   * (see resolveKeywordRequirement/syncExtraCard) whenever the Scheme
   * itself has actually changed, so they get a fresh pick per Scheme
   * rather than reshuffling on every Player-count-only resync. */
  function syncSchemeNumbers() {
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    const schemeSignature = scheme ? `${scheme.name}|${scheme.exp}` : null;
    if (schemeSignature !== lastSchemeSignature) {
      clearKeywordChoicesWithPrefix("scheme:");
      state.extraCard = null;
      state.extraVillainGroup = null;
      state.extraHeroGroup = [];
      state.extraHenchmenGroup = [];
      state.extraMastermindGroup = [];
      state.weddingHeroes = [];
      state.heroTeamSplit = null;
      state.heroTeamCount = null;
      state.unveiledScheme = null;
      lastSchemeSignature = schemeSignature;
    }

    const players = state.options.players;
    const preset = players ? PLAYER_COUNT_TABLE[players] : null;

    const baseHeroCount = preset ? preset.heroCount : 5;
    const baseHenchmenCount = preset ? preset.henchmenCount : 1;
    const baseBystanders = preset ? preset.bystanders : 8;
    const baseVillainCount = preset ? preset.villainCount : 3;

    let heroCount = baseHeroCount;
    if (overrides.heroCountByPlayers && players && overrides.heroCountByPlayers[players] != null) {
      heroCount = overrides.heroCountByPlayers[players];
    } else if (overrides.heroCount != null) {
      heroCount = overrides.heroCount;
    }
    heroCount += overrides.heroCountDelta || 0;
    const mmData = currentMastermindData();
    heroCount += (mmData && mmData.heroCountDelta) || 0;

    let villainCount = baseVillainCount;
    if (overrides.villainCountByPlayers && players && overrides.villainCountByPlayers[players] != null) {
      villainCount = overrides.villainCountByPlayers[players];
    } else if (overrides.villainCount != null) {
      villainCount = overrides.villainCount;
    }
    villainCount += overrides.villainCountDelta || 0;
    villainCount += (mmData && mmData.villainCountDelta) || 0;
    villainCount = clampOption(villainCount, 1, 10);

    let twists;
    if (overrides.twistsByMastermind && mmData && overrides.twistsByMastermind[mmData.name] != null) {
      twists = overrides.twistsByMastermind[mmData.name];
    } else if (overrides.twistsPerVillainGroup != null) {
      twists = overrides.twistsPerVillainGroup * villainCount;
    } else if (overrides.twistsByPlayers && players && overrides.twistsByPlayers[players] != null) {
      twists = overrides.twistsByPlayers[players];
    } else if (overrides.twists != null) {
      twists = overrides.twists;
    } else {
      twists = 5;
    }

    let bystanders = overrides.bystanders != null ? overrides.bystanders : baseBystanders;
    bystanders += overrides.bystandersDelta || 0;
    if (overrides.bystandersDeltaByPlayers && players && overrides.bystandersDeltaByPlayers[players] != null) {
      bystanders += overrides.bystandersDeltaByPlayers[players];
    }
    let henchmenCount = baseHenchmenCount;
    if (overrides.henchmenCountByPlayers && players && overrides.henchmenCountByPlayers[players] != null) {
      henchmenCount = overrides.henchmenCountByPlayers[players];
    }
    henchmenCount += overrides.henchmenDelta || 0;

    state.options.heroCount = clampOption(heroCount, 3, 8);
    state.options.villainCount = villainCount;
    state.options.twists = clampOption(twists, 0, 16);
    state.options.bystanders = clampOption(bystanders, 0, 30);
    state.options.henchmenCount = clampOption(henchmenCount, 1, 4);

    saveState();
  }

  /** Grows or shrinks the *displayed* results for one counted category
   * (Villain Groups / Henchmen / Heroes) to match its current stepper
   * value, without discarding cards that are still wanted. Needed because
   * syncSchemeNumbers only updates the stepper number — on its own that
   * leaves a stale results list on screen (e.g. the stepper says
   * "Henchmen: 2" but only 1 card is actually shown) until the next full
   * Randomize Setup. Growing adds fresh random picks; shrinking drops
   * unlocked cards first, only touching locked ones if there's no choice. */
  function resizeCategoryTo(categoryKey) {
    const category = CATEGORY_BY_KEY[categoryKey];
    const n = countFor(category);
    const items = state.result[categoryKey] || [];
    const locks = state.locks[categoryKey] || [];
    if (!items.length || items.length === n) return;

    if (items.length < n) {
      const fresh = pickRandom(poolFor(category), n - items.length, extraGroupDrawExclusions(categoryKey, villainDrawExclusions(categoryKey, heroDrawExclusions(categoryKey, items))));
      state.result[categoryKey] = items.concat(fresh);
      state.locks[categoryKey] = locks.concat(fresh.map(() => false));
      return;
    }

    const excess = items.length - n;
    const dropIndices = items
      .map((_, i) => i)
      .sort((a, b) => (locks[a] ? 1 : 0) - (locks[b] ? 1 : 0)) // unlocked first
      .slice(0, excess);
    const drop = new Set(dropIndices);
    state.result[categoryKey] = items.filter((_, i) => !drop.has(i));
    state.locks[categoryKey] = locks.filter((_, i) => !drop.has(i));
  }

  function reconcileCountedCategories() {
    ["villains", "henchmen", "heroes"].forEach(resizeCategoryTo);
  }

  function requiredReason(categoryKey, item) {
    const mmData = currentMastermindData();
    if (
      mmData &&
      (mmData.leads || []).some((req) => {
        if (req.category !== categoryKey) return false;
        if (req.name) return req.name === item.name;
        if (req.nameContains) return resolveNameMatchRequirement(categoryKey, req.nameContains) === item.name;
        return false;
      })
    ) {
      return `always led by ${mmData.name}`;
    }
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    if (categoryKey === "villains" && overrides.requiredVillainGroup === item.name) {
      return `required by ${scheme.name}`;
    }
    if (categoryKey === "villains" && overrides.requiredVillainGroups && overrides.requiredVillainGroups.includes(item.name)) {
      return `required by ${scheme.name}`;
    }
    if (
      categoryKey === "villains" &&
      overrides.requiredVillainGroupKeyword &&
      resolveKeywordRequirement("villains", overrides.requiredVillainGroupKeyword) === item.name
    ) {
      return `required by ${scheme.name}`;
    }
    if (categoryKey === "henchmen" && overrides.requiredHenchmen === item.name) {
      return `required by ${scheme.name}`;
    }
    if (categoryKey === "heroes" && overrides.requiredHero === item.name) {
      return `required by ${scheme.name}`;
    }
    if (categoryKey === "heroes" && overrides.requiredHeroTeam && resolveTeamRequirement(overrides.requiredHeroTeam) === item.name) {
      return `required by ${scheme.name}`;
    }
    if (categoryKey === "heroes" && overrides.requiredHeroNameContains && overrides.requiredHeroNameContainsCount > 1) {
      if (
        resolveNameMatchRequirementCount("heroes", overrides.requiredHeroNameContains, overrides.requiredHeroNameContainsCount).includes(
          item.name
        )
      ) {
        return `required by ${scheme.name}`;
      }
    } else if (
      categoryKey === "heroes" &&
      overrides.requiredHeroNameContains &&
      resolveNameMatchRequirement("heroes", overrides.requiredHeroNameContains) === item.name
    ) {
      return `required by ${scheme.name}`;
    }
    return null;
  }

  /** Sub-line text for a card row: expansion name, plus a Team tag for
   * Heroes, plus why a Villain Group / Henchman is required, if it is. */
  /** Sub-line text for a card row in Card Pool's Manage/Choose sheets:
   * expansion name, plus a Team tag for Heroes. Cards with the same
   * printed name can appear more than once across expansions with
   * meaningfully different rules (e.g. "Secret Invasion of the Skrull
   * Shapeshifters" or "Super Hero Civil War") — without this, two
   * identical-looking rows would be impossible to tell apart. */
  function poolRowSubText(category, item) {
    const expName = (EXPANSIONS.find((e) => e.id === item.exp) || {}).name || item.exp;
    const parts = [expName];
    if (category.key === "heroes" && item.team) parts.push(item.team);
    return parts.join(" · ");
  }

  /** Sub-line text for a result row: poolRowSubText, plus why a Villain
   * Group / Henchman / Hero is required, if it is. */
  function subText(category, item) {
    const parts = [poolRowSubText(category, item)];
    const reason = requiredReason(category.key, item);
    if (reason) parts.push(reason);
    return parts.join(" · ");
  }

  /** A card row's name, with its Team's badge icon (see TEAM_ICONS in
   * js/data.js) prepended when one exists — item.team is only ever set
   * on Heroes, so this is a no-op for every other category. TEAM_ICONS
   * is being filled in one Team at a time, so most Heroes still just
   * show their name with no icon. */
  function nameWithTeamIcon(item) {
    const frag = document.createDocumentFragment();
    const src = item.team && TEAM_ICONS[item.team];
    if (src) {
      const icon = document.createElement("img");
      icon.src = src;
      icon.alt = "";
      icon.className = "team-icon";
      frag.appendChild(icon);
    }
    frag.appendChild(document.createTextNode(item.name));
    return frag;
  }

  function poolWarnings() {
    const warnings = CATEGORIES.map((category) => {
      const pool = poolFor(category);
      const n = countFor(category);
      if (pool.length < n) {
        const teamNote = category.key === "heroes" && (state.excludedTeams.size || state.excludeUnaffiliated) ? "/team filter" : "";
        return `${category.label}: need ${n}, only ${pool.length} available with current expansions/exclusions${teamNote}.`;
      }
      return null;
    }).filter(Boolean);

    const scheme = currentSchemeData();
    const split = scheme && scheme.overrides && scheme.overrides.heroTeamSplit;
    if (split && !state.heroTeamSplit) {
      warnings.push(
        `Heroes: "${scheme.name}" needs ${split.count} Teams with ${split.perTeam}+ Heroes each — not enough currently qualify, so Heroes were picked at random instead.`
      );
    }
    return warnings;
  }

  // ---------- History ----------

  /** Snapshots the live state.result into a brand-new History entry and
   * makes it the current one. Past Setups only ever gains an entry
   * through this — called from logCurrentOutcome the moment a result
   * actually gets logged, not from randomizeAll/rerollAllUnlocked — so
   * an un-played or abandoned setup never clutters the list, and
   * whatever's saved is exactly what was on screen when the game ended
   * (locks, rerolls, and all). */
  function createHistoryEntry() {
    const snapshot = {};
    CATEGORIES.forEach((c) => (snapshot[c.key] = (state.result[c.key] || []).map((item) => ({ ...item }))));
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      players: state.options.players,
      result: snapshot,
      outcome: null,
      loggedAt: null,
    };
    state.history.unshift(entry);
    state.currentHistoryId = entry.id;
    saveState();
    return entry;
  }

  function restoreHistoryEntry(entry) {
    CATEGORIES.forEach((c) => {
      state.result[c.key] = (entry.result[c.key] || []).map((item) => ({ ...item }));
      state.locks[c.key] = state.result[c.key].map(() => false);
    });
    state.currentHistoryId = entry.id;
    // A saved "Past Setup" is a raw snapshot — resync/reconcile it the
    // same way any other Mastermind/Scheme change would be, so stale
    // extra-group state (or a duplicate that was only fixed in a later
    // version of the app) doesn't come back to life on restore. See
    // resyncAndReconcile's own doc comment for why this call was missing
    // in the first place.
    resyncAndReconcile();
    render();
  }

  function deleteHistoryEntry(id) {
    const entry = state.history.find((h) => h.id === id);
    if (entry && entry.outcome) applyEntryOutcome(entry, entry.outcome, -1);
    if (state.currentHistoryId === id) state.currentHistoryId = null;
    state.history = state.history.filter((h) => h.id !== id);
    saveState();
  }

  function currentHistoryEntry() {
    return state.history.find((h) => h.id === state.currentHistoryId) || null;
  }

  /** Which stat bucket ("wins"/"losses") a category's cards land in for
   * a given outcome — a "win" (Heroes beat the villain side) credits
   * every Hero with a win and every Mastermind/Scheme/Villain
   * Group/Henchman in that setup with a loss, and a "loss" (evil wins)
   * does the reverse. */
  function statSide(categoryKey, outcome) {
    const heroSide = categoryKey === "heroes";
    if (outcome === "win") return heroSide ? "wins" : "losses";
    return heroSide ? "losses" : "wins";
  }

  function adjustCardStat(categoryKey, name, side, delta) {
    const bucket = state.cardStats[categoryKey];
    const current = bucket[name] || { wins: 0, losses: 0 };
    current[side] = Math.max(0, current[side] + delta);
    bucket[name] = current;
  }

  /** Adds (delta 1) or removes (delta -1) one history entry's contribution
   * to state.cardStats (every card in its snapshot, scored per statSide
   * above) and to state.gameLog's lifetime win/loss tally — the latter
   * kept separate from state.history because it's kept even after
   * "Clear All" empties the History list, so the stats it fed don't
   * disappear along with the audit trail. Used both to apply a
   * freshly-logged outcome and to reverse a previously-logged one
   * (editing, clearing, or deleting the entry). */
  function applyEntryOutcome(entry, outcome, delta) {
    CATEGORIES.forEach((c) => {
      (entry.result[c.key] || []).forEach((item) => {
        adjustCardStat(c.key, item.name, statSide(c.key, outcome), delta);
      });
    });
    const bucket = outcome === "win" ? "heroWins" : "evilWins";
    state.gameLog[bucket] = Math.max(0, (state.gameLog[bucket] || 0) + delta);
  }

  /** Logs or edits a history entry's win/loss outcome, keeping
   * state.cardStats in sync: reverses whatever it previously
   * contributed (if anything), then applies the new outcome. Pass
   * outcome: null to clear a mislogged result. `resyncFromLive`
   * re-snapshots entry.result from the current live state.result
   * first — used when logging the setup you just finished playing, in
   * case a card or two got rerolled after it was first generated. */
  function setEntryOutcome(entry, outcome, { resyncFromLive = false } = {}) {
    if (entry.outcome) applyEntryOutcome(entry, entry.outcome, -1);
    if (resyncFromLive) {
      CATEGORIES.forEach((c) => (entry.result[c.key] = (state.result[c.key] || []).map((item) => ({ ...item }))));
    }
    entry.outcome = outcome || null;
    entry.loggedAt = outcome ? Date.now() : null;
    if (outcome) applyEntryOutcome(entry, outcome, 1);
    saveState();
  }

  /** Toggles an outcome on/off: clicking the already-logged result again
   * clears it, otherwise (re-)logs the tapped outcome. Clearing removes
   * the entry from History entirely rather than leaving an unlogged
   * ghost behind — Past Setups only keeps setups that were actually
   * logged, so un-logging one is the same as it never having been saved.
   * Shared by logCurrentOutcome (current setup, resyncing from live
   * state) and logHistoryOutcome (a past entry, as saved) below. */
  function toggleAndPruneOutcome(entry, outcome, opts) {
    const next = entry.outcome === outcome ? null : outcome;
    if (next) {
      setEntryOutcome(entry, next, opts);
      return;
    }
    if (entry.outcome) applyEntryOutcome(entry, entry.outcome, -1);
    state.history = state.history.filter((h) => h.id !== entry.id);
    if (state.currentHistoryId === entry.id) state.currentHistoryId = null;
    saveState();
  }

  /** Logs (or edits/clears) the outcome for the setup currently on
   * screen — creates its History entry on first log (from the live,
   * possibly rerolled/locked result) since nothing's saved before then;
   * see createHistoryEntry/toggleAndPruneOutcome above. */
  function logCurrentOutcome(outcome) {
    const entry = currentHistoryEntry() || createHistoryEntry();
    toggleAndPruneOutcome(entry, outcome, { resyncFromLive: true });
    renderOutcomeStatus();
    renderHistoryCount();
  }

  /** Logs (or edits/clears) a past setup's outcome from its History
   * sheet row — the entry already exists (that's why it's in the list),
   * so unlike logCurrentOutcome this never creates one, only edits or
   * removes it. */
  function logHistoryOutcome(id, outcome) {
    const entry = state.history.find((h) => h.id === id);
    if (!entry) return;
    toggleAndPruneOutcome(entry, outcome);
    renderSheet();
    renderHistoryCount();
    renderOutcomeStatus();
  }

  /** Re-snapshots the current setup's History entry from live
   * state.result without changing its logged outcome — just reusing
   * setEntryOutcome's resync (and, if already logged, reverse/reapply)
   * logic with the same outcome it already had. Called after "Reroll
   * All" so the Past Setup you already have reflects what's actually on
   * screen instead of the original roll. No-op if there's no current
   * entry (nothing saved yet to sync into). */
  function syncCurrentHistorySnapshot() {
    const entry = currentHistoryEntry();
    if (!entry) return;
    setEntryOutcome(entry, entry.outcome, { resyncFromLive: true });
  }

  function formatTimestamp(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  // ---------- Rendering ----------

  const el = {
    openExpansions: document.getElementById("open-expansions"),
    expansionsCount: document.getElementById("expansions-count"),
    cardPoolList: document.getElementById("card-pool-list"),
    teamThemeSection: document.getElementById("team-theme-section"),
    openTeamTheme: document.getElementById("open-team-theme"),
    teamThemeCount: document.getElementById("team-theme-count"),
    playersSegmented: document.getElementById("players-segmented"),
    randomizeAll: document.getElementById("randomize-all"),
    warnings: document.getElementById("warnings"),
    rerollGroup: document.getElementById("reroll-group"),
    rerollAllBtn: document.getElementById("reroll-all"),
    results: document.getElementById("results"),
    copyGroup: document.getElementById("copy-group"),
    copyBtn: document.getElementById("copy-setup"),
    outcomeGroup: document.getElementById("outcome-group"),
    logWinBtn: document.getElementById("log-win"),
    logLossBtn: document.getElementById("log-loss"),
    excludeGroup: document.getElementById("exclude-group"),
    excludeBtn: document.getElementById("exclude-setup"),
    openHistory: document.getElementById("open-history"),
    historyCount: document.getElementById("history-count"),
    sheetOverlay: document.getElementById("sheet-overlay"),
    sheetBackdrop: document.getElementById("sheet-backdrop"),
    sheetCancel: document.getElementById("sheet-cancel"),
    sheetAction: document.getElementById("sheet-action"),
    sheetTitle: document.getElementById("sheet-title"),
    sheetSearchWrap: document.getElementById("sheet-search-wrap"),
    sheetSearch: document.getElementById("sheet-search"),
    sheetBulkActions: document.getElementById("sheet-bulk-actions"),
    sheetSelectAll: document.getElementById("sheet-select-all"),
    sheetDeselectAll: document.getElementById("sheet-deselect-all"),
    sheetList: document.getElementById("sheet-list"),
  };

  /** The main-page "Manage Expansions" nav row just shows a live count
   * (e.g. "12 of 40 on") — same idea as renderHistoryCount for "Past
   * Setups" — since the actual toggle list now lives in its own sheet
   * (see openExpansionsSheet/expansionRow below) rather than taking up
   * space inline on the main page. */
  function renderExpansionsCount() {
    el.expansionsCount.textContent = `${state.expansions.size} of ${EXPANSIONS.length}`;
  }

  /** One toggle row for the "Expansions" sheet — same checkbox/switch
   * markup and behavior the inline list used before it moved into its
   * own sheet, just appended to el.sheetList instead of a fixed list on
   * the main page, and refreshing the sheet itself (so the Select
   * All/Deselect All bulk-action bar's disabled state and the main
   * page's live count both stay in sync) rather than just the one
   * row's own list. */
  function expansionRow(exp) {
    const id = `exp-${exp.id}`;
    const li = document.createElement("li");
    li.className = "ios-row";

    const text = document.createElement("span");
    text.className = "row-text";
    if (exp.confidence === "light" || exp.confidence === "none") {
      const main = document.createElement("span");
      main.className = "row-text-main";
      main.textContent = exp.name;
      const sub = document.createElement("span");
      sub.className = "row-text-sub";
      sub.textContent = exp.confidence === "none" ? "No card data yet" : "Limited card data";
      text.appendChild(main);
      text.appendChild(sub);
    } else {
      text.textContent = exp.name;
    }

    const switchWrap = document.createElement("span");
    switchWrap.className = "ios-switch";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.setAttribute("aria-label", exp.name);
    input.checked = state.expansions.has(exp.id);
    input.addEventListener("change", () => {
      if (input.checked) state.expansions.add(exp.id);
      else state.expansions.delete(exp.id);
      syncRequiredCards();
      saveState();
      renderWarnings();
      renderExpansionsCount();
      renderCardPool();
      renderTeamThemeCount();
      renderResults();
      renderSheet();
    });

    const track = document.createElement("span");
    track.className = "track";
    const thumb = document.createElement("span");
    thumb.className = "thumb";

    switchWrap.appendChild(input);
    switchWrap.appendChild(track);
    switchWrap.appendChild(thumb);

    li.appendChild(text);
    li.appendChild(switchWrap);
    return li;
  }

  // Sentinel row label for the "no known Team" toggle — safe as a plain
  // string since it's never a real Marvel team name (see
  // hasUnaffiliatedHeroes/teamRow below).
  const UNAFFILIATED = "Unaffiliated";

  /** The main-page "Team Filter" nav row shows a live "N of M" summary —
   * same convention as every other Manage row (Expansions, Card Pool
   * categories): every Team (plus "Unaffiliated" if any Hero has no
   * Team) starts included, and the count is how many still are. The
   * actual toggle list lives in its own sheet (see
   * openTeamThemeSheet/teamRow below) rather than a chip row on the
   * main page. */
  function renderTeamThemeCount() {
    const teams = availableTeams();
    const hasUnaffiliated = hasUnaffiliatedHeroes();
    const total = teams.length + (hasUnaffiliated ? 1 : 0);
    el.teamThemeSection.classList.toggle("hidden", total === 0);
    if (!total) return;
    const excluded = teams.filter((t) => state.excludedTeams.has(t)).length + (hasUnaffiliated && state.excludeUnaffiliated ? 1 : 0);
    el.teamThemeCount.textContent = `${total - excluded} of ${total}`;
  }

  /** One toggle row for the "Hero Team Theme" sheet — same switch markup
   * and "on = included" convention as expansionRow/manageRow. Every Team
   * (and "Unaffiliated", for Heroes with no known Team) starts checked;
   * unchecking one excludes its Heroes from the pool via poolFor above. */
  function teamRow(team) {
    const li = document.createElement("li");
    li.className = "ios-row";

    const text = document.createElement("span");
    text.className = "row-text";
    const iconSrc = TEAM_ICONS[team];
    if (iconSrc) {
      const icon = document.createElement("img");
      icon.src = iconSrc;
      icon.alt = "";
      icon.className = "team-icon";
      text.appendChild(icon);
    }
    text.appendChild(document.createTextNode(team));

    const switchWrap = document.createElement("span");
    switchWrap.className = "ios-switch";

    const isUnaffiliated = team === UNAFFILIATED;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("aria-label", team);
    input.checked = isUnaffiliated ? !state.excludeUnaffiliated : !state.excludedTeams.has(team);
    input.addEventListener("change", () => {
      if (isUnaffiliated) {
        state.excludeUnaffiliated = !input.checked;
      } else if (input.checked) {
        state.excludedTeams.delete(team);
      } else {
        state.excludedTeams.add(team);
      }
      saveState();
      renderWarnings();
      renderCardPool();
      renderTeamThemeCount();
      renderSheet();
    });

    const track = document.createElement("span");
    track.className = "track";
    const thumb = document.createElement("span");
    thumb.className = "thumb";

    switchWrap.appendChild(input);
    switchWrap.appendChild(track);
    switchWrap.appendChild(thumb);

    li.appendChild(text);
    li.appendChild(switchWrap);
    return li;
  }

  function renderCardPool() {
    el.cardPoolList.innerHTML = "";
    CATEGORIES.forEach((category) => {
      const total = category.pool.filter((c) => state.expansions.has(c.exp)).length;
      const available = poolFor(category).length;

      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ios-row nav-row";
      btn.disabled = total === 0;

      const text = document.createElement("span");
      text.className = "row-text";
      text.textContent = category.label;

      const trailing = document.createElement("span");
      trailing.className = "row-trailing";
      trailing.textContent = total === 0 ? "none in pool" : `${available} of ${total}`;

      const chevron = document.createElement("span");
      chevron.className = "chevron";
      chevron.textContent = "›";

      btn.appendChild(text);
      btn.appendChild(trailing);
      btn.appendChild(chevron);
      btn.addEventListener("click", () => openManageSheet(category.key));

      li.appendChild(btn);
      el.cardPoolList.appendChild(li);
    });
  }

  function renderPlayersSegmented() {
    const buttons = Array.from(el.playersSegmented.querySelectorAll("button"));
    buttons.forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.value) === state.options.players);
    });
  }

  function applyPlayerCount(n) {
    const preset = PLAYER_COUNT_TABLE[n];
    if (!preset) return;
    state.options.players = n;
    resyncAndReconcile(); // sets heroCount/villainCount/henchmenCount/bystanders/twists: this player count's base, plus the active Scheme's overrides on top
    renderPlayersSegmented();
    renderWarnings();
    renderResults();
  }

  function detectPlayersFromOptions() {
    const match = Object.entries(PLAYER_COUNT_TABLE).find(([, preset]) => {
      return (
        preset.heroCount === state.options.heroCount &&
        preset.villainCount === state.options.villainCount &&
        preset.henchmenCount === state.options.henchmenCount &&
        preset.bystanders === state.options.bystanders
      );
    });
    state.options.players = match ? Number(match[0]) : null;
  }

  function henchmenNoteText() {
    const preset = state.options.players ? PLAYER_COUNT_TABLE[state.options.players] : null;
    return (preset && preset.henchmenNote) || null;
  }

  /** Builds one self-contained count-adjustment row (label + stepper) for a
   * post-randomize results section, e.g. "Villain Groups" or "Bystanders" —
   * the same pattern originally proven for the Scheme Twists stepper.
   * `onChange` runs before the shared re-render/re-save so a counted
   * category (Villain Groups/Henchmen/Heroes) can resize its result list. */
  function countStepperRow(labelText, key, min, max, onChange) {
    const row = document.createElement("li");
    row.className = "ios-row";

    const text = document.createElement("span");
    text.className = "row-text";
    text.textContent = labelText;

    const stepper = document.createElement("span");
    stepper.className = "stepper";
    const decBtn = document.createElement("button");
    decBtn.type = "button";
    decBtn.className = "stepper-btn";
    decBtn.textContent = "−";
    decBtn.setAttribute("aria-label", `Decrease ${labelText.toLowerCase()}`);
    const valueSpan = document.createElement("span");
    valueSpan.className = "stepper-value";
    const incBtn = document.createElement("button");
    incBtn.type = "button";
    incBtn.className = "stepper-btn";
    incBtn.textContent = "+";
    incBtn.setAttribute("aria-label", `Increase ${labelText.toLowerCase()}`);

    const value = state.options[key];
    valueSpan.textContent = value;
    decBtn.disabled = value <= min;
    incBtn.disabled = value >= max;

    stepper.appendChild(decBtn);
    stepper.appendChild(valueSpan);
    stepper.appendChild(incBtn);
    stepper.addEventListener("click", (e) => {
      const btn = e.target.closest(".stepper-btn");
      if (!btn) return;
      const delta = btn === incBtn ? 1 : -1;
      state.options[key] = clampOption(state.options[key] + delta, min, max);
      if (onChange) onChange();
      detectPlayersFromOptions();
      saveState();
      renderPlayersSegmented();
      renderResults();
    });

    row.appendChild(text);
    row.appendChild(stepper);
    return row;
  }

  function renderWarnings() {
    const warnings = poolWarnings();
    el.warnings.innerHTML = "";
    if (!warnings.length) {
      el.warnings.classList.add("hidden");
      el.randomizeAll.disabled = state.expansions.size === 0;
      return;
    }
    el.warnings.classList.remove("hidden");
    el.randomizeAll.disabled = true;
    warnings.forEach((w) => {
      const p = document.createElement("p");
      p.textContent = `⚠️ ${w}`;
      el.warnings.appendChild(p);
    });
  }

  function resultRow(category, item, index) {
    const li = document.createElement("li");
    li.className = "result-row";

    const locked = !!(state.locks[category.key] || [])[index];
    if (locked) li.classList.add("locked");

    const text = document.createElement("div");
    text.className = "result-row-text";
    const mainSpan = document.createElement("span");
    mainSpan.className = "row-text-main";
    mainSpan.appendChild(nameWithTeamIcon(item));
    const subSpan = document.createElement("span");
    subSpan.className = "row-text-sub";
    subSpan.textContent = subText(category, item);
    text.appendChild(mainSpan);
    text.appendChild(subSpan);

    const actions = document.createElement("div");
    actions.className = "result-row-actions";

    const chooseBtn = document.createElement("button");
    chooseBtn.type = "button";
    chooseBtn.className = "round-btn";
    chooseBtn.textContent = "🔍";
    chooseBtn.title = "Choose a specific card for this slot";
    chooseBtn.addEventListener("click", () => openChooseSheet(category.key, index));

    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.className = "round-btn";
    lockBtn.textContent = locked ? "🔒" : "🔓";
    lockBtn.title = locked ? "Locked — tap to unlock" : "Unlocked — tap to lock";
    lockBtn.addEventListener("click", () => toggleLock(category.key, index));

    actions.appendChild(chooseBtn);
    actions.appendChild(lockBtn);

    li.appendChild(text);
    li.appendChild(actions);
    return li;
  }

  function renderResults() {
    el.results.innerHTML = "";
    const hasAnyResult = CATEGORIES.some((c) => (state.result[c.key] || []).length);

    if (!hasAnyResult) {
      el.rerollGroup.classList.add("hidden");
      el.copyGroup.classList.add("hidden");
      el.outcomeGroup.classList.add("hidden");
      el.excludeGroup.classList.add("hidden");
      return;
    }

    el.rerollGroup.classList.remove("hidden");
    el.copyGroup.classList.remove("hidden");
    el.outcomeGroup.classList.remove("hidden");
    el.excludeGroup.classList.remove("hidden");
    renderOutcomeStatus();

    CATEGORIES.forEach((category) => {
      const items = state.result[category.key] || [];
      if (!items.length) return;

      const section = document.createElement("section");
      section.className = "ios-group";

      const header = document.createElement("div");
      header.className = "group-header";
      const span = document.createElement("span");
      span.textContent = category.label;
      header.appendChild(span);
      section.appendChild(header);

      const list = document.createElement("ul");
      list.className = "ios-list";
      if (category.countKey) {
        list.appendChild(
          countStepperRow("Count", category.countKey, category.min, category.max, () => resizeCategoryTo(category.key))
        );
      }
      items.forEach((item, index) => list.appendChild(resultRow(category, item, index)));
      section.appendChild(list);

      if (category.key === "scheme" && items[0] && items[0].setupNote) {
        const note = document.createElement("div");
        note.className = "scheme-note";
        note.innerHTML = `<strong>Setup note</strong><br>${items[0].setupNote.replace(/\n/g, "<br>")}`;
        section.appendChild(note);
      }

      if (category.key === "henchmen") {
        const noteText = henchmenNoteText();
        if (noteText) {
          const note = document.createElement("p");
          note.className = "group-footer";
          note.textContent = noteText;
          section.appendChild(note);
        }
      }

      el.results.appendChild(section);

      if (category.key === "scheme") el.results.appendChild(villainDeckSection(items[0]));
      if (EXTRA_GROUP_CONFIG[category.key]) el.results.appendChild(extraGroupSection(category.key));
      if (category.key === "heroes") el.results.appendChild(weddingHeroesSection());
    });
  }

  /** Keeps the "Log Result" buttons (see index.html #outcome-group)
   * highlighted to match the currently displayed setup's logged
   * outcome, if any — see currentHistoryEntry/logCurrentOutcome above.
   * The group's own visibility is handled by renderResults (it stays
   * shown any time there's a result on screen), not here: tapping one
   * of these buttons is what creates the History entry in the first
   * place, so there's usually no entry yet when this renders. */
  function renderOutcomeStatus() {
    const entry = currentHistoryEntry();
    el.logWinBtn.classList.toggle("active-outcome", !!entry && entry.outcome === "win");
    el.logLossBtn.classList.toggle("active-outcome", !!entry && entry.outcome === "loss");
  }

  /** Every card currently in play for this setup — the 5 counted
   * categories plus any active extra groups (derived Villain Group,
   * extra Heroes/Henchmen/Mastermind groups, Wedding Heroes) — as
   * {categoryKey, name} pairs, for the "Exclude This Setup's Cards"
   * button below. */
  function allCurrentSetupCards() {
    const cards = [];
    CATEGORIES.forEach((c) => (state.result[c.key] || []).forEach((item) => cards.push({ categoryKey: c.key, name: item.name })));
    if (state.extraVillainGroup) cards.push({ categoryKey: "villains", name: state.extraVillainGroup.name });
    (state.extraHeroGroup || []).forEach((c) => cards.push({ categoryKey: "heroes", name: c.name }));
    (state.extraHenchmenGroup || []).forEach((c) => cards.push({ categoryKey: "henchmen", name: c.name }));
    (state.extraMastermindGroup || []).forEach((c) => cards.push({ categoryKey: "mastermind", name: c.name }));
    (state.weddingHeroes || []).forEach((c) => c && cards.push({ categoryKey: "heroes", name: c.name }));
    return cards;
  }

  function excludeCurrentSetup() {
    const cards = allCurrentSetupCards();
    if (!cards.length) return;
    cards.forEach(({ categoryKey, name }) => state.exclusions[categoryKey].add(name));
    syncRequiredCards();
    saveState();
    renderWarnings();
    renderCardPool();
    renderResults();
  }

  /** Shown right under a category's own section (Heroes, Henchmen, ...)
   * whenever the current Scheme sets that category's extra-group count
   * override (see EXTRA_GROUP_CONFIG/syncExtraGroup above) — a second,
   * separate group of random cards, e.g. "The Time Heist"'s Heroes "Past
   * Hero Deck" or "Sire Vampires at the Blood Bank"'s Henchmen "Vampire
   * Neonates." Titled by that category's label override (falling back to
   * "Extra Heroes"/"Extra Henchmen"). Each row has its own reroll button,
   * but no choose-specific-card or lock control — this is a lighter-weight
   * "extra card" pool, not a full counted category. Returns an empty
   * (harmless to append) DocumentFragment when the current Scheme has no
   * such group for this category. */
  function extraGroupSection(categoryKey) {
    const config = EXTRA_GROUP_CONFIG[categoryKey];
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    const isNamed = !!(overrides[config.namesKey] && overrides[config.namesKey].length);
    if (!isNamed && !overrides[config.countKey]) return document.createDocumentFragment();

    const category = CATEGORY_BY_KEY[categoryKey];
    const section = document.createElement("section");
    section.className = "ios-group";

    const header = document.createElement("div");
    header.className = "group-header";
    const headerSpan = document.createElement("span");
    headerSpan.textContent = overrides[config.labelKey] || `Extra ${category.label}`;
    header.appendChild(headerSpan);
    section.appendChild(header);

    const note = overrides[config.noteKey];

    const list = document.createElement("ul");
    list.className = "ios-list";
    (state[config.stateKey] || []).forEach((card, index) => {
      const li = document.createElement("li");
      li.className = "ios-row";

      const text = document.createElement("span");
      text.className = "row-text";
      const main = document.createElement("span");
      main.className = "row-text-main";
      main.textContent = card.name;
      const sub = document.createElement("span");
      sub.className = "row-text-sub";
      sub.textContent = poolRowSubText(category, card) + (note ? " · " + note : "");
      text.appendChild(main);
      text.appendChild(sub);

      const rerollBtn = document.createElement("button");
      rerollBtn.type = "button";
      rerollBtn.className = "round-btn";
      rerollBtn.textContent = "🔁";
      if (isNamed) {
        rerollBtn.title = "Fixed by this Scheme";
        rerollBtn.disabled = true;
      } else {
        rerollBtn.title = "Reroll just this one";
        rerollBtn.addEventListener("click", () => rerollExtraGroupSlot(categoryKey, index));
      }

      li.appendChild(text);
      li.appendChild(rerollBtn);
      list.appendChild(li);
    });
    section.appendChild(list);

    return section;
  }

  /** Renders the "Wedding Heroes" section for a Scheme's `weddingHeroes`
   * (see data.js/syncWeddingHeroes) — one male-tagged Hero, one
   * female-tagged Hero, each independently rerollable within its own
   * gender. */
  function weddingHeroesSection() {
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    if (!overrides.weddingHeroes) return document.createDocumentFragment();

    const category = CATEGORY_BY_KEY.heroes;
    const section = document.createElement("section");
    section.className = "ios-group";

    const header = document.createElement("div");
    header.className = "group-header";
    const headerSpan = document.createElement("span");
    headerSpan.textContent = "Wedding Heroes";
    header.appendChild(headerSpan);
    section.appendChild(header);

    const list = document.createElement("ul");
    list.className = "ios-list";
    (state.weddingHeroes || []).forEach((card, index) => {
      if (!card) return;
      const li = document.createElement("li");
      li.className = "ios-row";

      const text = document.createElement("span");
      text.className = "row-text";
      const main = document.createElement("span");
      main.className = "row-text-main";
      main.textContent = card.name;
      const sub = document.createElement("span");
      sub.className = "row-text-sub";
      sub.textContent = poolRowSubText(category, card);
      text.appendChild(main);
      text.appendChild(sub);

      const rerollBtn = document.createElement("button");
      rerollBtn.type = "button";
      rerollBtn.className = "round-btn";
      rerollBtn.textContent = "🔁";
      rerollBtn.title = "Reroll just this one";
      rerollBtn.addEventListener("click", () => rerollWeddingHero(index));

      li.appendChild(text);
      li.appendChild(rerollBtn);
      list.appendChild(li);
    });
    section.appendChild(list);

    return section;
  }

  /** A reference section shown once you've randomized, covering everything
   * that only lives as a count in the Villain Deck rather than as a named
   * card (Bystanders, Master Strikes, Twists — none of these have a home in
   * Setup Size since Master Strikes/Twists are meaningless before you know
   * the Scheme), plus the current Scheme's Twist effect and Evil Wins text,
   * since both get referenced throughout the game, not just at setup. */
  function villainDeckSection(schemeItem) {
    const scheme = SCHEMES.find((s) => s.name === schemeItem.name && s.exp === schemeItem.exp);

    const section = document.createElement("section");
    section.className = "ios-group";

    const header = document.createElement("div");
    header.className = "group-header";
    const span = document.createElement("span");
    span.textContent = "Villain Deck";
    header.appendChild(span);
    section.appendChild(header);

    const list = document.createElement("ul");
    list.className = "ios-list";
    list.appendChild(countStepperRow("Bystanders", "bystanders", 0, 30));
    list.appendChild(countStepperRow("Master Strikes", "masterStrikes", 0, 10));
    list.appendChild(countStepperRow("Twists", "twists", 0, 16));

    if (scheme && scheme.overrides && (scheme.overrides.extraHero || scheme.overrides.extraHeroName) && state.extraCard) {
      const isNamed = !!scheme.overrides.extraHeroName;
      const extraRow = document.createElement("li");
      extraRow.className = "ios-row";

      const text = document.createElement("span");
      text.className = "row-text";
      const main = document.createElement("span");
      main.className = "row-text-main";
      main.textContent = state.extraCard.name;
      const sub = document.createElement("span");
      sub.className = "row-text-sub";
      const heroSetInfo = poolRowSubText(CATEGORY_BY_KEY.heroes, state.extraCard);
      sub.textContent = heroSetInfo + " · Extra Hero — " + (scheme.overrides.extraHeroNote || "8 random cards go in the Villain Deck");
      text.appendChild(main);
      text.appendChild(sub);

      const rerollBtn = document.createElement("button");
      rerollBtn.type = "button";
      rerollBtn.className = "round-btn";
      rerollBtn.textContent = "🔁";
      if (isNamed) {
        rerollBtn.title = "Fixed by this Scheme";
        rerollBtn.disabled = true;
      } else {
        rerollBtn.title = "Reroll the extra Hero";
        rerollBtn.addEventListener("click", rerollExtraCard);
      }

      extraRow.appendChild(text);
      extraRow.appendChild(rerollBtn);
      list.appendChild(extraRow);
    }

    const mmData = currentMastermindData();
    const schemeExtraVGName = scheme && scheme.overrides && scheme.overrides.extraVillainGroupName;
    const schemeExtraVGFromDrained = scheme && scheme.overrides && scheme.overrides.extraVillainGroupFromExtraMastermind;
    const mmHasExtraVG = !!(mmData && mmData.extraVillainGroup);
    if (schemeExtraVGName || schemeExtraVGFromDrained || mmHasExtraVG) {
      const isVGNamed = !!schemeExtraVGName;
      const isVGFromDrained = !!schemeExtraVGFromDrained;
      const vgNote = isVGNamed || isVGFromDrained ? scheme.overrides.extraVillainGroupNote : mmData.extraVillainGroupNote;
      const extraVGRow = document.createElement("li");
      extraVGRow.className = "ios-row";

      const text = document.createElement("span");
      text.className = "row-text";
      const main = document.createElement("span");
      main.className = "row-text-main";
      main.textContent = state.extraVillainGroup ? state.extraVillainGroup.name : "No extra Villain Group available";
      const sub = document.createElement("span");
      sub.className = "row-text-sub";
      const vgSetInfo = state.extraVillainGroup ? poolRowSubText(CATEGORY_BY_KEY.villains, state.extraVillainGroup) + " · " : "";
      sub.textContent = vgSetInfo + "Extra Villain Group — " + (vgNote || "set aside, not part of the main Villain Groups");
      text.appendChild(main);
      text.appendChild(sub);

      const rerollBtn = document.createElement("button");
      rerollBtn.type = "button";
      rerollBtn.className = "round-btn";
      rerollBtn.textContent = "🔁";
      if (isVGNamed) {
        rerollBtn.title = "Fixed by this Scheme";
        rerollBtn.disabled = true;
      } else if (isVGFromDrained) {
        rerollBtn.title = "Follows the Drained Mastermind above — reroll that instead";
        rerollBtn.disabled = true;
      } else {
        rerollBtn.title = "Reroll the extra Villain Group";
        rerollBtn.disabled = !state.extraVillainGroup;
        rerollBtn.addEventListener("click", rerollExtraVillainGroup);
      }

      extraVGRow.appendChild(text);
      extraVGRow.appendChild(rerollBtn);
      list.appendChild(extraVGRow);
    }

    if (scheme && scheme.overrides && scheme.overrides.unveils) {
      const unveiled = state.unveiledScheme;
      const unveiledRow = document.createElement("li");
      unveiledRow.className = "ios-row";

      const text = document.createElement("span");
      text.className = "row-text";
      const main = document.createElement("span");
      main.className = "row-text-main";
      main.textContent = unveiled ? unveiled.name : "No Unveiled Scheme available";
      const sub = document.createElement("span");
      sub.className = "row-text-sub";
      sub.textContent = "Unveiled Scheme — rolled when this Scheme Transforms";
      text.appendChild(main);
      text.appendChild(sub);

      const rerollBtn = document.createElement("button");
      rerollBtn.type = "button";
      rerollBtn.className = "round-btn";
      rerollBtn.textContent = "🔁";
      rerollBtn.title = "Reroll the Unveiled Scheme";
      rerollBtn.disabled = !unveiled;
      rerollBtn.addEventListener("click", rerollUnveiledScheme);

      unveiledRow.appendChild(text);
      unveiledRow.appendChild(rerollBtn);
      list.appendChild(unveiledRow);
    }

    section.appendChild(list);

    if (scheme && scheme.twist) {
      const twistNote = document.createElement("div");
      twistNote.className = "scheme-note";
      twistNote.innerHTML = `<strong>On a Twist</strong><br>${scheme.twist.replace(/\n/g, "<br>")}`;
      section.appendChild(twistNote);
    }
    if (scheme && scheme.evilWins) {
      const evilNote = document.createElement("div");
      evilNote.className = "scheme-note scheme-note--evil";
      evilNote.innerHTML = `<strong>${scheme.winLabel || "Evil Wins"}</strong><br>${scheme.evilWins}`;
      section.appendChild(evilNote);
    }

    if (scheme && scheme.overrides && scheme.overrides.unveils && state.unveiledScheme) {
      const u = state.unveiledScheme;
      if (u.whenRevealed) {
        const whenNote = document.createElement("div");
        whenNote.className = "scheme-note";
        whenNote.innerHTML = `<strong>${u.name} — When Revealed</strong><br>${u.whenRevealed.replace(/\n/g, "<br>")}`;
        section.appendChild(whenNote);
      }
      if (u.twist) {
        const uTwistNote = document.createElement("div");
        uTwistNote.className = "scheme-note";
        uTwistNote.innerHTML = `<strong>${u.name} — On a Twist</strong><br>${u.twist.replace(/\n/g, "<br>")}`;
        section.appendChild(uTwistNote);
      }
      if (u.evilWins) {
        const uEvilNote = document.createElement("div");
        uEvilNote.className = "scheme-note scheme-note--evil";
        uEvilNote.innerHTML = `<strong>Evil Wins (${u.name})</strong><br>${u.evilWins}`;
        section.appendChild(uEvilNote);
      }
    }

    return section;
  }

  function renderHistoryCount() {
    el.historyCount.textContent = `${state.history.length} saved`;
  }

  function setupText() {
    const lines = ["MARVEL LEGENDARY — Game Setup", ""];
    if (state.options.players) lines.push(`Players: ${state.options.players}`, "");
    CATEGORIES.forEach((category) => {
      const items = state.result[category.key] || [];
      if (!items.length) return;
      lines.push(`${category.label}:`);
      items.forEach((item) => lines.push(`  - ${item.name} (${item.exp})`));
      if (category.key === "scheme" && items[0] && items[0].setupNote) {
        lines.push("  Setup note:");
        items[0].setupNote.split("\n").forEach((line) => lines.push(`    ${line}`));
      }
      lines.push("");
    });
    lines.push(`Bystanders: ${state.options.bystanders}`);
    lines.push(`Master Strikes: ${state.options.masterStrikes}`);
    lines.push(`Twists: ${state.options.twists}`);
    if (state.extraCard) lines.push(`Extra Hero: ${state.extraCard.name}`);
    if (state.extraVillainGroup) lines.push(`Extra Villain Group: ${state.extraVillainGroup.name}`);
    const extraGroupScheme = currentSchemeData();
    const extraGroupOverrides = (extraGroupScheme && extraGroupScheme.overrides) || {};
    Object.keys(EXTRA_GROUP_CONFIG).forEach((categoryKey) => {
      const config = EXTRA_GROUP_CONFIG[categoryKey];
      const group = state[config.stateKey];
      if (!group || !group.length) return;
      const label = extraGroupOverrides[config.labelKey] || `Extra ${CATEGORY_BY_KEY[categoryKey].label}`;
      lines.push(`${label}:`);
      group.forEach((c) => lines.push(`  - ${c.name} (${c.exp})`));
      if (extraGroupOverrides[config.noteKey]) lines.push(`  (${extraGroupOverrides[config.noteKey]})`);
    });
    if (state.weddingHeroes && state.weddingHeroes.some(Boolean)) {
      lines.push("Wedding Heroes:");
      state.weddingHeroes.forEach((c) => c && lines.push(`  - ${c.name} (${c.exp})`));
    }
    if (state.unveiledScheme) lines.push(`Unveiled Scheme: ${state.unveiledScheme.name}`);
    const scheme = currentSchemeData();
    if (scheme && scheme.twist) lines.push("", "On a Twist:", `  ${scheme.twist.split("\n").join("\n  ")}`);
    if (scheme && scheme.evilWins) lines.push("", `${(scheme.winLabel || "Evil Wins")}: ${scheme.evilWins}`);
    if (state.unveiledScheme) {
      const u = state.unveiledScheme;
      lines.push("", `${u.name} — When Revealed:`, `  ${(u.whenRevealed || "").split("\n").join("\n  ")}`);
      if (u.twist) lines.push("", `${u.name} — On a Twist:`, `  ${u.twist.split("\n").join("\n  ")}`);
      if (u.evilWins) lines.push("", `${u.name} — Evil Wins: ${u.evilWins}`);
    }
    return lines.join("\n").trim();
  }

  function render() {
    renderWarnings();
    renderResults();
    renderCardPool();
    renderHistoryCount();
  }

  // ---------- Sheet (modal) ----------

  let sheetState = null; // { mode: 'manage'|'choose'|'history', categoryKey, slotIndex, search }

  function openSheet(next) {
    sheetState = { search: "", ...next };
    el.sheetSearch.value = "";
    renderSheet();
    el.sheetOverlay.classList.remove("hidden");
  }

  function closeSheet() {
    sheetState = null;
    el.sheetOverlay.classList.add("hidden");
  }

  function openManageSheet(categoryKey) {
    openSheet({ mode: "manage", categoryKey });
  }

  function openChooseSheet(categoryKey, slotIndex) {
    openSheet({ mode: "choose", categoryKey, slotIndex });
  }

  function openHistorySheet() {
    openSheet({ mode: "history" });
  }

  function openExpansionsSheet() {
    openSheet({ mode: "expansions" });
  }

  function openTeamThemeSheet() {
    openSheet({ mode: "teamTheme" });
  }

  /** Shows the "Select All"/"Deselect All" bulk-action bar (see
   * index.html #sheet-bulk-actions) and dims out whichever button would
   * be a no-op against the sheet's current state — everything already
   * included disables Select All, everything already excluded disables
   * Deselect All — while keeping both visible at all times, unlike the
   * old single toggle-text sheetAction button it replaces for the
   * manage/expansions/teamTheme sheet modes (history's "Clear All"
   * still uses sheetAction — see below). */
  function showBulkActions(allSelected, allDeselected) {
    el.sheetBulkActions.classList.remove("hidden");
    el.sheetSelectAll.disabled = allSelected;
    el.sheetDeselectAll.disabled = allDeselected;
  }

  function renderSheet() {
    if (!sheetState) return;
    el.sheetList.innerHTML = "";
    el.sheetAction.classList.add("hidden");
    el.sheetBulkActions.classList.add("hidden");

    if (sheetState.mode === "manage") {
      const category = CATEGORY_BY_KEY[sheetState.categoryKey];
      el.sheetTitle.textContent = `Manage ${category.label}`;
      el.sheetSearchWrap.classList.remove("hidden");
      const pool = category.pool.filter((c) => state.expansions.has(c.exp));
      const excluded = state.exclusions[category.key];
      const allIncluded = pool.every((c) => !excluded.has(c.name));
      const allExcluded = pool.length > 0 && pool.every((c) => excluded.has(c.name));
      showBulkActions(allIncluded, allExcluded);

      const items = category.pool
        .filter((c) => state.expansions.has(c.exp))
        .filter((c) => c.name.toLowerCase().includes(sheetState.search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (!items.length) {
        el.sheetList.appendChild(emptyRow("No cards match."));
        return;
      }

      items.forEach((item) => el.sheetList.appendChild(manageRow(category, item)));
    } else if (sheetState.mode === "choose") {
      const category = CATEGORY_BY_KEY[sheetState.categoryKey];
      el.sheetTitle.textContent = `Choose ${category.label}`;
      el.sheetSearchWrap.classList.remove("hidden");

      const currentItem = (state.result[category.key] || [])[sheetState.slotIndex];
      const items = poolFor(category)
        .filter((c) => c.name.toLowerCase().includes(sheetState.search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (!items.length) {
        el.sheetList.appendChild(emptyRow("No cards available. Adjust expansions or exclusions."));
        return;
      }

      items.forEach((item) => el.sheetList.appendChild(chooseRow(category, item, currentItem)));
    } else if (sheetState.mode === "history") {
      el.sheetTitle.textContent = "Past Setups";
      el.sheetSearchWrap.classList.add("hidden");
      if (state.history.length) {
        el.sheetAction.classList.remove("hidden");
        el.sheetAction.classList.add("sheet-header-btn-accent");
        el.sheetAction.textContent = "Clear All";
      }

      if (!state.history.length) {
        el.sheetList.appendChild(emptyRow("No saved setups yet. Randomize a setup and it'll show up here."));
        return;
      }
      state.history.forEach((entry) => el.sheetList.appendChild(historyRow(entry)));
    } else if (sheetState.mode === "expansions") {
      el.sheetTitle.textContent = "Expansions";
      el.sheetSearchWrap.classList.add("hidden");
      showBulkActions(state.expansions.size === EXPANSIONS.length, state.expansions.size === 0);

      const sortedExpansions = [...EXPANSIONS].sort((a, b) => a.name.localeCompare(b.name));
      sortedExpansions.forEach((exp) => el.sheetList.appendChild(expansionRow(exp)));
    } else if (sheetState.mode === "teamTheme") {
      el.sheetTitle.textContent = "Hero Team Theme";
      el.sheetSearchWrap.classList.add("hidden");

      const teams = availableTeams();
      const hasUnaffiliated = hasUnaffiliatedHeroes();
      if (!teams.length && !hasUnaffiliated) {
        el.sheetList.appendChild(emptyRow("No Heroes in the current pool."));
        return;
      }

      const total = teams.length + (hasUnaffiliated ? 1 : 0);
      const excludedCount = teams.filter((t) => state.excludedTeams.has(t)).length + (hasUnaffiliated && state.excludeUnaffiliated ? 1 : 0);
      showBulkActions(excludedCount === 0, excludedCount === total);

      teams.forEach((team) => el.sheetList.appendChild(teamRow(team)));
      if (hasUnaffiliated) el.sheetList.appendChild(teamRow(UNAFFILIATED));
    }
  }

  function emptyRow(text) {
    const li = document.createElement("li");
    li.className = "sheet-empty";
    li.textContent = text;
    return li;
  }

  function manageRow(category, item) {
    const li = document.createElement("li");
    li.className = "ios-row";

    const text = document.createElement("span");
    text.className = "row-text";
    const main = document.createElement("span");
    main.className = "row-text-main";
    main.appendChild(nameWithTeamIcon(item));
    const sub = document.createElement("span");
    sub.className = "row-text-sub";
    sub.textContent = poolRowSubText(category, item);
    text.appendChild(main);
    text.appendChild(sub);

    const switchWrap = document.createElement("span");
    switchWrap.className = "ios-switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("aria-label", `Include ${item.name}`);
    input.checked = !state.exclusions[category.key].has(item.name);
    input.addEventListener("change", () => {
      if (input.checked) state.exclusions[category.key].delete(item.name);
      else state.exclusions[category.key].add(item.name);
      syncRequiredCards();
      saveState();
      renderWarnings();
      renderCardPool();
      renderResults();
      renderSheet();
    });
    const track = document.createElement("span");
    track.className = "track";
    const thumb = document.createElement("span");
    thumb.className = "thumb";
    switchWrap.appendChild(input);
    switchWrap.appendChild(track);
    switchWrap.appendChild(thumb);

    li.appendChild(text);
    li.appendChild(switchWrap);
    return li;
  }

  function chooseRow(category, item, currentItem) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ios-row sheet-row";

    const text = document.createElement("span");
    text.className = "row-text";
    const main = document.createElement("span");
    main.className = "row-text-main";
    main.appendChild(nameWithTeamIcon(item));
    const sub = document.createElement("span");
    sub.className = "row-text-sub";
    sub.textContent = poolRowSubText(category, item);
    text.appendChild(main);
    text.appendChild(sub);

    btn.appendChild(text);

    if (currentItem && currentItem.name === item.name && currentItem.exp === item.exp) {
      const check = document.createElement("span");
      check.textContent = "✓";
      check.style.color = "var(--blue)";
      check.style.fontWeight = "700";
      btn.appendChild(check);
    }

    btn.addEventListener("click", () => {
      chooseCard(sheetState.categoryKey, sheetState.slotIndex, item);
      closeSheet();
    });

    li.appendChild(btn);
    return li;
  }

  function historyRow(entry) {
    const li = document.createElement("li");
    li.className = "ios-row";

    const mastermind = (entry.result.mastermind || [])[0];
    const heroCount = (entry.result.heroes || []).length;

    const text = document.createElement("div");
    text.className = "result-row-text";
    const main = document.createElement("span");
    main.className = "row-text-main";
    main.textContent = mastermind ? mastermind.name : "Setup";
    const sub = document.createElement("span");
    sub.className = "row-text-sub";
    const outcomeLabel = entry.outcome === "win" ? " · Heroes Won" : entry.outcome === "loss" ? " · Evil Won" : "";
    sub.textContent = `${formatTimestamp(entry.timestamp)} · ${heroCount} heroes${entry.players ? ` · ${entry.players}p` : ""}${outcomeLabel}`;
    text.appendChild(main);
    text.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "result-row-actions";

    const winBtn = document.createElement("button");
    winBtn.type = "button";
    winBtn.className = "round-btn";
    if (entry.outcome === "win") winBtn.classList.add("active-outcome", "outcome-win");
    winBtn.textContent = "🏆";
    winBtn.title = entry.outcome === "win" ? "Logged as a Heroes win — tap to remove from Past Setups" : "Log as a Heroes win";
    winBtn.addEventListener("click", () => logHistoryOutcome(entry.id, "win"));

    const lossBtn = document.createElement("button");
    lossBtn.type = "button";
    lossBtn.className = "round-btn";
    if (entry.outcome === "loss") lossBtn.classList.add("active-outcome", "outcome-loss");
    lossBtn.textContent = "💀";
    lossBtn.title = entry.outcome === "loss" ? "Logged as an Evil win — tap to remove from Past Setups" : "Log as an Evil win";
    lossBtn.addEventListener("click", () => logHistoryOutcome(entry.id, "loss"));

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "round-btn";
    restoreBtn.textContent = "↩️";
    restoreBtn.title = "Restore this setup";
    restoreBtn.addEventListener("click", () => {
      restoreHistoryEntry(entry);
      closeSheet();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "round-btn";
    deleteBtn.textContent = "🗑";
    deleteBtn.title = "Delete this saved setup";
    deleteBtn.addEventListener("click", () => {
      deleteHistoryEntry(entry.id);
      renderSheet();
      renderHistoryCount();
      renderOutcomeStatus();
    });

    actions.appendChild(winBtn);
    actions.appendChild(lossBtn);
    actions.appendChild(restoreBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(text);
    li.appendChild(actions);
    return li;
  }

  /** "Select All" — include everything for the sheet's current mode.
   * Shared by the bulk-actions bar's left button (see
   * showBulkActions/bindSheet) across manage/expansions/teamTheme; a
   * no-op (button disabled) for any other mode. */
  function sheetSelectAll() {
    if (!sheetState) return;
    if (sheetState.mode === "manage") {
      const category = CATEGORY_BY_KEY[sheetState.categoryKey];
      state.exclusions[category.key].clear();
      syncRequiredCards();
      saveState();
      renderWarnings();
      renderCardPool();
      renderResults();
      renderSheet();
    } else if (sheetState.mode === "expansions") {
      state.expansions = new Set(EXPANSIONS.map((e) => e.id));
      syncRequiredCards();
      saveState();
      renderWarnings();
      renderExpansionsCount();
      renderCardPool();
      renderTeamThemeCount();
      renderResults();
      renderSheet();
    } else if (sheetState.mode === "teamTheme") {
      state.excludedTeams = new Set();
      state.excludeUnaffiliated = false;
      saveState();
      renderWarnings();
      renderCardPool();
      renderTeamThemeCount();
      renderResults();
      renderSheet();
    }
  }

  /** "Deselect All" — exclude everything for the sheet's current mode.
   * Mirror of sheetSelectAll above. */
  function sheetDeselectAll() {
    if (!sheetState) return;
    if (sheetState.mode === "manage") {
      const category = CATEGORY_BY_KEY[sheetState.categoryKey];
      category.pool.filter((c) => state.expansions.has(c.exp)).forEach((c) => state.exclusions[category.key].add(c.name));
      syncRequiredCards();
      saveState();
      renderWarnings();
      renderCardPool();
      renderResults();
      renderSheet();
    } else if (sheetState.mode === "expansions") {
      state.expansions = new Set();
      syncRequiredCards();
      saveState();
      renderWarnings();
      renderExpansionsCount();
      renderCardPool();
      renderTeamThemeCount();
      renderResults();
      renderSheet();
    } else if (sheetState.mode === "teamTheme") {
      state.excludedTeams = new Set(availableTeams());
      state.excludeUnaffiliated = hasUnaffiliatedHeroes();
      saveState();
      renderWarnings();
      renderCardPool();
      renderTeamThemeCount();
      renderResults();
      renderSheet();
    }
  }

  function bindSheet() {
    el.sheetBackdrop.addEventListener("click", closeSheet);
    el.sheetCancel.addEventListener("click", closeSheet);
    el.sheetSearch.addEventListener("input", () => {
      if (!sheetState) return;
      sheetState.search = el.sheetSearch.value;
      renderSheet();
    });
    el.sheetAction.addEventListener("click", () => {
      // Only "history" mode still uses the single sheetAction button
      // (its "Clear All" deletes records rather than toggling a set of
      // switches) — manage/expansions/teamTheme use the always-visible
      // Select All/Deselect All bar instead, see sheetSelectAll/
      // sheetDeselectAll below.
      if (!sheetState || sheetState.mode !== "history") return;
      state.history.forEach((entry) => {
        if (entry.outcome) applyEntryOutcome(entry, entry.outcome, -1);
      });
      state.history = [];
      state.currentHistoryId = null;
      saveState();
      renderSheet();
      renderHistoryCount();
      renderOutcomeStatus();
    });
    el.sheetSelectAll.addEventListener("click", sheetSelectAll);
    el.sheetDeselectAll.addEventListener("click", sheetDeselectAll);
  }

  function init() {
    renderExpansionsCount();
    renderCardPool();
    renderTeamThemeCount();
    renderPlayersSegmented();
    bindSheet();
    render();

    el.randomizeAll.addEventListener("click", randomizeAll);
    el.rerollAllBtn.addEventListener("click", rerollAllUnlocked);

    el.openExpansions.addEventListener("click", openExpansionsSheet);
    el.openTeamTheme.addEventListener("click", openTeamThemeSheet);

    el.playersSegmented.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      applyPlayerCount(Number(btn.dataset.value));
    });

    el.openHistory.addEventListener("click", openHistorySheet);

    el.copyBtn.addEventListener("click", async () => {
      const text = setupText();
      const original = el.copyBtn.textContent;
      try {
        await navigator.clipboard.writeText(text);
        el.copyBtn.textContent = "Copied!";
      } catch (e) {
        el.copyBtn.textContent = "Copy failed";
      }
      setTimeout(() => (el.copyBtn.textContent = original), 1500);
    });

    el.logWinBtn.addEventListener("click", () => logCurrentOutcome("win"));
    el.logLossBtn.addEventListener("click", () => logCurrentOutcome("loss"));

    el.excludeBtn.addEventListener("click", () => {
      excludeCurrentSetup();
      const original = el.excludeBtn.textContent;
      el.excludeBtn.textContent = "Excluded!";
      setTimeout(() => (el.excludeBtn.textContent = original), 1500);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
