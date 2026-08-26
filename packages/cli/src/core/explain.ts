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
import { emitDoc, extractTldr, repairMdxBody, sanitizeBody, type DocFrontmatter } from '../render/mdx.js'

export interface ExplainOptions {
  input: InputRequest
  /** --lang ts,js */
  lang?: string[]
  /** --focus "text" */
  focus?: string
  /** --context + piped stdin content (already merged by the caller) */
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
  /** Progress reporting for the CLI spinner */
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
 * Core orchestrator kept free of terminal I/O so it is easy to test:
 * resolve mode → gather context → prompt the LLM → emit the MDX document.
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
      stage('Reading local changes…')
      ctx = await gatherChangesContext(deps.cwd, { extensions: exts, maxContextChars: maxChars })
      break
    case 'commit':
      stage(`Reading commit ${opts.input.ref}…`)
      ctx = await gatherCommitContext(deps.cwd, opts.input.ref, {
        extensions: exts,
        maxContextChars: maxChars,
      })
      break
    case 'file':
      stage('Reading files…')
      ctx = gatherFilesContext(opts.input.target, { extensions: exts, maxContextChars: maxChars })
      break
    case 'description':
      ctx = await gatherDescriptionContext(deps, rootDir, opts.input.text, exts, maxChars, stage)
      break
  }

  const system = buildSystemPrompt(depth, locale)
  const user = buildUserPrompt(ctx, { focus: opts.focus, extraContext: opts.extraContext })

  stage(`Analyzing with ${deps.provider.model}…`)
  const raw = await deps.provider.complete({ system, user })
  const sanitized = sanitizeBody(raw)

  if (!sanitized.trim()) {
    throw new Error('The LLM returned an empty answer.')
  }
  const { body } = await repairMdxBody(sanitized)

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
  stage('Mapping repository & finding relevant files…')
  const files = await selectRelevantFiles(rootDir, text, deps.provider, {
    extensions: exts,
    maxFiles: deps.cfg.maxRelevantFiles,
  })
  stage(`Reading ${files.length} relevant file(s)…`)
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
