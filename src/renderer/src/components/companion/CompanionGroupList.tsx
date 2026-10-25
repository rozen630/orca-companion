import { Button } from '@/components/ui/button'
import type { CompanionGroup } from '../../../../shared/companion-groups'

export function CompanionGroupList({
  groups,
  archived,
  onSelect
}: {
  groups: CompanionGroup[]
  archived: boolean
  onSelect: (groupId: string, topicId: string | null) => void
}): React.JSX.Element {
  return (
    <>
      {groups
        .filter((group) => group.archived === archived)
        .map((group) => (
          <div key={group.id}>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onSelect(group.id, group.topics[0]?.id ?? null)}
            >
              {group.name}
              {group.running ? ' · 讨论中' : ''}
            </Button>
            {group.topics
              .filter((topic) => !topic.archived)
              .map((topic) => (
                <div key={topic.id} className="ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onSelect(group.id, topic.id)}
                  >
                    {topic.name}
                    {topic.running ? ' · 讨论中' : ''}
                  </Button>
                </div>
              ))}
          </div>
        ))}
    </>
  )
}
