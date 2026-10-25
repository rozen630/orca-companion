import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { readCompanionTask, type CompanionTask } from '../../../../shared/companion-task'
import type { CompanionRecord, CompanionWrite } from '../../../../shared/companion-api'
import { createBrowserUuid } from '@/lib/browser-uuid'

export function CompanionTasks({
  records,
  busy,
  write
}: {
  records: CompanionRecord[]
  busy: boolean
  write: (input: CompanionWrite) => Promise<boolean>
}): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [next, setNext] = useState('')
  const [source, setSource] = useState('')
  const [filter, setFilter] = useState('open')
  const [editing, setEditing] = useState<CompanionRecord | null>(null)
  function reset() {
    setEditing(null)
    setTitle('')
    setDue('')
    setNext('')
    setSource('')
  }
  async function save(task: CompanionTask, record?: CompanionRecord, deleted = false) {
    return write({
      kind: 'task',
      key: record?.key ?? createBrowserUuid(),
      text: JSON.stringify(task),
      parents: record?.heads ?? [],
      deleted,
      source: '用户管理待办'
    })
  }
  const tasks = records
    .filter((r) => r.kind === 'task' && !r.deleted)
    .map((record) => ({ record, task: readCompanionTask(record.text) }))
  return (
    <section className="space-y-3">
      <label className="block space-y-1 text-sm">
        待办内容
        <Textarea aria-label="待办内容" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block space-y-1 text-sm">
        截止日期
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <label className="block space-y-1 text-sm">
        下一步
        <Input value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className="block space-y-1 text-sm">
        来源
        <Input value={source} onChange={(e) => setSource(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button
          disabled={busy || !title.trim()}
          onClick={() =>
            void save(
              {
                ...(editing ? readCompanionTask(editing.text) : readCompanionTask(title)),
                title,
                due,
                next,
                source
              },
              editing ?? undefined
            ).then((saved) => {
              if (saved) {
                reset()
              }
            })
          }
        >
          {editing ? '保存待办' : '添加待办'}
        </Button>
        {editing && (
          <Button variant="ghost" onClick={reset}>
            取消
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        {[
          ['open', '待处理'],
          ['done', '已完成'],
          ['later', '稍后']
        ].map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? 'secondary' : 'ghost'}
            onClick={() => setFilter(value)}
          >
            {label} ({tasks.filter(({ task }) => task.status === value).length})
          </Button>
        ))}
      </div>
      {tasks
        .filter(({ task }) => task.status === filter)
        .sort((a, b) => (a.task.due || '9999').localeCompare(b.task.due || '9999'))
        .map(({ record, task }) => (
          <article key={record.key} className="space-y-2 rounded-md border border-border p-3">
            <p className="whitespace-pre-wrap text-sm">{task.title}</p>
            {task.due && <p className="text-xs text-muted-foreground">截止：{task.due}</p>}
            {task.next && <p className="text-xs text-muted-foreground">下一步：{task.next}</p>}
            {task.source && <p className="text-xs text-muted-foreground">来源：{task.source}</p>}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void save(
                    {
                      ...task,
                      status: task.status === 'done' ? 'open' : 'done',
                      completedAt: task.status === 'done' ? '' : new Date().toISOString()
                    },
                    record
                  )
                }
              >
                {task.status === 'done' ? '重新打开' : '完成'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void save({ ...task, status: task.status === 'later' ? 'open' : 'later' }, record)
                }
              >
                {task.status === 'later' ? '移回待处理' : '稍后处理'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setEditing(record)
                  setTitle(task.title)
                  setDue(task.due)
                  setSource(task.source)
                  setNext(task.next)
                }}
              >
                编辑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void save(task, record, true)}
              >
                删除
              </Button>
            </div>
          </article>
        ))}
    </section>
  )
}
