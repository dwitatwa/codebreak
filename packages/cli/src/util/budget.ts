import { truncateMiddle } from './truncate.js'

/**
 * Budget karakter global untuk material konteks.
 * Setiap bagian konteks "mengambil" dari budget sisa; kalau habis,
 * bagian berikutnya dipotong agresif atau ditolak.
 */
export class CharBudget {
  private remainingChars: number

  constructor(readonly total: number) {
    this.remainingChars = total
  }

  get remaining(): number {
    return this.remainingChars
  }

  /** Ambil sepotong teks dalam batas budget sisa; null jika budget habis total */
  take(text: string): string | null {
    if (this.remainingChars <= 0) return null
    const allowed = Math.min(text.length, this.remainingChars)
    const { text: cut } = truncateMiddle(text, allowed)
    this.remainingChars -= Math.min(cut.length, this.remainingChars)
    return cut
  }
}
