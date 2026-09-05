/**
 * Does the sentence hold in this structure? — ln.pdf §4.1, Definition 4.3,
 * Exercise 7 question 2, exam26a Q4.2.
 *
 * A structure fixes a universe and a meaning for every symbol, and then a
 * sentence is simply true or false. Answering by feel is possible for the small
 * ones and hopeless for the nested ones, so the board makes you do what
 * Definition 4.3 does: pick the element.
 *
 * For `∃x:φ` you name the witness. For `∀x:φ` you name the counterexample, or
 * claim there is none. Nested quantifiers are answered one layer at a time,
 * which is exactly the recursion in parts 4 and 5 of the definition.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  elementLabel,
  evaluateFormula,
  makeStructure,
  parseFormula,
  showFormula,
  type FoFormula,
  type FoSignature,
  type Structure,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { Pop, Shakeable, useShake } from '@/ui/motion'
import { FoEvaluateGuide } from './foEvaluate.guide'

/** A structure written the way an exercise writes one. */
export interface StructureSpec {
  id: string
  size: number
  /** Human-readable lines, one per symbol. */
  describe: string[]
  signature: FoSignature
}

export interface FoEvaluateQuestion {
  spec: string
  source: string
  /** Whether the sentence holds — recomputed at marking time regardless. */
  holds: boolean
}

/** The element chosen at each quantifier, outermost first. Null = "none". */
export type FoEvaluateAnswer = (number | null)[]

// ---------------------------------------------------------------------------
// The structures
// ---------------------------------------------------------------------------

const MOD4_SIGNATURE: FoSignature = {
  predicates: { p: 1, q: 1, r: 2 },
  functions: { a: 0, b: 0, f: 1, g: 1 },
}

/** Exercise 7's own structure, stated as the exercise states it. */
const MOD4 = makeStructure({
  size: 4,
  functions: {
    a: { arity: 0, value: () => 0 },
    b: { arity: 0, value: () => 1 },
    f: { arity: 1, value: ([x]) => ((x as number) === 1 ? 1 : 2) },
    g: { arity: 1, value: ([x]) => ((x as number) + 2) % 4 },
  },
  predicates: {
    p: { arity: 1, value: ([x]) => x === 0 },
    q: { arity: 1, value: ([x]) => (x as number) >= 2 },
    r: { arity: 2, value: ([x, y]) => (x as number) < (y as number) },
  },
})

const CYCLE_SIGNATURE: FoSignature = {
  predicates: { p: 1, r: 2 },
  functions: { a: 0, f: 1 },
}

const CYCLE = makeStructure({
  size: 3,
  functions: {
    a: { arity: 0, value: () => 0 },
    f: { arity: 1, value: ([x]) => ((x as number) + 1) % 3 },
  },
  predicates: {
    p: { arity: 1, value: ([x]) => x !== 0 },
    r: { arity: 2, value: ([x, y]) => ((x as number) + 1) % 3 === y },
  },
})

export const STRUCTURES: Record<string, { structure: Structure; spec: StructureSpec }> = {
  mod4: {
    structure: MOD4,
    spec: {
      id: 'mod4',
      size: 4,
      signature: MOD4_SIGNATURE,
      describe: [
        'U = {0, 1, 2, 3}',
        'a = 0, b = 1',
        'f(x) = 1 if x = 1, otherwise 2',
        'g(x) = (x + 2) mod 4',
        'p(x) iff x = 0',
        'q(x) iff x ≥ 2',
        'r(x,y) iff x < y',
      ],
    },
  },
  cycle: {
    structure: CYCLE,
    spec: {
      id: 'cycle',
      size: 3,
      signature: CYCLE_SIGNATURE,
      describe: [
        'U = {0, 1, 2}',
        'a = 0',
        'f(x) = (x + 1) mod 3',
        'p(x) iff x ≠ 0',
        'r(x,y) iff y = (x + 1) mod 3',
      ],
    },
  },
}

