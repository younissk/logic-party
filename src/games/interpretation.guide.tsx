/**
 * How to answer "does this equation hold under this interpretation?".
 *
 * The table is computed by `checkNamed` — the function the game marks with — so
 * every yes and no on this page is derived rather than copied, and the
 * counterexamples shown are real ones found by search.
 */

import { checkNamed, INTERPRETATIONS, parseEquation, type InterpretationId, type Signature } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { EquationText } from '@/ui/TermText'

const SIG: Signature = { f: 2, g: 2 }
const DISTRIBUTIVE = 'f(x,g(y,z))=g(f(x,y),f(x,z))'

const IDS = Object.keys(INTERPRETATIONS) as InterpretationId[]

export function InterpretationGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              Everywhere else in this chapter a term is a meaningless string. Here it is given a
              meaning: a set for the variables to range over, and a real operation for each function
              symbol. Then the equation is simply true or false.
            </p>
            <p>
              The exam form is: here is an equation and five readings of <Sym>f</Sym> and{' '}
              <Sym>g</Sym> — for which does it hold?
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The asymmetry that decides how to answer">
        <Callout tone="tip" title="Breaking it is cheap. Proving it is not.">
          <p>
            To show an equation <strong>fails</strong>, one set of values is enough, and anyone can
            check it in a line. To show it <strong>holds</strong>, you need an argument about every
            value there is — which for the readings here means recognising a law you already know.
          </p>
          <p className="mt-2">
            So always try to break it first, and only claim it holds once a few honest attempts have
            failed and you can name the law.
          </p>
        </Callout>

        <Callout tone="warn" title="Try 0, 1 and 2 before anything else">
          <p>
            Most failures show up there. <Sym>0</Sym> and <Sym>1</Sym> are the identities that make
            one side collapse, and <Sym>2</Sym> is the smallest value where doubling and squaring
            come apart. Values like 7 and 13 look more convincing and find nothing extra.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exam's own question, decided">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Exercise 4 · Collection Q12
          </p>
          <p className="mt-2">
            <EquationText
              left={parseEquation(DISTRIBUTIVE, SIG).left}
              right={parseEquation(DISTRIBUTIVE, SIG).right}
              className="text-lg font-bold"
            />
          </p>
          <Table equation={DISTRIBUTIVE} />
          <p className="mt-3 text-sm font-medium text-ink-soft">
            The three that hold are the three genuine distributive laws: multiplication over
            addition, union over intersection, and concatenation over “take the shorter one”. The
            two that fail do so because addition does not distribute over multiplication and
            exponentiation does not distribute over anything.
          </p>
        </Card>
      </GuideSection>

      <GuideSection title="The same five readings, a different law">
        <Card>
          <p className="mt-1">
            <EquationText
              left={parseEquation('f(x,y)=f(y,x)', SIG).left}
              right={parseEquation('f(x,y)=f(y,x)', SIG).right}
              className="text-lg font-bold"
            />
          </p>
          <Table equation="f(x,y)=f(y,x)" />
          <p className="mt-3 text-sm font-medium text-ink-soft">
            Note that concatenation is not commutative even though it distributes — the two
            questions are unrelated, and an interpretation that answered one does not answer the
            other.
          </p>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Pick a value for each variable and watch both sides evaluate live. The board says
                whether they agree, so you can hunt rather than guess.
              </li>
              <li>
                “Submit this counterexample” is refused while the two sides still agree — you cannot
                submit a set of values that proves nothing.
              </li>
              <li>
                The other button claims it holds for every value. That is the harder claim, and
                getting it wrong shows you the values you missed.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** Every named reading against one equation, decided live. */
function Table({ equation }: { equation: string }) {
  const parsed = parseEquation(equation, SIG)
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">f</th>
            <th className="py-2 pr-3 whitespace-nowrap">g</th>
            <th className="py-2 pr-3 whitespace-nowrap">Holds?</th>
            <th className="py-2">Where it breaks</th>
          </tr>
        </thead>
        <tbody>
          {IDS.map((id) => {
            const result = checkNamed(id, parsed)
            const describe = INTERPRETATIONS[id].describe as Record<string, string>
            return (
              <tr key={id} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="py-2 pr-3 text-ink-soft">{describe.f}</td>
                <td className="py-2 pr-3 text-ink-soft">{describe.g}</td>
                <td
                  className={`py-2 pr-3 font-bold ${result.holds ? 'text-grass-deep' : 'text-space-red'}`}
                >
                  {result.holds ? 'yes' : 'no'}
                </td>
                <td className="formula py-2 text-ink-soft">{result.counterexample ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
