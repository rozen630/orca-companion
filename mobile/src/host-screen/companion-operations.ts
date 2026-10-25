import { z } from 'zod'
import { bindDeferredRpcOperation, defineRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'
import { CompanionMobileStateSchema } from '../../../src/shared/companion-rpc-contract'
import { companionGroupSchema } from '../../../src/shared/companion-groups'
export const companionList = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'companion.list',
    method: 'companion.list',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('companions', z.array(z.string()))
  })
)
export const companionRead = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'companion.read',
    method: 'companion.read',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('companion', CompanionMobileStateSchema)
  })
)
export const companionGroups = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'companion.groups.list',
    method: 'companion.groups.list',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('groups', z.array(companionGroupSchema))
  })
)
export const companionGroupSend = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'companion.groups.send',
    method: 'companion.groups.send',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('accepted', z.unknown())
  })
)
