/**
 * How to reduce a term.
 *
 * Both worked runs come from `reduce` and `normalForms` — the functions the
 * game marks with — so the chains are the ones the algorithm really produces.
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

const SIG: Signature = { f: 1, g: 2, h: 2, p: 2, s: 1, t: 2 }

const R = (source: string, signature: Signature = SIG): Rule => {
  const [left, right] = source.split('->')
  return rule(parseTerm(left as string, signature), parseTerm(right as string, signature))
}

export function ReduceGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What a reduction system is">
        <Card>
          <Prose>
            <p>
              A set of equations already pointed downhill, written{' '}
              <Sym>l → r</Sym> rather than <Sym>l = r</Sym> to make the direction part of the
              notation. Two conditions, both from §3.3:
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>
                <Sym>l ≻ r</Sym> in some term order, so every step goes down and the process has to
                stop.
              </li>
              <li>
                Every variable on the right also appears on the left, so a step never has to invent a
                term.
              </li>
            </ul>
          </Prose>
        </Card>

        <Callout tone="tip" title="Algorithm 3.21, in one sentence">
          <p>
            While some subterm <Sym>s</Sym> matches a rule's left side under a substitution{' '}
            <Sym>σ</Sym>, replace that subterm by <Sym>σ(r)</Sym>.
          </p>
          <p className="mt-2">
            The word doing the work is <strong>subterm</strong>. A rule can fire deep inside a term,
            and the redex you need is often not at the top.
          </p>
        </Callout>

        <Callout tone="warn" title="New redexes appear as you go">
          <p>
            Rewriting one subterm can bring two symbols together that were apart before, creating a
            match that was not there at the start. So "no rule applies to the original term" is not
            a thing you check once — it is what you check after every step.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The notes' first example">
        <Run rules={['f(f(x))->f(x)']} start="f(f(f(f(x))))" caption="Example 3.22.1" />
      </GuideSection>

      <GuideSection title="The exam question">
        <Run
          rules={['g(f(x),y)->f(y)', 'h(x,f(y))->f(x)']}
          start="g(g(h(x,f(z)),y),f(x))"
          caption="exam26a, Question 2.4"
        />
      </GuideSection>

      <GuideSection title="Where the redexes are">
        <Card>
          <Prose>
            <p>
              Every subterm is a candidate, so the honest way to look is position by position. Here
              is one term with every place a rule fires listed.
            </p>
          </Prose>
          <Positions rules={['f(f(x))->f(x)']} start="f(f(f(f(x))))" />
        </Card>
      </GuideSection>

      <GuideSection title="The choice that will matter later">
        <Callout tone="warn" title="Different choices, different answers">
          <p>
            Algorithm 3.21 says "pick such a subterm" and does not say which. For some systems that
            freedom is harmless — every route ends in the same place. For others it is not, and the
            whole of §3.4 exists to fix it.
          </p>
        </Callout>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Example 3.23</p>
          <Forks rules={['g(x,f(y))->f(x)', 'g(f(x),y)->h(x,x)']} start="g(f(x),f(y))" />
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Every place a rule fires is a button, showing the whole term afterwards and which
                rule did it. Tap one and it joins your run.
              </li>
              <li>
                Stop when the board says nothing matches. Submitting early is marked as not a normal
                form, with partial credit for how far you got.
              </li>
              <li>
                When several normal forms are reachable, any of them counts — and the verdict says
                how many there were, which is the lead-in to the next game.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One reduction, run by `reduce`. */
function Run({ rules, start, caption }: { rules: string[]; start: string; caption: string }) {
  const system = rules.map((source) => R(source))
  const term = parseTerm(start, SIG)
  const run = reduce(system, term)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-1 flex flex-col gap-1">
        {system.map((entry, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <EquationText left={entry.left} right={entry.right} arrow="→" className="font-bold" />
          </div>
        ))}
      </div>
      <ol className="mt-3 flex flex-col gap-1">
        {run.chain.map((entry, index) => (
          <li key={index} className="flex items-baseline gap-2 rounded-xl bg-card-shade px-3 py-1">
            <span className="w-4 shrink-0 text-xs font-bold text-ink-soft">{index}</span>
            <TermText term={entry} className="text-base font-bold" />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm font-medium text-ink-soft">
        {run.steps.length} steps to {showTerm(run.result)}, which nothing matches.
      </p>
    </Card>
  )
}

/** Every redex of one term, by position. */
function Positions({ rules, start }: { rules: string[]; start: string }) {
  const system = rules.map((source) => R(source))
  const term = parseTerm(start, SIG)
  const found = redexes(system, term)

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">Position</th>
            <th className="py-2 pr-3 whitespace-nowrap">Rule</th>
            <th className="py-2">Result</th>
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
      <p className="mt-2 text-xs font-medium text-ink-soft">
        ε is the whole term; 1 is its first argument, 1.1 that argument's first, and so on.
      </p>
    </div>
  )
}

/** Every normal form reachable from one term. */
function Forks({ rules, start }: { rules: string[]; start: string }) {
  const system = rules.map((source) => R(source))
  const term = parseTerm(start, SIG)
  const forms = normalForms(system, term)

  return (
    <>
      <div className="mt-1 flex flex-col gap-1">
        {system.map((entry, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <EquationText left={entry.left} right={entry.right} arrow="→" className="font-bold" />
          </div>
        ))}
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm font-medium">
        From <TermText term={term} className="font-bold" /> you can reach
        {forms.map((form) => (
          <span key={showTerm(form)} className="rounded-md bg-coin px-2 py-0.5 font-bold">
            <TermText term={form} />
          </span>
        ))}
      </p>
      <p className="mt-2 text-sm font-medium text-ink-soft">
        {forms.length === 1
          ? 'One answer, whichever route you take.'
          : `${forms.length} different answers, and the equation between them still belongs to the theory. That is the problem completion solves.`}
      </p>
    </>
  )
}
