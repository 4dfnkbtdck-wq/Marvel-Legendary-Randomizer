# Marvel Legendary Randomizer

A small, dependency-free web app that randomizes a full setup for
**Legendary: A Marvel Deck Building Game** — Mastermind, Scheme, Villain
Groups, Henchmen, and Heroes — filtered to whichever expansions you own,
with a bunch of ways to fine-tune it.

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

1. **Expansions** — switch on the ones you own (only Core Set is on by
   default).
2. **Card Pool** — dig into any category (Mastermind, Scheme, Villain
   Groups, Henchmen, Heroes) to turn off individual cards you don't want
   in the mix, with search.
3. **Setup Size** — pick a **Players** count (1–5) to fill in Heroes /
   Villain Groups / Henchmen / Bystanders from the game's real
   deck-construction table; nudge any of those with the +/− steppers
   afterward if you want something different.
4. Tap **Randomize Setup**.
5. On any result card: 🔍 **choose** a specific card for that slot, 🔒
   **lock** it so it survives the next reroll, or 🔁 **reroll** just that
   one. "Reroll All" on a section header rerolls everything in that
   section (respecting locks).
6. **Past Setups** (top of the page) keeps your last 20 randomized setups
   so you can look one back up or restore it.
7. **Copy Setup** puts a plain-text summary on your clipboard.

Some Masterminds always lead a specific Villain Group or Henchman group
(per the "always leads ___" text on their card) — when one of those is in
play, its card is automatically included and locked in, tagged "always
led by ___" so you know why. It still respects your locks and Card Pool
exclusions: it won't evict a card you locked yourself, and won't force in
something you've excluded.

Your expansion selection, exclusions, and size settings are remembered in
the browser (`localStorage`) between visits.

## Card data

`js/data.js` holds the whole card database as plain JS arrays — one entry
per Mastermind / Scheme / Villain Group / Henchmen / Hero, each tagged
with the expansion it belongs to and, for Masterminds, an optional
`leads` array for the "always leads" mechanic above.

Every expansion is listed even when its data is sparse or empty — each
one in `EXPANSIONS` carries a `confidence`:

- **`verified`** — transcribed from an official source (right now: Core
  Set, from the [official quick-reference](https://www.legendarycardgame.com/core-set-at-a-glace)).
- **`moderate`** — compiled from general game knowledge, not
  cross-checked against a primary source.
- **`light`** — a handful of headline cards only, likely incomplete.
- **`none`** — name only, no card data yet.

Anything short of `verified` shows a note in the Expansions list, so
guesses are never presented as fact. Skim it against your own boxes
before your first game and fix anything that's off — or send along the
real text (a photo of the card, the rulebook, whatever) and it'll get
transcribed in properly.

**Legendary: Villains** flips the game so players control Villain
characters against a good-guy Mastermind — the opposite shape from every
other expansion. It's mapped onto the same Mastermind/Scheme/Villain
Groups/Henchmen/Heroes structure (its Villains go in Heroes, its Hero
Groups go in Villain Groups, and so on). It's fine to combine it with
other expansions — you'll get a mixed hero/villain lineup, which is a
legitimate (if unusual) way to play; it's your call, not the app's.

To add an expansion or correct an entry:

1. Add a row to `EXPANSIONS` with a short `id`, display `name`, and
   `confidence`.
2. Add entries to `MASTERMINDS` / `SCHEMES` / `VILLAIN_GROUPS` /
   `HENCHMEN` / `HEROES`, each as `{ name: "...", exp: "your-id" }`.
3. Reload the page — the new expansion shows up automatically.

A category can be sparse (e.g. a small-box expansion that only adds
Heroes) — the randomizer simply won't draw from an empty pool, and will
warn you if a pool is too small for the setup size you asked for.

---

Fan-made, unofficial companion tool. Not affiliated with Upper Deck
Entertainment or Marvel.
