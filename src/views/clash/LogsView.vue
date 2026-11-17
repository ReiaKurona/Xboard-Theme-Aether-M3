<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { clashApi } from '../../api/clash'
import { useClashStore } from '../../stores/clash'
import '@material/web/textfield/outlined-text-field.js'

export interface LogItem {
  seq: number
  type: string
  payload: string
  time: string
}

const logs = ref<LogItem[]>([])
const logLevel = ref('info')
const typeFilter = ref('all')
const searchQuery = ref('')
const isPaused = ref(false)

let seqCounter = 600
let logWs: WebSocket | null = null
const client = useClashStore()

const startLogStream = () => {
  if (logWs) logWs.close()
  logWs = null
  if (!client.isConnected || !client.kernelReady) return
  try {
    logWs = clashApi.createClashWebSocket('logs', { level: logLevel.value })
    logWs.onmessage = (e) => {
      if (isPaused.value) return
      try {
        const raw = JSON.parse(e.data)
        seqCounter++
        const date = new Date()
        const timeStr = date.toLocaleTimeString('zh-CN', { hour12: false })

        logs.value.unshift({
          seq: seqCounter,
          type: (raw.type || 'info').toUpperCase(),
          payload: raw.payload || '',
          time: timeStr
        })

        // 最多保留 250 条
        if (logs.value.length > 250) logs.value.pop()
      } catch {}
    }
  } catch {}
}

const filteredLogs = computed(() => {
  let list = logs.value

  if (typeFilter.value !== 'all') {
    list = list.filter(l => l.type === typeFilter.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(l => l.payload.toLowerCase().includes(q) || l.type.toLowerCase().includes(q))
  }

  return list
})

// 徽章颜色
const getBadgeClass = (type: string) => {
  switch (type) {
    case 'WARNING':
      return 'text-amber-500 bg-amber-500/10'
    case 'ERROR':
      return 'text-red-500 bg-red-500/10 font-bold'
    case 'DEBUG':
      return 'text-purple-400 bg-purple-500/10'
    default:
      return 'text-cyan-400 bg-cyan-500/10'
  }
}

const clearLogs = () => {
  logs.value = []
}

onMounted(startLogStream)
watch(() => [client.isConnected, client.kernelReady, client.secret], startLogStream)
onUnmounted(() => {
  if (logWs) logWs.close()
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-5 w-full select-none">
    
    <!-- 🌟 图 2 顶栏控制器：日志级别 + 搜索 + 暂停 + 清空 -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-[28px] bg-[var(--md-sys-color-surface-container)] shadow-sm">
      <div class="flex items-center gap-2">
        <!-- 级别选择 -->
        <select
          v-model="logLevel"
          @change="startLogStream"
          class="px-3.5 py-2 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-xs font-bold outline-none cursor-pointer"
        >
          <option value="info">INFO</option>
          <option value="warning">WARNING</option>
          <option value="error">ERROR</option>
          <option value="debug">DEBUG</option>
        </select>

        <select
          v-model="typeFilter"
          class="px-3.5 py-2 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-xs font-bold outline-none cursor-pointer"
        >
          <option value="all">全部类型</option>
          <option value="INFO">仅显示 INFO</option>
          <option value="WARNING">仅显示 WARNING</option>
          <option value="ERROR">仅显示 ERROR</option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <div class="w-full sm:w-64">
          <md-outlined-text-field
            label="搜索日志内容 / Regex..."
            :value="searchQuery"
            @input="(e: any) => searchQuery = e.target.value"
            class="w-full"
          >
            <span slot="leading-icon" class="material-symbols-outlined text-sm">search</span>
          </md-outlined-text-field>
        </div>

        <!-- 暂停/继续 -->
        <button
          @click="isPaused = !isPaused"
          class="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] active:scale-90 transition-all cursor-pointer"
          :title="isPaused ? '恢复滚动' : '暂停日志流'"
        >
          <span class="material-symbols-outlined text-base">
            {{ isPaused ? 'play_arrow' : 'pause' }}
          </span>
        </button>

        <!-- 清空日志 -->
        <button
          @click="clearLogs"
          class="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--md-sys-color-surface-container-high)] hover:text-red-500 active:scale-90 transition-all cursor-pointer"
          title="清空当前日志"
        >
          <span class="material-symbols-outlined text-base">delete_sweep</span>
        </button>
      </div>
    </div>

    <!-- 🌟 图 2 真实黑底日志瀑布卡片 -->
    <div class="rounded-[32px] bg-[var(--md-sys-color-surface-container)] p-4 md:p-6 shadow-sm flex flex-col gap-2 max-h-[75vh] overflow-y-auto font-mono text-xs">
      <div v-if="filteredLogs.length === 0" class="py-20 text-center opacity-40">
        等待内核事件与日志推送中...
      </div>

      <div
        v-for="l in filteredLogs"
        :key="l.seq"
        class="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 hover:bg-[var(--md-sys-color-surface-container-high)] flex items-start gap-3 transition-colors"
      >
        <!-- 序列号 -->
        <span class="text-[10px] opacity-40 select-none w-7 pt-0.5">{{ l.seq }}</span>

        <!-- 级别徽章 -->
        <span class="px-2 py-0.5 rounded-md text-[10px] font-black shrink-0" :class="getBadgeClass(l.type)">
          {{ l.type }}
        </span>

        <!-- 日志 Payload 消息文本 -->
        <span class="flex-1 break-all leading-relaxed text-[var(--md-sys-color-on-surface)] select-all">
          {{ l.payload }}
        </span>

        <!-- 时间 -->
        <span class="text-[10px] opacity-40 shrink-0 select-none pt-0.5">{{ l.time }}</span>
      </div>
    </div>
  </div>
</template>
