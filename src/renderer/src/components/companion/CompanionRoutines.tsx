import { CompanionExecutionLink } from './CompanionExecutionLink'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CompanionRoutine } from '../../../../shared/companion-routines'
import type { CompanionApi, CompanionState } from '../../../../shared/companion-api'

export function CompanionRoutines({
  id,
  api,
  state,
  changed
}: {
  id: string
  api: CompanionApi
  state: CompanionState
  changed: () => void
}): React.JSX.Element {
  const [rules, setRules] = useState<CompanionRoutine[]>([])
  const [editing, setEditing] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [schedule, setSchedule] = useState('0 3 * * *')
  const [kind, setKind] = useState<'task' | 'learning'>('task')
  const [event, setEvent] = useState<CompanionRoutine['event']>('none')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    async function refresh() {
      try {
        const value = await api.routines.list(id)
        if (!disposed) {
          setRules(value)
        }
      } catch (e) {
        if (!disposed) {
          setError(String(e))
        }
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 3000)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [api, id])
  async function action(run: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await run()
      setRules(await api.routines.list(id))
      changed()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  function edit(rule?: CompanionRoutine) {
    setEditing(rule?.id)
    setName(rule?.name ?? '')
    setPrompt(rule?.prompt ?? '')
    setSchedule(rule?.schedule ?? '0 3 * * *')
    setKind(rule?.kind ?? 'task')
    setEnabled(rule?.enabled ?? false)
    setEvent(rule?.event ?? 'none')
  }
  return (
    <details className="space-y-3 border-t border-border pt-3">
      <summary className="cursor-pointer text-sm font-medium">例行任务与夜间学习</summary>
      <p className="text-xs text-muted-foreground">
        由本机运行，Orca
        需要保持开启。时间使用此电脑的时区；休眠或退出期间不补跑。新规则默认停用，可手动执行。
      </p>
      <label className="block space-y-1 text-sm">
        任务类型
        <select
          className="w-full rounded-md border border-input bg-background p-2"
          value={kind}
          onChange={(e) => {
            const learning = e.target.value === 'learning'
            setKind(learning ? 'learning' : 'task')
            if (learning && !name) {
              setName('夜间记忆整理')
            }
          }}
        >
          <option value="task">伙伴例行任务</option>
          <option value="learning">整理记忆与提取技能候选</option>
        </select>
      </label>
      <Input
        aria-label="例行任务名称"
        value={name}
        maxLength={100}
        placeholder="任务名称"
        onChange={(e) => setName(e.target.value)}
      />
      {kind === 'task' && (
        <Textarea
          aria-label="例行任务指令"
          value={prompt}
          maxLength={12000}
          placeholder="到时间让伙伴做什么？"
          onChange={(e) => setPrompt(e.target.value)}
        />
      )}
      <label className="block space-y-1 text-sm">
        时间规则
        <select
          className="w-full rounded-md border border-input bg-background p-2"
          value={
            ['0 * * * *', '0 3 * * *', '0 9 * * 1-5', '0 3 * * 0'].includes(schedule)
              ? schedule
              : 'custom'
          }
          onChange={(e) => {
            if (e.target.value !== 'custom') {
              setSchedule(e.target.value)
            } else {
              setSchedule('')
            }
          }}
        >
          <option value="0 * * * *">每小时整点</option>
          <option value="0 3 * * *">每天 03:00</option>
          <option value="0 9 * * 1-5">工作日 09:00</option>
          <option value="0 3 * * 0">每周日 03:00</option>
          <option value="custom">自定义 Cron</option>
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        也在此事件发生时执行
        <select
          className="w-full rounded-md border border-input bg-background p-2"
          value={event}
          onChange={(e) => {
            const value = e.target.value
            if (
              value === 'none' ||
              value === 'memory' ||
              value === 'task' ||
              value === 'conversation'
            ) {
              setEvent(value)
            }
          }}
        >
          <option value="none">不使用事件触发</option>
          <option value="memory">用户更新此伙伴的记忆</option>
          <option value="task">用户更新此伙伴的待办</option>
          <option value="conversation">用户向此伙伴发送私聊消息</option>
        </select>
      </label>
      <Input
        aria-label="Cron 时间规则"
        value={schedule}
        onChange={(e) => setSchedule(e.target.value)}
        placeholder="分 时 日 月 星期"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        启用定时执行（会使用所配置模型的额度）
      </label>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || !name.trim() || !schedule.trim() || (kind === 'task' && !prompt.trim())}
          onClick={() =>
            void action(async () => {
              await api.routines.save({
                id: editing,
                companionId: id,
                name,
                prompt,
                schedule,
                enabled,
                kind,
                event
              })
              edit()
            })
          }
        >
          {editing ? '保存规则' : '添加规则'}
        </Button>
        {editing && (
          <Button size="sm" variant="ghost" onClick={() => edit()}>
            取消编辑
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {rules.map((rule) => (
        <article key={rule.id} className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm font-medium">
            {rule.name} · {rule.enabled ? '已启用' : '已停用'}
          </p>
          <p className="text-xs text-muted-foreground">
            {rule.schedule}
            {rule.enabled && rule.nextAt ? ` · 下次 ${new Date(rule.nextAt).toLocaleString()}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || rule.runs[0]?.status === 'running'}
              onClick={() => void action(() => api.routines.run(rule.id))}
            >
              立即运行
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || rule.runs[0]?.status === 'running'}
              onClick={() =>
                void action(() => api.routines.save({ ...rule, enabled: !rule.enabled }))
              }
            >
              {rule.enabled ? '停用' : '启用'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => edit(rule)}>
              编辑
            </Button>
            {rule.runs[0]?.status === 'running' ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void action(() => api.routines.stop(rule.id))}
              >
                停止
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void action(() => api.routines.remove(rule.id))}
              >
                删除规则
              </Button>
            )}
          </div>
          <details>
            <summary className="cursor-pointer text-xs">执行历史（{rule.runs.length}）</summary>
            {rule.runs.map((run) => (
              <div key={run.id} className="space-y-1 border-t border-border py-2">
                <p className="text-xs">
                  {new Date(run.at).toLocaleString()} ·{' '}
                  {
                    {
                      running: '正在执行',
                      completed: '已完成',
                      failed: '失败',
                      interrupted: '已中断'
                    }[run.status]
                  }
                </p>
                {run.sessionId && state.canonical && (
                  <CompanionExecutionLink
                    workspaceId={state.canonical.worktreeId}
                    sessionId={run.sessionId}
                    label="打开执行聊天"
                  />
                )}
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{run.result}</p>
              </div>
            ))}
          </details>
        </article>
      ))}
    </details>
  )
}
