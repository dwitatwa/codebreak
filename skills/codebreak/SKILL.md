---
name: codebreak
description: >
  Save code explanations (local changes, commits, files, or feature descriptions)
  as interactive MDX documents into the codebreak viewer. Use it when the user
  asks you to explain or document code so it can be read in a browser via
  `codebreak view`, to add analysis to the project's document collection, or
  after completing a code change worth documenting.
---

# codebreak — interactive code documentation via agents

You (the agent) are the **author of the document**. No external LLM server needs to be
configured: gather context yourself using your own tools (read files, run git/grep),
write the document following the contract below, then save it with the `codebreak` CLI.
New documents appear automatically in the local web viewer (`codebreak view`) — no restart.

## Workflow

1. **Gather context** based on what the user asked:
   - Local changes: `git status --porcelain` + `git diff HEAD` (+ read untracked files).
   - Commit/range: `git show <ref>` for a single commit; `git log --oneline A..B` and
     `git diff A B` for a range.
   - File/folder: just read it.
   - Feature description ("how does the payment webhook work?"): find the relevant files
     yourself (grep/glob for symbols), then read them.
2. **Write the document** following the content & MDX-safety contract below.
3. **Save it** through the CLI:
   ```bash
   codebreak add /tmp/doc.mdx                 # from a temp file
   cat /tmp/doc.mdx | codebreak add -         # from stdin
   ```
4. **Done**: tell the user to run `codebreak view` if the viewer isn't running yet.
   Don't run `codebreak view` as a blocking process unless asked; just suggest it.
   New documents always show up automatically in a running viewer.

## Frontmatter contract

`codebreak add` accepts markdown **with or without frontmatter** — existing frontmatter
is preserved and normalized:

| Column | Required?   | Content                                                        |
| ------ | ----------- | -------------------------------------------------------------- |
| title  | recommended | document title; if empty, taken from the first heading          |
| type   | optional    | `changes` \| `commit` \| `file` \| `description` \| `note` (default `note`) |
| source | optional    | e.g. `commit abc123`, `src/auth/`, or the user's question       |

`date`, the file name (slug), and name-collision handling are filled in by the CLI.
Override per column without editing the file: `--title`, `--type`, `--source`, `--locale`.

## Document content contract (MDX-safe)

- All prose in **the user's language**.
- Start the document with a `# Document Title` line (or include frontmatter `title:` /
  the `--title` flag) — this determines the file name and how it appears in the viewer.
- Start with `## Summary` — a TL;DR of at most 6 bullets.
- One `### path/to/file.ext` section per file being discussed.
- Wrap each explained unit in the viewer components — code FIRST, line-keyed notes below:
  ```markdown
  <Block name="functionName" lines="12-40">
    <CodeBlock lang="ts">

      ```ts
      (the COMPLETE, CONTIGUOUS slice of the file covering the block's
       `lines` range — verbatim, every line, no elision, no "...", no diff markers)
      ```

    </CodeBlock>
    <LineNotes>
      <Note line="12">one short fact: what this line does.</Note>
      <Note line="14">why it is implemented this way.</Note>
      <Note line="15">a consequence/edge case the developer should think about —
        MUST include at least one such implication somewhere in the notes.</Note>
    </LineNotes>
  </Block>
  ```
- The code inside `<CodeBlock>` MUST be written as a fenced code block (```lang … ```)
  so MDX does not mis-parse it.
- The code block MUST be the complete, contiguous slice of the file covering the
  block's `lines` range — verbatim, no elision, no `…`, no diff markers, no skipping.
  If the block says `lines="28-41"`, the code must contain file lines 28–41 exactly.
- Annotate only the **load-bearing lines** (control flow, side effects, edge cases,
  subtle logic). Skip boilerplate. One short note per line — no long paragraphs.
- Depth follows the request: `overview` = architecture only, no function detail;
  `block` = per function/class/block with line ranges; `line` = block level plus
  `L<n>` references for subtle or risky lines.
- **MDX-SAFETY RULES** (violations break rendering):
  - Never write a bare `<` character outside the component tags — say "less than" or wrap
    expressions in backticks.
  - Never start a line with `{` outside code fences.
  - Do NOT write `<details>`, `<summary>`, `<b>` — the viewer components `<Block>`,
    `<CodeBlock>`, `<LineNotes>`, `<Note>` are the ONLY allowed structural elements.

## Other command reference

- `codebreak explain --changes|--commit <ref>|<path>|"<description>"` — generate a
  document via an LLM server (requires a provider configured in
  `~/.config/codebreak/config.json`). Not needed for this skill's workflow.
- `codebreak doctor` — health check for the installation.
- Documents are stored at `<repo>/.codebreak/docs/YYYY-MM-DD-<slug>.mdx`.
