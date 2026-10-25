import { z } from 'zod'
export const companionRoutineSchema = z.object({
  id: z.string().uuid(),
  companionId: z.string(),
  name: z.string().min(1).max(100),
  prompt: z.string().max(12000),
  schedule: z.string().max(200),
  enabled: z.boolean().default(false),
  kind: z.enum(['task', 'learning']).default('task'),
  event: z.enum(['none', 'memory', 'task', 'conversation']).default('none'),
  eventCursor: z.string().default(''),
  nextAt: z.number().default(0),
  sessionId: z.string().nullable().default(null),
  runs: z
    .array(
      z.object({
        id: z.string(),
        at: z.string(),
        status: z.enum(['running', 'completed', 'failed', 'interrupted']),
        result: z.string(),
        sessionId: z.string().optional()
      })
    )
    .default([])
})
export type CompanionRoutine = z.infer<typeof companionRoutineSchema>
export type CompanionRoutinesApi = {
  list: (id: string) => Promise<CompanionRoutine[]>
  save: (
    input: Pick<
      CompanionRoutine,
      'companionId' | 'name' | 'prompt' | 'schedule' | 'enabled' | 'kind'
    > & { id?: string; event?: CompanionRoutine['event'] }
  ) => Promise<CompanionRoutine>
  run: (id: string) => Promise<void>
  stop: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  undo: (companionId: string, journalKey: string) => Promise<void>
}
