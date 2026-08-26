(function () {
  "use strict";

  // Must match app.js's STORAGE_KEY — this page only reads what the main
  // app already wrote to localStorage, it never writes its own copy.
  const STORAGE_KEY = "legendary-randomizer/v2";

  const CATEGORIES = [
    { key: "mastermind", label: "Mastermind", pool: MASTERMINDS },
    { key: "scheme", label: "Scheme", pool: SCHEMES },
    { key: "villains", label: "Villain Groups", pool: VILLAIN_GROUPS },
    { key: "henchmen", label: "Henchmen", pool: HENCHMEN },
    { key: "heroes", label: "Heroes", pool: HEROES },
  ];

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function expansionNameFor(category, cardName) {
    const card = category.pool.find((c) => c.name === cardName);
    if (!card) return "";
    const exp = EXPANSIONS.find((e) => e.id === card.exp);
    return exp ? exp.name : "";
  }

  function formatPct(wins, losses) {
    const total = wins + losses;
    if (!total) return "—";
    return `${Math.round((wins / total) * 100)}%`;
  }

  function renderOverview(data) {
    const log = (data && data.gameLog) || { heroWins: 0, evilWins: 0 };
    const total = (log.heroWins || 0) + (log.evilWins || 0);
    document.getElementById("games-logged").textContent = String(total);
    document.getElementById("hero-win-rate").textContent = formatPct(log.heroWins || 0, log.evilWins || 0);
  }

  function cardRow(category, name, entry) {
    const li = document.createElement("li");
    li.className = "ios-row";

    const text = document.createElement("span");
    text.className = "row-text";
    const main = document.createElement("span");
    main.className = "row-text-main";
    main.textContent = name;
    const sub = document.createElement("span");
    sub.className = "row-text-sub";
    sub.textContent = expansionNameFor(category, name);
    text.appendChild(main);
    text.appendChild(sub);

    const trailing = document.createElement("span");
    trailing.className = "row-trailing";
    trailing.textContent = `${entry.wins}W – ${entry.losses}L · ${formatPct(entry.wins, entry.losses)}`;

    li.appendChild(text);
    li.appendChild(trailing);
    return li;
  }

  /** One section per category, cards sorted by games played (most-played
   * first, alphabetical tiebreak) — cards with no logged games are left
   * out entirely rather than padding the page with an untouched library. */
  function renderSections(data) {
    const container = document.getElementById("stats-sections");
    container.innerHTML = "";
    const cardStats = (data && data.cardStats) || {};
    let anyPlayed = false;

    CATEGORIES.forEach((category) => {
      const bucket = cardStats[category.key] || {};
      const names = Object.keys(bucket).filter((name) => bucket[name].wins + bucket[name].losses > 0);
      if (!names.length) return;
      anyPlayed = true;

      names.sort((a, b) => {
        const totalA = bucket[a].wins + bucket[a].losses;
        const totalB = bucket[b].wins + bucket[b].losses;
        if (totalB !== totalA) return totalB - totalA;
        return a.localeCompare(b);
      });

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
      names.forEach((name) => list.appendChild(cardRow(category, name, bucket[name])));
      section.appendChild(list);

      container.appendChild(section);
    });

    if (!anyPlayed) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No games logged yet. Randomize a setup on the main page, play it out, then tap Log Result.";
      container.appendChild(empty);
    }
  }

  function init() {
    const data = loadData();
    renderOverview(data);
    renderSections(data);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
