import { ipcRenderer } from 'electron'
import type { CompanionApi } from '../../shared/companion-api'

export const companionApi: CompanionApi = {
  saveSkill: (input, id) => ipcRenderer.invoke('companion:saveSkill', input, id),
  routines: {
    list: (id) => ipcRenderer.invoke('companion:routines:list', id),
    save: (input) => ipcRenderer.invoke('companion:routines:save', input),
    run: (id) => ipcRenderer.invoke('companion:routines:run', id),
    stop: (id) => ipcRenderer.invoke('companion:routines:stop', id),
    remove: (id) => ipcRenderer.invoke('companion:routines:remove', id),
    undo: (id, key) => ipcRenderer.invoke('companion:routines:undo', id, key)
  },
  groups: {
    list: () => ipcRenderer.invoke('companion:groups:list'),
    save: (input) => ipcRenderer.invoke('companion:groups:save', input),
    saveTopic: (id, name, topicId) =>
      ipcRenderer.invoke('companion:groups:saveTopic', id, name, topicId),
    send: (id, topicId, text, mentions, delegate) =>
      ipcRenderer.invoke('companion:groups:send', id, topicId, text, mentions, delegate),
    stop: (id, topicId) => ipcRenderer.invoke('companion:groups:stop', id, topicId)
  },
  duplicate: (id) => ipcRenderer.invoke('companion:duplicate', id),
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
