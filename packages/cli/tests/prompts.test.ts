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
  it('memuat instruksi depth', () => {
    expect(buildSystemPrompt('line', 'id')).toContain('DETAIL LEVEL: line')
    expect(buildSystemPrompt('overview', 'id')).toContain('DETAIL LEVEL: overview')
    expect(buildSystemPrompt('block', 'id')).toContain('DETAIL LEVEL: block')
  })

  it('meminta bahasa sesuai locale', () => {
    expect(buildSystemPrompt('block', 'id')).toContain('Bahasa Indonesia')
    expect(buildSystemPrompt('block', 'en')).toContain('English')
  })

  it('memuat aturan keamanan MDX dan heading TL;DR lokal', () => {
    const sys = buildSystemPrompt('block', 'id')
    expect(sys).toContain('## Ringkasan')
    expect(sys).toContain('<details')
    expect(sys).toContain('Never write a bare "<"')
  })

  it('tldrHeading en → Summary', () => {
    expect(tldrHeading('en')).toBe('Summary')
  })
})

describe('localeName', () => {
  it('kenal kode umum & fallback', () => {
    expect(localeName('id')).toBe('Bahasa Indonesia')
    expect(localeName('xx')).toBe('Bahasa Indonesia')
  })
})

describe('buildUserPrompt', () => {
  it('membungkus material, focus, dan context', () => {
    const user = buildUserPrompt(CTX, {
      focus: 'error handling',
      extraContext: 'kami pakai Postgres',
    })
    expect(user).toContain('<task>')
    expect(user).toContain('<focus>\nPay special attention to this request from the user:\nerror handling')
    expect(user).toContain('<extra-context>')
    expect(user).toContain('<material>')
    expect(user).toContain('+new')
  })

  it('tanpa focus/context seksi tidak muncul', () => {
    const user = buildUserPrompt(CTX)
    expect(user).not.toContain('<focus>')
    expect(user).not.toContain('<extra-context>')
  })

  it('memberi tahu bila material terpotong', () => {
    const user = buildUserPrompt({ ...CTX, truncated: true })
    expect(user).toContain('truncated')
  })
})
