(function () {
  "use strict";

  /** One row in the Keyword Glossary — read-only, term as the bold main
   * line and the full definition wrapping underneath instead of the
   * usual ellipsis-truncated subtext, since here the definition *is*
   * the point. */
  function glossaryRow(entry) {
    const li = document.createElement("li");
    li.className = "ios-row";

    const text = document.createElement("span");
    text.className = "row-text";
    const main = document.createElement("span");
    main.className = "row-text-main glossary-term";
    main.textContent = entry.term;
    const sub = document.createElement("span");
    sub.className = "row-text-sub glossary-definition";
    sub.textContent = entry.definition;
    text.appendChild(main);
    text.appendChild(sub);

    const tags = document.createElement("span");
    tags.className = "glossary-expansions";
    entry.expansions.forEach((expId) => {
      const expName = (EXPANSIONS.find((e) => e.id === expId) || {}).name || expId;
      const tag = document.createElement("span");
      tag.className = "glossary-expansion-tag";
      tag.textContent = expName;
      tags.appendChild(tag);
    });
    text.appendChild(tags);

    li.appendChild(text);
    return li;
  }

  function render(query) {
    const container = document.getElementById("glossary-list");
    container.innerHTML = "";

    const q = query.trim().toLowerCase();
    const entries = KEYWORDS.filter((k) => {
      if (k.term.toLowerCase().includes(q) || k.definition.toLowerCase().includes(q)) return true;
      return k.expansions.some((expId) => {
        const expName = (EXPANSIONS.find((e) => e.id === expId) || {}).name || expId;
        return expName.toLowerCase().includes(q);
      });
    }).sort((a, b) => a.term.localeCompare(b.term));

    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No matching keywords.";
      container.appendChild(empty);
      return;
    }

    const section = document.createElement("section");
    section.className = "ios-group";
    const list = document.createElement("ul");
    list.className = "ios-list";
    entries.forEach((entry) => list.appendChild(glossaryRow(entry)));
    section.appendChild(list);
    container.appendChild(section);
  }

  function init() {
    render("");
    document.getElementById("glossary-search").addEventListener("input", (e) => render(e.target.value));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
