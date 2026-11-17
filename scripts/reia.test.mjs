import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import ts from 'typescript'

async function load(file) {
  const source = fs.readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } })
  return import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'))
}
const { ReiaApi } = await load('api/reia.ts')
const { ReiaSubscriptionSync, WEB_SUBSCRIPTION_INTERVAL } = await load('utils/reiaSubscriptionSync.ts')
const json = (data, status = 200) => new Response(JSON.stringify(data), { status })
globalThis.window = { location: { href: 'https://theme.example/account#/actual-route' } }

test('detects Agent identity, pairs the real full URL and keeps credentials in memory', async () => {
  const calls = []
  const client = new ReiaApi(async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/api/health')) return json({ status: 'ok', agent_version: 'test', agent_pid: 42 })
    if (url.endsWith('/api/handshake')) return json({ mihomo_controller: { api_base: 'http://127.0.0.1:9090', secret: 'fake-controller' } })
    return json({ success: true })
  })
  await client.connect()
  assert.deepEqual(JSON.parse(calls[1].options.body), { panel_origin: 'https://theme.example', panel_url: window.location.href })
  assert.equal(calls[1].options.headers.Authorization, undefined)
  await client.core('/version')
  assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer fake-controller')
  await client.agent('/api/agent/master', 'POST', { enable: true })
  assert.equal(calls.at(-1).options.headers.Authorization, undefined)
  client.disconnect()
  await assert.rejects(client.core('/version'), /尚未连接/)
  await assert.rejects(client.agent('//example.com/path'), /无效/)
})

test('a plain Clash controller is not detected as ReiaClash; failed writes are not replayed', async () => {
  let attempts = 0
  const notAgent = new ReiaApi(async () => json({ version: 'mihomo' }))
  await assert.rejects(notAgent.connect(), /不是 ReiaClash/)
  const client = new ReiaApi(async () => { attempts++; throw new Error('offline') })
  await assert.rejects(client.agent('/api/subscription/url', 'POST', { url: 'https://subscription.example/' }))
  assert.equal(attempts, 1)
})

test('pushes on discovery, every four hours, and immediately when the URL rotates', async () => {
  let connected = false, now = 100000, url = 'https://subscription.example/first'
  const pushes = []
  const sync = new ReiaSubscriptionSync({ connected: () => connected, auth: () => 'account-A', now: () => now,
    loadURL: async () => url, push: async value => pushes.push(value), error() {} })
  await sync.tick(); assert.equal(pushes.length, 0)
  connected = true
  await sync.tick(); await sync.tick(); assert.equal(pushes.length, 1)
  now += WEB_SUBSCRIPTION_INTERVAL - 1
  await sync.tick(); assert.equal(pushes.length, 1)
  now++; url = 'https://subscription.example/latest'
  await sync.tick(); assert.equal(pushes.at(-1), url)
  url = 'https://subscription.example/rotated'
  await sync.tick(true); assert.equal(pushes.at(-1), url)
  await sync.tick(true); assert.equal(pushes.length, 3)
})

test('account switch and unmount discard stale subscription responses', async () => {
  let auth = 'A', finish
  const pushes = []
  const sync = new ReiaSubscriptionSync({ connected: () => true, auth: () => auth,
    loadURL: () => new Promise(resolve => { finish = resolve }), push: async value => pushes.push(value), error() {} })
  const pending = sync.tick(); auth = 'B'; finish('https://subscription.example/A'); await pending
  assert.equal(pushes.length, 0)
  const pending2 = sync.tick(); sync.reset(); finish('https://subscription.example/B'); await pending2
  assert.equal(pushes.length, 0)
})

test('failed automatic sync retries after one minute without exposing a credential URL', async () => {
  let now = 100000, fail = true, attempts = 0, message = ''
  const sync = new ReiaSubscriptionSync({ connected: () => true, auth: () => 'A', now: () => now,
    loadURL: async () => 'https://subscription.example/?token=private', push: async () => { attempts++; if (fail) throw new Error('private') },
    error: value => { message = value } })
  await sync.tick(); await sync.tick(); assert.equal(attempts, 1); assert.ok(!message.includes('private'))
  fail = false; now += 60000; await sync.tick(); assert.equal(attempts, 2); assert.equal(message, '')
})

test('a rotated URL arriving during a push is pushed after the previous write completes', async () => {
  let url = 'https://subscription.example/old', release
  const pushes = []
  const sync = new ReiaSubscriptionSync({ connected: () => true, auth: () => 'A', loadURL: async () => url,
    push: async value => { pushes.push(value); if (pushes.length === 1) await new Promise(resolve => { release = resolve }) }, error() {} })
  const first = sync.tick()
  await new Promise(setImmediate)
  url = 'https://subscription.example/latest'
  await sync.tick(true)
  release(); await first; await new Promise(setImmediate)
  assert.deepEqual(pushes, ['https://subscription.example/old', 'https://subscription.example/latest'])
})

test('original subscription and other-client import cards remain byte-for-byte unchanged', () => {
  for (const [file, hash] of [
    ['SubscriptionCard.vue', 'F3EAB5FB4E099ED0E01DD5C24259F5D18F6AE412B57B13989CDB3BBB35527310'],
    ['ClientConfigCard.vue', 'B8AE779E45D57D9CBB0BB09A27C34F3C3C69BDE21E46434F9E4194A26303C93F'],
  ]) {
    const bytes = fs.readFileSync(new URL('../src/components/dashboard/' + file, import.meta.url))
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(), hash)
  }
})
