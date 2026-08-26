import { describe, expect, it } from 'bun:test'
import { binaryAssetName, isNewerVersion } from '../src/commands/upgrade.js'

describe('isNewerVersion', () => {
  it('newer patch', () => {
    expect(isNewerVersion('0.3.1', '0.3.0')).toBe(true)
  })
  it('newer minor beats older patch', () => {
    expect(isNewerVersion('0.4.0', '0.3.9')).toBe(true)
  })
  it('numeric compare (not string)', () => {
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(true)
  })
  it('same version → false', () => {
    expect(isNewerVersion('0.3.0', '0.3.0')).toBe(false)
  })
  it('older → false', () => {
    expect(isNewerVersion('0.2.9', '0.3.0')).toBe(false)
  })
  it('tolerates v prefix', () => {
    expect(isNewerVersion('v0.4.0', '0.3.0')).toBe(true)
  })
})

describe('binaryAssetName', () => {
  it('windows x64', () => {
    expect(binaryAssetName('win32', 'x64')).toBe('codebreak-windows-x64.exe')
  })
  it('linux x64 / arm64', () => {
    expect(binaryAssetName('linux', 'x64')).toBe('codebreak-linux-x64')
    expect(binaryAssetName('linux', 'arm64')).toBe('codebreak-linux-arm64')
  })
  it('unsupported platform → null', () => {
    expect(binaryAssetName('darwin', 'arm64')).toBeNull()
    expect(binaryAssetName('freebsd' as NodeJS.Platform, 'x64')).toBeNull()
  })
})
