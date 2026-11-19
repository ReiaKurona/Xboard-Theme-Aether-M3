// Isolated production-build QA: cloud, Agent, kernel and sockets are all fake.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = fileURLToPath(new URL('../dist/assets/', import.meta.url))
const output = fileURLToPath(new URL('../../.build/reia-theme-qa/', import.meta.url))
fs.mkdirSync(output, { recursive: true })

function setup() {
  localStorage.clear()
  localStorage.setItem('auth_data', 'qa-account-only')
  const mobile = location.search.includes('mobile=1')
  if (mobile) localStorage.setItem('theme', 'dark')
  const state = window.reiaQA = { available: false, kernel: false, enabled: false, stack: 'mips', lan: false, node: 'Node A', providerUpdated: false, calls: [], errors: [], sockets: [], holdStatus: false }
  // Drive Vue's two-frame route transitions under Chrome virtual time.
  window.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 16)
  window.cancelAnimationFrame = clearTimeout
  window.addEventListener('error', event => { if (event.error) state.errors.push(`${event.error} at ${event.filename}:${event.lineno}:${event.colno}`) })
  window.addEventListener('unhandledrejection', event => state.errors.push(String(event.reason?.stack || event.reason)))
  const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  window.WebSocket = class {
    readyState = 0
    constructor(url) {
      this.path = new URL(url).pathname
      state.sockets.push(this)
      setTimeout(() => { if (this.readyState === 0) { this.readyState = 1; this.onopen?.() } }, 20)
    }
    close() { this.readyState = 3; this.onclose?.() }
    emit(data) { if (this.readyState === 1) this.onmessage?.({ data: JSON.stringify(data) }) }
  }
  const settings = () => ({ enabled: state.enabled, use_system_proxy: true, use_tun: false, tun_stack: state.stack, tun_device: 'ReiaClash', allow_lan: state.lan, outbound_mode: 'rule', geo_low_memory: true, update_interval_hours: 24 })
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href)
    state.calls.push({ url: url.href, method: options.method || 'GET', body: options.body, headers: options.headers })
    if (url.port === '25500') {
      if (!state.available) throw new TypeError('QA client offline')
      if (url.pathname === '/api/health') return json({ status: 'ok', agent_pid: 101, agent_version: 'QA' })
      if (url.pathname === '/api/handshake') return json({ features: ['outbound_ip', 'outbound_ip_trace'], mihomo_controller: { api_base: 'http://127.0.0.1:9090', secret: 'qa-secret-only' } })
      if (url.pathname === '/api/agent/outbound-ip') return json(state.enabled ? { ip: '198.51.100.9', country_code: 'JP', colo: 'NRT' } : { ip: '127.0.0.1' })
      if (url.pathname === '/api/agent/master') { await sleep(125); state.enabled = JSON.parse(options.body).enable; return json({ success: true }) }
      if (url.pathname === '/api/agent/settings') {
        const patch = JSON.parse(options.body)
        if (patch.tun_stack) state.stack = patch.tun_stack
        if (typeof patch.allow_lan === 'boolean') state.lan = patch.allow_lan
        return json({ success: true, settings: settings() })
      }
      if (url.pathname === '/api/agent/real-status') {
        const snapshot = { mihomo_running: state.kernel, real_tun: false, real_system_proxy: state.enabled, is_actually_intercepting: state.enabled, settings: settings() }
        if (state.holdStatus) { state.holdStatus = false; await sleep(685) }
        return json(snapshot)
      }
      if (url.pathname === '/api/system/status') return json({ core_service_supported: true, core_service_registration: { installed: false }, core_service_ready: false })
      if (url.pathname === '/api/subscription/status') return json({ has_url: true, refreshing: false, last_success_at: 1700000000, refresh_interval_hours: 12 })
      if (url.pathname === '/api/core/proxies') return json({ proxies: { 'QA Plan': { type: 'Selector', all: ['Node A', 'Node B'], now: state.node }, 'Node A': { type: 'Direct' } }, group_order: ['QA Plan'] })
      if (url.pathname === '/api/core/select') { state.node = JSON.parse(options.body).node; return json({ success: true }) }
      if (url.pathname === '/api/core/connections') return json({ connections: [], uploadTotal: 0, downloadTotal: 0 })
      return json({ success: true })
    }
    if (url.port === '9090') {
      if (url.pathname === '/version') { await sleep(1800); return json({ version: 'QA' }) }
      if (url.pathname === '/configs') return json({ mode: 'rule', 'mixed-port': 7890 })
      if (url.pathname === '/rules') return json({ rules: [{ type: 'DOMAIN', payload: 'rule.example', proxy: 'QA Plan', extra: { hitCount: 2 } }] })
      if (url.pathname === '/providers/rules') return json({ providers: { 'qa-filter': { behavior: 'domain', vehicleType: 'HTTP', ruleCount: state.providerUpdated ? 7 : 4 } } })
      if (url.pathname === '/providers/rules/qa-filter' && options.method === 'PUT') {
        state.providerUpdated = true; return new Response(null, { status: 204 })
      }
      return json({ delay: 10 })
    }
    return new Response('ip=192.0.2.1\nloc=US\ncolo=IAD\n')
  }
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const until = async (find, message, timeout = 1800) => {
    for (let elapsed = 0; elapsed < timeout; elapsed += 50) {
      const found = find()
      if (found) return found
      await sleep(50)
    }
    throw new Error(message)
  }
  const check = async () => {
    for (let attempt = 0; attempt < 30 && !document.querySelector('#app')?.children.length; attempt++) await sleep(100)
    await sleep(1200)
    if (mobile) assert(innerWidth < 600 && document.documentElement.classList.contains('dark'), 'mobile dark fixture did not apply')
    await until(() => [...document.fonts].some(font => font.family.includes('Aether Material Symbols') && font.status === 'loaded'), 'bundled icon font did not load')
    assert(!document.querySelector('[data-reia-console]'), 'client console visible while Agent is absent')
    assert(document.body.textContent.includes('快速接入节点') && document.body.textContent.includes('QA Plan'), 'original subscription/import cards missing')
    assert(!state.calls.some(call => new URL(call.url).port === '9090'), 'probed an unrelated Clash core before detecting Agent')
    state.available = true
    await sleep(5500)
    await sleep(100)
    assert(document.querySelector('[data-reia-console]'), 'console did not appear after late Agent startup')
    assert(document.querySelector('[data-reia-master]').getAttribute('aria-pressed') === 'false', 'paused client must still display its console')
    assert(document.querySelector('[data-reia-proxy-status]').textContent.includes('等待内核就绪'), 'Agent readiness was confused with the kernel')
    assert(document.querySelector('[data-reia-outbound-ip]').textContent.includes('出口 IP 暂不可用'), 'lookup failure displayed a loopback IP')
    assert(document.querySelectorAll('[data-reia-master]').length === 1 && !document.querySelector('.wavy-switch-btn'), 'duplicate homepage master control')
    const pairing = state.calls.filter(call => call.url.endsWith('/api/handshake')).at(-1)
    assert(JSON.parse(pairing.body).panel_url === location.href, 'real obfuscated theme URL was not paired')
    assert(state.calls.some(call => call.url.endsWith('/api/subscription/url') && JSON.parse(call.body).url === 'https://subscription.example/qa'), 'automatic subscription push missing')
    state.kernel = true
    await until(() => document.querySelector('[data-reia-proxy-status]').textContent.includes('代理已暂停'), 'ready state waited for slow secondary reads', 1500)
    const app = document.querySelector('#app').__vue_app__.config.globalProperties
    state.holdStatus = true
    void app.$pinia._s.get('clash').refreshState()
    const master = document.querySelector('[data-reia-master]')
    master.click()
    master.click()
    await sleep(850)
    assert(state.calls.filter(call => call.url.endsWith('/api/agent/master')).length === 1, 'master sent overlapping writes')
    assert(state.calls.some(call => call.url.endsWith('/api/agent/master') && JSON.parse(call.body).enable), 'homepage switch bypassed Agent master API')
    assert(document.querySelector('[data-reia-outbound-ip]').textContent.includes('198.51.100.9'), 'outbound IP was not refreshed after starting the proxy')
    assert(document.querySelector('[data-reia-proxy-status]').textContent.includes('代理已启用'), 'stale read overwrote the confirmed master state')
    assert(!state.calls.some(call => new URL(call.url).port === '9090' && call.method !== 'GET'), 'managed setting was written directly to core')
    state.available = false
    await sleep(5500)
    assert(!document.querySelector('[data-reia-console]'), 'disconnected client card remained visible')
    assert(document.body.textContent.includes('快速接入节点') && document.body.textContent.includes('QA Plan'), 'disconnect removed other cards')
    state.available = true; state.kernel = false
    await sleep(5500)
    assert(document.querySelector('[data-reia-console]'), 'Agent with unavailable kernel was hidden')
    const router = app.$router
    router.onError(error => state.errors.push(String(error.stack || error)))
    const manual = [...document.querySelectorAll('[data-reia-console] md-text-button')].find(el => el.textContent.includes('订阅同步'))
    manual.click()
    for (let attempt = 0; attempt < 80 && !document.querySelector('#reia-subscription-url'); attempt++) await sleep(100)
    const input = document.querySelector('#reia-subscription-url')
    assert(input, 'manual subscription fallback page missing; route=' + router.currentRoute.value.fullPath)
    input.value = 'https://subscription.example/manual'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await sleep(300)
    assert(state.calls.some(call => call.url.endsWith('/api/subscription/url') && JSON.parse(call.body).url.endsWith('/manual')), 'manual subscription was not sent')
    state.kernel = true
    await router.push({ name: 'ClashSettings' })
    await until(() => document.querySelector('[data-reia-settings-state]')?.textContent.includes('内核就绪'), 'settings did not follow kernel readiness')
    const lan = document.querySelector('md-switch[data-aria-label="允许局域网连接"], md-switch[aria-label="允许局域网连接"]')
    lan.selected = true
    lan.dispatchEvent(new Event('change'))
    await until(() => state.lan && lan.selected, 'settings switch did not reflect the acknowledged write')
    const stack = [...document.querySelectorAll('md-outlined-select')].find(select => select.label === 'TUN 协议栈')
    stack.value = 'gvisor'
    stack.dispatchEvent(new Event('change'))
    await until(() => state.stack === 'gvisor' && stack.value === 'gvisor', 'settings select did not reflect the acknowledged write')
    const settingsPage = document.querySelector('.clash-page')
    assert(settingsPage.scrollWidth <= settingsPage.clientWidth + 1, 'settings overflowed horizontally')

    await router.push({ name: 'ClashConnections' })
    const socket = await until(() => state.sockets.find(ws => ws.path === '/connections' && ws.readyState === 1), 'live connections did not subscribe')
    const row = { id: 'qa-connection', download: 5120, upload: 512, start: '2026-01-01T00:00:00Z', metadata: { host: 'long-subdomain.connection.example', sourceIP: '2001:db8::1', sourcePort: '52312', destinationIP: '192.0.2.5', destinationPort: '443', network: 'tcp', process: 'QA browser' }, rule: 'DOMAIN', chains: ['QA node'] }
    socket.emit({ connections: [row], downloadTotal: 5120, uploadTotal: 512 })
    const destination = await until(() => document.querySelector('.connection-link'), 'live connection row missing')
    const connectionsPage = document.querySelector('[data-clash-connections]')
    assert(connectionsPage.scrollWidth <= connectionsPage.clientWidth + 1, 'connections overflowed horizontally')
    destination.click()
    await until(() => document.querySelector('[data-clash-connections] md-dialog[open]')?.textContent.includes('[2001:db8::1]:52312'), 'connection details missing')
    void document.querySelector('[data-clash-connections] md-dialog[open]').close()
    socket.emit({ connections: [], downloadTotal: 5120, uploadTotal: 512 })
    await until(() => document.querySelector('[data-clash-connections]').textContent.includes('会话内已结束1'), 'ended connections were not retained')

    await router.push({ name: 'ClashLogs' })
    const logSocket = await until(() => state.sockets.find(ws => ws.path === '/logs' && ws.readyState === 1), 'logs did not subscribe')
    logSocket.emit({ type: 'warning', payload: 'QA reconnect warning' })
    await until(() => document.querySelector('[data-clash-logs] .log-message')?.textContent.includes('QA reconnect warning'), 'live log missing')
    logSocket.close()
    const retrySocket = await until(() => state.sockets.find(ws => ws !== logSocket && ws.path === '/logs' && ws.readyState === 1), 'log stream did not reconnect')
    retrySocket.emit({ level: 'info', message: 'QA structured log' })
    await until(() => document.querySelector('[data-clash-logs] .log-message')?.textContent.includes('QA structured log'), 'structured log missing after reconnect')
    assert(document.querySelector('[data-clash-logs]').scrollWidth <= document.querySelector('[data-clash-logs]').clientWidth + 1, 'management page overflowed horizontally')

    await router.push({ name: 'ClashRules' })
    await until(() => document.querySelector('.rules-table')?.textContent.includes('rule.example'), 'rules table did not load')
    const providerTab = [...document.querySelectorAll('md-filter-chip')].find(chip => chip.label.startsWith('规则集'))
    providerTab.click()
    const updateProvider = await until(() => [...document.querySelectorAll('md-filled-tonal-button')].find(button => button.textContent.includes('更新规则集')), 'rule provider action missing')
    updateProvider.click()
    await until(() => state.providerUpdated && document.querySelector('.clash-page').textContent.includes('7 条'), 'rule provider did not update')

    await router.push({ name: 'Proxies' })
    const group = await until(() => document.querySelector('[data-clash-proxy-group]'), 'proxy group did not load')
    const nodeButton = [...group.querySelectorAll('.proxy-name')].find(button => button.textContent === 'Node B')
    nodeButton.click()
    await until(() => nodeButton.getAttribute('aria-pressed') === 'true', 'node selection did not update')
    assert(!state.errors.length, 'runtime error: ' + state.errors.join('; '))
    document.body.dataset.reiaTest = 'passed'
  }
  if (location.search.includes('preview=1')) { state.available = true; state.kernel = true; state.enabled = true }
  else check().catch(error => {
    document.body.dataset.reiaTest = 'failed'
    const pre = document.createElement('pre'); pre.id = 'reia-qa-error'; pre.textContent = error.stack + '\n' + JSON.stringify({ errors: state.errors, calls: state.calls.length, body: document.body.innerText.slice(0,500) }); document.body.append(pre)
  })
}

