import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import {
  companionPreferences,
  type CompanionPreferences
} from '../../../../shared/companion-preferences'
import type { CompanionState, CompanionApi } from '../../../../shared/companion-api'

export function CompanionActions({
  id,
  name,
  state,
  api,
  changed
}: {
  id: string
  name: string
  state: CompanionState
  api: CompanionApi
  changed: () => void
}): React.JSX.Element {
  const prefs = companionPreferences(state.records)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmed, setConfirmed] = useState('')
  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      changed()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  async function patch(update: Partial<CompanionPreferences>) {
    const current = await api.read()
    const record = current.records.find((r) => r.kind === 'profile' && r.key === 'preferences')
    await api.write({
      kind: 'profile',
      key: 'preferences',
      text: JSON.stringify({ ...companionPreferences(current.records), ...update }),
      parents: record?.heads ?? [],
      source: '用户管理伙伴'
    })
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={`管理${name}`} disabled={busy}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => void run(() => patch({ pinned: !prefs.pinned }))}>
            {prefs.pinned ? '取消置顶' : '置顶'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void run(() => patch({ hidden: !prefs.hidden }))}>
            {prefs.hidden ? '显示伙伴' : '隐藏伙伴'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void run(() => api.duplicate(id))}>
            复制名字与性格
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              void run(() => patch({ status: prefs.status === 'paused' ? 'active' : 'paused' }))
            }
          >
            {prefs.status === 'paused' ? '恢复伙伴' : '暂停伙伴'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              void run(() => patch({ status: prefs.status === 'archived' ? 'active' : 'archived' }))
            }
          >
            {prefs.status === 'archived' ? '取消归档' : '归档伙伴'}
          </DropdownMenuItem>
          {prefs.status === 'deleted' ? (
            <DropdownMenuItem
              onSelect={() => void run(() => patch({ status: 'active', hidden: false }))}
            >
              从回收站恢复
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setDeleting(true)}>移入回收站…</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移除 {name}</DialogTitle>
            <DialogDescription>
              伙伴会移入回收站并停止伙伴自动任务，聊天和记忆保留，可在回收站恢复。输入伙伴名字确认。
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="确认伙伴名字"
            value={confirmed}
            onChange={(e) => setConfirmed(e.target.value)}
          />
          <Button
            disabled={busy || confirmed !== name}
            onClick={() =>
              void run(async () => {
                await patch({ status: 'deleted' })
                setDeleting(false)
              })
            }
          >
            移入回收站
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