const SENTENCES: Record<Difficulty, { spec: string; source: string }[]> = {
  easy: [
    { spec: 'mod4', source: 'r(a(),b())' },
    { spec: 'mod4', source: '∀x:(p(x)∨q(x))' },
    { spec: 'mod4', source: '∃x:(q(x)∧¬q(g(g(x))))' },
    { spec: 'cycle', source: '∀x:p(f(x))' },
    { spec: 'cycle', source: '∃x:r(x,a())' },
  ],
  medium: [
    { spec: 'mod4', source: '∀x:(p(x)→p(g(g(x))))' },
    { spec: 'mod4', source: '∀x:(q(f(x))∨q(g(x)))' },
    { spec: 'mod4', source: '∃x:∀y:r(x,y)' },
    { spec: 'cycle', source: '∀x:∃y:r(x,y)' },
    { spec: 'cycle', source: '∃x:∀y:(r(x,y)∨p(y))' },
  ],
  hard: [
    { spec: 'mod4', source: '∃x:(p(x)∨∃y:r(x,y))' },
    { spec: 'mod4', source: '∃x:∀y:(r(x,y)∨r(g(x),y)∨r(x,g(y)))' },
    { spec: 'mod4', source: '∀x:∃y:(r(x,y)∧q(y))' },
    { spec: 'cycle', source: '∀x:∃y:(r(x,y)∧¬r(y,x))' },
    { spec: 'cycle', source: '∃x:∀y:∃z:(r(x,y)∨r(y,z))' },
  ],
}

const structureOf = (question: FoEvaluateQuestion): Structure =>
  (STRUCTURES[question.spec] as { structure: Structure }).structure

const specOf = (question: FoEvaluateQuestion): StructureSpec =>
  (STRUCTURES[question.spec] as { spec: StructureSpec }).spec

export const formulaOf = (question: FoEvaluateQuestion): FoFormula =>
  parseFormula(question.source, specOf(question).signature)

/** The quantifier prefix, outermost first — the layers you have to answer. */
export function prefixOf(formula: FoFormula): { quantifier: 'forall' | 'exists'; variable: string }[] {
  const layers: { quantifier: 'forall' | 'exists'; variable: string }[] = []
  let node = formula
  while (node.kind === 'quantified') {
    layers.push({ quantifier: node.quantifier, variable: node.variable })
    node = node.body
  }
  return layers
}

