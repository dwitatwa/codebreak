import fs from 'node:fs'
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

  // 1. Config (layered: user ← project)
  let cfg
  try {
    cfg = loadConfig()
    const sources = describeConfigSources()
    print('ok', 'User config', `${sources.user.path}${sources.user.exists ? '' : ' (not found — using defaults)'}`)
    if (sources.project.path) {
      print(
        sources.project.exists ? 'ok' : 'warn',
        'Project config',
        `${sources.project.path}${sources.project.exists ? '' : ' (not found — run codebreak init)'}`,
      )
    }
    console.log(
      pc.dim(
        `    effective → baseUrl=${cfg.provider.baseUrl}  model=${cfg.provider.model}  apiKeyEnv=${cfg.provider.apiKeyEnv}  locale=${cfg.outputLocale}  depth=${cfg.depth}`,
      ),
    )
  } catch (err) {
    print('fail', 'Config', (err as Error).message)
    process.exit(1)
  }

  // 2. API key
  const apiKey = resolveApiKey(cfg)
  if (apiKey) {
    print('ok', `API key (${cfg.provider.apiKeyEnv})`, `${apiKey.length} characters`)
  } else {
    const local =
      /localhost|127\.0\.0\.1|::1/.test(cfg.provider.baseUrl) || cfg.provider.baseUrl.includes('[::1]')
    if (local) {
      print('warn', 'API key not set', 'expected for local servers without auth')
    } else {
      print('fail', `API key not set`, `export ${cfg.provider.apiKeyEnv}=...`)
      hardFail = true
    }
  }

  // 3. Provider connectivity
  try {
    const provider = new OpenAICompatProvider(cfg.provider, apiKey)
    const pingDetail = await provider.ping()
    print('ok', `Provider ${provider.name}`, pingDetail)
    if (pingDetail.includes('not in the server')) {
      print('warn', 'Model name may be wrong', `check the model list on the server, currently: ${cfg.provider.model}`)
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
    print('ok', 'Docs directory', `${docsDir} (${count} document(s))`)
  } catch {
    print('warn', 'Docs directory does not exist yet', docsDir)
  }

  // 6. Frontend shell (static assets from build)
  try {
    const { ASSETS } = await import('../viewer/assets.generated.js')
    if (Object.keys(ASSETS).length > 0) {
      print('ok', 'Frontend shell bundled', `${Object.keys(ASSETS).length} assets`)
    } else {
      print('warn', 'Frontend shell not built yet', 'run `bun run build:viewer`')
    }
  } catch {
    print('warn', 'Frontend shell not built yet', 'run `bun run build:viewer`')
  }

  console.log()
  if (hardFail) {
    console.log(pc.red('There are issues to fix before `codebreak explain` can be used.'))
    process.exit(1)
  }
  console.log(pc.green('All components are ready.'))
}
