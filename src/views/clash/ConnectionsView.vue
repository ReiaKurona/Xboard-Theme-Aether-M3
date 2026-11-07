<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { clashApi } from '../../api/clash'
import { formatBytes } from '../../stores/user'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/button/filled-button.js'
import '@material/web/progress/circular-progress.js'

const connections = ref<any[]>([])
const uploadTotal = ref(0)
const downloadTotal = ref(0)
const loading = ref(false)
const isPaused = ref(false)
const searchQuery = ref('')
const protocolFilter = ref('all') // all, tcp, udp, quic
const networkFilter = ref('all')  // all, inner, tun

let pollTimer: any = null

const fetchConnections = async () => {
  if (isPaused.value) return
  try {
    const res = await clashApi.fetchConnectionsAPI()
    connections.value = res.data.connections || []
    uploadTotal.value = res.data.uploadTotal || 0
    downloadTotal.value = res.data.downloadTotal || 0
  } catch {}
}

// 筛选逻辑
const filteredConnections = computed(() => {
  let list = connections.value

  if (protocolFilter.value !== 'all') {
    list = list.filter(c => (c.metadata?.network || '').toLowerCase() === protocolFilter.value)
  }
  if (networkFilter.value !== 'all') {
    list = list.filter(c => (c.metadata?.type || '').toLowerCase().includes(networkFilter.value))
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(c => {
      const host = (c.metadata?.host || c.metadata?.destinationIP || '').toLowerCase()
      const rule = (c.rule || '').toLowerCase()
      const chains = (c.chains || []).join(' ').toLowerCase()
      return host.includes(q) || rule.includes(q) || chains.includes(q)
    })
  }

  return list
})

// 单项断开
const handleCloseConn = async (id: string) => {
  try {
    await clashApi.disconnectClashByIdAPI(id)
    connections.value = connections.value.filter(c => c.id !== id)
  } catch {}
}

// 一键关闭所有连接
const handleCloseAll = async () => {
  if (!confirm('确定要强制中断当前所有活动网络连接吗？')) return
  try {
    await clashApi.disconnectAllClashAPI()
    connections.value = []
  } catch {}
}

