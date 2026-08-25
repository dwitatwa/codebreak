import { CodebreakError, describeConfigLocation, loadConfig, resolveApiKey } from '../config.js'
import { OpenAICompatProvider } from './client.js'
import type { LlmProvider } from './types.js'

export function createProvider(): LlmProvider {
  const cfg = loadConfig()
  const apiKey = resolveApiKey(cfg)
  if (!apiKey && isPublicEndpoint(cfg.provider.baseUrl)) {
    throw new CodebreakError(
      `API key is not set.\n` +
        `Set the ${cfg.provider.apiKeyEnv} env var, or CODEBREAK_API_KEY,\n` +
        `or change provider.apiKeyEnv in ${describeConfigLocation()}`,
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
