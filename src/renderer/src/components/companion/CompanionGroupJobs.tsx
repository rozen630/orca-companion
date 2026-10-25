import type { CompanionGroupTopic } from '../../../../shared/companion-groups'

const statusLabel = {
  queued: '等待',
  running: '执行中',
  completed: '完成',
  failed: '失败',
  interrupted: '已停止'
}

export function CompanionGroupJobs({
  topic,
  label
}: {
  topic: CompanionGroupTopic
  label: (id: string) => string
}): React.JSX.Element | null {
  if (!topic.jobs.length) {
    return null
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">分工进度</p>
      {topic.jobs.slice(0, 10).map((job) => (
        <div key={job.id} className="space-y-1 rounded-md border border-border p-3 text-sm">
          <p className="font-medium">
            {job.prompt} · {statusLabel[job.status]}
          </p>
          {job.steps.map((step) => (
            <p
              key={step.memberId}
              className="whitespace-pre-wrap break-words text-muted-foreground"
            >
              {label(step.memberId)}：{statusLabel[step.status]}
              {step.result ? ` · ${step.result.slice(0, 300)}` : ''}
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}
