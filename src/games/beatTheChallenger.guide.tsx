/**
 * Truth in T(ℝ,=,+,*), played as a game.
 *
 * The table's outcomes come from the same `play` and `winningMoves` the game
 * uses, so the winning lines shown here are lines the challenger really cannot
 * beat.
 */

import { showReal } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { CHALLENGES, myMoves, play, winningMoves } from './beatTheChallenger'

function OutcomeTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1">formula</th>
            <th className="px-2 py-1">true over ℝ</th>
            <th className="px-2 py-1">a winning line</th>
            <th className="px-2 py-1">why</th>
          </tr>
        </thead>
        <tbody>
          {CHALLENGES.map((challenge) => {
            const question = { id: challenge.id }
            const line =
              challenge.truth && myMoves(question) > 0
                ? play(question, winningMoves(question)).history
                : []
            return (
              <tr key={challenge.id} className="align-top">
                <td className="px-2 py-1 font-logic text-xs font-bold">
                  {showReal(challenge.formula)}
                </td>
                <td className="px-2 py-1 font-bold">{challenge.truth ? 'yes' : 'no'}</td>
                <td className="px-2 py-1 font-logic text-xs">
                  {line.length === 0
                    ? '—'
                    : line.map((step) => `${step.variable}=${step.value}`).join(', ')}
                </td>
                <td className="px-2 py-1 text-ink-soft">{challenge.why}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function BeatTheChallengerGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Quantifiers as moves">
        <Card>
          <Prose>
            <p>
              A quantified formula is a two-player game. <Sym>∃</Sym> is your move: you name a value
              and must be able to make the rest work. <Sym>∀</Sym> is the challenger's: they name a
              value and only need one that breaks you. The formula is true exactly when you have a
              strategy that wins every line.
            </p>
            <p>
              That reading is what makes quantifier order matter.{' '}
              <Sym>{'∀x∃y: x²≤y'}</Sym> lets you see x before choosing y, so y = x² wins.{' '}
              <Sym>{'∃x∀y: x²≤y'}</Sym> makes you commit first, and then the challenger picks a y
              below whatever you said.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Losing a line is not losing the game">
          <p>
            One bad play proves nothing — you may simply have chosen badly. What makes a formula
            false is that <em>every</em> play loses. So when a line fails, try a different value
            before concluding anything; and when the values that could possibly work are exhausted,
            that is your proof.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Exercise 12 and both exam papers, decided">
        <Card>
          <OutcomeTable />
        </Card>

        <Callout tone="warn" title="≤ and &lt; behave completely differently in a cycle">
          <p>
            <Sym>{'∃x∃y∃z: x<y ∧ y<z ∧ z<x'}</Sym> is false — a strict cycle would give{' '}
            <Sym>{'x<x'}</Sym>. Replace every <Sym>{'<'}</Sym> with <Sym>{'≤'}</Sym> and it becomes
            true, satisfied by x = y = z. Exercise 12 asks both, one after the other, for exactly
            this reason.
          </p>
        </Callout>

        <Callout tone="warn" title="Squaring loses the sign">
          <p>
            exam26a asks whether <Sym>{'x²≤y² → x≤y'}</Sym> holds for all reals. It does not:{' '}
            <Sym>x=1</Sym>, <Sym>y=−2</Sym>. Any step that squares both sides of an inequality
            needs both sides non-negative, and over ℝ that is not given.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="What the game is not">
        <Card>
          <Prose>
            <p>
              This searches a fixed list of rational candidates, which is not a decision procedure
              for the reals. A formula whose only witness is irrational — <Sym>∃x: x*x = 2</Sym> —
              would come out false here and is true over ℝ. Tarski's theorem gives a real procedure,
              by quantifier elimination, and it runs in doubly exponential time.
            </p>
            <p>
              So the truth value of every formula above is recorded from the mathematics, and the
              search only has to agree with it. When it cannot, the formula does not belong in the
              game.
            </p>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}
