import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import { describeConfigSources, loadConfig, resolveApiKey } from '../config.js'
import { currentBranch, getGit } from '../git/repo.js'
import { OpenAICompatProvider } from '../llm/client.js'
import { docsDirFor } from './view.js'

type Mark = 'ok' | 'fail' | 'warn'

function print(mark: Mark, label: string, detail?: string): void {
  const icon = mark === 'ok' ? pc.green('✓') : mark === 'warn' ? pc.yellow('~') : pc.red('✗')
  console.log(`${icon} ${label}${detail ? pc.dim(` — ${detail}`) : ''}`)
}

export async function runDoctor(): Promise<void> {
  const cwd = process.cwd()
  let hardFail = false

  // 1. Config (berlapis: user ← project)
  let cfg
  try {
    cfg = loadConfig()
    const sources = describeConfigSources()
    print('ok', 'Config user', `${sources.user.path}${sources.user.exists ? '' : ' (belum ada — pakai default)'}`)
    if (sources.project.path) {
      print(
        sources.project.exists ? 'ok' : 'warn',
        'Config project',
        `${sources.project.path}${sources.project.exists ? '' : ' (belum ada — jalankan codebreak init)'}`,
      )
    }
    console.log(
      pc.dim(
        `    efektif → baseUrl=${cfg.provider.baseUrl}  model=${cfg.provider.model}  apiKeyEnv=${cfg.provider.apiKeyEnv}  locale=${cfg.outputLocale}  depth=${cfg.depth}`,
      ),
    )
  } catch (err) {
    print('fail', 'Config', (err as Error).message)
    process.exit(1)
  }

  // 2. API key
  const apiKey = resolveApiKey(cfg)
  if (apiKey) {
    print('ok', `API key (${cfg.provider.apiKeyEnv})`, `${apiKey.length} karakter`)
  } else {
    const local =
      /localhost|127\.0\.0\.1|::1/.test(cfg.provider.baseUrl) || cfg.provider.baseUrl.includes('[::1]')
    if (local) {
      print('warn', 'API key tidak di-set', 'wajar untuk server lokal tanpa auth')
    } else {
      print('fail', `API key tidak di-set`, `export ${cfg.provider.apiKeyEnv}=...`)
      hardFail = true
    }
  }

  // 3. Konektivitas provider
  try {
    const provider = new OpenAICompatProvider(cfg.provider, apiKey)
    const spinDetail = await provider.ping()
    print('ok', `Provider ${provider.name}`, spinDetail)
    if (spinDetail.includes('tidak ada di daftar')) {
      print('warn', 'Model mungkin salah nama', `cek daftar model di server, sekarang: ${cfg.provider.model}`)
    }
  } catch (err) {
    print('fail', 'Provider', (err as Error).message)
    hardFail = true
  }

  // 4. Git repo
  try {
    const git = await getGit(cwd)
    print('ok', 'Git repository', `branch ${await currentBranch(git)}`)
  } catch (err) {
    print('warn', 'Git repository', (err as Error).message.split('\n')[0])
  }

  // 5. Docs dir
  const docsDir = docsDirFor(cwd)
  let count = 0
  try {
    count = fs.readdirSync(docsDir).filter((f) => f.endsWith('.mdx')).length
    print('ok', 'Direktori dokumen', `${docsDir} (${count} dokumen)`)
  } catch {
    print('warn', 'Direktori dokumen belum ada', docsDir)
  }

  // 6. Viewer
  try {
    const pkgUrl = import.meta.resolve('@codebreak/viewer/package.json')
    const viewerRoot = path.dirname(fs.realpathSync(new URL(pkgUrl).pathname))
    const hasVite = fs.existsSync(path.join(viewerRoot, 'node_modules', '.bin', 'vite'))
    if (hasVite) {
      print('ok', 'Viewer terinstall')
    } else {
      print('warn', 'Viewer belum punya node_modules', 'jalankan pnpm install di root proyek codebreak')
    }
  } catch {
    print('warn', 'Package viewer tidak ditemukan', 'jalankan pnpm install di root proyek codebreak')
  }

  console.log()
  if (hardFail) {
    console.log(pc.red('Ada masalah yang harus dibereskan sebelum `codebreak explain` bisa dipakai.'))
    process.exit(1)
  }
  console.log(pc.green('Semua komponen siap dipakai.'))
}
