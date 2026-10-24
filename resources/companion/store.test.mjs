import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { snapshot, put, synchronize, context, search } from './store.mjs'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'orca-companion-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return { a: join(root, 'a'), b: join(root, 'b'), cloud: join(root, 'cloud') }
}
const initial = { kind: 'memory', key: 'language', text: '中文', source: '用户明确要求' }

test('offline concurrent edits survive and converge after explicit resolution', async (t) => {
  const { a, b, cloud } = await fixture(t)
  const first = await put(a, initial)
  await synchronize(a, cloud)
  await synchronize(b, cloud)
  await Promise.all([
    put(a, { ...initial, text: '中文邮件', parents: [first.id] }),
    put(b, { ...initial, text: '英文邮件', parents: [first.id] })
  ])
  await synchronize(a, cloud)
  await synchronize(b, cloud)
  await synchronize(a, cloud)
  const record = (await snapshot(a)).records[0]
  assert.equal(record.conflicts.length, 1)
  assert.deepEqual(
    new Set([record.text, record.conflicts[0].text]),
    new Set(['中文邮件', '英文邮件'])
  )
  await put(a, { ...initial, text: '聊天中文，邮件英文', parents: record.heads })
  await synchronize(a, cloud)
  await synchronize(b, cloud)
  assert.deepEqual(await snapshot(a), await snapshot(b))
  assert.equal((await snapshot(b)).records[0].conflicts.length, 0)
})

test('deletion propagates; an offline edit becomes a visible delete/edit conflict', async (t) => {
  const { a, b, cloud } = await fixture(t)
  const first = await put(a, initial)
  await synchronize(a, cloud)
  await synchronize(b, cloud)
  await put(a, { ...initial, text: '', deleted: true, parents: [first.id] })
  await put(b, { ...initial, text: '新偏好', parents: [first.id] })
  await synchronize(a, cloud)
  await synchronize(b, cloud)
  const conflict = (await snapshot(b)).records[0]
  assert.equal(conflict.conflicts.length, 1)
  await put(b, { ...initial, text: '', deleted: true, parents: conflict.heads })
  await synchronize(b, cloud)
  await synchronize(a, cloud)
  const removed = (await snapshot(a)).records[0]
  assert.equal(removed.deleted, true)
  assert.equal(removed.conflicts.length, 0)
})

test('repeat sync is idempotent and stale local edits are rejected', async (t) => {
  const { a, cloud } = await fixture(t)
  await put(a, initial)
  await assert.rejects(put(a, { ...initial, text: 'stale' }), /changed/)
  await synchronize(a, cloud)
  const before = await snapshot(a)
  const again = await synchronize(a, cloud)
  assert.equal(again.uploaded + again.downloaded, 0)
  assert.deepEqual(await snapshot(a), before)
})

test('invalid cloud payload does not overwrite local records', async (t) => {
  const { a, cloud } = await fixture(t)
  await put(a, initial)
  await synchronize(a, cloud)
  const before = await snapshot(a)
  await writeFile(join(cloud, 'OrcaCompanion-v1', 'events', 'bad.json'), '{}')
  await assert.rejects(synchronize(a, cloud), /Unexpected file/)
  assert.deepEqual(await snapshot(a), before)
})

test('persistent memory can be recalled, corrected and forgotten without cloud storage', async (t) => {
  const { a } = await fixture(t)
  const original = await put(a, initial)
  assert.match(await readFile(join(a, 'MEMORY.md'), 'utf8'), /中文/)
  assert.equal((await search(a, '中文'))[0].id, original.id)
  await put(a, { ...initial, text: '中文交流，英文邮件', parents: [original.id] })
  const updated = (await snapshot(a)).records[0]
  assert.equal((await context(a)).records[0].text, '中文交流，英文邮件')
  await put(a, { ...initial, text: '', deleted: true, parents: updated.heads })
  assert.equal((await search(a, '中文')).length, 0)
  assert.doesNotMatch(await readFile(join(a, 'MEMORY.md'), 'utf8'), /英文邮件/)
  assert.equal((await context(a)).records.length, 0)
})

test('identity remains in startup context even after many newer records', async (t) => {
  const { a } = await fixture(t)
  await put(a, { kind: 'profile', key: 'identity', text: '{"name":"小鲸"}', source: '用户' })
  for (let i = 0; i < 65; i++) {
    await put(a, { ...initial, key: `note-${i}` })
  }
  const recalled = await context(a)
  assert.equal(recalled.records[0].kind, 'profile')
  assert.equal((await search(a, 'note-0')).length, 1)
})