const fontBytes = fs.readFileSync(new URL('../src/assets/material-symbols-outlined.woff2', import.meta.url))
const fontRequests = []
const fontServer = http.createServer((request, response) => {
  fontRequests.push({ url: request.url, origin: request.headers.origin, cookie: request.headers.cookie, referer: request.headers.referer })
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Cache-Control', 'no-store')
  if (request.url.startsWith('/icons.CSS?')) {
    response.setHeader('Content-Type', 'text/css')
    response.end('@font-face{font-family:"Material Symbols Outlined";src:url("/css-icons.woff2") format("woff2")}')
  } else if (request.url.startsWith('/icons.woff2?') || request.url === '/css-icons.woff2') {
    response.setHeader('Content-Type', 'font/woff2')
    response.end(fontBytes)
  } else {
    response.writeHead(404).end()
  }
})
await new Promise(resolve => fontServer.listen(0, '127.0.0.1', resolve))
const fontBase = `http://127.0.0.1:${fontServer.address().port}`
const fontCases = { woff: '/icons.woff2?v=1', css: '/icons.CSS?v=1', missing: '/missing.woff2' }

function checkFont(mode) {
  const test = async () => {
    document.body.dataset.iconFontTest = 'checking'
    const expected = mode === 'missing' ? 'Aether Material Symbols' : 'Material Symbols Outlined'
    for (let attempt = 0; attempt < 110; attempt++) {
      const sample = document.querySelector('.material-symbols-outlined')
      sample.getBoundingClientRect()
      const active = [...document.fonts].some(face => face.family.includes(expected) && face.status === 'loaded')
      if (active && !document.documentElement.hasAttribute('data-icon-font-pending') && !document.querySelector('iframe[sandbox]')) {
        document.body.dataset.iconFontTest = 'passed'
        return
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    document.body.dataset.iconFontTest = 'failed'
    document.body.dataset.fontFamily = getComputedStyle(document.querySelector('.material-symbols-outlined')).fontFamily
    document.body.dataset.fontFaces = [...document.fonts].map(face => face.family + ':' + face.status).join(',')
  }
  document.addEventListener('DOMContentLoaded', test, { once: true })
}

const requests = []
const server = http.createServer((request, response) => {
  requests.push(request.url)
  const url = new URL(request.url, 'http://localhost')
  if (url.pathname.startsWith('/api/')) {
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ status: 'success', data: { name: 'QA', email: 'qa@example.test', balance: 0, commission_balance: 0,
      subscribe_url: 'https://subscription.example/qa', transfer_enable: 10737418240, u: 0, d: 0, expired_at: null, plan: { name: 'QA Plan', transfer_enable: 10 },
      currency_symbol: '¥', app_description: 'QA', app_url: '/' } }))
    return
  }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return }
  const extension = path.extname(file)
  response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2' })[extension] || 'application/octet-stream')
  if (extension === '.html') {
    let html = fs.readFileSync(file, 'utf8')
    const fontMode = url.searchParams.get('fontqa')
    if (Object.hasOwn(fontCases, fontMode)) {
      const externalURL = fontBase + fontCases[fontMode]
      html = html.replace("custom_icon_url: ''", `custom_icon_url: ${JSON.stringify(externalURL)}`)
        .replace(/<script type="module"[^>]*><\/script>/g, '')
        .replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'self' ${fontBase}; connect-src ${fontBase}; font-src 'self' ${fontBase}"><script>(${checkFont.toString()})(${JSON.stringify(fontMode)});</script>`)
        .replace('<div id="app"></div>', '<span class="material-symbols-outlined">dashboard</span>')
      response.end(html)
      return
    }
    html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'self' data: blob:"><script>(${setup.toString()})();</script>`)
    response.end(html)
  } else response.end(fs.readFileSync(file))
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const chrome = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome')
async function browser(extra, name) {
  const args = ['--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--window-size=1440,1080',
    '--user-data-dir=' + path.join(output, name + '-profile'), ...(process.env.CHROME_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), ...extra]
  const child = spawn(chrome, args, { windowsHide: true })
  let stdout = '', stderr = ''
  child.stdout.on('data', bytes => { stdout += bytes }); child.stderr.on('data', bytes => { stderr += bytes })
  const timer = setTimeout(() => child.kill(), 45000)
  await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve) })
  clearTimeout(timer)
  fs.writeFileSync(path.join(output, name + '.html'), stdout)
  fs.writeFileSync(path.join(output, name + '.stderr.txt'), stderr)
  return stdout
}

