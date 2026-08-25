# codebreak

CLI yang memakai LLM untuk **menjelaskan kode** — local changes, commit, file/folder, atau deskripsi fitur bahasa natural — lalu menghasilkan **dokumen MDX interaktif** yang dibaca lewat web viewer lokal.

```
codebreak explain --changes          # staged + unstaged + untracked
codebreak explain --commit HEAD      # satu commit / range: HEAD~3..HEAD
codebreak explain src/auth/login.ts  # file atau folder
codebreak explain "payment webhook"  # LLM otomatis mencari file relevan
```

## Cara kerja

1. **Kumpulkan konteks** sesuai mode input (diff git, isi file, atau repo map).
2. **Mode deskripsi**: kirim peta file repository ke LLM → LLM memilih hingga N file paling relevan → isi file dibaca.
3. **Analisis**: prompt dibangun sesuai `--depth` (overview/block/line), `--focus`, `--context`, dan bahasa (`--locale`).
4. **Emit dokumen** MDX ke `.codebreak/docs/YYYY-MM-DD-<slug>.mdx` (markdown murni + `<details>` collapsible, valid dibuka di mana pun).
5. Buka viewer — dokumen baru langsung muncul tanpa refresh (hot reload).

## Setup

Butuh Node.js ≥ 20 dan [pnpm](https://pnpm.io) (`corepack enable`).

### Linux / macOS

```bash
git clone git@github.com:<user>/codebreak.git && cd codebreak
corepack enable
pnpm install
pnpm build
ln -sf "$(pwd)/packages/cli/dist/cli.js" ~/.local/bin/codebreak   # macOS: /usr/local/bin juga bisa
```

### Windows

Jalankan di PowerShell (Node ≥ 20 + Git for Windows):

```powershell
git clone https://github.com/<user>/codebreak.git; cd codebreak
corepack enable
pnpm install
pnpm build
pnpm link --global     # shim masuk %LOCALAPPDATA%\pnpm — jalankan `pnpm setup` bila belum di PATH
```

Viewer otomatis memakai `vite.cmd` dan pembuka browser yang benar di Windows/macOS.

### Konfigurasi LLM

v1 memakai endpoint **OpenAI-compatible** apa pun (OpenAI, Ollama `/v1`, LM Studio, Groq, OpenRouter, vLLM).

Buat `~/.config/codebreak/config.json`:

```json
{
  "provider": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKeyEnv": "OPENAI_API_KEY",
    "model": "gpt-4o-mini"
  },
  "outputLocale": "id",
  "depth": "block"
}
```

Atau cukup lewat environment:

```bash
export OPENAI_API_KEY=sk-...                 # nama env bisa diganti via provider.apiKeyEnv
export CODEBREAK_BASE_URL=http://localhost:11434/v1   # contoh: Ollama lokal
export CODEBREAK_MODEL=qwen2.5-coder
```

API key tidak wajib untuk server lokal tanpa auth. Cek kesehatan semua komponen:

```bash
codebreak doctor
```

## Penggunaan

```bash
# Sumber input (pilih salah satu)
codebreak explain --changes
codebreak explain --commit HEAD
codebreak explain --commit abc1234
codebreak explain --commit HEAD~3..HEAD
codebreak explain src/auth/
codebreak explain "user authentication flow"

# Options
--lang ts,js          # filter file target berdasarkan ekstensi
--focus "error handling"   # penekanan khusus untuk LLM
--depth overview|block|line    # tingkat detail (default: block)
--context "teks"      # konteks tambahan yang di-inject langsung ke LLM
--locale id|en        # bahasa penjelasan (default: id)
--max-context <chars> # budget karakter konteks
--web                 # jalankan + buka viewer setelah dokumen jadi

# Pipe juga didukung
git diff main | codebreak explain          # diff sebagai sumber
cat notes.md | codebreak explain --changes # stdin sebagai konteks tambahan

# Viewer & diagnostik
codebreak view        # server lokal + buka browser; biarkan jalan agar doc baru muncul otomatis
codebreak view --port 3000 --no-open
codebreak doctor
```

### Dipakai oleh agent harness

Agen tidak perlu LLM server terkonfigurasi — agen menulis dokumennya sendiri lalu
menyimpannya lewat **`codebreak add`**:

```bash
cat /tmp/doc.mdx | codebreak add -                    # dari stdin
codebreak add /tmp/doc.mdx --type description --title "Auth Flow"
```

Frontmatter dengan atau tanpa pun diterima (`title`/`type`/`source` dinormalisasi,
`date` & slug otomatis; tipe: changes | commit | file | description | note).

Pasang skill generik yang mengajarkan alur ini — satu format `.agents/skills/`
yang dibaca hampir semua agent harness:

```bash
codebreak skill install            # project (.agents/skills/) + user (~/.agents/skills/)
codebreak skill install project    # hanya untuk repo saat ini
codebreak skill show               # baca isi skill
```

Format lain (`.claude/`, `.cursor/`, AGENTS.md) sengaja tidak di-install otomatis
saat ini — harness tersebut tetap bisa membaca SKILL.md yang sama secara manual
bila diperlukan.

Hasil dokumen tersimpan di `<repo>/.codebreak/docs/*.mdx`. Karena berupa artefak lokal,
disarankan menambahkannya ke `.gitignore` repo target:

```
.codebreak/docs/
```

### Dipakai di project tertentu (opt-in per project)

Binary cukup terpasang satu per mesin. Untuk "menginstal" codebreak pada repo tertentu:

```bash
cd ~/project/repo-target
codebreak init                # config project + skill harness + gitignore docs
codebreak remove              # copot lagi (—docs ikut hapus dokumen, —all hapus .codebreak/)
```

`init` menulis `.codebreak/config.json` berisi salinan config efektif — edit file itu
untuk memberi project ini model/provider/bahasa sendiri:

```
defaults ← ~/.config/codebreak/config.json ← <repo>/.codebreak/config.json ← environment
```

Cek sumber mana yang aktif: `codebreak doctor`.

### Publish ke GitHub (manual)

Repo ini belum punya commit; cara rapi memulainya:

```bash
git add .gitignore pnpm-workspace.yaml package.json tsconfig.base.json README.md skills/ packages/
git commit -m "feat: codebreak core — explain CLI + viewer + LLM pipeline"
# (opsional, jika ingin riwayat terpisah)
#   commit 2: integrasi agen/skill · commit 3: init/remove + lintas platform
git remote add origin git@github.com:<user>/codebreak.git
git push -u origin main
```

Buat repo kosongnya dulu di github.com (SSH key sudah tersedia di mesin ini).
`.agents/` di repo ini sengaja di-gitignore karena hasil generator
`codebreak skill install` — sumber kanonik ada di `skills/`.

## Struktur proyek

```
packages/
├── cli/       # bin "codebreak" — commander, simple-git, openai SDK
│   └── src/
│       ├── commands/   # explain | add | view | skill | doctor
│       ├── core/       # orkestrator + gatherer material per mode
│       ├── inputs/     # resolver input, walker file, tipe konteks
│       ├── git/        # wrapper git (status/diff/show/range)
│       ├── llm/        # abstraksi provider, prompts, pipeline relevance
│       └── render/     # emitter MDX
└── viewer/    # Vite + React — plugin kustom menyajikan .codebreak/docs/*.mdx
    └── src/   # Home (daftar), DocPage (render MDX + TOC), Sidebar
skills/
└── codebreak/SKILL.md   # skill kanonik untuk agent harness (disalin ke dist saat build)
```

- **Viewer** adalah plugin Vite kustom: `/api/docs` untuk listing metadata, `/@codebreak-doc/*`
  mengompilasi MDX on-the-fly (remark-gfm + shiki) menjadi modul React, dengan hot reload saat
  dokumen baru dibuat.
- **Provider LLM** adalah interface tipis; menambah provider non-OpenAI-compatible (mis. Anthropic
  native) = satu class baru di `packages/cli/src/llm/`.

## Development

```bash
pnpm test              # vitest (47 test: resolver, git fixture, truncation, prompts, e2e mock)
pnpm build             # build CLI
pnpm --filter @codebreak/viewer dev   # jalankan viewer manual
```

## Catatan desain

- Output LLM dikontrak ketat agar selalu MDX-valid (tanpa import JSX; hanya elemen HTML native).
  Jika model tetap menghasilkan MDX rusak, viewer otomatis fallback menampilkan teks mentah.
- Pipeline relevance v1 melakukan satu ronde seleksi file dari repo map (maks. 2500 path);
  budget konteks default ±180 ribu karakter dengan pemotongan bertanda di tengah.
- File binary dilewati; file untracked ikut dianalisis pada mode `--changes`.
