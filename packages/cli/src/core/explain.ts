import { findGitRoot } from '../git/repo.js'
import type { CodebreakConfig, Depth } from '../config.js'
import {
  extensionSet,
  gatherChangesContext,
  gatherCommitContext,
  gatherFilesContext,
  gatherSelectedFiles,
} from './gatherers.js'
import type { GatheredContext, InputRequest } from '../inputs/context.js'
import { buildSystemPrompt, buildUserPrompt, localeName, tldrHeading } from '../llm/prompts.js'
import { selectRelevantFiles } from '../llm/relevance.js'
import type { LlmProvider } from '../llm/types.js'
import { emitDoc, extractTldr, sanitizeBody, type DocFrontmatter } from '../render/mdx.js'

export interface ExplainOptions {
  input: InputRequest
  /** --lang ts,js */
  lang?: string[]
  /** --focus "teks" */
  focus?: string
  /** --context + isi stdin pipe (sudah digabung caller) */
  extraContext?: string
  /** override config.depth */
  depth?: Depth
  /** override config.outputLocale */
  locale?: string
  maxContextChars?: number
}

export interface ExplainDeps {
  provider: LlmProvider
  cwd: string
  cfg: CodebreakConfig
  /** Progress reporting untuk spinner CLI */
  stage?(msg: string): void
}

export interface ExplainResult {
  docAbsPath: string
  docRelPath: string
  tldr: string
  tldrHeadingText: string
  selectedFiles?: string[]
  contextTruncated: boolean
  title: string
}

/**
 * Orkestrator inti yang bebas dari terminal I/O supaya mudah dites:
 * resolve mode → kumpulkan konteks → prompt LLM → emit dokumen MDX.
 */
export async function explain(deps: ExplainDeps, opts: ExplainOptions): Promise<ExplainResult> {
  const stage = deps.stage ?? (() => {})
  const depth = opts.depth ?? deps.cfg.depth
  const locale = opts.locale ?? deps.cfg.outputLocale
  const maxChars = opts.maxContextChars ?? deps.cfg.maxContextChars
  const exts = extensionSet(opts.lang)
  const rootDir = findGitRoot(deps.cwd) ?? deps.cwd

  let ctx: GatheredContext
  switch (opts.input.kind) {
    case 'changes':
      stage('Membaca local changes…')
      ctx = await gatherChangesContext(deps.cwd, { extensions: exts, maxContextChars: maxChars })
      break
    case 'commit':
      stage(`Membaca commit ${opts.input.ref}…`)
      ctx = await gatherCommitContext(deps.cwd, opts.input.ref, {
        extensions: exts,
        maxContextChars: maxChars,
      })
      break
    case 'file':
      stage('Membaca file…')
      ctx = gatherFilesContext(opts.input.target, { extensions: exts, maxContextChars: maxChars })
      break
    case 'description':
      ctx = await gatherDescriptionContext(deps, rootDir, opts.input.text, exts, maxChars, stage)
      break
  }

  const system = buildSystemPrompt(depth, locale)
  const user = buildUserPrompt(ctx, { focus: opts.focus, extraContext: opts.extraContext })

  stage(`Menganalisis dengan ${deps.provider.model}…`)
  const raw = await deps.provider.complete({ system, user })
  const body = sanitizeBody(raw)

  if (!body.trim()) {
    throw new Error('LLM mengembalikan jawaban kosong.')
  }

  const fm: DocFrontmatter = {
    title: ctx.title,
    type: ctx.kind,
    source: ctx.sourceLabel,
    date: new Date().toISOString().slice(0, 10),
    model: deps.provider.model,
    depth,
    locale,
  }
  const doc = emitDoc(deps.cwd, body, fm)

  return {
    docAbsPath: doc.absPath,
    docRelPath: doc.relPath,
    tldr: extractTldr(body),
    tldrHeadingText: tldrHeading(locale),
    selectedFiles: ctx.selectedFiles,
    contextTruncated: ctx.truncated ?? false,
    title: ctx.title,
  }
}

async function gatherDescriptionContext(
  deps: ExplainDeps,
  rootDir: string,
  text: string,
  exts: Set<string> | undefined,
  maxChars: number,
  stage: (msg: string) => void,
): Promise<GatheredContext> {
  stage('Memetakan repository & mencari file relevan…')
  const files = await selectRelevantFiles(rootDir, text, deps.provider, {
    extensions: exts,
    maxFiles: deps.cfg.maxRelevantFiles,
  })
  stage(`Membaca ${files.length} file relevan…`)
  const { material, truncated } = gatherSelectedFiles(rootDir, files, maxChars)

  return {
    kind: 'description',
    title: text.length > 60 ? `${text.slice(0, 57)}...` : text,
    sourceLabel: text,
    material,
    selectedFiles: files,
    truncated,
  }
}
