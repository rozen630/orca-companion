import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { snapshot, put, synchronize } from './store.mjs'

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
