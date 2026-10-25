import { z } from 'zod'
import type { CompanionRecord } from './companion-api'

export const companionPreferencesSchema = z.object({
  avatar: z.string().max(90000).default(''),
  pinned: z.boolean().default(false),
  hidden: z.boolean().default(false),
  status: z.enum(['active', 'paused', 'archived', 'deleted']).default('active'),
  readAt: z.string().default(''),
  agent: z.enum(['codex', 'claude']).default('codex'),
  model: z
    .string()
    .max(200)
    .regex(/^[a-zA-Z0-9._:/-]*$/)
    .default(''),
  skills: z.string().max(8000).default('')
})
export type CompanionPreferences = z.infer<typeof companionPreferencesSchema>
export function companionPreferences(records: CompanionRecord[]): CompanionPreferences {
  const record = records.find((r) => r.kind === 'profile' && r.key === 'preferences' && !r.deleted)
  if (!record) {
    return companionPreferencesSchema.parse({})
  }
  return companionPreferencesSchema.parse(JSON.parse(record.text))
}
export function companionActivity(records: CompanionRecord[], readAt: string) {
  const messages = records
    .filter((r) => r.kind === 'conversation' && !r.deleted)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return {
    latest: messages[0],
    unread: messages.filter((r) => r.source === 'assistant' && r.createdAt > readAt).length
  }
}
