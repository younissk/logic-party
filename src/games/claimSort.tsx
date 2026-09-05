/**
 * The shape a "which of these are true" exam question should take.
 *
 * Several of chapter 5's syllabus items are checkbox lists on the paper:
 * claims about provability, about which theories are decidable, about what a
 * theory's properties imply. Those are knowledge questions and there is no
 * honest way to compute them — but there is an honest way to *ask* them.
 *
 * A checkbox list is answered one row at a time, and the rows never meet. A
 * sorting board puts them all on the table at once, so the claims get compared
 * against each other, which is how a set of near-identical statements is
 * actually told apart. Every claim carries the reason it falls where it does,
 * shown once the round is over.
 *
 * This is the factory: a game is its bins, its claims, and its guide.
 */

import { useEffect, useMemo, useState } from 'react'
import { defineMinigame } from '@/engine/registry'
import type {
  Difficulty,
  GenerateContext,
  Minigame,
  MinigameScreenProps,
  Topic,
  Verdict,
} from '@/engine/types'
import { Card } from '@/ui/primitives'
import { SortBoard, type Bin } from '@/ui/SortBoard'
import { Pop } from '@/ui/motion'
import type { ComponentType, ReactNode } from 'react'

export interface Claim<Id extends string> {
  /** Stable, and used as the React key. */
  id: string
  /** The claim itself, as it would appear on the paper. */
  text: string
  /** Where it belongs. */
  bin: Id
  /** Why — shown after the round, never before. */
  why: string
  difficulty: Difficulty[]
}

export interface ClaimSortQuestion {
  /** Claim ids, in the order they are dealt. */
  claims: string[]
}

export type ClaimSortAnswer = (string | null)[]

export interface ClaimSortSpec<Id extends string> {
  id: string
  title: string
  tagline: string
  icon: string
  topics: readonly Topic[]
  bins: readonly Bin<Id>[]
  claims: readonly Claim<Id>[]
  /** How many to deal, by difficulty. */
  howMany: Record<Difficulty, number>
  /** One line under the board. */
  hint: string
  /** Shown once the round is locked, above the reasons. */
  closing: ReactNode
  columns?: 2 | 3
  Guide: ComponentType
  roundSeconds?: number
  sprintQuestions?: number
}

export function makeClaimSort<Id extends string>(
  spec: ClaimSortSpec<Id>,
): Minigame<ClaimSortQuestion, ClaimSortAnswer> {
  const claimOf = (id: string): Claim<Id> =>
    spec.claims.find((claim) => claim.id === id) ?? (spec.claims[0] as Claim<Id>)

  function generate({ rng, difficulty }: GenerateContext): ClaimSortQuestion {
    const pool = spec.claims.filter((claim) => claim.difficulty.includes(difficulty))
    // A pool too small, or one whose claims all belong in the same bin, would
    // deal a board with nothing to decide — fall back to the whole list.
    const enough =
      pool.length >= spec.howMany[difficulty] && new Set(pool.map((claim) => claim.bin)).size > 1
    const usable = enough ? pool : spec.claims
    const wanted = Math.min(spec.howMany[difficulty], usable.length)

    for (let attempt = 0; attempt < 40; attempt++) {
      const chosen = rng.sample(usable, wanted)
      // A board where everything belongs in one bin is not a question.
      if (new Set(chosen.map((claim) => claim.bin)).size < 2) continue
      return { claims: chosen.map((claim) => claim.id) }
    }
    return { claims: usable.slice(0, wanted).map((claim) => claim.id) }
  }

  const solve = (question: ClaimSortQuestion): ClaimSortAnswer =>
    question.claims.map((id) => claimOf(id).bin)

  function check(question: ClaimSortQuestion, answer: ClaimSortAnswer): Verdict {
    const wanted = solve(question)
    const wrong = wanted.filter((bin, index) => answer[index] !== bin).length

    if (wrong === 0) {
      return {
        correct: true,
        message: `All ${wanted.length} placed`,
        detail: question.claims
          .slice(0, 2)
          .map((id) => claimOf(id).why)
          .join(' '),
      }
    }

    return {
      correct: false,
      // A count and nothing else — with four or five claims on the board,
      // naming one is most of the answer, and the sprint shows this before
      // the retry.
      message: `${wrong} of ${wanted.length} in the wrong place`,
      score: (wanted.length - wrong) / wanted.length,
      detail: spec.hint,
    }
  }

  function Screen({
    question,
    submit,
    locked,
  }: MinigameScreenProps<ClaimSortQuestion, ClaimSortAnswer>) {
    const wanted = useMemo(() => solve(question), [question])
    const [placed, setPlaced] = useState<ClaimSortAnswer>([])

    useEffect(() => setPlaced(question.claims.map(() => null)), [question])

    const remaining = placed.filter((bin) => bin === null).length

    return (
      <Card>
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          {spec.tagline}
        </p>

        <div className="mt-3">
          <SortBoard
            bins={spec.bins}
            tokens={question.claims.map((id) => (
              <span key={id} className="block text-sm font-semibold leading-snug">
                {claimOf(id).text}
              </span>
            ))}
            placed={locked ? wanted : placed}
            onPlace={(index, bin) =>
              setPlaced((previous) => {
                const next = [...previous]
                next[index] = bin
                return next
              })
            }
            locked={locked}
            solution={wanted}
            columns={spec.columns ?? 2}
            hint={spec.hint}
          />
        </div>

        {locked && (
          <Pop className="mt-3 rounded-2xl bg-card-shade p-3">
            <p className="text-sm font-medium text-ink-soft">{spec.closing}</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm font-medium text-ink-soft">
              {question.claims.map((id) => (
                <li key={id}>
                  <strong className="text-ink">{claimOf(id).text}</strong> — {claimOf(id).why}
                </li>
              ))}
            </ul>
          </Pop>
        )}

        {!locked && (
          <button
            type="button"
            onClick={() => submit(placed)}
            disabled={remaining > 0}
            className="chunky mt-3 min-h-12 w-full bg-coin px-6 text-base font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {remaining > 0 ? `${remaining} still in the tray` : 'Submit'}
          </button>
        )}
      </Card>
    )
  }

  return defineMinigame<ClaimSortQuestion, ClaimSortAnswer>({
    id: spec.id,
    title: spec.title,
    tagline: spec.tagline,
    topics: spec.topics,
    icon: spec.icon,
    roundSeconds: spec.roundSeconds ?? 150,
    sprintQuestions: spec.sprintQuestions ?? 6,
    // A board of four or five claims across two bins is guessable in a couple
    // of tries unless a wrong one costs more than reading them.
    sprintPenaltySeconds: 10,
    generate,
    check,
    solve,
    questionKey: (question) => [...question.claims].sort().join(','),
    explain: (question) => claimOf(question.claims[0] as string).why,
    Screen,
    Guide: spec.Guide,
  })
}
