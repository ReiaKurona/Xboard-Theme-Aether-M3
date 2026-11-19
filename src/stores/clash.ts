import { defineStore } from 'pinia'
import { ref, computed, watch, type WatchStopHandle } from 'vue'
import { clashApi } from '../api/clash'
import { reiaApi, ReiaError, type ReiaSettings, type ReiaStatus, type ReiaSystemStatus, type SubscriptionStatus } from '../api/reia'
import { api } from '../api/client'
import { useUserStore } from './user'
import { fetchOutboundIpFromBrowser, parseOutboundIp, type OutboundGeoIp } from '../utils/geoip'
import { ReiaSubscriptionSync } from '../utils/reiaSubscriptionSync'

export const useClashStore = defineStore('clash', () => {
  const isConnected = ref(false) // Agent availability, independent of proxy state.
  const isEnabled = ref(false), isProbing = ref(false), kernelReady = ref(false), operationBusy = ref(false)
  const lastError = ref(''), operationError = ref(''), subscriptionError = ref(''), coreVersion = ref('')
  const status = ref<ReiaStatus | null>(null), systemStatus = ref<ReiaSystemStatus | null>(null)
  const subscriptionStatus = ref<SubscriptionStatus | null>(null)
  const endpoint = ref(reiaApi.coreBase), secret = ref('')
  const config = ref<any>(null), proxies = ref<Record<string, any>>({}), groupOrder = ref<string[]>([])
  const nodeDelays = ref<Record<string, number>>({})
  const activeConnectionsCount = ref(0), memoryInUse = ref(0), totalUpload = ref(0), totalDownload = ref(0)
  const trafficHistory = ref<Array<{ up: number; down: number }>>([]), traffic = ref({ up: 0, down: 0 })
  const outboundIpInfo = ref<OutboundGeoIp | null>(null)
  const outboundIpLoading = ref(false)
  const runtimeFormatted = ref('00:00:00')
  let startedAt = 0, active = false, probeEpoch = 0, nextDiscovery = 0
  let stateRequest: AbortController | undefined, detailRequest: AbortController | undefined
  let deferStatusReads = false
  let discoveryTimer: ReturnType<typeof setTimeout> | undefined, syncTimer: ReturnType<typeof setInterval> | undefined
  let trafficWs: WebSocket | null = null, memoryWs: WebSocket | null = null
  let abort: AbortController | undefined, probe: Promise<boolean> | null = null
  let stopSubscriptionWatch: WatchStopHandle | undefined
  let ipRequest: AbortController | undefined, ipRefreshAfter = 0, ipRoute = '', agentOutboundIp = false
  const clearOutboundIp = () => {
    ipRequest?.abort(); ipRequest = undefined; ipRoute = ''; ipRefreshAfter = 0
    outboundIpLoading.value = false; outboundIpInfo.value = null
  }
  const refreshOutboundIp = async () => {
    if (!active || !isConnected.value) return
    ipRequest?.abort()
    const request = new AbortController()
    ipRequest = request
    outboundIpLoading.value = true
    try {
      const info = agentOutboundIp
        ? parseOutboundIp(await reiaApi.agent('/api/agent/outbound-ip', 'GET', undefined, request.signal))
        : await fetchOutboundIpFromBrowser(request.signal)
      if (ipRequest === request) {
        outboundIpInfo.value = info
        ipRefreshAfter = Date.now() + 60_000
      }
    } catch {
      if (ipRequest === request) {
        outboundIpInfo.value = null
        ipRefreshAfter = Date.now() + 5_000
      }
    } finally {
      if (ipRequest === request) { ipRequest = undefined; outboundIpLoading.value = false }
    }
  }
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
      await runOperation('/api/subscription/url', { url }, false)
    }, error: message => { subscriptionError.value = message },
  })
  const refreshDetails = (force = false) => {
    if (detailRequest && !force) return
    detailRequest?.abort()
    const request = new AbortController()
    detailRequest = request
    const tasks: Promise<unknown>[] = []
    const read = <T,>(result: Promise<T>, apply: (data: T) => void) => {
      tasks.push(result.then(data => {
        if (active && detailRequest === request) apply(data)
      }).catch(() => undefined))
    }
    read(reiaApi.agent<ReiaSystemStatus>('/api/system/status', 'GET', undefined, request.signal), value => { systemStatus.value = value })
    read(reiaApi.agent<SubscriptionStatus>('/api/subscription/status', 'GET', undefined, request.signal), value => { subscriptionStatus.value = value })
    if (kernelReady.value) {
      read(clashApi.getConfigsAPI(request.signal), ({ data }) => {
        if (kernelReady.value) config.value = { ...data, mode: status.value?.settings.enabled ? data.mode : 'direct' }
      })
      read(clashApi.fetchProxiesAPI(request.signal), ({ data }) => {
        if (kernelReady.value) {
          proxies.value = data.proxies || {}
          groupOrder.value = data.group_order || []
        }
      })
      read(clashApi.fetchClashVersion(request.signal), ({ data }) => { if (kernelReady.value) coreVersion.value = data.version })
      read(clashApi.fetchConnectionsAPI(request.signal), ({ data }) => {
        if (kernelReady.value) {
          activeConnectionsCount.value = data.connections?.length || 0
          totalUpload.value = data.uploadTotal || 0
          totalDownload.value = data.downloadTotal || 0
        }
      })
    }
    void Promise.all(tasks).finally(() => { if (detailRequest === request) detailRequest = undefined })
  }
  const refreshState = async (force = false, refreshIp = false) => {
    if (!active || !isConnected.value || (deferStatusReads && !force)) return
    stateRequest?.abort()
    const request = new AbortController()
    stateRequest = request
    try {
      const current = await reiaApi.agent<ReiaStatus>('/api/agent/real-status', 'GET', undefined, request.signal)
      if (!active || stateRequest !== request) return
      const readinessChanged = kernelReady.value !== current.mihomo_running
      status.value = current
      isEnabled.value = current.settings.enabled
      kernelReady.value = current.mihomo_running
      lastError.value = current.last_error || ''
      const route = JSON.stringify([current.settings.enabled, current.actual_mode || current.settings.outbound_mode,
        current.mihomo_running, current.real_system_proxy, current.real_tun, current.real_tun_device, current.settings.tun_stack])
      if (ipRoute !== route || refreshIp) {
        ipRoute = route
        outboundIpInfo.value = null
        void refreshOutboundIp()
      } else if (!ipRequest && document.visibilityState !== 'hidden' && Date.now() >= ipRefreshAfter) {
        void refreshOutboundIp()
      }
      config.value = { ...config.value, mode: current.settings.enabled ? current.settings.outbound_mode : 'direct',
        'allow-lan': current.settings.allow_lan, tun: { enable: current.real_tun } }
      if (kernelReady.value) {
        try { startStreams() } catch { stopStreams() }
      } else {
        stopStreams()
        proxies.value = {}
        groupOrder.value = []
        coreVersion.value = ''
      }
      refreshDetails(force || readinessChanged)
      const seconds = Math.floor((Date.now() - startedAt) / 1000)
      runtimeFormatted.value = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':')
    } catch (error) {
      if (stateRequest === request && !request.signal.aborted) lastError.value = (error as Error).message
    } finally {
      if (stateRequest === request) stateRequest = undefined
    }
  }
  const cancelStatusReads = () => {
    stateRequest?.abort()
    detailRequest?.abort()
    stateRequest = undefined
    detailRequest = undefined
  }
  const clearSession = () => {
    cancelStatusReads()
    stopStreams()
    clearOutboundIp()
    status.value = null
    systemStatus.value = null
    subscriptionStatus.value = null
    config.value = null
    proxies.value = {}
    groupOrder.value = []
    nodeDelays.value = {}
    coreVersion.value = ''
    kernelReady.value = false
    isEnabled.value = false
    lastError.value = ''
    trafficHistory.value = []
    totalUpload.value = 0
    totalDownload.value = 0
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
        const session = await reiaApi.connect(abort?.signal)
        if (!active || epoch !== probeEpoch) return false
        const first = !isConnected.value || previousPID !== reiaApi.agentPID || previousSecret !== reiaApi.secret
        if (first) {
          clearSession()
          startedAt = Date.now()
          subscriptionSync.reset()
        }
        secret.value = reiaApi.secret
        isConnected.value = true
        agentOutboundIp = session.features?.includes('outbound_ip_trace') === true
        nextDiscovery = Date.now() + 5000
        await refreshState()
        if (first && epoch === probeEpoch) void subscriptionSync.tick(true)
        return true
      } catch {
        if (epoch !== probeEpoch) return false
        isConnected.value = false
        nextDiscovery = Date.now() + 5000
        reiaApi.disconnect()
        secret.value = ''
        clearSession()
        return false
      } finally { if (epoch === probeEpoch) { isProbing.value = false; probe = null } }
    })()
    return probe
  }
  let fastRefreshUntil = 0
  const scheduleTick = (delay: number) => {
    clearTimeout(discoveryTimer)
    if (active) discoveryTimer = setTimeout(tick, delay)
  }
  const tick = async () => {
    if (Date.now() >= nextDiscovery) await checkConnection()
    else await refreshState()
    const fast = isConnected.value && document.visibilityState !== 'hidden' &&
      (!kernelReady.value || Date.now() < fastRefreshUntil)
    scheduleTick(fast ? 850 : 5000)
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') { nextDiscovery = 0; scheduleTick(0); void subscriptionSync.tick() }
  }
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
    abort?.abort(); subscriptionSync.reset(); reiaApi.disconnect(); secret.value = ''; isConnected.value = false
    nextDiscovery = 0; fastRefreshUntil = 0; operationError.value = ''; clearSession()
    document.removeEventListener('visibilitychange', onVisible)
    stopSubscriptionWatch?.(); stopSubscriptionWatch = undefined
  }
  const runMutation = async <T,>(task: () => Promise<T>, refresh = false, refreshIp = false): Promise<T> => {
    if (!isConnected.value) throw new ReiaError('ReiaClash 尚未连接', 'not_connected')
    if (operationBusy.value) throw new ReiaError('上一项客户端操作尚未完成', 'operation_in_progress')
    const session = reiaApi.agentPID
    operationBusy.value = true
    operationError.value = ''
    if (refresh) {
      deferStatusReads = true
      cancelStatusReads()
    }
    try {
      const result = await task()
      if (active && session === reiaApi.agentPID && refresh) {
        await refreshState(true, refreshIp)
        fastRefreshUntil = Date.now() + 8000
        scheduleTick(600)
      }
      return result
    } catch (error) {
      if (active && session === reiaApi.agentPID) {
        operationError.value = (error as Error).message
        if (refresh) void refreshState(true)
      }
      throw error
    } finally {
      deferStatusReads = false
      operationBusy.value = false
    }
  }
  const runOperation = (path: string, body?: unknown, refresh = true) => runMutation(async () => {
    const session = reiaApi.agentPID
    const result = await reiaApi.agent<{ settings?: ReiaSettings; restart_requested?: boolean }>(path, 'POST', body)
    if (!active || session !== reiaApi.agentPID) return result
    if (result?.settings && status.value) status.value = { ...status.value, settings: result.settings }
    if (path === '/api/core/restart' || path === '/api/agent/upgrade' || result?.restart_requested) {
      kernelReady.value = false
      stopStreams()
    }
    if (!refresh) refreshDetails(true)
    return result
  }, refresh, path === '/api/core/select')
  const connectByUser = () => checkConnection(true)
  const changeMode = async (mode: 'rule' | 'global' | 'direct') => { await runOperation('/api/agent/settings', { outbound_mode: mode }) }
  const toggleProxyPause = async () => {
    if (status.value?.settings.enabled && status.value.settings.outbound_mode === 'direct') await changeMode('rule')
    else await setEnabled(!status.value?.settings.enabled)
  }
  const setEnabled = async (enabled: boolean) => { await runOperation('/api/agent/master', { enable: enabled }) }
  const toggleController = async (enabled: boolean) => { await setEnabled(enabled) }
  const selectNode = async (group: string, node: string) => { await runOperation('/api/core/select', { group, node }) }
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
  return { isConnected, isEnabled, isProbing, kernelReady, operationBusy, lastError, operationError, subscriptionError, status, systemStatus, subscriptionStatus,
    endpoint, secret, coreVersion, config, proxies, groupOrder, orderedGroups, nodeDelays, activeConnectionsCount, memoryInUse,
    totalUpload, totalDownload, trafficHistory, traffic, outboundIpInfo, outboundIpLoading, runtimeFormatted, primaryProxyGroup,
    init, stop, checkConnection, connectByUser, refreshState, runMutation, runOperation, setEnabled, toggleController, toggleProxyPause, changeMode, selectNode, testNodeDelay, refreshOutboundIp }
})
