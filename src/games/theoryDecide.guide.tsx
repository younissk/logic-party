/**
 * How to decide E ⊢ t=t′ in either direction.
 *
 * Every verdict on this page comes from `decide` — the function the game marks
 * with — so the proofs are real chains and the refutations are interpretations
 * that really do satisfy E and break the goal.
 */

import {
  INTERPRETATIONS,
  checkNamed,
  decide,
  parseEquation,
  showTerm,
  type InterpretationId,
  type Signature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { EquationText, TermText } from '@/ui/TermText'

const SIG: Signature = { f: 2, g: 2 }
const COMM = 'f(x,y)=f(y,x)'
const ASSOC = 'f(x,f(y,z))=f(f(x,y),z)'
const DIST = 'f(x,g(y,z))=g(f(x,y),f(x,z))'

export function TheoryDecideGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The theorem this game is">
        <Card>
          <Prose>
            <p>
              Theorem 3.19: <Sym>E ⊢ t=t′</Sym> if and only if <Sym>E ⊨ t=t′</Sym>. Provable by the
              closure rules, and true under every interpretation satisfying E, are the same thing.
            </p>
            <p>
              Read left to right it says the rules are <strong>sound</strong> — anything you derive
              really is true. Read right to left it says they are <strong>complete</strong> —
              anything true is derivable. Together they give you two ways to answer one question,
              and they are good at opposite things.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Which job are you on?">
          <p>
            <strong>To prove:</strong> build a chain. Finite work, and when it lands you are done.
          </p>
          <p className="mt-2">
            <strong>To refute:</strong> find one interpretation making every axiom true and the goal
            false. Also finite work, usually much less of it — and unlike the chain, you can often
            see it before you start searching.
          </p>
          <p className="mt-2">
            Hunting for a chain that does not exist is unbounded. So spend twenty seconds asking
            whether the goal is even <em>plausible</em> before you start walking.
          </p>
        </Callout>

        <Callout tone="warn" title="A refutation must satisfy every axiom">
          <p>
            An interpretation that breaks the goal but also breaks an axiom proves nothing at all —
            it is not a model of E, so E never promised anything about it. The board says, for each
            reading, whether it satisfies the axioms, and that half is free.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The classic: associativity does not give commutativity">
        <Decided axioms={[ASSOC]} goal={COMM} />
        <Prose>
          <p>
            Concatenation of strings is associative and famously not commutative, so it is a model
            of the axiom that breaks the goal. No amount of re-bracketing turns{' '}
            <Sym>f(x,y)</Sym> into <Sym>f(y,x)</Sym>, and that is the proof of it.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="And one that does follow">
        <Decided axioms={[ASSOC]} goal="f(x,f(f(y,z),w))=f(f(x,y),f(z,w))" />
        <Prose>
          <p>
            Both sides are the same four things in the same order, bracketed differently — and
            re-bracketing is exactly what the axiom does. Exercise 5 asks this one.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="More of the same shape">
        <Card>
          <Table
            rows={[
              [[COMM], DIST],
              [[DIST], COMM],
              [[ASSOC], DIST],
              [[COMM], 'f(g(x,y),g(y,x))=f(g(y,x),g(x,y))'],
            ]}
          />
          <p className="mt-3 text-sm font-medium text-ink-soft">
            Note that the refuting reading changes from row to row. There is no single
            interpretation that settles everything — you pick one that keeps the axioms you were
            given.
          </p>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Two tabs, and you may switch between them freely. Half the questions go each way, so
                committing to one job early is the main way to lose.
              </li>
              <li>
                Both answers are checked by running them, not by comparing to a stored verdict. A
                chain that reaches the goal is accepted; a reading that satisfies E and breaks the
                goal is accepted.
              </li>
              <li>
                Each reading is labelled with whether it satisfies the axioms, so the wrong half of
                the refutation is done for you and the interesting half is not.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

const IDS = Object.keys(INTERPRETATIONS) as InterpretationId[]

const refuterFor = (axioms: string[], goal: string): InterpretationId | undefined =>
  IDS.find(
    (id) =>
      axioms.every((source) => checkNamed(id, parseEquation(source, SIG)).holds) &&
      !checkNamed(id, parseEquation(goal, SIG)).holds,
  )

/** One question, worked whichever way it goes. */
function Decided({ axioms, goal }: { axioms: string[]; goal: string }) {
  const set = axioms.map((source) => parseEquation(source, SIG))
  const target = parseEquation(goal, SIG)
  const verdict = decide(set, target, { maxSize: 16, maxTerms: 6000 })

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">E</p>
      <div className="mt-1 flex flex-col gap-1">
        {set.map((axiom, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <EquationText left={axiom.left} right={axiom.right} className="font-bold" />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">Goal</p>
      <EquationText left={target.left} right={target.right} className="text-base font-bold" />

      {verdict.status === 'derivable' ? (
        <>
          <p className="mt-3 text-sm font-bold text-grass-deep">
            Derivable in {verdict.derivation.chain.length - 1} steps.
          </p>
          <ol className="mt-1 flex flex-col gap-0.5">
            {verdict.derivation.chain.map((term, index) => (
              <li key={index} className="flex items-baseline gap-2 rounded-xl bg-card-shade px-3 py-1">
                <span className="w-4 shrink-0 text-xs font-bold text-ink-soft">{index}</span>
                <TermText term={term} className="font-bold" />
              </li>
            ))}
          </ol>
        </>
      ) : verdict.status === 'not-derivable' ? (
        <>
          <p className="mt-3 text-sm font-bold text-space-red">Not derivable.</p>
          <p className="mt-1 text-sm font-medium text-ink-soft">
            Reading <span className="formula font-bold">f</span> as{' '}
            {INTERPRETATIONS[verdict.countermodel.id].describe.f} and{' '}
            <span className="formula font-bold">g</span> as{' '}
            {INTERPRETATIONS[verdict.countermodel.id].describe.g}: every axiom holds, and the goal
            fails at {verdict.countermodel.where}.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm font-bold text-ink-soft">
          Neither a chain nor a reading settled it within the search bounds.
        </p>
      )}
    </Card>
  )
}

/** Several questions at once, each decided live. */
function Table({ rows }: { rows: [string[], string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">E</th>
            <th className="py-2 pr-3 whitespace-nowrap">Goal</th>
            <th className="py-2 pr-3 whitespace-nowrap">Follows?</th>
            <th className="py-2">How you show it</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([axioms, goal]) => {
            const set = axioms.map((source) => parseEquation(source, SIG))
            const target = parseEquation(goal, SIG)
            const verdict = decide(set, target, { maxSize: 16, maxTerms: 6000 })
            const refuter = refuterFor(axioms, goal)
            return (
              <tr key={`${axioms.join(';')}|${goal}`} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="formula py-2 pr-3 text-xs whitespace-nowrap">
                  {axioms.map((source) => showTerm(parseEquation(source, SIG).left)).join(', ')} …
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <EquationText left={target.left} right={target.right} className="text-xs font-bold" />
                </td>
                <td
                  className={`py-2 pr-3 font-bold ${
                    verdict.status === 'derivable' ? 'text-grass-deep' : 'text-space-red'
                  }`}
                >
                  {verdict.status === 'derivable' ? 'yes' : 'no'}
                </td>
                <td className="py-2 text-ink-soft">
                  {verdict.status === 'derivable'
                    ? `a chain of ${verdict.derivation.chain.length - 1}`
                    : refuter === undefined
                      ? '—'
                      : `f as ${INTERPRETATIONS[refuter].describe.f}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
