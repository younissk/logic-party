/**
 * Who proved what — the bonus question on exam26a.
 *
 * The paper prints a portrait and asks who it is and why it matters to the
 * course. There is one pictured figure in the notes, and it is Gödel. Rather
 * than reproduce an image, this asks the part that is actually examinable and
 * actually useful: matching each result the course uses to the person whose
 * name is on it.
 *
 * It doubles as a map of the whole term. Every name here belongs to a theorem
 * that some earlier minigame drills, so the matching is a check on whether the
 * pieces have been connected up rather than a quiz on biography.
 */

import { useEffect, useMemo, useState } from 'react'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { MovingItem, MovingList, Pop } from '@/ui/motion'
import { NameTheLogicianGuide } from './nameTheLogician.guide'

export interface LogicianQuestion {
  /** Result ids in the order the results are listed. */
  results: string[]
  /** The same ids, shuffled — the order the names are listed. */
  names: string[]
}

/** For each result, which name row was linked to it. */
export type LogicianAnswer = (number | null)[]

export interface Entry {
  id: string
  name: string
  result: string
  /** Where it turns up in this course. */
  where: string
  difficulty: Difficulty[]
}

export const ENTRIES: readonly Entry[] = [
  {
    id: 'godel-incomplete',
    name: 'Gödel',
    result: 'No computable consistent axiom set proves every truth of arithmetic',
    where: 'The bonus question on exam26a, and the ceiling on T(ℕ,=,+,*) in §5.2.',
    difficulty: ['easy', 'medium', 'hard'],
  },
  {
    id: 'godel-complete',
    name: 'Gödel, again',
    result: 'Every valid first-order formula has a proof',
    where: 'The completeness theorem — the reason a refutation calculus is worth running at all.',
    difficulty: ['hard'],
  },
  {
    id: 'tarski',
    name: 'Tarski',
    result: 'The theory of the reals with + and * is decidable, by quantifier elimination',
    where: '§5.3, and the reason circuit verification can be done with polynomials.',
    difficulty: ['easy', 'medium', 'hard'],
  },
  {
    id: 'presburger',
    name: 'Presburger',
    result: 'The theory of the naturals with + alone is decidable',
    where: '§5.2 — decided by automata, and the standing counterexample to "decidable means QE".',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'herbrand',
    name: 'Herbrand',
    result: 'A clause set is unsatisfiable exactly when some finite set of ground instances is',
    where: 'Theorem 4.21, and the ground behind Gilmore’s algorithm.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'robinson',
    name: 'Robinson',
    result: 'Resolution with unification, and the most general unifier',
    where: 'Chapter 4 — the calculus every first-order refutation in this course runs in.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'knuth-bendix',
    name: 'Knuth and Bendix',
    result: 'Completing a rewrite system by orienting its critical pairs',
    where: 'Algorithm 3.26 — and it need not terminate, which is one of the exam’s true/false lines.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'skolem',
    name: 'Skolem',
    result: 'Replacing an existential variable by a function of the universals before it',
    where: 'Algorithm 4.13, the step that makes clausification possible.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'church-turing',
    name: 'Church and Turing',
    result: 'There is no algorithm deciding whether a first-order formula is valid',
    where: 'Why proof search only ever halts on the valid side.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'davis-putnam',
    name: 'Davis and Putnam',
    result: 'Deciding satisfiability by eliminating one variable at a time',
    where: 'Chapter 2 — the DP procedure, and the ancestor of DPLL.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'cantor',
    name: 'Cantor',
    result: 'Any two countable unbounded dense linear orders are isomorphic',
    where: 'Why the theory of §5.2 is complete, and why its elimination works.',
    difficulty: ['hard'],
  },
]

export const entryOf = (id: string): Entry =>
  ENTRIES.find((entry) => entry.id === id) ?? (ENTRIES[0] as Entry)

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const HOW_MANY: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 5 }

