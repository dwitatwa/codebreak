# codebreak

A CLI that uses an LLM to **explain code** — local changes, commits, files/folders, or
natural-language feature descriptions — and produces **interactive MDX documents** read
through a local web viewer.

```
codebreak explain --changes          # staged + unstaged + untracked
codebreak explain --commit HEAD      # one commit / range: HEAD~3..HEAD
codebreak explain src/auth/login.ts  # a file or folder
codebreak explain "payment webhook"  # the LLM finds the relevant files itself
```

## How it works

1. **Gather context** for the chosen input mode (git diff, file contents, or a repo map).
2. **Description mode**: send a map of the repository to the LLM → it picks up to N most
   relevant files → their contents are read.
3. **Analyze**: the prompt is built according to `--depth` (overview/block/line),
   `--focus`, `--context`, and language (`--locale`).
4. **Emit an MDX document** to `.codebreak/docs/YYYY-MM-DD-<slug>.mdx` (plain markdown +
   native `<details>` collapsibles — valid anywhere).
5. Open the viewer — new documents appear instantly via hot reload.

## Setup

### End user — no Node required, one binary

Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/dwitatwa/codebreak/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/dwitatwa/codebreak/main/install.ps1 | iex
```

Or download `codebreak-<os>-<arch>` manually from
[Releases](https://github.com/dwitatwa/codebreak/releases), make it executable, and put
it on your PATH. The only optional extra is **git**, needed for the `--changes` and
`--commit` modes.

### Developer / from source

Requires [Bun](https://bun.sh) ≥ 1.1 (Node is not needed):

```bash
git clone git@github.com:dwitatwa/codebreak.git && cd codebreak
bun install
bun run build          # viewer shell + asset manifest + Linux & Windows binaries
ln -sf "$(pwd)/packages/cli/dist/cli.js" ~/.local/bin/codebreak   # optional global command
bun test               # 63 unit/integration tests
```

`bun run dev` runs the CLI straight from TypeScript. Vite is used purely as a
build-time tool for the frontend shell — the runtime never touches Node or Vite.

### LLM configuration

v1 talks to any **OpenAI-compatible** endpoint (OpenAI, Ollama `/v1`, LM Studio, Groq,
OpenRouter, vLLM).

Create `~/.config/codebreak/config.json`:

```json
{
  "provider": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKeyEnv": "OPENAI_API_KEY",
    "model": "gpt-4o-mini"
  },
  "outputLocale": "en",
  "depth": "block"
}
```

Or just use environment variables:

```bash
export OPENAI_API_KEY=sk-...                 # rename via provider.apiKeyEnv if needed
export CODEBREAK_BASE_URL=http://localhost:11434/v1   # example: local Ollama
export CODEBREAK_MODEL=qwen2.5-coder
```

An API key is not required for local servers without auth. Health-check everything:

```bash
codebreak doctor
```

## Usage

```bash
# Input sources (pick one)
codebreak explain --changes
codebreak explain --commit HEAD
codebreak explain --commit abc1234
codebreak explain --commit HEAD~3..HEAD
codebreak explain src/auth/
codebreak explain "user authentication flow"

# Options
--lang ts,js          # filter target files by extension
--focus "error handling"   # special emphasis instruction for the LLM
--depth overview|block|line    # detail level (default: block)
--context "text"      # extra context injected directly into the prompt
--locale id|en        # explanation language (default from config)
--max-context <chars> # character budget for gathered context
--web                 # launch + open the viewer right after generating

# Piping works too
git diff main | codebreak explain          # diff as the source
cat notes.md | codebreak explain --changes # stdin as extra context

