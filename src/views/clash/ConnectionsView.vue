<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { clashApi } from '../../api/clash'
import { useClashStore } from '../../stores/clash'
import { formatBytes } from '../../stores/user'
import { collectConnections, formatConnectionRule, formatEndpoint, type ClashConnection, type ConnectionSample } from '../../utils/clashConnections'
import { useClashStream } from '../../utils/useClashStream'
import ClashSelect from '../../components/clash/ClashSelect.vue'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/dialog/dialog.js'
import '@material/web/textfield/outlined-text-field.js'

type Dialog = HTMLElement & { show(): Promise<void>; close(): Promise<void> }
const client = useClashStore()
const live = shallowRef(new Map<string, ConnectionSample>())
const history = shallowRef<ConnectionSample[]>([])
const upload = ref(0), download = ref(0)
const view = ref('active'), protocol = ref('all'), sort = ref('recent'), search = ref(''), page = ref(1)
const paused = ref(false), visible = ref(document.visibilityState !== 'hidden'), received = ref(false)
const message = ref(''), error = ref('')
const detail = ref<Dialog | null>(null), closeDialog = ref<Dialog | null>(null)
const selected = shallowRef<ConnectionSample | null>(null)
const PAGE_SIZE = 40
const views = [{ value: 'active', label: '活动' }, { value: 'closed', label: '已结束' }, { value: 'all', label: '全部' }]
const protocols = [{ value: 'all', label: '所有协议' }, { value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]
const sorts = [{ value: 'recent', label: '最近开始' }, { value: 'download', label: '下载量' }, { value: 'upload', label: '上传量' }, { value: 'rate', label: '实时速率' }]
const connectionStream = useClashStream('/connections', () => ({ interval: '1000' }), consume, () => !paused.value && visible.value)
const streamLabel = computed(() => paused.value ? '已暂停' : ({
  waiting: client.kernelReady ? '等待页面可见' : '等待内核就绪',
  connecting: '正在连接', live: '实时', retrying: '正在重连',
})[connectionStream.streamState.value])

function consume(frame: unknown) {
  const data = frame as { connections?: ClashConnection[] | null; downloadTotal?: number; uploadTotal?: number }
  if (!data || (!Array.isArray(data.connections) && data.connections !== null)) return
  const sampled = collectConnections(live.value, data.connections || [], Date.now())
  live.value = sampled.live
  if (sampled.closed.length) history.value = [...sampled.closed.reverse(), ...history.value].slice(0, 300)
  received.value = true
  upload.value = data.uploadTotal ?? upload.value
  download.value = data.downloadTotal ?? download.value
}

function destination(row: ClashConnection) {
  return formatEndpoint(row.metadata?.host || row.metadata?.destinationIP, row.metadata?.destinationPort)
}
function source(row: ClashConnection) {
  return formatEndpoint(row.metadata?.sourceIP, row.metadata?.sourcePort)
}
function processName(row: ClashConnection) {
  return row.metadata?.process || row.metadata?.processPath?.split(/[\\/]/).pop() || '—'
}
function timestamp(value: string | number) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('zh-CN', { hour12: false })
}
const results = computed(() => {
  const rows = view.value === 'closed' ? [...history.value] : [...live.value.values(), ...(view.value === 'all' ? history.value : [])]
  const query = search.value.trim().toLowerCase()
  return rows.filter(row => (
    (protocol.value === 'all' || row.metadata?.network?.toLowerCase() === protocol.value) &&
    (!query || [destination(row), row.metadata?.destinationIP, source(row), row.metadata?.type,
      row.metadata?.process, row.metadata?.processPath, formatConnectionRule(row), row.chains?.join(' ')].join(' ').toLowerCase().includes(query))
  )).sort((a, b) => {
    if (sort.value === 'download') return (b.download || 0) - (a.download || 0)
    if (sort.value === 'upload') return (b.upload || 0) - (a.upload || 0)
    if (sort.value === 'rate') return b.downRate + b.upRate - a.downRate - a.upRate
    return (Date.parse(b.start) || 0) - (Date.parse(a.start) || 0)
  })
})
const pageCount = computed(() => Math.max(1, Math.ceil(results.value.length / PAGE_SIZE)))
const rows = computed(() => results.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const currentDetail = computed(() => selected.value && (live.value.get(selected.value.id) || history.value.find(row => row.id === selected.value?.id) || selected.value))
watch([view, protocol, sort, search], () => { page.value = 1 })
watch(pageCount, count => { if (page.value > count) page.value = count })
watch(() => client.secret, () => {
  live.value = new Map(); history.value = []; upload.value = 0; download.value = 0; received.value = false
  selected.value = null
  if (detail.value?.hasAttribute('open')) void detail.value.close()
})

function showDetails(row: ConnectionSample) { selected.value = row; void detail.value?.show() }
async function copyDestination() {
  if (!currentDetail.value) return
  try { await navigator.clipboard.writeText(destination(currentDetail.value)); message.value = '目标地址已复制'; error.value = '' }
  catch { error.value = '无法写入剪贴板' }
}
async function disconnect(id?: string) {
  message.value = ''; error.value = ''
  try {
    await client.runMutation(() => id ? clashApi.disconnectClashByIdAPI(id) : clashApi.disconnectAllClashAPI())
    message.value = id ? '断开请求已完成' : '全部断开请求已完成'
    if (!paused.value) connectionStream.reconnect()
  } catch (cause) { error.value = (cause as Error).message }
}
const visibility = () => { visible.value = document.visibilityState !== 'hidden' }
onMounted(() => document.addEventListener('visibilitychange', visibility))
onUnmounted(() => document.removeEventListener('visibilitychange', visibility))
</script>

<template>
  <div class="clash-page" data-clash-connections>
    <section class="clash-surface grid gap-4">
      <header class="clash-toolbar justify-between">
        <h2 class="clash-heading">连接监控</h2>
        <span class="clash-pill" :data-active="!paused && connectionStream.streamState.value === 'live'">{{ streamLabel }}</span>
      </header>
      <dl class="clash-stat-grid">
        <div class="clash-stat"><dt>活动连接</dt><dd>{{ live.size }}</dd></div>
        <div class="clash-stat"><dt>会话内已结束</dt><dd>{{ history.length }}</dd></div>
        <div class="clash-stat"><dt>累计下载</dt><dd>{{ formatBytes(download) }}</dd></div>
        <div class="clash-stat"><dt>累计上传</dt><dd>{{ formatBytes(upload) }}</dd></div>
      </dl>
      <div class="clash-toolbar">
        <md-outlined-text-field label="搜索域名、IP、进程、规则或节点" :value="search"
          @input="search = ($event.currentTarget as HTMLInputElement).value"></md-outlined-text-field>
        <ClashSelect label="连接状态" v-model="view" :options="views" />
        <ClashSelect label="协议" v-model="protocol" :options="protocols" />
        <ClashSelect label="排序" v-model="sort" :options="sorts" />
      </div>
      <div class="clash-toolbar">
        <md-filled-tonal-button :disabled="!client.kernelReady" @click="paused = !paused">{{ paused ? '恢复实时' : '暂停实时' }}</md-filled-tonal-button>
        <md-text-button :disabled="!history.length" @click="history = []">清除历史</md-text-button>
        <md-text-button :disabled="!live.size || !client.kernelReady || client.operationBusy" @click="closeDialog?.show()">断开全部</md-text-button>
      </div>
      <p v-if="error" class="clash-error text-sm" role="alert">{{ error }}</p>
      <p v-else-if="message" class="clash-muted text-sm" role="status">{{ message }}</p>
    </section>

    <section class="clash-surface grid gap-2" aria-label="连接列表">
      <div v-if="!rows.length" class="clash-empty">
        {{ !client.isConnected ? '等待 ReiaClash 连接' : !client.kernelReady ? '等待内核就绪' : !received ? '等待连接数据…' : '当前筛选没有匹配的连接' }}
      </div>
      <template v-else>
        <div class="clash-table-scroll">
          <table class="clash-table connections-table">
            <thead><tr><th>目标 / 进程</th><th>规则 / 策略链</th><th>上传 / 下载</th><th class="connection-wide">开始时间</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id + ':' + (row.closedAt || '')">
                <td>
                  <button type="button" class="connection-link" @click="showDetails(row)">{{ destination(row) }}</button>
                  <p class="clash-muted text-xs">{{ processName(row) }} · {{ row.closedAt ? '已结束' : row.metadata?.network?.toUpperCase() || '活动' }}</p>
                </td>
                <td><p>{{ formatConnectionRule(row) }}</p><p class="clash-muted text-xs">{{ row.chains?.join(' → ') || '—' }}</p></td>
                <td><p>{{ formatBytes(row.upload || 0) }} / {{ formatBytes(row.download || 0) }}</p><p v-if="row.upRate || row.downRate" class="clash-muted text-xs">{{ formatBytes(row.upRate) }}/s / {{ formatBytes(row.downRate) }}/s</p></td>
                <td class="connection-wide">{{ timestamp(row.start) }}</td>
                <td><md-text-button v-if="!row.closedAt" :disabled="client.operationBusy || !client.kernelReady" @click="disconnect(row.id)">断开</md-text-button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="clash-toolbar justify-end text-sm">
          <span class="clash-muted">{{ results.length }} 条 · {{ page }} / {{ pageCount }}</span>
          <md-text-button :disabled="page === 1" @click="page--">上一页</md-text-button>
          <md-text-button :disabled="page === pageCount" @click="page++">下一页</md-text-button>
        </div>
      </template>
    </section>

    <md-dialog ref="detail">
      <span slot="headline">连接详情</span>
      <dl v-if="currentDetail" slot="content" class="clash-detail-grid">
        <dt>目标</dt><dd>{{ destination(currentDetail) }}</dd>
        <dt>目标 IP</dt><dd>{{ currentDetail.metadata?.destinationIP || '—' }}</dd>
        <dt>来源</dt><dd>{{ source(currentDetail) }}</dd>
        <dt>进程</dt><dd>{{ currentDetail.metadata?.processPath || processName(currentDetail) }}</dd>
        <dt>入站</dt><dd>{{ currentDetail.metadata?.type || '—' }} · {{ currentDetail.metadata?.network || '—' }}</dd>
        <dt>规则</dt><dd>{{ formatConnectionRule(currentDetail) }}</dd>
        <dt>策略链</dt><dd>{{ currentDetail.chains?.join(' → ') || '—' }}</dd>
        <dt>已传输</dt><dd>上行 {{ formatBytes(currentDetail.upload || 0) }} · 下行 {{ formatBytes(currentDetail.download || 0) }}</dd>
        <dt>开始</dt><dd>{{ timestamp(currentDetail.start) }}</dd>
        <template v-if="currentDetail.closedAt"><dt>已结束</dt><dd>{{ timestamp(currentDetail.closedAt) }}</dd></template>
      </dl>
      <div slot="actions"><md-text-button @click="copyDestination">复制目标</md-text-button><md-filled-button @click="detail?.close()">完成</md-filled-button></div>
    </md-dialog>
    <md-dialog ref="closeDialog">
      <span slot="headline">断开所有活动连接</span>
      <p slot="content">正在传输的数据会中断，应用可能会重新建立连接。</p>
      <div slot="actions">
        <md-text-button @click="closeDialog?.close()">取消</md-text-button>
        <md-filled-button :disabled="client.operationBusy || !client.kernelReady" @click="closeDialog?.close(); disconnect()">断开全部</md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<style scoped>
.connections-table { table-layout: fixed; }
.connections-table th:first-child { width: 31%; }
.connections-table th:last-child { width: 4.5rem; }
.connection-link { text-align: start; font-weight: 700; color: var(--md-sys-color-primary); overflow-wrap: anywhere; }
.connection-link:hover, .connection-link:focus-visible { text-decoration: underline; }
@media (max-width: 760px) {
  .connections-table .connection-wide { display: none; }
}
@media (max-width: 500px) {
  .connections-table th:nth-child(2), .connections-table td:nth-child(2) { display: none; }
  .connections-table th:first-child { width: auto; }
}
</style>
