// Framework-free. Computes the inverse of a command against the state it is
// about to be applied to. dispatch() records {forward, inverse}; undo applies
// the inverse through the same reducer.
import type { DocumentSessionState, OverlayObject } from '../types'
import type { CommandPayload } from './commandTypes'

export function computeInverse(
  payload: CommandPayload,
  stateBefore: DocumentSessionState,
): CommandPayload {
  switch (payload.kind) {
    case 'ADD_OVERLAY':
      return {
        kind: 'REMOVE_OVERLAY',
        pageId: payload.overlay.pageId,
        overlayId: payload.overlay.id,
      }

    case 'UPDATE_OVERLAY': {
      const overlays = stateBefore.overlaysByPage[payload.pageId] ?? []
      const current = overlays.find((o) => o.id === payload.overlayId)
      if (!current) return payload // no-op inverse for a no-op update
      const revert: Record<string, unknown> = {}
      for (const key of Object.keys(payload.patch)) {
        revert[key] = current[key as keyof OverlayObject]
      }
      return {
        kind: 'UPDATE_OVERLAY',
        pageId: payload.pageId,
        overlayId: payload.overlayId,
        patch: revert as Partial<OverlayObject>,
      }
    }

    case 'REMOVE_OVERLAY': {
      const overlays = stateBefore.overlaysByPage[payload.pageId] ?? []
      const overlay = overlays.find((o) => o.id === payload.overlayId)
      if (!overlay) return payload
      return { kind: 'ADD_OVERLAY', overlay }
    }

    case 'REORDER_PAGES':
      return { kind: 'REORDER_PAGES', order: stateBefore.pages.map((p) => p.id) }

    case 'ROTATE_PAGE': {
      const page = stateBefore.pages.find((p) => p.id === payload.pageId)
      return { kind: 'ROTATE_PAGE', pageId: payload.pageId, rotation: page?.rotation ?? 0 }
    }

    case 'SET_CROP': {
      const page = stateBefore.pages.find((p) => p.id === payload.pageId)
      return { kind: 'SET_CROP', pageId: payload.pageId, cropBox: page?.cropBox ?? null }
    }

    case 'INSERT_PAGES':
      return { kind: 'REMOVE_PAGES', pageIds: payload.pages.map((p) => p.id) }

    case 'REMOVE_PAGES': {
      const remove = new Set(payload.pageIds)
      return {
        kind: 'RESTORE_PAGES',
        entries: stateBefore.pages
          .map((page, index) => ({ index, page }))
          .filter(({ page }) => remove.has(page.id)),
      }
    }

    case 'RESTORE_PAGES':
      return { kind: 'REMOVE_PAGES', pageIds: payload.entries.map((e) => e.page.id) }
  }
}
