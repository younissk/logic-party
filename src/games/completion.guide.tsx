/**
 * How Knuth-Bendix completion runs, and how it stops.
 *
 * Both of the notes' examples are run by `complete` — the function the game
 * marks with — so the rules added and the order they arrive in are computed.
 */

import {
  combinedOrder,
  complete,
  criticalPairs,
  isConfluent,
  parseTerm,
  precedenceOrder,
  rule,
  showTerm,
  type Rule,
  type Signature,
  type TermOrder,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { EquationText, TermText } from '@/ui/TermText'

const build = (signature: Signature, sources: string[]): Rule[] =>
  sources.map((source) => {
    const [left, right] = source.split('->')
    return rule(parseTerm(left as string, signature), parseTerm(right as string, signature))
  })

export function CompletionGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What completion is for">
        <Card>
          <Prose>
            <p>
              Reduction gives a unique answer only if every fork can be rejoined. The forks are the
              critical pairs, so: take one, reduce both sides, and if they do not meet, add a rule
              that makes them meet. Then check whether the new rule created new forks.
            </p>
            <p>
              When the queue empties, Theorem 3.28 says every pair of terms equal in the theory now
              reduces to the same normal form — so <Sym>R ⊢ t=t′</Sym> becomes a finite check.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="The loop, per pair">
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            <li>Reduce both sides as far as they go.</li>
            <li>
              <strong>Same term?</strong> The pair already joins. Discard it; nothing to do.
            </li>
            <li>
              <strong>Different, and the order can compare them?</strong> Add the rule pointing
              downhill.
            </li>
            <li>
              <strong>Different, and incomparable?</strong> Give up — with this order.
            </li>
          </ol>
        </Callout>

        <Callout tone="warn" title="Most pairs cost nothing">
          <p>
            The pseudocode makes every pair look like work. In practice most of them reduce to the
            same term straight away and are discarded, and the run is decided by the two or three
            that do not. Reducing first, before thinking about orientation, is what makes that cheap.
          </p>
        </Callout>

        <Callout tone="warn" title="Adding a rule can add forks">
          <p>
            A new rule overlaps the old ones, so the queue can grow after you thought you were
            nearly done. That is why the loop is a loop, and why it need not terminate.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The notes' first example">
        <Run
          signature={{ f: 1, g: 2, h: 1 }}
          sources={['g(x,f(y))->f(x)', 'g(f(x),y)->h(x)']}
          order={precedenceOrder(['f', 'g', 'h'])}
          orderLabel="symbols ordered f < g < h"
          caption="Example 3.27.1 — one rule added, then done"
        />
        <Prose>
          <p>
            The notes say “let's assume the term order is such that <Sym>h(x) ≻ f(f(x))</Sym>”, and
            that assumption is doing real work: by symbol count it is the other way round, and the
            run would add <Sym>f(f(x)) → h(x)</Sym> instead. Either is a valid completion; they are
            different systems.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Where the new rule makes new forks">
        <Run
          signature={{ f: 1, g: 1 }}
          sources={['f(f(x))->g(x)']}
          order={combinedOrder(['g', 'f'])}
          orderLabel="size first, ties by g < f"
          caption="Example 3.27.2 — the added rule creates a pair, and that one joins"
        />
      </GuideSection>

      <GuideSection title="How it can fail">
        <Run
          signature={{ f: 2, g: 1 }}
          sources={['f(x,y)->g(x)', 'f(x,y)->g(y)']}
          order={combinedOrder(['f', 'g'])}
          orderLabel="size first, ties by f < g"
          caption="Two rules on the same left side"
        />
        <Callout tone="warn" title="Failure is about the order, not the system">
          <p>
            <Sym>g(x)</Sym> and <Sym>g(y)</Sym> are incomparable in <em>every</em> term order — the
            notes prove no order compares them — so this particular pair can never become a rule.
            When failure is caused by something less fundamental, the fixes are: try a different
            order, or put the pair back and handle others first, since new rules may reduce it
            further next time.
          </p>
          <p className="mt-2">
            And Theorem 3.29 is the backstop: no algorithm decides equational theories in general, so
            some inputs make this loop run forever whatever you do.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap a waiting pair and the board reduces both sides for you. The only action offered
                is the one the rules allow — discard, add a specific rule, or fail.
              </li>
              <li>
                Added rules appear in gold, and the waiting list is recomputed after every addition,
                so you can watch the queue grow.
              </li>
              <li>
                Declaring failure while something is still orientable is refused. So is discarding a
                pair whose sides do not meet.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One completion run, computed step by step. */
function Run({
  signature,
  sources,
  order,
  orderLabel,
  caption,
}: {
  signature: Signature
  sources: string[]
  order: TermOrder
  orderLabel: string
  caption: string
}) {
  const rules = build(signature, sources)
  const done = complete(rules, order, 30)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1 text-xs font-medium text-ink-soft">{orderLabel}</p>

      <div className="mt-2 flex flex-col gap-1">
        {rules.map((entry, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <EquationText left={entry.left} right={entry.right} arrow="→" className="font-bold" />
          </div>
        ))}
      </div>

      <p className="mt-3 text-sm font-bold">
        Starting critical pairs: {criticalPairs(rules).length}
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-2 pr-3 whitespace-nowrap">Pair</th>
              <th className="py-2 pr-3 whitespace-nowrap">Reduces to</th>
              <th className="py-2">What happens</th>
            </tr>
          </thead>
          <tbody>
            {done.steps.map((entry, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="formula py-2 pr-3 text-xs whitespace-nowrap">
                  ({showTerm(entry.pair.left)}, {showTerm(entry.pair.right)})
                </td>
                <td className="formula py-2 pr-3 text-xs whitespace-nowrap">
                  {showTerm(entry.reduced[0])}, {showTerm(entry.reduced[1])}
                </td>
                <td className="py-2 text-ink-soft">
                  {entry.stuck ? (
                    <span className="font-bold text-space-red">incomparable — fail</span>
                  ) : entry.added === null ? (
                    'both sides meet — discarded'
                  ) : (
                    <span className="flex flex-wrap items-baseline gap-1">
                      <span>add</span>
                      <EquationText
                        left={entry.added.left}
                        right={entry.added.right}
                        arrow="→"
                        className="font-bold"
                      />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        className={`mt-3 text-sm font-bold ${
          done.status === 'completed' ? 'text-grass-deep' : 'text-space-red'
        }`}
      >
        {done.status === 'completed'
          ? `Completed with ${done.rules.length} rules${isConfluent(done.rules) ? ', and it is confluent' : ''}.`
          : done.status === 'failed'
            ? 'Failed — a pair could not be oriented.'
            : 'Still going when the budget ran out.'}
      </p>

      {done.status === 'completed' && done.rules.length > rules.length && (
        <div className="mt-2 flex flex-col gap-1">
          {done.rules.slice(rules.length).map((entry, index) => (
            <div key={index} className="rounded-xl bg-coin px-3 py-1.5">
              <EquationText left={entry.left} right={entry.right} arrow="→" className="font-bold" />
            </div>
          ))}
        </div>
      )}

      {done.status === 'failed' && (
        <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm font-medium text-ink-soft">
          The pair that stopped it:
          {done.steps
            .filter((entry) => entry.stuck)
            .map((entry, index) => (
              <span key={index} className="formula font-bold">
                <TermText term={entry.reduced[0]} /> and <TermText term={entry.reduced[1]} />
              </span>
            ))}
        </p>
      )}
    </Card>
  )
}
