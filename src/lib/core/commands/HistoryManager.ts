// Framework-free. Plain undo/redo stacks of serializable {forward, inverse}
// entries. Capped so pathological sessions can't grow without bound; byte
// payloads only ever appear in INSERT_PAGES.newSources, at most once per
// genuinely new source.
import type { HistoryEntry } from './commandTypes'

const MAX_ENTRIES = 200

export class HistoryManager {
  private past: HistoryEntry[] = []
  private future: HistoryEntry[] = []

  push(entry: HistoryEntry): void {
    this.past.push(entry)
    if (this.past.length > MAX_ENTRIES) this.past.shift()
    this.future = []
  }

  canUndo(): boolean {
    return this.past.length > 0
  }

  canRedo(): boolean {
    return this.future.length > 0
  }

  /** Pops the most recent entry for undoing; caller applies entry.inverse. */
  popForUndo(): HistoryEntry | undefined {
    const entry = this.past.pop()
    if (entry) this.future.push(entry)
    return entry
  }

  /** Pops the most recently undone entry; caller applies entry.forward. */
  popForRedo(): HistoryEntry | undefined {
    const entry = this.future.pop()
    if (entry) this.past.push(entry)
    return entry
  }

  clear(): void {
    this.past = []
    this.future = []
  }
}