# Viewer & diagnostics
codebreak view        # local server + opens browser; leave running for live updates
codebreak view --port 3000 --no-open
codebreak doctor
```

Documents are stored at `<repo>/.codebreak/docs/*.mdx`. Since they are local artifacts,
it's recommended to add `.codebreak/docs/` to the target repo's `.gitignore`.

### Used by agent harnesses

Agents don't need an LLM server configured — the agent writes the document itself and
saves it through **`codebreak add`**:

```bash
cat /tmp/doc.mdx | codebreak add -                    # from stdin
codebreak add /tmp/doc.mdx --type description --title "Auth Flow"
```

Frontmatter is optional (`title`/`type`/`source` are normalized; `date` and the slug are
generated automatically; types: changes | commit | file | description | note).

Install the generic skill that teaches this workflow — one `.agents/skills/` format
understood by nearly every agent harness:

```bash
codebreak skill install            # project (.agents/skills/) + user (~/.agents/skills/)
codebreak skill install project    # current repo only
codebreak skill show               # print the skill content
```

Other formats (`.claude/`, `.cursor/`, AGENTS.md) are intentionally not auto-installed
right now — those harnesses can still read the same SKILL.md manually if needed.

### Per-project opt-in

The binary only needs to exist once per machine. To "install" codebreak into a specific
repo:

```bash
cd ~/project/target-repo
codebreak init                # project config + harness skill + docs gitignore
codebreak remove              # undo it (--docs also deletes documents, --all removes .codebreak/)
```

`init` writes `.codebreak/config.json` containing a copy of the effective config — edit
that file to give this project its own model/provider/language:

```
defaults ← ~/.config/codebreak/config.json ← <repo>/.codebreak/config.json ← environment
```

Check which layers are active with `codebreak doctor`.

### Releases

Binaries are built locally — no CI involved:

```bash
bun run build          # produces packages/cli/dist-binaries/codebreak-<os>-<arch>
```

To publish a release, create one on GitHub and upload the binaries from
`packages/cli/dist-binaries/` (e.g. with the GitHub web UI or `gh release create
v0.2.0 dist-binaries/*`). The `install.sh` / `install.ps1` scripts download from the
latest release, so publish at least one release for them to work.

## Project structure

```
packages/
├── cli/       # the "codebreak" bin (Bun) — commander, simple-git, openai SDK
│   ├── scripts/build.ts   # shell → asset manifest → bundle + compile Linux & Windows binaries
│   └── src/
│       ├── commands/   # explain | add | view | skill | init | remove | doctor
│       ├── core/       # orchestrator + context gatherers per input mode
│       ├── inputs/     # input resolver, file walker, shared context types
│       ├── git/        # git wrapper (status/diff/show/ranges)
│       ├── llm/        # provider abstraction, prompts, relevance pipeline
│       ├── render/     # MDX emitter
│       └── viewer/     # Bun.serve: static shell + API + MDX→HTML on-demand + SSE
└── viewer/    # React shell — built by Vite into static assets (build-time only)
    └── src/   # Home (listing), DocPage (fetch HTML + TOC), Sidebar, LiveReload (SSE)
skills/
└── codebreak/SKILL.md   # canonical agent-harness skill (inlined at build time)
```

- **The doc server** runs in-process via `Bun.serve`: `/api/docs` lists metadata,
  `/api/doc/<slug>` compiles MDX on demand (remark-gfm + Shiki) into HTML strings, and
  `/events` (SSE) hot-reloads the browser when documents change.
- **Vite** is only invoked by `bun run build` to compile the frontend shell into static
  assets that get embedded in the binary through an asset manifest.
- **The LLM provider** is a thin interface; adding a non-OpenAI-compatible provider
  (e.g. native Anthropic) means one new class in `packages/cli/src/llm/`.

## Design notes

- LLM output follows a strict contract so it's always valid MDX (no JSX imports; only
  plain HTML elements). If a model still produces broken MDX, the viewer falls back to
  showing the raw text.
- The relevance pipeline does a single selection round over a repo map (max ~2500 paths);
  the default context budget is ~180k characters with clearly marked mid-file truncation.
- Binary files are skipped; untracked files are included in `--changes` mode.

## License

MIT License — see the [LICENSE](LICENSE) file for details.
