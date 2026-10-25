import type { CompanionApi } from '../../../../shared/companion-api'

export function scopedCompanionApi(api: CompanionApi, id: string): CompanionApi {
  return {
    saveSkill: (input) => api.saveSkill(input, id),
    routines: api.routines,
    groups: api.groups,
    duplicate: api.duplicate,
    list: api.list,
    create: api.create,
    read: () => api.read(id),
    prepare: () => api.prepare(id),
    write: (input) => api.write(input, id),
    bind: (binding) => api.bind(binding, id),
    prompt: () => api.prompt(id),
    chooseSyncDirectory: () => api.chooseSyncDirectory(id),
    disconnectSync: () => api.disconnectSync(id),
    sync: () => api.sync(id)
  }
}
