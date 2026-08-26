export interface CompletionRequest {
  system: string
  user: string
  temperature?: number
}

/**
 * LLM provider abstraction. v1 implementation: OpenAICompatProvider.
 * Adding another provider (e.g. native Anthropic) = a new class implementing
 * this interface, without touching the pipeline.
 */
export interface LlmProvider {
  readonly name: string
  readonly model: string
  complete(req: CompletionRequest): Promise<string>
}
