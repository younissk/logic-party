/**
 * Quantifier elimination over a finite universe — ln.pdf §5.2, Example 5.5.
 *
 * When the universe is finite and every element has a name, a quantifier is
 * only shorthand for a connective: ∀x becomes a conjunction over the elements,
 * ∃x becomes a disjunction. Do that to every quantifier and nothing is left to
 * eliminate — which is why every theory with a finite universe admits
 * quantifier elimination, and the easiest instance of Definition 5.4.
 *
 * The work is not choosing ∧ or ∨, which is two guesses. It is getting the
 * *instances* right: ∀x∃y:p(x,y) over {a,b} expands to four atoms, and the
 * usual mistake is p(b,a) where p(a,b) belongs. So the bank offers both, and
 * the holes have to be filled in order.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  parseFormula,
  showFormula,
  substituteFormula,
  type FoFormula,
  type FoSignature,
  type Substitution,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { MovingItem, MovingList, Pop, ProgressBar } from '@/ui/motion'
import { QeFiniteGuide } from './qeFinite.guide'

export interface QeFiniteQuestion {
  /** The whole formula, quantifier prefix and all. */
  source: string
  predicates: Record<string, number>
  functions: Record<string, number>
  /** Constant names, in the order the expansion runs through them. */
  universe: string[]
  /** Ground instances in order, plus the distractors, shuffled. */
  bank: string[]
}

export interface QeFiniteAnswer {
  /** One per quantifier, outermost first. */
  connectives: ('and' | 'or')[]
  /** One per leaf, in expansion order; null while empty. */
  leaves: (string | null)[]
}

const CONNECTIVE_SYMBOL = { and: '∧', or: '∨' } as const

export const signatureOf = (question: QeFiniteQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const formulaOf = (question: QeFiniteQuestion): FoFormula =>
  parseFormula(question.source, signatureOf(question))

/** The quantifier prefix, outermost first, and the matrix under it. */
export function prefixOf(formula: FoFormula): {
  quantifiers: { quantifier: 'forall' | 'exists'; variable: string }[]
  matrix: FoFormula
} {
  const quantifiers: { quantifier: 'forall' | 'exists'; variable: string }[] = []
  let current = formula
  while (current.kind === 'quantified') {
    quantifiers.push({ quantifier: current.quantifier, variable: current.variable })
    current = current.body
  }
  return { quantifiers, matrix: current }
}

/** Every assignment of the prefix's variables, in expansion order. */
export function tuples(question: QeFiniteQuestion): Substitution[] {
  const { quantifiers } = prefixOf(formulaOf(question))
  let assignments: Substitution[] = [{}]
  for (const { variable } of quantifiers) {
    assignments = assignments.flatMap((partial) =>
      question.universe.map(
        (constant): Substitution => ({
          ...partial,
          [variable]: { kind: 'fn', name: constant, args: [] },
        }),
      ),
    )
  }
  return assignments
}

/** The leaves of the expansion, printed, in order. */
export function leavesOf(question: QeFiniteQuestion): string[] {
  const { matrix } = prefixOf(formulaOf(question))
  return tuples(question).map((sigma) => showFormula(substituteFormula(sigma, matrix)))
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  /** Prefix and matrix, kept apart so the distractors can permute the matrix. */
  shapes: { prefix: string; matrix: string; swapped: string }[]
  universe: string[]
}

/**
 * `swapped` is the matrix with its variables exchanged. Instantiating it gives
 * the distractors — precisely the instances a player produces by substituting
 * in the wrong order, so the bank is full of near-misses rather than noise.
 */
const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1, q: 1 },
    shapes: [
      { prefix: '∀x:', matrix: 'p(x)', swapped: 'q(x)' },
      { prefix: '∃x:', matrix: '¬p(x)', swapped: 'p(x)' },
      { prefix: '∃x:', matrix: '(p(x)∧q(x))', swapped: '(p(x)∨q(x))' },
    ],
    universe: ['a', 'b', 'c'],
  },
  medium: {
    predicates: { p: 2 },
    shapes: [
      { prefix: '∀x:∃y:', matrix: 'p(x,y)', swapped: 'p(y,x)' },
      { prefix: '∃x:∀y:', matrix: 'p(x,y)', swapped: 'p(y,x)' },
      { prefix: '∀x:∀y:', matrix: '¬p(x,y)', swapped: '¬p(y,x)' },
    ],
    universe: ['a', 'b'],
  },
  hard: {
    predicates: { p: 2, q: 1 },
    shapes: [
      { prefix: '∀x:∃y:', matrix: '(p(x,y)→q(y))', swapped: '(p(y,x)→q(x))' },
      { prefix: '∃x:∀y:', matrix: '(p(x,y)∨¬q(x))', swapped: '(p(y,x)∨¬q(y))' },
      { prefix: '∀x:∃y:', matrix: '(q(x)∧p(y,x))', swapped: '(q(y)∧p(x,y))' },
    ],
    universe: ['a', 'b'],
  },
}