onMounted(() => {
  loading.value = true
  fetchConnections().finally(() => (loading.value = false))
  pollTimer = setInterval(fetchConnections, 2000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-5 w-full select-none">
    
    <!-- 🌟 图 1 顶栏控制器：统计胶囊 + 过滤下拉 + 搜索 + 关闭所有 -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-[28px] bg-[var(--md-sys-color-surface-container)] shadow-sm">
      <div class="flex flex-wrap items-center gap-2">
        <!-- 活跃连接数胶囊 -->
        <div class="px-3 py-1.5 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] text-xs font-black">
          活跃 {{ connections.length }}
        </div>

        <!-- 协议筛选 -->
        <select
          v-model="protocolFilter"
          class="px-3 py-1.5 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-xs font-bold outline-none cursor-pointer"
        >
          <option value="all">全部协议</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
        </select>

        <!-- 方式筛选 -->
        <select
          v-model="networkFilter"
          class="px-3 py-1.5 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-xs font-bold outline-none cursor-pointer"
        >
          <option value="all">全部来源</option>
          <option value="tun">Tun 模式</option>
          <option value="inner">Inner 代理</option>
        </select>
      </div>

      <!-- 搜索框与操作按钮组 -->
      <div class="flex items-center gap-2">
        <div class="w-full sm:w-60">
          <md-outlined-text-field
            label="搜索域名 / IP / 规则..."
            :value="searchQuery"
            @input="(e: any) => searchQuery = e.target.value"
            class="w-full"
          >
            <span slot="leading-icon" class="material-symbols-outlined text-sm">search</span>
          </md-outlined-text-field>
        </div>

        <!-- 暂停/继续轮询 -->
        <button
          @click="isPaused = !isPaused"
          class="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] active:scale-90 transition-all cursor-pointer"
          :title="isPaused ? '恢复实时流' : '暂停实时流'"
        >
          <span class="material-symbols-outlined text-base">
            {{ isPaused ? 'play_arrow' : 'pause' }}
          </span>
        </button>

        <!-- 一键断开全部连接 -->
        <button
          @click="handleCloseAll"
          class="w-9 h-9 rounded-full flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-90 transition-all cursor-pointer"
          title="强制中断所有活动连接"
        >
          <span class="material-symbols-outlined text-base">link_off</span>
        </button>
      </div>
    </div>

    <!-- 🌟 图 1 真实数据表格 (全暗色无白线、等宽字体、多跳箭头) -->
    <div class="rounded-[32px] bg-[var(--md-sys-color-surface-container)] p-4 md:p-6 shadow-sm overflow-x-auto">
      <div v-if="loading && connections.length === 0" class="py-16 flex justify-center">
        <md-circular-progress indeterminate></md-circular-progress>
      </div>

      <div v-else-if="filteredConnections.length === 0" class="py-16 text-center opacity-40 text-xs">
        当前无活动网络连接
      </div>

      <table v-else class="w-full text-left text-xs font-mono border-collapse">
        <thead>
          <tr class="opacity-50 text-[11px] border-b border-[var(--md-sys-color-outline-variant)]/10 pb-2">
            <th class="py-2 px-2 w-10 text-center">关闭</th>
            <th class="py-2 px-3">主机</th>
            <th class="py-2 px-3">类型</th>
            <th class="py-2 px-3">匹配规则</th>
            <th class="py-2 px-3">出站代理链</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--md-sys-color-outline-variant)]/5">
          <tr
            v-for="c in filteredConnections"
            :key="c.id"
            class="hover:bg-[var(--md-sys-color-surface-container-high)]/60 transition-colors group"
          >
            <!-- 关闭按钮 (x) -->
            <td class="py-2.5 px-2 text-center">
              <button
                @click="handleCloseConn(c.id)"
                class="w-6 h-6 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-red-500/20 hover:text-red-500 transition-all cursor-pointer"
                title="中断此连接"
              >
                <span class="material-symbols-outlined text-xs">close</span>
              </button>
            </td>

            <!-- 主机名 / IP -->
            <td class="py-2.5 px-3 font-bold text-[var(--md-sys-color-on-surface)] truncate max-w-[260px]">
              {{ c.metadata?.host ? `${c.metadata.host}:${c.metadata?.destinationPort}` : `${c.metadata?.destinationIP}:${c.metadata?.destinationPort}` }}
            </td>

            <!-- 连接类型 (Inner | tcp, Tun | udp 等) -->
            <td class="py-2.5 px-3 opacity-75">
              <span class="px-2 py-0.5 rounded-md bg-[var(--md-sys-color-surface-container-highest)] text-[10px]">
                {{ c.metadata?.type || 'Tun' }} | {{ c.metadata?.network }}
              </span>
            </td>

            <!-- 规则 (Match, DomainSuffix, GeoIP) -->
            <td class="py-2.5 px-3 opacity-75 truncate max-w-[200px]" :title="c.rulePayload ? `${c.rule}: ${c.rulePayload}` : c.rule">
              {{ c.rulePayload ? `${c.rule}: ${c.rulePayload}` : c.rule }}
            </td>

            <!-- 🌟 代理链：箭头多级指示 (ReiaNEXT ➔ 节点名) -->
            <td class="py-2.5 px-3 font-semibold text-[var(--md-sys-color-primary)] truncate max-w-[320px]">
              <span v-if="c.chains && c.chains.length > 0" class="flex items-center gap-1.5">
                <template v-for="(node, idx) in c.chains" :key="idx">
                  <span>{{ node }}</span>
                  <span v-if="Number(idx) < c.chains.length - 1" class="opacity-40 text-[10px]">➔</span>
                </template>
              </span>
              <span v-else class="opacity-40">DIRECT</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>