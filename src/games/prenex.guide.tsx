/**
 * How to reach a prenex normal form.
 *
 * Both runs of Example 4.14 are produced by `pnfOptions` and `toPrenex` — the
 * functions the game marks with — so the two different prefixes are computed
 * rather than transcribed.
 */

import {
  isPrenex,
  parseFormula,
  pnfOptions,
  showFormula,
  splitPrenex,
  toPrenex,
  PNF_RULE_LABELS,
  type FoFormula,
  type FoSignature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'

const SIG: FoSignature = {
  predicates: { p: 2, q: 3, r: 1, s: 1 },
  functions: { a: 0, f: 1 },
}

export function PrenexGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What PNF is and why it is wanted">
        <Card>
          <Prose>
            <p>
              A formula is in <strong>prenex normal form</strong> when it is a run of quantifiers
              followed by a quantifier-free matrix: <Sym>Q₁x₁…Qₙxₙ:ψ</Sym>. The quantifiers are the
              prefix, ψ is the matrix.
            </p>
            <p>
              Everything after this needs it. Skolemization reads the ∀ variables to the left of each
              ∃, which only exists once the prefix is out front, and clausification needs a matrix it
              can push into CNF.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="What to look for">
          <p>
            A formula is not in PNF exactly when some connective sits <em>above</em> a quantifier. So
            scan for a ¬, ∧, ∨, → or ↔ with a quantifier under it, and apply the equivalence that
            moves the connective inside.
          </p>
        </Callout>

        <Callout tone="warn" title="Clean first, or you get stuck">
          <p>
            <Sym>(∀x:p(x))∨(∀x:q(x))</Sym> cannot be prenexed as it stands: pulling either
            quantifier out would capture the other's x. Renaming one of them — bounded renaming,
            which preserves equivalence — is the repair, and the game hands you formulas already
            clean.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Figure 4.1, the whole toolkit">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3 whitespace-nowrap">Rule</th>
                  <th className="py-2">What it does</th>
                </tr>
              </thead>
              <tbody>
                <Row rule="iff" says="Splits ↔ into two implications, so the quantifier rules can reach inside." />
                <Row rule="not-forall" says="A negation swaps the quantifier as it passes through." />
                <Row rule="not-exists" says="The same, the other way." />
                <Row
                  rule="forall-implies-left"
                  says="On the LEFT of →, ∀ becomes ∃. The antecedent is negative."
                />
                <Row
                  rule="exists-implies-left"
                  says="And ∃ becomes ∀ there. This is the one people forget."
                />
                <Row rule="quantifier-left" says="Under ∧ or ∨, the quantifier comes out unchanged." />
                <Row
                  rule="quantifier-right"
                  says="On the right of ∧, ∨ or →, unchanged as well — the right of → is positive."
                />
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="warn" title="Only the left of an implication flips">
          <p>
            <Sym>(∀x:φ)→ψ</Sym> becomes <Sym>∃x:(φ→ψ)</Sym>, but{' '}
            <Sym>ψ→(∀x:φ)</Sym> becomes <Sym>∀x:(ψ→φ)</Sym>. Reading{' '}
            <Sym>A→B</Sym> as <Sym>¬A∨B</Sym> makes it obvious: the negation is on A only.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Example 4.14, both ways">
        <Prose>
          <p>
            The same formula, two orders of choices, two prefixes. The notes point this out
            explicitly: <Sym>∀z∃u</Sym> in one, <Sym>∃u∀z</Sym> in the other.
          </p>
        </Prose>
        <Run
          source="∀x:∃y:((∃z:(p(x,z)∨p(y,z)))→¬∀w:¬q(x,y,w))"
          caption="Taking the outermost option each time"
        />
        <Choices source="∀x:∃y:((∃z:(p(x,z)∨p(y,z)))→¬∀w:¬q(x,y,w))" />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Every applicable equivalence is offered, with the rule that produced it. Pick one and
                it joins the chain.
              </li>
              <li>
                When more than one applies, either is correct and they lead to different prefixes.
                The shortest route is stated, so you know when you have wandered rather than failed.
              </li>
              <li>
                Undo freely. Nothing here can go wrong permanently — every step preserves
                equivalence.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Row({ rule, says }: { rule: keyof typeof PNF_RULE_LABELS; says: string }) {
  return (
    <tr className="border-t-2 border-dashed border-card-shade align-top">
      <td className="formula py-2 pr-3 font-bold whitespace-nowrap">{PNF_RULE_LABELS[rule]}</td>
      <td className="py-2 text-ink-soft">{says}</td>
    </tr>
  )
}

/** One run, step by step, produced by the game's own step function. */
function Run({ source, caption }: { source: string; caption: string }) {
  const formula = parseFormula(source, SIG)
  const run = toPrenex(formula)
  const chain: FoFormula[] = [formula]
  for (const step of run.steps) chain.push(step.result)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <ol className="mt-2 flex flex-col gap-1">
        {chain.map((entry, index) => (
          <li key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <FoText formula={entry} className="text-sm font-bold" />
            {index > 0 && (
              <p className="formula mt-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
                {PNF_RULE_LABELS[(run.steps[index - 1] as { rule: keyof typeof PNF_RULE_LABELS }).rule]}
              </p>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm font-medium text-ink-soft">
        Prefix{' '}
        <span className="formula font-bold text-ink">
          {splitPrenex(run.result)
            .prefix.map((entry) => `${entry.quantifier === 'forall' ? '∀' : '∃'}${entry.variable}`)
            .join('')}
        </span>
        , matrix {showFormula(splitPrenex(run.result).matrix)}.{' '}
        {isPrenex(run.result) ? 'In PNF.' : 'Not in PNF.'}
      </p>
    </Card>
  )
}

/** Where the run had a choice, and what each branch would have given. */
function Choices({ source }: { source: string }) {
  const formula = parseFormula(source, SIG)
  let current = formula
  const forks: { at: number; options: { rule: string; result: FoFormula }[] }[] = []

  for (let step = 0; step < 20; step++) {
    const options = pnfOptions(current)
    if (options.length === 0) break
    if (options.length > 1) {
      forks.push({
        at: step,
        options: options.map((option) => ({
          rule: PNF_RULE_LABELS[option.rule],
          result: option.result,
        })),
      })
    }
    current = (options[0] as { result: FoFormula }).result
  }

  if (forks.length === 0) {
    return (
      <Card>
        <p className="text-sm font-medium text-ink-soft">
          This run has no choice in it — every step had exactly one equivalence available.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
        Where the choice is
      </p>
      {forks.map((fork) => (
        <div key={fork.at} className="mt-2">
          <p className="text-sm font-bold">After {fork.at} step{fork.at === 1 ? '' : 's'}:</p>
          <ul className="mt-1 flex flex-col gap-1">
            {fork.options.map((option, index) => (
              <li key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
                <FoText formula={option.result} className="text-sm font-bold" />
                <p className="formula mt-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
                  {option.rule}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="mt-2 text-sm font-medium text-ink-soft">
        Both branches reach a prenex form. They do not reach the same one.
      </p>
    </Card>
  )
}
