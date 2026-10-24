import type { CompanionWrite, CompanionRecord } from '../../resources/companion/store.mjs'
export type { CompanionWrite, CompanionRecord }

export type CompanionState = {
  records: CompanionRecord[]
  eventCount: number
  canonical: { sessionId: string; worktreeId: string; tabId: string } | null
  home: string
  syncDirectory: string | null
  lastSync: string | null
  syncError: string | null
  bindings: { sessionId: string; worktreeId: string; tabId: string }[]
}

export type CompanionApi = {
  read: () => Promise<CompanionState>
  prepare: () => Promise<CompanionState>
  write: (input: CompanionWrite) => Promise<CompanionState>
  chooseSyncDirectory: () => Promise<CompanionState>
  disconnectSync: () => Promise<CompanionState>
  sync: () => Promise<CompanionState>
  prompt: () => Promise<string>
  bind: (binding: {
    sessionId: string
    worktreeId: string
    tabId: string
  }) => Promise<CompanionState>
}
