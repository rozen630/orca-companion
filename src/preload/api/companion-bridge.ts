import { ipcRenderer } from 'electron'
import type { CompanionApi } from '../../shared/companion-api'

export const companionApi: CompanionApi = {
  list: () => ipcRenderer.invoke('companion:list'),
  create: (profile) => ipcRenderer.invoke('companion:create', profile),
  read: (id) => ipcRenderer.invoke('companion:read', id),
  prepare: (id) => ipcRenderer.invoke('companion:prepare', id),
  write: (input, id) => ipcRenderer.invoke('companion:write', input, id),
  chooseSyncDirectory: (id) => ipcRenderer.invoke('companion:chooseSyncDirectory', id),
  disconnectSync: (id) => ipcRenderer.invoke('companion:disconnectSync', id),
  sync: (id) => ipcRenderer.invoke('companion:sync', id),
  prompt: (id) => ipcRenderer.invoke('companion:prompt', id),
  bind: (binding, id) => ipcRenderer.invoke('companion:bind', binding, id)
}
