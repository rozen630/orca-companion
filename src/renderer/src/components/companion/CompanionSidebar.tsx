import { CompanionSkills } from './CompanionSkills'
import { CompanionVoice } from './CompanionVoice'
import { CompanionRoutines } from './CompanionRoutines'
import { CompanionCapabilities } from './CompanionCapabilities'
import { CompanionActions } from './CompanionActions'
import { CompanionRecords } from './CompanionRecords'
import { companionPreferences, companionActivity } from '../../../../shared/companion-preferences'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { scopedCompanionApi } from './scoped-companion-api'
import { useAppStore } from '@/store'
import { structuredChatTabBySessionId } from '@/lib/structured-chat-tab-index'
import { readCompanionProfile } from '../../../../shared/companion-profile'
import { Button } from '@/components/ui/button'
import { CompanionProfile } from './CompanionProfile'
import { hasMacTrafficLights } from '@/app-shell/app-window-chrome'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { openCompanionChat } from './open-companion-chat'
import type { CompanionState, CompanionWrite } from '../../../../shared/companion-api'

export function CompanionSidebar({
  id,
  initiallyOpen = false,
  snapshot
}: {
  id: string
  initiallyOpen?: boolean
  snapshot?: CompanionState
}): React.JSX.Element | null {
  const manager = window.api.companion
  const api = useMemo(() => (manager ? scopedCompanionApi(manager, id) : undefined), [manager, id])
  const [open, setOpen] = useState(initiallyOpen)
  const [localState, setState] = useState<CompanionState | null>(null)
  const state =
    snapshot && (!localState || snapshot.eventCount > localState.eventCount) ? snapshot : localState
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const tabs = useAppStore((s) => s.unifiedTabsByWorktree)
  const run = useCallback(async (action: () => Promise<CompanionState>) => {
    setBusy(true)
    setError('')
    try {
      setState(await action())
      window.dispatchEvent(new Event('companion-roster-changed'))
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
  const preferences = companionPreferences(state?.records ?? [])
  const activity = companionActivity(state?.records ?? [], preferences.readAt)
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
  const write = async (input: CompanionWrite): Promise<boolean> => {
    setBusy(true)
    setError('')
    try {
      setState(await api.write(input))
      window.dispatchEvent(new Event('companion-roster-changed'))
      return true
    } catch (cause) {
      setError(String(cause))
      return false
    } finally {
      setBusy(false)
    }
  }
  async function chat(): Promise<void> {
    if (!api) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await openCompanionChat(api)
      const fresh = await api.read()
      const pref = fresh.records.find((r) => r.kind === 'profile' && r.key === 'preferences')
      setState(
        await api.write({
          kind: 'profile',
          key: 'preferences',
          text: JSON.stringify({
            ...companionPreferences(fresh.records),
            readAt: new Date().toISOString()
          }),
          parents: pref?.heads ?? [],
          source: '用户阅读伙伴聊天'
        })
      )
      window.dispatchEvent(new Event('companion-roster-changed'))
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
      {state && (
        <div className="flex items-center gap-1 pl-4">
          <button
            type="button"
            disabled={busy || preferences.status !== 'active'}
            aria-label={`与${name}聊天`}
            aria-current={canonical?.worktreeId === activeWorktreeId ? 'page' : undefined}
            onClick={() => void chat()}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-worktree-sidebar-foreground hover:bg-worktree-sidebar-accent aria-[current=page]:bg-worktree-sidebar-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-worktree-sidebar-accent text-xs"
            >
              {preferences.avatar ? (
                <img src={preferences.avatar} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                Array.from(name)[0]
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                {preferences.pinned ? '⌖ ' : ''}
                {name}
              </span>
              {activity.latest && (
                <span className="block truncate text-xs text-muted-foreground">
                  {activity.latest.text}
                </span>
              )}
            </span>
            {activity.unread > 0 && (
              <span aria-label={`${activity.unread} 条未读`} className="text-xs">
                {activity.unread}
              </span>
            )}
          </button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`${name}的资料与记忆`}
            onClick={() => setOpen(true)}
          >
            <Settings2 className="size-4" />
          </Button>
          <CompanionActions
            id={id}
            name={name}
            state={state}
            api={api}
            changed={() => {
              void run(api.read)
            }}
          />
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
            <SheetDescription>此伙伴的专属聊天与本机长期记忆。</SheetDescription>
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
              canChat={preferences.status === 'active'}
              onWrite={write}
              onChat={chat}
            />
            {state && (
              <CompanionCapabilities
                key={state.records.find((r) => r.key === 'preferences')?.id ?? 'new'}
                state={state}
                busy={busy}
                write={write}
              />
            )}
            {state && (
              <CompanionRoutines
                id={id}
                api={api}
                state={state}
                changed={() => void run(api.read)}
              />
            )}
            {state && <CompanionVoice api={api} state={state} />}
            {state && (
              <CompanionSkills id={id} api={api} state={state} changed={() => void run(api.read)} />
            )}
            <CompanionRecords
              records={state?.records ?? []}
              busy={busy}
              write={write}
              refresh={() => void run(api.read)}
            />
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
