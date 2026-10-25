import { Input } from '@/components/ui/input'
import { CompanionExecutionLink } from './CompanionExecutionLink'
import type { CompanionState } from '../../../../shared/companion-api'
import { companionPreferences } from '../../../../shared/companion-preferences'
import { readCompanionProfile } from '../../../../shared/companion-profile'
export function CompanionMemberPicker({
  states,
  members,
  change
}: {
  states: Record<string, CompanionState>
  members: string[]
  change: (ids: string[]) => void
}): React.JSX.Element {
  return (
    <>
      {Object.entries(states)
        .filter(([, s]) => companionPreferences(s.records).status === 'active')
        .map(([id, s]) => (
          <label key={id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={members.includes(id)}
              onChange={(e) =>
                change(e.target.checked ? [...members, id] : members.filter((m) => m !== id))
              }
            />
            {
              readCompanionProfile(
                s.records.find((r) => r.kind === 'profile' && r.key === 'identity')?.text
              ).name
            }
          </label>
        ))}
    </>
  )
}

export function CompanionGroupExecutions({
  states,
  sessions,
  label,
  onOpen
}: {
  states: Record<string, CompanionState>
  sessions: Record<string, string>
  label: (id: string) => string
  onOpen: () => void
}): React.JSX.Element {
  return (
    <>
      {Object.entries(sessions).map(([id, sessionId]) => {
        const canonical = states[id]?.canonical
        return canonical ? (
          <CompanionExecutionLink
            key={id}
            workspaceId={canonical.worktreeId}
            sessionId={sessionId}
            label={`${label(id)}执行详情`}
            onOpen={onOpen}
          />
        ) : null
      })}
    </>
  )
}

export function CompanionGroupOptions({
  states,
  members,
  setMembers,
  name,
  setName,
  mode,
  setMode,
  speaking,
  setSpeaking
}: {
  states: Record<string, CompanionState>
  members: string[]
  setMembers: (ids: string[]) => void
  name: string
  setName: (value: string) => void
  mode: 'all' | 'mentioned'
  setMode: (value: 'all' | 'mentioned') => void
  speaking: 'parallel' | 'sequential'
  setSpeaking: (value: 'parallel' | 'sequential') => void
}): React.JSX.Element {
  return (
    <>
      {' '}
      <Input
        aria-label="群名字"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        placeholder="群名字"
      />
      <CompanionMemberPicker states={states} members={members} change={setMembers} />
      <label className="block space-y-1 text-sm">
        回复成员
        <select
          className="w-full rounded-md border border-input bg-background p-2"
          value={mode}
          onChange={(e) => setMode(e.target.value === 'mentioned' ? 'mentioned' : 'all')}
        >
          <option value="all">所有成员</option>
          <option value="mentioned">仅 @ 的成员</option>
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        发言顺序
        <select
          className="w-full rounded-md border border-input bg-background p-2"
          value={speaking}
          onChange={(e) => setSpeaking(e.target.value === 'parallel' ? 'parallel' : 'sequential')}
        >
          <option value="sequential">依次回复，能看到前面成员的回复</option>
          <option value="parallel">并行回复</option>
        </select>
      </label>
    </>
  )
}
