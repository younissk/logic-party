/**
 * Take your progress with you.
 *
 * Everything this app knows about you lives in this browser's localStorage,
 * which means a cleared cache, a private window or a second device starts you
 * from nothing. A backup is one JSON file holding both halves — the answered
 * questions and the character — so it can be carried to another machine or
 * kept before an experiment.
 *
 * The file is deliberately plain and readable: a version, a timestamp, and the
 * two stored objects exactly as they are stored.
 */

import {
  emptyProgress,
  getProgress,
  replaceProgress,
  type ProgressState,
} from './progress'
import { emptyPlayer, getPlayer, replacePlayer, type PlayerState } from './player'

export const BACKUP_VERSION = 1

export interface Backup {
  app: 'logic-party'
  version: number
  /** ISO 8601, for the filename and for telling two backups apart. */
  exportedAt: string
  progress: ProgressState
  player: PlayerState
}

export function makeBackup(): Backup {
  return {
    app: 'logic-party',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    progress: getProgress(),
    player: getPlayer(),
  }
}

/** `logic-party-2026-09-05.json` — sortable, and says what it is. */
export function backupFilename(at: Date = new Date()): string {
  const stamp = at.toISOString().slice(0, 10)
  return `logic-party-${stamp}.json`
}

export const serialiseBackup = (backup: Backup = makeBackup()): string =>
  JSON.stringify(backup, null, 2)

export interface RestoreResult {
  ok: boolean
  message: string
  /** Attempts in the restored file, for a "restored N answers" confirmation. */
  attempts?: number
}

/**
 * Read a backup back in.
 *
 * Deliberately forgiving about what it accepts and strict about what it
 * writes: a file missing the player half still restores the progress half, and
 * anything that is not a backup is refused by name rather than by exception.
 */
export function parseBackup(text: string): Backup | null {
  try {
    const parsed = JSON.parse(text) as Partial<Backup>
    if (typeof parsed !== 'object' || parsed === null) return null
    if (parsed.app !== 'logic-party') return null
    const progress = parsed.progress
    if (typeof progress !== 'object' || progress === null || !Array.isArray(progress.attempts)) {
      return null
    }
    return {
      app: 'logic-party',
      version: typeof parsed.version === 'number' ? parsed.version : BACKUP_VERSION,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      progress: { ...emptyProgress(), ...progress },
      player: { ...emptyPlayer(), ...(parsed.player ?? {}) },
    }
  } catch {
    return null
  }
}

/** Replaces what is stored. The caller is expected to have asked first. */
export function restoreBackup(text: string): RestoreResult {
  const backup = parseBackup(text)
  if (backup === null) {
    return { ok: false, message: 'That file is not a Logic Party backup.' }
  }
  if (backup.version > BACKUP_VERSION) {
    return {
      ok: false,
      message: `That backup was written by a newer version (${backup.version}). Update the app first.`,
    }
  }
  replaceProgress(backup.progress)
  replacePlayer(backup.player)
  const attempts = backup.progress.attempts.length
  return {
    ok: true,
    message: `Restored ${attempts} answered question${attempts === 1 ? '' : 's'}.`,
    attempts,
  }
}

/**
 * Hand the file to the browser.
 *
 * An anchor with a blob URL rather than the File System Access API: it works
 * on every browser this app runs in, including iOS Safari, and needs no
 * permission prompt.
 */
export function downloadBackup(): string {
  const filename = backupFilename()
  const blob = new Blob([serialiseBackup()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Revoked on the next tick: revoking synchronously can beat the download on
  // some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}