const bodyOf = (formula: FoFormula): FoFormula => {
  let node = formula
  while (node.kind === 'quantified') node = node.body
  return node
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function generate({ rng, difficulty }: GenerateContext): FoEvaluateQuestion {
  // Draw the verdict first, so both answers come up.
  const wanted = rng.bool()
  for (const entry of rng.shuffle(SENTENCES[difficulty])) {
    const question = { ...entry, holds: false }
    const holds = evaluateFormula(structureOf(question), {}, formulaOf(question))
    if (holds !== wanted) continue
    return { ...entry, holds }
  }
  const fallback = SENTENCES[difficulty][0] as { spec: string; source: string }
  const question = { ...fallback, holds: false }
  return {
    ...fallback,
    holds: evaluateFormula(structureOf(question), {}, formulaOf(question)),
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

/**
 * Play the prefix out, layer by layer.
 *
 * At each layer the choice means the opposite thing depending on the
 * quantifier: for ∃ it is the witness that must make the rest true, for ∀ it is
 * the counterexample that must make the rest false. `null` claims there is no
 * such element, which settles that layer the other way.
 */
export function judge(
  structure: Structure,
  formula: FoFormula,
  choices: readonly (number | null)[],
): { ok: boolean; holds: boolean; reason: string } {
  const layers = prefixOf(formula)
  const env: Record<string, number> = {}

  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index] as { quantifier: 'forall' | 'exists'; variable: string }
    const rest = restFrom(formula, index)
    const choice = choices[index]

    if (choice === undefined) {
      return { ok: false, holds: false, reason: 'Nothing chosen at one of the quantifiers.' }
    }

    if (choice === null) {
      // "No such element" — true exactly when every element fails the test.
      const anySuch = someElement(structure, env, layer, rest)
      if (anySuch !== null) {
        return {
          ok: false,
          holds: false,
          reason:
            layer.quantifier === 'exists'
              ? `${layer.variable} = ${elementLabel(structure, anySuch)} does make the rest true.`
              : `${layer.variable} = ${elementLabel(structure, anySuch)} does make the rest false.`,
        }
      }
      return {
        ok: true,
        holds: layer.quantifier === 'forall',
        reason:
          layer.quantifier === 'exists'
            ? 'No element makes the rest true, so the ∃ fails.'
            : 'No element makes the rest false, so the ∀ holds.',
      }
    }

    const holdsHere = evaluateFormula(structure, { ...env, [layer.variable]: choice }, rest)
    const wanted = layer.quantifier === 'exists'
    if (holdsHere !== wanted) {
      return {
        ok: false,
        holds: false,
        reason:
          layer.quantifier === 'exists'
            ? `${layer.variable} = ${elementLabel(structure, choice)} does not make the rest true.`
            : `${layer.variable} = ${elementLabel(structure, choice)} does not make the rest false.`,
      }
    }
    env[layer.variable] = choice
  }

  const inner = evaluateFormula(structure, env, bodyOf(formula))
  return {
    ok: layers.length > 0 || true,
    holds: layers.length === 0 ? inner : evaluateFormula(structure, {}, formula),
    reason: '',
  }
}

/** The formula from layer `index` inwards, quantifiers included. */
function restFrom(formula: FoFormula, index: number): FoFormula {
  let node = formula
  for (let count = 0; count <= index; count++) {
    if (node.kind !== 'quantified') return node
    node = node.body
  }
  return node
}

/** An element that witnesses (∃) or breaks (∀) the rest, or null. */
function someElement(
  structure: Structure,
  env: Record<string, number>,
  layer: { quantifier: 'forall' | 'exists'; variable: string },
  rest: FoFormula,
): number | null {
  for (let element = 0; element < structure.size; element++) {
    const holds = evaluateFormula(structure, { ...env, [layer.variable]: element }, rest)
    if (layer.quantifier === 'exists' && holds) return element
    if (layer.quantifier === 'forall' && !holds) return element
  }
  return null
}

function solve(question: FoEvaluateQuestion): FoEvaluateAnswer {
  const structure = structureOf(question)
  const formula = formulaOf(question)
  const layers = prefixOf(formula)
  const choices: (number | null)[] = []
  const env: Record<string, number> = {}

  // A quantifier-free sentence has no layer to play, so the answer is the one
  // bit the board asks for directly.
  if (layers.length === 0) return [evaluateFormula(structure, {}, formula) ? 1 : 0]

  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index] as { quantifier: 'forall' | 'exists'; variable: string }
    const rest = restFrom(formula, index)
    const found = someElement(structure, env, layer, rest)
    choices.push(found)
    if (found === null) break
    env[layer.variable] = found
  }
  return choices
}

