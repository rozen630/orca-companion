import { z } from 'zod'
const groupMessageSchema = z.object({
  id: z.string(),
  author: z.string(),
  name: z.string(),
  text: z.string(),
  at: z.string(),
  error: z.boolean().optional()
})
const groupJobStepSchema = z.object({
  memberId: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'interrupted']),
  result: z.string().default('')
})
export const companionGroupJobSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string(),
  at: z.string(),
  status: z.enum(['running', 'completed', 'failed', 'interrupted']),
  steps: z.array(groupJobStepSchema)
})
export type CompanionGroupJob = z.infer<typeof companionGroupJobSchema>
export const companionGroupTopicSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  sessions: z.record(z.string(), z.string()).default({}),
  messages: z.array(groupMessageSchema).default([]),
  jobs: z.array(companionGroupJobSchema).default([]),
  running: z.boolean().default(false),
  archived: z.boolean().default(false)
})
export type CompanionGroupTopic = z.infer<typeof companionGroupTopicSchema>
export const companionGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  members: z.array(z.string()).min(2).max(6),
  mode: z.enum(['all', 'mentioned']).default('all'),
  speaking: z.enum(['parallel', 'sequential']).default('sequential'),
  archived: z.boolean().default(false),
  topics: z.array(companionGroupTopicSchema).default([]),
  // Kept for loading groups created before topics were introduced.
  sessions: z.record(z.string(), z.string()).default({}),
  messages: z.array(groupMessageSchema).default([]),
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
  saveTopic: (groupId: string, name: string, topicId?: string) => Promise<CompanionGroupTopic>
  send: (
    id: string,
    topicId: string,
    text: string,
    mentions: string[],
    delegate: boolean
  ) => Promise<void>
  stop: (id: string, topicId: string) => Promise<void>
}
