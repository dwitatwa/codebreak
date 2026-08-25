import { useEffect, useState } from 'react'
import { ChevronDown, FileCode2 } from 'lucide-react'

interface FileSourceProps {
  /** Repo-relative path, e.g. "src/auth/login.ts" */
  path: string
}

interface FileResponse {
  path?: string
  content?: string
  error?: string
}

/**
 * Fetches the current source of a file (relative to the repo root) and renders
 * it line-numbered inside a collapsible panel.
 */
export default function FileSource({ path }: FileSourceProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [content, setContent] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch(`/api/file?path=${encodeURIComponent(path)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: FileResponse) => {
        if (!alive) return
        if (data.content !== undefined) {
          setContent(data.content)
          setState('ok')
        } else {
          setError(data.error ?? 'could not load file')
          setState('error')
        }
      })
      .catch((err) => {
        if (!alive) return
        setError(String(err))
        setState('error')
      })
    return () => {
      alive = false
    }
  }, [path])

  if (state === 'error') {
    return (
      <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
        {error}
      </p>
    )
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border-subtle)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
      >
        <FileCode2 size={13} style={{ color: 'var(--color-text-faint)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {path}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-faint)' }}>
          {state === 'loading' ? 'loading…' : open ? 'hide' : `show full source · ${content.split('\n').length} lines`}
        </span>
        <ChevronDown
          size={13}
          className="transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none', color: 'var(--color-text-faint)' }}
        />
      </button>
      {open && state === 'ok' && (
        <div className="max-h-96 overflow-auto cb-scroll border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <table className="w-full border-collapse font-mono text-[12px] leading-5">
            <tbody>
              {content.split('\n').map((line, i) => (
                <tr key={i} className="align-top">
                  <td
                    className="w-10 select-none border-r px-2 text-right tabular-nums"
                    style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-faint)' }}
                  >
                    {i + 1}
                  </td>
                  <td className="whitespace-pre px-3" style={{ color: 'var(--color-text-muted)' }}>
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
