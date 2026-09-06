/** The twelve stops, as a row of spaces. Where you are, and what is left. */

import { FORK_AT, RUN_LENGTH, cardOf, isFork, isShop, type Run, type StopRecord } from './run'

export function Track({
  run,
  records,
  at,
}: {
  run: Run
  records: readonly StopRecord[]
  /** Index of the stop being played, or RUN_LENGTH once the run is over. */
  at: number
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {run.stops.map((stop, index) => {
        // Looked up by stop number, not by position: a shop leaves no record,
        // so the two lists stop lining up the moment one is passed.
        const record = records.find((entry) => entry.number === stop.number)
        const here = index === at
        // Only the two stops the player was told about up front are named.
        // Showing every card icon would spoil the reveal the brief exists for.
        const label = isShop(stop)
          ? '🛒'
          : isFork(stop)
            ? '⑂'
            : stop.number === RUN_LENGTH
              ? '👑'
              : String(stop.number)
        return (
          <span
            key={stop.number}
            title={`Stop ${stop.number}${isShop(stop) ? ' — shop' : stop.number === FORK_AT ? ' — fork' : ''}`}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
              here
                ? 'bg-coin ring-3 ring-ink/20'
                : isShop(stop)
                  ? 'bg-card text-ink-soft'
                  : record === undefined
                    ? 'bg-card-shade text-ink-soft'
                    : record.perfect
                      ? 'bg-grass text-white'
                      : record.coins > 0
                        ? 'bg-space-blue text-white'
                        : 'bg-space-red/60 text-white'
            }`}
          >
            {here ? label : record === undefined ? label : record.perfect ? '★' : cardOf(stop).icon}
          </span>
        )
      })}
    </div>
  )
}
