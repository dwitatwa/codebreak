import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CodebreakConfig } from '../src/config.js'
import { explain } from '../src/core/explain.js'
import type { CompletionRequest, LlmProvider } from '../src/llm/types.js'

const CANNED_DOC = [
  '## Ringkasan',
  '',
  '- Login memvalidasi kredensial pengguna',
  '',
  '### File: src/auth/login.ts',
  '',
  '<details open>',
  '<summary>Blok: login() · baris 1-3</summary>',
  'Fungsi `login` mengembalikan token palsu.',
  '',
  '```ts',
  'export function login(u: string) {',
  '  return u === "admin" ? "ok" : "deny"',
  '}',
  '```',
  '</details>',
].join('\n')

class ScriptedProvider implements LlmProvider {
  readonly name = 'scripted'
  readonly model = 'test-model'

  constructor(private fn: (req: CompletionRequest) => string) {}

  complete(req: CompletionRequest): Promise<string> {
    return Promise.resolve(this.fn(req))
  }
}

function makeCfg(): CodebreakConfig {
  return {
    provider: { baseUrl: 'http://127.0.0.1:9/v1', apiKeyEnv: 'CODEBREAK_NOPE', model: 'test-model' },
    outputLocale: 'id',
    depth: 'block',
    maxContextChars: 50_000,
    maxRelevantFiles: 5,
  }
}

let dir: string

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebreak-e2e-'))
  fs.mkdirSync(path.join(dir, 'src/auth'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'src/pay'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'src/auth/login.ts'), 'export function login(u: string) {\n  return u === "admin" ? "ok" : "deny"\n}\n')
  fs.writeFileSync(path.join(dir, 'src/pay/payment.ts'), 'export const charge = 1\n')
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n')
})

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('explain end-to-end (provider tiruan)', () => {
  it('mode description: LLM pilih file relevan lalu jelaskan', async () => {
    const calls: string[] = []
    const provider = new ScriptedProvider((req) => {
      calls.push(req.system)
      if (req.system.includes('code-search assistant')) {
        expect(req.user).toContain('user authentication flow')
        return '{"files": ["./src/auth/login.ts"], "reason": "berisi auth"}'
      }
      return CANNED_DOC
    })

    const result = await explain(
      { provider, cwd: dir, cfg: makeCfg() },
      { input: { kind: 'description', text: 'user authentication flow' } },
    )

    // path "./x" dinormalisasi
    expect(result.selectedFiles).toEqual(['src/auth/login.ts'])
    expect(calls.length).toBe(2)
    expect(fs.existsSync(result.docAbsPath)).toBe(true)
    const doc = fs.readFileSync(result.docAbsPath, 'utf8')
    expect(doc).toContain('type: description')
    expect(doc).toContain('<summary>Blok: login()')
    expect(result.tldr).toContain('Login memvalidasi')
    expect(result.tldrHeadingText).toBe('Ringkasan')
  })

  it('mode file: isi file masuk material & dokumen bertipe file', async () => {
    const provider = new ScriptedProvider(() => '## Ringkasan\n- ok')
    const result = await explain(
      { provider, cwd: dir, cfg: makeCfg() },
      { input: { kind: 'file', target: path.join(dir, 'src/auth/login.ts') } },
    )
    expect(result.title).toBe('login.ts')
    const doc = fs.readFileSync(result.docAbsPath, 'utf8')
    expect(doc).toContain('type: file')
  })

  it('--lang memfilter pemilihan file', async () => {
    const provider = new ScriptedProvider((req) => {
      if (req.system.includes('code-search assistant')) {
        expect(req.user).not.toContain('.mdx')
        return '{"files": ["README.md"]}'
      }
      return CANNED_DOC
    })
    await expect(
      explain({ provider, cwd: dir, cfg: makeCfg() }, {
        input: { kind: 'description', text: 'dokumentasi' },
        lang: ['ts'],
      }),
    ).rejects.toThrow(/tidak ada yang cocok/)
  })

  it('focus & context ikut ke prompt akhir', async () => {
    let finalUser = ''
    const provider = new ScriptedProvider((req) => {
      if (!req.system.includes('code-search assistant')) finalUser = req.user
      return '## Ringkasan\n- ok'
    })
    await explain({ provider, cwd: dir, cfg: makeCfg() }, {
      input: { kind: 'file', target: path.join(dir, 'src/auth/login.ts') },
      focus: 'error handling',
      extraContext: 'kami pakai Postgres',
    })
    expect(finalUser).toContain('error handling')
    expect(finalUser).toContain('kami pakai Postgres')
  })
})
