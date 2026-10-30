<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { formatBytes } from '../../stores/user'
import KomariServerDetailModal from './KomariServerDetailModal.vue'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/progress/circular-progress.js'

const settings = (window as any).settings || {}
const isKomariEnabled = computed(() => Boolean(settings.komari_enabled))
const rawKomariUrl = computed(() => (settings.komari_url || '').trim().replace(/\/+$/, ''))

export interface UnifiedKomariNode {
  uuid: string
  name: string
  online: boolean
  uptime: string
  cpu: number
  ram: number
  disk: number
  netUpSpeed: string
  netDownSpeed: string
  totalUp: string
  totalDown: string
  rawInfo: any
}

const nodes = ref<UnifiedKomariNode[]>([])
const loading = ref(false)
const fetchError = ref('')
let pollTimer: any = null

const isDetailOpen = ref(false)
const selectedServer = ref<any>(null)

const openServerDetail = (node: UnifiedKomariNode) => {
  selectedServer.value = node.rawInfo
  isDetailOpen.value = true
}

// 🌟 免改 Nginx 方案：开发环境严格走 Vite 穿透代理；生产环境直连（配合 Cloudflare 标头规则）
const resolveApiUrl = (endpoint: string) => {
  if (import.meta.env.DEV) {
    return `/komari-proxy${endpoint}`
  }
  return `${rawKomariUrl.value}${endpoint}`
}

