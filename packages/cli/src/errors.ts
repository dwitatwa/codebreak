export class CodebreakError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CodebreakError'
  }
}
