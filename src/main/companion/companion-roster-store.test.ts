import { afterEach, expect, it } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { put, snapshot } from '../../../resources/companion/store.mjs'
import { CompanionRosterStore } from './companion-roster-store'

const roots: string[] = []
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'companion-roster-test-'))
  roots.push(root)
  return { root, roster: new CompanionRosterStore(root) }
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

it('retains the original home, memory and conversation binding when adding companions and restarting', async () => {
  const { root, roster } = await setup()
  const legacy = await roster.home()
  await put(legacy, { kind: 'memory', key: 'preference', text: 'Original memory', source: 'test' })
  const binding = JSON.stringify({ canonical: { sessionId: 'original-session' } })
  await writeFile(join(legacy, 'settings.json'), binding)
  const before = await snapshot(legacy)
  const ids = await Promise.all(
    ['Researcher', 'Writer'].map((name) => roster.create({ name, soul: name }))
  )
  const reopened = new CompanionRosterStore(root)
  expect(await reopened.list()).toEqual(['default', ...ids])
  expect(await reopened.home()).toBe(legacy)
  expect(await snapshot(legacy)).toEqual(before)
  expect(await readFile(join(legacy, 'settings.json'), 'utf8')).toBe(binding)
  for (const id of ids) {
    const state = await snapshot(await reopened.home(id))
    expect(state.records.map((record) => record.kind)).toEqual(['profile'])
  }
})

it('isolates writes and deletions even when different companions use the same memory key', async () => {
  const { roster } = await setup()
  const a = await roster.home(await roster.create({ name: 'A', soul: '' }))
  const b = await roster.home(await roster.create({ name: 'B', soul: '' }))
  await Promise.all(
    [a, b].map((home, index) =>
      put(home, {
        kind: 'memory',
        key: 'same-key',
        text: index ? 'B only' : 'A only',
        source: 'test'
      })
    )
  )
  const previous = (await snapshot(a)).records.find((record) => record.kind === 'memory')!
  await put(a, {
    kind: 'memory',
    key: 'same-key',
    text: '',
    source: 'test',
    deleted: true,
    parents: previous.heads
  })
  expect((await snapshot(b)).records.find((record) => record.kind === 'memory')?.text).toBe(
    'B only'
  )
  expect((await snapshot(a)).records.find((record) => record.kind === 'memory')?.deleted).toBe(true)
  await expect(roster.home('../companion')).rejects.toThrow()
  await expect(roster.create({ name: ' ', soul: '' })).rejects.toThrow()
  expect(await roster.list()).toHaveLength(3)
})
