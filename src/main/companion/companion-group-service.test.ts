import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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
  const topicId = group.topics[0].id
  await expect(service.send(group.id, topicId, '问题', [], false)).rejects.toThrow('请选择')
  await expect(service.send(group.id, topicId, '问题', ['other'], false)).rejects.toThrow(
    '非群成员'
  )
  await service.send(group.id, topicId, '问题', ['b'], false)
  await vi.waitFor(async () => expect((await service.list())[0].running).toBe(false))
  expect(turns.create).toHaveBeenCalledExactlyOnceWith('private-b')
  expect(turns.run.mock.calls[0][0]).toBe('group-private-b')
  const restored = (await new CompanionGroupService(root, read).list())[0]
  expect(restored.topics[0].messages.map((m) => m.author)).toEqual(['user', 'b'])
  expect(restored.topics[0].sessions).toEqual({ b: 'group-private-b' })
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
  await service.send(group.id, group.topics[0].id, '开始', [], false)
  await vi.waitFor(() => expect(turns.run).toHaveBeenCalledTimes(1))
  await expect(service.send(group.id, group.topics[0].id, '重复', [], false)).rejects.toThrow(
    '当前讨论'
  )
  await service.stopForCompanion('a')
  await vi.waitFor(async () => expect((await service.list())[0].running).toBe(false))
  expect(turns.run).toHaveBeenCalledTimes(1)
  expect((await service.list())[0].topics[0].messages.some((m) => m.error)).toBe(true)
})
it('keeps topic histories and agent sessions separate within one group', async () => {
  const { root, read, service } = await fixture()
  let sequence = 0
  turns.create.mockImplementation(async () => `topic-session-${++sequence}`)
  const group = await service.save({
    name: '讨论',
    members: ['a', 'b'],
    mode: 'all',
    speaking: 'sequential'
  })
  const second = await service.saveTopic(group.id, '另一件事')
  await service.send(group.id, group.topics[0].id, '第一件事', ['a'], false)
  await vi.waitFor(async () => expect((await service.list())[0].topics[0].running).toBe(false))
  await service.send(group.id, second.id, '第二件事', ['a'], false)
  await vi.waitFor(async () => expect((await service.list())[0].topics[1].running).toBe(false))
  const saved = (await new CompanionGroupService(root, read).list())[0]
  expect(saved.topics[0].messages[0].text).toBe('第一件事')
  expect(saved.topics[1].messages[0].text).toBe('第二件事')
  expect(saved.topics[0].sessions.a).not.toBe(saved.topics[1].sessions.a)
  expect(turns.run.mock.calls[1][1]).not.toContain('第一件事')
})
it('moves existing group messages and sessions into a default topic without losing them', async () => {
  const { root, read } = await fixture()
  await writeFile(
    join(root, 'companion-groups.json'),
    JSON.stringify([
      {
        id: '60707b9e-4f22-4b9c-8f03-c7563be9ae87',
        name: '旧群聊',
        members: ['a', 'b'],
        mode: 'all',
        speaking: 'sequential',
        sessions: { a: 'old-session' },
        messages: [
          {
            id: 'old-message',
            author: 'user',
            name: '你',
            text: '之前的话',
            at: '2026-01-01T00:00:00Z'
          }
        ],
        running: false
      }
    ])
  )
  const [group] = await new CompanionGroupService(root, read).list()
  expect(group.topics).toHaveLength(1)
  expect(group.topics[0].messages[0].text).toBe('之前的话')
  expect(group.topics[0].sessions.a).toBe('old-session')
})
it('lets different topics run independently at the same time', async () => {
  const { service } = await fixture()
  const resolvers: ((answer: string) => void)[] = []
  turns.run.mockImplementation(() => new Promise<string>((resolve) => resolvers.push(resolve)))
  const group = await service.save({
    name: '并行话题',
    members: ['a', 'b'],
    mode: 'all',
    speaking: 'sequential'
  })
  const second = await service.saveTopic(group.id, '另一个话题')
  await service.send(group.id, group.topics[0].id, '问题一', ['a'], false)
  await vi.waitFor(() => expect(resolvers).toHaveLength(1))
  await service.send(group.id, second.id, '问题二', ['a'], false)
  await vi.waitFor(() => expect(resolvers).toHaveLength(2))
  resolvers.forEach((resolve, i) => resolve(`回答${i + 1}`))
  await vi.waitFor(async () => expect((await service.list())[0].running).toBe(false))
  const saved = (await service.list())[0]
  expect(saved.topics.map((topic) => topic.messages[1].text)).toEqual(['回答1', '回答2'])
})
it('records each delegated member result and the final job status', async () => {
  const { service } = await fixture()
  const group = await service.save({
    name: '分工',
    members: ['a', 'b'],
    mode: 'all',
    speaking: 'parallel'
  })
  await service.send(group.id, group.topics[0].id, '研究并汇总', [], true)
  await vi.waitFor(async () => expect((await service.list())[0].running).toBe(false))
  const job = (await service.list())[0].topics[0].jobs[0]
  expect(job.status).toBe('completed')
  expect(job.steps.map((step) => step.status)).toEqual(['completed', 'completed'])
  expect(job.steps.map((step) => step.result)).toEqual([
    'group-private-a answer',
    'group-private-b answer'
  ])
})
