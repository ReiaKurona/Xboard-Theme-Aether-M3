import { defineStore } from 'pinia'
import { ref, computed, watch, type WatchStopHandle } from 'vue'
import { clashApi } from '../api/clash'
import { reiaApi, type ReiaStatus, type SubscriptionStatus } from '../api/reia'
import { api } from '../api/client'
import { useUserStore } from './user'
import { fetchFastestOutboundIp, type OutboundGeoIp } from '../utils/geoip'
import { ReiaSubscriptionSync } from '../utils/reiaSubscriptionSync'

export const useClashStore = defineStore('clash', () => {
  const isConnected = ref(false) // Agent availability, independent of proxy state.
  const isEnabled = ref(false), isProbing = ref(false), kernelReady = ref(false), operationBusy = ref(false)
  const lastError = ref(''), subscriptionError = ref(''), coreVersion = ref('')
  const status = ref<ReiaStatus | null>(null), systemStatus = ref<any>(null)
  const subscriptionStatus = ref<SubscriptionStatus | null>(null)
  const endpoint = ref(reiaApi.coreBase), secret = ref('')
  const config = ref<any>(null), proxies = ref<Record<string, any>>({}), groupOrder = ref<string[]>([])
  const nodeDelays = ref<Record<string, number>>({})
  const activeConnectionsCount = ref(0), memoryInUse = ref(0), totalUpload = ref(0), totalDownload = ref(0)
  const trafficHistory = ref<Array<{ up: number; down: number }>>([]), traffic = ref({ up: 0, down: 0 })
  const outboundIpInfo = ref<OutboundGeoIp>({ ip: '127.0.0.1', countryCode: 'UN', isp: '本地回环', typeCn: '直连网络', qualityCn: '本地链路' })
  const runtimeFormatted = ref('00:00:00')
  let startedAt = 0, active = false, probeEpoch = 0
  let discoveryTimer: ReturnType<typeof setTimeout> | undefined, syncTimer: ReturnType<typeof setInterval> | undefined
  let trafficWs: WebSocket | null = null, memoryWs: WebSocket | null = null
  let abort: AbortController | undefined, probe: Promise<boolean> | null = null
  let stopSubscriptionWatch: WatchStopHandle | undefined
  const refreshOutboundIp = async () => { if (active) outboundIpInfo.value = await fetchFastestOutboundIp() }
  const stopStreams = () => {
    trafficWs?.close(); memoryWs?.close(); trafficWs = null; memoryWs = null
    traffic.value = { up: 0, down: 0 }; memoryInUse.value = 0; activeConnectionsCount.value = 0
  }
  const startStreams = () => {
    if (!kernelReady.value) return
    if (!trafficWs) {
      const ws = clashApi.createClashWebSocket('traffic'); trafficWs = ws
      ws.onmessage = event => { try {
        const sample = JSON.parse(event.data); traffic.value = sample; trafficHistory.value.push(sample)
        if (trafficHistory.value.length > 30) trafficHistory.value.shift()
      } catch {} }
      ws.onclose = () => { if (trafficWs === ws) trafficWs = null }; ws.onerror = () => ws.close()
    }
    if (!memoryWs) {
      const ws = clashApi.createMemoryWebSocket(data => { memoryInUse.value = data.inuse || 0 }); memoryWs = ws
      ws.onclose = () => { if (memoryWs === ws) memoryWs = null }; ws.onerror = () => ws.close()
    }
  }
  const subscriptionSync = new ReiaSubscriptionSync({
    connected: () => isConnected.value, auth: () => localStorage.getItem('auth_data') || '',
    loadURL: async () => {
      const owner = localStorage.getItem('auth_data'), sub: any = await api.get('/user/getSubscribe')
      if (owner !== localStorage.getItem('auth_data')) return ''
      useUserStore().subscribeInfo = sub
      return sub?.subscribe_url || ''
    },
    push: async url => {
      if (operationBusy.value) throw new Error('busy')
      await reiaApi.agent('/api/subscription/url', 'POST', { url })
      subscriptionStatus.value = await reiaApi.agent('/api/subscription/status')
    }, error: message => { subscriptionError.value = message },
  })
  const refreshState = async (expectedEpoch = probeEpoch) => {
    const [current, system, subscription] = await Promise.all([
      reiaApi.agent<ReiaStatus>('/api/agent/real-status', 'GET', undefined, abort?.signal),
      reiaApi.agent('/api/system/status', 'GET', undefined, abort?.signal),
      reiaApi.agent<SubscriptionStatus>('/api/subscription/status', 'GET', undefined, abort?.signal).catch(() => null),
    ])
    if (!active || expectedEpoch !== probeEpoch) return
    status.value = current; systemStatus.value = system; subscriptionStatus.value = subscription
    isEnabled.value = current.settings.enabled; kernelReady.value = current.mihomo_running; lastError.value = current.last_error || ''
    // The untouched legacy subscription card derives its pause display from
    // config.mode. Present effective direct traffic while master is paused;
    // saved mode selectors use status.settings.outbound_mode independently.
    config.value = { ...config.value, mode: current.settings.enabled ? current.settings.outbound_mode : 'direct', 'allow-lan': current.settings.allow_lan, tun: { enable: current.real_tun } }
    if (current.mihomo_running) {
      const [cfg, nodes, version, connections] = await Promise.allSettled([clashApi.getConfigsAPI(), clashApi.fetchProxiesAPI(), clashApi.fetchClashVersion(), clashApi.fetchConnectionsAPI()])
      if (!active || expectedEpoch !== probeEpoch) return
      if (cfg.status === 'fulfilled') config.value = { ...cfg.value.data, mode: current.settings.enabled ? cfg.value.data.mode : 'direct' }
      if (nodes.status === 'fulfilled') { proxies.value = nodes.value.data.proxies || {}; groupOrder.value = nodes.value.data.group_order || [] }
      if (version.status === 'fulfilled') coreVersion.value = version.value.data.version
      if (connections.status === 'fulfilled') {
        activeConnectionsCount.value = connections.value.data.connections?.length || 0
        totalUpload.value = connections.value.data.uploadTotal || 0; totalDownload.value = connections.value.data.downloadTotal || 0
      }
      startStreams()
    } else { stopStreams(); proxies.value = {}; coreVersion.value = '' }
  }
  const checkConnection = (force = false): Promise<boolean> => {
    if (probe && !force) return probe
    if (force) { abort?.abort(); abort = new AbortController(); probe = null }
    if (!active) { active = true; abort = new AbortController() }
    const epoch = ++probeEpoch
    isProbing.value = true
    probe = (async () => {
      try {
        const previousSecret = reiaApi.secret
        const previousPID = reiaApi.agentPID
        await reiaApi.connect(abort?.signal)
        if (!active || epoch !== probeEpoch) return false
        if (previousSecret !== reiaApi.secret) stopStreams()
        secret.value = reiaApi.secret
        const first = !isConnected.value || previousPID !== reiaApi.agentPID
        isConnected.value = true
        if (first) { startedAt = Date.now(); subscriptionSync.reset(); void subscriptionSync.tick(true); void refreshOutboundIp() }
        try { await refreshState(epoch) } catch (error: any) { if (epoch === probeEpoch) lastError.value = error.message }
        const seconds = Math.floor((Date.now() - startedAt) / 1000)
        runtimeFormatted.value = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':')
        return true
      } catch {
        if (epoch !== probeEpoch) return false
        isConnected.value = false; kernelReady.value = false; isEnabled.value = false
        reiaApi.disconnect(); secret.value = ''; stopStreams(); config.value = null; proxies.value = {}; status.value = null
        return false
      } finally { if (epoch === probeEpoch) { isProbing.value = false; probe = null } }
    })()
    return probe
  }
  const tick = async () => { await checkConnection(); if (active) discoveryTimer = setTimeout(tick, 5000) }
  const onVisible = () => { if (document.visibilityState === 'visible') { void checkConnection(); void subscriptionSync.tick() } }
  const init = () => {
    if (syncTimer) return
    active = true; abort = new AbortController(); document.addEventListener('visibilitychange', onVisible)
    stopSubscriptionWatch = watch(() => useUserStore().subscribeInfo?.subscribe_url, (next, previous) => {
      if (next && next !== previous) void subscriptionSync.tick(true)
    })
    syncTimer = setInterval(() => void subscriptionSync.tick(), 60000); void tick()
  }
  const stop = () => {
    ++probeEpoch; probe = null
    active = false; clearTimeout(discoveryTimer); clearInterval(syncTimer); syncTimer = undefined
    abort?.abort(); subscriptionSync.reset(); reiaApi.disconnect(); secret.value = ''; stopStreams(); isConnected.value = false; kernelReady.value = false
    document.removeEventListener('visibilitychange', onVisible)
    stopSubscriptionWatch?.(); stopSubscriptionWatch = undefined
  }
  const runOperation = async (path: string, body?: unknown) => {
    if (operationBusy.value) return
    operationBusy.value = true; lastError.value = ''
    try { const result = await reiaApi.agent(path, 'POST', body); await refreshState(); return result }
    catch (error: any) { lastError.value = error.message; throw error }
    finally { operationBusy.value = false }
  }
  const connectByUser = () => checkConnection(true)
  const changeMode = async (mode: 'rule' | 'global' | 'direct') => { await runOperation('/api/agent/settings', { outbound_mode: mode }); void refreshOutboundIp() }
  const toggleProxyPause = async () => {
    if (status.value?.settings.enabled && status.value.settings.outbound_mode === 'direct') await changeMode('rule')
    else await setEnabled(!status.value?.settings.enabled)
  }
  const setEnabled = async (enabled: boolean) => { await runOperation('/api/agent/master', { enable: enabled }); void refreshOutboundIp() }
  const toggleController = async (enabled: boolean) => { await setEnabled(enabled) }
  const selectNode = async (group: string, node: string) => { await runOperation('/api/core/select', { group, node }); if (proxies.value[group]) proxies.value[group].now = node; void refreshOutboundIp() }
  const testNodeDelay = async (node: string) => {
    try { nodeDelays.value[node] = (await clashApi.fetchProxyLatencyAPI(node)).data.delay } catch { nodeDelays.value[node] = 0 }
    return nodeDelays.value[node]
  }
  const orderedGroups = computed(() => {
    const entries = Object.entries(proxies.value).filter(([, group]) => group.all?.length)
    const mode = status.value?.settings.outbound_mode || 'rule'
    if (mode === 'direct') return []
    const title = String((window as any).settings?.title || '').toLowerCase()
    return entries.filter(([name]) => mode === 'global' || name !== 'GLOBAL').sort(([a], [b]) => {
      if (mode === 'global' && (a === 'GLOBAL' || b === 'GLOBAL')) return a === 'GLOBAL' ? -1 : 1
      if (title && (a.toLowerCase() === title || b.toLowerCase() === title)) return a.toLowerCase() === title ? -1 : 1
      const rank = (name: string) => { const index = groupOrder.value.indexOf(name); return index < 0 ? 99999 : index }
      return rank(a) - rank(b)
    })
  })
  const primaryProxyGroup = computed(() => {
    const entry = orderedGroups.value.find(([, group]) => group.type === 'Selector') || orderedGroups.value[0]
    return entry ? { ...entry[1], name: entry[0] } : null
  })
  return { isConnected, isEnabled, isProbing, kernelReady, operationBusy, lastError, subscriptionError, status, systemStatus, subscriptionStatus,
    endpoint, secret, coreVersion, config, proxies, groupOrder, orderedGroups, nodeDelays, activeConnectionsCount, memoryInUse,
    totalUpload, totalDownload, trafficHistory, traffic, outboundIpInfo, runtimeFormatted, primaryProxyGroup,
    init, stop, checkConnection, connectByUser, refreshState, runOperation, setEnabled, toggleController, toggleProxyPause, changeMode, selectNode, testNodeDelay, refreshOutboundIp }
})
