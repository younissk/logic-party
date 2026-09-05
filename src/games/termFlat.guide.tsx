/**
 * How to read a term with no commas or brackets.
 *
 * The worked example is parsed live by `parseFlatTerm` — the same function the
 * game marks with — so the structure shown is computed, not transcribed.
 */

import {
  flatSpans,
  flatten,
  isSubterm,
  parseFlatTerm,
  parseTerm,
  showTerm,
  termVariables,
  type Signature,
  type Term,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { TermText } from '@/ui/TermText'

const EX4: Signature = { f: 2, g: 2, h: 1 }
const COLLECTION: Signature = { f: 2, g: 1, h: 3 }

export function TermFlatGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              A term was typed on a keyboard whose comma and bracket keys are dead, so all you get
              is the letters. Given the arity of each function symbol, put the structure back.
            </p>
            <p>
              It works because <strong>a term is read left to right and every symbol says how many
              terms must follow it</strong>. A symbol of arity 2 is followed by two complete terms,
              each of which is read the same way. Nothing is ambiguous, and nothing is guessed.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="The counting rule">
          <p>
            Walk the letters with a counter. Start it at 1 — one term is expected. Each letter you
            pass consumes one expected term and adds its own arity. A variable adds nothing. The
            term ends exactly when the counter hits zero.
          </p>
          <p className="mt-2">
            If the counter hits zero early, letters are left over. If you run out of letters while
            the counter is above zero, the string is not a term at all.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exercise, worked">
        <Worked letters="fgxhygzfxy" signature={EX4} label="Exercise 4" />
      </GuideSection>

      <GuideSection title="The same letters, different arities, different term">
        <Prose>
          <p>
            The Collection asks the same question with <Sym>a(f) = 2</Sym>, <Sym>a(g) = 1</Sym> and{' '}
            <Sym>a(h) = 3</Sym>. Nothing about the string changes; the reading changes completely.
          </p>
        </Prose>
        <Worked letters="fhxgyfxyghxgyfxy" signature={COLLECTION} label="Collection, Question 11" />
      </GuideSection>

      <GuideSection title="Traps worth knowing">
        <Callout tone="warn" title="A subterm is a stretch of letters, and a proper one">
          <p>
            Every subterm occupies a run of consecutive letters — but not every run is a subterm.{' '}
            <Sym>g(</Sym> and <Sym>g(x,y),g</Sym> are both prefixes of something and neither is a
            term. In the game a span that is not exactly right is refused rather than half-credited.
          </p>
        </Callout>

        <Callout tone="warn" title="var(t) holds variables, not every letter">
          <p>
            Function symbols are not variables, however short their names are. And a variable listed
            in <Sym>V</Sym> need not actually occur — the question asks what is in the term, not what
            was available.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                For each named subterm, tap its first letter and then its last. A correct span locks
                green; anything else is refused with a shake, so you cannot fish for it.
              </li>
              <li>
                Then tick the variables that really occur. The chips include variables that do not,
                so the row is a question rather than a formality.
              </li>
              <li>
                Both halves are marked, and each counts. Getting every span right with the wrong{' '}
                <Sym>var(t)</Sym> is most of the marks, not all of them.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** The reading, computed rather than written out. */
function Worked({
  letters,
  signature,
  label,
}: {
  letters: string
  signature: Signature
  label: string
}) {
  const term = parseFlatTerm(letters, signature)
  if (term === null) {
    return (
      <Card>
        <p className="text-sm font-bold">Those letters do not spell a term.</p>
      </Card>
    )
  }

  const spans = flatSpans(term).filter((span) => span.term.kind === 'fn')
  const arities = Object.entries(signature).sort(([a], [b]) => a.localeCompare(b))

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{label}</p>

      <p className="formula mt-2 text-lg font-bold tracking-[0.2em]">{letters}</p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        {arities.map(([name, arity]) => `a(${name}) = ${arity}`).join(', ')}
      </p>

      <p className="mt-3 text-sm font-bold">Reads as</p>
      <TermText term={term} className="text-lg font-bold" />

      <p className="mt-3 text-sm font-bold">Every subterm with structure, and where it sits</p>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">Letters</th>
              <th className="py-1.5">Subterm</th>
            </tr>
          </thead>
          <tbody>
            {spans.map((span, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade">
                <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums text-ink-soft">
                  {span.start + 1}–{span.end}
                  <span className="formula ml-2 font-bold text-ink">
                    {flatten(span.term)}
                  </span>
                </td>
                <td className="py-1.5">
                  <TermText term={span.term} className="font-bold" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm font-medium">
        <strong>var(t)</strong> = {`{${termVariables(term).join(', ')}}`}
      </p>

      <Distractors term={term} signature={signature} />
    </Card>
  )
}

/**
 * The near-misses the exercise offers, each decided live.
 *
 * Some of them are not even terms under these arities, which is a different
 * kind of wrong from "a term, but not one of these".
 */
function Distractors({ term, signature }: { term: Term; signature: Signature }) {
  const candidates =
    Object.keys(signature).includes('h') && signature.h === 1
      ? ['g(x,y)', 'g(x,h(y))', 'f(x,y)', 'g(z,f(x))']
      : ['h(x,g(y))', 'h(x,g(y),f(x,y))', 'g(h(x,g(y),f(x,y)))', 'f(x,y)']

  return (
    <>
      <p className="mt-3 text-sm font-bold">Is it a subterm?</p>
      <ul className="mt-1 flex flex-col gap-1 text-sm font-medium">
        {candidates.map((source) => {
          let verdict: string
          let tone: string
          try {
            const candidate = parseTerm(source, signature)
            const yes = isSubterm(candidate, term)
            verdict = yes ? 'yes' : 'no — it is a term, just not one of these'
            tone = yes ? 'text-grass-deep' : 'text-space-red'
          } catch {
            verdict = 'not even a term under these arities'
            tone = 'text-space-red'
          }
          return (
            <li key={source} className="flex flex-wrap items-baseline gap-2">
              <span className="formula font-bold">{source}</span>
              <span className={`font-bold ${tone}`}>{verdict}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs font-medium text-ink-soft">
        Decided against {showTerm(term)} by the same functions the game marks with.
      </p>
    </>
  )
}
