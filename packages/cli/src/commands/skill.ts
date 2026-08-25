import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pc from 'picocolors'
import { CodebreakError } from '../errors.js'

/**
 * Cari SKILL.md kanonik dengan menelusuri ke atas dari lokasi modul ini.
 * Tahan perubahan layout hasil bundling (cli.js / chunk-* di dist/) maupun mode source.
 */
function skillCandidates(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const relatives = ['dist/skill/SKILL.md', 'skill/SKILL.md', 'skills/codebreak/SKILL.md']
  const out: string[] = []
  let cur = here
  for (let i = 0; i < 6; i += 1) {
    for (const rel of relatives) {
      const candidate = path.join(cur, rel)
      if (!out.includes(candidate)) out.push(candidate)
    }
    const parent = path.dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  return out
}

function loadSkillText(): string {
  for (const p of skillCandidates()) {
    try {
      return fs.readFileSync(p, 'utf8')
    } catch {
      continue
    }
  }
  throw new CodebreakError('SKILL.md tidak ditemukan. Jalankan `pnpm build` di root proyek codebreak.')
}

export type SkillTarget = 'project' | 'user'

const VALID_TARGETS: SkillTarget[] = ['project', 'user']

interface InstallPlan {
  label: string
  write(): string
}

function writeFilePlan(label: string, absPath: string, content: string): InstallPlan {
  return {
    label,
    write() {
      fs.mkdirSync(path.dirname(absPath), { recursive: true })
      fs.writeFileSync(absPath, content, 'utf8')
      return absPath
    },
  }
}

function buildPlans(targets: Set<SkillTarget>, skillText: string, baseDir: string): InstallPlan[] {
  const plans: InstallPlan[] = []

  if (targets.has('project')) {
    plans.push(
      writeFilePlan('project (.agents/skills)', path.join(baseDir, '.agents', 'skills', 'codebreak', 'SKILL.md'), skillText),
    )
  }
  if (targets.has('user')) {
    // ~/.agents/skills is the generic user-level location many harnesses pick up
    plans.push(writeFilePlan('user (~/.agents/skills)', path.join(os.homedir(), '.agents', 'skills', 'codebreak', 'SKILL.md'), skillText))
  }
  return plans
}

/** Artifacts the installer writes inside a project (used by `codebreak remove`) */
export function projectSkillArtifacts(baseDir: string): { path: string; label: string }[] {
  return [
    { path: path.join(baseDir, '.agents', 'skills', 'codebreak'), label: 'project (.agents/skills)' },
  ]
}

export function runSkillInstall(targetsArg: string[] | undefined, baseDir = process.cwd()): void {
  const targets = new Set<SkillTarget>(
    targetsArg && targetsArg.length > 0
      ? targetsArg.map((t) => t.toLowerCase() as SkillTarget)
      : VALID_TARGETS,
  )
  for (const t of targets) {
    if (!VALID_TARGETS.includes(t)) {
      throw new CodebreakError(`Unknown target: "${t}" (choices: ${VALID_TARGETS.join(', ')})`)
    }
  }

  const skillText = loadSkillText()

  console.log(`Installing codebreak skill (${[...targets].join(', ')}) into ${baseDir}:`)
  for (const plan of buildPlans(targets, skillText, baseDir)) {
    try {
      const written = plan.write()
      console.log(`  ${pc.green('✓')} ${plan.label} — ${pc.dim(written)}`)
    } catch (err) {
      console.log(`  ${pc.red('✗')} ${plan.label} — ${(err as Error).message}`)
    }
  }
  console.log()
  console.log(pc.dim('The skill teaches agents to write docs and save them via `codebreak add`.'))
}

export function runSkillShow(): void {
  process.stdout.write(loadSkillText())
}
