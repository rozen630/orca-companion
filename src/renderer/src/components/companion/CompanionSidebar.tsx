import { useCallback, useEffect, useState } from 'react'
import { Heart, RefreshCw, Plus, Trash2, Settings2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { structuredChatTabBySessionId } from '@/lib/structured-chat-tab-index'
import { readCompanionProfile } from '../../../../shared/companion-profile'
import { Button } from '@/components/ui/button'
import { CompanionProfile } from './CompanionProfile'
import { hasMacTrafficLights } from '@/app-shell/app-window-chrome'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { openCompanionChat } from './open-companion-chat'
import { createBrowserUuid } from '@/lib/browser-uuid'
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
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<{ record: CompanionRecord; text: string } | null>(null)
  const [kind, setKind] = useState<'memory' | 'task' | 'conversation'>('memory')
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const tabs = useAppStore((s) => s.unifiedTabsByWorktree)
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
    if (api) {
      void run(api.read)
    }
  }, [api, open, run])
  const profile = state?.records.find((r) => r.kind === 'profile' && r.key === 'identity')
  const name = readCompanionProfile(profile?.deleted ? undefined : profile?.text).name
  const canonical = state?.canonical
  useEffect(() => {
    if (!canonical) {
      return
    }
    const tab = structuredChatTabBySessionId(tabs, canonical.worktreeId, canonical.sessionId)
    if (tab && tab.customLabel !== name) {
      useAppStore.getState().setTabCustomTitle(tab.id, name, { recordInteraction: false })
    }
  }, [canonical, name, tabs])
  if (!api) {
    return null
  }
  const records =
    state?.records.filter(
      (r) =>
        (!r.deleted || r.conflicts.length > 0) &&
        r.kind === kind &&
        r.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    ) ?? []
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
    if (!api) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await openCompanionChat(api)
      setState(await api.read())
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setOpen(true)
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
      {state && (
        <div className="flex items-center gap-1 pl-4">
          <button
            type="button"
            disabled={busy}
            aria-label={`与${name}聊天`}
            aria-current={canonical?.worktreeId === activeWorktreeId ? 'page' : undefined}
            onClick={() => void chat()}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-worktree-sidebar-foreground hover:bg-worktree-sidebar-accent aria-[current=page]:bg-worktree-sidebar-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-worktree-sidebar-accent text-xs"
            >
              {Array.from(name)[0]}
            </span>
            <span className="truncate">{name}</span>
          </button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`${name}的资料与记忆`}
            onClick={() => setOpen(true)}
          >
            <Settings2 className="size-4" />
          </Button>
        </div>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className={
            hasMacTrafficLights ? 'top-[calc(36px/var(--ui-zoom-factor,1))] h-auto' : undefined
          }
        >
          <SheetHeader>
            <SheetTitle>{name} · 资料与记忆</SheetTitle>
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
              canChat={true}
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
              <Input
                aria-label="搜索本机记录"
                placeholder="搜索本机记录"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
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
                <p className="text-sm text-muted-foreground">
                  {query ? '没有找到匹配的记录。' : '这里还没有记录。'}
                </p>
              )}
              {records.map((record) => (
                <article
                  key={`${record.kind}:${record.key}`}
                  className="space-y-2 rounded-md border border-border p-3"
                >
                  {kind === 'conversation' && (
                    <p className="text-xs text-muted-foreground">
                      {record.source === 'user' ? '你' : '伙伴'}
                    </p>
                  )}
                  {editing?.record.key === record.key && editing.record.kind === record.kind ? (
                    <div className="space-y-2">
                      <Textarea
                        aria-label="编辑记录"
                        value={editing.text}
                        maxLength={10000}
                        onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busy || !editing.text.trim()}
                          onClick={() =>
                            void run(async () => {
                              const next = await api.write({
                                kind: editing.record.kind,
                                key: editing.record.key,
                                text: editing.text,
                                source: '用户在伙伴侧栏修改',
                                parents: editing.record.heads
                              })
                              setEditing(null)
                              return next
                            })
                          }
                        >
                          保存修改
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setEditing(null)}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {record.deleted ? '此设备删除了这条记录' : record.text}
                    </p>
                  )}
                  {kind !== 'conversation' && !record.deleted && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setEditing({ record, text: record.text })}
                    >
                      编辑
                    </Button>
                  )}
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
            <p className="text-xs text-muted-foreground">
              资料和长期记忆保存在本机，退出或重启后仍可读取。伙伴使用自己的工作区，不需要选择项目。
            </p>
            <details className="space-y-3 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-medium">可选：云盘文件同步</summary>
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
            </details>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
