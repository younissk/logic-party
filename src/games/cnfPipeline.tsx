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
 * So the game asks the one thing that matters — *which move is next* — on a
 * formula caught at a random point mid-pipeline. Never improvise; scan the
 * ladder top to bottom and take the first rung that fires.
 */

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
import { CnfPipelineGuide } from './cnfPipeline.guide'

export interface CnfPipelineQuestion {
  /** A formula caught somewhere along the pipeline, possibly at the start. */
  formula: Formula
}

export type CnfPipelineAnswer = CnfStep

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
  // Draw the answer first, then look for a formula that has it. Sampling
  // formulas and taking whatever step falls out would bury 'clean' and 'done',
  // which only ever appear at the very end of a run.
  const target = rng.pick(CNF_STEPS)

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
    return { formula: rng.pick(candidates) }
  }

  // Last resort, so a round can never stall: the worked example from the
  // notes, which starts at step 1.
  return {
    formula: {
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
    },
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: CnfPipelineQuestion): CnfPipelineAnswer => nextCnfStep(question.formula)

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
  return `Becomes ${format(after)}${grew > 0 ? ` — ${grew} nodes bigger` : ''}. Next: ${CNF_STEP_LABELS[nextCnfStep(after)].toLowerCase()}.`
}

function check(question: CnfPipelineQuestion, answer: CnfPipelineAnswer): Verdict {
  const truth = solve(question)

  if (answer === truth) {
    return { correct: true, message: CNF_STEP_LABELS[truth], detail: outcome(question.formula) }
  }

  // Say what is wrong with the move that was picked, never which move is
  // right: in sprint this message is the only feedback before the retry.
  const reasons: Record<CnfStep, string> = {
    iff: 'there is no ↔ left to eliminate',
    implies: 'either a ↔ still has to go first, or there is no → left',
    nnf: 'either ↔ or → still has to go first, or every ¬ already sits on a variable',
    distribute: 'something earlier in the ladder still applies, or it is already CNF',
    clean: 'it is not in CNF yet, or there is nothing left to drop',
    done: 'this is not CNF yet',
  }

  return {
    correct: false,
    message: `Not “${CNF_STEP_LABELS[answer]}”`,
    detail: `${CNF_STEP_LABELS[answer]} does not apply here — ${reasons[answer]}. The move is ${
      CNF_STEP_LABELS[truth]
    }: ${outcome(question.formula)}`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/** Which rung of the ladder each move sits on, shown as a running number. */
const STEP_ORDER: Readonly<Record<CnfStep, string>> = {
  iff: '1',
  implies: '2',
  nnf: '3',
  distribute: '4',
  clean: '5',
  done: '✓',
}

function Screen({ question, submit, locked, solution }: MinigameScreenProps<CnfPipelineQuestion, CnfPipelineAnswer>) {
  const printed = format(question.formula)
  const formulaSize = printed.length > 52 ? 'text-base' : printed.length > 34 ? 'text-lg' : 'text-xl'

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        What is the next move?
      </p>
      <p className={`mt-1 leading-snug font-semibold text-balance text-ink ${formulaSize}`}>
        <FormulaText formula={question.formula} />
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {CNF_STEPS.map((step) => {
          const isAnswer = locked && solution === step
          return (
            <Button
              key={step}
              variant={isAnswer ? 'primary' : 'secondary'}
              disabled={locked}
              onClick={() => submit(step)}
              className={`w-full items-start gap-3 py-2.5 text-left
                ${isAnswer ? 'revealed' : ''} ${locked && !isAnswer ? 'opacity-50' : ''}`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
                  ${isAnswer ? 'bg-white/25 text-white' : 'bg-card-shade text-ink-soft'}`}
              >
                {STEP_ORDER[step]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] font-bold">{CNF_STEP_LABELS[step]}</span>
                <span className="formula block text-xs font-medium opacity-80">
                  {CNF_STEP_RULES[step]}
                </span>
              </span>
            </Button>
          )
        })}
      </div>

      <p className="mt-3 text-xs font-medium text-ink-soft">
        Scan top to bottom and take the first rung that applies. The order is the algorithm — doing
        4 before 3 leaves a negated conjunction inside a clause.
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
  sprintPenaltySeconds: 10,
  generate,
  check,
  solve,
  Screen,
  Guide: CnfPipelineGuide,
  questionKey: (question) => format(question.formula),
})
