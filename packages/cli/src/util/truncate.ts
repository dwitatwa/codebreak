export interface TruncatedText {
  text: string
  truncated: boolean
  originalChars: number
}

/**
 * Potong teks dari tengah, sisakan kepala + ekor, dengan penanda jelas
 * agar LLM tahu ada bagian yang hilang.
 */
export function truncateMiddle(text: string, maxChars: number): TruncatedText {
  if (maxChars <= 0 || text.length <= maxChars) {
    return { text, truncated: false, originalChars: text.length }
  }
  const marker = `\n[... ${text.length - maxChars} characters truncated ...]\n`
  const keep = Math.max(0, maxChars - marker.length)
  const head = Math.floor(keep * 0.7)
  const tail = Math.max(0, keep - head)
  return {
    text: text.slice(0, head) + marker + (tail > 0 ? text.slice(-tail) : ''),
    truncated: true,
    originalChars: text.length,
  }
}

/** Estimasi kasar jumlah token dari panjang karakter (~4 char/token) */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4)
}
