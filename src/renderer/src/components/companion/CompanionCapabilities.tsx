import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { companionPreferences } from '../../../../shared/companion-preferences'
import type { CompanionState, CompanionWrite } from '../../../../shared/companion-api'

export function CompanionCapabilities({
  state,
  busy,
  write
}: {
  state: CompanionState
  busy: boolean
  write: (input: CompanionWrite) => Promise<boolean>
}): React.JSX.Element {
  const initial = companionPreferences(state.records)
  const [avatar, setAvatar] = useState(initial.avatar)
  const [agent, setAgent] = useState(initial.agent)
  const [model, setModel] = useState(initial.model)
  const [skills, setSkills] = useState(initial.skills)
  const [error, setError] = useState('')
  async function picture(file?: File) {
    if (!file) {
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 60000) {
      setError('请选择小于 60 KB 的 PNG、JPEG 或 WebP 图片。')
      return
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('无法读取头像'))
      reader.onerror = () => reject(new Error('无法读取头像'))
      reader.readAsDataURL(file)
    })
    setAvatar(data)
    setError('')
  }
  return (
    <details className="space-y-3 border-t border-border pt-3">
      <summary className="cursor-pointer text-sm font-medium">头像、模型与技能</summary>
      {avatar && (
        <img src={avatar} alt="伙伴头像预览" className="size-10 rounded-full object-cover" />
      )}
      <label className="block space-y-1 text-sm">
        头像
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) =>
            void picture(e.target.files?.[0]).catch((e: unknown) => setError(String(e)))
          }
        />
      </label>
      <Button size="sm" variant="ghost" onClick={() => setAvatar('')}>
        使用名字头像
      </Button>
      <label className="block space-y-1 text-sm">
        聊天引擎
        <select
          disabled={!!state.canonical}
          className="w-full rounded-md border border-input bg-background p-2"
          value={agent}
          onChange={(e) => setAgent(e.target.value === 'claude' ? 'claude' : 'codex')}
        >
          <option value="codex">Codex</option>
          <option value="claude">Claude Code</option>
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        默认模型
        <Input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="留空使用引擎默认模型"
          disabled={!!state.canonical}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        引擎与默认模型用于首次建立聊天；已有聊天可在聊天输入框的模型菜单切换。连接与凭据沿用 Orca
        设置。
      </p>
      <label className="block space-y-1 text-sm">
        伙伴技能与工作要求
        <Textarea
          value={skills}
          maxLength={8000}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="填写已安装的技能名及其使用要求"
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button
        size="sm"
        disabled={busy}
        onClick={() =>
          void write({
            kind: 'profile',
            key: 'preferences',
            text: JSON.stringify({ ...initial, avatar, agent, model, skills }),
            parents:
              state.records.find((r) => r.kind === 'profile' && r.key === 'preferences')?.heads ??
              [],
            source: '用户设置伙伴能力'
          })
        }
      >
        保存能力设置
      </Button>
    </details>
  )
}
