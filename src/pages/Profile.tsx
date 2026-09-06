/**
 * Your character sheet: the face, the level, and the XP behind it.
 *
 * The whole thing is cosmetic on purpose. Levels do not unlock questions and
 * never will — the skill tree is a study order, not a gate — so this page is
 * free to be pure fun without quietly becoming a wall.
 */

import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AVATAR_STYLES,
  buyStyle,
  priceOf,
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
import { backupFilename, downloadBackup, restoreBackup, type RestoreResult } from '@/store/backup'

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

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Or pick the art style
          </p>
          <span className="text-sm font-black tabular-nums">🪙 {player.coins}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {AVATAR_STYLES.map((style) => {
            const owned = player.owned.includes(style)
            const price = priceOf(style)
            const affordable = player.coins >= price
            return (
              <button
                key={style}
                type="button"
                onClick={() => (owned ? setStyle(style) : buyStyle(style))}
                aria-pressed={style === player.style}
                disabled={!owned && !affordable}
                title={
                  owned
                    ? STYLE_LABELS[style]
                    : `${STYLE_LABELS[style]} — ${price} coins${affordable ? '' : ', not enough yet'}`
                }
                className={`tile flex flex-col items-center gap-1 p-1.5
                  focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                  ${style === player.style ? 'bg-space-blue' : 'bg-card-shade'}
                  ${owned ? '' : affordable ? 'ring-3 ring-coin' : 'opacity-55'}`}
              >
                <span className={owned ? '' : 'grayscale'}>
                  <Avatar style={style} seed={player.seed} size={40} name={player.name} />
                </span>
                <span
                  className={`w-full truncate text-[0.6rem] font-bold ${
                    style === player.style ? 'text-white' : 'text-ink-soft'
                  }`}
                >
                  {owned ? STYLE_LABELS[style] : `🪙 ${price}`}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs font-medium text-ink-soft">
          Coins come from party runs. A style you buy is yours for good.
        </p>

        <p className="mt-3 text-xs font-medium text-ink-soft">
          Drawn by the DiceBear API from that seed. Only the style and the seed are saved, so the
          same character comes back every time.
        </p>
      </Card>

      <BackupCard />

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

/**
 * Export and import.
 *
 * Everything is in this browser's localStorage, so a cleared cache or a second
 * device starts from nothing. One JSON file carries both halves — the answered
 * questions and the character — and restoring asks first, because it replaces
 * rather than merges.
 */
function BackupCard() {
  const player = usePlayer()
  const progress = useProgress()
  const stats = overallStats(progress)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [note, setNote] = useState<RestoreResult | null>(null)

  const exportNow = () => {
    const filename = downloadBackup()
    setNote({ ok: true, message: `Saved ${filename}` })
  }

  const importFrom = async (file: File) => {
    const text = await file.text()
    if (
      !window.confirm(
        'Restoring replaces everything on this device — answers, best scores, XP and character. Continue?',
      )
    ) {
      return
    }
    setNote(restoreBackup(text))
  }

  return (
    <Card>
      <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">
        Back up your progress
      </h2>
      <p className="mt-2 text-sm font-medium text-ink-soft">
        All of this lives in this browser only. One file carries {stats.attempts} answered
        question{stats.attempts === 1 ? '' : 's'}, every best score, and {player.xp} XP to another
        device.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <Button variant="coin" onClick={exportNow}>
          ⬇ Export — {backupFilename()}
        </Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          ⬆ Import a backup
        </Button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared so choosing the same file twice fires the change event again.
          event.target.value = ''
          if (file !== undefined) void importFrom(file)
        }}
      />

      {note !== null && (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${
            note.ok ? 'bg-grass text-white' : 'bg-space-red text-white'
          }`}
          aria-live="polite"
        >
          {note.message}
        </p>
      )}
    </Card>
  )
}
