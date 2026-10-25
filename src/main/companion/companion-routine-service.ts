import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { nextAutomationOccurrenceAfter } from '../../shared/automation-schedule-occurrences'
import {
  companionRoutineSchema,
  type CompanionRoutine,
  type CompanionRoutinesApi
} from '../../shared/companion-routines'
import { companionPreferences } from '../../shared/companion-preferences'
import { readCompanionProfile } from '../../shared/companion-profile'
import { createCompanionBackgroundSession, runCompanionTurn } from './companion-agent-turn'
import { applyLearning, learningPrompt, undoLearning } from './companion-learning'
import type { CompanionApi } from '../../shared/companion-api'

type Service = Pick<CompanionApi, 'read' | 'prepare' | 'write'>
export class CompanionRoutineService implements CompanionRoutinesApi {
  private data: CompanionRoutine[] | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private active = new Map<string, AbortController>()
  constructor(
    private readonly root: string,
    private readonly service: (id: string) => Promise<Service>
  ) {}
  private serial<T>(action: () => Promise<T>) {
    const next = this.queue.then(action)
    this.queue = next.catch(() => undefined)
    return next
  }
  private async load() {
    if (this.data) {
      return this.data
    }
    try {
      this.data = z
        .array(companionRoutineSchema)
        .parse(JSON.parse(await readFile(join(this.root, 'companion-routines.json'), 'utf8')))
    } catch (e) {
      if (e instanceof Error && 'code' in e && e.code === 'ENOENT') {
        this.data = []
      } else {
        throw e
      }
    }
    for (const routine of this.data) {
      for (const run of routine.runs) {
        if (run.status === 'running') {
          run.status = 'interrupted'
          run.result = '应用重启，未自动重复执行。'
        }
      }
      routine.nextAt = routine.enabled
        ? nextAutomationOccurrenceAfter(routine.schedule, Date.now(), Date.now())
        : 0
    }
    await this.persist()
    return this.data
  }
  private async persist() {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    const temporary = join(this.root, `companion-routines-${randomUUID()}.tmp`)
    await writeFile(temporary, JSON.stringify(this.data), { mode: 0o600 })
    await rename(temporary, join(this.root, 'companion-routines.json'))
  }
  list = (id: string) =>
    this.serial(async () =>
      structuredClone((await this.load()).filter((r) => r.companionId === id))
    )
  save: CompanionRoutinesApi['save'] = (input) =>
    this.serial(async () => {
      const data = await this.load()
      const old = data.find((r) => r.id === input.id)
      if (input.id && !old) {
        throw new Error('例行任务不存在')
      }
      if (old && old.companionId !== input.companionId) {
        throw new Error('不能修改任务所属伙伴')
      }
      if (old && this.active.has(old.id)) {
        throw new Error('请先停止当前执行，再编辑规则。')
      }
      await this.service(input.companionId)
      const routine = companionRoutineSchema.parse({
        ...old,
        companionId: input.companionId,
        name: input.name,
        prompt: input.prompt,
        schedule: input.schedule,
        enabled: input.enabled,
        kind: input.kind,
        event: input.event ?? old?.event ?? 'none',
        id: old?.id ?? randomUUID()
      })
      routine.nextAt = nextAutomationOccurrenceAfter(routine.schedule, Date.now(), Date.now())
      if (!Number.isFinite(routine.nextAt)) {
        throw new Error('时间规则没有下一次执行时间')
      }
      const snapshot = await (await this.service(routine.companionId)).read()
      routine.eventCursor =
        snapshot.records.find(
          (r) =>
            r.kind === routine.event &&
            !r.deleted &&
            (r.source.startsWith('用户') || r.source === 'user')
        )?.id ?? ''
      if (!routine.enabled) {
        routine.nextAt = 0
      }
      if (old) {
        data[data.indexOf(old)] = routine
      } else {
        data.push(routine)
      }
      await this.persist()
      return structuredClone(routine)
    })
  run = async (id: string) => {
    const controller = new AbortController()
    const routine = await this.serial(async () => {
      const routine = (await this.load()).find((r) => r.id === id)
      if (!routine) {
        throw new Error('例行任务不存在')
      }
      if (
        (await this.load()).some(
          (r) => r.companionId === routine.companionId && this.active.has(r.id)
        )
      ) {
        throw new Error('伙伴正在执行其他例行任务，请稍后重试。')
      }
      const state = await (await this.service(routine.companionId)).read()
      if (companionPreferences(state.records).status !== 'active') {
        throw new Error('伙伴已暂停、归档或移除')
      }
      if (!state.canonical) {
        throw new Error('请先打开伙伴聊天，完成引擎配置。')
      }
      routine.runs.unshift({
        id: randomUUID(),
        at: new Date().toISOString(),
        status: 'running',
        result: ''
      })
      this.active.set(id, controller)
      try {
        await this.persist()
      } catch (e) {
        this.active.delete(id)
        throw e
      }
      return routine
    })
    void this.execute(routine, controller).catch(() => undefined)
  }
  stop = async (id: string) => {
    this.active.get(id)?.abort()
  }
  remove = (id: string) =>
    this.serial(async () => {
      if (this.active.has(id)) {
        throw new Error('请先停止并等待执行结束，再删除规则。')
      }
      this.data = (await this.load()).filter((r) => r.id !== id)
      await this.persist()
    })
  undo = async (id: string, key: string) => {
    const service = await this.service(id)
    await undoLearning(await service.read(), key, service.write)
  }
  async tick() {
    const routines = await this.serial(async () => [...(await this.load())])
    for (const routine of routines) {
      const state = await (await this.service(routine.companionId)).read()
      if (companionPreferences(state.records).status !== 'active') {
        this.active.get(routine.id)?.abort()
        if (routine.enabled && routine.nextAt <= Date.now()) {
          await this.serial(async () => {
            routine.nextAt = nextAutomationOccurrenceAfter(routine.schedule, Date.now(), Date.now())
            await this.persist()
          })
        }
        continue
      }
      if (!routine.enabled || this.active.has(routine.id)) {
        continue
      }
      const event = state.records.find(
        (r) =>
          r.kind === routine.event &&
          !r.deleted &&
          (r.source.startsWith('用户') || r.source === 'user')
      )
      const changed = !!event && event.id !== routine.eventCursor
      if (!changed && routine.nextAt > Date.now()) {
        continue
      }
      if (!changed && Date.now() - routine.nextAt > 90000) {
        await this.serial(async () => {
          routine.nextAt = nextAutomationOccurrenceAfter(routine.schedule, Date.now(), Date.now())
          await this.persist()
        })
        continue
      }
      if (event) {
        await this.serial(async () => {
          routine.eventCursor = event.id
          await this.persist()
        })
      }
      try {
        await this.run(routine.id)
      } catch (error) {
        await this.serial(async () => {
          routine.runs.unshift({
            id: randomUUID(),
            at: new Date().toISOString(),
            status: 'failed',
            result: String(error)
          })
          await this.persist()
        })
      } finally {
        await this.serial(async () => {
          routine.nextAt = nextAutomationOccurrenceAfter(routine.schedule, Date.now(), Date.now())
          await this.persist()
        })
      }
    }
  }
  async stopForCompanion(id: string): Promise<void> {
    for (const routine of await this.load()) {
      if (routine.companionId === id) {
        this.active.get(routine.id)?.abort()
      }
    }
  }
  async stopAll() {
    for (const controller of this.active.values()) {
      controller.abort()
    }
  }
  private async execute(routine: CompanionRoutine, controller: AbortController) {
    const run = routine.runs[0]
    try {
      const service = await this.service(routine.companionId)
      const state = await service.prepare()
      if (!state.canonical) {
        throw new Error('伙伴聊天不存在')
      }
      if (!routine.sessionId) {
        const session = await createCompanionBackgroundSession(state.canonical.sessionId)
        await this.serial(async () => {
          routine.sessionId = session
          run.sessionId = session
          await this.persist()
        })
      }
      if (
        controller.signal.aborted ||
        companionPreferences((await service.read()).records).status !== 'active'
      ) {
        throw new Error('伙伴已停止')
      }
      const profile = readCompanionProfile(
        state.records.find((r) => r.kind === 'profile' && r.key === 'identity')?.text
      )
      const prompt =
        routine.kind === 'learning'
          ? learningPrompt(state)
          : `你是${profile.name}。${profile.soul}\n${companionPreferences(state.records).skills}\n这是主人配置的例行任务：${routine.name}。先读取自己的本机记忆，不访问其他伙伴目录。\n${routine.prompt}`
      if (!routine.sessionId) {
        throw new Error('执行会话尚未建立')
      }
      const answer = await runCompanionTurn(routine.sessionId, prompt, controller.signal)
      run.result =
        routine.kind === 'learning' ? await applyLearning(state, answer, service.write) : answer
      run.status = 'completed'
      if (routine.kind === 'task') {
        await service.write({
          kind: 'journal',
          key: `routine:${run.id}`,
          text: run.result,
          source: `例行任务：${routine.name}`
        })
      }
    } catch (e) {
      run.status = controller.signal.aborted ? 'interrupted' : 'failed'
      run.result = String(e)
    } finally {
      await this.serial(async () => {
        await this.persist()
        this.active.delete(routine.id)
      })
    }
  }
}
