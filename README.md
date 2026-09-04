# Logic Party

Computational logic revision as a party game. Each exam exercise type becomes a
minigame; the board-game shell wraps them later.

```bash
npm install
npm run dev     # play it
npm test        # logic core: property tests
npm run check   # typecheck
```

## Why it is built this way

The learning value is in the **minigames and the solvers**, not the board. So
the board comes last, and the solvers come first — writing a correct CNF
converter teaches more than playing with one does.

Three rules the codebase follows:

1. **Generate, don't hardcode.** No question bank. Every exercise is produced
   by a seeded generator and marked by a real solver, so the supply is
   unlimited and the marking is trustworthy.
2. **Always produce a witness.** Never "wrong" alone — always "wrong, and here
   is the row where your table breaks". Every function in `semantics.ts` that
   can fail returns the assignment that proves it.
3. **Reject bad exercises.** `((p → q) ∨ q) ∧ q` looks hard and is just `q`.
   The generator refuses formulas with fictitious variables or operands
   combined with themselves.

## Round format

Time attack. One clock for the whole round, unlimited questions, and the clock
keeps running while feedback is on screen — so reading the explanation is a
real decision rather than a free pause.

| | |
|---|---|
| Correct | **+100**, plus **+25** per consecutive correct beyond the first (bonus capped at +100) |
| Wrong or skipped | **−50**, flat |
| Score floor | 0 — a bad run cannot bury the score so deep the rest stops mattering |

The penalty is flat rather than scaled by partial credit: it has to be felt for
rushing to carry real risk. Partial credit is still recorded against the topic,
it just does not soften the hit. All four numbers live in `SCORING` in
`src/engine/types.ts`.

Minigames where rushing defeats the point — building a natural deduction proof,
say — can set `format: 'fixed'` instead for a set number of questions.

## Leaderboard

Local, and against yourself: best score per game *and* difficulty, in
localStorage. A hard 800 is not a lesser easy 900, so they are ranked
separately.

**Web3Forms does not work for this**, if you were wondering. Its read API is a
PRO feature needing a *secret* Bearer key, and a static app has nowhere to hide
one — ship it in the bundle and anyone can pull every submission. The write
side takes a public access key with no validation, so anyone could post fake
scores. It is a contact-form-to-email service: no sorting, no top-N, no upsert.

If a real shared leaderboard is ever wanted, the right shape is Supabase (or
similar): Postgres, a public anon key, and row-level security allowing insert
but not update or delete.

## Look

Party-board styling: blue and red spaces, gold stars and coins on a bright
sky, thick dark outlines, hard un-blurred shadows, and buttons that press down
into their own shadow. The palette sits in the family of the genre
(blue `#009BD9`, yellow `#FCCF00`, red `#E62310`, green `#44AF35`) but the
values, shapes and typeface are our own — no Nintendo assets or marks.

The vocabulary lives in `src/index.css` as four classes: `.tile` (card),
`.chunky` (button), `.space` (round board token), `.shout` (outlined display
text). `.tile` deliberately sets *no* background — it is defined after
Tailwind's utilities, so a `background` shorthand there would silently
override every `bg-*` class put on a card.

## Layout

```
src/logic/     the engine — AST, parser, printer, evaluator, truth tables,
               NNF/CNF/DNF, clauses, semantics, seeded RNG, generators.
               Pure TypeScript, no React, ~58 tests. Everything builds on it.
src/engine/    the minigame contract, registry, round runner, round chrome.
src/games/     one file per minigame.
src/store/     progress in localStorage: per-topic accuracy, weak topics.
src/pages/     home and play screens.
```

`src/logic` never imports from anywhere else. That is what keeps the solvers
testable in isolation and reusable across every game.

## Adding a minigame

Copy [`src/games/truthTable.tsx`](src/games/truthTable.tsx) — it is the
reference implementation. Four things to write:

```ts
generate(context) → Question   // from context.rng, so it is seeded & reproducible
solve(question)   → Answer     // the reference answer
check(question, answer) → Verdict  // pure and total; a wrong answer is a verdict, never a throw
Screen                          // the React component the player interacts with
```

Then add one line to `MINIGAMES` in [`src/engine/registry.ts`](src/engine/registry.ts).

Nothing else needs to change. The clock, scoring, combos, progress recording,
feedback, confetti, the reveal button, the results screen, high scores and the
URL seed all come from the runner.

Three things to get right:

- **`check` must give partial credit** where the exercise has parts. Seven of
  eight table rows is not the same as guessing.
- **Filter degenerate questions** in `generate`, using a predicate passed to
  `randomFormulaWhere`. A question that looks hard but is not teaches nothing.
  `repeatsAnOperand` and `dependsOnAllVariables` are the two filters that catch
  most of it.
- **Provide `questionKey`** so a round does not deal the same question twice.
  A time-attack round asks a lot of questions and an easy pool is small, so
  without it repeats do happen — jarring, and farmable.

## Reproducibility

Round seed and difficulty live in the URL:
`/play/truth-table?difficulty=hard&seed=exam1`. Same link, same questions,
every time. Every recorded attempt stores its seed, so a question that was
marked wrong can be replayed exactly.

## Minigames

| Topic | Minigame | State |
|---|---|---|
| Truth tables | Truth Table Sprint | ✅ built |
| Equivalence | same-or-different, timed | planned |
| Normal forms | CNF/DNF race | planned |
| Satisfiability | find a model against the clock | planned |
| Resolution | pick the clause pair, derive □ | planned |
| Entailment | does it follow? build the countermodel | planned |
| Proof systems | natural deduction / tableaux builder | planned |
| Syntax | precedence and parenthesisation | planned |

The party-mode board — dice, turn order, opponents — comes after the minigames
exist, and reuses them unchanged.
