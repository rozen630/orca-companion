import { expect, it } from 'vitest'
import { readCompanionTask } from './companion-task'
import { readCompanionMemory } from './companion-memory'
import { companionPreferencesSchema } from './companion-preferences'
it('keeps existing free-text tasks and memories readable after structured fields are added', () => {
  expect(readCompanionTask('明天交报告')).toMatchObject({
    title: '明天交报告',
    status: 'open',
    due: ''
  })
  expect(readCompanionMemory('喜欢中文')).toMatchObject({ body: '喜欢中文', category: 'reference' })
  const task = {
    ...readCompanionTask('报告'),
    status: 'done',
    completedAt: '2026-10-25T00:00:00Z',
    due: '2026-10-26'
  }
  expect(readCompanionTask(JSON.stringify(task))).toEqual(task)
})
it('rejects model strings that could inject command syntax', () => {
  for (const model of ['$(echo bad)', '`bad`', 'x;bad', 'x"']) {
    expect(companionPreferencesSchema.safeParse({ model }).success).toBe(false)
  }
  expect(companionPreferencesSchema.parse({ model: 'gpt-6-astra' }).model).toBe('gpt-6-astra')
})
