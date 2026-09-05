/**
 * How to compose substitutions.
 *
 * Both orders of the notes' own example are computed by `compose` — the
 * function the game marks with — so the two columns cannot drift apart.
 */

import {
  applySubstitution,
  compose,
  parseTerm,
  showTerm,
  type Signature,
  type Substitution,
  type Term,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { SubstitutionText, TermText } from '@/ui/TermText'

const SIG: Signature = { f: 1, g: 2 }
const T = (source: string) => parseTerm(source, SIG)
const S = (mapping: Record<string, string>): Substitution =>
  Object.fromEntries(Object.entries(mapping).map(([name, source]) => [name, T(source)]))

const SIGMA = S({ x: 'f(x)' })
const PRIME = S({ x: 'y', y: 'f(x)' })

export function CompositionGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What a substitution does">
        <Card>
          <Prose>
            <p>
              A substitution maps variables to terms. Applying it means replacing every variable at
              once by its image — and there are two ways to get that wrong.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Simultaneously, not one mapping after another">
          <p>
            Applying <Sym>{'{x ↦ y, y ↦ f(x)}'}</Sym> to <Sym>g(f(x),y)</Sym> gives{' '}
            <Sym>g(f(y),f(x))</Sym>. Doing <Sym>x ↦ y</Sym> first and then <Sym>y ↦ f(x)</Sym> to
            the result gives <Sym>g(f(f(x)),f(x))</Sym>, which is wrong — the y that the first
            mapping created is not there to be replaced again.
          </p>
        </Callout>

        <Callout tone="warn" title="Once, not repeatedly">
          <p>
            <Sym>{'{x ↦ f(x)}'}</Sym> applied to <Sym>f(x)</Sym> gives <Sym>f(f(x))</Sym> and
            stops. Applying it to its own output forever is the endless loop the occurs check
            exists to prevent.
          </p>
          <p className="mt-2">
            The same rule settles exam26a's first true/false line: for{' '}
            <Sym>{'σ = {x ↦ f(y), y ↦ z}'}</Sym>, <Sym>σ(x)</Sym> is <Sym>f(y)</Sym>. It is{' '}
            <strong>not</strong> f(z) — you do not chase the y onwards.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Composition, and why the order shows">
        <Card>
          <Prose>
            <p>
              <Sym>σ ∘ σ′</Sym> is the single substitution with the same effect as applying{' '}
              <Sym>σ′</Sym> and then <Sym>σ</Sym>. To compute it, take every variable in either
              domain, look up its image under <Sym>σ′</Sym>, and apply <Sym>σ</Sym> to that whole
              term.
            </p>
          </Prose>
        </Card>

        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            The notes' example, both ways round
          </p>
          <div className="mt-2 flex flex-col gap-1 text-base font-bold">
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="w-8 shrink-0 opacity-70">σ</span>
              <SubstitutionText sigma={SIGMA} />
            </p>
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="w-8 shrink-0 opacity-70">σ′</span>
              <SubstitutionText sigma={PRIME} />
            </p>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <Order label="σ ∘ σ′" outer={SIGMA} inner={PRIME} />
            <Order label="σ′ ∘ σ" outer={PRIME} inner={SIGMA} />
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3 whitespace-nowrap">Variable</th>
                  <th className="py-2 pr-3 whitespace-nowrap">σ ∘ σ′</th>
                  <th className="py-2">σ′ ∘ σ</th>
                </tr>
              </thead>
              <tbody>
                {['x', 'y'].map((name) => (
                  <tr key={name} className="border-t-2 border-dashed border-card-shade">
                    <td className="formula py-2 pr-3 font-bold">{name}</td>
                    <td className="py-2 pr-3">
                      <TermText
                        term={applySubstitution(compose(SIGMA, PRIME), T(name))}
                        className="font-bold"
                      />
                    </td>
                    <td className="py-2">
                      <TermText
                        term={applySubstitution(compose(PRIME, SIGMA), T(name))}
                        className="font-bold"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-sm font-medium text-ink-soft">
            Different substitutions, from the same two inputs. Which is why the question always says
            which order it wants.
          </p>
        </Card>
      </GuideSection>

      <GuideSection title="The exam line, settled">
        <Card>
          <Prose>
            <p>
              exam26bA asks: if <Sym>{'σ = {x ↦ y}'}</Sym> and <Sym>{'σ′ = {y ↦ f(x)}'}</Sym>, is{' '}
              <Sym>{'σ ∘ σ′ = {x ↦ y, y ↦ f(y)}'}</Sym>?
            </p>
          </Prose>
          <Settled />
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                One builder per variable the composition moves. Each is labelled with the inner
                image already worked out, so what is left is applying the outer one to it.
              </li>
              <li>
                Tapping a symbol fills the leftmost hole and opens one per argument — you assemble
                the term, you do not type it.
              </li>
              <li>
                Every image is marked separately, so getting one right and one wrong is half marks
                rather than nothing.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One composition, computed and shown with a worked variable. */
function Order({
  label,
  outer,
  inner,
}: {
  label: string
  outer: Substitution
  inner: Substitution
}) {
  const composed = compose(outer, inner)
  const witness = T('g(x,y)')
  return (
    <div className="rounded-xl bg-card-shade px-3 py-2">
      <p className="flex flex-wrap items-baseline gap-2 text-base font-bold">
        <span className="shrink-0 opacity-70">{label}</span>
        <span className="opacity-60">=</span>
        <SubstitutionText sigma={composed} />
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-2 text-sm font-medium text-ink-soft">
        on <TermText term={witness} className="font-bold" />
        <span>→</span>
        <TermText term={applySubstitution(composed, witness)} className="font-bold" />
        <span className="opacity-70">
          (same as applying {label.slice(-2)} then the other:{' '}
          {showTerm(applySubstitution(outer, applySubstitution(inner, witness)))})
        </span>
      </p>
    </div>
  )
}

/** exam26bA's line, decided by `compose` rather than by hand. */
function Settled() {
  const sigma = S({ x: 'y' })
  const prime = S({ y: 'f(x)' })
  const composed = compose(sigma, prime)
  const claimed = S({ x: 'y', y: 'f(y)' })
  const agrees =
    showTerm(composed.x as Term) === showTerm(claimed.x as Term) &&
    showTerm(composed.y as Term) === showTerm(claimed.y as Term)

  return (
    <div className="mt-2 rounded-xl bg-card-shade px-3 py-2">
      <p className="flex flex-wrap items-baseline gap-2 text-base font-bold">
        <span className="opacity-70">σ ∘ σ′ =</span>
        <SubstitutionText sigma={composed} />
      </p>
      <p className={`mt-1 text-sm font-bold ${agrees ? 'text-grass-deep' : 'text-space-red'}`}>
        {agrees ? 'True.' : 'False.'} y goes to σ(f(x)) = f(y) — the x inside is moved by σ, in the
        same single pass.
      </p>
    </div>
  )
}
