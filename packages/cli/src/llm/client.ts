import OpenAI from 'openai'
import type { ProviderConfig } from '../config.js'
import type { CompletionRequest, LlmProvider } from './types.js'

/**
 * Provider untuk endpoint OpenAI-compatible apa pun:
 * OpenAI, Ollama (/v1), LM Studio, Groq, OpenRouter, Together, vLLM, dst.
 * API key boleh kosong untuk server lokal yang tidak memerlukan auth.
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
    // Tidak semua server kompatibel mengimplementasikan /models;
    // kalau gagal kita coba request chat minimal sebagai fallback.
    try {
      const page = await this.client.models.list()
      const ids = []
      for await (const m of page) {
        ids.push(m.id)
        if (ids.length >= 50) break
      }
      if (this.cfg.model && !ids.includes(this.cfg.model) && ids.length > 0) {
        return `terhubung, tapi model "${this.cfg.model}" tidak ada di daftar server (${ids.length} model tersedia)`
      }
      return `terhubung (${ids.length} model tersedia)`
    } catch {
      await this.complete({
        system: 'You are a health check endpoint. Reply with exactly: ok',
        user: 'ping',
        temperature: 0,
      })
      return 'terhubung (endpoint /models tidak tersedia, chat OK)'
    }
  }
}
