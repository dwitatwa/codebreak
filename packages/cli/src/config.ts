import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CodebreakError } from './errors.js'
import { findGitRoot } from './git/repo.js'

export { CodebreakError }

export type Depth = 'overview' | 'block' | 'line'

export const DEPTHS: Depth[] = ['overview', 'block', 'line']

export interface ProviderConfig {
  /** Endpoint OpenAI-compatible, termasuk /v1 */
  baseUrl: string
  /** Nama env var yang berisi API key (boleh kosong utk server lokal) */
  apiKeyEnv: string
  model: string
}

export interface CodebreakConfig {
  provider: ProviderConfig
  outputLocale: string
  depth: Depth
  /** Budget total karakter konteks yang dikirim ke LLM */
  maxContextChars: number
  /** Maksimum jumlah file yang dipilih oleh pipeline relevance */
  maxRelevantFiles: number
}

const DEFAULTS: CodebreakConfig = {
  provider: {
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
  },
  outputLocale: 'en',
  depth: 'block',
  maxContextChars: 180_000,
  maxRelevantFiles: 10,
}

/** Path config tingkat user (~/.config/codebreak/config.json) */
export function userConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config')
  return path.join(xdg, 'codebreak', 'config.json')
}

/** Path config tingkat project (.codebreak/config.json di root repo); null di luar repo */
export function projectConfigPath(cwd = process.cwd()): string | null {
  const root = findGitRoot(cwd)
  return root ? path.join(root, '.codebreak', 'config.json') : null
}

function readConfigFile(file: string): Partial<CodebreakConfig> {
  let raw: string
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return {}
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CodebreakConfig>
    if (typeof parsed !== 'object' || parsed === null) throw new Error('bukan objek')
    return parsed
  } catch (err) {
    throw new CodebreakError(`Invalid config at ${file}: ${(err as Error).message}`)
  }
}

function mergeConfig(base: CodebreakConfig, override: Partial<CodebreakConfig>): CodebreakConfig {
  return {
    ...base,
    ...override,
    provider: { ...base.provider, ...(override.provider ?? {}) },
  }
}

export interface ConfigSources {
  user: { path: string; exists: boolean }
  project: { path: string | null; exists: boolean }
}

/**
 * Urutan prioritas:
 * defaults ← user global ← project (.codebreak/config.json) ← environment.
 * Env yang didukung: CODEBREAK_BASE_URL, CODEBREAK_MODEL, CODEBREAK_DEPTH.
 */
export function loadConfig(): CodebreakConfig {
  let cfg = DEFAULTS

  const userPath = userConfigPath()
  if (fs.existsSync(userPath)) {
    cfg = mergeConfig(cfg, readConfigFile(userPath))
  }

  const projectPath = projectConfigPath()
  if (projectPath && fs.existsSync(projectPath)) {
    cfg = mergeConfig(cfg, readConfigFile(projectPath))
  }

  if (process.env.CODEBREAK_BASE_URL) cfg.provider.baseUrl = process.env.CODEBREAK_BASE_URL
  if (process.env.CODEBREAK_MODEL) cfg.provider.model = process.env.CODEBREAK_MODEL

  const depthEnv = process.env.CODEBREAK_DEPTH as Depth | undefined
  if (depthEnv && DEPTHS.includes(depthEnv)) cfg.depth = depthEnv

  if (!DEPTHS.includes(cfg.depth)) {
    throw new CodebreakError(`invalid depth: "${cfg.depth}" (choices: ${DEPTHS.join(', ')})`)
  }
  return cfg
}

/** Info sumber config aktif (dipakai doctor) */
export function describeConfigSources(): ConfigSources {
  const user = userConfigPath()
  const project = projectConfigPath()
  return {
    user: { path: user, exists: fs.existsSync(user) },
    project: { path: project, exists: project !== null && fs.existsSync(project) },
  }
}

/** Path config user — dipakai pesan error factory & doctor */
export function describeConfigLocation(): string {
  return userConfigPath()
}

/** Resolve API key dari env; boleh undefined untuk server lokal tanpa auth */
export function resolveApiKey(cfg: CodebreakConfig): string | undefined {
  return process.env.CODEBREAK_API_KEY ?? process.env[cfg.provider.apiKeyEnv] ?? undefined
}