function generate({ rng, difficulty }: GenerateContext): QeFiniteQuestion {
  const profile = PROFILES[difficulty]
  const shape = rng.pick(profile.shapes)
  const functions = Object.fromEntries(profile.universe.map((name) => [name, 0]))

  const base: QeFiniteQuestion = {
    source: `${shape.prefix}${shape.matrix}`,
    predicates: profile.predicates,
    functions,
    universe: profile.universe,
    bank: [],
  }
  const wanted = leavesOf(base)
  const decoys = leavesOf({ ...base, source: `${shape.prefix}${shape.swapped}` })

  const bank = [...new Set([...wanted, ...decoys])]
  return { ...base, bank: rng.shuffle(bank) }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: QeFiniteQuestion): QeFiniteAnswer {
  const { quantifiers } = prefixOf(formulaOf(question))
  return {
    connectives: quantifiers.map(({ quantifier }) => (quantifier === 'forall' ? 'and' : 'or')),
    leaves: leavesOf(question),
  }
}

function check(question: QeFiniteQuestion, answer: QeFiniteAnswer): Verdict {
  const wanted = solve(question)
  const wrongConnectives = wanted.connectives.filter(
    (connective, index) => answer.connectives[index] !== connective,
  ).length
  const wrongLeaves = wanted.leaves.filter((leaf, index) => answer.leaves[index] !== leaf).length
  const total = wanted.connectives.length + wanted.leaves.length

  if (wrongConnectives === 0 && wrongLeaves === 0) {
    return {
      correct: true,
      message: 'Expanded, and no quantifier left',
      detail:
        'A finite universe turns ∀ into a conjunction over its elements and ∃ into a disjunction, so every formula has a quantifier-free equivalent. That is quantifier elimination, in its easiest form.',
    }
  }

  return {
    correct: false,
    // Two counts and no positions: naming a wrong hole would hand over the
    // retry, and the holes are few.
    message:
      wrongLeaves === 0
        ? `${wrongConnectives} connective${wrongConnectives === 1 ? '' : 's'} to reconsider`
        : `${wrongLeaves} of the ${wanted.leaves.length} holes ${wrongLeaves === 1 ? 'is' : 'are'} not right`,
    score: Math.max(0, (total - wrongConnectives - wrongLeaves) / total),
    detail:
      'Work outermost first: fix the outer variable to the first element, expand what is under it, then move to the next element. The order of the arguments is the whole trap.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/** The expansion tree: a leaf per assignment, grouped by quantifier depth. */
function Tree({
  depth,
  offset,
  span,
  answer,
  wanted,
  onLeaf,
  onConnective,
  locked,
}: {
  depth: number
  offset: number
  span: number
  answer: QeFiniteAnswer
  wanted: QeFiniteAnswer
  onLeaf: (index: number) => void
  onConnective: (level: number) => void
  locked: boolean
}) {
  if (span === 1) {
    const filled = answer.leaves[offset]
    const right = locked && filled === wanted.leaves[offset]
    return (
      <button
        type="button"
        disabled={locked}
        onClick={() => onLeaf(offset)}
        className={`tile min-w-16 px-2 py-1 font-logic text-sm font-bold ${
          filled === null || filled === undefined
            ? 'bg-card-shade text-ink-soft'
            : locked
              ? right
                ? 'bg-grass text-white'
                : 'bg-space-red text-white'
              : 'bg-coin'
        }`}
      >
        {filled ?? '◻'}
      </button>
    )
  }

  const width = span / 2
  const connective = answer.connectives[depth] ?? 'and'

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="text-lg font-bold text-ink-soft">(</span>
      <Tree
        depth={depth + 1}
        offset={offset}
        span={width}
        answer={answer}
        wanted={wanted}
        onLeaf={onLeaf}
        onConnective={onConnective}
        locked={locked}
      />
      <button
        type="button"
        disabled={locked}
        onClick={() => onConnective(depth)}
        className={`chunky h-8 w-9 text-lg font-black leading-none ${
          locked
            ? connective === wanted.connectives[depth]
              ? 'bg-grass text-white'
              : 'bg-space-red text-white'
            : 'bg-space-blue text-white'
        }`}
        aria-label="Change this connective"
      >
        {CONNECTIVE_SYMBOL[connective]}
      </button>
      <Tree
        depth={depth + 1}
        offset={offset + width}
        span={width}
        answer={answer}
        wanted={wanted}
        onLeaf={onLeaf}
        onConnective={onConnective}
        locked={locked}
      />
      <span className="text-lg font-bold text-ink-soft">)</span>
    </span>
  )
}

/**
 * A flat row when the universe has three elements.
 *
 * A binary tree cannot hold three children, and nesting them would suggest a
 * grouping the expansion does not have — the conjunction over {a,b,c} is one
 * conjunction of three, not two of two.
 */
function FlatRow({
  answer,
  wanted,
  onLeaf,
  onConnective,
  locked,
}: {
  answer: QeFiniteAnswer
  wanted: QeFiniteAnswer
  onLeaf: (index: number) => void
  onConnective: (level: number) => void
  locked: boolean
}) {
  const connective = answer.connectives[0] ?? 'and'
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {answer.leaves.map((filled, index) => (
        <span key={index} className="inline-flex items-center gap-1">
          {index > 0 && (
            <button
              type="button"
              disabled={locked}
              onClick={() => onConnective(0)}
              className={`chunky h-8 w-9 text-lg font-black leading-none ${
                locked
                  ? connective === wanted.connectives[0]
                    ? 'bg-grass text-white'
                    : 'bg-space-red text-white'
                  : 'bg-space-blue text-white'
              }`}
              aria-label="Change the connective"
            >
              {CONNECTIVE_SYMBOL[connective]}
            </button>
          )}
          <button
            type="button"
            disabled={locked}
            onClick={() => onLeaf(index)}
            className={`tile min-w-16 px-2 py-1 font-logic text-sm font-bold ${
              filled === null
                ? 'bg-card-shade text-ink-soft'
                : locked
                  ? filled === wanted.leaves[index]
                    ? 'bg-grass text-white'
                    : 'bg-space-red text-white'
                  : 'bg-coin'
            }`}
          >
            {filled ?? '◻'}
          </button>
        </span>
      ))}
    </span>
  )
}

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<QeFiniteQuestion, QeFiniteAnswer>) {
  const wanted = useMemo(() => solve(question), [question])
  const { quantifiers } = useMemo(() => prefixOf(formulaOf(question)), [question])
  const blank = useMemo(
    (): QeFiniteAnswer => ({
      connectives: quantifiers.map(() => 'and'),
      leaves: wanted.leaves.map(() => null),
    }),
    [quantifiers, wanted],
  )
  const [answer, setAnswer] = useState<QeFiniteAnswer>(blank)

  useEffect(() => setAnswer(blank), [blank])

  const place = (text: string) => {
    if (locked) return
    setAnswer((previous) => {
      const index = previous.leaves.indexOf(null)
      if (index === -1) return previous
      const leaves = [...previous.leaves]
      leaves[index] = text
      return { ...previous, leaves }
    })
  }

  const clear = (index: number) => {
    if (locked) return
    setAnswer((previous) => {
      const leaves = [...previous.leaves]
      leaves[index] = null
      return { ...previous, leaves }
    })
  }

  const toggle = (level: number) => {
    if (locked) return
    setAnswer((previous) => {
      const connectives = [...previous.connectives]
      connectives[level] = connectives[level] === 'and' ? 'or' : 'and'
      return { ...previous, connectives }
    })
  }

  const filled = answer.leaves.filter((leaf) => leaf !== null).length
  const shown = locked ? wanted : answer

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Expand every quantifier away
      </p>

      <div className="mt-2 tile bg-card-shade px-3 py-2 text-center">
        <FoText text={question.source} className="text-lg font-bold" />
      </div>
      <p className="mt-1 text-center text-xs font-medium text-ink-soft">
        over the universe {'{'}
        {question.universe.join(', ')}
        {'}'} — each element has a constant of its own
      </p>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        The expansion — tap a connective to flip it, tap a filled hole to empty it
      </p>
      <div className="mt-1 overflow-x-auto rounded-2xl bg-card-shade px-3 py-3 text-center">
        {question.universe.length === 2 && quantifiers.length >= 1 ? (
          <Tree
            depth={0}
            offset={0}
            span={wanted.leaves.length}
            answer={shown}
            wanted={wanted}
            onLeaf={clear}
            onConnective={toggle}
            locked={locked}
          />
        ) : (
          <FlatRow
            answer={shown}
            wanted={wanted}
            onLeaf={clear}
            onConnective={toggle}
            locked={locked}
          />
        )}
      </div>

      <div className="mt-2">
        <ProgressBar value={filled} total={wanted.leaves.length} />
      </div>

      {!locked && (
        <>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Instances — they go into the holes left to right
          </p>
          <MovingList className="mt-1 flex flex-wrap gap-1.5">
            {question.bank.map((text) => (
              <MovingItem
                key={text}
                id={text}
                disabled={answer.leaves.indexOf(null) === -1}
                onClick={() => place(text)}
                className="tile bg-card px-2.5 py-1 font-logic text-sm font-bold"
              >
                {text}
              </MovingItem>
            ))}
          </MovingList>

          <Button
            variant="coin"
            className="mt-3 w-full"
            onClick={() => submit(answer)}
            disabled={filled < wanted.leaves.length}
          >
            {filled < wanted.leaves.length
              ? `Submit — ${wanted.leaves.length - filled} hole${wanted.leaves.length - filled === 1 ? '' : 's'} left`
              : 'Submit'}
          </Button>
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          Every quantifier is gone and the universe did all the work — which is why a theory with a
          finite universe always admits quantifier elimination.
        </Pop>
      )}
    </Card>
  )
}

export const qeFiniteGame = defineMinigame<QeFiniteQuestion, QeFiniteAnswer>({
  id: 'qe-finite',
  title: 'Fold The Quantifier',
  tagline: 'Turn ∀ into ∧ and ∃ into ∨ over a finite universe, one instance at a time.',
  topics: ['quantifier-elimination'],
  icon: '📐',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  questionKey: (question) => question.source,
  explain: (question) => {
    const answer = solve(question)
    return `${question.source} expands to ${answer.leaves.join(
      ` ${CONNECTIVE_SYMBOL[answer.connectives[answer.connectives.length - 1] ?? 'and']} `,
    )}, grouped by the outer quantifier.`
  },
  Screen,
  Guide: QeFiniteGuide,
})
