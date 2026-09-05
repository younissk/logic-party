import { Link, useParams } from 'react-router-dom'
import {
  CATEGORY_BY_ID,
  sectionProgress,
  type Category as CategoryId,
  type Priority,
  type Section,
  type SyllabusItem,
} from '@/engine/categories'
import { getMinigame, minigamesInCategory } from '@/engine/registry'
import { DIFFICULTIES, TOPIC_LABELS } from '@/engine/types'
import type { AnyMinigame } from '@/engine/types'
import { Button, Card, Star } from '@/ui/primitives'
import {
  formatDuration,
  getBestTime,
  getHighScore,
  statsForGame,
  useProgress,
  type ProgressState,
} from '@/store/progress'

const isCategory = (value: string): value is CategoryId => value in CATEGORY_BY_ID

/**
 * The plan's own markers, kept visible.
 *
 * A red item is one where marks were actually dropped, which outranks how
 * often it comes up — so it has to read louder than the frequency does.
 */
const PRIORITY_STYLE: Readonly<Record<Priority, string>> = {
  lost: 'bg-space-red text-white',
  refresh: 'bg-coin text-ink',
  skim: 'bg-card-shade text-ink-soft',
}

const PRIORITY_SHORT: Readonly<Record<Priority, string>> = {
  lost: 'lost marks',
  refresh: 'refresh',
  skim: 'skim',
}

