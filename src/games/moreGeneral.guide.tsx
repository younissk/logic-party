/**
 * How to answer "is t at least as general as t′?".
 *
 * Both worked sets are decided by `moreGeneral` and `areVariants` — the
 * functions the game marks with — and the substitutions shown are the ones
 * `match` actually finds.
 */

import {
  areIncomparable,
  areVariants,
  match,
  moreGeneral,
  parseTerm,
  type Signature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { SubstitutionText, TermText } from '@/ui/TermText'

const EXAM: Signature = { f: 2, g: 2, h: 1 }
const EX5: Signature = { c: 0, f: 1, g: 1, h: 1 }

export function MoreGeneralGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What the relation says">
        <Card>
          <Prose>
            <p>
              <Sym>t ≤ t′</Sym> means there is a substitution <Sym>σ</Sym> with{' '}
              <Sym>σ(t) = t′</Sym>. The smaller term is the <strong>more general</strong> one — it
              has more room in it — and the bigger one is an <strong>instance</strong>.
            </p>
            <p>
              The direction of the sign trips people up. Read it as “t is at least as general as
              t′”, and remember that a bare variable is more general than everything.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="How to decide one, quickly">
          <p>
            Lay the candidate over the target. Every <strong>function symbol</strong> in the
            candidate has to already agree with the target — nothing can change it. Every{' '}
            <strong>variable</strong> may absorb whatever the target has there, but a variable used
            twice must absorb the same term both times.
          </p>
          <p className="mt-2">
            One mismatched function symbol, or one variable asked to be two different things, and
            the answer is no.
          </p>
        </Callout>

        <Callout tone="warn" title="Two terms can each be an instance of the other">
          <p>
            <Sym>f(x,y)</Sym> and <Sym>f(y,x)</Sym> are each an instance of the other. Theorem 3.7
            says that can only happen when they differ by a <strong>variable renaming</strong> — so
            they are the same term with the labels swapped, not two different terms.
          </p>
          <p className="mt-2">
            The board has a bin for exactly this. It is a stronger answer than “yes”, and the exam
            distinguishes them.
          </p>
        </Callout>

        <Callout tone="warn" title="Incomparable is normal">
          <p>
            <Sym>f(x)</Sym> and <Sym>g(x)</Sym> cannot be compared in either direction, and neither
            can <Sym>g(x)</Sym> and <Sym>g(y)</Sym> under any term order. “Not more general” does
            not mean “less general”.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exam question">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            exam25a, Question 2.1 — at least as general as f(g(X,Y),h(h(X)))?
          </p>
          <Table
            signature={EXAM}
            target="f(g(X,Y),h(h(X)))"
            candidates={[
              'f(g(X,Y),h(X))',
              'f(X,h(h(X)))',
              'f(X,h(h(Y)))',
              'f(g(X,Y),h(h(Y)))',
              'f(g(Y,X),h(h(Y)))',
              'X',
            ]}
          />
          <p className="mt-3 text-sm font-medium text-ink-soft">
            The instructive failure is <Sym>f(X,h(h(X)))</Sym>. Binding X to g(X,Y) fixes the first
            argument but then the second becomes h(h(g(X,Y))), which the target does not have. One
            variable, two demands.
          </p>
        </Card>
      </GuideSection>

      <GuideSection title="Exercise 5, where the same question is asked four ways">
        <Card>
          <Prose>
            <p>
              With <Sym>r = g(c())</Sym>, <Sym>s = g(f(x))</Sym>, <Sym>t = f(y)</Sym> and{' '}
              <Sym>u = g(y)</Sym>, the exercise mixes generality with unifiability. They are
              different questions and the answers do not line up.
            </p>
          </Prose>
          <Pairs />
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Drag every candidate into a bin. The middle bin is for a candidate that is a
                renaming of the target — an instance whose instance the target also is.
              </li>
              <li>
                Both outer bins always have something in them, so “drag everything left” loses.
              </li>
              <li>
                A wrong answer tells you how many are misplaced, never which — and afterwards each
                misplaced one is named with the bin it belonged in.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One target against several candidates, decided live. */
function Table({
  signature,
  target,
  candidates,
}: {
  signature: Signature
  target: string
  candidates: string[]
}) {
  const goal = parseTerm(target, signature)
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">Candidate</th>
            <th className="py-2 pr-3 whitespace-nowrap">Verdict</th>
            <th className="py-2">σ</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((source) => {
            const candidate = parseTerm(source, signature)
            const variant = areVariants(candidate, goal)
            const yes = moreGeneral(candidate, goal)
            const sigma = match(candidate, goal)
            return (
              <tr key={source} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="py-2 pr-3 whitespace-nowrap">
                  <TermText term={candidate} className="font-bold" />
                </td>
                <td
                  className={`py-2 pr-3 font-bold ${
                    variant ? 'text-space-blue' : yes ? 'text-grass-deep' : 'text-space-red'
                  }`}
                >
                  {variant ? 'renaming' : yes ? 'more general' : 'no'}
                </td>
                <td className="py-2">
                  {sigma === null ? (
                    <span className="text-ink-soft">none exists</span>
                  ) : (
                    <SubstitutionText sigma={sigma} />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Exercise 5's own eight claims, each decided by the marking functions. */
function Pairs() {
  const terms: Record<string, string> = {
    r: 'g(c())',
    s: 'g(f(x))',
    t: 'f(y)',
    u: 'g(y)',
  }
  const T = (name: string) => parseTerm(terms[name] as string, EX5)

  const claims: [string, boolean][] = [
    ['t ≤ s', moreGeneral(T('t'), T('s'))],
    ['u ≤ r', moreGeneral(T('u'), T('r'))],
    ['s ≤ t', moreGeneral(T('s'), T('t'))],
    ['u ≤ s', moreGeneral(T('u'), T('s'))],
    ['s and t are incomparable', areIncomparable(T('s'), T('t'))],
  ]

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">Claim</th>
            <th className="py-2">True?</th>
          </tr>
        </thead>
        <tbody>
          {claims.map(([label, holds]) => (
            <tr key={label} className="border-t-2 border-dashed border-card-shade">
              <td className="formula py-2 pr-3 font-bold whitespace-nowrap">{label}</td>
              <td className={`py-2 font-bold ${holds ? 'text-grass-deep' : 'text-space-red'}`}>
                {holds ? 'yes' : 'no'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs font-medium text-ink-soft">
        r = {terms.r}, s = {terms.s}, t = {terms.t}, u = {terms.u}
      </p>
    </div>
  )
}
