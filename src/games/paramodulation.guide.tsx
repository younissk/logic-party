/**
 * Paramodulation.
 *
 * Every step shown is produced by `paramodulants` — the function the game marks
 * with — so the "one occurrence" behaviour is demonstrated rather than claimed.
 */

import {
  paramodulants,
  parseFoClauseSet,
  showFoClause,
  showFoLiteral,
  showPosition,
  showSubstitution,
  type FoClause,
  type FoSignature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'

const SIG: FoSignature = {
  predicates: { p: 2, q: 1, '=': 2 },
  functions: { a: 0, b: 0, f: 1, g: 1 },
}

export function ParamodulationGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The rule">
        <Card>
          <Prose>
            <p>
              <strong>Definition 4.42.</strong> From <Sym>s = t ∨ rest₁</Sym> and a clause containing
              a term <Sym>r</Sym> somewhere inside a literal, if σ unifies s and r, then that clause
              with <em>that one occurrence</em> of r replaced by t — plus both rests, all under σ —
              follows.
            </p>
            <p>
              It is the replacement property of equality, made into an inference rule. With
              reflexivity resolution it replaces the whole equality axiom schema (Theorem 4.44),
              which is a great deal smaller than adding congruence axioms for every symbol.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="One occurrence, not all of them">
          <p>
            The notes are explicit: "we do not require that all occurrences of s are replaced by t,
            but only one". So with <Sym>a = b</Sym>, the literal <Sym>p(a,a)</Sym> gives{' '}
            <Sym>p(b,a)</Sym> and <Sym>p(a,b)</Sym> in one step each — and <Sym>p(b,b)</Sym> only
            after two.
          </p>
        </Callout>

        <Callout tone="warn" title="Both directions">
          <p>
            An equation is symmetric, so <Sym>s = t</Sym> may rewrite s into t or t into s. Half the
            available steps are usually the reverse ones, and they are easy to forget.
          </p>
        </Callout>

        <Callout tone="tip" title="Any subterm, not just the arguments">
          <p>
            <Sym>f(x) = x</Sym> applies to the inner <Sym>f(a())</Sym> of{' '}
            <Sym>f(f(a()))</Sym> as well as to the whole thing. Walking every position is what makes
            the rule complete.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Worked">
        <Worked
          equation="=(f(x),x)"
          target="q(f(f(a())))"
          caption="Example 4.43 — and note it applies twice over"
        />
        <Worked
          equation="=(a(),b())"
          target="p(a(),a())"
          caption="One occurrence at a time"
        />
        <Worked
          equation="=(f(x),g(x)) ∨ q(x)"
          target="p(f(a()),f(b()))"
          caption="The rest of the equation clause comes along"
        />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Every legal step is listed with where it fired, which direction the equation was
                used in, and its unifier. Tap the ones you want.
              </li>
              <li>
                The board finds the positions; you decide which results are the distinct ones. Two
                different positions can give the same clause, and the tray keeps one.
              </li>
              <li>
                Every question has at least two results, so one step is never the whole answer.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One equation against one target, with every step it allows. */
function Worked({
  equation,
  target,
  caption,
}: {
  equation: string
  target: string
  caption: string
}) {
  const [left, right] = parseFoClauseSet([equation, target], SIG) as [FoClause, FoClause]
  const steps = paramodulants(left, right)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-1 flex flex-col gap-1">
        <div className="rounded-xl bg-card-shade px-3 py-1.5">
          <FoClauseText clause={left} className="font-bold" />
        </div>
        <div className="rounded-xl bg-card-shade px-3 py-1.5">
          <FoClauseText clause={right} className="font-bold" />
        </div>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">In</th>
              <th className="py-1.5 pr-3 whitespace-nowrap">At</th>
              <th className="py-1.5 pr-3 whitespace-nowrap">Direction</th>
              <th className="py-1.5">Result</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="formula py-1.5 pr-3 font-bold whitespace-nowrap">
                  {showFoLiteral(step.into)}
                </td>
                <td className="formula py-1.5 pr-3 whitespace-nowrap">
                  {showPosition(step.position)}
                </td>
                <td className="py-1.5 pr-3 whitespace-nowrap text-ink-soft">
                  {step.reversed ? 'right to left' : 'left to right'}
                  {Object.keys(step.sigma).length > 0 && (
                    <span className="formula block text-xs">{showSubstitution(step.sigma)}</span>
                  )}
                </td>
                <td className="formula py-1.5 font-bold">{showFoClause(step.clause)}</td>
              </tr>
            ))}
            {steps.length === 0 && (
              <tr>
                <td className="py-1.5 text-ink-soft" colSpan={4}>
                  Nothing in the target unifies with either side of the equation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-sm font-medium text-ink-soft">
        {steps.length} step{steps.length === 1 ? '' : 's'}, of which{' '}
        {steps.filter((step) => step.reversed).length} use the equation backwards.
      </p>
    </Card>
  )
}
