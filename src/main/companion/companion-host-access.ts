import type { CompanionApi } from '../../shared/companion-api'
export type CompanionHostAccess = Pick<
  CompanionApi,
  'list' | 'read' | 'write' | 'groups' | 'routines'
>
let access: CompanionHostAccess | null = null
export function setCompanionHostAccess(value: CompanionHostAccess): void {
  access = value
}
export function companionHostAccess(): CompanionHostAccess {
  if (!access) {
    throw new Error('此主机尚未启用伙伴服务，请启动 Orca Companion 桌面版。')
  }
  return access
}
