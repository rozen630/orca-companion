import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native'
import { z } from 'zod'
import { useHostClient } from '../transport/host-client-hooks'
import { colors } from '../theme/mobile-theme'
import {
  companionList,
  companionRead,
  companionGroups,
  companionGroupSend
} from './companion-operations'
import { CompanionMobileStateSchema } from '../../../src/shared/companion-rpc-contract'
import type { CompanionGroup } from '../../../src/shared/companion-groups'
import { readCompanionProfile } from '../../../src/shared/companion-profile'
import { readCompanionMemory } from '../../../src/shared/companion-memory'
import { readCompanionTask } from '../../../src/shared/companion-task'
import { structuredAgentSessionPaneKey } from '../../../src/shared/structured-agent-session-projection'

type State = z.infer<typeof CompanionMobileStateSchema>
export function CompanionMobilePanel({
  hostId,
  navigate
}: {
  hostId: string | undefined
  navigate: (href: string) => void
}) {
  const { client } = useHostClient(hostId)
  const [open, setOpen] = useState(false)
  const [companions, setCompanions] = useState<Array<{ id: string; state: State }>>([])
  const [groups, setGroups] = useState<CompanionGroup[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [mentions, setMentions] = useState<string[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const group = groups.find((g) => g.id === groupId)
  const selectedCompanion = companions.find((c) => c.id === selected)
  const name = (state: State) =>
    readCompanionProfile(
      state.records.find((r) => r.kind === 'profile' && r.key === 'identity' && !r.deleted)?.text
    ).name
  async function refresh() {
    if (!client) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const ids = companionList.interpret(await companionList.request(client))
      const entries = await Promise.all(
        ids.map(async (id) => ({
          id,
          state: companionRead.interpret(await companionRead.request(client, { id }))
        }))
      )
      setCompanions(entries)
      setGroups(companionGroups.interpret(await companionGroups.request(client)))
    } catch (e) {
      setError(`伙伴服务暂不可用：${String(e)}`)
    } finally {
      setBusy(false)
    }
  }
  async function send() {
    if (!client || !group) {
      return
    }
    setBusy(true)
    setError('')
    try {
      companionGroupSend.interpret(
        await companionGroupSend.request(client, { id: group.id, text, mentions, delegate: false })
      )
      setText('')
      await refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="伙伴与群聊"
        style={styles.button}
        onPress={() => {
          setOpen(true)
          void refresh()
        }}
      >
        <Text style={styles.text}>伙伴与群聊</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.page}>
          <View style={styles.row}>
            <Pressable
              style={styles.button}
              onPress={() => setOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.text}>关闭</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              disabled={busy}
              onPress={() => void refresh()}
              accessibilityRole="button"
            >
              <Text style={styles.text}>{busy ? '正在读取…' : '刷新'}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Text style={styles.text}>电脑上的伙伴 · 资料与记忆仍保存在电脑</Text>
            {companions.map(({ id, state }) => (
              <Pressable
                key={id}
                style={styles.button}
                onPress={() => {
                  setSelected(id)
                  setGroupId(null)
                }}
              >
                <Text style={styles.text}>{name(state)}</Text>
              </Pressable>
            ))}
            {selectedCompanion && (
              <View style={styles.content}>
                <Text style={styles.text}>{name(selectedCompanion.state)}的资料与记忆</Text>
                <Pressable
                  style={styles.button}
                  accessibilityRole="button"
                  onPress={() => {
                    const c = selectedCompanion.state.canonical
                    if (!c) {
                      setError('请先在电脑端打开此伙伴聊天。')
                      return
                    }
                    const pane = structuredAgentSessionPaneKey(c.tabId, c.sessionId)
                    setOpen(false)
                    navigate(
                      `/h/${encodeURIComponent(hostId ?? '')}/session/${encodeURIComponent(c.worktreeId)}?name=${encodeURIComponent(name(selectedCompanion.state))}&paneKey=${encodeURIComponent(pane)}`
                    )
                  }}
                >
                  <Text style={styles.text}>打开独立聊天</Text>
                </Pressable>
                {selectedCompanion.state.records
                  .filter((r) => !r.deleted && (r.kind === 'memory' || r.kind === 'task'))
                  .map((r) => (
                    <View key={r.key} style={styles.card}>
                      <Text style={styles.muted}>{r.kind === 'memory' ? '记忆' : '待办'}</Text>
                      <Text style={styles.text}>
                        {r.kind === 'memory'
                          ? readCompanionMemory(r.text).body
                          : `${readCompanionTask(r.text).status === 'done' ? '✓ ' : ''}${readCompanionTask(r.text).title}`}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
            <Text style={styles.text}>群聊</Text>
            {groups
              .filter((g) => !g.archived)
              .map((g) => (
                <Pressable
                  style={styles.button}
                  key={g.id}
                  onPress={() => {
                    setGroupId(g.id)
                    setSelected(null)
                    setMentions([])
                  }}
                >
                  <Text style={styles.text}>
                    {g.name}
                    {g.running ? ' · 讨论中' : ''}
                  </Text>
                </Pressable>
              ))}
            {group && (
              <View style={styles.content}>
                {group.messages.map((m) => (
                  <View key={m.id} style={styles.card}>
                    <Text style={styles.muted}>{m.name}</Text>
                    <Text style={m.error ? styles.error : styles.text}>{m.text}</Text>
                  </View>
                ))}
                <View style={styles.row}>
                  {group.members.map((id) => (
                    <Pressable
                      style={styles.button}
                      key={id}
                      onPress={() =>
                        setMentions(
                          mentions.includes(id)
                            ? mentions.filter((m) => m !== id)
                            : [...mentions, id]
                        )
                      }
                    >
                      <Text style={styles.text}>
                        {mentions.includes(id) ? '✓ ' : ''}@
                        {companions.find((c) => c.id === id)
                          ? name(companions.find((c) => c.id === id)!.state)
                          : id}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel="群聊消息"
                  multiline
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  placeholder="群聊消息"
                  placeholderTextColor={colors.textMuted}
                />
                <Pressable
                  style={styles.button}
                  disabled={busy || group.running || !text.trim()}
                  onPress={() => void send()}
                >
                  <Text style={styles.text}>发送</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bgBase, paddingTop: 48, paddingHorizontal: 16 },
  content: { gap: 12, paddingBottom: 24 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { padding: 12, borderRadius: 8, backgroundColor: colors.bgRaised, marginBottom: 4 },
  text: { color: colors.textPrimary, fontSize: 14 },
  muted: { color: colors.textMuted, fontSize: 12 },
  error: { color: colors.statusRed, fontSize: 14 },
  card: { padding: 12, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 8, gap: 8 },
  input: {
    color: colors.textPrimary,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 8,
    padding: 12,
    minHeight: 80
  }
})
