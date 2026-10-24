import { useEffect, useState } from 'react'
import { Heart, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { readCompanionProfile } from '../../../../shared/companion-profile'
import { CompanionSidebar } from './CompanionSidebar'

export function CompanionRoster(): React.JSX.Element | null {
  const api = window.api.companion
  const [ids, setIds] = useState<string[]>([])
  const [newId, setNewId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [soul, setSoul] = useState(readCompanionProfile(undefined).soul)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (api) {
      void api
        .list()
        .then(setIds)
        .catch((cause: unknown) => setError(String(cause)))
    }
  }, [api])
  if (!api) {
    return null
  }
  async function create(): Promise<void> {
    if (!api || busy || !name.trim()) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const id = await api.create({ name: name.trim(), soul })
      setNewId(id)
      setIds(await api.list())
      setOpen(false)
      setName('')
      setSoul(readCompanionProfile(undefined).soul)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-worktree-sidebar-foreground">
        <Heart className="size-4" />
        <span className="flex-1">伙伴</span>
        <Button size="icon-sm" variant="ghost" aria-label="添加伙伴" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
        </Button>
      </div>
      {error && !open && (
        <p role="alert" className="px-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {ids.map((id) => (
        <CompanionSidebar key={id} id={id} initiallyOpen={id === newId} />
      ))}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加伙伴</DialogTitle>
            <DialogDescription>
              每个伙伴拥有独立的聊天、资料和本机记忆，不自动共享其他伙伴的记忆。
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-sm">
            伙伴名字
            <Input
              autoFocus
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            性格与协作方式
            <Textarea
              value={soul}
              maxLength={4000}
              onChange={(event) => setSoul(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button disabled={busy || !name.trim()} onClick={() => void create()}>
            {busy ? '正在创建…' : '创建伙伴'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
