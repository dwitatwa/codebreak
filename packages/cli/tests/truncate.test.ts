import { describe, expect, it } from 'bun:test'
import { CharBudget } from '../src/util/budget.js'
import { truncateMiddle } from '../src/util/truncate.js'
import { extractJson } from '../src/llm/relevance.js'

describe('truncateMiddle', () => {
  it('does not truncate short text', () => {
    const r = truncateMiddle('abc', 10)
    expect(r.text).toBe('abc')
    expect(r.truncated).toBe(false)
  })

  it('truncates the middle with a marker', () => {
    const text = 'x'.repeat(1000)
    const r = truncateMiddle(text, 200)
    expect(r.truncated).toBe(true)
    expect(r.text.length).toBeLessThanOrEqual(220)
    expect(r.text).toContain('truncated')
  })

  it('very small maxChars stays safe', () => {
    const r = truncateMiddle('hello world', 5)
    expect(r.truncated).toBe(true)
    expect(r.text).toContain('truncated')
    // the content is practically gone; only the marker remains
    expect(r.text.length).toBeLessThanOrEqual(40)
  })
})

describe('CharBudget', () => {
  it('allocates sequentially until exhausted', () => {
    const b = new CharBudget(100)
    expect(b.take('a'.repeat(60))!.length).toBe(60)
    const second = b.take('b'.repeat(50))
    expect(second!.length).toBeLessThanOrEqual(40)
    // budget is exactly used up
    expect(b.remaining).toBe(0)
    expect(b.take('c')).toBeNull()
  })
})

describe('extractJson', () => {
  it('plain json', () => {
    expect(extractJson('{"files":["a.ts"]}')).toEqual({ files: ['a.ts'] })
  })

  it('json inside a code fence', () => {
    expect(extractJson('```json\n{"files":["b.ts"]}\n```')).toEqual({ files: ['b.ts'] })
  })

  it('json wrapped in pleasantries', () => {
    expect(extractJson('Sure! Here you go:\n{"files":["c.ts"]} hope that helps')).toEqual({
      files: ['c.ts'],
    })
  })

  it('not json → null', () => {
    expect(extractJson('no json here')).toBeNull()
  })
})
