/**
 * Tseitin transformation — ln.pdf §2.2, Algorithm 2.19, Exercise 2.
 *
 * The framing is a chip shop, because that is genuinely what this is. Every
 * subformula is a gate; Tseitin bolts a labelled wire onto each gate and
 * writes down the wire's spec — what has to be true for the wire to be high,
 * and what the wire being high forces. Do that for ten million gates and you
 * have a SAT problem instead of a circuit. Distribute instead and you have
 * 2¹⁰⁰⁰⁰⁰⁰⁰ clauses and no computer.
 *
 * The exercise is: given one gate's definition t ↔ χ, wire it — build the
 * clauses. That is where the marks actually go, because the trap is polarity.
 * (a ∨ ¬z) is right and (¬a ∨ z) is wrong, and no amount of remembering the
 * table helps if you cannot derive it.
 *
 * Marking is semantic: whatever clauses you build are checked against t ↔ χ
 * itself. Any correct encoding passes, in any order, so the game marks
 * understanding rather than recall of one particular row.
 */

import { useEffect, useState } from 'react'
import type { Clause, Formula, Literal } from '@/logic'
import {
  clauseSetToFormula,
  clauses as clausesOf,
  definitionClauses,
  findDistinguishingAssignment,
  format,
  iff,
  isEquivalent,
  not,
  randomFormula,
  showAssignment,
  showClause,
  size,
  sortedVariables,
  tseitin,
  v,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FormulaText } from '@/ui/FormulaText'
import { TseitinGuide } from './tseitin.guide'

export interface TseitinQuestion {
  /** The whole formula being encoded — context, so the gate is not abstract. */
  source: Formula
  /** The fresh variable being defined. */
  name: string
  /** What it names: a connective over literals. */
  body: Formula
  /** Which gate of the run this is, and how many there are. */
  index: number
  gates: number
  /** Literals the player can wire, in a stable order. */
  palette: Literal[]
  /** How many clauses the definition takes. */
  clauseCount: number
}

/** One clause per slot; a slot holds the literals dropped into it. */
export type TseitinAnswer = Literal[][]

const literalKey = (literal: Literal): string => `${literal.negated ? '¬' : ''}${literal.name}`

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  variables: string[]
  depth: number
  connectives: ('not' | 'and' | 'or' | 'implies' | 'iff')[]
  /** Connectives a definition body is allowed to use. */
  bodies: Formula['kind'][]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    variables: ['x', 'y', 'z'],
    depth: 3,
    connectives: ['not', 'and', 'or'],
    bodies: ['and', 'or'],
  },
  medium: {
    variables: ['x', 'y', 'z'],
    depth: 4,
    connectives: ['not', 'and', 'or', 'implies'],
    bodies: ['and', 'or', 'implies'],
  },
  hard: {
    variables: ['x', 'y', 'z'],
    depth: 4,
    connectives: ['not', 'and', 'or', 'implies', 'iff'],
    bodies: ['and', 'or', 'implies', 'iff'],
  },
}

const ATTEMPTS = 200

/**
 * The literals on offer.
 *
 * Both polarities of everything the definition mentions, and nothing else.
 * Offering only the signs that appear in the answer would give the trap away —
 * picking the sign *is* the exercise.
 */
function paletteFor(name: string, body: Formula): Literal[] {
  const names = [name, ...sortedVariables(body)]
  const unique = [...new Set(names)]
  return unique.flatMap((variable) => [
    { name: variable, negated: false },
    { name: variable, negated: true },
  ])
}

