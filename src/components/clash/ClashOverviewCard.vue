<script setup lang="ts">
import { computed } from 'vue'
import { useClashStore } from '../../stores/clash'
import { formatBytes } from '../../stores/user'

const clashStore = useClashStore()

// 生成独立的平滑贝塞尔波形曲线
const generatePath = (dataFn: (s: any) => number, w = 300, h = 60, isArea = false) => {
  const history = clashStore.trafficHistory
  if (history.length < 2) return ''
  const max = Math.max(...history.map(dataFn), 1024 * 50)
  const step = w / (history.length - 1)

  const points = history.map((s, idx) => {
    const val = dataFn(s)
    return { x: idx * step, y: h - (val / max) * (h - 5) }
  })

  const path = points.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`
    const prev = arr[i - 1]
    const cx = (prev.x + pt.x) / 2
    return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`
  }, '')

  if (isArea) {
    return `${path} L ${w} ${h} L 0 ${h} Z`
  }
  return path
}

const upLinePath = computed(() => generatePath(s => s.up))
const downLinePath = computed(() => generatePath(s => s.down))
const connAreaPath = computed(() => generatePath(s => s.connections || clashStore.activeConnectionsCount, 600, 80, true))
const connLinePath = computed(() => generatePath(s => s.connections || clashStore.activeConnectionsCount, 600, 80, false))
</script>

<template>
  <div class="flex flex-col gap-4 select-none">
    
    <!-- 顶层：上传与下载独立波形面板 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      
      <!-- 上传面板 -->
      <div class="p-5 rounded-[28px] bg-[var(--md-sys-color-surface-container)] shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
        <div class="flex justify-between items-start z-10">
          <div class="flex flex-col">
            <span class="text-xs font-bold opacity-60">上传</span>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span class="text-2xl font-black font-mono text-[var(--md-sys-color-on-surface)]">
                {{ formatBytes(clashStore.traffic.up).split(' ')[0] }}
              </span>
              <span class="text-xs opacity-60 font-mono">{{ formatBytes(clashStore.traffic.up).split(' ')[1] }}/s</span>
            </div>
          </div>
          <span class="text-[10px] opacity-40">总计 {{ formatBytes(clashStore.totalUpload) }}</span>
        </div>
        
        <div class="absolute bottom-0 left-0 right-0 h-[70px] opacity-80 pointer-events-none">
          <svg class="w-full h-full overflow-visible" viewBox="0 0 300 60" preserveAspectRatio="none">
            <path :d="upLinePath" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
      </div>

      <!-- 下载面板 -->
      <div class="p-5 rounded-[28px] bg-[var(--md-sys-color-surface-container)] shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
        <div class="flex justify-between items-start z-10">
          <div class="flex flex-col">
            <span class="text-xs font-bold opacity-60">下载</span>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span class="text-2xl font-black font-mono text-[var(--md-sys-color-on-surface)]">
                {{ formatBytes(clashStore.traffic.down).split(' ')[0] }}
              </span>
              <span class="text-xs opacity-60 font-mono">{{ formatBytes(clashStore.traffic.down).split(' ')[1] }}/s</span>
            </div>
          </div>
          <span class="text-[10px] opacity-40">总计 {{ formatBytes(clashStore.totalDownload) }}</span>
        </div>
        
        <div class="absolute bottom-0 left-0 right-0 h-[70px] opacity-80 pointer-events-none">
          <svg class="w-full h-full overflow-visible" viewBox="0 0 300 60" preserveAspectRatio="none">
            <path :d="downLinePath" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
      </div>

    </div>

    <!-- 底层：连接数与内存综合面积图 -->
    <div class="p-5 rounded-[28px] bg-[var(--md-sys-color-surface-container)] shadow-sm relative overflow-hidden flex flex-col justify-between h-48">
      <div class="flex flex-col z-10">
        <span class="text-xs font-bold opacity-60">连接</span>
        <span class="text-3xl font-black font-mono text-[var(--md-sys-color-on-surface)] mt-1">
          {{ clashStore.activeConnectionsCount }}
        </span>
      </div>
      
      <span class="text-[11px] opacity-60 font-mono z-10 mt-auto pt-2">
        内存使用 {{ formatBytes(clashStore.memoryInUse) }}
      </span>

      <!-- 连接数实体面积图 -->
      <div class="absolute bottom-0 left-0 right-0 h-[100px] pointer-events-none opacity-90">
        <svg class="w-full h-full overflow-visible" viewBox="0 0 600 80" preserveAspectRatio="none">
          <defs>
            <linearGradient id="connAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#94a3b8" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#94a3b8" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path :d="connAreaPath" fill="url(#connAreaGrad)" />
          <path :d="connLinePath" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </div>
    </div>

  </div>
</template>