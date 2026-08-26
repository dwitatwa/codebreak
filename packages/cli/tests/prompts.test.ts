import { describe, expect, it } from 'bun:test'
import { buildSystemPrompt, buildUserPrompt, localeName, tldrHeading } from '../src/llm/prompts.js'
import type { GatheredContext } from '../src/inputs/context.js'

const CTX: GatheredContext = {
  kind: 'changes',
  title: 'Local Changes',
  sourceLabel: 'local changes',
  material: '## Diff\n\n```diff\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new\n```',
}

describe('buildSystemPrompt', () => {
  it('includes depth instructions', () => {
    expect(buildSystemPrompt('line', 'id')).toContain('DETAIL LEVEL: line')
    expect(buildSystemPrompt('overview', 'id')).toContain('DETAIL LEVEL: overview')
    expect(buildSystemPrompt('block', 'id')).toContain('DETAIL LEVEL: block')
  })

  it('requests language matching the locale', () => {
    expect(buildSystemPrompt('block', 'id')).toContain('Bahasa Indonesia')
    expect(buildSystemPrompt('block', 'en')).toContain('English')
  })

  it('includes MDX safety rules and a localized TL;DR heading', () => {
    const sys = buildSystemPrompt('block', 'id')
    expect(sys).toContain('## Ringkasan')
    expect(sys).toContain('<details')
    expect(sys).toContain('Never write a bare "<"')
  })

  it('includes viewer component structure (Block/CodeBlock/LineNotes/Note)', () => {
    const sys = buildSystemPrompt('block', 'en')
    expect(sys).toContain('<Block name=')
    expect(sys).toContain('<CodeBlock lang=')
    expect(sys).toContain('<LineNotes>')
    expect(sys).toContain('<Note line=')
  })

  it('requires code first + implications on notes', () => {
    const sys = buildSystemPrompt('block', 'en')
    expect(sys).toContain('Code must come FIRST')
    expect(sys).toContain('MUST include at least one such implication')
  })

  it('forbids legacy HTML elements (details/b)', () => {
    const sys = buildSystemPrompt('block', 'en')
    expect(sys).toContain('Do NOT write <details>, <summary>, <b>')
    expect(sys).not.toContain('No import/export statements, no JSX components')
  })

  it('tldrHeading en → Summary', () => {
    expect(tldrHeading('en')).toBe('Summary')
  })
})

describe('localeName', () => {
  it('knows common codes & fallback', () => {
    expect(localeName('id')).toBe('Bahasa Indonesia')
    expect(localeName('xx')).toBe('Bahasa Indonesia')
  })
})

describe('buildUserPrompt', () => {
  it('wraps material, focus, and context', () => {
    const user = buildUserPrompt(CTX, {
      focus: 'error handling',
      extraContext: 'we use Postgres',
    })
    expect(user).toContain('<task>')
    expect(user).toContain('<focus>\nPay special attention to this request from the user:\nerror handling')
    expect(user).toContain('<extra-context>')
    expect(user).toContain('<material>')
    expect(user).toContain('+new')
  })

  it('without focus/context the sections are absent', () => {
    const user = buildUserPrompt(CTX)
    expect(user).not.toContain('<focus>')
    expect(user).not.toContain('<extra-context>')
  })

  it('mentions when material is truncated', () => {
    const user = buildUserPrompt({ ...CTX, truncated: true })
    expect(user).toContain('truncated')
  })
})
