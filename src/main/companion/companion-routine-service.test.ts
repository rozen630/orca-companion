import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { put, snapshot } from '../../../resources/companion/store.mjs'
import type { CompanionState, CompanionWrite } from '../../shared/companion-api'
const turns = vi.hoisted(() => ({ create: vi.fn(), run: vi.fn() }))
vi.mock('./companion-agent-turn', () => ({
  createCompanionBackgroundSession: turns.create,
  runCompanionTurn: turns.run
}))
import { CompanionRoutineService } from './companion-routine-service'
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })))
  vi.resetAllMocks()
})
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'companion-routines-'))
  roots.push(root)
  const home = join(root, 'companion')
  const read = async (): Promise<CompanionState> => ({
    ...(await snapshot(home)),
    home,
    canonical: { sessionId: 'private', worktreeId: 'folder:home', tabId: 'private-tab' },
    bindings: [],
    syncDirectory: null,
    lastSync: null,
    syncError: null
  })
  const write = async (input: CompanionWrite) => {
    await put(home, input)
    return read()
  }
  const service = async () => ({ read, prepare: read, write })
  turns.create.mockResolvedValue('routine-thread')
  turns.run.mockResolvedValue('任务结果')
  return { root, read, write, service, routines: new CompanionRoutineService(root, service) }
}
it('deduplicates local event triggers and keeps one background session across runs and restarts', async () => {
  const { root, write, service, routines } = await fixture()
  const rule = await routines.save({
    companionId: 'default',
    name: '记忆更新',
    prompt: '查看更新',
    schedule: '0 3 * * *',
    enabled: true,
    kind: 'task',
    event: 'memory'
  })
  await write({ kind: 'memory', key: 'new-memory', text: '用户偏好', source: '用户添加' })
  await routines.tick()
  await vi.waitFor(async () =>
    expect((await routines.list('default'))[0].runs[0]?.status).toBe('completed')
  )
  await routines.tick()
  expect(turns.run).toHaveBeenCalledTimes(1)
  const restored = new CompanionRoutineService(root, service)
  await restored.tick()
  expect(turns.run).toHaveBeenCalledTimes(1)
  await restored.run(rule.id)
  await vi.waitFor(async () =>
    expect((await restored.list('default'))[0].runs[0].status).toBe('completed')
  )
  expect(turns.create).toHaveBeenCalledTimes(1)
  expect((await restored.list('default'))[0].runs).toHaveLength(2)
})
it('refuses overlapping jobs and stops running work when its companion is paused', async () => {
  const { write, routines } = await fixture()
  turns.run.mockImplementation(
    (_id: string, _prompt: string, signal: AbortSignal) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new Error('stopped')), { once: true })
      )
  )
  const rule = await routines.save({
    companionId: 'default',
    name: '停止测试',
    prompt: '执行',
    schedule: '0 3 * * *',
    enabled: false,
    kind: 'task'
  })
  await routines.run(rule.id)
  await vi.waitFor(() => expect(turns.run).toHaveBeenCalledTimes(1))
  await expect(routines.run(rule.id)).rejects.toThrow('其他例行任务')
  await write({
    kind: 'profile',
    key: 'preferences',
    text: JSON.stringify({ status: 'paused' }),
    source: '用户暂停'
  })
  await routines.stopForCompanion('default')
  await vi.waitFor(async () =>
    expect((await routines.list('default'))[0].runs[0].status).toBe('interrupted')
  )
  await expect(routines.run(rule.id)).rejects.toThrow('暂停')
})
