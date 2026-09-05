/**
 * What "up to renaming" means, and what it does not cover.
 *
 * Exercise 6's four candidates are judged by `criticalPairs` and `samePair` —
 * the functions the game marks with.
 */

import {
  criticalPairs,
  parseTerm,
  reduce,
  rule,
  samePair,
  showTerm,
  type Rule,
  type Signature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { TermText } from '@/ui/TermText'

const SIG: Signature = { f: 1, h: 1 }

const build = (signature: Signature, sources: string[]): Rule[] =>
  sources.map((source) => {
    const [left, right] = source.split('->')
    return rule(parseTerm(left as string, signature), parseTerm(right as string, signature))
  })

export function PairRenamingGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Why the rubric says “up to renaming”">
        <Card>
          <Prose>
            <p>
              Algorithm 3.25 renames one rule's variables apart from the other's before unifying, and
              which fresh names it picks is an accident of the order it happened to run in. Two runs
              can produce <Sym>(f(f(x)), f(h(x)))</Sym> and <Sym>(f(f(u)), f(h(u)))</Sym> and mean
              the same thing.
            </p>
            <p>
              A fork also has no preferred branch, so the two sides may be written either way round.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="What renaming must preserve">
          <p>
            The renaming has to be applied to <strong>both sides at once</strong>. A pair sharing a
            variable between its two sides is not the same as one where the two sides have separate
            variables — <Sym>(f(x), g(x))</Sym> and <Sym>(f(x), g(y))</Sym> are different pairs, and
            no renaming turns one into the other.
          </p>
        </Callout>

        <Callout tone="warn" title="Reducing a side is not renaming">
          <p>
            This is the trap the exercise sets. If <Sym>(t₁, t₂)</Sym> is a critical pair and{' '}
            <Sym>t₁</Sym> reduces to <Sym>t₁′</Sym>, then <Sym>t₁′</Sym> and <Sym>t₂</Sym> are both
            reachable from the same term — but not from a single fork, so the pair{' '}
            <Sym>(t₁′, t₂)</Sym> is not a critical pair.
          </p>
          <p className="mt-2">
            Completion cares about exactly this difference: it reduces both sides of a critical pair
            and then makes a rule of the results. The reduced version is what you end up with, not
            what you started from.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Exercise 6's four candidates">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            R = {'{'}f(h(x)) → f(x), h(f(x)) → h(x){'}'}
          </p>
          <Candidates
            signature={SIG}
            sources={['f(h(x))->f(x)', 'h(f(x))->h(x)']}
            candidates={[
              ['f(f(x))', 'f(h(x))'],
              ['f(f(x))', 'h(h(x))'],
              ['f(h(f(x)))', 'h(f(h(x)))'],
              ['h(h(x))', 'h(f(x))'],
            ]}
          />
          <p className="mt-3 text-sm font-medium text-ink-soft">
            The third candidate is the instructive one: both of its terms are perfectly real, and one
            rule does apply to each — but they do not come from one term forking, they come from two
            different terms.
          </p>
        </Card>
      </GuideSection>

      <GuideSection title="The same pair, four ways">
        <Card>
          <Prose>
            <p>
              Here is one real pair written four different ways. Three of them are the same pair; one
              is not.
            </p>
          </Prose>
          <Candidates
            signature={SIG}
            sources={['f(h(x))->f(x)', 'h(f(x))->h(x)']}
            candidates={[
              ['f(f(x))', 'f(h(x))'],
              ['f(f(u))', 'f(h(u))'],
              ['f(h(x))', 'f(f(x))'],
              ['f(f(x))', 'f(h(y))'],
            ]}
          />
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Work out the system's real critical pairs first, then compare each candidate against
                them. Comparing candidates to each other does not help.
              </li>
              <li>
                Both bins always have something in them, so there is no safe default.
              </li>
              <li>
                After the round the real pairs are listed, which is worth reading against whatever
                you thought they were.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** Each candidate judged, with the reason it fails when it does. */
function Candidates({
  signature,
  sources,
  candidates,
}: {
  signature: Signature
  sources: string[]
  candidates: [string, string][]
}) {
  const rules = build(signature, sources)
  const real = criticalPairs(rules)

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">Candidate</th>
            <th className="py-2 pr-3 whitespace-nowrap">Critical pair?</th>
            <th className="py-2">Why</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map(([leftSource, rightSource]) => {
            const pair = {
              left: parseTerm(leftSource, signature),
              right: parseTerm(rightSource, signature),
            }
            const yes = real.some((entry) => samePair(entry, pair))
            const reducedLeft = showTerm(reduce(rules, pair.left).result)
            const reducedRight = showTerm(reduce(rules, pair.right).result)
            const reducesToOne = real.some((entry) =>
              samePair(entry, {
                left: reduce(rules, pair.left).result,
                right: reduce(rules, pair.right).result,
              }),
            )
            return (
              <tr
                key={`${leftSource}|${rightSource}`}
                className="border-t-2 border-dashed border-card-shade align-top"
              >
                <td className="py-2 pr-3 whitespace-nowrap">
                  <span className="formula font-bold">(</span>
                  <TermText term={pair.left} className="font-bold" />
                  <span className="formula font-bold">, </span>
                  <TermText term={pair.right} className="font-bold" />
                  <span className="formula font-bold">)</span>
                </td>
                <td className={`py-2 pr-3 font-bold ${yes ? 'text-grass-deep' : 'text-space-red'}`}>
                  {yes ? 'yes' : 'no'}
                </td>
                <td className="py-2 text-ink-soft">
                  {yes
                    ? 'one of the real ones, renamed'
                    : reducesToOne
                      ? 'a real pair with a side reduced — reachable, but not one fork'
                      : `no overlap produces it (it reduces to ${reducedLeft}, ${reducedRight})`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs font-medium text-ink-soft">
        The real pairs:{' '}
        {real.map((pair) => `(${showTerm(pair.left)}, ${showTerm(pair.right)})`).join(', ')}
      </p>
    </div>
  )
}
