(function () {
  "use strict";

  const STORAGE_KEY = "legendary-randomizer/v1";

  const CATEGORIES = [
    { key: "mastermind", label: "Mastermind", pool: MASTERMINDS, countKey: null, fixedCount: 1 },
    { key: "scheme", label: "Scheme", pool: SCHEMES, countKey: null, fixedCount: 1 },
    { key: "villains", label: "Villain Groups", pool: VILLAIN_GROUPS, countKey: "villainCount", fixedCount: null },
    { key: "henchmen", label: "Henchmen", pool: HENCHMEN, countKey: "henchmenCount", fixedCount: null },
    { key: "heroes", label: "Heroes", pool: HEROES, countKey: "heroCount", fixedCount: null },
  ];

  /** @type {{expansions: Set<string>, options: {heroCount:number, villainCount:number, henchmenCount:number}, result: Object, locks: Object}} */
  let state = loadState();

  function loadState() {
    const defaults = {
      expansions: ["core"],
      options: { heroCount: 5, villainCount: 4, henchmenCount: 1 },
      result: {},
      locks: {},
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaults, expansions: new Set(defaults.expansions) };
      const parsed = JSON.parse(raw);
      return {
        expansions: new Set(parsed.expansions && parsed.expansions.length ? parsed.expansions : defaults.expansions),
        options: { ...defaults.options, ...(parsed.options || {}) },
        result: {},
        locks: {},
      };
    } catch (e) {
      return { ...defaults, expansions: new Set(defaults.expansions) };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          expansions: Array.from(state.expansions),
          options: state.options,
        })
      );
    } catch (e) {
      /* localStorage unavailable — silently skip persistence */
    }
  }

  function poolFor(category) {
    return category.pool.filter((card) => state.expansions.has(card.exp));
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
    render();
  }

  function rerollOne(categoryKey, index) {
    const category = CATEGORIES.find((c) => c.key === categoryKey);
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

  function poolWarnings() {
    return CATEGORIES.map((category) => {
      const pool = poolFor(category);
      const n = countFor(category);
      if (pool.length < n) {
        return `${category.label}: need ${n}, only ${pool.length} available with current expansions.`;
      }
      return null;
    }).filter(Boolean);
  }

  // ---------- Rendering ----------

  const el = {
    expansionList: document.getElementById("expansion-list"),
    heroCount: document.getElementById("hero-count"),
    villainCount: document.getElementById("villain-count"),
    henchmenCount: document.getElementById("henchmen-count"),
    heroCountValue: document.getElementById("hero-count-value"),
    villainCountValue: document.getElementById("villain-count-value"),
    henchmenCountValue: document.getElementById("henchmen-count-value"),
    randomizeAll: document.getElementById("randomize-all"),
    warnings: document.getElementById("warnings"),
    results: document.getElementById("results"),
    copyBtn: document.getElementById("copy-setup"),
    selectAll: document.getElementById("select-all-expansions"),
    selectNone: document.getElementById("select-none-expansions"),
  };

  function renderExpansions() {
    el.expansionList.innerHTML = "";
    EXPANSIONS.forEach((exp) => {
      const id = `exp-${exp.id}`;
      const wrap = document.createElement("label");
      wrap.className = "expansion-chip";
      wrap.htmlFor = id;

      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = id;
      input.checked = state.expansions.has(exp.id);
      input.addEventListener("change", () => {
        if (input.checked) state.expansions.add(exp.id);
        else state.expansions.delete(exp.id);
        saveState();
        renderWarnings();
      });

      const span = document.createElement("span");
      span.textContent = exp.name;

      wrap.appendChild(input);
      wrap.appendChild(span);
      el.expansionList.appendChild(wrap);
    });
  }

  function renderOptions() {
    el.heroCount.value = state.options.heroCount;
    el.villainCount.value = state.options.villainCount;
    el.henchmenCount.value = state.options.henchmenCount;
    el.heroCountValue.textContent = state.options.heroCount;
    el.villainCountValue.textContent = state.options.villainCount;
    el.henchmenCountValue.textContent = state.options.henchmenCount;
  }

  function renderWarnings() {
    const warnings = poolWarnings();
    el.warnings.innerHTML = "";
    if (!warnings.length) {
      el.warnings.classList.add("hidden");
      el.randomizeAll.disabled = false;
      return;
    }
    el.warnings.classList.remove("hidden");
    el.randomizeAll.disabled = state.expansions.size === 0;
    warnings.forEach((w) => {
      const p = document.createElement("p");
      p.textContent = w;
      el.warnings.appendChild(p);
    });
  }

  function cardEl(category, item, index) {
    const card = document.createElement("div");
    card.className = "result-card";

    const name = document.createElement("div");
    name.className = "result-card-name";
    name.textContent = item.name;

    const meta = document.createElement("div");
    meta.className = "result-card-meta";
    const expName = (EXPANSIONS.find((e) => e.id === item.exp) || {}).name || item.exp;
    meta.textContent = expName;

    const actions = document.createElement("div");
    actions.className = "result-card-actions";

    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.className = "icon-btn";
    const locked = !!(state.locks[category.key] || [])[index];
    lockBtn.textContent = locked ? "🔒" : "🔓";
    lockBtn.title = locked ? "Locked — click to unlock" : "Unlocked — click to lock";
    lockBtn.addEventListener("click", () => toggleLock(category.key, index));

    const rerollBtn = document.createElement("button");
    rerollBtn.type = "button";
    rerollBtn.className = "icon-btn";
    rerollBtn.textContent = "🎲";
    rerollBtn.title = "Reroll just this one";
    rerollBtn.disabled = locked;
    rerollBtn.addEventListener("click", () => rerollOne(category.key, index));

    actions.appendChild(lockBtn);
    actions.appendChild(rerollBtn);

    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(actions);
    if (locked) card.classList.add("locked");
    return card;
  }

  function renderResults() {
    el.results.innerHTML = "";
    const hasAnyResult = CATEGORIES.some((c) => (state.result[c.key] || []).length);

    if (!hasAnyResult) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Pick your expansions, then hit Randomize Setup to build a game.";
      el.results.appendChild(empty);
      el.copyBtn.classList.add("hidden");
      return;
    }

    el.copyBtn.classList.remove("hidden");

    CATEGORIES.forEach((category) => {
      const items = state.result[category.key] || [];
      if (!items.length) return;

      const section = document.createElement("section");
      section.className = `result-section result-section--${category.key}`;

      const header = document.createElement("div");
      header.className = "result-section-header";

      const h2 = document.createElement("h2");
      h2.textContent = category.label;
      header.appendChild(h2);

      const rerollSection = document.createElement("button");
      rerollSection.type = "button";
      rerollSection.className = "text-btn";
      rerollSection.textContent = "reroll all";
      rerollSection.addEventListener("click", () => {
        randomizeCategory(category, { keepLocked: true });
        render();
      });
      header.appendChild(rerollSection);

      section.appendChild(header);

      const grid = document.createElement("div");
      grid.className = "result-grid";
      items.forEach((item, index) => grid.appendChild(cardEl(category, item, index)));
      section.appendChild(grid);

      el.results.appendChild(section);
    });
  }

  function setupText() {
    const lines = ["MARVEL LEGENDARY — Game Setup", ""];
    CATEGORIES.forEach((category) => {
      const items = state.result[category.key] || [];
      if (!items.length) return;
      lines.push(`${category.label}:`);
      items.forEach((item) => lines.push(`  - ${item.name} (${item.exp})`));
      lines.push("");
    });
    return lines.join("\n").trim();
  }

  function render() {
    renderWarnings();
    renderResults();
  }

  function bindOptionInput(inputEl, key) {
    inputEl.addEventListener("input", () => {
      state.options[key] = Number(inputEl.value);
      renderOptions();
      saveState();
      renderWarnings();
    });
  }

  function init() {
    renderExpansions();
    renderOptions();
    render();

    bindOptionInput(el.heroCount, "heroCount");
    bindOptionInput(el.villainCount, "villainCount");
    bindOptionInput(el.henchmenCount, "henchmenCount");

    el.randomizeAll.addEventListener("click", randomizeAll);

    el.selectAll.addEventListener("click", () => {
      state.expansions = new Set(EXPANSIONS.map((e) => e.id));
      saveState();
      renderExpansions();
      renderWarnings();
    });

    el.selectNone.addEventListener("click", () => {
      state.expansions = new Set();
      saveState();
      renderExpansions();
      renderWarnings();
    });

    el.copyBtn.addEventListener("click", async () => {
      const text = setupText();
      try {
        await navigator.clipboard.writeText(text);
        el.copyBtn.textContent = "Copied!";
      } catch (e) {
        el.copyBtn.textContent = "Copy failed";
      }
      setTimeout(() => (el.copyBtn.textContent = "Copy Setup"), 1500);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
