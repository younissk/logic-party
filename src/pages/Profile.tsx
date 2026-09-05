/**
 * Your character sheet: the face, the level, and the XP behind it.
 *
 * The whole thing is cosmetic on purpose. Levels do not unlock questions and
 * never will — the skill tree is a study order, not a gate — so this page is
 * free to be pure fun without quietly becoming a wall.
 */

import { Link } from 'react-router-dom'
import {
  AVATAR_STYLES,
  levelStanding,
  reroll,
  resetPlayer,
  setName,
  setStyle,
  usePlayer,
  xpForLevel,
  type AvatarStyle,
} from '@/store/player'
import { Avatar, LevelBar } from '@/ui/Avatar'
import { currentStreak, daysPractised, overallStats, useProgress } from '@/store/progress'
import { Button, Card } from '@/ui/primitives'

const STYLE_LABELS: Record<AvatarStyle, string> = {
  adventurer: 'Adventurer',
  avataaars: 'Avataaars',
  'big-smile': 'Big Smile',
  bottts: 'Bottts',
  'fun-emoji': 'Fun Emoji',
  lorelei: 'Lorelei',
  micah: 'Micah',
  miniavs: 'Miniavs',
  notionists: 'Notionists',
  'open-peeps': 'Open Peeps',
  personas: 'Personas',
  'pixel-art': 'Pixel Art',
}

export function Profile() {
  const player = usePlayer()
  const progress = useProgress()
  const standing = levelStanding(player.xp)
  const stats = overallStats(progress)

  return (
    <div className="flex flex-col gap-4">
      <Link to="/" className="text-sm font-bold text-ink hover:underline">
        ← Home
      </Link>

      <header className="pt-2 text-center">
        <Avatar style={player.style} seed={player.seed} name={player.name} size={112} className="mx-auto" />
        <h1 className="shout mt-3 text-4xl text-white">
          {player.name === '' ? 'Your character' : player.name}
        </h1>
        <p className="mt-1 font-semibold text-ink">
          Level {standing.level} · {standing.title}
        </p>
      </header>

      <Card>
        <LevelBar {...standing} />
        <p className="mt-2 text-sm font-medium text-ink-soft">
          {standing.needed - standing.into} XP to level {standing.level + 1}. {player.xp} earned in
          total, out of {xpForLevel(standing.level + 1)} needed to get there.
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Answered" value={String(stats.attempts)} />
        <Stat label="Streak" value={String(currentStreak(progress))} />
        <Stat label="Days" value={String(daysPractised(progress))} />
      </div>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">Name</h2>
        <input
          value={player.name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nobody, so far"
          maxLength={24}
          className="chunky mt-3 min-h-12 w-full bg-card-shade px-4 text-base font-semibold text-ink
            focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin"
        />
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">Character</h2>
          <span className="text-xs font-semibold text-ink-soft">seed {player.seed}</span>
        </div>

        <Button variant="coin" className="mt-3 w-full" onClick={reroll}>
          🎲 Roll a new one
        </Button>

        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink-soft">
          Or pick the art style
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {AVATAR_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setStyle(style)}
              aria-pressed={style === player.style}
              title={STYLE_LABELS[style]}
              className={`tile flex flex-col items-center gap-1 p-1.5
                focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                ${style === player.style ? 'bg-space-blue' : 'bg-card-shade'}`}
            >
              <Avatar style={style} seed={player.seed} size={40} name={player.name} />
              <span
                className={`w-full truncate text-[0.6rem] font-bold ${
                  style === player.style ? 'text-white' : 'text-ink-soft'
                }`}
              >
                {STYLE_LABELS[style]}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs font-medium text-ink-soft">
          Drawn by the DiceBear API from that seed. Only the style and the seed are saved, so the
          same character comes back every time.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">How XP works</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm font-medium text-ink-soft">
          <li>Every answer earns something — 2 XP even for a wrong one.</li>
          <li>A right answer is worth 10 on easy, 15 on medium, 22 on hard, scaled by part marks.</li>
          <li>A combo adds 2 per step past the first, up to 20.</li>
          <li>Level {standing.level} → {standing.level + 1} costs {standing.needed} XP; each level costs 50 more than the last.</li>
          <li>It unlocks nothing. That is the point.</li>
        </ul>
      </Card>

      <Button
        variant="secondary"
        onClick={() => {
          if (window.confirm('Reset your character and XP? Answered questions are kept.')) {
            resetPlayer()
          }
        }}
      >
        Reset character and XP
      </Button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-2 py-3 text-center">
      <p className="text-3xl font-bold tabular-nums text-space-blue">{value}</p>
      <p className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </p>
    </Card>
  )
}