const formatUptime = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '刚刚上线'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days} 天 ${hours} 时 ${mins} 分`
  if (hours > 0) return `${hours} 时 ${mins} 分`
  return `${mins} 分钟`
}

const rpcCall = async (method: string, id: number) => {
  const res = await fetch(resolveApiUrl('/api/rpc2'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params: {},
      id
    })
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return json.result || json.data || {}
}

// 3秒静默轮询 (不引起整卡 loading 闪烁)
const fetchKomariRpcData = async (isSilent = false) => {
  if (!isKomariEnabled.value || !rawKomariUrl.value) return
  if (!isSilent) loading.value = true
  fetchError.value = ''
  try {
    const [rawNodesData, rawStatusData] = await Promise.all([
      rpcCall('common:getNodes', 1),
      rpcCall('common:getNodesLatestStatus', 2)
    ])

    const nodesMap = Array.isArray(rawNodesData)
      ? Object.fromEntries(rawNodesData.map((n: any) => [n.uuid || n.id, n]))
      : rawNodesData

    const statusMap = Array.isArray(rawStatusData)
      ? Object.fromEntries(rawStatusData.map((s: any) => [s.uuid || s.id, s]))
      : rawStatusData

    const resultList: UnifiedKomariNode[] = []

    for (const [uuid, nodeInfo] of Object.entries(nodesMap) as [string, any][]) {
      const status = statusMap[uuid] || {}

      // 🌟 修复百分比：原始数据若大于 100 说明是原始字节，需与 total 相除折算为真实 0~100 百分比
      const memTotal = nodeInfo.mem_total || 1
      const rawRam = parseFloat(String(status.ram || status.mem || 0))
      const ramVal = rawRam > 100 ? (rawRam / memTotal) * 100 : rawRam

      const diskTotal = nodeInfo.disk_total || 1
      const rawDisk = parseFloat(String(status.disk || 0))
      const diskVal = rawDisk > 100 ? (rawDisk / diskTotal) * 100 : rawDisk

      const rawCpu = parseFloat(String(status.cpu || 0))
      const cpuVal = isNaN(rawCpu) ? 0 : rawCpu

      const upSpeed = formatBytes(status.network_tx || status.net_out || status.up_speed || 0) + '/s'
      const downSpeed = formatBytes(status.network_rx || status.net_in || status.down_speed || 0) + '/s'
      const totalUp = formatBytes(status.traffic_tx || status.traffic_up || status.bytes_sent || 0)
      const totalDown = formatBytes(status.traffic_rx || status.traffic_down || status.bytes_recv || 0)

      resultList.push({
        uuid,
        name: nodeInfo.name || '未知服务器',
        online: status.online !== false,
        uptime: formatUptime(status.uptime || status.uptime_seconds || 0),
        cpu: Math.round(cpuVal * 10) / 10,
        ram: Math.round(ramVal * 10) / 10,
        disk: Math.round(diskVal * 10) / 10,
        netUpSpeed: upSpeed,
        netDownSpeed: downSpeed,
        totalUp,
        totalDown,
        rawInfo: { ...nodeInfo, uuid }
      })
    }

    nodes.value = resultList
  } catch (err: any) {
    if (!isSilent) fetchError.value = '无法连接至 Komari JSON-RPC 服务，请确认端点配置'
  } finally {
    loading.value = false
  }
}

const onlineCount = computed(() => nodes.value.filter((n) => n.online).length)

onMounted(() => {
  if (isKomariEnabled.value && rawKomariUrl.value) {
    fetchKomariRpcData()
    // 🌟 卡片自身同样挂载 3 秒自动轮询
    pollTimer = setInterval(() => {
      fetchKomariRpcData(true)
    }, 3000)
  }
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div v-if="isKomariEnabled" class="w-full">
    <div
      v-if="!rawKomariUrl"
      class="p-6 md:p-7 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent flex items-center gap-4 shadow-sm"
    >
      <div class="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
        <span class="material-symbols-outlined text-2xl">sensors_off</span>
      </div>
      <div class="flex flex-col">
        <span class="text-base font-black text-amber-500 tracking-tight">管理员未配置状态监控信息接入！</span>
        <span class="text-xs opacity-60 mt-0.5 leading-normal">
          系统已开启探针联动功能，但尚未填入 Komari 服务地址。
        </span>
      </div>
    </div>

    <div
      v-else
      class="p-6 md:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent shadow-sm flex flex-col gap-6"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--md-sys-color-outline-variant)]/10">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
            <span class="material-symbols-outlined text-2xl">monitoring</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-xl font-black tracking-tight">Komari 基础设施遥测</h3>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
                3s 实时同步
              </span>
            </div>
            <p class="text-xs opacity-60 mt-0.5">点击下方任意服务器卡片，可调出链路 Latency 监控与详细时序走势</p>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <div class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--md-sys-color-surface-container-high)] flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>当前线上：{{ onlineCount }} / {{ nodes.length }}</span>
          </div>

          <button
            @click="fetchKomariRpcData(false)"
            :disabled="loading"
            class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--md-sys-color-surface-container-high)] opacity-80 hover:opacity-100 transition-all cursor-pointer flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-sm" :class="{ 'animate-spin': loading }">refresh</span>
            <span>刷新</span>
          </button>
          
          <a
            :href="rawKomariUrl"
            target="_blank"
            class="px-3.5 py-1.5 rounded-full text-xs font-bold text-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)] hover:opacity-90 transition-all flex items-center gap-1"
          >
            <span>探针主站</span>
            <span class="material-symbols-outlined text-xs">open_in_new</span>
          </a>
        </div>
      </div>

      <div v-if="loading && nodes.length === 0" class="py-12 flex justify-center">
        <md-circular-progress indeterminate></md-circular-progress>
      </div>

      <div v-else-if="fetchError" class="p-4 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
        <span class="material-symbols-outlined text-base">error</span>
        <span>{{ fetchError }}</span>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div
          v-for="n in nodes"
          :key="n.uuid"
          @click="openServerDetail(n)"
          class="p-4.5 rounded-[24px] bg-[var(--md-sys-color-surface-container-high)]/60 hover:bg-[var(--md-sys-color-surface-container-high)] cursor-pointer transition-all active:scale-[0.99] flex flex-col justify-between gap-4 text-xs shadow-sm hover:shadow"
        >
          <div>
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-col truncate">
                <span class="font-black text-sm text-[var(--md-sys-color-on-surface)] truncate">{{ n.name }}</span>
                <span class="text-[11px] opacity-50 mt-0.5">{{ n.uptime }}</span>
              </div>
              
              <span
                class="px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 flex items-center gap-1"
                :class="n.online ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'"
              >
                <span class="material-symbols-outlined text-xs">{{ n.online ? 'trending_up' : 'trending_down' }}</span>
                {{ n.online ? '線上' : '離線' }}
              </span>
            </div>

            <!-- CPU、内存、磁盘进度条 -->
            <div class="flex flex-col gap-2.5 mt-4">
              <div>
                <div class="flex justify-between text-[11px] mb-1 font-semibold">
                  <span class="opacity-60">CPU</span>
                  <span class="font-mono text-[var(--md-sys-color-primary)]">{{ n.cpu }}%</span>
                </div>
                <div class="h-2 w-full bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden">
                  <div class="h-full bg-[var(--md-sys-color-primary)] transition-all duration-500" :style="{ width: `${Math.min(n.cpu, 100)}%` }"></div>
                </div>
              </div>

              <div>
                <div class="flex justify-between text-[11px] mb-1 font-semibold">
                  <span class="opacity-60">記憶體</span>
                  <span class="font-mono text-purple-400">{{ n.ram }}%</span>
                </div>
                <div class="h-2 w-full bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden">
                  <div class="h-full bg-purple-500 transition-all duration-500" :style="{ width: `${Math.min(n.ram, 100)}%` }"></div>
                </div>
              </div>

              <div>
                <div class="flex justify-between text-[11px] mb-1 font-semibold">
                  <span class="opacity-60">磁碟</span>
                  <span class="font-mono text-cyan-400">{{ n.disk }}%</span>
                </div>
                <div class="h-2 w-full bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden">
                  <div class="h-full bg-cyan-400 transition-all duration-500" :style="{ width: `${Math.min(n.disk, 100)}%` }"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="pt-3 border-t border-[var(--md-sys-color-outline-variant)]/10 flex flex-col gap-1.5 text-[11px]">
            <div class="flex justify-between items-center">
              <span class="opacity-50">網路速率</span>
              <span class="font-mono font-medium">↑ {{ n.netUpSpeed }} / ↓ {{ n.netDownSpeed }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="opacity-50">總流量</span>
              <span class="font-mono font-medium opacity-80">↑ {{ n.totalUp }} / ↓ {{ n.totalDown }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 🌟 挂载全功能母机详情与 Latency 双轴图表弹窗 -->
    <KomariServerDetailModal
      :open="isDetailOpen"
      :server="selectedServer"
      :base-url="rawKomariUrl"
      @close="isDetailOpen = false"
    />
  </div>
</template>