function generate({ rng, difficulty }: GenerateContext): LogicianQuestion {
  const pool = ENTRIES.filter((entry) => entry.difficulty.includes(difficulty))
  const usable = pool.length >= HOW_MANY[difficulty] ? pool : ENTRIES

  for (let attempt = 0; attempt < 30; attempt++) {
    const chosen = rng.sample(usable, HOW_MANY[difficulty])
    // Both Gödel entries on one board would make the names ambiguous to read,
    // even though the results are different.
    const surnames = chosen.map((entry) => entry.name.replace(', again', ''))
    if (new Set(surnames).size !== chosen.length) continue
    const ids = chosen.map((entry) => entry.id)
    return { results: ids, names: rng.shuffle(ids) }
  }
  const fallback = ['godel-incomplete', 'tarski', 'robinson']
  return { results: fallback, names: [...fallback].reverse() }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: LogicianQuestion): LogicianAnswer =>
  question.results.map((id) => question.names.indexOf(id))

function check(question: LogicianQuestion, answer: LogicianAnswer): Verdict {
  const wanted = solve(question)
  const wrong = wanted.filter((index, position) => answer[position] !== index).length

  if (wrong === 0) {
    return {
      correct: true,
      message: `All ${wanted.length} matched`,
      detail: entryOf(question.results[0] as string).where,
    }
  }

  return {
    correct: false,
    // A count only — with four rows, naming one settles most of the rest.
    message: `${wrong} of ${wanted.length} matched wrongly`,
    score: (wanted.length - wrong) / wanted.length,
    detail:
      'Place the ones you are sure of first; the rest are then forced, because each name is used exactly once.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<LogicianQuestion, LogicianAnswer>) {
  const wanted = useMemo(() => solve(question), [question])
  const [links, setLinks] = useState<(number | null)[]>([])
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    setLinks(question.results.map(() => null))
    setActive(null)
  }, [question])

  const shown = locked ? wanted : links
  const done = links.length > 0 && links.every((entry) => entry !== null)

  const linkTo = (name: number) => {
    if (locked || active === null) return
    setLinks((previous) =>
      previous.map((entry, index) => (index === active ? name : entry === name ? null : entry)),
    )
    setActive(null)
  }

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Whose theorem is it?
      </p>

      <div className="mt-3 flex flex-col gap-1.5">
        {question.results.map((id, index) => {
          const linked = shown[index]
          const right = locked && linked === wanted[index]
          return (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => setActive(active === index ? null : index)}
              className={`tile px-3 py-2 text-left ${
                locked
                  ? right
                    ? 'bg-grass/30'
                    : 'bg-space-red/20'
                  : active === index
                    ? 'bg-coin'
                    : 'bg-card-shade'
              }`}
            >
              <span className="block text-sm font-semibold leading-snug">
                {entryOf(id).result}
              </span>
              <span className="mt-1 block text-xs font-bold text-ink-soft">
                {linked === null || linked === undefined
                  ? 'tap, then tap a name'
                  : entryOf(question.names[linked] as string).name}
              </span>
            </button>
          )
        })}
      </div>

      {!locked && (
        <>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">The names</p>
          <MovingList className="mt-1 flex flex-wrap gap-1.5">
            {question.names.map((id, index) => (
              <MovingItem
                key={id}
                id={id}
                disabled={active === null}
                onClick={() => linkTo(index)}
                className={`tile px-3 py-1.5 text-sm font-bold ${
                  links.includes(index) ? 'bg-grass/25' : 'bg-card'
                }`}
              >
                {entryOf(id).name}
              </MovingItem>
            ))}
          </MovingList>

          <Button
            variant="coin"
            className="mt-3 w-full"
            disabled={!done}
            onClick={() => submit(links)}
          >
            {done ? 'Submit' : 'Match them all first'}
          </Button>
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm font-medium text-ink-soft">
            {question.results.map((id) => (
              <li key={id}>
                <strong className="text-ink">{entryOf(id).name}</strong> — {entryOf(id).where}
              </li>
            ))}
          </ul>
        </Pop>
      )}
    </Card>
  )
}

export const nameTheLogicianGame = defineMinigame<LogicianQuestion, LogicianAnswer>({
  id: 'portrait',
  title: 'Name The Logician',
  tagline: 'Match each theorem the course leans on to the person it is named after.',
  topics: ['theories'],
  icon: '🎩',
  roundSeconds: 120,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  questionKey: (question) => [...question.results].sort().join(','),
  explain: (question) => {
    const entry = entryOf(question.results[0] as string)
    return `${entry.name}: ${entry.result}. ${entry.where}`
  },
  Screen,
  Guide: NameTheLogicianGuide,
})
