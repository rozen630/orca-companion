#!/usr/bin/env node
import { context, snapshot, put, synchronize, search } from './store.mjs'
import { readFile } from 'node:fs/promises'

const [home, command = 'context', argument] = process.argv.slice(2)
try {
  if (!home) {
    throw new Error(
      'Usage: node cli.mjs <companion-home> context|list|search|put|sync [json-file|sync-folder]'
    )
  }
  let result
  if (command === 'context') {
    result = await context(home)
  } else if (command === 'list') {
    result = await snapshot(home)
  } else if (command === 'search') {
    result = await search(home, argument)
  } else if (command === 'put') {
    result = await put(home, JSON.parse(await readFile(argument, 'utf8')))
  } else if (command === 'sync') {
    result = await synchronize(home, argument)
  } else {
    throw new Error('Unknown command')
  }
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
