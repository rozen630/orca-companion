import { mainProcessState } from '../startup/main-process-state'
import { parseWorkspaceKey } from '../../shared/workspace-scope'
import { notifyReposChanged } from '../ipc/repos/repos-changed-notification'

export function restoreCompanionWorkspace(worktreeId: string, home: string, name: string): void {
  const store = mainProcessState.store
  if (!store) {
    throw new Error('本机工作区尚未就绪，请稍后重试。')
  }
  const scope = parseWorkspaceKey(worktreeId)
  if (scope?.type === 'folder') {
    const existing = store.getFolderWorkspace(scope.folderWorkspaceId)
    if (!existing) {
      const group =
        store
          .getProjectGroups()
          .find((entry) => entry.name === '我的伙伴' && !entry.connectionId) ??
        store.createProjectGroup({ name: '我的伙伴', createdFrom: 'manual' })
      store.createFolderWorkspace({
        restoreId: scope.folderWorkspaceId,
        projectGroupId: group.id,
        name,
        folderPath: home,
        connectionId: null,
        createdWithAgent: 'codex'
      })
    } else if (existing.isArchived || existing.name !== name) {
      store.updateFolderWorkspace(existing.id, { isArchived: false, name })
    }
    if (!existing || existing.isArchived || existing.name !== name) {
      notifyReposChanged(mainProcessState.mainWindow)
    }
  }
}
