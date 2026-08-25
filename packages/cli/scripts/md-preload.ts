// Dipreload lewat bunfig.toml agar `bun run` bisa mengimpor file .md sebagai string.
import { mdPlugin } from './md-plugin.ts'

Bun.plugin(mdPlugin)
