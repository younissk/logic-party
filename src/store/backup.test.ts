import { beforeEach, describe, expect, it } from 'vitest'
import {
  BACKUP_VERSION,
  backupFilename,
  makeBackup,
  parseBackup,
  restoreBackup,
  serialiseBackup,
  type StoredBackup,
} from './backup'
import { clearProgress, getProgress, recordAttempt } from './progress'
import { FREE_STYLES, awardXp, getPlayer, resetPlayer, setName } from './player'

const attempt = (gameId: string, correct: boolean) => ({
  gameId,
  topics: ['satisfiability' as const],
  difficulty: 'medium' as const,
  correct,
  score: correct ? 1 : 0,
  seed: 'abc',
  questionIndex: 0,
  at: 1_700_000_000_000,
  ms: 4200,
})

beforeEach(() => {
  clearProgress()
  resetPlayer()
})

describe('makeBackup', () => {
  it('carries both halves', () => {
    recordAttempt(attempt('bcp', true))
    awardXp(140)
    setName('Youniss')

    const backup = makeBackup()
    expect(backup.app).toBe('logic-party')
    expect(backup.version).toBe(BACKUP_VERSION)
    expect(backup.progress.attempts).toHaveLength(1)
    expect(backup.player.xp).toBe(140)
    expect(backup.player.name).toBe('Youniss')
  })

  it('names the file by date, so backups sort', () => {
    expect(backupFilename(new Date('2026-09-05T11:00:00Z'))).toBe('logic-party-2026-09-05.json')
  })
})

describe('round trip', () => {
  it('restores exactly what was exported', () => {
    recordAttempt(attempt('bcp', true))
    recordAttempt(attempt('dp', false))
    awardXp(275)
    setName('Ada')
    const saved = serialiseBackup()

    clearProgress()
    resetPlayer()
    expect(getProgress().attempts).toHaveLength(0)

    const result = restoreBackup(saved)
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(getProgress().attempts).toHaveLength(2)
    expect(getPlayer().xp).toBe(275)
    expect(getPlayer().name).toBe('Ada')
  })

  it('keeps high scores and best times', () => {
    const saved = serialiseBackup({
      app: 'logic-party',
      version: 1,
      exportedAt: '',
      progress: {
        version: 1,
        attempts: [],
        highScores: { 'bcp:hard': 900 },
        bestTimes: { 'dp:easy': 31_000 },
      },
      player: { version: 1, xp: 0, style: 'bottts', seed: 'zz', name: '' },
    } satisfies StoredBackup)
    expect(restoreBackup(saved).ok).toBe(true)
    expect(getProgress().highScores['bcp:hard']).toBe(900)
    expect(getProgress().bestTimes['dp:easy']).toBe(31_000)
  })
})

describe('refusing what is not a backup', () => {
  it('rejects malformed JSON', () => {
    expect(parseBackup('{not json')).toBeNull()
    expect(restoreBackup('{not json').ok).toBe(false)
  })

  it('rejects a JSON file from somewhere else', () => {
    expect(parseBackup('{"hello":"world"}')).toBeNull()
    expect(parseBackup('[1,2,3]')).toBeNull()
    expect(parseBackup('null')).toBeNull()
  })

  it('rejects a backup with no attempts array', () => {
    expect(parseBackup('{"app":"logic-party","progress":{}}')).toBeNull()
  })

  it('refuses a backup from a newer version rather than mangling it', () => {
    const future = JSON.stringify({
      app: 'logic-party',
      version: BACKUP_VERSION + 1,
      progress: { version: 1, attempts: [], highScores: {}, bestTimes: {} },
    })
    const result = restoreBackup(future)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('newer version')
  })

  it('leaves what is stored alone when it refuses', () => {
    recordAttempt(attempt('bcp', true))
    restoreBackup('rubbish')
    expect(getProgress().attempts).toHaveLength(1)
  })

  it('restores the progress half of a file with no player half', () => {
    const partial = JSON.stringify({
      app: 'logic-party',
      version: 1,
      progress: { version: 1, attempts: [attempt('bcp', true)], highScores: {}, bestTimes: {} },
    })
    expect(restoreBackup(partial).ok).toBe(true)
    expect(getProgress().attempts).toHaveLength(1)
  })
})

describe('a backup written before coins existed', () => {
  beforeEach(() => {
    clearProgress()
    resetPlayer()
  })

  it('restores, with an empty purse and the free styles', () => {
    const saved = serialiseBackup({
      app: 'logic-party',
      version: 1,
      exportedAt: '',
      progress: { version: 1, attempts: [], highScores: {}, bestTimes: {} },
      player: { version: 1, xp: 420, style: 'lorelei', seed: 'qq', name: 'Old' },
    } satisfies StoredBackup)

    expect(restoreBackup(saved).ok).toBe(true)
    const player = getPlayer()
    expect(player.xp).toBe(420)
    expect(player.coins).toBe(0)
    // Version 1 had every style free, so whatever they were wearing has to
    // survive the update even though it is a paid style now.
    expect(player.style).toBe('lorelei')
    expect(player.owned).toContain('lorelei')
    for (const style of FREE_STYLES) expect(player.owned).toContain(style)
  })
})
