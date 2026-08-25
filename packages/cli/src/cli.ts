#!/usr/bin/env bun
import { Command, Option } from 'commander'
import pc from 'picocolors'
import { runAdd } from './commands/add.js'
import { runDoctor } from './commands/doctor.js'
import { runExplain } from './commands/explain.js'
import { runSkillInstall, runSkillShow } from './commands/skill.js'
import { runView } from './commands/view.js'
import { DEPTHS } from './config.js'
import { CodebreakError } from './errors.js'

const program = new Command()

program
  .name('codebreak')
  .description('Explain code with an LLM — changes, commits, files, or feature descriptions → interactive MDX docs')
  .version('0.1.0')

program
  .command('explain')
  .description(
    'Create an explanation document. Sources: --changes, --commit <ref>, <path>, or "<feature description>"',
  )
  .argument('[target]', 'file/folder path, or a natural-language feature description')
  .option('--changes', 'explain local changes (staged + unstaged + untracked)')
  .option('--commit <ref>', 'explain a commit or range, e.g. HEAD, abc1234, HEAD~3..HEAD')
  .option('--lang <langs>', 'filter target files by extension, e.g. ts,js')
  .option('--focus <text>', 'special emphasis instruction for the LLM')
  .addOption(new Option('--depth <depth>', 'explanation detail level').choices(DEPTHS))
  .option('--context <text>', 'extra context injected directly into the LLM prompt')
  .option('--locale <code>', 'explanation language: id | en (default from config)')
  .option('--max-context <chars>', 'character budget for LLM context')
  .option('--web', 'launch & open the viewer right after the document is created')
  .action(async (target: string | undefined, opts) => {
    await runExplain(target, {
      changes: opts.changes,
      commit: opts.commit,
      lang: opts.lang,
      focus: opts.focus,
      depth: opts.depth,
      context: opts.context,
      locale: opts.locale,
      maxContext: opts.maxContext,
      web: opts.web,
    })
  })

program
  .command('view')
  .description('Jalankan web viewer lokal untuk dokumen di repo saat ini')
  .option('--port <port>', 'port HTTP viewer', '5173')
  .option('--no-open', "don't open the browser automatically")
  .action(async (opts) => {
    await runView({ port: Number(opts.port), open: opts.open })
  })

program
  .command('add')
  .description(
    'Save an agent-written markdown/MDX document into the viewer (file path or stdin "-"). No LLM server needed.',
  )
  .argument('[file]', 'markdown file path, or "-" for stdin')
  .option('--title <title>', 'document title')
  .option('--type <type>', 'type: changes | commit | file | description | note')
  .option('--source <source>', 'source label, e.g. "commit abc123" or the user question')
  .option('--locale <code>', 'document language, e.g. id | en')
  .action(async (file: string | undefined, opts) => {
    await runAdd(file, {
      title: opts.title,
      type: opts.type,
      source: opts.source,
      locale: opts.locale,
    })
  })

const skill = program
  .command('skill')
  .description('Manage the codebreak agent skill (.agents/skills — works across agent harnesses)')

skill
  .command('install')
  .description('Install SKILL.md into generic .agents/skills locations. Default: both targets.')
  .argument('[targets...]', 'project | user')
  .action((targets: string[]) => {
    runSkillInstall(targets)
  })

skill.command('show').description('Print the SKILL.md content to stdout').action(() => {
  runSkillShow()
})

program
  .command('init')
  .description('Opt this project into codebreak: project config + harness skill + docs gitignore')
  .option('--force', 'overwrite an existing .codebreak/config.json')
  .option('--skills <targets>', 'skill targets: project | user', 'project')
  .option('--no-skills', "don't install the harness skill")
  .option('--no-gitignore', "don't touch .gitignore")
  .action(async (opts) => {
    const { runInit } = await import('./commands/init.js')
    await runInit({
      force: opts.force,
      skills: opts.skills,
      noSkills: opts.noSkills,
      noGitignore: opts.noGitignore,
    })
  })

program
  .command('remove')
  .description('Remove codebreak integration from this project (inverse of init)')
  .option('--docs', 'also delete documents in .codebreak/docs/')
  .option('--all', 'delete the entire .codebreak/ folder')
  .option('--keep-skills', 'keep the harness skill artifacts')
  .action(async (opts) => {
    const { runRemove } = await import('./commands/remove.js')
    runRemove({ docs: opts.docs, all: opts.all, keepSkills: opts.keepSkills })
  })

program.command('doctor').description('Check config, LLM connectivity, git, and the viewer').action(runDoctor)

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv)
  } catch (err) {
    if (err instanceof CodebreakError) {
      console.error(pc.red(`✗ ${err.message}`))
    } else if ((err as { name?: string })?.name === 'CommanderError') {
      // pesan usage sudah dicetak commander
    } else {
      console.error(pc.red(`✗ ${(err as Error).message}`))
      console.error(pc.dim((err as Error).stack ?? ''))
    }
    process.exit(1)
  }
}

main()
