import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { CodebreakConfig } from '../src/config.js'
import { explain } from '../src/core/explain.js'
import type { CompletionRequest, LlmProvider } from '../src/llm/types.js'

const CANNED_DOC = [
  '## Summary',
  '',
  '- Login validates credentials',
  '',
  '### src/auth/login.ts',
  '',
  '<Block name="login" lines="1-3">',
  '  <CodeBlock lang="ts">',
  '    export function login(u: string) {',
  '      return u === "admin" ? "ok" : "deny"',
  '    }',
  '  </CodeBlock>',
  '  <LineNotes>',
  '    <Note line="1">Defines the login function.</Note>',
  '    <Note line="2">Only "admin" succeeds — the check is hardcoded.</Note>',
  '  </LineNotes>',
  '</Block>',
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
    outputLocale: 'en',
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

describe('explain end-to-end (scripted provider)', () => {
  it('description mode: LLM picks relevant files then explains', async () => {
    const calls: string[] = []
    const provider = new ScriptedProvider((req) => {
      calls.push(req.system)
      if (req.system.includes('code-search assistant')) {
        expect(req.user).toContain('user authentication flow')
        return '{"files": ["./src/auth/login.ts"], "reason": "contains auth"}'
      }
      return CANNED_DOC
    })

    const result = await explain(
      { provider, cwd: dir, cfg: makeCfg() },
      { input: { kind: 'description', text: 'user authentication flow' } },
    )

    // "./x" paths are normalized
    expect(result.selectedFiles).toEqual(['src/auth/login.ts'])
    expect(calls.length).toBe(2)
    expect(fs.existsSync(result.docAbsPath)).toBe(true)
    const doc = fs.readFileSync(result.docAbsPath, 'utf8')
    expect(doc).toContain('type: description')
    expect(doc).toContain('<Block name="login"')
    expect(result.tldr).toContain('Login validates')
    expect(result.tldrHeadingText).toBe('Summary')
  })

  it('file mode: file content goes into the material & doc gets type file', async () => {
    const provider = new ScriptedProvider(() => '## Summary\n- ok')
    const result = await explain(
      { provider, cwd: dir, cfg: makeCfg() },
      { input: { kind: 'file', target: path.join(dir, 'src/auth/login.ts') } },
    )
    expect(result.title).toBe('login.ts')
    const doc = fs.readFileSync(result.docAbsPath, 'utf8')
    expect(doc).toContain('type: file')
  })

  it('--lang filters file selection', async () => {
    const provider = new ScriptedProvider((req) => {
      if (req.system.includes('code-search assistant')) {
        expect(req.user).not.toContain('.mdx')
        return '{"files": ["README.md"]}'
      }
      return CANNED_DOC
    })
    await expect(
      explain({ provider, cwd: dir, cfg: makeCfg() }, {
        input: { kind: 'description', text: 'documentation' },
        lang: ['ts'],
      }),
    ).rejects.toThrow(/none matched this repository/)
  })

  it('focus & context are included in the final prompt', async () => {
    let finalUser = ''
    const provider = new ScriptedProvider((req) => {
      if (!req.system.includes('code-search assistant')) finalUser = req.user
      return '## Summary\n- ok'
    })
    await explain({ provider, cwd: dir, cfg: makeCfg() }, {
      input: { kind: 'file', target: path.join(dir, 'src/auth/login.ts') },
      focus: 'error handling',
      extraContext: 'we use Postgres',
    })
    expect(finalUser).toContain('error handling')
    expect(finalUser).toContain('we use Postgres')
  })
})
