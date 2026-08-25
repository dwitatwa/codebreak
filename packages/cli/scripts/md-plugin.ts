import type { BunPlugin } from 'bun'

/**
 * Loader .md → modul JS berisi string default export.
 * Dipakai runtime (preload bunfig) dan saat compile binary (Bun.build plugins)
 * supaya SKILL.md ter-embed sebagai satu sumber kebenaran.
 */
export const mdPlugin: BunPlugin = {
  name: 'codebreak-md-loader',
  setup(build) {
    build.onLoad({ filter: /\.md$/ }, async (args) => {
      const text = await Bun.file(args.path).text()
      return {
        contents: `export default ${JSON.stringify(text)};`,
        loader: 'js',
      }
    })
  },
}
