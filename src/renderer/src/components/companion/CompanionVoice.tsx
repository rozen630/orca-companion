import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useNativeChatDictation } from '@/components/native-chat/use-native-chat-dictation'
import { sendMessageToAgent } from '@/lib/agent-message-send'
import { openCompanionChat } from './open-companion-chat'
import type { CompanionApi, CompanionState } from '../../../../shared/companion-api'
import { dispatchDictationControl } from '@/components/dictation/dictation-control-events'

export function CompanionVoice({
  api,
  state
}: {
  api: CompanionApi
  state: CompanionState
}): React.JSX.Element {
  const input = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [voice, setVoice] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const dictation = useNativeChatDictation(input, busy)
  const lastSpoken = useRef('')
  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) {
      return
    }
    const refresh = () => setVoices(synth.getVoices().filter((v) => v.localService))
    refresh()
    synth.addEventListener('voiceschanged', refresh)
    return () => {
      synth.removeEventListener('voiceschanged', refresh)
      synth.cancel()
    }
  }, [])
  useEffect(() => {
    if (!reading) {
      return
    }
    let disposed = false
    const timer = setInterval(() => {
      void api
        .sync()
        .then((current) => {
          if (disposed) {
            return
          }
          const message = current.records
            .filter((r) => r.kind === 'conversation' && r.source === 'assistant' && !r.deleted)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
          if (!message || lastSpoken.current === message.id) {
            return
          }
          lastSpoken.current = message.id
          const utterance = new SpeechSynthesisUtterance(message.text)
          utterance.voice =
            voices.find((v) => v.voiceURI === voice) ??
            voices.find((v) => v.lang.startsWith('zh')) ??
            null
          if (!utterance.voice) {
            setError('系统没有可用的本机朗读声音。')
            setReading(false)
            return
          }
          utterance.onerror = (event) => {
            if (event.error !== 'canceled' && event.error !== 'interrupted') {
              setError(`朗读失败：${event.error}`)
            }
          }
          window.speechSynthesis.speak(utterance)
        })
        .catch((e: unknown) => setError(String(e)))
    }, 3000)
    return () => {
      disposed = true
      clearInterval(timer)
      window.speechSynthesis?.cancel()
    }
  }, [api, reading, voice, voices])
  useEffect(
    () => () => {
      dispatchDictationControl('stop')
    },
    []
  )
  async function send() {
    setBusy(true)
    setError('')
    try {
      await openCompanionChat(api)
      const current = await api.read()
      if (!current.canonical) {
        throw new Error('伙伴聊天尚未建立')
      }
      const result = await sendMessageToAgent({
        worktreeId: current.canonical.worktreeId,
        target: { kind: 'structured-session', sessionId: current.canonical.sessionId },
        prompt: text
      })
      if (result.status !== 'sent') {
        throw new Error('消息尚未确认发送，请稍后重试；文字已保留。')
      }
      setText('')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="space-y-3 border-t border-border pt-3">
      <summary className="cursor-pointer text-sm font-medium">语音聊天</summary>
      <p className="text-xs text-muted-foreground">
        使用 Orca 设置中的语音输入模型，录音转文字后确认发送；回复可用系统本机声音朗读。
      </p>
      <Textarea
        ref={input}
        aria-label="语音转写内容"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="录音转写显示在这里，也可以直接输入"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={dictation.dictationDisabled}
          onClick={dictation.toggleDictation}
        >
          {dictation.isDictating ? '停止录音' : '开始录音'}
        </Button>
        <Button
          size="sm"
          disabled={busy || !text.trim() || dictation.isDictating}
          onClick={() => void send()}
        >
          发送给伙伴
        </Button>
      </div>
      {dictation.dictationDisabled && (
        <p className="text-xs text-muted-foreground">
          请先在 Orca 设置中启用语音输入并选择识别模型。
        </p>
      )}
      <label className="block space-y-1 text-sm">
        朗读声音
        <select
          className="w-full rounded-md border border-input bg-background p-2"
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
        >
          <option value="">系统中文声音</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} · {v.lang}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={!voices.length}
          checked={reading}
          onChange={(e) => {
            lastSpoken.current =
              state.records
                .filter((r) => r.kind === 'conversation' && r.source === 'assistant' && !r.deleted)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id ?? ''
            setReading(e.target.checked)
          }}
        />
        朗读新回复
      </label>
      <Button size="sm" variant="ghost" onClick={() => window.speechSynthesis?.cancel()}>
        停止朗读
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </details>
  )
}
