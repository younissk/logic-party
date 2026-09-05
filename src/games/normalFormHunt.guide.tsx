/**
 * Why one term can have several normal forms.
 *
 * Every fork and every output on this page is computed by `normalForms` and
 * `redexes` — the functions the game marks with.
 */

import {
  normalForms,
  parseTerm,
  redexes,
  reduce,
  rule,
  showPosition,
  showTerm,
  type Rule,
  type Signature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { EquationText, TermText } from '@/ui/TermText'

const SIG: Signature = { f: 1, g: 1, h: 1 }
const WIDE: Signature = { f: 1, g: 2, h: 1 }

const R = (source: string, signature: Signature): Rule => {
  const [left, right] = source.split('->')
  return rule(parseTerm(left as string, signature), parseTerm(right as string, signature))
}

const EX6 = ['g(h(x))->f(x)', 'h(f(x))->g(x)', 'f(f(x))->h(x)', 'g(g(x))->f(x)']

export function NormalFormHuntGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What the question is">
        <Card>
          <Prose>
            <p>
              Algorithm 3.21 says: while some subterm matches a rule, rewrite it. It does{' '}
              <em>not</em> say which subterm, or which rule when several apply. The choice does not
              affect whether the algorithm terminates, and it does not affect correctness — but it
              can affect the answer.
            </p>
            <p>
              So "what does this term reduce to?" can have more than one right answer, and the exam
              asks which terms <strong>can appear</strong> as output.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="How to find them all">
          <p>
            Reduce once, any way you like, and note where you had a choice. Then go back to the
            first fork and take the other branch. Repeat until every branch has been walked.
          </p>
          <p className="mt-2">
            Forks that rejoin cost you nothing; forks that do not are the answer.
          </p>
        </Callout>

        <Callout tone="warn" title="All of them are equal in the theory">
          <p>
            If <Sym>t</Sym> reduces to both <Sym>r</Sym> and <Sym>r′</Sym>, then{' '}
            <Sym>R ⊢ r = r′</Sym> — both are reached from the same term by legal steps. So the
            different outputs are not disagreements about the value; they are the same value written
            in ways the system cannot reconcile. That is exactly what completion fixes.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The smallest example">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Example 3.23</p>
          <Outputs
            signature={WIDE}
            rules={['g(x,f(y))->f(x)', 'g(f(x),y)->h(x)']}
            start="g(f(x),f(y))"
          />
          <p className="mt-2 text-sm font-medium text-ink-soft">
            Both rules match the whole term, and each destroys the other's redex. Neither result can
            be reduced further, and they are different terms.
          </p>
        </Card>
      </GuideSection>

      <GuideSection title="The exercise">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Exercise 6, question 2
          </p>
          <Outputs signature={SIG} rules={EX6} start="g(h(f(z)))" />
          <p className="mt-2 text-sm font-medium text-ink-soft">
            The two options the exercise offers that are <em>not</em> outputs fail for different
            reasons: one is not reachable at all, and the other is reachable but still has a redex
            in it, so the algorithm would not have stopped there.
          </p>
          <Rejected
            signature={SIG}
            rules={EX6}
            start="g(h(f(z)))"
            candidates={['h(z)', 'g(h(f(x)))', 'f(z)', 'g(g(z))']}
          />
        </Card>
      </GuideSection>

      <GuideSection title="Reading the forks">
        <Card>
          <Prose>
            <p>
              A fork exists wherever a term has two or more redexes. Here is the starting term of
              the exercise with every one listed.
            </p>
          </Prose>
          <Forks signature={SIG} rules={EX6} start="g(h(f(z)))" />
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Walk one route to the end, bank the normal form, then go back one step at a time and
                take a different branch.
              </li>
              <li>
                Only a term with no redex left can be banked — the board will not let you claim
                something halfway down.
              </li>
              <li>
                Every question has at least two outputs, so one run is never the answer.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** The rules, the term, and every output — all computed. */
function Outputs({
  signature,
  rules,
  start,
}: {
  signature: Signature
  rules: string[]
  start: string
}) {
  const system = rules.map((source) => R(source, signature))
  const term = parseTerm(start, signature)
  const forms = normalForms(system, term)
  const first = reduce(system, term)

  return (
    <>
      <div className="mt-1 flex flex-col gap-1">
        {system.map((entry, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <EquationText left={entry.left} right={entry.right} arrow="→" className="font-bold" />
          </div>
        ))}
      </div>

      <p className="mt-3 flex flex-wrap items-baseline gap-2 text-sm font-medium">
        <span className="font-bold">Start</span>
        <TermText term={term} className="text-base font-bold" />
      </p>

      <p className="mt-1 text-sm font-medium text-ink-soft">
        One run: {first.chain.map(showTerm).join(' → ')}
      </p>

      <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm font-medium">
        <span className="font-bold">All outputs</span>
        {forms.map((form) => (
          <span key={showTerm(form)} className="rounded-md bg-coin px-2 py-0.5 font-bold">
            <TermText term={form} />
          </span>
        ))}
      </p>
    </>
  )
}

/** The exercise's own options, each judged for the right reason. */
function Rejected({
  signature,
  rules,
  start,
  candidates,
}: {
  signature: Signature
  rules: string[]
  start: string
  candidates: string[]
}) {
  const system = rules.map((source) => R(source, signature))
  const term = parseTerm(start, signature)
  const outputs = new Set(normalForms(system, term).map(showTerm))

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">Candidate</th>
            <th className="py-2 pr-3 whitespace-nowrap">Output?</th>
            <th className="py-2">Why</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((source) => {
            const candidate = parseTerm(source, signature)
            const yes = outputs.has(showTerm(candidate))
            const stillReducible = redexes(system, candidate).length > 0
            return (
              <tr key={source} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="py-2 pr-3 whitespace-nowrap">
                  <TermText term={candidate} className="font-bold" />
                </td>
                <td className={`py-2 pr-3 font-bold ${yes ? 'text-grass-deep' : 'text-space-red'}`}>
                  {yes ? 'yes' : 'no'}
                </td>
                <td className="py-2 text-ink-soft">
                  {yes
                    ? 'reachable, and nothing matches it'
                    : stillReducible
                      ? 'a rule still fires in it, so the algorithm would not stop there'
                      : 'not reachable from the starting term at all'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Every redex of the starting term. */
function Forks({
  signature,
  rules,
  start,
}: {
  signature: Signature
  rules: string[]
  start: string
}) {
  const system = rules.map((source) => R(source, signature))
  const term = parseTerm(start, signature)
  const found = redexes(system, term)

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">At</th>
            <th className="py-2 pr-3 whitespace-nowrap">Rule</th>
            <th className="py-2">Leads to</th>
          </tr>
        </thead>
        <tbody>
          {found.map((redex, index) => (
            <tr key={index} className="border-t-2 border-dashed border-card-shade">
              <td className="formula py-2 pr-3 font-bold whitespace-nowrap">
                {showPosition(redex.position)}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                <EquationText
                  left={(system[redex.ruleIndex] as Rule).left}
                  right={(system[redex.ruleIndex] as Rule).right}
                  arrow="→"
                  className="text-xs font-bold"
                />
              </td>
              <td className="py-2">
                <TermText term={redex.result} className="font-bold" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
