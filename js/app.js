(function () {
  "use strict";

  const STORAGE_KEY = "legendary-randomizer/v2";
  const HISTORY_LIMIT = 20;

  const EXPANSION_COLORS = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#5856D6", "#AF52DE"];

  const CATEGORIES = [
    { key: "mastermind", label: "Mastermind", icon: "👑", color: "#AF52DE", pool: MASTERMINDS, countKey: null, fixedCount: 1 },
    { key: "scheme", label: "Scheme", icon: "📜", color: "#FFCC00", pool: SCHEMES, countKey: null, fixedCount: 1 },
    { key: "villains", label: "Villain Groups", icon: "🎭", color: "#FF3B30", pool: VILLAIN_GROUPS, countKey: "villainCount", fixedCount: null },
    { key: "henchmen", label: "Henchmen", icon: "👊", color: "#FF9500", pool: HENCHMEN, countKey: "henchmenCount", fixedCount: null },
    { key: "heroes", label: "Heroes", icon: "⭐️", color: "#007AFF", pool: HEROES, countKey: "heroCount", fixedCount: null },
  ];

  // Original glyphs themed to each team (not the trademarked team logos) —
  // same colored-square treatment as every other icon in the app. Falls
  // back to the generic Heroes star for an unrecognized or missing team.
  const TEAM_ICONS = {
    "X-Men": { icon: "X", color: "#1c1c1e" },
    Avengers: { icon: "A", color: "#ed1d24" },
    "Spider-Friends": { icon: "🕷️", color: "#1b2a6b" },
    "S.H.I.E.L.D.": { icon: "🛡️", color: "#2c2c2e" },
  };

  function heroIconMeta(category, item) {
    if (category.key === "heroes" && item.team && TEAM_ICONS[item.team]) return TEAM_ICONS[item.team];
    return { icon: category.icon, color: category.color };
  }

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
      if (categoryKey === "scheme") syncSchemeNumbers();
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
      if (categoryKey === "scheme") syncSchemeNumbers();
      syncRequiredCards();
    }
    render();
  }

  // ---------- Mastermind "always leads" / Scheme requirements ----------

  // Runtime-only bookkeeping (not persisted): which result slots were filled
  // by forceIncludeSignature (a required card) rather than chosen by the
  // player, per category.
  const signatureFlags = { villains: [], henchmen: [] };

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

  /** Every card name that MUST be in play for this category right now,
   * from the current Mastermind's "always leads" and/or the current
   * Scheme's required Villain Group. */
  function requiredCardNames(categoryKey) {
    const names = [];
    const mmData = currentMastermindData();
    if (mmData && mmData.leadsCategory === categoryKey && mmData.leadsName) names.push(mmData.leadsName);
    const scheme = currentSchemeData();
    const requiredGroup = scheme && scheme.overrides && scheme.overrides.requiredVillainGroup;
    if (categoryKey === "villains" && requiredGroup) names.push(requiredGroup);
    return names;
  }

  /** Release any slot a previously-required card claimed, if it's no longer
   * required (Mastermind or Scheme changed) or was excluded/expansion'd out
   * from under it — replacing it with a fresh random pick so a stale forced
   * card doesn't permanently squat a slot and starve room for whatever's
   * required now. */
  function clearStaleRequiredCards() {
    ["villains", "henchmen"].forEach((categoryKey) => {
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
   * otherwise fill the first unlocked slot (or an empty one). Never evicts
   * a slot the player locked themselves, and does nothing if that card is
   * excluded or its expansion isn't on. */
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
    if (targetIndex === -1) return;

    items[targetIndex] = card;
    locks[targetIndex] = true;
    flags[targetIndex] = true;
    state.result[categoryKey] = items;
    state.locks[categoryKey] = locks;
  }

  /** Reconciles Villain Groups / Henchmen against whatever the current
   * Mastermind and Scheme require. Safe to call any time either changes. */
  function syncRequiredCards() {
    clearStaleRequiredCards();
    ["villains", "henchmen"].forEach((categoryKey) => {
      requiredCardNames(categoryKey).forEach((name) => forceIncludeSignature(categoryKey, name));
    });
  }

  function clampOption(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** Recomputes Heroes / Twists / Bystanders / Henchmen from the current
   * Player count (falling back to the Core Set solo/no-preset defaults)
   * plus whatever the current Scheme's `overrides` layer on top — e.g.
   * Negative Zone Prison Breakout's extra Henchman group, or Secret
   * Invasion's required 6 Heroes. Never touches Villain Group count,
   * since no Core Set Scheme overrides it. Only called on a Scheme or
   * Player-count change — never fights a manual stepper edit. */
  function syncSchemeNumbers() {
    const scheme = currentSchemeData();
    const overrides = (scheme && scheme.overrides) || {};
    const players = state.options.players;
    const preset = players ? PLAYER_COUNT_TABLE[players] : null;

    const baseHeroCount = preset ? preset.heroCount : 5;
    const baseHenchmenCount = preset ? preset.henchmenCount : 1;
    const baseBystanders = preset ? preset.bystanders : 8;

    let heroCount = baseHeroCount;
    if (overrides.heroCountByPlayers && players && overrides.heroCountByPlayers[players] != null) {
      heroCount = overrides.heroCountByPlayers[players];
    } else if (overrides.heroCount != null) {
      heroCount = overrides.heroCount;
    }

    let twists = 5;
    if (overrides.twistsByPlayers && players && overrides.twistsByPlayers[players] != null) {
      twists = overrides.twistsByPlayers[players];
    } else if (overrides.twists != null) {
      twists = overrides.twists;
    }

    const bystanders = overrides.bystanders != null ? overrides.bystanders : baseBystanders;
    const henchmenCount = baseHenchmenCount + (overrides.henchmenDelta || 0);

    state.options.heroCount = clampOption(heroCount, 3, 8);
    state.options.twists = clampOption(twists, 0, 12);
    state.options.bystanders = clampOption(bystanders, 1, 20);
    state.options.henchmenCount = clampOption(henchmenCount, 1, 3);

    renderSteppers();
    renderHenchmenNote();
    saveState();
  }

  function requiredReason(categoryKey, item) {
    const mmData = currentMastermindData();
    if (mmData && mmData.leadsCategory === categoryKey && mmData.leadsName === item.name) {
      return `always led by ${mmData.name}`;
    }
    const scheme = currentSchemeData();
    const requiredGroup = scheme && scheme.overrides && scheme.overrides.requiredVillainGroup;
    if (categoryKey === "villains" && requiredGroup === item.name) {
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
    henchmenNote: document.getElementById("henchmen-note"),
    randomizeAll: document.getElementById("randomize-all"),
    warnings: document.getElementById("warnings"),
    results: document.getElementById("results"),
    copyGroup: document.getElementById("copy-group"),
    copyBtn: document.getElementById("copy-setup"),
    steppers: Array.from(document.querySelectorAll(".stepper")),
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
    EXPANSIONS.forEach((exp, i) => {
      const id = `exp-${exp.id}`;
      const li = document.createElement("li");
      li.className = "ios-row";

      const icon = document.createElement("span");
      icon.className = "row-icon";
      icon.style.background = EXPANSION_COLORS[i % EXPANSION_COLORS.length];
      icon.textContent = "🃏";

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

      li.appendChild(icon);
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

      const icon = document.createElement("span");
      icon.className = "row-icon";
      icon.style.background = category.color;
      icon.textContent = category.icon;

      const text = document.createElement("span");
      text.className = "row-text";
      text.textContent = category.label;

      const trailing = document.createElement("span");
      trailing.className = "row-trailing";
      trailing.textContent = total === 0 ? "none in pool" : `${available} of ${total}`;

      const chevron = document.createElement("span");
      chevron.className = "chevron";
      chevron.textContent = "›";

      btn.appendChild(icon);
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
    state.options.villainCount = preset.villainCount;
    syncSchemeNumbers(); // sets heroCount/henchmenCount/bystanders/twists: this player count's base, plus the active Scheme's overrides on top
    renderPlayersSegmented();
    renderWarnings();
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

  function renderHenchmenNote() {
    const preset = state.options.players ? PLAYER_COUNT_TABLE[state.options.players] : null;
    if (preset && preset.henchmenNote) {
      el.henchmenNote.textContent = preset.henchmenNote;
      el.henchmenNote.classList.remove("hidden");
    } else {
      el.henchmenNote.classList.add("hidden");
    }
  }

  function renderSteppers() {
    el.steppers.forEach((stepper) => {
      const key = stepper.dataset.option;
      const min = Number(stepper.dataset.min);
      const max = Number(stepper.dataset.max);
      const valueEl = stepper.querySelector(".stepper-value");
      const decBtn = stepper.querySelector('[data-action="dec"]');
      const incBtn = stepper.querySelector('[data-action="inc"]');
      const value = state.options[key];
      valueEl.textContent = value;
      decBtn.disabled = value <= min;
      incBtn.disabled = value >= max;
    });
  }

  function bindSteppers() {
    el.steppers.forEach((stepper) => {
      const key = stepper.dataset.option;
      const min = Number(stepper.dataset.min);
      const max = Number(stepper.dataset.max);
      stepper.addEventListener("click", (e) => {
        const btn = e.target.closest(".stepper-btn");
        if (!btn) return;
        const delta = btn.dataset.action === "inc" ? 1 : -1;
        state.options[key] = Math.min(max, Math.max(min, state.options[key] + delta));
        detectPlayersFromOptions();
        renderPlayersSegmented();
        renderHenchmenNote();
        renderSteppers();
        saveState();
        renderWarnings();
      });
    });
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

    const iconMeta = heroIconMeta(category, item);
    const icon = document.createElement("span");
    icon.className = "row-icon";
    icon.style.background = iconMeta.color;
    icon.textContent = iconMeta.icon;

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

    li.appendChild(icon);
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
        if (category.key === "scheme") syncSchemeNumbers();
        syncRequiredCards();
        render();
      });
      header.appendChild(span);
      header.appendChild(rerollSection);
      section.appendChild(header);

      const list = document.createElement("ul");
      list.className = "ios-list";
      items.forEach((item, index) => list.appendChild(resultRow(category, item, index)));
      section.appendChild(list);

      if (category.key === "scheme" && items[0] && items[0].setupNote) {
        const note = document.createElement("div");
        note.className = "scheme-note";
        note.innerHTML = `<strong>Setup note</strong><br>${items[0].setupNote.replace(/\n/g, "<br>")}`;
        section.appendChild(note);
      }

      el.results.appendChild(section);

      if (category.key === "scheme") el.results.appendChild(schemeTwistsSection(items[0]));
    });
  }

  /** A read-only reference section for the Scheme Twist mechanic: how many
   * Twist cards go in the Villain Deck (mirrors the Twists stepper in Setup
   * Size — editable there, not here) plus the current Scheme's Twist effect
   * and Evil Wins text, since both get referenced throughout the game. */
  function schemeTwistsSection(schemeItem) {
    const scheme = SCHEMES.find((s) => s.name === schemeItem.name && s.exp === schemeItem.exp);

    const section = document.createElement("section");
    section.className = "ios-group";

    const header = document.createElement("div");
    header.className = "group-header";
    const span = document.createElement("span");
    span.textContent = "Scheme Twists";
    header.appendChild(span);
    section.appendChild(header);

    const list = document.createElement("ul");
    list.className = "ios-list";

    const countRow = document.createElement("li");
    countRow.className = "ios-row";
    const countIcon = document.createElement("span");
    countIcon.className = "row-icon";
    countIcon.style.background = "#5AC8FA";
    countIcon.textContent = "🌀";
    const countText = document.createElement("span");
    countText.className = "row-text";
    countText.textContent = "Twists in Villain Deck";
    const countValue = document.createElement("span");
    countValue.className = "row-trailing";
    countValue.textContent = state.options.twists;
    countRow.appendChild(countIcon);
    countRow.appendChild(countText);
    countRow.appendChild(countValue);
    list.appendChild(countRow);
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
      evilNote.innerHTML = `<strong>Evil Wins</strong><br>${scheme.evilWins}`;
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
    const scheme = currentSchemeData();
    if (scheme && scheme.twist) lines.push("", "On a Twist:", `  ${scheme.twist.split("\n").join("\n  ")}`);
    if (scheme && scheme.evilWins) lines.push("", `Evil Wins: ${scheme.evilWins}`);
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

    const iconMeta = heroIconMeta(category, item);
    const icon = document.createElement("span");
    icon.className = "row-icon";
    icon.style.background = iconMeta.color;
    icon.textContent = iconMeta.icon;

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

    li.appendChild(icon);
    li.appendChild(text);
    li.appendChild(switchWrap);
    return li;
  }

  function chooseRow(category, item, currentItem) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ios-row sheet-row";

    const iconMeta = heroIconMeta(category, item);
    const icon = document.createElement("span");
    icon.className = "row-icon";
    icon.style.background = iconMeta.color;
    icon.textContent = iconMeta.icon;

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

    btn.appendChild(icon);
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

    const icon = document.createElement("span");
    icon.className = "row-icon";
    icon.style.background = "#8E8E93";
    icon.textContent = "🕓";

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

    li.appendChild(icon);
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
    renderSteppers();
    renderHenchmenNote();
    bindSteppers();
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
