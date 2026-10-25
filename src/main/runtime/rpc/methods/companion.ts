import { defineMethod } from '../core'
import { companionHostAccess } from '../../../companion/companion-host-access'
import {
  CompanionListParams,
  CompanionIdParams,
  CompanionWriteParams,
  CompanionGroupSendParams,
  CompanionGroupStopParams
} from '../../../../shared/companion-rpc-contract'
export const COMPANION_METHODS = [
  defineMethod({
    name: 'companion.list',
    permission: 'workspace',
    params: CompanionListParams,
    handler: () => companionHostAccess().list()
  }),
  defineMethod({
    name: 'companion.read',
    permission: 'workspace',
    params: CompanionIdParams,
    handler: (p) => companionHostAccess().read(p.id)
  }),
  defineMethod({
    name: 'companion.write',
    permission: 'workspace',
    params: CompanionWriteParams,
    handler: (p) => companionHostAccess().write(p.input, p.id)
  }),
  defineMethod({
    name: 'companion.groups.list',
    permission: 'workspace',
    params: CompanionListParams,
    handler: () => companionHostAccess().groups.list()
  }),
  defineMethod({
    name: 'companion.groups.send',
    permission: 'workspace',
    params: CompanionGroupSendParams,
    handler: (p) =>
      companionHostAccess().groups.send(p.id, p.topicId, p.text, p.mentions, p.delegate)
  }),
  defineMethod({
    name: 'companion.groups.stop',
    permission: 'workspace',
    params: CompanionGroupStopParams,
    handler: (p) => companionHostAccess().groups.stop(p.id, p.topicId)
  })
]
