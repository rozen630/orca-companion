import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CompanionGroup, CompanionGroupsApi } from '../../../../shared/companion-groups'

export function CompanionGroupTopics({
  group,
  selected,
  api,
  onSelect,
  onChanged
}: {
  group: CompanionGroup
  selected: string | null
  api: CompanionGroupsApi
  onSelect: (id: string) => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  return (
    <div className="space-y-2 border-b border-border pb-3">
      <div className="flex flex-wrap gap-2">
        {group.topics
          .filter((topic) => !topic.archived)
          .map((topic) => (
            <Button
              key={topic.id}
              size="sm"
              variant={selected === topic.id ? 'secondary' : 'ghost'}
              onClick={() => onSelect(topic.id)}
            >
              {topic.name}
              {topic.running ? ' · 讨论中' : ''}
            </Button>
          ))}
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          ＋ 新话题
        </Button>
      </div>
      {creating && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void api
              .saveTopic(group.id, name)
              .then(async (topic) => {
                await onChanged()
                onSelect(topic.id)
                setName('')
                setCreating(false)
                setError('')
              })
              .catch((e: unknown) => setError(String(e)))
          }}
        >
          <input
            aria-label="新话题名称"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="话题名称"
          />
          <Button size="sm" type="submit" disabled={!name.trim()}>
            创建
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setCreating(false)}>
            取消
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
