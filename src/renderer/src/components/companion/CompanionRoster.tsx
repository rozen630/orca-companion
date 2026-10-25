import { CompanionGroups } from './CompanionGroups'
import type { CompanionState } from '../../../../shared/companion-api'
import { companionPreferences, companionActivity } from '../../../../shared/companion-preferences'
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
  const [states, setStates] = useState<Record<string, CompanionState>>({})
  const [filter, setFilter] = useState('active')
  const [query, setQuery] = useState('')
  const [newId, setNewId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [soul, setSoul] = useState(readCompanionProfile(undefined).soul)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!api) {
      return
    }
    let disposed = false
    async function refresh() {
      if (!api) {
        return
      }
      try {
        const ids = await api.list()
        const entries = await Promise.all(ids.map(async (id) => [id, await api.read(id)] as const))
        if (!disposed) {
          setIds(ids)
          setStates(Object.fromEntries(entries))
        }
      } catch (cause) {
        if (!disposed) {
          setError(String(cause))
        }
      }
    }
    void refresh()
    const update = () => {
      void refresh()
    }
    window.addEventListener('companion-roster-changed', update)
    const timer = window.setInterval(update, 10000)
    return () => {
      disposed = true
      clearInterval(timer)
      window.removeEventListener('companion-roster-changed', update)
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
      window.dispatchEvent(new Event('companion-roster-changed'))
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
      <div className="space-y-1 px-2">
        <Input
          aria-label="搜索伙伴"
          placeholder="搜索伙伴"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="伙伴列表范围"
          className="w-full rounded-md border border-input bg-background p-1 text-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="active">伙伴</option>
          <option value="hidden">隐藏</option>
          <option value="paused">暂停</option>
          <option value="archived">归档</option>
          <option value="deleted">回收站</option>
        </select>
      </div>
      {ids
        .filter((id) => {
          const records = states[id]?.records ?? []
          const prefs = companionPreferences(records)
          const name = readCompanionProfile(
            records.find((r) => r.kind === 'profile' && r.key === 'identity')?.text
          ).name
          return (
            name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
            (filter === 'hidden'
              ? prefs.hidden && prefs.status === 'active'
              : prefs.status === filter && (filter !== 'active' || !prefs.hidden))
          )
        })
        .sort((a, b) => {
          const ar = states[a]?.records ?? [],
            br = states[b]?.records ?? []
          const ap = companionPreferences(ar),
            bp = companionPreferences(br)
          return (
            Number(bp.pinned) - Number(ap.pinned) ||
            (companionActivity(br, '').latest?.createdAt ?? '').localeCompare(
              companionActivity(ar, '').latest?.createdAt ?? ''
            )
          )
        })
        .map((id) => (
          <CompanionSidebar key={id} id={id} snapshot={states[id]} initiallyOpen={id === newId} />
        ))}
      <CompanionGroups states={states} />
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
