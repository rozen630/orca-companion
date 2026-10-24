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
  ipcMain.handle('companion:list', (event) => {
    trusted(event)
    return roster.list()
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
  ipcMain.handle('companion:write', async (event, input, id: unknown) => {
    trusted(event)
    return (await service(id)).write(input)
  })
  ipcMain.handle('companion:bind', async (event, input, id: unknown) => {
    trusted(event)
    return (await service(id)).bind(input)
  })
  async function syncAll(): Promise<void> {
    for (const id of await roster.list()) {
      await (await service(id)).sync().catch(() => undefined)
    }
  }
  const timer = setInterval(() => {
    void syncAll().catch(() => undefined)
  }, 30000)
  timer.unref()
  app.once('before-quit', () => clearInterval(timer))
}
