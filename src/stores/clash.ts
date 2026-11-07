import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { clashApi } from '../api/clash'
import { fetchFastestOutboundIp, type OutboundGeoIp } from '../utils/geoip'

export const useClashStore = defineStore('clash', () => {
  const settings = (window as any).settings || {}
  const defaultSecret = settings.clash_api_secret || ''
  const defaultEndpoint = settings.clash_api_endpoint || 'http://127.0.0.1:9090'

  const isEnabled = ref(localStorage.getItem('clash_controller_enabled') !== 'false')
  const endpoint = ref(localStorage.getItem('clash_controller_endpoint') || defaultEndpoint)
  const secret = ref(localStorage.getItem('clash_controller_secret') || defaultSecret)

  const isConnected = ref(false)
  const isProbing = ref(false)
  const coreVersion = ref('')
  const config = ref<any>(null)
  const proxies = ref<Record<string, any>>({})
  const nodeDelays = ref<Record<string, number>>({})

  // 🌟 Zashboard 核心监控数据 (连接数、内存占用、累计总流量)
  const activeConnectionsCount = ref(0)
  const memoryInUse = ref(0) // 字节
  const totalUpload = ref(0)
  const totalDownload = ref(0)

  // 🌟 实时网速时序队列表 (保留最近 30 个点，绘制波形走势图)
  const trafficHistory = ref<Array<{ up: number; down: number }>>([])
  const traffic = ref({ up: 0, down: 0 })

  const outboundIpInfo = ref<OutboundGeoIp>({
    ip: '127.0.0.1',
    countryCode: 'UN',
    isp: '本地回环',
    typeCn: '直连网络',  // 👈 修正为 typeCn
    qualityCn: '本地链路' // 👈 修正为 qualityCn
  })

  const connectedStartTime = ref<number>(Date.now())
  const runtimeFormatted = ref('00:00:00')
  let runtimeTimer: any = null
  let trafficWs: WebSocket | null = null
  let memoryWs: WebSocket | null = null
  let connTimer: any = null

  const updateRuntime = () => {
    if (!isConnected.value) {
      runtimeFormatted.value = '00:00:00'
      return
    }
    const sec = Math.floor((Date.now() - connectedStartTime.value) / 1000)
    const h = String(Math.floor(sec / 3600)).padStart(2, '0')
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
    const s = String(sec % 60).padStart(2, '0')
    runtimeFormatted.value = `${h}:${m}:${s}`
  }

  const refreshOutboundIp = async () => {
    const info = await fetchFastestOutboundIp()
    outboundIpInfo.value = info
  }

  const testNodeDelay = async (nodeName: string) => {
    try {
      const res = await clashApi.fetchProxyLatencyAPI(nodeName)
      nodeDelays.value[nodeName] = res.data.delay
      return res.data.delay
    } catch {
      nodeDelays.value[nodeName] = 0
      return 0
    }
  }

  // 轮询获取活跃连接数与累计数据
  const syncConnectionsInfo = async () => {
    if (!isConnected.value) return
    try {
      const res = await clashApi.fetchConnectionsAPI()
      activeConnectionsCount.value = (res.data.connections || []).length
      totalUpload.value = res.data.uploadTotal || 0
      totalDownload.value = res.data.downloadTotal || 0
    } catch {}
  }

  const checkConnection = async (): Promise<boolean> => {
    isProbing.value = true
    const candidates = Array.from(new Set([
      endpoint.value,
      'http://127.0.0.1:9090',
      'http://localhost:9090'
    ]))

    for (const ep of candidates) {
      try {
        clashApi.configure(ep, secret.value)
        const res = await clashApi.fetchClashVersion()
        if (res.data?.version) {
          endpoint.value = ep
          localStorage.setItem('clash_controller_endpoint', ep)
          coreVersion.value = res.data.version
          isConnected.value = true
          isEnabled.value = true

          const [cfgRes, proxyRes] = await Promise.all([
            clashApi.getConfigsAPI(),
            clashApi.fetchProxiesAPI()
          ])
          config.value = cfgRes.data
          proxies.value = proxyRes.data.proxies || {}

          startStreams()
          refreshOutboundIp()

          if (!runtimeTimer) {
            connectedStartTime.value = Date.now()
            runtimeTimer = setInterval(updateRuntime, 1000)
          }

          if (primaryProxyGroup.value?.now) {
            testNodeDelay(primaryProxyGroup.value.now)
          }

          isProbing.value = false
          return true
        }
      } catch {}
    }

    isConnected.value = false
    isEnabled.value = false
    config.value = null
    proxies.value = {}
    stopStreams()
    if (runtimeTimer) {
      clearInterval(runtimeTimer)
      runtimeTimer = null
    }
    isProbing.value = false
    return false
  }

  const init = async () => {
    await checkConnection()
  }

  const startStreams = () => {
    stopStreams()
    try {
      // 1. 流量 WebSocket 流
      trafficWs = clashApi.createClashWebSocket('traffic')
      trafficWs.onmessage = (e) => {
        try {
          const sample = JSON.parse(e.data)
          traffic.value = sample
          trafficHistory.value.push(sample)
          if (trafficHistory.value.length > 30) trafficHistory.value.shift()
        } catch {}
      }

      // 2. 内存 WebSocket 流
      memoryWs = clashApi.createMemoryWebSocket((data) => {
        memoryInUse.value = data.inuse || 0
      })

      // 3. 轮询连接状态
      syncConnectionsInfo()
      connTimer = setInterval(syncConnectionsInfo, 2500)
    } catch {}
  }

  const stopStreams = () => {
    if (trafficWs) { trafficWs.close(); trafficWs = null }
    if (memoryWs) { memoryWs.close(); memoryWs = null }
    if (connTimer) { clearInterval(connTimer); connTimer = null }
    traffic.value = { up: 0, down: 0 }
    trafficHistory.value = []
  }

  const toggleController = async (targetState: boolean) => {
    if (targetState) {
      await checkConnection()
    } else {
      isEnabled.value = false
      isConnected.value = false
      stopStreams()
      if (runtimeTimer) {
        clearInterval(runtimeTimer)
        runtimeTimer = null
      }
    }
  }

  const toggleProxyPause = async () => {
    if (!isConnected.value) {
      await checkConnection()
      return
    }
    if (!config.value) return
    const isDirect = config.value.mode?.toLowerCase() === 'direct'
    const newMode = isDirect ? 'rule' : 'direct'
    
    await clashApi.patchConfigsAPI({ mode: newMode })
    config.value.mode = newMode
    // 暂停/恢复同样切断存量连接保证彻底断流
    await clashApi.disconnectAllClashAPI().catch(() => {})
    setTimeout(refreshOutboundIp, 800)
  }

 // 🌟 切换节点：下发 PUT -> 强制切断存量连接 -> 阶梯轮询抓取新出站 IP
  const selectNode = async (groupName: string, nodeName: string) => {
    try {
      const oldIp = outboundIpInfo.value.ip

      // 1. 下发 PUT /proxies/{groupName}
      await clashApi.selectProxyAPI(groupName, nodeName)
      
      if (proxies.value[groupName]) {
        proxies.value[groupName].now = nodeName
      }
      testNodeDelay(nodeName)

      // 2. 检查是否开启“切换节点时自动断开连接”（默认开启）
      const autoDisconnect = localStorage.getItem('clash_auto_disconnect') !== 'false'
      if (autoDisconnect) {
        await clashApi.disconnectAllClashAPI().catch(() => {})
      }

      // 3. 🌟 阶梯轮询探测新 IP (解决部分连接复用导致 IP 不变的问题)
      import('../utils/geoip').then(({ pollUntilIpChanges }) => {
        pollUntilIpChanges(oldIp, (newInfo) => {
          outboundIpInfo.value = newInfo
        })
      })

      // 重新同步代理组
      setTimeout(async () => {
        const p = await clashApi.fetchProxiesAPI()
        proxies.value = p.data.proxies || {}
      }, 400)
    } catch (e: any) {
      alert('切换节点失败: ' + (e.message || 'Mihomo 拒绝请求'))
    }
  }

  const changeMode = async (mode: 'rule' | 'global' | 'direct') => {
    if (!config.value) return
    await clashApi.patchConfigsAPI({ mode })
    config.value.mode = mode
    await clashApi.disconnectAllClashAPI().catch(() => {})
    setTimeout(refreshOutboundIp, 800)
  }

const primaryProxyGroup = computed(() => {
    const p = proxies.value
    if (!p || Object.keys(p).length === 0) return null
    const siteTitle = (settings.title || 'ReiaNEXT').toLowerCase()
    
    // 优先匹配与网站同名的策略组
    for (const [k, v] of Object.entries(p)) {
      if (k.toLowerCase().includes(siteTitle) && v.all && v.all.length > 0) return v
    }
    // 保持配置原顺序，取第一个 Selector 组
    return Object.values(p).find((item) => item.type === 'Selector' && item.all && item.all.length > 0) || null
  })

  init()

  return {
    isEnabled,
    isConnected,
    isProbing,
    endpoint,
    secret,
    coreVersion,
    config,
    proxies,
    traffic,
    trafficHistory,
    activeConnectionsCount,
    memoryInUse,
    totalUpload,
    totalDownload,
    nodeDelays,
    outboundIpInfo,
    runtimeFormatted,
    primaryProxyGroup,
    init,
    checkConnection,
    toggleController,
    toggleProxyPause,
    selectNode,
    changeMode,
    testNodeDelay,
    refreshOutboundIp,

    // 🌟 核心：确保把这个方法暴露出去了，解决设置页的 TS 报错
    saveConnectionSettings: async (newEndpoint: string, newSecret: string) => {
      endpoint.value = newEndpoint.replace(/\/+$/, '')
      secret.value = newSecret
      localStorage.setItem('clash_controller_endpoint', endpoint.value)
      localStorage.setItem('clash_controller_secret', secret.value)
      return await checkConnection()
    }
  }
})