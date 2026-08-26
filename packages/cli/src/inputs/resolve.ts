import fs from 'node:fs'
import path from 'node:path'
import { CodebreakError } from '../errors.js'
import type { InputRequest } from './context.js'

export interface ExplainCliArgs {
  positional?: string
  changes?: boolean
  commit?: string
}

/**
 * Priority: --changes > --commit > positional.
 * A positional becomes File mode when the path exists on disk, otherwise Description.
 * When there is no input at all, callers can fall back to stdin (pipe).
 */
export function resolveInput(args: ExplainCliArgs): InputRequest {
  if (args.changes && args.commit) {
    throw new CodebreakError('Use only one of: --changes or --commit <ref>')
  }
  if (args.changes) return { kind: 'changes' }
  if (args.commit) return { kind: 'commit', ref: args.commit }

  const target = args.positional?.trim()
  if (!target) {
    throw new CodebreakError(
      'Provide an input: --changes, --commit <ref>, a <file/folder path>, or a "<feature description>".',
    )
  }

  try {
    const stat = fs.statSync(target)
    if (!stat.isFile() && !stat.isDirectory()) {
      throw new CodebreakError(`Neither a file nor a directory: ${target}`)
    }
    return { kind: 'file', target: path.resolve(target) }
  } catch (err) {
    if (err instanceof CodebreakError) throw err
    // Path not found on disk → treat it as a natural-language feature description.
    return { kind: 'description', text: target }
  }
}

/** true if stdout/stdin is piped (not a TTY) */
export function stdinIsPiped(): boolean {
  return !process.stdin.isTTY
}

/** Read all of stdin; '' on immediate EOF */
export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data.trim()))
    // Don't hang forever if there is no data
    process.stdin.on('error', () => resolve(''))
    setTimeout(() => resolve(data.trim()), 2_000).unref()
  })
}
