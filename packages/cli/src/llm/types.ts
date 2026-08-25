export interface CompletionRequest {
  system: string
  user: string
  temperature?: number
}

/**
 * Abstraksi provider LLM. Implementasi v1: OpenAICompatProvider.
 * Menambah provider lain (mis. Anthropic native) = class baru yang
 * mengimplementasikan interface ini, tanpa menyentuh pipeline.
 */
export interface LlmProvider {
  readonly name: string
  readonly model: string
  complete(req: CompletionRequest): Promise<string>
}
