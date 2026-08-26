import { truncateMiddle } from './truncate.js'

/**
 * Global character budget for context material.
 * Each context section "draws" from the remaining budget; once it runs out,
 * subsequent sections are aggressively truncated or rejected.
 */
export class CharBudget {
  private remainingChars: number

  constructor(readonly total: number) {
    this.remainingChars = total
  }

  get remaining(): number {
    return this.remainingChars
  }

  /** Take a piece of text within the remaining budget; null if the budget is fully exhausted */
  take(text: string): string | null {
    if (this.remainingChars <= 0) return null
    const allowed = Math.min(text.length, this.remainingChars)
    const { text: cut } = truncateMiddle(text, allowed)
    this.remainingChars -= Math.min(cut.length, this.remainingChars)
    return cut
  }
}
