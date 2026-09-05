/**
 * What is in a Herbrand universe.
 *
 * The tables are produced by `herbrandLanguage` and `herbrandUniverse` — the
 * functions the game marks with — so the exercise's own option list is decided
 * rather than transcribed.
 */

import {
  herbrandLanguage,
  herbrandUniverse,
  parseFoClauseSet,
  showTerm,
  type FoSignature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { TermText } from '@/ui/TermText'

const SIG: FoSignature = {
  predicates: { p: 2, q: 2 },
  functions: { a: 0, b: 0, f: 2, g: 1, h: 3 },
}

const SMALL: FoSignature = { predicates: { p: 1 }, functions: { a: 0, c: 0, f: 1 } }

export function HerbrandUniverseGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What it is">
        <Card>
          <Prose>
            <p>
              The <strong>Herbrand universe</strong> of a set of clauses is the set of all{' '}
              <em>ground terms</em> built from the constants and function symbols occurring in it.
              Nothing else: no invented symbols, no variables, no atoms.
            </p>
            <p>
              It matters because Theorem 4.20 says a clause set is unsatisfiable exactly when it has
              no Herbrand model — so the universe of ground terms is the only universe you ever have
              to think about.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="How to build it">
          <p>
            Start with the constants. Then wrap every function symbol around every combination of
            what you already have, and repeat. With any symbol of arity one or more the set is
            infinite, so in practice you build it to a depth.
          </p>
        </Callout>

        <Callout tone="warn" title="Three things that are not in it">
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            <li>
              A term with a <strong>variable</strong>. <Sym>h(x,b(),b())</Sym> is a term, and it is
              not ground.
            </li>
            <li>
              An <strong>atom</strong>. <Sym>p(a(),b())</Sym> is a formula, not a term — the universe
              is what predicates are applied <em>to</em>.
            </li>
            <li>
              A symbol that <strong>does not occur</strong>. If the clauses never mention{' '}
              <Sym>c</Sym>, no term containing it is in the universe.
            </li>
          </ul>
        </Callout>

        <Callout tone="warn" title="No constant? Invent one.">
          <p>
            A universe must be nonempty, so if the clause set contains no constant symbol at all, one
            is added — the notes use <Sym>a</Sym>. Example 4.19.2 turns on exactly this.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Exercise 8's option list, decided">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            p(a(),h(x,b(),b())) ∨ q(y,f(g(x),a()))
          </p>
          <Options
            clauses={['p(a(),h(x,b(),b())) ∨ q(y,f(g(x),a()))']}
            signature={SIG}
            candidates={[
              'h(a(),a(),a())',
              'a()',
              'c()',
              'g(b())',
              'h(x,b(),b())',
              'x',
              'h(a(),b())',
            ]}
          />
          <p className="mt-3 text-sm font-medium text-ink-soft">
            <Sym>h(a(),b())</Sym> fails for a duller reason than the others: h takes three arguments,
            so that string is not a term at all.
          </p>
        </Card>
      </GuideSection>

      <GuideSection title="With and without a constant">
        <Built clauses={['p(a())', '¬p(f(x))']} signature={SMALL} caption="A constant is there" />
        <Built clauses={['¬p(x)', 'p(f(x))']} signature={SMALL} caption="None is — one is invented" />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                The builder's palette holds exactly the symbols the clauses use, and no variables —
                so an element you can build is ground by construction.
              </li>
              <li>
                Build a term, bank it, build the next. A duplicate is refused; something deeper than
                asked for is banked and then marked as too deep.
              </li>
              <li>
                When the clause set has no constant, the invented one appears on the palette and the
                board says so.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** The exercise's candidates, each judged against the real universe. */
function Options({
  clauses,
  signature,
  candidates,
}: {
  clauses: string[]
  signature: FoSignature
  candidates: string[]
}) {
  const parsed = parseFoClauseSet(clauses, signature)
  const universe = new Set(herbrandUniverse(parsed, 1).map(showTerm))

  const why = (source: string): string => {
    if (universe.has(source)) return 'ground, over symbols that occur'
    if (/[xyz]/.test(source)) return 'not ground — it has a variable in it'
    if (source.startsWith('p(') || source.startsWith('q(')) return 'an atom, not a term'
    if (source.startsWith('c(')) return 'c does not occur in the clauses'
    if (source.startsWith('h(') && source.split(',').length < 3) return 'h takes three arguments'
    return 'not reachable at this depth'
  }

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">Candidate</th>
            <th className="py-2 pr-3 whitespace-nowrap">In it?</th>
            <th className="py-2">Why</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((source) => {
            const inside = universe.has(source)
            return (
              <tr key={source} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="formula py-2 pr-3 font-bold whitespace-nowrap">{source}</td>
                <td
                  className={`py-2 pr-3 font-bold ${inside ? 'text-grass-deep' : 'text-space-red'}`}
                >
                  {inside ? 'yes' : 'no'}
                </td>
                <td className="py-2 text-ink-soft">{why(source)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** One clause set with its language and its universe, both computed. */
function Built({
  clauses,
  signature,
  caption,
}: {
  clauses: string[]
  signature: FoSignature
  caption: string
}) {
  const parsed = parseFoClauseSet(clauses, signature)
  const language = herbrandLanguage(parsed)
  const universe = herbrandUniverse(parsed, 2)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-1 flex flex-col gap-1">
        {parsed.map((clause, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <FoClauseText clause={clause} className="font-bold" />
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm font-medium">
        <strong>Constants</strong>{' '}
        <span className="formula">{language.constants.map(showTerm).join(', ')}</span>
        {language.invented && <span className="text-space-red"> (invented)</span>}
      </p>
      <p className="mt-1 text-sm font-medium">
        <strong>Functions</strong>{' '}
        <span className="formula">
          {language.functions.length === 0
            ? 'none — the universe is finite'
            : language.functions.map(([name, arity]) => `${name}/${arity}`).join(', ')}
        </span>
      </p>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {universe.map((term) => (
          <span key={showTerm(term)} className="rounded-md bg-coin px-2 py-0.5 text-sm font-bold">
            <TermText term={term} />
          </span>
        ))}
        {language.functions.length > 0 && (
          <span className="px-2 py-0.5 text-sm font-bold text-ink-soft">…</span>
        )}
      </p>
    </Card>
  )
}
