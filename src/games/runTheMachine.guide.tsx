/**
 * Automata, and why they decide T(ℕ,=,+).
 *
 * The runs are produced by `trace` and the sums are read back by `tripleOf` —
 * the same functions the game uses — so every table here is a run rather than
 * a description of one.
 */

import {
  ADDITION_AUTOMATON,
  INTEGER_LITERAL,
  accepts,
  acceptsString,
  chunk,
  fromReversedBinary,
  toReversedBinary,
  trace,
  tripleOf,
  tripleWord,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'

const LITERALS = ['107', '-5014', '007', '+0', '0']

const SUMS: readonly [number, number, number][] = [
  [3, 5, 8],
  [3, 5, 9],
  [1, 1, 2],
]

function LiteralTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1">word</th>
            <th className="px-2 py-1">run</th>
            <th className="px-2 py-1">accepted</th>
          </tr>
        </thead>
        <tbody>
          {LITERALS.map((word) => {
            const steps = trace(INTEGER_LITERAL, [...word])
            return (
              <tr key={word}>
                <td className="px-2 py-1 font-logic font-bold">{word}</td>
                <td className="px-2 py-1 font-logic text-xs">
                  {steps.map((step) => step.states.join('|') || '✗').join(' → ')}
                </td>
                <td className="px-2 py-1 font-bold">
                  {acceptsString(INTEGER_LITERAL, word) ? 'yes' : 'no'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AdditionTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1">claim</th>
            <th className="px-2 py-1">word</th>
            <th className="px-2 py-1">run</th>
            <th className="px-2 py-1">accepted</th>
          </tr>
        </thead>
        <tbody>
          {SUMS.map(([x, y, sum]) => {
            const word = tripleWord(x, y, sum, 5)
            const letters = chunk(word, 3)
            const steps = trace(ADDITION_AUTOMATON, letters)
            const [readX, readY, readSum] = tripleOf(word)
            return (
              <tr key={`${x}+${y}=${sum}`}>
                <td className="px-2 py-1 font-bold">
                  {readX} + {readY} = {readSum}
                </td>
                <td className="px-2 py-1 font-logic text-xs">{letters.join(' ')}</td>
                <td className="px-2 py-1 font-logic text-xs">
                  {steps.map((step) => step.states.join('|') || '✗').join(' → ')}
                </td>
                <td className="px-2 py-1 font-bold">
                  {accepts(ADDITION_AUTOMATON, letters) ? 'yes' : 'no'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function RunTheMachineGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Running one">
        <Card>
          <Prose>
            <p>
              A finite automaton has states, an initial state, accepting states, and edges labelled
              with letters. A word is accepted when reading it from the initial state ends in an
              accepting state. Nothing about the path matters except where it finishes.
            </p>
            <p>
              When the automaton is deterministic there is one edge per state and letter, so the run
              is forced and can only be got wrong by misreading the table. When it is not, keep the
              whole set of reachable states — the word is accepted if any of them accepts.
            </p>
          </Prose>
          <div className="mt-3">
            <LiteralTable />
          </div>
          <Prose>
            <p className="mt-2">
              <Sym>007</Sym> is rejected because a leading zero may only stand alone; <Sym>+0</Sym>{' '}
              is fine. That is a syntactic convention, and it is what the automaton encodes.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Why they are in this chapter">
        <Card>
          <Prose>
            <p>
              §5.2 decides <Sym>T(N,=,+)</Sym> — Presburger arithmetic — with automata rather than
              with quantifier elimination. Write each number in binary{' '}
              <strong>least significant bit first</strong>, and read a tuple of numbers as one word
              over an alphabet of bit columns. Then:
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              <li>
                an <strong>atom</strong> like <Sym>x+y=z</Sym> is a small automaton;
              </li>
              <li>
                <strong>∧</strong> and <strong>∨</strong> are the product construction, and{' '}
                <strong>¬</strong> is complementation;
              </li>
              <li>
                <strong>∃</strong> is projection — drop that number's column and make the machine
                nondeterministic, then determinise.
              </li>
            </ul>
            <p className="mt-2">
              A closed formula ends up as an automaton over a one-letter alphabet, and it is in the
              theory exactly when that automaton accepts. Every step is effective, so the theory is
              decidable.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="The addition automaton is the carry bit">
          <p>
            Two states: no carry, and carry pending. A letter is the three bits{' '}
            <Sym>(x,y,z)</Sym> at one position. Accepting means finishing with no carry left over —
            which is exactly the schoolbook algorithm, written as a machine.
          </p>
          <div className="mt-2">
            <AdditionTable />
          </div>
        </Callout>

        <Callout tone="warn" title="Least significant first, and it matters">
          <p>
            <Sym>{'011001'}</Sym> is {fromReversedBinary('011001')}, not 25. And{' '}
            <Sym>{toReversedBinary(1, 4)}</Sym> is 1 — trailing zeros in this encoding are leading
            zeros, which is exactly why the carry can be tracked left to right.
          </p>
        </Callout>

        <Callout tone="warn" title="Adding multiplication breaks it">
          <p>
            The construction leans on addition being automatic. <Sym>T(N,=,+,*)</Sym> is
            undecidable, so no such automaton exists there — and that gap is where Gödel lives.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
