/**
 * How to run the unification algorithm.
 *
 * Every example is decided by `unify` — the function the game marks with — so
 * the substitutions shown are computed and the failures are named by the
 * algorithm rather than by me.
 */

import {
  applySubstitution,
  parseTerm,
  showTerm,
  unify,
  type Signature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { SubstitutionText, TermText } from '@/ui/TermText'

const SIG: Signature = { f: 1, g: 2, h: 2 }

export function MguGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              Two terms are <strong>unifiable</strong> if some σ makes them the same term:{' '}
              <Sym>σ(t₁) = σ(t₂)</Sym>. Unlike matching, both sides may move.
            </p>
            <p>
              A <strong>most general</strong> unifier is one that every other unifier factors
              through. Theorem 3.12 says one exists whenever any unifier does, and Theorem 3.14 says
              Algorithm 3.13 finds it — so “find an mgu” and “run the algorithm” are the same task.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="The algorithm, in three cases">
          <p>
            Walk both terms left to right. At the first mismatch:
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            <li>
              <strong>Both function symbols</strong> → stop. No substitution changes a function
              symbol, so there is no unifier.
            </li>
            <li>
              <strong>A variable on either side</strong> → bind it to the other side's subterm, apply
              that to <em>both</em> terms, and carry on.
            </li>
            <li>
              <strong>A variable meeting a term that contains it</strong> → stop. That is the occurs
              check.
            </li>
          </ul>
        </Callout>
      </GuideSection>

      <GuideSection title="The two ways to fail, and why they are different">
        <Callout tone="warn" title="Occurs check: the mismatch that runs away">
          <p>
            <Sym>f(x)</Sym> against <Sym>f(f(x))</Sym>. Why not just apply <Sym>{'{x ↦ f(x)}'}</Sym>?
            Because that gives <Sym>f(f(x))</Sym> against <Sym>f(f(f(x)))</Sym> — the mismatch has
            moved one symbol along and is still there. Repeat forever and it never resolves.
          </p>
          <p className="mt-2">
            The exam wants the reason named, not just “not unifiable”. A clash is a local
            impossibility; an occurs check is a non-terminating repair.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The three endings at a glance">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3 whitespace-nowrap">t₁</th>
                  <th className="py-2 pr-3 whitespace-nowrap">t₂</th>
                  <th className="py-2 pr-3 whitespace-nowrap">Ends in</th>
                  <th className="py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['g(x,f(f(y)))', 'g(g(z,y),f(z))'],
                  ['g(x,f(y))', 'f(f(z))'],
                  ['f(x)', 'f(f(x))'],
                  ['g(x,y)', 'g(f(y),x)'],
                  ['g(x,f(y))', 'g(f(z),x)'],
                ].map(([left, right]) => {
                  const result = unify(parseTerm(left as string, SIG), parseTerm(right as string, SIG))
                  return (
                    <tr key={`${left}|${right}`} className="border-t-2 border-dashed border-card-shade align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <TermText text={left as string} className="font-bold" />
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <TermText text={right as string} className="font-bold" />
                      </td>
                      <td
                        className={`py-2 pr-3 font-bold ${result.unified ? 'text-grass-deep' : 'text-space-red'}`}
                      >
                        {result.unified ? 'unified' : result.failure.reason}
                      </td>
                      <td className="py-2">
                        {result.unified ? (
                          <SubstitutionText sigma={result.mgu} />
                        ) : (
                          <span className="text-ink-soft">no unifier</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </GuideSection>

      <GuideSection title="The notes' examples">
        <Worked left="g(x,f(f(y)))" right="g(g(z,y),f(z))" caption="Example 3.15.1 — unifies" />
        <Worked left="g(x,f(y))" right="f(f(z))" caption="Example 3.15.2 — a clash, immediately" />
        <Worked left="f(x)" right="f(f(x))" caption="Example 3.15.3 — the occurs check" />
      </GuideSection>

      <GuideSection title="The exam questions">
        <Worked
          left="g(x,f(y))"
          right="g(h(z,y),z)"
          caption="exam26a, Question 2.3"
        />
        <Worked
          left="g(h(x,y),x)"
          right="g(z,f(f(y)))"
          caption="exam26bA, Question 2.3"
        />
      </GuideSection>

      <GuideSection title="A line worth checking twice">
        <Card>
          <Prose>
            <p>
              exam26a asks whether <Sym>g(x,y)</Sym> and <Sym>g(f(y),x)</Sym> are unifiable. It
              looks like an easy yes — two variables, plenty of room. It is not.
            </p>
          </Prose>
          <Worked left="g(x,y)" right="g(f(y),x)" caption="The first argument forces the second" />
          <p className="mt-2 text-sm font-medium text-ink-soft">
            Binding <Sym>x ↦ f(y)</Sym> from the first argument makes the second argument ask{' '}
            <Sym>y</Sym> against <Sym>f(y)</Sym>. Occurs check. Swapping the arguments —{' '}
            <Sym>g(x,f(y))</Sym> against <Sym>g(f(z),x)</Sym>, which is exam26bA's line — unifies
            fine, because the two variables are different.
          </p>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                The first mismatch is marked on both terms, and only the legal moves are offered.
                When a mismatch has a variable on each side, both bindings are available — either is
                fine, and they differ only by a renaming.
              </li>
              <li>
                Stopping is a move too. The two red buttons are the two failures, and choosing the
                wrong one is marked wrong even though “not unifiable” was right.
              </li>
              <li>
                Every ending comes up: roughly a third unify, a third clash, a third hit the occurs
                check.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One pair, run by `unify` rather than described. */
function Worked({ left, right, caption }: { left: string; right: string; caption: string }) {
  const one = parseTerm(left, SIG)
  const two = parseTerm(right, SIG)
  const result = unify(one, two)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-2 flex flex-col gap-1 text-base font-bold">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="w-8 shrink-0 opacity-70">t₁</span>
          <TermText term={one} />
        </p>
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="w-8 shrink-0 opacity-70">t₂</span>
          <TermText term={two} />
        </p>
      </div>

      {result.unified ? (
        <>
          <p className="mt-3 flex flex-wrap items-baseline gap-2 text-base font-bold">
            <span className="opacity-70">mgu =</span>
            <SubstitutionText sigma={result.mgu} />
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-2 text-sm font-medium text-ink-soft">
            both become{' '}
            <TermText term={applySubstitution(result.mgu, one)} className="font-bold" />
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm font-bold text-space-red">
          {result.failure.reason === 'clash'
            ? `No unifier — ${result.failure.left} and ${result.failure.right} clash, and no substitution changes a function symbol.`
            : `No unifier — the occurs check fires: ${result.failure.variable} would have to be bound to ${showTerm(result.failure.term)}, which contains it.`}
        </p>
      )}
    </Card>
  )
}
