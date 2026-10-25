import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { CompanionState } from '../../shared/companion-api'
const turns = vi.hoisted(() => ({ create: vi.fn(), run: vi.fn() }))
vi.mock('./companion-agent-turn', () => ({
  createCompanionBackgroundSession: turns.create,
  runCompanionTurn: turns.run
}))
import { CompanionGroupService } from './companion-group-service'
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })))
  vi.resetAllMocks()
})
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'companion-groups-'))
  roots.push(root)
  const read = async (id: string): Promise<CompanionState> => ({
    records: [],
    eventCount: 0,
    home: join(root, id),
    canonical: { sessionId: `private-${id}`, worktreeId: `folder:${id}`, tabId: id },
    bindings: [],
    syncDirectory: null,
    lastSync: null,
    syncError: null
  })
  turns.create.mockImplementation(async (id: string) => `group-${id}`)
  turns.run.mockImplementation(async (id: string) => `${id} answer`)
  return { root, read, service: new CompanionGroupService(root, read) }
}
it('uses independent group sessions, persists replies and restricts mentioned-mode recipients', async () => {
  const { root, read, service } = await fixture()
  const group = await service.save({
    name: '群聊',
    members: ['a', 'b'],
    mode: 'mentioned',
    speaking: 'sequential'
  })
  await expect(service.send(group.id, '问题', [], false)).rejects.toThrow('请选择')
  await expect(service.send(group.id, '问题', ['other'], false)).rejects.toThrow('非群成员')
  await service.send(group.id, '问题', ['b'], false)
  await vi.waitFor(async () => expect((await service.list())[0].running).toBe(false))
  expect(turns.create).toHaveBeenCalledExactlyOnceWith('private-b')
  expect(turns.run.mock.calls[0][0]).toBe('group-private-b')
  const restored = (await new CompanionGroupService(root, read).list())[0]
  expect(restored.messages.map((m) => m.author)).toEqual(['user', 'b'])
  expect(restored.sessions).toEqual({ b: 'group-private-b' })
})
it('refuses overlapping rounds and aborts a running round when a member is paused', async () => {
  const { service } = await fixture()
  turns.run.mockImplementation(
    (_id: string, _text: string, signal: AbortSignal) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new Error('stopped')), { once: true })
      )
  )
  const group = await service.save({
    name: '停止测试',
    members: ['a', 'b'],
    mode: 'all',
    speaking: 'sequential'
  })
  await service.send(group.id, '开始', [], false)
  await vi.waitFor(() => expect(turns.run).toHaveBeenCalledTimes(1))
  await expect(service.send(group.id, '重复', [], false)).rejects.toThrow('当前讨论')
  await service.stopForCompanion('a')
  await vi.waitFor(async () => expect((await service.list())[0].running).toBe(false))
  expect(turns.run).toHaveBeenCalledTimes(1)
  expect((await service.list())[0].messages.some((m) => m.error)).toBe(true)
})
