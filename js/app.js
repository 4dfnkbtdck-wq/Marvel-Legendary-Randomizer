(function () {
  "use strict";

  const STORAGE_KEY = "legendary-randomizer/v2";
  const HISTORY_LIMIT = 20;

  const CATEGORIES = [
    { key: "mastermind", label: "Mastermind", pool: MASTERMINDS, countKey: null, fixedCount: 1 },
    { key: "scheme", label: "Scheme", pool: SCHEMES, countKey: null, fixedCount: 1 },
    { key: "villains", label: "Villain Groups", pool: VILLAIN_GROUPS, countKey: "villainCount", fixedCount: null, min: 1, max: 6 },
    { key: "henchmen", label: "Henchmen", pool: HENCHMEN, countKey: "henchmenCount", fixedCount: null, min: 1, max: 3 },
    { key: "heroes", label: "Heroes", pool: HEROES, countKey: "heroCount", fixedCount: null, min: 3, max: 8 },
  ];

  const CATEGORY_BY_KEY = {};
  CATEGORIES.forEach((c) => (CATEGORY_BY_KEY[c.key] = c));

  let state = loadState();

  function defaultState() {
    return {
      expansions: new Set(["core"]),
      options: { heroCount: 5, villainCount: 3, henchmenCount: 1, bystanders: 8, masterStrikes: 5, twists: 5, players: 3 },
      exclusions: { mastermind: new Set(), scheme: new Set(), villains: new Set(), henchmen: new Set(), heroes: new Set() },
      teamFilter: new Set(),
      history: [],
      result: {},
      locks: {},
      keywordChoices: {},
      extraCard: null,
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
      return {
        expansions: new Set(parsed.expansions && parsed.expansions.length ? parsed.expansions : defaults.expansions),
        options: { ...defaults.options, ...(parsed.options || {}) },
        exclusions,
        teamFilter: new Set(parsed.teamFilter || []),
        history: Array.isArray(parsed.history) ? parsed.history : [],
        result: {},
        locks: {},
        keywordChoices: {},
        extraCard: null,
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
          teamFilter: Array.from(state.teamFilter),
          history: state.history,
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

  function poolFor(category) {
    const excluded = state.exclusions[category.key];
    let pool = category.pool.filter((card) => state.expansions.has(card.exp) && !excluded.has(card.name));
    if (category.key === "heroes" && state.teamFilter.size) {
      pool = pool.filter((card) => card.team && state.teamFilter.has(card.team));
    }
    return pool;
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
    const fresh = needed > 0 ? pickRandom(pool, needed, lockedItems) : [];
    const combined = lockedItems.concat(fresh);

    state.result[category.key] = combined;
    if (!keepLocked) {
      state.locks[category.key] = combined.map(() => false);
      if (signatureFlags[category.key]) signatureFlags[category.key] = [];
    }
  }

  function randomizeAll() {
    // Mastermind and Scheme first, so the Scheme's numeric overrides (e.g.
    // an extra Henchman group) are in effect before Villains/Henchmen/
    // Heroes get rolled against those counts.
    randomizeCategory(CATEGORY_BY_KEY.mastermind, { keepLocked: true });
    randomizeCategory(CATEGORY_BY_KEY.scheme, { keepLocked: true });
    syncSchemeNumbers();
    randomizeCategory(CATEGORY_BY_KEY.villains, { keepLocked: true });
    randomizeCategory(CATEGORY_BY_KEY.henchmen, { keepLocked: true });
    randomizeCategory(CATEGORY_BY_KEY.heroes, { keepLocked: true });
    syncRequiredCards();
    saveToHistory();
    render();
  }

  function rerollOne(categoryKey, index) {
    const category = CATEGORY_BY_KEY[categoryKey];
    const pool = poolFor(category);
    const existing = state.result[categoryKey] || [];
    const [picked] = pickRandom(pool, 1, existing);
    if (picked) {
      existing[index] = picked;
      state.result[categoryKey] = existing;
    }
    if (signatureFlags[categoryKey]) signatureFlags[categoryKey][index] = false;
    if (categoryKey === "mastermind" || categoryKey === "scheme") {
      if (categoryKey === "scheme") {
        syncSchemeNumbers();
        reconcileCountedCategories();
      }
      syncRequiredCards();
    }
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
      if (categoryKey === "scheme") {
        syncSchemeNumbers();
        reconcileCountedCategories();
      }
      syncRequiredCards();
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
    if (categoryKey === "villains" && overrides.requiredVillainGroupKeyword) {
      const name = resolveKeywordRequirement("villains", overrides.requiredVillainGroupKeyword);
      if (name) names.push(name);
    }
    if (categoryKey === "henchmen" && overrides.requiredHenchmen) names.push(overrides.requiredHenchmen);
    if (categoryKey === "heroes" && overrides.requiredHero) names.push(overrides.requiredHero);
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
        const [fresh] = pickRandom(pool, 1, items);
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
      lastMastermindSignature = mmSignature;
    }

    clearStaleRequiredCards();
    ["villains", "henchmen", "heroes"].forEach((categoryKey) => {
      requiredCardNames(categoryKey).forEach((name) => forceIncludeSignature(categoryKey, name));
    });
    syncExtraCard();
  }

  /** Some Schemes (e.g. What If...?'s Marvel Zombies, "add 8 random cards
   * from an extra Hero to the Villain Deck") call for a Hero beyond your
   * normal Hero Deck lineup, chosen at random and never duplicating one
   * of the main Heroes result. Kept in state.extraCard (not one of the
   * counted result categories, so it doesn't affect the Heroes stepper)
   * and left alone once picked, only clearing/re-picking when the Scheme
   * itself changes (see the schemeSignature check in syncSchemeNumbers)
   * or the current pick is no longer valid. */
  function syncExtraCard() {
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    if (!overrides.extraHero) {
      state.extraCard = null;
      return;
    }
    const pool = poolFor(CATEGORY_BY_KEY.heroes);
    const mainNames = new Set((state.result.heroes || []).map((h) => h.name));
    const candidates = pool.filter((c) => !mainNames.has(c.name));
    if (state.extraCard && candidates.some((c) => c.name === state.extraCard.name)) return;
    const [picked] = pickRandom(candidates, 1, []);
    state.extraCard = picked || null;
  }

  function rerollExtraCard() {
    const pool = poolFor(CATEGORY_BY_KEY.heroes);
    const mainNames = new Set((state.result.heroes || []).map((h) => h.name));
    const candidates = pool.filter((c) => !mainNames.has(c.name));
    const [picked] = pickRandom(candidates, 1, state.extraCard ? [state.extraCard] : []);
    if (picked) state.extraCard = picked;
    saveState();
    renderResults();
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
   * Villain-Group. Villain Group count is untouched unless a Scheme
   * overrides it — most don't. Only called on a Scheme or Player-count
   * change — never fights a manual stepper edit.
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

    let villainCount = baseVillainCount;
    if (overrides.villainCountByPlayers && players && overrides.villainCountByPlayers[players] != null) {
      villainCount = overrides.villainCountByPlayers[players];
    } else if (overrides.villainCount != null) {
      villainCount = overrides.villainCount;
    }
    villainCount += overrides.villainCountDelta || 0;
    villainCount = clampOption(villainCount, 1, 6);

    let twists;
    if (overrides.twistsPerVillainGroup != null) {
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
    const henchmenCount = baseHenchmenCount + (overrides.henchmenDelta || 0);

    state.options.heroCount = clampOption(heroCount, 3, 8);
    state.options.villainCount = villainCount;
    state.options.twists = clampOption(twists, 0, 12);
    state.options.bystanders = clampOption(bystanders, 1, 20);
    state.options.henchmenCount = clampOption(henchmenCount, 1, 3);

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
      const fresh = pickRandom(poolFor(category), n - items.length, items);
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
    return null;
  }

  /** Sub-line text for a card row: expansion name, plus a Team tag for
   * Heroes, plus why a Villain Group / Henchman is required, if it is. */
  function subText(category, item) {
    const expName = (EXPANSIONS.find((e) => e.id === item.exp) || {}).name || item.exp;
    const parts = [expName];
    if (category.key === "heroes" && item.team) parts.push(item.team);
    const reason = requiredReason(category.key, item);
    if (reason) parts.push(reason);
    return parts.join(" · ");
  }

  function poolWarnings() {
    return CATEGORIES.map((category) => {
      const pool = poolFor(category);
      const n = countFor(category);
      if (pool.length < n) {
        const teamNote = category.key === "heroes" && state.teamFilter.size ? "/team filter" : "";
        return `${category.label}: need ${n}, only ${pool.length} available with current expansions/exclusions${teamNote}.`;
      }
      return null;
    }).filter(Boolean);
  }

  // ---------- History ----------

  function saveToHistory() {
    const snapshot = {};
    CATEGORIES.forEach((c) => (snapshot[c.key] = (state.result[c.key] || []).map((item) => ({ ...item }))));
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      players: state.options.players,
      result: snapshot,
    };
    state.history.unshift(entry);
    if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT;
    saveState();
  }

  function restoreHistoryEntry(entry) {
    CATEGORIES.forEach((c) => {
      state.result[c.key] = (entry.result[c.key] || []).map((item) => ({ ...item }));
      state.locks[c.key] = state.result[c.key].map(() => false);
    });
    render();
  }

  function deleteHistoryEntry(id) {
    state.history = state.history.filter((h) => h.id !== id);
    saveState();
  }

  function formatTimestamp(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  // ---------- Rendering ----------

  const el = {
    expansionList: document.getElementById("expansion-list"),
    toggleAllExpansions: document.getElementById("toggle-all-expansions"),
    cardPoolList: document.getElementById("card-pool-list"),
    teamThemeSection: document.getElementById("team-theme-section"),
    teamChips: document.getElementById("team-chips"),
    clearTeamFilter: document.getElementById("clear-team-filter"),
    playersSegmented: document.getElementById("players-segmented"),
    randomizeAll: document.getElementById("randomize-all"),
    warnings: document.getElementById("warnings"),
    results: document.getElementById("results"),
    copyGroup: document.getElementById("copy-group"),
    copyBtn: document.getElementById("copy-setup"),
    openHistory: document.getElementById("open-history"),
    historyCount: document.getElementById("history-count"),
    sheetOverlay: document.getElementById("sheet-overlay"),
    sheetBackdrop: document.getElementById("sheet-backdrop"),
    sheetCancel: document.getElementById("sheet-cancel"),
    sheetAction: document.getElementById("sheet-action"),
    sheetTitle: document.getElementById("sheet-title"),
    sheetSearchWrap: document.getElementById("sheet-search-wrap"),
    sheetSearch: document.getElementById("sheet-search"),
    sheetList: document.getElementById("sheet-list"),
  };

  function renderExpansions() {
    el.expansionList.innerHTML = "";
    EXPANSIONS.forEach((exp) => {
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
        pruneTeamFilter();
        syncRequiredCards();
        saveState();
        renderWarnings();
        renderToggleAllLabel();
        renderCardPool();
        renderTeamChips();
        renderResults();
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
      el.expansionList.appendChild(li);
    });
    renderToggleAllLabel();
  }

  function renderToggleAllLabel() {
    const allSelected = state.expansions.size === EXPANSIONS.length;
    el.toggleAllExpansions.textContent = allSelected ? "Deselect All" : "Select All";
  }

  /** Drop any selected team that's no longer available now that expansions
   * changed, so the hero pool doesn't silently zero out against a team
   * filter the user can no longer see or clear from the chip row. */
  function pruneTeamFilter() {
    const avail = new Set(availableTeams());
    state.teamFilter.forEach((t) => {
      if (!avail.has(t)) state.teamFilter.delete(t);
    });
  }

  function renderTeamChips() {
    const teams = availableTeams();
    el.teamThemeSection.classList.toggle("hidden", teams.length === 0);
    if (!teams.length) return;

    el.teamChips.innerHTML = "";
    teams.forEach((team) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "team-chip";
      if (state.teamFilter.has(team)) chip.classList.add("active");
      chip.textContent = team;
      chip.addEventListener("click", () => {
        if (state.teamFilter.has(team)) state.teamFilter.delete(team);
        else state.teamFilter.add(team);
        saveState();
        renderTeamChips();
        renderWarnings();
        renderCardPool();
      });
      el.teamChips.appendChild(chip);
    });
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
    syncSchemeNumbers(); // sets heroCount/villainCount/henchmenCount/bystanders/twists: this player count's base, plus the active Scheme's overrides on top
    reconcileCountedCategories();
    syncRequiredCards();
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
    mainSpan.textContent = item.name;
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

    const rerollBtn = document.createElement("button");
    rerollBtn.type = "button";
    rerollBtn.className = "round-btn";
    rerollBtn.textContent = "🔁";
    rerollBtn.title = "Reroll just this one";
    rerollBtn.disabled = locked;
    rerollBtn.addEventListener("click", () => rerollOne(category.key, index));

    actions.appendChild(chooseBtn);
    actions.appendChild(lockBtn);
    actions.appendChild(rerollBtn);

    li.appendChild(text);
    li.appendChild(actions);
    return li;
  }

  function renderResults() {
    el.results.innerHTML = "";
    const hasAnyResult = CATEGORIES.some((c) => (state.result[c.key] || []).length);

    if (!hasAnyResult) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Pick your expansions above, then tap Randomize Setup to build a game.";
      el.results.appendChild(empty);
      el.copyGroup.classList.add("hidden");
      return;
    }

    el.copyGroup.classList.remove("hidden");

    CATEGORIES.forEach((category) => {
      const items = state.result[category.key] || [];
      if (!items.length) return;

      const section = document.createElement("section");
      section.className = "ios-group";

      const header = document.createElement("div");
      header.className = "group-header";
      const span = document.createElement("span");
      span.textContent = category.label;
      const rerollSection = document.createElement("button");
      rerollSection.type = "button";
      rerollSection.className = "header-action";
      rerollSection.textContent = "Reroll All";
      rerollSection.addEventListener("click", () => {
        randomizeCategory(category, { keepLocked: true });
        if (category.key === "scheme") {
          syncSchemeNumbers();
          reconcileCountedCategories();
        }
        syncRequiredCards();
        render();
      });
      header.appendChild(span);
      header.appendChild(rerollSection);
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
    });
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
    list.appendChild(countStepperRow("Bystanders", "bystanders", 1, 20));
    list.appendChild(countStepperRow("Master Strikes", "masterStrikes", 0, 10));
    list.appendChild(countStepperRow("Twists", "twists", 0, 12));

    if (scheme && scheme.overrides && scheme.overrides.extraHero && state.extraCard) {
      const extraRow = document.createElement("li");
      extraRow.className = "ios-row";

      const text = document.createElement("span");
      text.className = "row-text";
      const main = document.createElement("span");
      main.className = "row-text-main";
      main.textContent = state.extraCard.name;
      const sub = document.createElement("span");
      sub.className = "row-text-sub";
      sub.textContent = "Extra Hero — 8 random cards go in the Villain Deck";
      text.appendChild(main);
      text.appendChild(sub);

      const rerollBtn = document.createElement("button");
      rerollBtn.type = "button";
      rerollBtn.className = "round-btn";
      rerollBtn.textContent = "🔁";
      rerollBtn.title = "Reroll the extra Hero";
      rerollBtn.addEventListener("click", rerollExtraCard);

      extraRow.appendChild(text);
      extraRow.appendChild(rerollBtn);
      list.appendChild(extraRow);
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
    const scheme = currentSchemeData();
    if (scheme && scheme.twist) lines.push("", "On a Twist:", `  ${scheme.twist.split("\n").join("\n  ")}`);
    if (scheme && scheme.evilWins) lines.push("", `${(scheme.winLabel || "Evil Wins")}: ${scheme.evilWins}`);
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

  function renderSheet() {
    if (!sheetState) return;
    el.sheetList.innerHTML = "";
    el.sheetAction.classList.add("hidden");

    if (sheetState.mode === "manage") {
      const category = CATEGORY_BY_KEY[sheetState.categoryKey];
      el.sheetTitle.textContent = `Manage ${category.label}`;
      el.sheetSearchWrap.classList.remove("hidden");
      el.sheetAction.classList.remove("hidden");
      el.sheetAction.classList.remove("sheet-header-btn-accent");
      const excluded = state.exclusions[category.key];
      const allExcluded = category.pool.filter((c) => state.expansions.has(c.exp)).every((c) => excluded.has(c.name));
      el.sheetAction.textContent = allExcluded ? "Include All" : "Exclude All";

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
    if (category.key === "heroes" && item.team) {
      const main = document.createElement("span");
      main.className = "row-text-main";
      main.textContent = item.name;
      const sub = document.createElement("span");
      sub.className = "row-text-sub";
      sub.textContent = item.team;
      text.appendChild(main);
      text.appendChild(sub);
    } else {
      text.textContent = item.name;
    }

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
    if (category.key === "heroes" && item.team) {
      const main = document.createElement("span");
      main.className = "row-text-main";
      main.textContent = item.name;
      const sub = document.createElement("span");
      sub.className = "row-text-sub";
      sub.textContent = item.team;
      text.appendChild(main);
      text.appendChild(sub);
    } else {
      text.textContent = item.name;
    }

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
    sub.textContent = `${formatTimestamp(entry.timestamp)} · ${heroCount} heroes${entry.players ? ` · ${entry.players}p` : ""}`;
    text.appendChild(main);
    text.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "result-row-actions";

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
    });

    actions.appendChild(restoreBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(text);
    li.appendChild(actions);
    return li;
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
      if (!sheetState) return;
      if (sheetState.mode === "manage") {
        const category = CATEGORY_BY_KEY[sheetState.categoryKey];
        const pool = category.pool.filter((c) => state.expansions.has(c.exp));
        const allExcluded = pool.every((c) => state.exclusions[category.key].has(c.name));
        if (allExcluded) {
          state.exclusions[category.key].clear();
        } else {
          pool.forEach((c) => state.exclusions[category.key].add(c.name));
        }
        syncRequiredCards();
        saveState();
        renderWarnings();
        renderCardPool();
        renderResults();
        renderSheet();
      } else if (sheetState.mode === "history") {
        state.history = [];
        saveState();
        renderSheet();
        renderHistoryCount();
      }
    });
  }

  function init() {
    renderExpansions();
    renderCardPool();
    renderTeamChips();
    renderPlayersSegmented();
    bindSheet();
    render();

    el.randomizeAll.addEventListener("click", randomizeAll);

    el.toggleAllExpansions.addEventListener("click", () => {
      const allSelected = state.expansions.size === EXPANSIONS.length;
      state.expansions = allSelected ? new Set() : new Set(EXPANSIONS.map((e) => e.id));
      pruneTeamFilter();
      syncRequiredCards();
      saveState();
      renderExpansions();
      renderWarnings();
      renderCardPool();
      renderTeamChips();
      renderResults();
    });

    el.clearTeamFilter.addEventListener("click", () => {
      state.teamFilter.clear();
      saveState();
      renderTeamChips();
      renderWarnings();
      renderCardPool();
    });

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
        el.copyBtn.textContent = "✅ Copied!";
      } catch (e) {
        el.copyBtn.textContent = "Copy failed";
      }
      setTimeout(() => (el.copyBtn.textContent = original), 1500);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
