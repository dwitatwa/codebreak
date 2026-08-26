import { useEffect } from 'react'

/**
 * Subscribes to SSE reload events from the codebreak server — mounted once at the root.
 * When an .mdx file is created/changed, the server broadcasts "reload" and the browser refreshes.
 */
export default function LiveReload() {
  useEffect(() => {
    // When the frontend is developed via vite dev (without the codebreak server), this endpoint does not exist.
    if (import.meta.env.DEV) return
    const es = new EventSource('/events')
    es.addEventListener('reload', () => location.reload())
    return () => es.close()
  }, [])
  return null
}