function Markers({ item }: { item: SyllabusItem }) {
  if (item.priority === undefined) return null
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${PRIORITY_STYLE[item.priority]}`}
      >
        {PRIORITY_SHORT[item.priority]}
      </span>
      {item.stars !== undefined && item.stars > 0 && (
        <span className="text-[0.65rem] font-bold text-coin-deep" title={`In ${item.stars + 1} past exams`}>
          {'★'.repeat(item.stars)}
        </span>
      )}
    </span>
  )
}

export function Category() {
  const { categoryId = '' } = useParams()
  const progress = useProgress()

  if (!isCategory(categoryId)) {
    return (
      <Card>
        <h1 className="text-lg font-bold">No such category</h1>
        <Link to="/">
          <Button variant="secondary" className="mt-4 w-full">
            Back to the course
          </Button>
        </Link>
      </Card>
    )
  }

  const category = CATEGORY_BY_ID[categoryId]
  const built = sectionProgress(categoryId)

  return (
    <div className="flex flex-col gap-4">
      <Link to="/" className="text-sm font-bold text-ink hover:underline">
        ← Course
      </Link>

      <header className="text-center">
        <span
          className={`space formula inline-flex h-20 w-20 items-center justify-center text-4xl font-bold ${category.colour}`}
          aria-hidden
        >
          {category.icon}
        </span>
        <h1 className="shout mt-3 text-3xl text-white">{category.title}</h1>
        <p className="mt-1 font-semibold text-ink">{category.blurb}</p>
        {category.sections !== undefined && (
          <p className="mt-2 text-sm font-bold text-ink">
            {built.built} of {built.total} exercise types playable
          </p>
        )}
      </header>

      {category.sections !== undefined ? (
        category.sections.map((section) => (
          <SectionCard key={section.letter} section={section} progress={progress} />
        ))
      ) : (
        <PlannedCard planned={category.planned} games={minigamesInCategory(categoryId)} progress={progress} />
      )}
    </div>
  )
}

/**
 * One section of the study plan.
 *
 * Every item is listed whether or not it has a minigame, because the point of
 * the page is the shape of the chapter — seeing that eleven of fifteen
 * exercise types are still unbuilt is information, and a page that only showed
 * the four built ones would hide it.
 */
function SectionCard({ section, progress }: { section: Section; progress: ProgressState }) {
  const playable = section.items.filter((item) => item.game !== undefined).length

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 px-1">
        <span className="shout text-2xl text-white">
          {section.letter}. {section.title}
        </span>
        <span className="ml-auto text-xs font-bold text-white/80">
          {playable}/{section.items.length}
        </span>
      </div>

      {section.items.map((item) => {
        const game = item.game === undefined ? undefined : getMinigame(item.game)
        return game === undefined ? (
          <PlannedItem key={item.title} item={item} />
        ) : (
          <GameCard key={item.title} item={item} game={game} progress={progress} />
        )
      })}
    </section>
  )
}

function GameCard({
  item,
  game,
  progress,
}: {
  item: SyllabusItem
  game: AnyMinigame
  progress: ProgressState
}) {
  const gameStats = statsForGame(game.id, progress)
  const best = Math.max(...DIFFICULTIES.map((level) => getHighScore(game.id, level, progress)))
  const times = DIFFICULTIES.map((level) => getBestTime(game.id, level, progress)).filter(
    (time): time is number => time !== null,
  )
  const bestTime = times.length > 0 ? Math.min(...times) : null

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          className="space flex h-14 w-14 shrink-0 items-center justify-center bg-coin text-2xl"
          aria-hidden
        >
          {game.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-ink-soft">
            <span>{item.n === undefined ? 'Warm-up' : `${item.n} · ${item.source}`}</span>
            <Markers item={item} />
          </p>
          <h3 className="text-lg font-bold">{game.title}</h3>
          <p className="mt-0.5 text-sm font-medium text-ink-soft">{game.tagline}</p>
          <p className="mt-1 text-xs font-semibold text-ink-soft">
            {game.topics.map((topic) => TOPIC_LABELS[topic]).join(' · ')}
            {gameStats.attempts > 0 &&
              ` — ${Math.round(gameStats.accuracy * 100)}% over ${gameStats.attempts}`}
          </p>
          {(best > 0 || bestTime !== null) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold">
              {best > 0 && (
                <span className="flex items-center gap-1">
                  <Star earned className="h-5 w-5" />
                  {best}
                </span>
              )}
              {bestTime !== null && <span>⏱ {formatDuration(bestTime)}</span>}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Link to={`/play/${game.id}`} className="flex-1">
          <Button variant="coin" className="w-full">
            Play
          </Button>
        </Link>
        {game.Guide && (
          <Link to={`/guide/${game.id}`} className="flex-1">
            <Button variant="secondary" className="w-full">
              How to
            </Button>
          </Link>
        )}
      </div>
    </Card>
  )
}

function PlannedItem({ item }: { item: SyllabusItem }) {
  return (
    <div className="tile flex items-start gap-3 bg-card/55 px-3 py-2.5">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-ink-soft text-xs font-bold text-ink-soft"
        aria-hidden
      >
        {item.n ?? '·'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.95rem] font-bold text-ink-soft">{item.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-ink-soft">
          <span>{item.source}</span>
          <Markers item={item} />
        </p>
      </div>
      <span className="mt-0.5 shrink-0 text-xs font-bold uppercase tracking-wider text-ink-soft">
        soon
      </span>
    </div>
  )
}

/** Fallback for a chapter that has not been broken into a study plan yet. */
function PlannedCard({
  planned,
  games,
  progress,
}: {
  planned: string[]
  games: AnyMinigame[]
  progress: ProgressState
}) {
  if (games.length > 0) {
    return (
      <>
        {games.map((game) => (
          <GameCard key={game.id} item={{ id: game.id, title: game.title, source: '' }} game={game} progress={progress} />
        ))}
      </>
    )
  }

  return (
    <Card>
      <h2 className="text-lg font-bold">No minigames here yet</h2>
      <p className="mt-1 text-sm font-medium text-ink-soft">
        This is where these exercises will live once you build them:
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {planned.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-xl bg-card-shade px-3 py-2 text-sm font-semibold"
          >
            <span className="text-ink-soft" aria-hidden>
              ○
            </span>
            {item}
          </li>
        ))}
      </ul>
    </Card>
  )
}
