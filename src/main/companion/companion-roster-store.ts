import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { put, snapshot } from '../../../resources/companion/store.mjs'

const rosterSchema = z.array(z.string().uuid()).max(100)
const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    soul: z.string().trim().max(4000)
  })
  .strict()

export class CompanionRosterStore {
  private queue: Promise<unknown> = Promise.resolve()
  constructor(private readonly root: string) {}

  async list(): Promise<string[]> {
    try {
      const contents = await readFile(join(this.root, 'companion-roster.json'), 'utf8')
      return ['default', ...rosterSchema.parse(JSON.parse(contents))]
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return ['default']
      }
      throw error
    }
  }

  async home(input: unknown = 'default'): Promise<string> {
    const id = input === undefined ? 'default' : z.string().parse(input)
    if (!(await this.list()).includes(id)) {
      throw new Error('伙伴不存在，请刷新列表。')
    }
    return id === 'default' ? join(this.root, 'companion') : join(this.root, 'companion-homes', id)
  }

  async duplicate(input: unknown): Promise<string> {
    const records = (await snapshot(await this.home(input))).records
    const identity = records.find((r) => r.kind === 'profile' && r.key === 'identity' && !r.deleted)
    const profile = identity
      ? profileSchema.parse(JSON.parse(identity.text))
      : { name: '小鲸', soul: '' }
    return this.create({ ...profile, name: `${profile.name.slice(0, 75)} 副本` })
  }

  create(input: unknown): Promise<string> {
    const run = this.queue.then(async () => {
      const profile = profileSchema.parse(input)
      const ids = (await this.list()).filter((id) => id !== 'default')
      if (ids.length >= 100) {
        throw new Error('伙伴数量已达到上限。')
      }
      const id = randomUUID()
      await put(join(this.root, 'companion-homes', id), {
        kind: 'profile',
        key: 'identity',
        text: JSON.stringify(profile),
        source: '用户创建伙伴',
        parents: []
      })
      await mkdir(this.root, { recursive: true, mode: 0o700 })
      const temporary = join(this.root, `companion-roster-${randomUUID()}.tmp`)
      await writeFile(temporary, JSON.stringify([...ids, id]), { mode: 0o600 })
      await rename(temporary, join(this.root, 'companion-roster.json'))
      return id
    })
    this.queue = run.catch(() => undefined)
    return run
  }
}
