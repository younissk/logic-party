/**
 * How to compute critical pairs.
 *
 * Every pair on this page comes from `criticalPairs` — the function the game
 * marks with — so the notes' three examples and both exam questions are
 * computed rather than transcribed.
 */

import {
  criticalPairs,
  parseTerm,
  rule,
  showPosition,
  showTerm,
  type Rule,
  type Signature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { EquationText, TermText } from '@/ui/TermText'

const build = (signature: Signature, sources: string[]): Rule[] =>
  sources.map((source) => {
    const [left, right] = source.split('->')
    return rule(parseTerm(left as string, signature), parseTerm(right as string, signature))
  })

export function CriticalPairsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What a critical pair is">
        <Card>
          <Prose>
            <p>
              Reduction can only give two different answers if some term has two redexes whose rules
              destroy each other. That needs the two matched subterms to <strong>overlap</strong> —
              if they sit side by side, doing one leaves the other alone and the paths rejoin.
            </p>
            <p>
              A critical pair is the two terms you get at such a fork, computed on the most general
              term where the overlap happens.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Algorithm 3.25, as a procedure">
          <p>For every ordered pair of rules — including a rule with itself:</p>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
            <li>Rename the second rule's variables apart from the first's.</li>
            <li>
              For every <strong>non-variable</strong> subterm <Sym>s</Sym> of the first rule's left
              side, unify <Sym>s</Sym> with the second rule's left side.
            </li>
            <li>
              If they unify with <Sym>σ</Sym>, the pair is{' '}
              <Sym>(σ(r₁), σ(l₁) with σ(s) replaced by σ(r₂))</Sym> — one branch fires the outer
              rule, the other fires the inner one.
            </li>
          </ol>
        </Callout>

        <Callout tone="warn" title="Non-variable, and renamed apart">
          <p>
            Unifying into a <strong>variable</strong> position would always succeed and mean nothing
            — a rule matching inside a variable's instance is not an overlap, and those paths always
            rejoin.
          </p>
          <p className="mt-2">
            And the renaming is not bookkeeping: two rules that happen to both use <Sym>x</Sym> are
            not talking about the same <Sym>x</Sym>. Skipping the renaming invents occurs-check
            failures and misses real overlaps.
          </p>
        </Callout>

        <Callout tone="warn" title="A rule always overlaps itself at the root">
          <p>
            Unifying a rule's left side with a renamed copy of itself succeeds trivially and gives
            two variants of the same term. That is not a fork, and it is dropped. Overlaps of a rule
            with itself <em>below</em> the root are real — Example 3.24.3 is exactly one.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The notes' three examples">
        <Worked
          signature={{ f: 1, g: 2, h: 1 }}
          sources={['g(x,f(y))->f(x)', 'g(f(x),y)->h(x)']}
          caption="Example 3.24.1 — two rules, both at the root"
        />
        <Worked
          signature={{ f: 1, g: 1, h: 1 }}
          sources={['h(f(x))->h(g(x))', 'f(g(x))->g(f(x))']}
          caption="Example 3.24.2 — the inner rule fires under the outer one"
        />
        <Worked
          signature={{ f: 1, g: 1 }}
          sources={['f(f(x))->g(x)']}
          caption="Example 3.24.3 — one rule, overlapping itself"
        />
      </GuideSection>

      <GuideSection title="The exam questions">
        <Worked
          signature={{ f: 1, h: 1 }}
          sources={['f(h(x))->x', 'f(f(x))->h(x)']}
          caption="exam26bA, Question 2.4"
        />
        <Worked
          signature={{ f: 2, g: 2, h: 1 }}
          sources={['f(g(X,Y),Z)->h(Y)', 'g(X,h(Y))->f(X,Y)', 'g(h(X),Y)->f(X,h(Y))']}
          caption="exam25a, Question 2.3"
        />
      </GuideSection>

      <GuideSection title="Exercise 6's two near misses">
        <Card>
          <Prose>
            <p>
              For <Sym>{'{f(h(x)) → f(x), h(f(x)) → h(x)}'}</Sym> the exercise offers four candidate
              pairs and only two are real. The other two are pairs of terms you can reach, but not
              from a single fork — which is a different thing.
            </p>
          </Prose>
          <Worked
            signature={{ f: 1, h: 1 }}
            sources={['f(h(x))->f(x)', 'h(f(x))->h(x)']}
            caption="The two that exist"
          />
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Three taps to a pair: the outer rule, which of its left side's subterms to unify
                into, and the rule to unify there. A combination that does not unify is refused with
                a shake, so the board is doing the unification, not the judging.
              </li>
              <li>
                Only non-variable subterms are offered, and a rule against itself at the root is not
                available — the two rules the algorithm skips are skipped for you.
              </li>
              <li>
                A pair you already have, in any renaming, is refused as a duplicate. Finding the same
                fork twice is not progress.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One system, with every pair the algorithm finds. */
function Worked({
  signature,
  sources,
  caption,
}: {
  signature: Signature
  sources: string[]
  caption: string
}) {
  const rules = build(signature, sources)
  const pairs = criticalPairs(rules)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-1 flex flex-col gap-1">
        {rules.map((entry, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <EquationText left={entry.left} right={entry.right} arrow="→" className="font-bold" />
          </div>
        ))}
      </div>

      {pairs.length === 0 ? (
        <p className="mt-3 text-sm font-bold text-ink-soft">
          No overlaps at all — nothing can fork, so this system is already confluent.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-3 border-ink">
                <th className="py-2 pr-3 whitespace-nowrap">Rules</th>
                <th className="py-2 pr-3 whitespace-nowrap">At</th>
                <th className="py-2">Pair</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair, index) => (
                <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                  <td className="py-2 pr-3 whitespace-nowrap text-ink-soft">
                    R{pair.from[0] + 1} ← R{pair.from[1] + 1}
                  </td>
                  <td className="formula py-2 pr-3 font-bold whitespace-nowrap">
                    {showPosition(pair.position)}
                  </td>
                  <td className="py-2">
                    <span className="formula font-bold">(</span>
                    <TermText term={pair.left} className="font-bold" />
                    <span className="formula font-bold">, </span>
                    <TermText term={pair.right} className="font-bold" />
                    <span className="formula font-bold">)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs font-medium text-ink-soft">
            {pairs.length} pair{pairs.length === 1 ? '' : 's'}, up to renaming. Positions: ε is the
            whole left side, {showPosition([0])} its first argument.
          </p>
        </div>
      )}
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Computed from {sources.map((source) => source.replace('->', ' → ')).join(', ')} — and{' '}
        {showTerm(rules[0]?.left ?? parseTerm('x', {}))} is where the search starts.
      </p>
    </Card>
  )
}
