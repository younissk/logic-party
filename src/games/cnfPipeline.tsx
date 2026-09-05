/**
 * Naive CNF transformation — ln.pdf §2.2, Example 2.16, laws from Example 2.12.
 *
 * The transformation is a fixed four-step pipeline and the order is not a
 * preference:
 *
 *   1. ↔   φ ↔ ψ  ⟹  (φ → ψ) ∧ (ψ → φ)
 *   2. →   φ → ψ  ⟹  ¬φ ∨ ψ
 *   3. ¬   De Morgan, and drop double negations
 *   4. ∨/∧ (φ ∧ ψ) ∨ χ  ⟹  (φ ∨ χ) ∧ (ψ ∨ χ)
 *
 * then a cleanup pass. Doing them out of order is the standard way to lose the
 * marks: distribute before the negations are in and you end up with ¬(a ∧ b)
 * sitting inside something you are calling a clause.
 *
 * So you drive it. Tap a rule and it applies to the whole formula in front of
 * you, all the way from the starting formula down to CNF. A rule that does not
 * apply does nothing and says so, which is exactly what happens on paper when
 * you try to distribute before the negations are in.
 *
 * What is graded is the route: reaching CNF with no wasted taps. Scan the
 * ladder top to bottom and take the first rung that fires.
 */

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { Formula } from '@/logic'
import {
  CNF_STEPS,
  CNF_STEP_LABELS,
  CNF_STEP_RULES,
  applyCnfStep,
  clauses,
  cnfPipeline,
  format,
  isCNF,
  nextCnfStep,
  randomFormula,
  size,
  type CnfStep,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FormulaText } from '@/ui/FormulaText'
import { Pop, ProgressBar, SNAP, Shakeable, useShake } from '@/ui/motion'
import { CnfPipelineGuide } from './cnfPipeline.guide'

export interface CnfPipelineQuestion {
  /** A formula caught somewhere along the pipeline, possibly at the start. */
  formula: Formula
  /** Moves the shortest route takes — the par to match. */
  par: number
}

/** Every rule tapped, in order, including the ones that did nothing. */
export type CnfPipelineAnswer = CnfStep[]

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface Profile {
  variables: string[]
  depth: number
  maxSize: number
}

export const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b'], depth: 3, maxSize: 16 },
  medium: { variables: ['a', 'b', 'c'], depth: 4, maxSize: 28 },
  hard: { variables: ['a', 'b', 'c'], depth: 5, maxSize: 44 },
}

const ATTEMPTS = 120

/**
 * Every formula a full run passes through, including the one you started with.
 *
 * Catching the pipeline mid-run is what makes the questions realistic: these
 * are exactly the shapes that appear on your own page halfway through the
 * working, not formulas invented to have a particular answer.
 */
function stages(formula: Formula): Formula[] {
  return [formula, ...cnfPipeline(formula).map((entry) => entry.result)]
}

function generate({ rng, difficulty }: GenerateContext): CnfPipelineQuestion {
  const profile = PROFILES[difficulty]
  // Draw the first move, then look for a formula that needs it. Sampling
  // formulas and taking whatever fell out would bury 'clean', which only ever
  // appears at the very end of a run. 'done' is not a starting point: a
  // formula already in CNF has nothing to drive.
  const target = rng.pick(CNF_STEPS.filter((step) => step !== 'done'))

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const source = randomFormula(rng, {
      variables: profile.variables,
      depth: rng.range(2, profile.depth),
      connectives: ['not', 'and', 'or', 'implies', 'iff'],
      minDistinctVariables: 2,
    })

    let candidates: Formula[]
    try {
      candidates = stages(source).filter(
        (stage) => nextCnfStep(stage) === target && size(stage) <= profile.maxSize,
      )
    } catch {
      // Distribution blew past the size guard. That formula was too big to be
      // a question anyway.
      continue
    }

    if (candidates.length === 0) continue
    const formula = rng.pick(candidates)
    const par = cnfPipeline(formula).length
    if (par === 0) continue
    return { formula, par }
  }

  // Last resort, so a round can never stall: the worked example from the
  // notes, which starts at step 1.
  const fallback: Formula = {
      kind: 'or',
      left: {
        kind: 'not',
        arg: {
          kind: 'implies',
          left: { kind: 'iff', left: { kind: 'var', name: 'a' }, right: { kind: 'var', name: 'b' } },
          right: { kind: 'var', name: 'c' },
        },
      },
    right: { kind: 'and', left: { kind: 'var', name: 'a' }, right: { kind: 'var', name: 'c' } },
  }
  return { formula: fallback, par: cnfPipeline(fallback).length }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: CnfPipelineQuestion): CnfPipelineAnswer =>
  cnfPipeline(question.formula).map((entry) => entry.step)

/** What the correct move does to this formula, in the terms that matter. */
export function outcome(formula: Formula): string {
  const step = nextCnfStep(formula)
  if (step === 'done') {
    return `Every conjunct is already a disjunction of literals — ${clauses(formula).length} clause${
      clauses(formula).length === 1 ? '' : 's'
    }, nothing left to do.`
  }

  const after = applyCnfStep(formula, step)
  const grew = size(after) - size(formula)

  if (step === 'distribute') {
    return `Becomes ${format(after)} — ${clauses(after).length} clauses, and the formula grew by ${grew} nodes. This is the only step that can explode.`
  }
  if (step === 'clean') {
    const before = clauses(formula).length
    return `Becomes ${format(after)} — ${before} clauses down to ${isCNF(after) ? clauses(after).length : 0}.`
  }
  return `Becomes ${format(after)}${grew > 0 ? ` — ${grew} nodes bigger` : ''}.`
}

