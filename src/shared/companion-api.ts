import type { CompanionRoutinesApi } from './companion-routines'
import type { CompanionGroupsApi } from './companion-groups'
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
  saveSkill: (
    input: { name: string; instruction: string; enabled: boolean },
    id?: string
  ) => Promise<CompanionState>
  groups: CompanionGroupsApi
  routines: CompanionRoutinesApi
  duplicate: (id: string) => Promise<string>
  list: () => Promise<string[]>
  create: (profile: { name: string; soul: string }) => Promise<string>
  read: (id?: string) => Promise<CompanionState>
  prepare: (id?: string) => Promise<CompanionState>
  write: (input: CompanionWrite, id?: string) => Promise<CompanionState>
  chooseSyncDirectory: (id?: string) => Promise<CompanionState>
  disconnectSync: (id?: string) => Promise<CompanionState>
  sync: (id?: string) => Promise<CompanionState>
  prompt: (id?: string) => Promise<string>
  bind: (
    binding: {
      sessionId: string
      worktreeId: string
      tabId: string
    },
    id?: string
  ) => Promise<CompanionState>
}
