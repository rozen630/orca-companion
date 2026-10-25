import { z } from 'zod'
export const CompanionListParams = z.object({}).optional()
export const CompanionIdParams = z.object({ id: z.string().min(1).max(100) })
export const CompanionWriteParams = CompanionIdParams.extend({
  input: z
    .object({
      kind: z.enum(['profile', 'memory', 'task', 'journal', 'conversation']),
      key: z.string().min(1).max(160),
      text: z.string().max(100000),
      source: z.string().max(2000),
      parents: z.array(z.string().uuid()).max(100).optional(),
      deleted: z.boolean().optional()
    })
    .strict()
})
export const CompanionGroupSendParams = CompanionIdParams.extend({
  text: z.string().min(1).max(8000),
  mentions: z.array(z.string().min(1).max(100)).max(6),
  delegate: z.boolean()
})
export const CompanionMobileStateSchema = z.object({
  canonical: z
    .object({ sessionId: z.string(), worktreeId: z.string(), tabId: z.string() })
    .nullable(),
  records: z.array(
    z.object({
      kind: z.string(),
      key: z.string(),
      text: z.string(),
      deleted: z.boolean(),
      heads: z.array(z.string()),
      source: z.string(),
      createdAt: z.string()
    })
  )
})
