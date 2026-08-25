import type { Depth } from '../config.js'
import type { GatheredContext } from '../inputs/context.js'

const LOCALE_NAMES: Record<string, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
}

export function localeName(code: string): string {
  return LOCALE_NAMES[code] ?? 'Bahasa Indonesia'
}

/** Judul seksi TL;DR sesuai locale (fallback Inggris) */
export function tldrHeading(locale: string): string {
  return locale === 'id' ? 'Ringkasan' : 'Summary'
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

/** Summary label for collapsible blocks, localized (e.g. "Block: fn · lines 12-40") */
export function blockLabel(locale: string): string {
  return locale === 'id' ? 'Blok: {name} · baris {range}' : 'Block: {name} · lines {range}'
}

/**
 * Kontrak output ketat supaya hasil selalu dokumen MDX yang valid:
 * markdown murni + elemen HTML native (<details>/<summary>) saja.
 */
export function buildSystemPrompt(depth: Depth, locale: string): string {
  const lang = localeName(locale)
  const summary = tldrHeading(locale)
  const block = blockLabel(locale)
  return [
    'You are a senior software engineer writing an explanatory document about code for another developer.',
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
    '4. Inside a file section, wrap each explained unit in a native HTML collapsible:',
    '   <details open>',
    `   <summary>${block.replace('{name}', 'functionName').replace('{range}', '12-40')}</summary>`,
    '   explanation paragraphs...',
    '   ```lang',
    '   short exact code excerpt',
    '   ```',
    '   </details>',
    '5. Code excerpts must be fenced with the correct language tag and stay under ~30 lines.',
    '6. MDX SAFETY RULES (violations break rendering):',
    '   - Never write a bare "<" character outside code fences; say "less than" or wrap expressions in backticks.',
    '   - Never begin a line with "{" outside code fences.',
    '   - No import/export statements, no JSX components. Only plain HTML elements such as <details>, <summary>, <b>, <em>, <code> are allowed.',
    '7. Optionally end with one extra "## ..." section highlighting risks, gotchas, or follow-up suggestions.',
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
