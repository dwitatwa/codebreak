#!/usr/bin/env node
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
  .description('Jelaskan kode dengan LLM — changes, commit, file, atau deskripsi fitur → dokumen MDX interaktif')
  .version('0.1.0')

program
  .command('explain')
  .description(
    'Buat dokumen penjelasan. Sumber: --changes, --commit <ref>, <path>, atau "<deskripsi fitur>"',
  )
  .argument('[target]', 'path file/folder, atau deskripsi fitur bahasa natural')
  .option('--changes', 'jelaskan local changes (staged + unstaged + untracked)')
  .option('--commit <ref>', 'jelaskan commit/range, mis. HEAD, abc1234, HEAD~3..HEAD')
  .option('--lang <langs>', 'filter file berdasarkan ekstensi, mis. ts,js')
  .option('--focus <text>', 'instruksi penekanan khusus untuk LLM')
  .addOption(new Option('--depth <depth>', 'tingkat detail penjelasan').choices(DEPTHS))
  .option('--context <text>', 'konteks tambahan yang langsung di-inject ke LLM')
  .option('--locale <code>', 'bahasa penjelasan: id | en (default dari config)')
  .option('--max-context <chars>', 'budget karakter konteks yang dikirim ke LLM')
  .option('--web', 'langsung jalankan & buka viewer setelah dokumen dibuat')
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
  .option('--no-open', 'jangan buka browser otomatis')
  .action(async (opts) => {
    await runView({ port: Number(opts.port), open: opts.open })
  })

program
  .command('add')
  .description(
    'Simpan dokumen markdown/MDX buatan agen eksternal ke viewer (file path atau stdin "-"). Tanpa LLM server.',
  )
  .argument('[file]', 'path file markdown, atau "-" untuk stdin')
  .option('--title <title>', 'judul dokumen')
  .option('--type <type>', 'tipe: changes | commit | file | description | note')
  .option('--source <source>', 'label sumber, mis. "commit abc123" atau pertanyaan pengguna')
  .option('--locale <code>', 'bahasa dokumen, mis. id | en')
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

skill.command('show').description('Cetak isi SKILL.md ke stdout').action(() => {
  runSkillShow()
})

program
  .command('init')
  .description('Opt-in codebreak untuk project ini: config project + skill harness + gitignore docs')
  .option('--force', 'timpa .codebreak/config.json yang sudah ada')
  .option('--skills <targets>', 'skill targets: project | user', 'project')
  .option('--no-skills', "don't install the harness skill")
  .option('--no-gitignore', 'jangan sentuh .gitignore')
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
  .description('Copot integrasi codebreak dari project ini (kebalikan init)')
  .option('--docs', 'ikut hapus dokumen di .codebreak/docs/')
  .option('--all', 'hapus seluruh folder .codebreak/')
  .option('--keep-skills', 'biarkan artefak skill harness tetap ada')
  .action(async (opts) => {
    const { runRemove } = await import('./commands/remove.js')
    runRemove({ docs: opts.docs, all: opts.all, keepSkills: opts.keepSkills })
  })

program.command('doctor').description('Periksa konfigurasi, koneksi LLM, git, dan viewer').action(runDoctor)

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
