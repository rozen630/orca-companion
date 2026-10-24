import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CompanionRecord, CompanionWrite } from '../../../../shared/companion-api'

type CompanionProfileProps = {
  profile: CompanionRecord | undefined
  busy: boolean
  canChat: boolean
  onWrite: (input: CompanionWrite) => Promise<void>
  onChat: () => Promise<void>
}

function readProfileDraft(text: string | undefined): {
  name: string
  soul: string
  invalid: boolean
} {
  const defaults = {
    name: '小鲸',
    soul: '坦诚、温暖、主动推进事情。默认用中文交流。',
    invalid: false
  }
  if (!text) {
    return defaults
  }
  try {
    const value: unknown = JSON.parse(text)
    if (
      value &&
      typeof value === 'object' &&
      'name' in value &&
      typeof value.name === 'string' &&
      'soul' in value &&
      typeof value.soul === 'string'
    ) {
      return { name: value.name, soul: value.soul, invalid: false }
    }
  } catch {
    return { ...defaults, invalid: true }
  }
  return { ...defaults, invalid: true }
}

export function CompanionProfile({
  profile,
  busy,
  canChat,
  onWrite,
  onChat
}: CompanionProfileProps): React.JSX.Element {
  const initial = readProfileDraft(profile?.deleted ? undefined : profile?.text)
  const [name, setName] = useState(initial.name)
  const [soul, setSoul] = useState(initial.soul)
  const invalid = initial.invalid
  const saved =
    profile &&
    !profile.deleted &&
    profile.conflicts.length === 0 &&
    profile.text === JSON.stringify({ name, soul })
  return (
    <section className="space-y-3">
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          伙伴资料格式有误，请修改后重新保存。
        </p>
      )}
      <label className="block space-y-1 text-sm">
        名字
        <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block space-y-1 text-sm">
        性格与协作方式
        <Textarea value={soul} maxLength={4000} onChange={(e) => setSoul(e.target.value)} />
      </label>
      {profile && profile.conflicts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            资料有并发修改。请选择版本，或修改上方内容后保存：
          </p>
          {[profile, ...profile.conflicts].map((version) => (
            <Button
              key={version.id}
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal"
              disabled={busy}
              onClick={() =>
                void onWrite({
                  kind: 'profile',
                  key: 'identity',
                  text: version.text,
                  deleted: version.deleted,
                  parents: profile.heads,
                  source: '用户解决资料冲突'
                })
              }
            >
              {version.deleted ? '保留删除' : version.text.slice(0, 100)}
            </Button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !name.trim() || saved}
          onClick={() =>
            void onWrite({
              kind: 'profile',
              key: 'identity',
              text: JSON.stringify({ name, soul }),
              source: '用户在伙伴侧栏设置',
              parents: profile?.heads ?? []
            })
          }
        >
          {saved ? '已保存' : '保存资料'}
        </Button>
        <Button size="sm" disabled={busy || !canChat} onClick={() => void onChat()}>
          与伙伴聊天
        </Button>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {saved
          ? `已保存到本机 · ${new Date(profile.createdAt).toLocaleString()}`
          : '资料尚未保存。保存到本机不需要连接云盘。'}
      </p>
      {!canChat && (
        <p className="text-xs text-muted-foreground">本机聊天服务暂不可用，请稍后重试。</p>
      )}
    </section>
  )
}
