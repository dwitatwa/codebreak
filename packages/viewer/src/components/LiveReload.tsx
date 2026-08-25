import { useEffect } from 'react'

/**
 * Berlangganan SSE reload dari server codebreak — dipasang sekali di root.
 * Saat file .mdx dibuat/diubah, server broadcast "reload" dan browser refresh.
 */
export default function LiveReload() {
  useEffect(() => {
    // Saat frontend di-develop lewat vite dev (tanpa server codebreak), endpoint ini tidak ada.
    if (import.meta.env.DEV) return
    const es = new EventSource('/events')
    es.addEventListener('reload', () => location.reload())
    return () => es.close()
  }, [])
  return null
}
