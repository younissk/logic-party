/**
 * How to build terms to order, and what the true/false questions behind it are
 * really asking.
 *
 * Every claim on this page is decided live by the same functions the game
 * marks with, so nothing here can drift away from the marking.
 */

import {
  isGround,
  parseTerm,
  showTerm,
  termDepth,
  termSize,
  termVariables,
  type Signature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { TermText } from '@/ui/TermText'

const SIG: Signature = { f: 1, g: 2, c: 0 }

export function TermBuildGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              A signature — which function symbols exist and how many arguments each takes — a set of
              variables, and two or three conditions. Assemble a term meeting all of them at once.
            </p>
            <p>
              Definition 3.1 gives you exactly two moves, and the builder gives you exactly those
              two: a variable is a term, and a function symbol of arity <Sym>n</Sym> followed by{' '}
              <Sym>n</Sym> terms is a term. Nothing else.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The four words the conditions use">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3 whitespace-nowrap">Word</th>
                  <th className="py-2">Means</th>
                </tr>
              </thead>
              <tbody>
                <Row word="ground" means="var(t) = ∅ — no variables anywhere in it." />
                <Row
                  word="symbols"
                  means="Function symbols and variable occurrences, counted with repetition. g(f(x),x) has four."
                />
                <Row
                  word="depth"
                  means="How far the nesting goes. A variable or a constant has depth 1."
                />
                <Row
                  word="var(t)"
                  means="The set of variables occurring — a set, so a variable used twice counts once."
                />
              </tbody>
            </table>
          </div>
        </Card>

        <Measured source="g(f(x),x)" />
        <Measured source="g(c(),f(c()))" />
      </GuideSection>

      <GuideSection title="The true/false questions this is really about">
        <Callout tone="tip" title="When is T(F, a, V) infinite?">
          <p>
            Exactly when you can always make a term bigger — which needs a symbol of arity at least
            one to wrap things in, and something to start from. So:{' '}
            <strong>if V is non-empty and some symbol has arity greater than zero</strong>, the set
            is infinite. That is Exercise 4's first true statement.
          </p>
          <p className="mt-2">
            The converse matters too: if F and V are finite and T(F, a, V) is infinite, some symbol
            must have positive arity — with every arity zero you can only write down the constants
            themselves.
          </p>
        </Callout>

        <Callout tone="warn" title="Ground terms do not require V to be empty">
          <p>
            "If |V| &gt; 0 then there are no ground terms" is <strong>false</strong>. Having
            variables available does not oblige you to use them: with a single constant{' '}
            <Sym>c</Sym> in the signature, <Sym>c()</Sym> is ground however many variables exist.
          </p>
          <p className="mt-2">
            The real condition is the other one — <Sym>T(F, a, V)</Sym> contains a ground term only
            if there is at least one constant symbol to start from.
          </p>
        </Callout>

        <Callout tone="tip" title="Every subterm of a term is a term">
          <p>
            True, and worth holding onto: it is what makes “point at the subterm” a well-posed
            question in the first place, and what lets reduction rewrite deep inside a term without
            leaving the set.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tapping a symbol drops it into the leftmost hole and opens one new hole per
                argument. You never type a bracket, so you can never mis-bracket.
              </li>
              <li>
                Conditions turn green as they come true. All of them have to be green at once —
                hitting the symbol count by dropping a variable you needed is the usual trap.
              </li>
              <li>
                There is always at least one term that works, and usually many. Yours does not have
                to match the one shown afterwards.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Row({ word, means }: { word: string; means: string }) {
  return (
    <tr className="border-t-2 border-dashed border-card-shade align-top">
      <td className="py-2 pr-3 font-bold whitespace-nowrap">{word}</td>
      <td className="py-2 text-ink-soft">{means}</td>
    </tr>
  )
}

/** A term with its measurements computed, never written down. */
function Measured({ source }: { source: string }) {
  const term = parseTerm(source, SIG)
  return (
    <Card className="bg-card-shade">
      <TermText term={term} className="text-lg font-bold" />
      <p className="mt-1 text-sm font-semibold text-ink-soft">
        {termSize(term)} symbols · depth {termDepth(term)} · var(t) ={' '}
        {termVariables(term).length === 0 ? '∅' : `{${termVariables(term).join(', ')}}`} ·{' '}
        {isGround(term) ? 'ground' : 'not ground'}
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Measured from {showTerm(term)} by the functions the game marks with.
      </p>
    </Card>
  )
}
