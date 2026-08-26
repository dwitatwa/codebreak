import OpenAI from 'openai'
import type { ProviderConfig } from '../config.js'
import type { CompletionRequest, LlmProvider } from './types.js'

/**
 * Provider for any OpenAI-compatible endpoint:
 * OpenAI, Ollama (/v1), LM Studio, Groq, OpenRouter, Together, vLLM, etc.
 * The API key may be empty for local servers that don't require auth.
 */
export class OpenAICompatProvider implements LlmProvider {
  readonly name = 'openai-compat'
  private client: OpenAI

  constructor(
    private cfg: ProviderConfig,
    apiKey?: string,
  ) {
    this.client = new OpenAI({
      baseURL: cfg.baseUrl,
      apiKey: apiKey ?? 'not-needed',
      maxRetries: 2,
    })
  }

  get model(): string {
    return this.cfg.model
  }

  async complete(req: CompletionRequest): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.cfg.model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      temperature: req.temperature ?? 0.2,
    })
    return res.choices[0]?.message?.content ?? ''
  }

  async ping(): Promise<string> {
    // Not every compatible server implements /models;
    // if that fails, we fall back to a minimal chat request.
    try {
      const page = await this.client.models.list()
      const ids = []
      for await (const m of page) {
        ids.push(m.id)
        if (ids.length >= 50) break
      }
      if (this.cfg.model && !ids.includes(this.cfg.model) && ids.length > 0) {
        return `connected, but model "${this.cfg.model}" is not in the server list (${ids.length} models available)`
      }
      return `connected (${ids.length} models available)`
    } catch {
      await this.complete({
        system: 'You are a health check endpoint. Reply with exactly: ok',
        user: 'ping',
        temperature: 0,
      })
      return 'connected (/models endpoint unavailable, chat OK)'
    }
  }
}
