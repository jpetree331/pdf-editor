// Subscribe React to the framework-free session via useSyncExternalStore.
import { useSyncExternalStore } from 'react'
import type { DocumentSessionState } from '../lib/core/types'
import type { PdfDocumentSession } from '../lib/core/PdfDocumentSession'

const EMPTY_STATE: DocumentSessionState = {
  sources: {},
  pages: [],
  overlaysByPage: {},
  meta: { title: '' },
}
const noopSubscribe = () => () => {}

export function useSessionState(session: PdfDocumentSession | null): DocumentSessionState {
  return useSyncExternalStore(
    session ? session.subscribe : noopSubscribe,
    session ? session.getState : () => EMPTY_STATE,
  )
}
