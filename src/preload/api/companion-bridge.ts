import { ipcRenderer } from 'electron'
import type { CompanionApi } from '../../shared/companion-api'

export const companionApi: CompanionApi = {
  read: () => ipcRenderer.invoke('companion:read'),
  prepare: () => ipcRenderer.invoke('companion:prepare'),
  write: (input) => ipcRenderer.invoke('companion:write', input),
  chooseSyncDirectory: () => ipcRenderer.invoke('companion:chooseSyncDirectory'),
  disconnectSync: () => ipcRenderer.invoke('companion:disconnectSync'),
  sync: () => ipcRenderer.invoke('companion:sync'),
  prompt: () => ipcRenderer.invoke('companion:prompt'),
  bind: (binding) => ipcRenderer.invoke('companion:bind', binding)
}
