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

  const CATEGORY_BY_KEY = {};
  CATEGORIES.forEach((c) => (CATEGORY_BY_KEY[c.key] = c));

  let state = loadState();

  function defaultState() {
    return {
      expansions: new Set(["core"]),
      options: { heroCount: 5, villainCount: 3, henchmenCount: 1, bystanders: 8, players: 3 },
      exclusions: { mastermind: new Set(), scheme: new Set(), villains: new Set(), henchmen: new Set(), heroes: new Set() },
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
          history: state.history,
        })
      );
    } catch (e) {
      /* localStorage unavailable — silently skip persistence */
    }
  }

  function poolFor(category) {
    const excluded = state.exclusions[category.key];
    return category.pool.filter((card) => state.expansions.has(card.exp) && !excluded.has(card.name));
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
    if (!keepLocked) state.locks[category.key] = combined.map(() => false);
  }

  function randomizeAll() {
    CATEGORIES.forEach((category) => randomizeCategory(category, { keepLocked: true }));
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
    const locks = state.locks[categoryKey] || [];
    locks[index] = true;
    state.locks[categoryKey] = locks;
    render();
  }

  function poolWarnings() {
    return CATEGORIES.map((category) => {
      const pool = poolFor(category);
      const n = countFor(category);
      if (pool.length < n) {
        return `${category.label}: need ${n}, only ${pool.length} available with current expansions/exclusions.`;
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
        saveState();
        renderWarnings();
        renderToggleAllLabel();
        renderCardPool();
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
    state.options.heroCount = preset.heroCount;
    state.options.villainCount = preset.villainCount;
    state.options.henchmenCount = preset.henchmenCount;
    state.options.bystanders = preset.bystanders;
    renderPlayersSegmented();
    renderSteppers();
    renderHenchmenNote();
    saveState();
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

    const icon = document.createElement("span");
    icon.className = "row-icon";
    icon.style.background = category.color;
    icon.textContent = category.icon;

    const text = document.createElement("div");
    text.className = "result-row-text";
    const mainSpan = document.createElement("span");
    mainSpan.className = "row-text-main";
    mainSpan.textContent = item.name;
    const subSpan = document.createElement("span");
    subSpan.className = "row-text-sub";
    subSpan.textContent = (EXPANSIONS.find((e) => e.id === item.exp) || {}).name || item.exp;
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
        render();
      });
      header.appendChild(span);
      header.appendChild(rerollSection);
      section.appendChild(header);

      const list = document.createElement("ul");
      list.className = "ios-list";
      items.forEach((item, index) => list.appendChild(resultRow(category, item, index)));
      section.appendChild(list);

      el.results.appendChild(section);
    });
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
      lines.push("");
    });
    lines.push(`Bystanders: ${state.options.bystanders}`);
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

    const icon = document.createElement("span");
    icon.className = "row-icon";
    icon.style.background = category.color;
    icon.textContent = category.icon;

    const text = document.createElement("span");
    text.className = "row-text";
    text.textContent = item.name;

    const switchWrap = document.createElement("span");
    switchWrap.className = "ios-switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("aria-label", `Include ${item.name}`);
    input.checked = !state.exclusions[category.key].has(item.name);
    input.addEventListener("change", () => {
      if (input.checked) state.exclusions[category.key].delete(item.name);
      else state.exclusions[category.key].add(item.name);
      saveState();
      renderWarnings();
      renderCardPool();
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

    const icon = document.createElement("span");
    icon.className = "row-icon";
    icon.style.background = category.color;
    icon.textContent = category.icon;

    const text = document.createElement("span");
    text.className = "row-text";
    text.textContent = item.name;

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
        saveState();
        renderWarnings();
        renderCardPool();
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
      saveState();
      renderExpansions();
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