function generate({ rng, difficulty }: GenerateContext): TseitinQuestion {
  const profile = PROFILES[difficulty]

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const source = randomFormula(rng, {
      variables: profile.variables,
      depth: rng.range(3, profile.depth),
      connectives: profile.connectives,
      minDistinctVariables: 2,
    })

    // A formula already in CNF has no gates to name.
    let run: ReturnType<typeof tseitin>
    try {
      run = tseitin(source)
    } catch {
      continue
    }
    if (run.definitions.length === 0) continue
    if (size(source) > 26) continue

    const usable = run.definitions.filter((definition) =>
      profile.bodies.includes(definition.formula.kind),
    )
    if (usable.length === 0) continue

    const definition = rng.pick(usable)
    const index = run.definitions.indexOf(definition)

    return {
      source,
      name: definition.name,
      body: definition.formula,
      index,
      gates: run.definitions.length,
      palette: paletteFor(definition.name, definition.formula),
      clauseCount: definition.clauses.length,
    }
  }

  // Last resort, so a round can never stall: the exercise's own first gate.
  const body: Formula = { kind: 'or', left: v('z'), right: v('x') }
  return {
    source: { kind: 'or', left: v('x'), right: not({ kind: 'or', left: v('y'), right: not(body) }) },
    name: 't1',
    body,
    index: 0,
    gates: 2,
    palette: paletteFor('t1', body),
    clauseCount: 3,
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: TseitinQuestion): TseitinAnswer =>
  definitionClauses(question.name, question.body).map((clause) => [...clause])

/** What the definition says, as a formula: t ↔ χ. */
export const definitionFormula = (question: TseitinQuestion): Formula =>
  iff(v(question.name), question.body)

function check(question: TseitinQuestion, answer: TseitinAnswer): Verdict {
  const filled = answer.filter((clause) => clause.length > 0)
  if (filled.length !== question.clauseCount) {
    return { correct: false, message: 'Every clause needs at least one literal' }
  }

  const built = clauseSetToFormula(filled as Clause[])
  const target = definitionFormula(question)

  // Semantic, not syntactic: the clause table is one correct encoding of
  // t ↔ χ, not the only one, and marking against the table would fail a
  // student who wrote an equally correct set in a different order or shape.
  if (isEquivalent(built, target)) {
    return {
      correct: true,
      message: 'Wired correctly',
      detail: `${showClause(solve(question)[0] as Clause)} and the rest — ${question.clauseCount} clauses for one gate, however big the formula gets. That constant is why Tseitin is linear.`,
    }
  }

  // Where the wiring and the definition disagree. On a polarity mistake this
  // is precisely the row that exposes the flipped sign.
  const witness = findDistinguishingAssignment(built, target)

  return {
    correct: false,
    message: 'That is not what the gate says',
    detail: `Your clauses and ${format(target)} disagree at ${
      witness === null ? 'some assignment' : showAssignment(witness)
    }. Derive each clause from the definition rather than recalling it: t ↔ χ means both directions, so you need one clause saying "if t then χ" and one per part saying "if that part then t".`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function LiteralChip({
  literal,
  onClick,
  disabled,
  tone,
}: {
  literal: Literal
  onClick?: () => void
  disabled?: boolean
  tone: 'palette' | 'slot'
}) {
  const isFresh = literal.name.startsWith('t')
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`chunky formula h-10 px-3 text-base font-bold
        focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
        ${
          tone === 'slot'
            ? 'bg-space-blue text-white'
            : isFresh
              ? 'bg-plum text-white'
              : 'bg-card text-ink hover:bg-card-shade'
        }`}
    >
      {literal.negated ? '¬' : ''}
      {literal.name}
    </button>
  )
}

