void (async function loadConfiguredIconFont() {
  const configured = window.settings?.custom_icon_url
  if (typeof configured !== 'string' || !configured.trim()) return

  let url
  try { url = new URL(configured.trim(), document.baseURI) } catch { return }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return

  const family = 'Material Symbols Outlined'
  const root = document.documentElement
  const controller = new AbortController()
  const { signal } = controller
  const finish = () => root.removeAttribute('data-icon-font-pending')
  root.setAttribute('data-icon-font-pending', '')
  signal.addEventListener('abort', finish, { once: true })
  const timeout = setTimeout(() => controller.abort(), 3500)

  function loadStylesheet() {
    return new Promise(resolve => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url.href
      link.referrerPolicy = 'no-referrer'
      function done(loaded) {
        signal.removeEventListener('abort', abort)
        link.onload = link.onerror = null
        if (!loaded) link.remove()
        resolve()
      }
      function abort() { done(false) }
      link.onload = async () => {
        try {
          const faces = await document.fonts.load(`20px "${family}"`, 'dashboard')
          done(!signal.aborted && faces.length > 0)
        } catch { done(false) }
      }
      link.onerror = abort
      signal.addEventListener('abort', abort, { once: true })
      document.head.appendChild(link)
    })
  }

  async function activate(bytes) {
    const face = await new FontFace(family, bytes).load()
    if (signal.aborted) return false
    document.fonts.add(face)
    return true
  }

  function downloadInSandbox() {
    return new Promise(resolve => {
      const frame = document.createElement('iframe')
      frame.hidden = true
      frame.title = '图标字体下载'
      frame.setAttribute('sandbox', 'allow-scripts')
      function done(bytes) {
        window.removeEventListener('message', receive)
        signal.removeEventListener('abort', abort)
        frame.remove()
        resolve(bytes)
      }
      function abort() { done(null) }
      function receive(event) {
        if (event.source !== frame.contentWindow || event.origin !== 'null') return
        if (event.data?.type === 'ANON_FONT_SUCCESS' && event.data.buffer instanceof ArrayBuffer) {
          done(event.data.buffer)
        } else if (event.data?.type === 'ANON_FONT_FAIL') {
          done(null)
        }
      }
      const address = JSON.stringify(url.href).replace(/</g, '\\u003c')
      frame.srcdoc = '<!doctype html><meta name="referrer" content="no-referrer"><script>' +
        `fetch(${address}, { credentials: 'omit', referrerPolicy: 'no-referrer' })` +
        '.then(response => { if (!response.ok) throw new Error(); return response.arrayBuffer(); })' +
        '.then(buffer => parent.postMessage({ type: "ANON_FONT_SUCCESS", buffer }, "*", [buffer]))' +
        '.catch(() => parent.postMessage({ type: "ANON_FONT_FAIL" }, "*"));' +
        '</' + 'script>'
      window.addEventListener('message', receive)
      signal.addEventListener('abort', abort, { once: true })
      document.head.appendChild(frame)
    })
  }

  try {
    if (/\.css$/i.test(url.pathname)) {
      await loadStylesheet()
      return
    }
    let cache
    try {
      cache = await window.caches?.open('xboard-theme-assets-v1')
      const cached = await cache?.match(url.href)
      if (cached && !signal.aborted) {
        try { if (await activate(await cached.arrayBuffer())) return }
        catch { void cache.delete(url.href).catch(() => {}) }
      }
    } catch { /* Try the configured URL even if browser storage is unavailable. */ }
    if (signal.aborted) return
    const bytes = await downloadInSandbox()
    if (bytes && await activate(bytes) && cache) {
      void cache.put(url.href, new Response(bytes, { headers: { 'Content-Type': 'font/woff2' } })).catch(() => {})
    }
  } catch {
    // The bundled face becomes available when the configured font fails.
  } finally {
    clearTimeout(timeout)
    finish()
  }
})()
