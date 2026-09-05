/**
 * How to run the matching algorithm.
 *
 * The three examples are the notes' own, decided live by `match` and
 * `moreGeneral` — the functions the game marks with.
 */

import {
  applySubstitution,
  match,
  moreGeneral,
  parseTerm,
  showTerm,
  type Signature,
  type Substitution,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { SubstitutionText, TermText } from '@/ui/TermText'

const SIG: Signature = { f: 2, g: 2, h: 1 }
const EXAM: Signature = { f: 2, g: 2, h: 1 }

export function MatchingGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              <Sym>t₁ ≤ t₂</Sym> — read “t₁ is more general than t₂”, or “t₂ is an instance of t₁” —
              means there is a substitution <Sym>σ</Sym> with <Sym>σ(t₁) = t₂</Sym>.
            </p>
            <p>
              Algorithm 3.8 decides it. Walk both terms left to right. Where they agree, do nothing.
              At the first mismatch there is exactly one thing to try, and if that thing is not
              available the answer is no.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="The whole algorithm in one line">
          <p>
            At the mismatch, <strong>if the pattern has a variable there</strong>, bind it to
            whatever the target has at that spot and carry on.{' '}
            <strong>If the pattern has a function symbol there, stop</strong> — nothing can move the
            target, so no σ exists.
          </p>
        </Callout>

        <Callout tone="warn" title="A variable on the right is not an opportunity">
          <p>
            This is the trap. Matching is one-directional: only t₁ is instantiated. A variable
            sitting in t₂ at the mismatch cannot be bound to anything, so it is just as fatal as a
            clashing symbol. Example 3.9.2 in the notes is exactly this case.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The notes' three examples">
        <Worked pattern="f(x,g(y,x))" target="f(h(u),g(v,h(u)))" caption="Example 3.9.1 — it matches" />
        <Worked
          pattern="f(x,g(y,x))"
          target="f(h(u),g(v,w))"
          caption="Example 3.9.2 — stuck at the last argument"
        />
      </GuideSection>

      <GuideSection title="Where the letter-by-letter version breaks">
        <Callout tone="warn" title="Shared variables">
          <p>
            Algorithm 3.8 assumes t₁ and t₂ have no variable in common. Example 3.9.3 shows what
            happens otherwise: matching <Sym>f(x,y)</Sym> against <Sym>f(y,x)</Sym> letter by
            letter returns <Sym>{'{x ↦ x, y ↦ x}'}</Sym>, and applying it gives{' '}
            <Sym>f(x,x)</Sym> — not the target.
          </p>
          <p className="mt-2">
            The repair is to remember what a variable has already been bound to and require the same
            binding next time. So <Sym>f(x,x)</Sym> matches <Sym>f(a,a)</Sym> but not{' '}
            <Sym>f(a,b)</Sym>, which is what the game enforces.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exam question">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            exam25a, Question 2.1 — which are at least as general as f(g(X,Y),h(h(X)))?
          </p>
          <ExamTable />
          <p className="mt-3 text-sm font-medium text-ink-soft">
            The two that work are the ones whose repeated variable pattern the target can supply.{' '}
            <Sym>f(X,h(h(X)))</Sym> fails because binding X to g(X,Y) would have to change the
            second argument as well.
          </p>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                The first mismatch is marked in red on both terms. Only the moves the rules allow
                are on the board — a binding that matching cannot make is not a button you can press.
              </li>
              <li>
                Keep stepping until the two terms are identical, or until the only move left is to
                stop. Then submit; the verdict is whichever end you reached.
              </li>
              <li>
                Roughly half the questions have no matching σ at all, so “keep binding until it
                works” loses.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One example, run by `match` rather than described. */
function Worked({
  pattern,
  target,
  caption,
}: {
  pattern: string
  target: string
  caption: string
}) {
  const left = parseTerm(pattern, SIG)
  const right = parseTerm(target, SIG)
  const sigma = match(left, right)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-2 flex flex-col gap-1 text-base font-bold">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="w-8 shrink-0 opacity-70">t₁</span>
          <TermText term={left} />
        </p>
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="w-8 shrink-0 opacity-70">t₂</span>
          <TermText term={right} />
        </p>
      </div>

      {sigma === null ? (
        <p className="mt-3 text-sm font-bold text-space-red">
          No σ exists — the mismatch has a function symbol in t₁, and t₂ cannot be moved.
        </p>
      ) : (
        <>
          <p className="mt-3 flex flex-wrap items-baseline gap-2 text-base font-bold">
            <span className="opacity-70">σ =</span>
            <SubstitutionText sigma={sigma as Substitution} />
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-2 text-sm font-medium text-ink-soft">
            σ(t₁) = <TermText term={applySubstitution(sigma, left)} className="font-bold" />
            <span>{showTerm(applySubstitution(sigma, left)) === showTerm(right) ? '✓ equals t₂' : ''}</span>
          </p>
        </>
      )}
    </Card>
  )
}

/** exam25a Q2.1, decided by `moreGeneral`. */
function ExamTable() {
  const target = parseTerm('f(g(X,Y),h(h(X)))', EXAM)
  const candidates = [
    'f(g(X,Y),h(X))',
    'f(X,h(h(X)))',
    'f(X,h(h(Y)))',
    'f(g(X,Y),h(h(Y)))',
    'f(g(Y,X),h(h(Y)))',
    'X',
  ]

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">Candidate t₁</th>
            <th className="py-2 pr-3 whitespace-nowrap">t₁ ≤ target?</th>
            <th className="py-2">σ</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((source) => {
            const candidate = parseTerm(source, EXAM)
            const yes = moreGeneral(candidate, target)
            const sigma = match(candidate, target)
            return (
              <tr key={source} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="py-2 pr-3 whitespace-nowrap">
                  <TermText term={candidate} className="font-bold" />
                </td>
                <td className={`py-2 pr-3 font-bold ${yes ? 'text-grass-deep' : 'text-space-red'}`}>
                  {yes ? 'yes' : 'no'}
                </td>
                <td className="py-2">
                  {sigma === null ? (
                    <span className="text-ink-soft">—</span>
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
