(function () {
  "use strict";

  const STORAGE_KEY = "legendary-randomizer/v1";

  const EXPANSION_COLORS = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#5856D6", "#AF52DE"];

  const CATEGORIES = [
    { key: "mastermind", label: "Mastermind", icon: "👑", color: "#AF52DE", pool: MASTERMINDS, countKey: null, fixedCount: 1 },
    { key: "scheme", label: "Scheme", icon: "📜", color: "#FFCC00", pool: SCHEMES, countKey: null, fixedCount: 1 },
    { key: "villains", label: "Villain Groups", icon: "🎭", color: "#FF3B30", pool: VILLAIN_GROUPS, countKey: "villainCount", fixedCount: null },
    { key: "henchmen", label: "Henchmen", icon: "👊", color: "#FF9500", pool: HENCHMEN, countKey: "henchmenCount", fixedCount: null },
    { key: "heroes", label: "Heroes", icon: "⭐️", color: "#007AFF", pool: HEROES, countKey: "heroCount", fixedCount: null },
  ];

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
    toggleAllExpansions: document.getElementById("toggle-all-expansions"),
    randomizeAll: document.getElementById("randomize-all"),
    warnings: document.getElementById("warnings"),
    results: document.getElementById("results"),
    copyGroup: document.getElementById("copy-group"),
    copyBtn: document.getElementById("copy-setup"),
    steppers: Array.from(document.querySelectorAll(".stepper")),
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
      text.textContent = exp.name;

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

  function init() {
    renderExpansions();
    renderSteppers();
    bindSteppers();
    render();

    el.randomizeAll.addEventListener("click", randomizeAll);

    el.toggleAllExpansions.addEventListener("click", () => {
      const allSelected = state.expansions.size === EXPANSIONS.length;
      state.expansions = allSelected ? new Set() : new Set(EXPANSIONS.map((e) => e.id));
      saveState();
      renderExpansions();
      renderWarnings();
    });

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
