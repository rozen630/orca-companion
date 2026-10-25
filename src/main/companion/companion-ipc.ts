import { saveCompanionSkill } from './companion-skills'
import type { CompanionWrite } from '../../shared/companion-api'
import { companionPreferences } from '../../shared/companion-preferences'
import { setCompanionHostAccess } from './companion-host-access'
import { CompanionRoutineService } from './companion-routine-service'
import { CompanionGroupService } from './companion-group-service'
import { app, ipcMain } from 'electron'
import { getCanonicalUserDataPath } from '../persistence/loading-store/user-data-path'
import { mainProcessState } from '../startup/main-process-state'
import { createCompanionService } from './companion-service'
import { CompanionRosterStore } from './companion-roster-store'

export function registerCompanionHandlers(): void {
  const roster = new CompanionRosterStore(getCanonicalUserDataPath())
  const services = new Map<string, ReturnType<typeof createCompanionService>>()
  async function service(id: unknown) {
    const home = await roster.home(id)
    let entry = services.get(home)
    if (!entry) {
      entry = createCompanionService(home, typeof id === 'string' ? id : 'default')
      services.set(home, entry)
    }
    return entry
  }
  function trusted(event: Electron.IpcMainInvokeEvent): void {
    if (
      event.sender.id !== mainProcessState.mainWindow?.webContents.id ||
      event.senderFrame !== event.sender.mainFrame
    ) {
      throw new Error('Companion data is only available to the main application window')
    }
  }
  const routines = new CompanionRoutineService(getCanonicalUserDataPath(), service)
  for (const method of ['list', 'run', 'stop', 'remove'] as const) {
    ipcMain.handle(`companion:routines:${method}`, (event, id) => {
      trusted(event)
      return routines[method](id)
    })
  }
  ipcMain.handle('companion:routines:save', (event, input) => {
    trusted(event)
    return routines.save(input)
  })
  ipcMain.handle('companion:routines:undo', (event, id, key) => {
    trusted(event)
    return routines.undo(id, key)
  })
  const groups = new CompanionGroupService(getCanonicalUserDataPath(), async (id) =>
    (await service(id)).prepare()
  )
  async function write(input: CompanionWrite, id?: string) {
    const state = await (await service(id)).write(input)
    if (companionPreferences(state.records).status !== 'active') {
      await groups.stopForCompanion(id ?? 'default')
      await routines.stopForCompanion(id ?? 'default')
    }
    return state
  }
  setCompanionHostAccess({
    list: () => roster.list(),
    read: async (id) => (await service(id)).read(),
    write,
    groups,
    routines
  })
  ipcMain.handle('companion:groups:list', (event) => {
    trusted(event)
    return groups.list()
  })
  ipcMain.handle('companion:groups:save', (event, input) => {
    trusted(event)
    return groups.save(input)
  })
  ipcMain.handle('companion:groups:saveTopic', (event, id, name, topicId) => {
    trusted(event)
    return groups.saveTopic(id, name, topicId)
  })
  ipcMain.handle('companion:groups:send', (event, id, topicId, text, mentions, delegate) => {
    trusted(event)
    return groups.send(id, topicId, text, mentions, delegate)
  })
  ipcMain.handle('companion:groups:stop', (event, id, topicId) => {
    trusted(event)
    return groups.stop(id, topicId)
  })
  ipcMain.handle('companion:list', (event) => {
    trusted(event)
    return roster.list()
  })
  ipcMain.handle('companion:duplicate', (event, id: unknown) => {
    trusted(event)
    return roster.duplicate(id)
  })
  ipcMain.handle('companion:create', (event, input: unknown) => {
    trusted(event)
    return roster.create(input)
  })
  for (const method of [
    'read',
    'prepare',
    'chooseSyncDirectory',
    'disconnectSync',
    'sync',
    'prompt'
  ] as const) {
    ipcMain.handle(`companion:${method}`, async (event, id: unknown) => {
      trusted(event)
      return (await service(id))[method]()
    })
  }
  ipcMain.handle('companion:saveSkill', async (event, input, id) => {
    trusted(event)
    const entry = await service(id)
    return saveCompanionSkill(await entry.read(), input, entry.write)
  })
  ipcMain.handle('companion:write', async (event, input, id: unknown) => {
    trusted(event)
    return write(input, typeof id === 'string' ? id : undefined)
  })
  ipcMain.handle('companion:bind', async (event, input, id: unknown) => {
    trusted(event)
    return (await service(id)).bind(input)
  })
  async function syncAll(): Promise<void> {
    await routines.tick().catch(() => undefined)
    for (const id of await roster.list()) {
      await (await service(id)).sync().catch(() => undefined)
    }
  }
  const timer = setInterval(() => {
    void syncAll().catch(() => undefined)
  }, 30000)
  timer.unref()
  app.once('before-quit', () => {
    clearInterval(timer)
    void routines.stopAll()
    groups.stopAll()
  })
}