/** Replay a route, reporting where it got to and how many taps did nothing. */
export function drive(
  formula: Formula,
  moves: readonly CnfStep[],
): { result: Formula; wasted: number } {
  let current = formula
  let wasted = 0
  for (const move of moves) {
    if (move === 'done') continue
    if (move !== nextCnfStep(current)) {
      // Out of order is a no-op, exactly as it is on paper: distributing
      // before the negations are in leaves ¬(a ∧ b) inside a clause.
      wasted++
      continue
    }
    current = applyCnfStep(current, move)
  }
  return { result: current, wasted }
}

function check(question: CnfPipelineQuestion, answer: CnfPipelineAnswer): Verdict {
  const { result, wasted } = drive(question.formula, answer)

  if (nextCnfStep(result) !== 'done') {
    return {
      correct: false,
      // Never names the move that was due: sprint shows this before the retry.
      message: 'Not CNF yet',
      detail: `${format(result)} is where you stopped. Keep going: the ladder ends when every conjunct is a disjunction of literals and nothing is left to drop.`,
      score: Math.max(0, (question.par - cnfPipeline(result).length) / question.par),
    }
  }

  if (wasted > 0) {
    return {
      correct: false,
      message: `${wasted} tap${wasted === 1 ? '' : 's'} did nothing`,
      detail: `You got there, but the order is the algorithm: a rule applied out of turn changes nothing at all. Par is ${question.par} moves.`,
      score: question.par / (question.par + wasted),
    }
  }

  return {
    correct: true,
    message: `CNF in ${question.par}`,
    detail: `${clauses(result).length} clause${clauses(result).length === 1 ? '' : 's'}. Straight down the ladder, nothing wasted.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<CnfPipelineQuestion, CnfPipelineAnswer>) {
  const [moves, setMoves] = useState<CnfStep[]>([])
  const [refused, setRefused] = useState<CnfStep | null>(null)
  const [shaking, shake] = useShake()

  useEffect(() => {
    setMoves([])
    setRefused(null)
  }, [question])

  const { result, wasted } = useMemo(() => drive(question.formula, moves), [question, moves])
  const done = nextCnfStep(result) === 'done'

  const tap = (step: CnfStep) => {
    if (locked || done) return
    setMoves((previous) => [...previous, step])
    if (step !== nextCnfStep(result)) {
      setRefused(step)
      shake()
      return
    }
    setRefused(null)
  }

  const printed = format(result)
  const scale = printed.length > 64 ? 'text-sm' : printed.length > 40 ? 'text-base' : 'text-lg'

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Drive it to CNF
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {moves.length - wasted} of {question.par}
          {wasted > 0 && ` · ${wasted} wasted`}
        </p>
      </div>

      <Shakeable shaking={shaking}>
        <motion.p
          key={printed}
          initial={{ opacity: 0.4, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SNAP}
          className={`tile mt-2 bg-card-shade px-3 py-3 leading-snug font-semibold text-balance ${scale}`}
        >
          <FormulaText formula={result} />
        </motion.p>
      </Shakeable>

      <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs font-semibold text-ink-soft">
        <span>{size(result)} nodes</span>
        {isCNF(result) && <span>{clauses(result).length} clauses</span>}
      </p>

      <div className="mt-2">
        <ProgressBar value={moves.length - wasted} total={question.par} />
      </div>

      {refused !== null && !locked && (
        <Pop className="tile mt-2 bg-coin px-3 py-2">
          <p className="text-sm font-bold">{CNF_STEP_LABELS[refused]} does nothing here</p>
          <p className="mt-0.5 text-xs font-medium">
            A rule applied out of turn changes nothing at all — which is why the order is the
            algorithm and not a preference.
          </p>
        </Pop>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {CNF_STEPS.filter((step) => step !== 'done').map((step, index) => (
          <Button
            key={step}
            variant="secondary"
            disabled={locked || done}
            onClick={() => tap(step)}
            className="w-full items-start gap-3 py-2.5 text-left"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card-shade text-xs font-bold text-ink-soft">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.95rem] font-bold">{CNF_STEP_LABELS[step]}</span>
              <span className="formula block text-xs font-medium opacity-80">
                {CNF_STEP_RULES[step]}
              </span>
            </span>
          </Button>
        ))}
      </div>

      {!locked && (
        <Button
          variant={done ? 'coin' : 'secondary'}
          className="mt-3 w-full"
          disabled={!done}
          onClick={() => submit(moves)}
        >
          {done ? 'Done — this is CNF' : 'Keep going'}
        </Button>
      )}

      <p className="mt-3 text-xs font-medium text-ink-soft">
        Scan top to bottom and take the first rung that applies. Doing 4 before 3 leaves a negated
        conjunction inside a clause.
      </p>
    </Card>
  )
}

export const cnfPipelineGame = defineMinigame<CnfPipelineQuestion, CnfPipelineAnswer>({
  id: 'cnf-pipeline',
  title: 'CNF Assembly Line',
  tagline: 'Drive the transformation, one move at a time.',
  topics: ['normal-forms'],
  icon: '🏭',
  roundSeconds: 120,
  sprintQuestions: 10,
  // Six options, and sprint will not move on until you are right, so the
  // default five seconds would make guessing cheaper than reading the formula.
  generate,
  check,
  solve,
  Screen,
  Guide: CnfPipelineGuide,
  questionKey: (question) => format(question.formula),
})
