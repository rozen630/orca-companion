import { afterEach, expect, it, vi } from 'vitest'
import {
  createRestTestRig,
  foundRestTestChat,
  REST_TEST_SESSION,
  type RestTestRig
} from '../native-chat/agent-session-wire/structured-agent-session-rest-test-rig'
const holder = vi.hoisted(() => {
  const value: { host: unknown } = { host: null }
  return value
})
vi.mock('../native-chat/agent-session-wire/structured-agent-session-registry', () => ({
  getStructuredAgentSessionHost: () => holder.host
}))
import { createCompanionBackgroundSession } from './companion-agent-turn'
let rig: RestTestRig | undefined
afterEach(async () => {
  await rig?.dispose()
  rig = undefined
  holder.host = null
  vi.restoreAllMocks()
})
it('creates a separate background conversation with the same workspace/account and leaves the private thread intact', async () => {
  rig = await createRestTestRig()
  await foundRestTestChat(rig)
  holder.host = rig.host
  vi.spyOn(Date, 'now').mockImplementation(() => rig!.clock.now)
  const original = rig.store.getRecord(REST_TEST_SESSION)!
  const id = await createCompanionBackgroundSession(REST_TEST_SESSION)
  expect(id).not.toBe(REST_TEST_SESSION)
  const created = rig.store.getRecord(id)!
  expect(created.location).toEqual(original.location)
  expect(created.accountHome).toEqual(original.accountHome)
  expect(created.permissionMode).toBe(original.permissionMode ?? 'ask')
  expect(created.providerHandleChain).toHaveLength(0)
  expect(rig.store.getRecord(REST_TEST_SESSION)?.providerHandleChain).toEqual(
    original.providerHandleChain
  )
})
