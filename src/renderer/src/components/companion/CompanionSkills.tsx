import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CompanionApi, CompanionState } from '../../../../shared/companion-api'
const skillSchema = z.object({
  name: z.string(),
  instruction: z.string(),
  enabled: z.boolean().default(false)
})
const learningSchema = z.object({
  summary: z.string(),
  undone: z.boolean().optional(),
  skillCandidates: z.array(skillSchema).default([])
})
export function CompanionSkills({
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
  const [name, setName] = useState(''),
    [instruction, setInstruction] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function save(skill: z.infer<typeof skillSchema>) {
    setBusy(true)
    setError('')
    try {
      await api.saveSkill(skill)
      changed()
      setName('')
      setInstruction('')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  const skills = state.records
    .filter((r) => r.kind === 'profile' && r.key.startsWith('skill:') && !r.deleted)
    .flatMap((r) => {
      try {
        const result = skillSchema.safeParse(JSON.parse(r.text))
        return result.success ? [result.data] : []
      } catch {
        return []
      }
    })
  const learnings = state.records
    .filter((r) => r.kind === 'journal' && r.source === '伙伴记忆整理' && !r.deleted)
    .flatMap((r) => {
      try {
        const result = learningSchema.safeParse(JSON.parse(r.text))
        return result.success ? [{ key: r.key, ...result.data }] : []
      } catch {
        return []
      }
    })
  return (
    <details className="space-y-3 border-t border-border pt-3">
      <summary className="cursor-pointer text-sm font-medium">专属技能与学习记录</summary>
      <Input
        aria-label="技能名字"
        placeholder="技能名字"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
      />
      <Textarea
        aria-label="技能步骤"
        placeholder="可复用的工作步骤"
        value={instruction}
        maxLength={8000}
        onChange={(e) => setInstruction(e.target.value)}
      />
      <Button
        size="sm"
        disabled={busy || !name.trim() || !instruction.trim()}
        onClick={() => void save({ name, instruction, enabled: true })}
      >
        保存并启用技能
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {skills.map((s) => (
        <article key={s.name} className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm font-medium">
            {s.name} · {s.enabled ? '已启用' : '已停用'}
          </p>
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">{s.instruction}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void save({ ...s, enabled: !s.enabled })}
            >
              {s.enabled ? '停用' : '启用'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setName(s.name)
                setInstruction(s.instruction)
              }}
            >
              编辑
            </Button>
          </div>
        </article>
      ))}
      {learnings.map((run) => (
        <article key={run.key} className="space-y-2 border-t border-border pt-3">
          <p className="text-sm">{run.summary}</p>
          {run.skillCandidates.map((s) => (
            <div key={s.name} className="space-y-2">
              <p className="text-sm">技能候选：{s.name}</p>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{s.instruction}</p>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void save({ ...s, enabled: true })}
              >
                采用为专属技能
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || run.undone}
            onClick={() => {
              setBusy(true)
              void api.routines
                .undo(id, run.key)
                .then(changed)
                .catch((e: unknown) => setError(String(e)))
                .finally(() => setBusy(false))
            }}
          >
            {run.undone ? '记忆修改已撤销' : '撤销此次记忆修改'}
          </Button>
        </article>
      ))}
    </details>
  )
}
