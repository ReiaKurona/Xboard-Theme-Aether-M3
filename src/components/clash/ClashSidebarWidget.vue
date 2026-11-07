<script setup lang="ts">
import { computed } from 'vue'
import { useClashStore } from '../../stores/clash'
import { formatBytes } from '../../stores/user'

const props = defineProps<{
  isCollapsed: boolean
}>()

const clashStore = useClashStore()

// 计算平滑贝塞尔波形曲线
const wavePaths = computed(() => {
  const history = clashStore.trafficHistory
  if (history.length < 2) return { upPath: '', downPath: '' }

  const w = 180
  const h = 42
  const max = Math.max(...history.map(s => Math.max(s.up, s.down)), 1024 * 50) // 最小 50KB/s 标尺
  const step = w / (history.length - 1)

  const upPoints = history.map((s, idx) => `${idx * step},${h - (s.up / max) * (h - 4)}`)
  const downPoints = history.map((s, idx) => `${idx * step},${h - (s.down / max) * (h - 4)}`)

  return {
    upPath: 'M ' + upPoints.join(' L '),
    downPath: 'M ' + downPoints.join(' L ')
  }
})
</script>

<template>
  <div v-if="clashStore.isConnected" class="w-full select-none transition-all duration-300">
    
    <!-- 🌟 模式 A：宽侧栏展开状态 (100% 对齐图 1) -->
    <div v-if="!isCollapsed" class="flex flex-col gap-2.5 p-3 rounded-[24px] bg-[var(--md-sys-color-surface-container-high)]/60 border border-black/5 dark:border-transparent text-xs">
      
      <!-- 1. 实时流量波形图 -->
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between text-[10px] opacity-60">
          <span class="font-bold">流量</span>
          <div class="flex items-center gap-2 font-mono">
            <span class="flex items-center gap-1 text-purple-400">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span> 上传
            </span>
            <span class="flex items-center gap-1 text-cyan-400">
              <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> 下载
            </span>
          </div>
        </div>

        <!-- SVG 波形图 -->
        <div class="h-10 w-full relative overflow-hidden mt-0.5">
          <svg class="w-full h-full overflow-visible" viewBox="0 0 180 42" preserveAspectRatio="none">
            <path :d="wavePaths.downPath" fill="none" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round" />
            <path :d="wavePaths.upPath" fill="none" stroke="#c084fc" stroke-width="1.5" stroke-linecap="round" opacity="0.85" />
          </svg>
        </div>
      </div>

      <!-- 2. 状态指标方阵 (图 1 排版) -->
      <div class="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-[var(--md-sys-color-surface-container)] font-mono text-[11px]">
        <div>
          <span class="text-[9px] opacity-40 block">连接</span>
          <span class="font-black text-sm text-[var(--md-sys-color-on-surface)]">{{ clashStore.activeConnectionsCount }}</span>
        </div>
        <div>
          <span class="text-[9px] opacity-40 block">内存使用</span>
          <span class="font-black text-sm text-amber-500">{{ formatBytes(clashStore.memoryInUse) }}</span>
        </div>
        <div>
          <span class="text-[9px] opacity-40 block">下载累计</span>
          <span class="font-bold text-cyan-400">{{ formatBytes(clashStore.totalDownload) }}</span>
        </div>
        <div>
          <span class="text-[9px] opacity-40 block">上传累计</span>
          <span class="font-bold text-purple-400">{{ formatBytes(clashStore.totalUpload) }}</span>
        </div>
      </div>

      <!-- 3. 端点与版本状态胶囊 (对齐图 1 底部) -->
      <div class="flex items-center justify-between text-[10px] font-mono opacity-60 px-1 pt-1 border-t border-[var(--md-sys-color-outline-variant)]/10">
        <span class="flex items-center gap-1.5 truncate">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="truncate">{{ clashStore.endpoint.replace(/^https?:\/\//, '') }}</span>
        </span>
        <span class="shrink-0 font-bold">v{{ clashStore.coreVersion }}</span>
      </div>
    </div>

    <!-- 🌟 模式 B：窄轨折叠状态 (100% 对齐图 2 垂直紧凑徽章) -->
    <div v-else class="flex flex-col items-center gap-2 p-2 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 text-center text-[10px] font-mono">
      <div class="flex flex-col items-center">
        <span class="material-symbols-outlined text-sm opacity-50">sync_alt</span>
        <span class="font-bold text-xs">{{ clashStore.activeConnectionsCount }}</span>
      </div>

      <div class="flex flex-col items-center text-cyan-400">
        <span class="text-[9px]">↓</span>
        <span class="font-bold">{{ formatBytes(clashStore.traffic.down) }}/s</span>
      </div>

      <div class="flex flex-col items-center text-purple-400">
        <span class="text-[9px]">↑</span>
        <span class="font-bold">{{ formatBytes(clashStore.traffic.up) }}/s</span>
      </div>

      <div class="flex flex-col items-center pt-1 border-t border-[var(--md-sys-color-outline-variant)]/10 text-amber-500">
        <span class="material-symbols-outlined text-xs">memory</span>
        <span class="scale-90">{{ formatBytes(clashStore.memoryInUse) }}</span>
      </div>
    </div>

  </div>
</template>