import { z } from 'zod'
export const companionGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  members: z.array(z.string()).min(2).max(6),
  mode: z.enum(['all', 'mentioned']).default('all'),
  speaking: z.enum(['parallel', 'sequential']).default('sequential'),
  archived: z.boolean().default(false),
  sessions: z.record(z.string(), z.string()).default({}),
  messages: z
    .array(
      z.object({
        id: z.string(),
        author: z.string(),
        name: z.string(),
        text: z.string(),
        at: z.string(),
        error: z.boolean().optional()
      })
    )
    .default([]),
  running: z.boolean().default(false)
})
export type CompanionGroup = z.infer<typeof companionGroupSchema>
export type CompanionGroupsApi = {
  list: () => Promise<CompanionGroup[]>
  save: (
    input: Pick<CompanionGroup, 'name' | 'members' | 'mode' | 'speaking'> & {
      id?: string
      archived?: boolean
    }
  ) => Promise<CompanionGroup>
  send: (id: string, text: string, mentions: string[], delegate: boolean) => Promise<void>
  stop: (id: string) => Promise<void>
}
