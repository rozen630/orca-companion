import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { CompanionState, CompanionWrite } from '../../shared/companion-api'
const skillSchema = z.object({
  name: z.string().min(1).max(100),
  instruction: z.string().min(1).max(8000),
  enabled: z.boolean()
})
export async function saveCompanionSkill(
  state: CompanionState,
  input: unknown,
  write: (input: CompanionWrite) => Promise<CompanionState>
): Promise<CompanionState> {
  const skill = skillSchema.parse(input)
  const slug = `companion-${createHash('sha256').update(skill.name).digest('hex').slice(0, 16)}`
  const key = `skill:${slug}`
  const record = state.records.find((r) => r.kind === 'profile' && r.key === key)
  const directories = [
    join(state.home, '.agents', 'skills', slug),
    join(state.home, '.claude', 'skills', slug)
  ]
  for (const directory of directories) {
    if (skill.enabled) {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      await writeFile(
        join(directory, 'SKILL.md'),
        `---\nname: ${slug}\ndescription: ${JSON.stringify(skill.name)}\n---\n\n# ${skill.name}\n\n${skill.instruction}\n`,
        { mode: 0o600 }
      )
    } else {
      try {
        await unlink(join(directory, 'SKILL.md'))
      } catch (e) {
        if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) {
          throw e
        }
      }
    }
  }
  return write({
    kind: 'profile',
    key,
    text: JSON.stringify(skill),
    parents: record?.heads ?? [],
    source: '用户管理伙伴专属技能'
  })
}
