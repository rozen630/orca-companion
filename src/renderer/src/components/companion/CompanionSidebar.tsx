import { useCallback, useEffect, useState } from 'react'
import { Heart, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompanionProfile } from './CompanionProfile'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { useAppStore } from '@/store'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import type {
  CompanionRecord,
  CompanionState,
  CompanionWrite
} from '../../../../shared/companion-api'

export function CompanionSidebar(): React.JSX.Element | null {
  const api = window.api.companion
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<CompanionState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [kind, setKind] = useState<'memory' | 'task' | 'conversation'>('memory')
  const worktreeId = useAppStore((s) => s.activeWorktreeId)
  const run = useCallback(async (action: () => Promise<CompanionState>) => {
    setBusy(true)
    setError('')
    try {
      setState(await action())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }, [])
  useEffect(() => {
    if (api && open) {
      void run(api.read)
    }
  }, [api, open, run])
  const profile = state?.records.find((r) => r.kind === 'profile' && r.key === 'identity')
  if (!api) {
    return null
  }
  const records =
    state?.records.filter((r) => (!r.deleted || r.conflicts.length > 0) && r.kind === kind) ?? []
  const write = (input: CompanionWrite): Promise<void> => run(() => api.write(input))
  const remove = (record: CompanionRecord): Promise<void> =>
    write({
      kind: record.kind,
      key: record.key,
      text: '',
      source: '用户在伙伴侧栏删除',
      parents: record.heads,
      deleted: true
    })
  async function chat(): Promise<void> {
    if (!worktreeId || !api) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const current = await api.read()
      const store = useAppStore.getState()
      const bound = current.bindings.findLast(
        (binding) =>
          binding.worktreeId === worktreeId &&
          (store.tabsByWorktree[worktreeId] ?? []).some((tab) => tab.id === binding.tabId)
      )
      if (bound) {
        store.setActiveTab(bound.tabId)
        setOpen(false)
        return
      }
      const prompt = await api.prompt()
      const result = launchAgentInNewTab({
        requestId: newAgentLaunchRequestId(),
        agent: 'codex',
        worktreeId,
        prompt,
        promptDelivery: 'auto-submit',
        requestedSurface: 'chat'
      })
      if (!result) {
        throw new Error('无法启动伙伴聊天，请先配置 Codex 账号。')
      }
      if (result.structuredSettlement) {
        const settlement = await result.structuredSettlement
        if (settlement.kind === 'failed') {
          throw settlement.error
        }
        if (settlement.kind === 'cancelled') {
          throw new Error('聊天启动已取消')
        }
        if (settlement.kind !== 'structured' || result.surface.kind !== 'local-chat') {
          throw new Error('此聊天未绑定到本机伙伴记录；当前版本仅同步本机原生聊天。')
        }
        setState(
          await api.bind({
            sessionId: settlement.sessionId,
            worktreeId,
            tabId: result.surface.tabId
          })
        )
      }
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-worktree-sidebar-foreground hover:bg-worktree-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Heart className="size-4" />
        <span>伙伴</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>你的 Orca 伙伴</SheetTitle>
            <SheetDescription>同一个伙伴，把记忆和进展留在身边。</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto scrollbar-sleek p-4">
            {(error || state?.syncError) && (
              <p role="alert" className="text-sm text-destructive">
                {error || state?.syncError}
              </p>
            )}
            <CompanionProfile
              key={profile?.deleted ? 'new' : (profile?.text ?? 'new')}
              profile={profile}
              busy={busy}
              canChat={Boolean(worktreeId)}
              onWrite={write}
              onChat={chat}
            />
            <section className="space-y-3 border-t border-border pt-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={kind === 'memory' ? 'secondary' : 'ghost'}
                  onClick={() => setKind('memory')}
                >
                  记忆
                </Button>
                <Button
                  size="sm"
                  variant={kind === 'task' ? 'secondary' : 'ghost'}
                  onClick={() => setKind('task')}
                >
                  待办
                </Button>
                <Button
                  size="sm"
                  variant={kind === 'conversation' ? 'secondary' : 'ghost'}
                  onClick={() => setKind('conversation')}
                >
                  对话
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="刷新伙伴资料"
                  disabled={busy}
                  onClick={() => void run(api.read)}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              {kind !== 'conversation' && (
                <Textarea
                  aria-label={kind === 'memory' ? '新记忆' : '新待办'}
                  placeholder={kind === 'memory' ? '你希望我记住什么？' : '有什么事需要继续推进？'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={10000}
                />
              )}
              {kind !== 'conversation' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !draft.trim()}
                  onClick={() =>
                    void run(async () => {
                      const next = await api.write({
                        kind,
                        key: createBrowserUuid(),
                        text: draft,
                        source: '用户在伙伴侧栏添加'
                      })
                      setDraft('')
                      return next
                    })
                  }
                >
                  <Plus className="size-4" />
                  添加
                </Button>
              )}
              {records.length === 0 && (
                <p className="text-sm text-muted-foreground">这里还没有记录。</p>
              )}
              {records.map((record) => (
                <article key={record.id} className="space-y-2 rounded-md border border-border p-3">
                  {kind === 'conversation' && (
                    <p className="text-xs text-muted-foreground">
                      {record.source === 'user' ? '你' : '伙伴'}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {record.deleted ? '此设备删除了这条记录' : record.text}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.createdAt).toLocaleString()}
                    </span>
                    {kind !== 'conversation' && (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label="删除这条记录"
                        disabled={busy}
                        onClick={() => void remove(record)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  {record.conflicts.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-2">
                      <p className="text-xs text-muted-foreground">
                        这条记录有并发修改，选择要保留的版本：
                      </p>
                      {[record, ...record.conflicts].map((version) => (
                        <Button
                          className="h-auto whitespace-normal text-left"
                          key={version.id}
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void write({
                              kind: record.kind,
                              key: record.key,
                              text: version.text,
                              deleted: version.deleted,
                              parents: record.heads,
                              source: '用户解决同步冲突'
                            })
                          }
                        >
                          {version.deleted ? '保留删除' : version.text.slice(0, 100)}
                        </Button>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </section>
            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-medium">云同步</h3>
              <p className="break-all text-xs text-muted-foreground">
                {state?.syncDirectory ??
                  '尚未连接云盘文件夹。选择后，每 30 秒自动交换伙伴资料、记忆、待办和聊天文字。不上传工具日志、思考或附件。'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void run(api.chooseSyncDirectory)}
                >
                  选择云盘文件夹
                </Button>
                <Button
                  size="sm"
                  disabled={busy || !state?.syncDirectory}
                  onClick={() => void run(api.sync)}
                >
                  立即同步
                </Button>
                {state?.syncDirectory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(api.disconnectSync)}
                  >
                    断开
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {state?.lastSync
                  ? `上次文件交换：${new Date(state.lastSync).toLocaleString()}。`
                  : ''}
                云端上传进度由 iCloud /
                云盘客户端管理。断开同步不会删除云端副本。删除记录会同步删除标记，历史版本仍保留在文件夹中。
              </p>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
