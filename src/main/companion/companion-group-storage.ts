import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  companionGroupSchema,
  type CompanionGroup,
  type CompanionGroupTopic
} from '../../shared/companion-groups'

export function appendGroupMessage(
  topic: CompanionGroupTopic,
  author: string,
  name: string,
  text: string,
  error = false
): void {
  topic.messages.push({ id: randomUUID(), author, name, text, at: new Date().toISOString(), error })
}

export async function persistCompanionGroups(
  root: string,
  groups: CompanionGroup[]
): Promise<void> {
  await mkdir(root, { recursive: true, mode: 0o700 })
  const temporary = join(root, `companion-groups-${randomUUID()}.tmp`)
  await writeFile(temporary, JSON.stringify(groups), { mode: 0o600 })
  await rename(temporary, join(root, 'companion-groups.json'))
}

export async function loadCompanionGroups(root: string): Promise<CompanionGroup[]> {
  let groups: CompanionGroup[]
  try {
    groups = z
      .array(companionGroupSchema)
      .parse(JSON.parse(await readFile(join(root, 'companion-groups.json'), 'utf8')))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      groups = []
    } else {
      throw error
    }
  }
  for (const group of groups) {
    if (!group.topics.length) {
      group.topics.push({
        id: randomUUID(),
        name: '主话题',
        sessions: group.sessions,
        messages: group.messages,
        jobs: [],
        running: group.running,
        archived: false
      })
      group.sessions = {}
      group.messages = []
    }
    for (const topic of group.topics) {
      if (topic.running) {
        topic.running = false
        appendGroupMessage(topic, 'system', '系统', '应用重启，上次未完成的讨论已中断。', true)
      }
      for (const job of topic.jobs) {
        if (job.status === 'running') {
          job.status = 'interrupted'
          for (const step of job.steps) {
            if (step.status === 'running' || step.status === 'queued') {
              step.status = 'interrupted'
            }
          }
        }
      }
    }
    group.running = false
  }
  await persistCompanionGroups(root, groups)
  return groups
}
