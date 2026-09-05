/**
 * How to judge a column of pairs quickly.
 *
 * Exercise 5's own four pairs are decided by `unify` — the function the game
 * marks with — so the verdicts are computed, and the reasons are the
 * algorithm's own rather than mine.
 */

import { applySubstitution, parseTerm, showTerm, unify, type Signature } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { SubstitutionText, TermText } from '@/ui/TermText'

const EX5: Signature = { a: 2, b: 0, f: 2, g: 1, h: 1, q: 2 }
const SIMPLE: Signature = { f: 1, g: 2 }

export function UnifiableSortGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              Several pairs of terms, and for each one: do they unify? The exam form is a column of
              true/false boxes, and answering it by running Algorithm 3.13 five times is slower than
              the paper allows for.
            </p>
            <p>
              The quick route is to look for the two failures first. They are visible almost at a
              glance, and whatever is left over unifies.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Failure one: a clash">
          <p>
            Two different function symbols at the same position. No substitution changes a function
            symbol, so the pair is dead on sight. Scan the two terms for the first place their
            symbols disagree — if a variable is not standing there, stop.
          </p>
        </Callout>

        <Callout tone="tip" title="Failure two: the occurs check">
          <p>
            A variable meeting a term that contains it. Look for the same variable appearing on both
            sides, once bare and once buried — that is the shape.{' '}
            <Sym>g(x,y)</Sym> against <Sym>g(f(y),x)</Sym> is the classic: the first argument forces{' '}
            <Sym>x ↦ f(y)</Sym>, and then the second asks <Sym>y</Sym> against <Sym>f(y)</Sym>.
          </p>
          <p className="mt-2">
            If a variable appears on one side only, it can never trigger the check.
          </p>
        </Callout>

        <Callout tone="warn" title="Shared variable names are not shared variables">
          <p>
            In this game the two terms are one problem, so an <Sym>x</Sym> in both really is the
            same variable. When you meet unification inside critical pairs or resolution, the rules
            are renamed apart first — and forgetting that invents occurs checks that are not there.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Exercise 5's own pairs">
        <Card>
          <Table
            signature={EX5}
            pairs={[
              ['a(x,a(y,a(z,b())))', 'a(a(a(b(),z),y),x)'],
              ['f(x,g(y))', 'f(y,g(x))'],
              ['q(g(x),h(y))', 'q(g(g(y)),h(g(y)))'],
            ]}
          />
        </Card>
      </GuideSection>

      <GuideSection title="A pair worth staring at">
        <Card>
          <Prose>
            <p>
              These two differ only in the order of their arguments, and they land in different
              bins. There is no way to tell them apart by shape — you have to run a step.
            </p>
          </Prose>
          <Table
            signature={SIMPLE}
            pairs={[
              ['g(x,y)', 'g(f(y),x)'],
              ['g(x,f(y))', 'g(f(z),x)'],
            ]}
          />
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Every question has at least one pair in each of the three bins, so no bin is ever
                safe to leave empty.
              </li>
              <li>
                Putting a failure in the wrong failure bin is called out separately from thinking
                something unifies — they are different mistakes.
              </li>
              <li>
                Afterwards every misplaced pair is named with the bin it belonged in, so a wrong
                sweep is worth reading.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** Pairs decided by `unify`, with the reason it gives. */
function Table({ signature, pairs }: { signature: Signature; pairs: [string, string][] }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">t₁</th>
            <th className="py-2 pr-3 whitespace-nowrap">t₂</th>
            <th className="py-2 pr-3 whitespace-nowrap">Bin</th>
            <th className="py-2">Why</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map(([left, right]) => {
            const one = parseTerm(left, signature)
            const two = parseTerm(right, signature)
            const result = unify(one, two)
            return (
              <tr key={`${left}|${right}`} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="py-2 pr-3 whitespace-nowrap">
                  <TermText term={one} className="font-bold" />
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <TermText term={two} className="font-bold" />
                </td>
                <td
                  className={`py-2 pr-3 font-bold ${
                    result.unified ? 'text-grass-deep' : 'text-space-red'
                  }`}
                >
                  {result.unified ? 'unifiable' : result.failure.reason}
                </td>
                <td className="py-2 text-ink-soft">
                  {result.unified ? (
                    <span className="flex flex-wrap items-baseline gap-2">
                      <SubstitutionText sigma={result.mgu} />
                      <span>→ {showTerm(applySubstitution(result.mgu, one))}</span>
                    </span>
                  ) : result.failure.reason === 'clash' ? (
                    `${result.failure.left} against ${result.failure.right}`
                  ) : (
                    `${result.failure.variable} would have to become ${showTerm(result.failure.term)}`
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
