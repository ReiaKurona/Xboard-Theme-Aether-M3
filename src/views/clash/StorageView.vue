<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import '@material/web/dialog/dialog.js'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-tonal-button.js'
import { reiaApi } from '../../api/reia'
import { useClashStore } from '../../stores/clash'

const client = useClashStore()
const items = [
  { key: 'cache', label: '升级缓存' },
  { key: 'work', label: '内核工作目录' },
  { key: 'config', label: '配置目录' },
  { key: 'logs', label: '客户端日志' },
] as const
type Directory = typeof items[number]['key']
type Size = { bytes: number; files: number; partial: boolean }
const sizes = ref<Partial<Record<Directory, Size>>>({})
const loading = ref(false)
const error = ref('')
let request: AbortController | undefined
const confirmConfig = ref<(HTMLElement & { show(): Promise<void>; close(): Promise<void> }) | null>(null)

function formatSize(size: number) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const unit = size > 0 ? Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1) : 0
  return `${(size / 1024 ** unit).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[unit]}`
}
async function refresh() {
  if (!client.isConnected || loading.value) return
  const current = new AbortController()
  request = current
  error.value = ''
  loading.value = true
  try {
    const result = await reiaApi.agent<{ directories: Record<Directory, Size> }>(
      '/api/agent/directory/sizes', 'GET', undefined, current.signal)
    if (request === current) sizes.value = result.directories
  } catch (cause) {
    if (!current.signal.aborted) error.value = (cause as Error).message
  } finally {
    if (request === current) { loading.value = false; request = undefined }
  }
}
async function open(directory: Exclude<Directory, 'logs'>) {
  error.value = ''
  try { await client.runOperation('/api/agent/directory/open', { directory }, false) }
  catch (cause) { error.value = (cause as Error).message }
}
async function clear(directory: 'cache' | 'logs' | 'config') {
  const path = directory === 'config' ? '/api/agent/config/subscription/clear' : `/api/agent/${directory}/clear`
  error.value = ''
  try { await client.runOperation(path, directory === 'config' ? { confirm: true } : undefined, directory === 'config') }
  catch (cause) { error.value = (cause as Error).message; return }
  await refresh()
}
watch(() => client.isConnected, connected => {
  if (connected) void refresh()
  else { request?.abort(); request = undefined; sizes.value = {}; loading.value = false }
}, { immediate: true })
onUnmounted(() => request?.abort())
</script>

<template>
  <div class="clash-page text-sm">
    <section class="clash-surface grid gap-3">
      <div class="clash-toolbar justify-between">
        <h2 class="clash-heading">存储与目录</h2>
        <RouterLink :to="{ name: 'ClashSettings' }" custom v-slot="{ href, navigate }">
          <md-text-button :href="href" @click="navigate">返回客户端设置</md-text-button>
        </RouterLink>
      </div>
      <div v-for="item in items" :key="item.key" class="clash-toolbar justify-between">
        <div>
          <div>{{ item.label }}</div>
          <div class="clash-muted">
            {{ sizes[item.key] ? formatSize(sizes[item.key]!.bytes) : '—' }}
            <template v-if="sizes[item.key]"> · {{ sizes[item.key]!.files }} 个文件{{ sizes[item.key]!.partial ? ' · 部分可读' : '' }}</template>
          </div>
        </div>
        <div class="clash-toolbar">
          <md-text-button v-if="item.key !== 'logs'" :disabled="!client.isConnected || client.operationBusy" @click="open(item.key)">打开目录</md-text-button>
          <md-text-button v-if="item.key === 'cache' || item.key === 'logs'" :disabled="!client.isConnected || client.operationBusy" @click="clear(item.key)">清除</md-text-button>
          <md-text-button v-if="item.key === 'config'" :disabled="!client.isConnected || client.operationBusy" @click="confirmConfig?.show()">清除订阅</md-text-button>
        </div>
      </div>
      <p class="clash-muted">配置目录统计不含升级缓存。内核工作目录仅可查看和打开。</p>
      <md-dialog ref="confirmConfig">
        <span slot="headline">确认清除订阅与缓存配置？</span>
        <p slot="content">现有节点和规则将移除，自动订阅同步会暂停，直到你手动导入订阅。客户端偏好和节点记忆会保留。</p>
        <div slot="actions">
          <md-text-button @click="confirmConfig?.close()">取消</md-text-button>
          <md-filled-tonal-button :disabled="client.operationBusy" @click="confirmConfig?.close(); clear('config')">确认清除</md-filled-tonal-button>
        </div>
      </md-dialog>
      <p v-if="error" role="alert" class="clash-error">{{ error }}</p>
      <div class="clash-toolbar">
        <md-filled-tonal-button v-if="!client.isConnected" :disabled="client.isProbing" @click="client.connectByUser()">连接本机客户端</md-filled-tonal-button>
        <md-filled-tonal-button v-else :disabled="loading" @click="refresh()">{{ loading ? '正在统计' : '刷新统计' }}</md-filled-tonal-button>
      </div>
    </section>
  </div>
</template>
