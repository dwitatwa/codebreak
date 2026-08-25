import ora from 'ora'
import pc from 'picocolors'
import type { Depth } from '../config.js'
import { loadConfig } from '../config.js'
import { explain } from '../core/explain.js'
import { createProvider } from '../llm/factory.js'
import type { InputRequest } from '../inputs/context.js'
import { readStdin, resolveInput, stdinIsPiped } from '../inputs/resolve.js'

export interface ExplainFlags {
  changes?: boolean
  commit?: string
  lang?: string
  focus?: string
  depth?: Depth
  context?: string
  locale?: string
  maxContext?: string
  web?: boolean
}

export async function runExplain(target: string | undefined, flags: ExplainFlags): Promise<void> {
  const cfg = loadConfig()

  let positional = target?.trim()
  let extraContext = flags.context ?? ''

  // Stdin yang dipipakan: tanpa input lain → jadi deskripsi;
  // dengan input lain → jadi konteks tambahan.
  if (stdinIsPiped()) {
    const piped = await readStdin()
    if (piped) {
      if (!positional && !flags.changes && !flags.commit) {
        positional = piped
      } else {
        extraContext = extraContext ? `${extraContext}\n\n${piped}` : piped
      }
    }
  }

  const input: InputRequest = resolveInput({
    positional,
    changes: flags.changes,
    commit: flags.commit,
  })

  const provider = createProvider()
  const spin = ora({ text: 'Preparing…', color: 'cyan' }).start()

  try {
    const result = await explain(
      { provider, cwd: process.cwd(), cfg, stage: (msg) => (spin.text = msg) },
      {
        input,
        lang: flags.lang?.split(',').map((s) => s.trim()).filter(Boolean),
        focus: flags.focus,
        extraContext: extraContext.trim() || undefined,
        depth: flags.depth,
        locale: flags.locale,
        maxContextChars: flags.maxContext ? Number(flags.maxContext) : undefined,
      },
    )
    spin.succeed(`Document created: ${pc.bold(result.docRelPath)}`)
    console.log()

    if (result.tldr) {
      console.log(pc.bold(`${result.tldrHeadingText}:`))
      console.log(pc.dim(result.tldr))
      console.log()
    }

    if (result.selectedFiles && result.selectedFiles.length > 0) {
      console.log(
        pc.dim(
          `Files analyzed (${result.selectedFiles.length}): ${result.selectedFiles.join(', ')}`,
        ),
      )
    }
    if (result.contextTruncated) {
      console.log(pc.yellow('⚠ Context was truncated because it exceeded the budget — try --lang or a narrower scope.'))
    }

    console.log(pc.dim(`Open the viewer: codebreak view`))
    if (flags.web) {
      const { runView } = await import('./view.js')
      await runView({ open: true })
    }
  } catch (err) {
    spin.fail('Failed.')
    throw err
  }
}
