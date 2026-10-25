import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CompanionRecord, CompanionWrite } from '../../../../shared/companion-api'
import { companionMemorySchema, readCompanionMemory } from '../../../../shared/companion-memory'
import { CompanionTasks } from './CompanionTasks'
import { createBrowserUuid } from '@/lib/browser-uuid'

const categories = {
  user: '用户偏好',
  feedback: '反馈与纠正',
  project: '项目',
  reference: '参考资料'
}
export function CompanionRecords({
  records,
  busy,
  write,
  refresh
}: {
  records: CompanionRecord[]
  busy: boolean
  write: (input: CompanionWrite) => Promise<boolean>
  refresh: () => void
}): React.JSX.Element {
  const [kind, setKind] = useState('memory')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<keyof typeof categories>('reference')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editing, setEditing] = useState<CompanionRecord | null>(null)
  const [error, setError] = useState('')
  async function save() {
    setError('')
    try {
      const memory = companionMemorySchema.parse({
        version: 1,
        category,
        title: title.trim() || body.slice(0, 100),
        body
      })
      const saved = await write({
        kind: 'memory',
        key: editing?.key ?? createBrowserUuid(),
        text: JSON.stringify(memory),
        parents: editing?.heads ?? [],
        source: '用户管理记忆'
      })
      if (!saved) {
        return
      }
      setTitle('')
      setBody('')
      setEditing(null)
    } catch (e) {
      setError(String(e))
    }
  }
  const shown = records.filter(
    (r) =>
      (!r.deleted || r.conflicts.length > 0) &&
      r.kind === kind &&
      r.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  )
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div className="flex gap-2">
        {[
          ['memory', '记忆'],
          ['task', '待办'],
          ['conversation', '对话']
        ].map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={kind === value ? 'secondary' : 'ghost'}
            onClick={() => setKind(value)}
          >
            {label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" disabled={busy} onClick={refresh}>
          刷新
        </Button>
      </div>
      {kind === 'task' ? (
        <CompanionTasks records={records} busy={busy} write={write} />
      ) : (
        <>
          <Input
            aria-label="搜索本机记录"
            placeholder="搜索本机记录"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {kind === 'memory' && (
            <div className="space-y-2">
              <label className="block space-y-1 text-sm">
                记忆分类
                <select
                  className="w-full rounded-md border border-input bg-background p-2"
                  value={category}
                  onChange={(e) => {
                    const value = e.target.value
                    if (
                      value === 'user' ||
                      value === 'feedback' ||
                      value === 'project' ||
                      value === 'reference'
                    ) {
                      setCategory(value)
                    }
                  }}
                >
                  {Object.entries(categories).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                aria-label="记忆标题"
                placeholder="标题（可选）"
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                aria-label="新记忆"
                placeholder="你希望我记住什么？"
                value={body}
                maxLength={20000}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !body.trim()} onClick={() => void save()}>
                  {editing ? '保存修改' : '添加'}
                </Button>
                {editing && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(null)
                      setBody('')
                      setTitle('')
                    }}
                  >
                    取消
                  </Button>
                )}
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {shown.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {query ? '没有找到匹配的记录。' : '这里还没有记录。'}
            </p>
          )}
          {shown.map((record) => {
            const memory = readCompanionMemory(record.text)
            return (
              <article key={record.key} className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {kind === 'memory'
                    ? categories[memory.category]
                    : record.source === 'user'
                      ? '你'
                      : '伙伴'}{' '}
                  · {new Date(record.createdAt).toLocaleString()}
                </p>
                {kind === 'memory' && <p className="text-sm font-medium">{memory.title}</p>}
                <p className="whitespace-pre-wrap break-words text-sm">
                  {record.deleted ? '此记录已删除' : kind === 'memory' ? memory.body : record.text}
                </p>
                {kind === 'memory' && !record.deleted && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setEditing(record)
                        setTitle(memory.title)
                        setBody(memory.body)
                        setCategory(memory.category)
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void write({
                          kind: 'memory',
                          key: record.key,
                          text: '',
                          deleted: true,
                          parents: record.heads,
                          source: '用户删除记忆'
                        })
                      }
                    >
                      删除
                    </Button>
                  </div>
                )}
                {record.conflicts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">有并发修改，请选择保留版本：</p>
                    {[record, ...record.conflicts].map((v) => (
                      <Button
                        key={v.id}
                        size="sm"
                        variant="outline"
                        className="h-auto whitespace-normal"
                        disabled={busy}
                        onClick={() =>
                          void write({
                            kind: record.kind,
                            key: record.key,
                            text: v.text,
                            deleted: v.deleted,
                            parents: record.heads,
                            source: '用户解决冲突'
                          })
                        }
                      >
                        {v.deleted ? '保留删除' : v.text.slice(0, 100)}
                      </Button>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </>
      )}
    </section>
  )
}
