import { randomUUID } from 'node:crypto'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import { computeAgentSessionPayloadFingerprint } from '../../shared/agent-session-mutation-envelope'
import { structuredAgentSessionSendBody } from '../../shared/structured-agent-session-send-mutation'
import { createStructuredAgentSessionOperationId } from '../../shared/structured-agent-session-mutation'
import { createStructuredAgentSessionId } from '../../shared/structured-agent-session-create'
import {
  attachFingerprintFields,
  type AgentSessionAttachParams
} from '../native-chat/agent-session-wire/structured-agent-session-attach'
import { isAdmissibleAgentJournalMessageBody } from '../../shared/agent-session-journal-schemas'

const caller = { callerKey: 'companion-background' }
function host() {
  const value = getStructuredAgentSessionHost()
  if (!value) {
    throw new Error('本机聊天服务尚未就绪')
  }
  return value
}
function envelope(sessionId: string, method: string, fields: Record<string, unknown>) {
  const record = host().deps.store.getRecord(sessionId)
  if (!record) {
    throw new Error('伙伴聊天不存在，请先打开伙伴聊天。')
  }
  return {
    sessionId,
    clientOperationId: createStructuredAgentSessionOperationId(randomUUID),
    expectedRuntimeFence: record.lease.runtimeFence,
    payloadFingerprint: computeAgentSessionPayloadFingerprint({ method, sessionId, fields })
  }
}
export async function createCompanionBackgroundSession(originalSessionId: string): Promise<string> {
  const h = host()
  const original = h.deps.store.getRecord(originalSessionId)
  if (!original || (original.provider !== 'codex' && original.provider !== 'claude')) {
    throw new Error('请先建立此伙伴的本机聊天。')
  }
  const sessionId = createStructuredAgentSessionId(original.provider, randomUUID)
  const params: AgentSessionAttachParams = {
    envelope: {
      sessionId,
      clientOperationId: createStructuredAgentSessionOperationId(randomUUID),
      expectedRuntimeFence: null,
      payloadFingerprint: ''
    },
    location: original.location,
    provider: original.provider,
    agent: original.provider,
    accountHome: original.accountHome,
    runtimeKind: 'native',
    options: original.options
  }
  params.envelope.payloadFingerprint = computeAgentSessionPayloadFingerprint({
    method: 'agentSession.attach',
    sessionId,
    fields: attachFingerprintFields(params)
  })
  const created = await h.create(caller, params)
  if (!created.ok) {
    throw new Error(created.refusal.message)
  }
  const fields = { key: 'permissionMode', value: original.permissionMode ?? 'ask' }
  const permission = await h.setOption(caller, {
    envelope: envelope(sessionId, 'agentSession.setOption', fields),
    ...fields
  })
  if (!permission.ok) {
    throw new Error(permission.refusal.message)
  }
  return sessionId
}
export async function cancelCompanionTurn(sessionId: string): Promise<void> {
  const result = await host().cancel(caller, {
    envelope: envelope(sessionId, 'agentSession.cancel', {})
  })
  if (!result.ok) {
    throw new Error(result.refusal.message)
  }
}
export async function runCompanionTurn(
  sessionId: string,
  text: string,
  signal: AbortSignal
): Promise<string> {
  const h = host()
  if (signal.aborted) {
    throw new Error('已停止')
  }
  if (h.readStatusSummary(sessionId)?.status === 'working') {
    throw new Error('此伙伴正在工作，请稍后重试。')
  }
  if (h.readStatusSummary(sessionId)?.status === 'attention') {
    throw new Error('请先打开执行聊天处理待确认事项。')
  }
  const before = new Set((await h.journalSnapshot(sessionId)).items.map((item) => item.itemId))
  let cleanup = () => {}
  const done = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('伙伴回复超时，已请求停止，请查看执行聊天。'))
      void cancelCompanionTurn(sessionId).catch(() => undefined)
    }, 300000)
    const unsubscribe = h.subscribeTurnCompletions({
      id: randomUUID(),
      includePrompts: true,
      emit: (event) => {
        if (event.type === 'completion' && event.completion.sessionId === sessionId) {
          if (event.completion.outcome === 'success') {
            resolve()
          } else {
            reject(new Error(`伙伴执行未完成：${event.completion.outcome}`))
          }
        } else if (event.type === 'prompt' && event.prompt.sessionId === sessionId) {
          reject(new Error('伙伴需要授权或回答问题，请打开其执行聊天处理。'))
        }
      }
    })
    const aborted = () => {
      reject(new Error('已停止'))
      void cancelCompanionTurn(sessionId).catch(() => undefined)
    }
    signal.addEventListener('abort', aborted, { once: true })
    if (signal.aborted) {
      aborted()
    }
    cleanup = () => {
      clearTimeout(timer)
      unsubscribe()
      signal.removeEventListener('abort', aborted)
    }
  })
  void done.catch(() => undefined)
  try {
    if (signal.aborted) {
      throw new Error('已停止')
    }
    const body = structuredAgentSessionSendBody(text, [])
    const sent = await h.send(caller, {
      envelope: envelope(sessionId, 'agentSession.send', { body }),
      body
    })
    if (!sent.ok) {
      throw new Error(sent.refusal.message)
    }
    await done
    const journal = await h.journalSnapshot(sessionId)
    return journal.items
      .filter((item) => !before.has(item.itemId))
      .flatMap((item) => {
        const body = item.body
        if (!isAdmissibleAgentJournalMessageBody(body) || body.role !== 'assistant') {
          return []
        }
        return body.blocks.flatMap((block) => (block.type === 'text' ? [block.text] : []))
      })
      .join('\n')
  } finally {
    cleanup()
  }
}