function Screen({ question, submit, locked, verdict, solution }: MinigameScreenProps<TseitinQuestion, TseitinAnswer>) {
  const [slots, setSlots] = useState<Literal[][]>(() =>
    Array.from({ length: question.clauseCount }, () => []),
  )
  const [active, setActive] = useState(0)

  useEffect(() => {
    setSlots(Array.from({ length: question.clauseCount }, () => []))
    setActive(0)
  }, [question])

  const filled = slots.filter((slot) => slot.length > 0).length
  const ready = filled === question.clauseCount

  const add = (literal: Literal) => {
    if (locked) return
    setSlots((previous) =>
      previous.map((slot, index) => {
        if (index !== active) return slot
        if (slot.some((existing) => literalKey(existing) === literalKey(literal))) return slot
        return [...slot, literal]
      }),
    )
  }

  const removeFrom = (slotIndex: number, literal: Literal) => {
    if (locked) return
    setSlots((previous) =>
      previous.map((slot, index) =>
        index === slotIndex ? slot.filter((existing) => literalKey(existing) !== literalKey(literal)) : slot,
      ),
    )
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">Wire the gate</p>
        <p className="text-xs font-bold text-ink-soft">
          gate {question.index + 1} of {question.gates}
        </p>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        Encoding <FormulaText formula={question.source} />
      </p>

      <div className="tile mt-3 bg-plum px-3 py-2 text-center">
        <p className="formula text-2xl font-bold text-white">
          {question.name} ↔ {format(question.body)}
        </p>
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        {question.clauseCount} clauses
        {locked && verdict !== null && !verdict.correct && ' · one correct wiring in red'}
      </p>

      <div className="mt-1 flex flex-col gap-2">
        {slots.map((slot, index) => {
          // Only ever shown alongside a wrong answer. Marking is semantic, so a
          // correct wiring can legitimately differ from this one clause for
          // clause — printing it next to a correct answer reads as a
          // correction of something that was right.
          const expected = locked && verdict !== null && !verdict.correct ? solution?.[index] : undefined
          return (
            <button
              key={index}
              type="button"
              onClick={() => !locked && setActive(index)}
              disabled={locked}
              className={`tile flex min-h-13 w-full flex-wrap items-center gap-1.5 px-2 py-1.5 text-left
                ${locked ? 'bg-card-shade' : active === index ? 'bg-coin' : 'bg-card'}`}
            >
              <span className="formula text-lg font-bold text-ink-soft">(</span>
              {slot.length === 0 && !locked && (
                <span className="text-sm font-semibold text-ink-soft">
                  {active === index ? 'tap literals below' : 'empty'}
                </span>
              )}
              {slot.map((literal, literalIndex) => (
                <span key={literalKey(literal)} className="flex items-center gap-1.5">
                  {literalIndex > 0 && <span className="formula font-bold">∨</span>}
                  <LiteralChip
                    literal={literal}
                    tone="slot"
                    disabled={locked}
                    onClick={() => removeFrom(index, literal)}
                  />
                </span>
              ))}
              <span className="formula text-lg font-bold text-ink-soft">)</span>
              {expected !== undefined && (
                <span className="formula ml-auto whitespace-nowrap text-sm font-bold text-space-red">
                  {showClause(expected as Clause)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!locked && (
        <>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Literals — tap to add, tap again in a clause to remove
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {question.palette.map((literal) => (
              <LiteralChip key={literalKey(literal)} literal={literal} tone="palette" onClick={() => add(literal)} />
            ))}
          </div>

          <Button
            variant="coin"
            className="mt-4 w-full"
            disabled={!ready}
            onClick={() => submit(slots)}
          >
            {ready
              ? 'Ship it'
              : `${question.clauseCount - filled} clause${question.clauseCount - filled === 1 ? '' : 's'} still empty`}
          </Button>
        </>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------

export const tseitinGame = defineMinigame<TseitinQuestion, TseitinAnswer>({
  id: 'tseitin',
  title: 'Chip Shop',
  tagline: 'Name the gate, wire its clauses.',
  topics: ['normal-forms'],
  icon: '🔌',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: TseitinGuide,
  questionKey: (question) => `${question.name}:${format(question.body)}`,
})

/** Exported for the guide, so the blowup comparison is counted rather than claimed. */
export function clauseComparison(formula: Formula): { naive: number; tseitin: number } {
  return { naive: clausesOf(formula).length, tseitin: tseitin(formula).clauses.length }
}
