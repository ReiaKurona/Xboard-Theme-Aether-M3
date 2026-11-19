<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useClashStore } from '../../stores/clash'
import { useClashStream } from '../../utils/useClashStream'
import ClashSelect from '../../components/clash/ClashSelect.vue'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/switch/switch.js'
import '@material/web/textfield/outlined-text-field.js'

interface LogEntry { id: number; level: string; text: string; time: Date }
const client = useClashStore()
const logs = shallowRef<LogEntry[]>([]), frozen = shallowRef<LogEntry[] | null>(null)
const streamLevel = ref('info'), category = ref('all'), search = ref(''), regex = ref(false)
const message = ref(''), error = ref('')
let nextID = 0, queue: LogEntry[] = [], flushTimer: ReturnType<typeof setTimeout> | undefined
const MAX_LOGS = 500
const levels = ['debug', 'info', 'warning', 'error'].map(value => ({ value, label: value.toUpperCase() }))
const categories = [{ value: 'all', label: '全部级别' }, ...levels]
const { streamState } = useClashStream('/logs', () => ({ level: streamLevel.value, format: 'structured' }), consume)
const streamLabel = computed(() => frozen.value ? '显示已暂停' : ({
  waiting: '等待内核就绪', connecting: '正在连接', live: '实时接收', retrying: '正在重连',
})[streamState.value])

function consume(frame: unknown) {
  const data = frame as { type?: string; level?: string; payload?: string; message?: string; time?: string }
  const rawText = data?.message ?? data?.payload
  if (typeof rawText !== 'string') return
  const level = (data.level || data.type || 'info').toLowerCase()
  if (queue.length >= MAX_LOGS) queue.shift()
  const timestamp = data.time ? new Date(data.time) : new Date()
  queue.push({ id: ++nextID, level: level === 'warn' ? 'warning' : level, text: rawText,
    time: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp })
  if (!flushTimer) flushTimer = setTimeout(flush, 100)
}
function flush() {
  clearTimeout(flushTimer)
  flushTimer = undefined
  if (!queue.length) return
  logs.value = [...queue.reverse(), ...logs.value].slice(0, MAX_LOGS)
  queue = []
}
function clear() {
  queue = []
  clearTimeout(flushTimer)
  flushTimer = undefined
  logs.value = []
  if (frozen.value) frozen.value = []
  message.value = '本页日志已清空'
  error.value = ''
}
function togglePause() {
  flush()
  frozen.value = frozen.value ? null : logs.value
}
watch(() => client.secret, () => { clear(); frozen.value = null; message.value = '' })
onUnmounted(() => clearTimeout(flushTimer))

const expression = computed(() => {
  const query = search.value.trim()
  if (!query || !regex.value) return { pattern: null, problem: '' }
  try { return { pattern: new RegExp(query, 'i'), problem: '' } }
  catch { return { pattern: null, problem: '正则表达式无效' } }
})
const filtered = computed(() => {
  if (expression.value.problem) return []
  const query = search.value.trim().toLowerCase()
  return (frozen.value ?? logs.value).filter(row => {
    if (category.value !== 'all' && row.level !== category.value) return false
    const text = row.level + ' ' + row.text
    return expression.value.pattern ? expression.value.pattern.test(text) : !query || text.toLowerCase().includes(query)
  })
})
const time = (value: Date) => value.toLocaleTimeString('zh-CN', { hour12: false })
async function copyLogs() {
  if (!filtered.value.length) return
  try {
    await navigator.clipboard.writeText([...filtered.value].reverse().map(row => `[${time(row.time)}] ${row.level.toUpperCase()} ${row.text}`).join('\n'))
    message.value = `已复制 ${filtered.value.length} 条日志`
    error.value = ''
  } catch { error.value = '无法写入剪贴板' }
}
</script>

<template>
  <div class="clash-page" data-clash-logs>
    <section class="clash-surface grid gap-4">
      <header class="clash-toolbar justify-between">
        <h2 class="clash-heading">内核日志</h2>
        <span class="clash-pill" :data-active="!frozen && streamState === 'live'">{{ streamLabel }}</span>
      </header>
      <div class="clash-toolbar">
        <md-outlined-text-field label="搜索日志" maxlength="140" :value="search" :error="!!expression.problem" :error-text="expression.problem"
          @input="search = ($event.currentTarget as HTMLInputElement).value"></md-outlined-text-field>
        <ClashSelect label="接收级别" :options="levels" v-model="streamLevel" />
        <ClashSelect label="显示级别" :options="categories" v-model="category" />
      </div>
      <div class="clash-toolbar text-sm">
        <label class="flex items-center gap-2">正则搜索 <md-switch :selected="regex" aria-label="正则搜索"
          @change="regex = ($event.currentTarget as HTMLElement & { selected: boolean }).selected"></md-switch></label>
        <md-filled-tonal-button :disabled="!client.kernelReady" @click="togglePause">{{ frozen ? '恢复显示' : '暂停显示' }}</md-filled-tonal-button>
        <md-text-button :disabled="!filtered.length" @click="copyLogs">复制筛选结果</md-text-button>
        <md-text-button :disabled="!logs.length" @click="clear">清空本页日志</md-text-button>
      </div>
      <p v-if="error" role="alert" class="clash-error text-sm">{{ error }}</p>
      <p v-else-if="message" role="status" class="clash-muted text-sm">{{ message }}</p>
    </section>
    <section class="clash-surface grid gap-3" aria-label="日志列表">
      <p class="clash-muted text-sm">{{ filtered.length }} 条匹配 · 本页最多保留 {{ MAX_LOGS }} 条</p>
      <div v-if="!filtered.length" class="clash-empty">
        {{ expression.problem || (!client.kernelReady ? '等待内核就绪' : logs.length ? '当前筛选没有匹配的日志' : '等待内核日志…') }}
      </div>
      <ol v-else class="log-list" tabindex="0" aria-label="日志内容，最新在前">
        <li v-for="row in filtered" :key="row.id" class="log-line">
          <time class="clash-muted">{{ time(row.time) }}</time>
          <span class="clash-pill" :data-level="row.level" :data-active="row.level === 'info'">{{ row.level.toUpperCase() }}</span>
          <span class="log-message">{{ row.text }}</span>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.log-list { max-height: min(68vh, 48rem); overflow: auto; overscroll-behavior: contain; }
.log-line { display: grid; grid-template-columns: 5.5rem 5rem minmax(0, 1fr); align-items: start; gap: .65rem; border-bottom: 1px solid var(--md-sys-color-outline-variant); padding: .65rem .35rem; text-align: start; }
.log-line:last-child { border-bottom: 0; }
.log-line time, .log-message { font: .8rem / 1.5 ui-monospace, monospace; }
.log-line time { padding-top: .15rem; }
.log-message { white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 550px) {
  .log-line { grid-template-columns: auto minmax(0, 1fr); gap: .3rem .6rem; }
  .log-line .clash-pill { justify-self: start; }
  .log-message { grid-column: 1 / -1; }
}
</style>
