import { describe, expect, it } from 'vitest'
import { parseCommitRef } from '../src/git/repo.js'

describe('parseCommitRef', () => {
  it('single ref', () => {
    const spec = parseCommitRef('abc1234')
    expect(spec.kind).toBe('single')
    expect(spec.ref).toBe('abc1234')
    expect(spec.label).toBe('abc1234')
  })

  it('range A..B', () => {
    const spec = parseCommitRef('HEAD~3..HEAD')
    expect(spec.kind).toBe('range')
    expect(spec.from).toBe('HEAD~3')
    expect(spec.to).toBe('HEAD')
  })

  it('range A...B juga diterima', () => {
    const spec = parseCommitRef('main...feature/x')
    expect(spec.kind).toBe('range')
    expect(spec.from).toBe('main')
    expect(spec.to).toBe('feature/x')
  })
})
