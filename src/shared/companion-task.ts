import { z } from 'zod'
export const companionTaskSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(10000),
  status: z.enum(['open', 'done', 'later']).default('open'),
  due: z.string().default(''),
  source: z.string().max(2000).default(''),
  next: z.string().max(10000).default(''),
  completedAt: z.string().default('')
})
export type CompanionTask = z.infer<typeof companionTaskSchema>
export function readCompanionTask(text: string): CompanionTask {
  try {
    const result = companionTaskSchema.safeParse(JSON.parse(text))
    if (result.success) {
      return result.data
    }
  } catch {
    /* Legacy tasks are plain text. */
  }
  return companionTaskSchema.parse({ version: 1, title: text || '未命名待办' })
}
