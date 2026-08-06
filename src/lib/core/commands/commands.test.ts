import { describe, expect, it } from 'vitest'
import type { DocumentSessionState, PageState, TextOverlay } from '../types'
import type { CommandPayload } from './commandTypes'
import { applyCommand } from './reducer'
import { computeInverse } from './inverse'
import { HistoryManager } from './HistoryManager'

function page(id: string): PageState {
  return {
    id,
    sourceId: 'src1',
    sourcePageIndex: 0,
    rotation: 0,
    baseRotation: 0,
    cropBox: null,
    baseSize: { width: 612, height: 792 },
    baseOrigin: { x: 0, y: 0 },
  }
}

function textOverlay(id: string, pageId: string): TextOverlay {
  return {
    id,
    pageId,
    type: 'text',
    rect: { x: 10, y: 20, width: 200, height: 50 },
    zIndex: 1,
    text: 'hello',
    fontSize: 14,
    color: { r: 0, g: 0, b: 0 },
    align: 'left',
    bold: false,
    lineHeight: 1.3,
  }
}

function baseState(): DocumentSessionState {
  return {
    sources: {
      src1: { id: 'src1', fileName: 'a.pdf', bytes: new Uint8Array([1]), pageCount: 3 },
    },
    pages: [page('p1'), page('p2'), page('p3')],
    overlaysByPage: {},
    meta: { title: 'a' },
  }
}

/** Apply payload, then its inverse, and expect the observable state to match. */
function expectInverseRestores(state: DocumentSessionState, payload: CommandPayload) {
  const inverse = computeInverse(payload, state)
  const after = applyCommand(state, payload)
  const restored = applyCommand(after, inverse)
  expect(restored.pages).toEqual(state.pages)
  // Compare overlays only for live pages (orphaned entries are unobservable).
  for (const p of state.pages) {
    expect(restored.overlaysByPage[p.id] ?? []).toEqual(state.overlaysByPage[p.id] ?? [])
  }
}

describe('reducer + inverse round trips', () => {
  it('ADD_OVERLAY', () => {
    expectInverseRestores(baseState(), { kind: 'ADD_OVERLAY', overlay: textOverlay('o1', 'p1') })
  })

  it('UPDATE_OVERLAY reverts exactly the patched keys', () => {
    let state = baseState()
    state = applyCommand(state, { kind: 'ADD_OVERLAY', overlay: textOverlay('o1', 'p1') })
    expectInverseRestores(state, {
      kind: 'UPDATE_OVERLAY',
      pageId: 'p1',
      overlayId: 'o1',
      patch: { text: 'changed', fontSize: 22 },
    })
  })

  it('REMOVE_OVERLAY restores the overlay', () => {
    let state = baseState()
    state = applyCommand(state, { kind: 'ADD_OVERLAY', overlay: textOverlay('o1', 'p1') })
    expectInverseRestores(state, { kind: 'REMOVE_OVERLAY', pageId: 'p1', overlayId: 'o1' })
  })

  it('REORDER_PAGES', () => {
    expectInverseRestores(baseState(), { kind: 'REORDER_PAGES', order: ['p3', 'p1', 'p2'] })
  })

  it('REORDER_PAGES refuses partial orders', () => {
    const state = baseState()
    const after = applyCommand(state, { kind: 'REORDER_PAGES', order: ['p1'] })
    expect(after.pages).toHaveLength(3)
  })

  it('ROTATE_PAGE', () => {
    expectInverseRestores(baseState(), { kind: 'ROTATE_PAGE', pageId: 'p2', rotation: 90 })
  })

  it('SET_CROP', () => {
    expectInverseRestores(baseState(), {
      kind: 'SET_CROP',
      pageId: 'p1',
      cropBox: { x: 50, y: 50, width: 400, height: 500 },
    })
  })

  it('INSERT_PAGES with a new source', () => {
    const newPage: PageState = { ...page('p4'), sourceId: 'src2' }
    expectInverseRestores(baseState(), {
      kind: 'INSERT_PAGES',
      index: 1,
      pages: [newPage],
      newSources: [{ id: 'src2', fileName: 'b.pdf', bytes: new Uint8Array([2]), pageCount: 1 }],
    })
  })

  it('REMOVE_PAGES restores non-contiguous pages at original positions', () => {
    expectInverseRestores(baseState(), { kind: 'REMOVE_PAGES', pageIds: ['p1', 'p3'] })
  })

  it('REMOVE_PAGES keeps overlays through an undo', () => {
    let state = baseState()
    state = applyCommand(state, { kind: 'ADD_OVERLAY', overlay: textOverlay('o1', 'p2') })
    const payload: CommandPayload = { kind: 'REMOVE_PAGES', pageIds: ['p2'] }
    const inverse = computeInverse(payload, state)
    const after = applyCommand(state, payload)
    expect(after.pages.map((p) => p.id)).toEqual(['p1', 'p3'])
    const restored = applyCommand(after, inverse)
    expect(restored.pages.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(restored.overlaysByPage['p2']).toHaveLength(1)
  })
})

describe('HistoryManager', () => {
  const entry = (id: string) => ({
    id,
    label: id,
    forward: { kind: 'REMOVE_PAGES', pageIds: [] } as CommandPayload,
    inverse: { kind: 'RESTORE_PAGES', entries: [] } as CommandPayload,
  })

  it('push clears the redo stack', () => {
    const h = new HistoryManager()
    h.push(entry('a'))
    h.popForUndo()
    expect(h.canRedo()).toBe(true)
    h.push(entry('b'))
    expect(h.canRedo()).toBe(false)
  })

  it('undo/redo walk the stacks', () => {
    const h = new HistoryManager()
    h.push(entry('a'))
    h.push(entry('b'))
    expect(h.popForUndo()?.id).toBe('b')
    expect(h.popForRedo()?.id).toBe('b')
    expect(h.popForUndo()?.id).toBe('b')
    expect(h.popForUndo()?.id).toBe('a')
    expect(h.canUndo()).toBe(false)
  })
})
