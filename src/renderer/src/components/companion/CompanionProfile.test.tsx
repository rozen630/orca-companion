// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CompanionProfile } from './CompanionProfile'
import type { CompanionRecord } from '../../../../shared/companion-api'

afterEach(cleanup)

const profile: CompanionRecord = {
  version: 1,
  id: '10000000-0000-4000-8000-000000000001',
  kind: 'profile',
  key: 'identity',
  text: JSON.stringify({ name: '小鲸', soul: '中文交流' }),
  source: '用户',
  deleted: false,
  parents: [],
  heads: ['10000000-0000-4000-8000-000000000001'],
  conflicts: [],
  clock: 1,
  createdAt: '2026-10-24T12:00:00.000Z'
}

it('preserves unsaved profile edits when another action refreshes unchanged records', () => {
  const props = { busy: false, canChat: false, onWrite: vi.fn(), onChat: vi.fn() }
  const { rerender } = render(<CompanionProfile {...props} profile={profile} />)
  fireEvent.change(screen.getByLabelText('名字'), { target: { value: '新名字' } })
  rerender(<CompanionProfile {...props} profile={{ ...profile }} />)
  expect(screen.getByLabelText<HTMLInputElement>('名字').value).toBe('新名字')
  expect(screen.getByRole('status').textContent).toContain('尚未保存')
})

it('reports saved only after the persisted profile arrives and prevents duplicate saves', () => {
  const props = { busy: false, canChat: false, onWrite: vi.fn(), onChat: vi.fn() }
  const { rerender } = render(<CompanionProfile {...props} profile={profile} />)
  fireEvent.change(screen.getByLabelText('名字'), { target: { value: '新名字' } })
  fireEvent.click(screen.getByRole('button', { name: '保存资料' }))
  expect(screen.getByRole('status').textContent).toContain('尚未保存')
  rerender(
    <CompanionProfile
      {...props}
      profile={{ ...profile, text: JSON.stringify({ name: '新名字', soul: '中文交流' }) }}
    />
  )
  expect(screen.getByRole('status').textContent).toContain('已保存到本机')
  expect(screen.getByRole<HTMLButtonElement>('button', { name: '已保存' }).disabled).toBe(true)
})
