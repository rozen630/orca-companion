import { z } from 'zod'
export const companionMemorySchema = z.object({
  version: z.literal(1),
  category: z.enum(['user', 'feedback', 'project', 'reference']),
  title: z.string().min(1).max(100),
  body: z.string().max(20000)
})
export function readCompanionMemory(text: string): z.infer<typeof companionMemorySchema> {
  try {
    const result = companionMemorySchema.safeParse(JSON.parse(text))
    if (result.success) {
      return result.data
    }
  } catch {
    /* Read existing plain-text memories. */
  }
  return {
    version: 1,
    category: 'reference',
    title: text.slice(0, 100) || '未命名记忆',
    body: text
  }
}
