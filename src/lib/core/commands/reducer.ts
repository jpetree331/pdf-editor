// Framework-free. The single pure state-transition function. This switch is
// the one sanctioned switch in the codebase: it's a data-driven reducer, not
// UI branching.
import type { DocumentSessionState, OverlayObject } from '../types'
import type { CommandPayload } from './commandTypes'

export function applyCommand(
  state: DocumentSessionState,
  payload: CommandPayload,
): DocumentSessionState {
  switch (payload.kind) {
    case 'ADD_OVERLAY': {
      const { overlay } = payload
      const existing = state.overlaysByPage[overlay.pageId] ?? []
      return {
        ...state,
        overlaysByPage: {
          ...state.overlaysByPage,
          [overlay.pageId]: [...existing, overlay],
        },
      }
    }

    case 'UPDATE_OVERLAY': {
      const overlays = state.overlaysByPage[payload.pageId] ?? []
      return {
        ...state,
        overlaysByPage: {
          ...state.overlaysByPage,
          [payload.pageId]: overlays.map((o) =>
            o.id === payload.overlayId ? ({ ...o, ...payload.patch } as OverlayObject) : o,
          ),
        },
      }
    }

    case 'REMOVE_OVERLAY': {
      const overlays = state.overlaysByPage[payload.pageId] ?? []
      return {
        ...state,
        overlaysByPage: {
          ...state.overlaysByPage,
          [payload.pageId]: overlays.filter((o) => o.id !== payload.overlayId),
        },
      }
    }

    case 'REORDER_PAGES': {
      const byId = new Map(state.pages.map((p) => [p.id, p]))
      const pages = payload.order
        .map((id) => byId.get(id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined)
      if (pages.length !== state.pages.length) return state // refuse partial orders
      return { ...state, pages }
    }

    case 'ROTATE_PAGE':
      return {
        ...state,
        pages: state.pages.map((p) =>
          p.id === payload.pageId ? { ...p, rotation: payload.rotation } : p,
        ),
      }

    case 'SET_CROP':
      return {
        ...state,
        pages: state.pages.map((p) =>
          p.id === payload.pageId ? { ...p, cropBox: payload.cropBox } : p,
        ),
      }

    case 'INSERT_PAGES': {
      const sources = { ...state.sources }
      for (const src of payload.newSources) sources[src.id] = src
      const pages = [...state.pages]
      pages.splice(payload.index, 0, ...payload.pages)
      return { ...state, sources, pages }
    }

    case 'REMOVE_PAGES': {
      const remove = new Set(payload.pageIds)
      // Overlays of removed pages stay in overlaysByPage (orphaned but cheap);
      // RESTORE_PAGES brings the page back with its overlays intact, and export
      // only reads overlays for pages present in the page list.
      return { ...state, pages: state.pages.filter((p) => !remove.has(p.id)) }
    }

    case 'RESTORE_PAGES': {
      const pages = [...state.pages]
      const entries = [...payload.entries].sort((a, b) => a.index - b.index)
      for (const { index, page } of entries) pages.splice(index, 0, page)
      return { ...state, pages }
    }
  }
}
