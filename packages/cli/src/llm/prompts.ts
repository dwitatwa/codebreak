import type { Depth } from '../config.js'
import type { GatheredContext } from '../inputs/context.js'

const LOCALE_NAMES: Record<string, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
}

export function localeName(code: string): string {
  return LOCALE_NAMES[code] ?? 'Bahasa Indonesia'
}

/** Section heading for the TL;DR, localized */
export function tldrHeading(locale: string): string {
  return locale === 'id' ? 'Ringkasan' : 'Summary'
}

/** Summary label for collapsible blocks, localized (e.g. "Block: fn · lines 12-40") */
export function blockLabel(locale: string): string {
  return locale === 'id' ? 'Blok: {name} · baris {range}' : 'Block: {name} · lines {range}'
}

function depthInstruction(depth: Depth): string {
  switch (depth) {
    case 'overview':
      return [
        'DETAIL LEVEL: overview.',
        '- Explain the big picture only: purpose, architecture, main components, and how they interact.',
        '- Do NOT go into individual functions or lines.',
        '- At most one short paragraph per file section.',
      ].join('\n')
    case 'line':
      return [
        'DETAIL LEVEL: line.',
        '- First cover block-level understanding, then call out SPECIFIC important lines.',
        '- Reference lines explicitly as `L12`, `L40-45` in the prose where behavior is subtle, risky, or load-bearing.',
      ].join('\n')
    case 'block':
    default:
      return [
        'DETAIL LEVEL: block.',
        '- Explain each meaningful block (function, class, hook, handler, route, config section) as its own unit.',
        '- When the material shows line context, include ranges in the summary label, e.g. lines 12-40.',
      ].join('\n')
  }
}

/**
 * Strict output contract so the result is always a valid MDX document:
 * plain markdown + native HTML elements (<details>/<summary>) only.
 *
 * Every explained block follows the WHAT / WHY / DETAILS structure:
 *   WHAT    — what the code does (facts, no judgement)
 *   WHY     — why it is implemented this way (intent, design reasoning)
 *   DETAILS — consequences, edge cases, assumptions, implications (the gold).
 *
 * DETAILS must contain at least one implication line, because that is the
 * anti-"this code looks fine" mechanism — it forces the model to surface
 * what the developer should actually think about.
 */
export function buildSystemPrompt(depth: Depth, locale: string): string {
  const lang = localeName(locale)
  const summary = tldrHeading(locale)
  return [
    'You are a senior software engineer writing an explanatory document about code for another developer.',
    'The developer will review or maintain this code, so your job is to make them UNDERSTAND it —',
    'not to tell them it is good.',
    '',
    depthInstruction(depth),
    '',
    `LANGUAGE: Write ALL human-readable text (headings, prose, summary labels) in ${lang}.`,
    'Keep identifiers, code, and file paths as-is.',
    '',
    'OUTPUT CONTRACT (strict):',
    `1. Reply with ONLY the document body. No YAML frontmatter, no top-level "# " title, no preamble.`,
    `2. Start with "## ${summary}" containing a TL;DR of at most 6 bullet points.`,
    '3. After that, create one "### path/to/file.ext" section per file discussed.',
    '4. Inside a file section, wrap each explained unit in the viewer components:',
    '   <Block name="functionName" lines="12-40">',
    '     <CodeBlock lang="ts">',
    '',
    '       ```ts',
    '       (the COMPLETE, CONTIGUOUS slice of the file covering lines 12-40,',
    '        copied VERBATIM — every line, no elision, no "...", no diff markers)',
    '       ```',
    '',
    '     </CodeBlock>',
    '     <LineNotes>',
    '       <Note line="12">one short fact about this line: what it does.</Note>',
    '       <Note line="14">why it is implemented this way.</Note>',
    '       <Note line="15">a consequence/edge case the developer should think about —',
    '         MUST include at least one such implication somewhere in the notes.',
    '         e.g. "the number of concurrent requests is proportional to the number of users".</Note>',
    '     </LineNotes>',
    '   </Block>',
    '5. Code must come FIRST, inside <CodeBlock>, written as a FENCED code block',
    '   (```lang ... ```) — this is required so MDX does not mis-parse the code.',
    '   The code block MUST be the complete, contiguous slice of the file',
    "   covering the block's `lines` range — verbatim, no elision, no \"...\",",
    '   no diff markers, no skipping. If the block says lines="28-41", the code',
    '   block must contain file lines 28-41 exactly as they appear in the file.',
    '   This guarantees every referenced line is present and correctly numbered.',
    '   The notes below it annotate specific lines by number.',
    '6. Annotate only the LOAD-BEARING lines (control flow, side effects, edge cases,',
    '   subtle logic). Skip boilerplate. Do NOT write long paragraphs — one short note per line.',
    '7. MDX SAFETY RULES (violations break rendering):',
    '   - Never write a bare "<" character outside the component tags; say "less than" or wrap expressions in backticks.',
    '   - Never begin a line with "{" outside code fences.',
    '   - Do NOT write <details>, <summary>, <b> — the viewer components <Block>, <CodeBlock>,',
    '     <LineNotes>, <Note> are the ONLY allowed structural elements.',
    '8. Optionally end with one extra "## ..." section highlighting risks, gotchas, or follow-up suggestions.',
  ].join('\n')
}

export interface UserPromptOptions {
  focus?: string
  extraContext?: string
}

export function buildUserPrompt(ctx: GatheredContext, opts: UserPromptOptions = {}): string {
  const parts: string[] = []

  parts.push(`<task>\nExplain the following (${ctx.kind}): ${ctx.sourceLabel}\n</task>`)

  if (opts.focus?.trim()) {
    parts.push(
      `<focus>\nPay special attention to this request from the user:\n${opts.focus.trim()}\n</focus>`,
    )
  }

  if (opts.extraContext?.trim()) {
    parts.push(
      `<extra-context>\nAdditional context provided by the user:\n${opts.extraContext.trim()}\n</extra-context>`,
    )
  }

  parts.push(`<material>\n${ctx.material}\n</material>`)

  if (ctx.truncated) {
    parts.push('<note>The material above was truncated to fit size limits; explain what is present.</note>')
  }

  return parts.join('\n\n')
}
