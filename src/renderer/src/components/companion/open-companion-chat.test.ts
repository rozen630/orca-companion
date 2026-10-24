import { beforeEach, expect, it, vi } from 'vitest'
import type { CompanionApi, CompanionState } from '../../../../shared/companion-api'
import { openCompanionChat } from './open-companion-chat'

const mocks = vi.hoisted(() => ({
  createGroup: vi.fn(),
  createWorkspace: vi.fn(),
  fetchGroups: vi.fn(),
  fetchWorkspaces: vi.fn(),
  activate: vi.fn(),
  reveal: vi.fn(),
  launch: vi.fn()
}))
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      folderWorkspaces: [],
      projectGroups: [],
      activeWorktreeId: null,
      createProjectGroup: mocks.createGroup,
      createFolderWorkspace: mocks.createWorkspace,
      fetchProjectGroups: mocks.fetchGroups,
      fetchFolderWorkspaces: mocks.fetchWorkspaces
    })
  }
}))
vi.mock('@/lib/launch-agent-in-new-tab', () => ({ launchAgentInNewTab: mocks.launch }))
vi.mock('@/lib/agent-launch-request-id', () => ({ newAgentLaunchRequestId: () => 'launch-1' }))
vi.mock('@/lib/activate-ai-vault-structured-session', () => ({
  activateAiVaultStructuredSession: mocks.reveal
}))
vi.mock('@/lib/worktree-activation', () => ({ activateAndRevealWorktree: mocks.activate }))

const state: CompanionState = {
  home: '/local/companion',
  records: [],
  eventCount: 0,
  syncDirectory: null,
  lastSync: null,
  syncError: null,
  bindings: [],
  canonical: null
}
function api(current = state): CompanionApi {
  return {
    prepare: vi.fn(async () => current),
    read: vi.fn(async () => current),
    write: vi.fn(async () => current),
    bind: vi.fn(async () => current),
    chooseSyncDirectory: vi.fn(async () => current),
    disconnectSync: vi.fn(async () => current),
    sync: vi.fn(async () => current),
    prompt: vi.fn(async () => 'Saved identity and memories')
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createGroup.mockResolvedValue({ id: 'group-1' })
  mocks.createWorkspace.mockResolvedValue({ id: 'workspace-1', isArchived: false })
  mocks.launch.mockReturnValue({
    surface: { kind: 'host-published' },
    structuredSettlement: Promise.resolve({ kind: 'structured', sessionId: 'session-1' })
  })
})

it('creates a dedicated local workspace with no selected project and coalesces simultaneous clicks', async () => {
  const bridge = api()
  await Promise.all([openCompanionChat(bridge), openCompanionChat(bridge)])
  expect(mocks.createWorkspace).toHaveBeenCalledOnce()
  expect(mocks.createWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({ folderPath: state.home }),
    { runtimeEnvironmentId: null }
  )
  expect(mocks.launch).toHaveBeenCalledOnce()
  expect(bridge.bind).toHaveBeenCalledWith({
    sessionId: 'session-1',
    worktreeId: 'folder:workspace-1',
    tabId: 'agent-session:session-1'
  })
})

it('reopens the persisted session after its tab has closed instead of starting a new chat', async () => {
  const bridge = api({
    ...state,
    canonical: { sessionId: 'saved-session', worktreeId: 'folder:saved-home', tabId: 'closed-tab' }
  })
  await openCompanionChat(bridge)
  expect(mocks.reveal).toHaveBeenCalledWith(
    { structuredSession: { sessionId: 'saved-session', workspaceId: 'folder:saved-home' } },
    undefined,
    { kind: 'local' }
  )
  expect(mocks.launch).not.toHaveBeenCalled()
  expect(mocks.createWorkspace).not.toHaveBeenCalled()
  expect(bridge.bind).not.toHaveBeenCalled()
})

it('does not replace a persisted conversation when its host is temporarily unavailable', async () => {
  mocks.reveal.mockRejectedValueOnce(new Error('Host unavailable'))
  const bridge = api({
    ...state,
    canonical: { sessionId: 'saved-session', worktreeId: 'folder:saved-home', tabId: 'closed-tab' }
  })
  await expect(openCompanionChat(bridge)).rejects.toThrow('Host unavailable')
  expect(mocks.launch).not.toHaveBeenCalled()
  expect(bridge.bind).not.toHaveBeenCalled()
})
