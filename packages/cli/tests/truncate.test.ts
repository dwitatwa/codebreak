import { describe, expect, it } from 'bun:test'
import { CharBudget } from '../src/util/budget.js'
import { truncateMiddle } from '../src/util/truncate.js'
import { extractJson } from '../src/llm/relevance.js'

describe('truncateMiddle', () => {
  it('tidak memotong teks pendek', () => {
    const r = truncateMiddle('abc', 10)
    expect(r.text).toBe('abc')
    expect(r.truncated).toBe(false)
  })

  it('memotong tengah dengan penanda', () => {
    const text = 'x'.repeat(1000)
    const r = truncateMiddle(text, 200)
    expect(r.truncated).toBe(true)
    expect(r.text.length).toBeLessThanOrEqual(220)
    expect(r.text).toContain('truncated')
  })

  it('maxChars sangat kecil tetap aman', () => {
    const r = truncateMiddle('hello world', 5)
    expect(r.truncated).toBe(true)
    expect(r.text).toContain('truncated')
    // isi praktis habis, yang tersisa hanya penanda
    expect(r.text.length).toBeLessThanOrEqual(40)
  })
})

describe('CharBudget', () => {
  it('mengalokasikan berurutan sampai habis', () => {
    const b = new CharBudget(100)
    expect(b.take('a'.repeat(60))!.length).toBe(60)
    const second = b.take('b'.repeat(50))
    expect(second!.length).toBeLessThanOrEqual(40)
    // budget persis habis
    expect(b.remaining).toBe(0)
    expect(b.take('c')).toBeNull()
  })
})

describe('extractJson', () => {
  it('json polos', () => {
    expect(extractJson('{"files":["a.ts"]}')).toEqual({ files: ['a.ts'] })
  })

  it('json dalam code fence', () => {
    expect(extractJson('```json\n{"files":["b.ts"]}\n```')).toEqual({ files: ['b.ts'] })
  })

  it('json dibungkus basa-basi', () => {
    expect(extractJson('Sure! Here you go:\n{"files":["c.ts"]} hope that helps')).toEqual({
      files: ['c.ts'],
    })
  })

  it('bukan json → null', () => {
    expect(extractJson('no json here')).toBeNull()
  })
})
