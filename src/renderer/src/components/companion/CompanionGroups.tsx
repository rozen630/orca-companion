import { useEffect, useState } from 'react'
import { Users, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import type { CompanionState } from '../../../../shared/companion-api'
import type { CompanionGroup } from '../../../../shared/companion-groups'
import { readCompanionProfile } from '../../../../shared/companion-profile'
import { CompanionGroupOptions, CompanionGroupExecutions } from './CompanionMemberPicker'
import { CompanionGroupTopics } from './CompanionGroupTopics'
import { CompanionGroupJobs } from './CompanionGroupJobs'
import { CompanionGroupList } from './CompanionGroupList'

export function CompanionGroups({
  states
}: {
  states: Record<string, CompanionState>
}): React.JSX.Element {
  const api = window.api.companion!.groups
  const [groups, setGroups] = useState<CompanionGroup[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [mode, setMode] = useState<'all' | 'mentioned'>('all')
  const [speaking, setSpeaking] = useState<'parallel' | 'sequential'>('sequential')
  const [text, setText] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const [delegate, setDelegate] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [archived, setArchived] = useState(false)
  const group = groups.find((g) => g.id === selected)
  const topic = group?.topics.find((entry) => entry.id === selectedTopic) ?? group?.topics[0]
  const label = (id: string) =>
    readCompanionProfile(
      states[id]?.records.find((r) => r.kind === 'profile' && r.key === 'identity')?.text
    ).name
  useEffect(() => {
    let disposed = false
    async function refresh() {
      try {
        const data = await api.list()
        if (!disposed) {
          setGroups(data)
        }
      } catch (e) {
        if (!disposed) {
          setError(String(e))
        }
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 1500)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [api])
  async function action(run: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await run()
      setGroups(await api.list())
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  function edit(current?: CompanionGroup) {
    setName(current?.name ?? '')
    setMembers(current?.members ?? [])
    setMode(current?.mode ?? 'all')
    setSpeaking(current?.speaking ?? 'sequential')
    setEditing(true)
  }
  return (
    <>
      <div className="flex items-center gap-2 px-2 py-1 text-sm">
        <Users className="size-4" />
        <span className="flex-1">群聊</span>
        <Button
          aria-label="添加群聊"
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            setSelected(null)
            edit()
          }}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <Button size="sm" variant="ghost" onClick={() => setArchived(!archived)}>
        {archived ? '返回群聊' : '已归档群聊'}
      </Button>
      <CompanionGroupList
        groups={groups}
        archived={archived}
        onSelect={(groupId, topicId) => {
          setSelected(groupId)
          setSelectedTopic(topicId)
          setMentions([])
          setText('')
        }}
      />
      {error && !selected && !editing && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Dialog
        open={!!group && !editing}
        onOpenChange={(value) => {
          if (!value) {
            setSelected(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <div className="max-h-[75vh] space-y-4 overflow-y-auto scrollbar-sleek">
            <DialogHeader>
              <DialogTitle>{group?.name}</DialogTitle>
              <DialogDescription>
                群聊与私聊分别保存。每位伙伴只收到群内消息及自己的资料。
              </DialogDescription>
            </DialogHeader>
            {group && (
              <>
                <CompanionGroupTopics
                  group={group}
                  selected={topic?.id ?? null}
                  api={api}
                  onSelect={(id) => {
                    setSelectedTopic(id)
                    setMentions([])
                    setText('')
                  }}
                  onChanged={async () => setGroups(await api.list())}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={group.running}
                    onClick={() => edit(group)}
                  >
                    群设置
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || group.running}
                    onClick={() =>
                      void action(() => api.save({ ...group, archived: !group.archived }))
                    }
                  >
                    {group.archived ? '取消归档' : '归档'}
                  </Button>
                </div>
                <div
                  className="max-h-96 space-y-3 overflow-y-auto scrollbar-sleek"
                  aria-live="polite"
                >
                  {topic?.messages.map((m) => (
                    <article key={m.id} className="rounded-md border border-border p-3">
                      <p className="text-xs text-muted-foreground">
                        {m.name} · {new Date(m.at).toLocaleString()}
                      </p>
                      <p
                        className={`whitespace-pre-wrap break-words text-sm ${m.error ? 'text-destructive' : ''}`}
                      >
                        {m.text}
                      </p>
                    </article>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.members.map((id) => (
                    <Button
                      key={id}
                      size="sm"
                      variant={mentions.includes(id) ? 'secondary' : 'ghost'}
                      onClick={() =>
                        setMentions(
                          mentions.includes(id)
                            ? mentions.filter((m) => m !== id)
                            : [...mentions, id]
                        )
                      }
                    >
                      @{label(id)}
                    </Button>
                  ))}
                </div>
                <CompanionGroupExecutions
                  states={states}
                  sessions={topic?.sessions ?? {}}
                  label={label}
                  onOpen={() => setSelected(null)}
                />
                {topic && <CompanionGroupJobs topic={topic} label={label} />}
                <Textarea
                  aria-label="群聊消息"
                  value={text}
                  maxLength={8000}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="发给群成员，或点击上方 @ 指定成员"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={delegate}
                    onChange={(e) => setDelegate(e.target.checked)}
                  />
                  安排分工（按成员顺序规划、执行、汇总）
                </label>
                <div className="flex gap-2">
                  <Button
                    disabled={busy || topic?.running || group.archived || !text.trim()}
                    onClick={() =>
                      void action(async () => {
                        if (!topic) {
                          throw new Error('请选择群聊话题')
                        }
                        await api.send(group.id, topic.id, text, mentions, delegate)
                        setText('')
                      })
                    }
                  >
                    发送
                  </Button>
                  {topic?.running && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void action(() => api.stop(group.id, topic.id))}
                    >
                      停止讨论
                    </Button>
                  )}
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{group ? '群设置' : '创建群聊'}</DialogTitle>
            <DialogDescription>
              选择 2–6 位伙伴。请先分别打开一次私聊，完成聊天引擎配置。
            </DialogDescription>
          </DialogHeader>
          <CompanionGroupOptions
            states={states}
            members={members}
            setMembers={setMembers}
            name={name}
            setName={setName}
            mode={mode}
            setMode={setMode}
            speaking={speaking}
            setSpeaking={setSpeaking}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={busy || !name.trim() || members.length < 2 || members.length > 6}
            onClick={() =>
              void action(async () => {
                const saved = await api.save({ id: group?.id, name, members, mode, speaking })
                setSelected(saved.id)
                setSelectedTopic(saved.topics[0]?.id ?? null)
                setEditing(false)
              })
            }
          >
            保存群聊
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