function check(question: FoEvaluateQuestion, answer: FoEvaluateAnswer): Verdict {
  const structure = structureOf(question)
  const formula = formulaOf(question)
  const layers = prefixOf(formula)
  const truth = evaluateFormula(structure, {}, formula)

  if (layers.length === 0) {
    // No quantifier: the only thing to say is whether it holds.
    const claimed = answer[0] === 1
    return claimed === truth
      ? {
          correct: true,
          message: truth ? 'It holds' : 'It fails',
          detail: 'A quantifier-free sentence is settled by evaluating its terms.',
        }
      : {
          correct: false,
          message: 'Not what the structure says',
          detail: 'Work the terms out first, then read the predicate off its table.',
        }
  }

  const result = judge(structure, formula, answer)
  if (!result.ok) {
    return {
      correct: false,
      // Names the choice that failed, never the one that works.
      message: 'That choice does not do it',
      detail: result.reason,
      score: 0.2,
    }
  }

  return {
    correct: true,
    message: truth ? 'It holds' : 'It fails',
    detail:
      result.reason === ''
        ? 'Every layer answered, and each choice really does what its quantifier needs.'
        : result.reason,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<FoEvaluateQuestion, FoEvaluateAnswer>) {
  const structure = structureOf(question)
  const spec = specOf(question)
  const formula = useMemo(() => formulaOf(question), [question])
  const layers = useMemo(() => prefixOf(formula), [formula])

  const [choices, setChoices] = useState<(number | null)[]>([])
  const [shaking, shake] = useShake()

  useEffect(() => {
    setChoices([])
  }, [question])

  const env: Record<string, number> = {}
  let depth = 0
  for (const layer of layers) {
    const choice = choices[depth]
    if (choice === undefined || choice === null) break
    env[layer.variable] = choice
    depth++
  }

  const ready =
    layers.length === 0
      ? choices[0] !== undefined
      : choices.length > 0 && (choices[choices.length - 1] === null || choices.length === layers.length)

  const set = (index: number, value: number | null) => {
    if (locked) return
    setChoices((previous) => [...previous.slice(0, index), value])
  }

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Does it hold in this structure?
      </p>

      <div className="tile mt-2 bg-card-shade px-3 py-2">
        <FoText formula={formula} className="text-lg font-bold" />
      </div>

      <ul className="mt-2 flex flex-col gap-0.5 text-xs font-semibold text-ink-soft">
        {spec.describe.map((line) => (
          <li key={line} className="formula">
            {line}
          </li>
        ))}
      </ul>

      <Shakeable shaking={shaking}>
        <div className="mt-3 flex flex-col gap-3">
          {layers.map((layer, index) => {
            const open = index <= depth
            const rest = restFrom(formula, index)
            return (
              <div key={index} className={open ? '' : 'opacity-40'}>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {layer.quantifier === 'exists'
                    ? `Pick the ${layer.variable} that makes the rest true`
                    : `Pick the ${layer.variable} that makes the rest false`}
                </p>
                <p className="mt-0.5">
                  <FoText formula={rest} className="text-sm font-bold" />
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Array.from({ length: structure.size }, (_, element) => (
                    <button
                      key={element}
                      type="button"
                      disabled={locked || !open}
                      onClick={() => set(index, element)}
                      className={`chunky min-h-10 px-3 text-sm font-bold
                        focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                        ${
                          choices[index] === element
                            ? 'bg-space-blue text-white'
                            : 'bg-card text-ink hover:bg-card-shade'
                        }`}
                    >
                      {elementLabel(structure, element)}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={locked || !open}
                    onClick={() => set(index, null)}
                    className={`chunky min-h-10 px-3 text-sm font-bold
                      focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                      ${choices[index] === null ? 'bg-space-red text-white' : 'bg-card text-ink hover:bg-card-shade'}`}
                  >
                    {layer.quantifier === 'exists' ? 'none works' : 'none breaks it'}
                  </button>
                </div>
              </div>
            )
          })}

          {layers.length === 0 && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={choices[0] === 1 ? 'primary' : 'secondary'}
                onClick={() => set(0, 1)}
              >
                It holds
              </Button>
              <Button
                variant={choices[0] === 0 ? 'primary' : 'secondary'}
                onClick={() => set(0, 0)}
              >
                It fails
              </Button>
            </div>
          )}
        </div>
      </Shakeable>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">In this structure</p>
          <p className="mt-1 font-bold">
            {showFormula(formula)} is{' '}
            {evaluateFormula(structure, {}, formula) ? 'true' : 'false'}.
          </p>
        </Pop>
      )}

      {!locked && (
        <Button
          variant={ready ? 'coin' : 'secondary'}
          className="mt-3 w-full"
          onClick={() => {
            if (!ready) return shake()
            submit(choices)
          }}
        >
          {ready ? 'Submit' : 'Submit — a layer is unanswered'}
        </Button>
      )}
    </Card>
  )
}

export const foEvaluateGame = defineMinigame<FoEvaluateQuestion, FoEvaluateAnswer>({
  id: 'fo-evaluate',
  title: 'Name The Element',
  tagline: 'A witness for ∃, a counterexample for ∀ — or say there is none.',
  topics: ['fo-syntax'],
  icon: '🎯',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: FoEvaluateGuide,
  questionKey: (question) => `${question.spec}|${question.source}`,
})
