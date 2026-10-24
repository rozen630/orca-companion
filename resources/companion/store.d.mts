export type CompanionEvent = {
  version: 1
  id: string
  kind: 'profile' | 'memory' | 'task' | 'journal' | 'conversation'
  key: string
  text: string
  source: string
  deleted: boolean
  parents: string[]
  clock: number
  createdAt: string
}
export type CompanionRecord = {
  heads: string[]
  conflicts: CompanionEvent[]
} & CompanionEvent
export type CompanionWrite = {
  kind: CompanionEvent['kind']
  key: string
  text: string
  source: string
  deleted?: boolean
  parents?: string[]
}
export function validateEvent(value: unknown): CompanionEvent
export function materialize(events: CompanionEvent[]): CompanionRecord[]
export function snapshot(home: string): Promise<{ records: CompanionRecord[]; eventCount: number }>
export function put(home: string, input: CompanionWrite): Promise<CompanionEvent>
export function synchronize(
  home: string,
  directory: string
): Promise<{
  uploaded: number
  downloaded: number
  directory: string
  finishedAt: string
  note: string
}>
export function context(home: string): Promise<unknown>
