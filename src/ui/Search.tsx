/**
 * Search across every exercise in the course.
 *
 * Matches on the minigame's title and tagline, the syllabus item's own title,
 * its source references and its topics — so "exam25a", "De Morgan", "clause"
 * and "Tseitin" all find something, and so do the exercises that have no
 * minigame yet. Those still appear, marked, because knowing an exercise type
 * exists and is not built is more useful than a blank result.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORY_BY_ID } from '@/engine/categories'
import { getMinigame } from '@/engine/registry'
import { allItems } from '@/engine/skillTree'
import { TOPIC_LABELS } from '@/engine/types'
import { Card } from './primitives'

interface Entry {
  id: string
  title: string
  subtitle: string
  meta: string
  href: string | null
  haystack: string
}

function entries(): Entry[] {
  return allItems().map(({ item, category }) => {
    const game = item.game === undefined ? undefined : getMinigame(item.game)
    const topics = game?.topics.map((topic) => TOPIC_LABELS[topic]).join(' ') ?? ''
    return {
      id: item.id,
      title: game?.title ?? item.title,
      subtitle: game === undefined ? item.source : item.title,
      meta: `${CATEGORY_BY_ID[category].title} · ${item.source}`,
      href: game === undefined ? null : `/play/${game.id}`,
      haystack: [item.id, item.title, item.source, game?.title, game?.tagline, topics]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    }
  })
}

export function Search() {
  const [query, setQuery] = useState('')
  const all = useMemo(entries, [])

  const trimmed = query.trim().toLowerCase()
  // Every word has to appear somewhere, so "tseitin clause" narrows rather
  // than widens — which is what you want once there are enough exercises to
  // need searching at all.
  const words = trimmed.split(/\s+/).filter(Boolean)
  const results = words.length === 0 ? [] : all.filter((entry) => words.every((word) => entry.haystack.includes(word)))

  return (
    <div className="flex flex-col gap-2">
      <label className="sr-only" htmlFor="course-search">
        Search exercises
      </label>
      <div className="tile flex items-center gap-2 bg-card px-3 py-2">
        <span aria-hidden className="text-lg">
          🔍
        </span>
        <input
          id="course-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search exercises, topics, exam papers…"
          className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:font-medium placeholder:text-ink-soft"
        />
        {query !== '' && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="rounded-full px-2 py-0.5 text-xs font-bold text-ink-soft hover:bg-card-shade"
          >
            clear
          </button>
        )}
      </div>

      {trimmed !== '' && (
        <Card>
          {results.length === 0 ? (
            <p className="text-sm font-semibold text-ink-soft">
              Nothing matches “{query.trim()}”.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {results.map((entry) => (
                <li key={entry.id}>
                  {entry.href === null ? (
                    <div className="rounded-xl bg-card-shade px-3 py-2">
                      <p className="text-[0.95rem] font-bold text-ink-soft">{entry.title}</p>
                      <p className="text-xs font-medium text-ink-soft">{entry.meta} · not built yet</p>
                    </div>
                  ) : (
                    <Link
                      to={entry.href}
                      className="block rounded-xl bg-card-shade px-3 py-2 hover:bg-coin active:translate-y-0.5"
                    >
                      <p className="text-[0.95rem] font-bold">{entry.title}</p>
                      <p className="text-xs font-medium text-ink-soft">{entry.subtitle}</p>
                      <p className="text-xs font-medium text-ink-soft">{entry.meta}</p>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
