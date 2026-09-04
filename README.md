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

Nothing else needs to change. Timing, scoring, progress recording, feedback,
the reveal button, the results screen and the URL seed all come from the
runner.

Two things to get right:

- **`check` must give partial credit** where the exercise has parts. Seven of
  eight table rows is not the same as guessing.
- **Filter degenerate questions** in `generate`, using a predicate passed to
  `randomFormulaWhere`. A question that looks hard but is not teaches nothing.

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
