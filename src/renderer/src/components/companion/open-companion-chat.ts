import { companionPreferences } from '../../../../shared/companion-preferences'
import { useAppStore } from '@/store'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { activateAiVaultStructuredSession } from '@/lib/activate-ai-vault-structured-session'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import type { CompanionApi } from '../../../../shared/companion-api'
import { readCompanionProfile } from '../../../../shared/companion-profile'

const openings = new WeakMap<CompanionApi, Promise<void>>()

export function openCompanionChat(api: CompanionApi): Promise<void> {
  const opening = openings.get(api)
  if (opening) {
    return opening
  }
  const next = open(api).finally(() => {
    openings.delete(api)
  })
  openings.set(api, next)
  return next
}

async function open(api: CompanionApi): Promise<void> {
  const current = await api.prepare()
  const preferences = companionPreferences(current.records)
  if (preferences.status !== 'active') {
    throw new Error('请先恢复此伙伴，再开启聊天。')
  }
  const profile = current.records.find(
    (record) => record.kind === 'profile' && record.key === 'identity' && !record.deleted
  )
  const name = readCompanionProfile(profile?.text).name
  if (current.canonical) {
    const state = useAppStore.getState()
    await state.fetchProjectGroups({ runtimeEnvironmentId: null, throwOnError: true })
    await state.fetchFolderWorkspaces({ runtimeEnvironmentId: null, throwOnError: true })
    await activateAiVaultStructuredSession(
      {
        structuredSession: {
          workspaceId: current.canonical.worktreeId,
          sessionId: current.canonical.sessionId
        }
      },
      undefined,
      { kind: 'local' }
    )
    return
  }
  let state = useAppStore.getState()
  let workspace = state.folderWorkspaces.find(
    (w) =>
      w.folderPath === current.home &&
      !w.connectionId &&
      (!w.executionHostId || w.executionHostId === 'local')
  )
  if (!workspace) {
    const group =
      state.projectGroups.find(
        (g) =>
          g.name === '我的伙伴' &&
          !g.connectionId &&
          (!g.executionHostId || g.executionHostId === 'local')
      ) ?? (await state.createProjectGroup('我的伙伴', 'local'))
    if (!group) {
      throw new Error('无法创建伙伴目录，请重试。')
    }
    workspace =
      (await useAppStore.getState().createFolderWorkspace(
        {
          projectGroupId: group.id,
          name,
          folderPath: current.home,
          connectionId: null,
          createdWithAgent: preferences.agent,
          pendingFirstAgentMessageRename: false
        },
        { runtimeEnvironmentId: null }
      )) ?? undefined
  }
  if (!workspace) {
    throw new Error('无法打开伙伴工作区。')
  }
  if (workspace.isArchived) {
    await useAppStore.getState().updateFolderWorkspace(workspace.id, { isArchived: false })
  }
  const worktreeId = folderWorkspaceKey(workspace.id)
  activateAndRevealWorktree(worktreeId, { executionHostId: 'local', providesInitialSurface: true })
  const prompt = await api.prompt()
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    agent: preferences.agent,
    agentArgs: preferences.model ? `--model ${JSON.stringify(preferences.model)}` : undefined,
    worktreeId,
    prompt,
    promptDelivery: 'auto-submit',
    requestedSurface: 'chat',
    selectedExecutionHostId: 'local',
    onStructuredHostDeclined: () => ({ opened: false })
  })
  if (!result?.structuredSettlement) {
    throw new Error('请先在设置中配置 Codex；伙伴需要本机原生聊天。')
  }
  const settled = await result.structuredSettlement
  if (settled.kind === 'failed') {
    throw settled.error
  }
  if (settled.kind !== 'structured') {
    throw new Error('伙伴聊天尚未建立，请检查账号与本机聊天服务后重试。')
  }
  await api.bind({
    sessionId: settled.sessionId,
    worktreeId,
    tabId:
      result.surface.kind === 'local-chat'
        ? result.surface.tabId
        : `agent-session:${settled.sessionId}`
  })
  state = useAppStore.getState()
  if (state.activeWorktreeId !== worktreeId) {
    activateAndRevealWorktree(worktreeId, {
      executionHostId: 'local',
      providesInitialSurface: true
    })
  }
}
