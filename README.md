# Marvel Legendary Randomizer

A small, dependency-free web app that randomizes a full setup for
**Legendary: A Marvel Deck Building Game** — Mastermind, Scheme, Villain
Groups, Henchmen, and Heroes — filtered to whichever expansions you own.

## Running it

No build step, no install. Just open `index.html` in a browser, or serve
the folder statically:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

It also works as-is on GitHub Pages (Settings → Pages → deploy from the
`main` branch, root folder).

## Using it

1. Check the boxes for the expansions you own (only Core Set is checked
   by default).
2. Adjust how many Heroes / Villain Groups / Henchmen you want drawn.
3. Hit **Randomize Setup**.
4. Click 🔒 on any card to lock it before rerolling, or 🎲 to reroll just
   that one card. "reroll all" on a section header rerolls everything in
   that section (respecting locks).
5. **Copy Setup** puts a plain-text summary on your clipboard.

Your expansion selection and size settings are remembered in the browser
(`localStorage`) between visits.

## Card data

`js/data.js` holds the whole card database as plain JS arrays — one entry
per Mastermind / Scheme / Villain Group / Henchmen / Hero, each tagged
with the expansion it belongs to. It's a best-effort starter set compiled
from publicly available box-content info, **not** a verified transcription
of every card, so skim it against your own boxes before your first game
and fix anything that's off.

Two expansions are intentionally not included: **Legendary: Villains** and
**Legendary: Civil War** use a different game mode (playing as villains,
or heroes vs. heroes) that doesn't fit the Mastermind/Scheme/Villain/Hero
shape this randomizer generates.

To add an expansion or correct an entry:

1. Add a row to `EXPANSIONS` with a short `id` and display `name`.
2. Add entries to `MASTERMINDS` / `SCHEMES` / `VILLAIN_GROUPS` /
   `HENCHMEN` / `HEROES`, each as `{ name: "...", exp: "your-id" }`.
3. Reload the page — the new expansion shows up in the checkbox list
   automatically.

A category can be sparse (e.g. a small-box expansion that only adds
Heroes) — the randomizer simply won't draw from an empty pool, and will
warn you if a pool is too small for the setup size you asked for.

---

Fan-made, unofficial companion tool. Not affiliated with Upper Deck
Entertainment or Marvel.
