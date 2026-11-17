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
  const state = window.reiaQA = { available: false, kernel: true, enabled: false, calls: [], errors: [] }
  // Drive Vue's two-frame route transitions under Chrome virtual time.
  window.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 16)
  window.cancelAnimationFrame = clearTimeout
  window.addEventListener('error', event => { if (event.error) state.errors.push(`${event.error} at ${event.filename}:${event.lineno}:${event.colno}`) })
  window.addEventListener('unhandledrejection', event => state.errors.push(String(event.reason?.stack || event.reason)))
  const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  window.WebSocket = class { readyState = 1; close() { this.readyState = 3; this.onclose?.() } }
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href)
    state.calls.push({ url: url.href, method: options.method || 'GET', body: options.body, headers: options.headers })
    if (url.port === '25500') {
      if (!state.available) throw new TypeError('QA client offline')
      if (url.pathname === '/api/health') return json({ status: 'ok', agent_pid: 101, agent_version: 'QA' })
      if (url.pathname === '/api/handshake') return json({ mihomo_controller: { api_base: 'http://127.0.0.1:9090', secret: 'qa-secret-only' } })
      if (url.pathname === '/api/agent/master') state.enabled = JSON.parse(options.body).enable
      if (url.pathname === '/api/agent/real-status') return json({ mihomo_running: state.kernel, real_tun: false, real_system_proxy: state.enabled, is_actually_intercepting: state.enabled,
        settings: { enabled: state.enabled, use_system_proxy: true, use_tun: false, tun_stack: 'mixed', allow_lan: false, outbound_mode: 'rule', geo_low_memory: true, update_interval_hours: 24 } })
      if (url.pathname === '/api/system/status') return json({ core_service_supported: true, core_service_registration: { installed: false }, core_service_ready: false })
      if (url.pathname === '/api/subscription/status') return json({ has_url: true, refreshing: false, last_success_at: 1700000000, refresh_interval_hours: 12 })
      if (url.pathname === '/api/core/proxies') return json({ proxies: { 'QA Plan': { type: 'Selector', all: ['Node A', 'Node B'], now: 'Node A' }, 'Node A': { type: 'Direct' } }, group_order: ['QA Plan'] })
      if (url.pathname === '/api/core/connections') return json({ connections: [], uploadTotal: 0, downloadTotal: 0 })
      return json({ success: true })
    }
    if (url.port === '9090') {
      if (url.pathname === '/version') return json({ version: 'QA' })
      if (url.pathname === '/configs') return json({ mode: 'rule', 'mixed-port': 7890 })
      return json({ delay: 10 })
    }
    return json({ ip: '192.0.2.1', country_code: 'US', country: 'US', countryCode: 'US', connection: { isp: 'QA' } })
  }
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const check = async () => {
    for (let attempt = 0; attempt < 30 && !document.querySelector('#app')?.children.length; attempt++) await sleep(100)
    await sleep(1200)
    assert(!document.querySelector('[data-reia-console]'), 'client console visible while Agent is absent')
    assert(document.body.textContent.includes('快速接入节点') && document.body.textContent.includes('QA Plan'), 'original subscription/import cards missing')
    assert(!state.calls.some(call => new URL(call.url).port === '9090'), 'probed an unrelated Clash core before detecting Agent')
    state.available = true
    await sleep(5500)
    await sleep(100)
    assert(document.querySelector('[data-reia-console]'), 'console did not appear after late Agent startup')
    assert(document.querySelector('[data-reia-master]').getAttribute('aria-checked') === 'false', 'paused client must still display its console')
    assert(document.body.textContent.toUpperCase().includes('PAUSED'), 'untouched subscription card displayed a paused master as running')
    const pairing = state.calls.filter(call => call.url.endsWith('/api/handshake')).at(-1)
    assert(JSON.parse(pairing.body).panel_url === location.href, 'real obfuscated theme URL was not paired')
    assert(state.calls.some(call => call.url.endsWith('/api/subscription/url') && JSON.parse(call.body).url === 'https://subscription.example/qa'), 'automatic subscription push missing')
    document.querySelector('[data-reia-master]').click()
    await sleep(300)
    assert(state.calls.some(call => call.url.endsWith('/api/agent/master') && JSON.parse(call.body).enable), 'homepage switch bypassed Agent master API')
    assert(!state.calls.some(call => new URL(call.url).port === '9090' && call.method !== 'GET'), 'managed setting was written directly to core')
    state.available = false
    await sleep(5500)
    assert(!document.querySelector('[data-reia-console]'), 'disconnected client card remained visible')
    assert(document.body.textContent.includes('快速接入节点') && document.body.textContent.includes('QA Plan'), 'disconnect removed other cards')
    state.available = true; state.kernel = false
    await sleep(5500)
    assert(document.querySelector('[data-reia-console]'), 'Agent with unavailable kernel was hidden')
    const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router
    router.onError(error => state.errors.push(String(error.stack || error)))
    const manual = [...document.querySelectorAll('[data-reia-console] a')].find(el => el.textContent.includes('手动安装'))
    manual.click()
    for (let attempt = 0; attempt < 80 && !document.querySelector('#reia-subscription-url'); attempt++) await sleep(100)
    const input = document.querySelector('#reia-subscription-url')
    assert(input, 'manual subscription fallback page missing; route=' + router.currentRoute.value.fullPath)
    input.value = 'https://subscription.example/manual'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await sleep(300)
    assert(state.calls.some(call => call.url.endsWith('/api/subscription/url') && JSON.parse(call.body).url.endsWith('/manual')), 'manual subscription was not sent')
    assert(!state.errors.length, 'runtime error: ' + state.errors.join('; '))
    document.body.dataset.reiaTest = 'passed'
  }
  if (location.search.includes('preview=1')) state.available = true
  else check().catch(error => {
    document.body.dataset.reiaTest = 'failed'
    const pre = document.createElement('pre'); pre.id = 'reia-qa-error'; pre.textContent = error.stack + '\n' + JSON.stringify({ errors: state.errors, calls: state.calls.length, body: document.body.innerText.slice(0,500) }); document.body.append(pre)
  })
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
  response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' })[extension] || 'application/octet-stream')
  if (extension === '.html') {
    let html = fs.readFileSync(file, 'utf8')
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
try {
  const dom = await browser(['--virtual-time-budget=35000', '--dump-dom', base], 'integration')
  if (!dom.includes('data-reia-test="passed"')) throw new Error(dom.match(/<pre id="reia-qa-error">([\s\S]*?)<\/pre>/)?.[1] || 'Chrome did not complete theme QA; inspect .build/reia-theme-qa')
  await browser(['--virtual-time-budget=2500', '--screenshot=' + path.join(output, 'dashboard.png'), base + '/?preview=1'], 'preview')
  console.log('Theme DOM: hidden/late detection/reconnect, Agent master switch, automatic subscription, manual fallback and original cards passed')
} finally { fs.writeFileSync(path.join(output, 'requests.json'), JSON.stringify(requests)); await new Promise(resolve => server.close(resolve)) }
