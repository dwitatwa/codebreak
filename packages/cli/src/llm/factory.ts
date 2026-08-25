import { CodebreakError, describeConfigLocation, loadConfig, resolveApiKey } from '../config.js'
import { OpenAICompatProvider } from './client.js'
import type { LlmProvider } from './types.js'

export function createProvider(): LlmProvider {
  const cfg = loadConfig()
  const apiKey = resolveApiKey(cfg)
  if (!apiKey && isPublicEndpoint(cfg.provider.baseUrl)) {
    throw new CodebreakError(
      `API key belum di-set.\n` +
        `Set env ${cfg.provider.apiKeyEnv}, atau CODEBREAK_API_KEY,\n` +
        `atau ubah provider.apiKeyEnv di ${describeConfigLocation()}`,
    )
  }
  return new OpenAICompatProvider(cfg.provider, apiKey)
}

function isPublicEndpoint(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname
    return !(
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local')
    )
  } catch {
    return false
  }
}
