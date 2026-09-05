/**
 * Solution sets in the plane.
 *
 * Each picture is drawn by evaluating the formula on a grid, so the shading is
 * computed by the same code the game marks with. The membership table is
 * likewise evaluated rather than described.
 */

import { evaluateReal, showReal, type RealFormula } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { GRID, SPAN, cellCentre, regionOf, shading } from './pickThePicture'

const SHOWN = ['x2-le-y', 'y-le-x', 'conjunction', 'implication']

const PROBES: readonly { x: number; y: number }[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 2, y: 1 },
  { x: 0.5, y: 0.5 },
  { x: -1, y: 2 },
]

function Picture({ formula, size = 116 }: { formula: RealFormula; size?: number }) {
  const cells = shading(formula)
  const step = size / GRID
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="rounded-xl bg-card">
      {cells.map((inside, index) =>
        inside ? (
          <rect
            key={index}
            x={(index % GRID) * step}
            y={Math.floor(index / GRID) * step}
            width={step + 0.4}
            height={step + 0.4}
            className="fill-space-blue/45"
          />
        ) : null,
      )}
      <line x1={0} y1={size / 2} x2={size} y2={size / 2} className="stroke-ink/35" strokeWidth={1} />
      <line x1={size / 2} y1={0} x2={size / 2} y2={size} className="stroke-ink/35" strokeWidth={1} />
    </svg>
  )
}

function ProbeTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1">point</th>
            {SHOWN.map((id) => (
              <th key={id} className="px-2 py-1 font-logic normal-case">
                {showReal(regionOf(id).formula)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PROBES.map((point) => (
            <tr key={`${point.x},${point.y}`}>
              <td className="px-2 py-1 font-logic font-bold">
                ({point.x}, {point.y})
              </td>
              {SHOWN.map((id) => (
                <td key={id} className="px-2 py-1 font-bold">
                  {evaluateReal(regionOf(id).formula, point) ? 'in' : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PickThePictureGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="A formula is a region">
        <Card>
          <Prose>
            <p>
              Two free variables, so every point of the plane either satisfies the formula or does
              not. The shaded area is just that set. Nothing about it is geometric: it is decided
              point by point by substituting coordinates.
            </p>
            <p>
              Which makes probing the method. Pick a point where you know what the formula says, and
              a picture that disagrees with it is out. Two or three well-chosen points usually
              settle a ten-option question.
            </p>
          </Prose>
          <div className="mt-3 flex flex-wrap gap-3">
            {SHOWN.map((id) => (
              <div key={id} className="flex flex-col items-center gap-1">
                <Picture formula={regionOf(id).formula} />
                <span className="font-logic text-xs font-bold">
                  {showReal(regionOf(id).formula)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Callout tone="warn" title="An implication shades almost everything">
          <p>
            This is Exercise 12's trap. <Sym>{'x²≤y → y≤x'}</Sym> is true at every point where{' '}
            <Sym>{'x²≤y'}</Sym> fails, which is most of the plane — the whole region below the
            parabola. Only inside the parabola does the conclusion have to be checked. So the
            picture is the complement of a small lens, not a small lens.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Five probes, four regions">
        <Card>
          <ProbeTable />
          <Prose>
            <p className="mt-3">
              <Sym>(0,-1)</Sym> is the one that separates the implication from the conjunction: the
              premise fails there, so the implication holds and the conjunction does not. One point,
              two options eliminated.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Boundaries: ≤ or <">
          <p>
            A strict inequality leaves the curve itself out of the set. At the resolution of a
            picture that is invisible, so it can never be what tells two options apart — check the
            interiors instead.
          </p>
        </Callout>

        <Callout tone="tip" title="Why this is in the chapter">
          <p>
            Tarski's theorem says <Sym>T(R,=,+,*)</Sym> is decidable, by quantifier elimination. A
            quantifier-free formula over the reals is exactly a boolean combination of polynomial
            comparisons — which is to say, a region like these. Eliminating a quantifier is
            projecting one of these shapes onto an axis.
          </p>
        </Callout>

        <Callout tone="warn" title="The window is only a window">
          <p>
            These pictures run from −{SPAN} to {SPAN} on both axes, sampled on a {GRID}×{GRID} grid
            whose first cell centre is {cellCentre(0).toFixed(3)}. A difference that shows up only
            outside that box, or between grid points, will not appear — so treat the picture as
            evidence and the substitution as proof.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
