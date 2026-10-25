import { afterEach, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { put, snapshot } from '../../../resources/companion/store.mjs'
import { applyLearning, undoLearning } from './companion-learning'
import type { CompanionState, CompanionWrite } from '../../shared/companion-api'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })))
})
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'companion-learning-'))
  roots.push(home)
  const read = async (): Promise<CompanionState> => ({
    ...(await snapshot(home)),
    home,
    canonical: null,
    bindings: [],
    syncDirectory: null,
    lastSync: null,
    syncError: null
  })
  const write = async (input: CompanionWrite) => {
    await put(home, input)
    return read()
  }
  return { read, write }
}
const memory = { version: 1, category: 'user', title: '语言', body: '中文' }
it('retains undo evidence even when a later write fails, and preserves subsequent user corrections', async () => {
  const { read, write } = await fixture()
  await write({ kind: 'memory', key: 'existing', text: '原记忆', source: '用户' })
  const state = await read()
  const proposal = JSON.stringify({
    summary: '整理',
    changes: [
      { key: 'existing', memory, reason: '用户说明' },
      { memory, reason: '新增' }
    ],
    skillCandidates: []
  })
  let writes = 0
  await expect(
    applyLearning(state, proposal, async (input) => {
      if (input.kind === 'memory' && ++writes === 2) {
        throw new Error('disk full')
      }
      return write(input)
    })
  ).rejects.toThrow('disk full')
  const partial = await read()
  const journal = partial.records.find((r) => r.kind === 'journal')!
  await undoLearning(partial, journal.key, write)
  expect((await read()).records.find((r) => r.key === 'existing')?.text).toBe('原记忆')
  await applyLearning(await read(), proposal, write)
  const updated = await read()
  const latest = updated.records.find((r) => r.kind === 'journal' && r.key !== journal.key)!
  const current = updated.records.find((r) => r.key === 'existing')!
  await write({
    kind: 'memory',
    key: 'existing',
    text: '用户后来的纠正',
    parents: current.heads,
    source: '用户'
  })
  await expect(undoLearning(await read(), latest.key, write)).rejects.toThrow('被修改')
  expect((await read()).records.find((r) => r.key === 'existing')?.text).toBe('用户后来的纠正')
})
it('rejects malformed or duplicate model changes before any memory mutation', async () => {
  const { read, write } = await fixture()
  const before = await read()
  await expect(applyLearning(before, 'not json', write)).rejects.toThrow()
  expect((await read()).eventCount).toBe(0)
  await expect(
    applyLearning(
      before,
      JSON.stringify({
        summary: '',
        changes: [
          { key: 'new-entry', memory, reason: '' },
          { key: 'new-entry', memory, reason: '' }
        ],
        skillCandidates: []
      }),
      write
    )
  ).rejects.toThrow('重复')
  expect((await read()).eventCount).toBe(0)
})

it('accepts a model-suggested new memory key without overwriting any unrelated record', async () => {
  const { read, write } = await fixture()
  await write({ kind: 'conversation', key: 'source-message', text: '我偏好中文', source: 'user' })
  await applyLearning(
    await read(),
    JSON.stringify({
      summary: '语言偏好',
      changes: [{ key: 'source-message', memory, reason: '明确说明' }],
      skillCandidates: []
    }),
    write
  )
  const state = await read()
  expect(state.records.find((r) => r.kind === 'conversation')?.text).toBe('我偏好中文')
  expect(state.records.filter((r) => r.kind === 'memory')).toHaveLength(1)
  expect(state.records.find((r) => r.kind === 'memory')?.key).not.toBe('source-message')
})