async function checkFontCases() {
  // Real time lets Chromium finish asynchronous Cache Storage writes between navigations.
  const child = spawn(chrome, ['--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--remote-debugging-port=0',
    '--user-data-dir=' + path.join(output, 'font-tests-profile'),
    ...(process.env.CHROME_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), 'about:blank'], { windowsHide: true })
  const debuggerURL = new Promise((resolve, reject) => {
    let log = ''
    child.stderr.on('data', bytes => {
      log += bytes
      const address = log.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1]
      if (address) resolve(address)
    })
    child.once('error', reject)
    child.once('exit', code => reject(new Error(`Font test browser exited (${code})`)))
  })
  const timeout = setTimeout(() => child.kill(), 30000)
  let socket
  try {
    const address = new URL(await debuggerURL)
    const targets = await (await fetch(`http://${address.host}/json/list`)).json()
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
    let id = 0
    function call(method, params) {
      return new Promise((resolve, reject) => {
        const requestId = ++id
        function receive(event) {
          const data = JSON.parse(event.data)
          if (data.id !== requestId) return
          clearTimeout(requestTimeout)
          socket.removeEventListener('message', receive)
          if (data.error) reject(new Error(data.error.message))
          else resolve(data.result)
        }
        const requestTimeout = setTimeout(() => {
          socket.removeEventListener('message', receive)
          reject(new Error(`Browser font test command timed out (${method})`))
        }, 5000)
        socket.addEventListener('message', receive)
        socket.send(JSON.stringify({ id: requestId, method, params }))
      })
    }
    for (const [mode, cached] of [['woff', false], ['woff', true], ['css', false], ['missing', false]]) {
      const start = requests.length
      const expected = base + '/?fontqa=' + mode + (cached ? '&cached=1' : '')
      await call('Page.navigate', { url: expected })
      const deadline = Date.now() + 6500
      let state
      while (Date.now() < deadline) {
        try {
          const result = await call('Runtime.evaluate', {
            expression: `location.href === ${JSON.stringify(expected)} && document.body?.dataset.iconFontTest`, returnByValue: true,
          })
          state = result.result.value
        } catch { /* The previous document may be replaced while navigating. */ }
        if (state === 'passed' || state === 'failed') break
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      if (mode === 'woff' && !cached) {
        const end = Date.now() + 2000
        let stored = false
        while (!stored && Date.now() < end) {
          const { result } = await call('Runtime.evaluate', {
            expression: `(async () => !!(await (await caches.open('xboard-theme-assets-v1')).match(${JSON.stringify(fontBase + fontCases.woff)})))()`,
            awaitPromise: true, returnByValue: true,
          })
          stored = result.value
          if (!stored) await new Promise(resolve => setTimeout(resolve, 50))
        }
        if (!stored) throw new Error('Browser did not store the validated WOFF2 response')
      }
      const bundled = requests.slice(start).some(request => request.startsWith('/woff2/'))
      if (state !== 'passed' || bundled !== (mode === 'missing')) throw new Error(`Font priority check failed (${mode}, ${state}, bundled=${bundled})`)
    }
  } finally {
    clearTimeout(timeout)
    socket?.close()
    child.kill()
  }
}
try {
  const dom = await browser(['--virtual-time-budget=35000', '--dump-dom', base], 'integration')
  if (!dom.includes('data-reia-test="passed"')) throw new Error(dom.match(/<pre id="reia-qa-error">([\s\S]*?)<\/pre>/)?.[1] || 'Chrome did not complete theme QA; inspect .build/reia-theme-qa')
  const mobile = await browser(['--window-size=420,890', '--virtual-time-budget=35000', '--dump-dom', base + '/?mobile=1'], 'mobile')
  if (!mobile.includes('data-reia-test="passed"')) throw new Error(mobile.match(/<pre id="reia-qa-error">([\s\S]*?)<\/pre>/)?.[1] || 'Chrome did not complete mobile theme QA')
  await browser(['--virtual-time-budget=2500', '--screenshot=' + path.join(output, 'dashboard.png'), base + '/?preview=1'], 'preview')
  await browser(['--window-size=420,890', '--virtual-time-budget=2500', '--screenshot=' + path.join(output, 'dashboard-mobile.png'), base + '/?mobile=1&preview=1'], 'preview-mobile')
  console.log('Desktop and mobile dark DOM: Trace, settings, readiness, connections, logs, rules and proxy selection passed')
  await checkFontCases()
  const downloads = fontRequests.filter(request => request.url.startsWith('/icons.woff2?'))
  if (downloads.length !== 1 || downloads[0].origin !== 'null' || downloads[0].cookie || downloads[0].referer) {
    throw new Error('Sandbox download or cache reuse verification failed')
  }
  console.log('Configured CSS, anonymous sandbox WOFF2 download, cache reuse and bundled fallback passed')
} finally {
  fs.writeFileSync(path.join(output, 'requests.json'), JSON.stringify(requests))
  await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => fontServer.close(resolve))])
}
