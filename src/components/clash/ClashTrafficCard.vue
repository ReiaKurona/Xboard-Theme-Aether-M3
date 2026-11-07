<script setup lang="ts">
import { computed } from 'vue'
import { useClashStore } from '../../stores/clash'
import { formatBytes } from '../../stores/user'

const clashStore = useClashStore()

// 绘制首页卡片专属平滑波形曲线
const liveWavePaths = computed(() => {
  const history = clashStore.trafficHistory
  if (history.length < 2) return { upPath: '', downPath: '' }

  const w = 320
  const h = 46
  const max = Math.max(...history.map(s => Math.max(s.up, s.down)), 1024 * 50)
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
  <div class="h-full p-5 md:p-6 rounded-[28px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent flex flex-col justify-between shadow-sm select-none">
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-lg">show_chart</span>
          <span class="text-xs font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider">实时吞吐走势</span>
        </div>
        <span
          class="w-2.5 h-2.5 rounded-full"
          :class="clashStore.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'"
        ></span>
      </div>

      <!-- 上下行速率 -->
      <div class="flex items-baseline justify-between font-mono my-1">
        <div class="flex flex-col">
          <span class="text-[10px] opacity-40">上行实时</span>
          <span class="text-lg font-black text-purple-400">↑ {{ formatBytes(clashStore.traffic.up) }}/s</span>
        </div>
        <div class="flex flex-col text-right">
          <span class="text-[10px] opacity-40">下行实时</span>
          <span class="text-lg font-black text-cyan-400">↓ {{ formatBytes(clashStore.traffic.down) }}/s</span>
        </div>
      </div>

      <!-- 🌟 波形图：实时线条图 (带有青蓝/紫罗兰双光流) -->
      <div class="h-12 w-full relative overflow-hidden mt-2">
        <svg class="w-full h-full overflow-visible" viewBox="0 0 320 46" preserveAspectRatio="none">
          <path :d="liveWavePaths.downPath" fill="none" stroke="#22d3ee" stroke-width="2.2" stroke-linecap="round" />
          <path :d="liveWavePaths.upPath" fill="none" stroke="#c084fc" stroke-width="1.8" stroke-linecap="round" opacity="0.85" />
        </svg>
      </div>
    </div>

    <div class="flex items-center justify-between text-[10px] opacity-40 border-t border-[var(--md-sys-color-outline-variant)]/10 pt-2 font-mono">
      <span>Mihomo v{{ clashStore.coreVersion }}</span>
      <span>活动连接: {{ clashStore.activeConnectionsCount }}</span>
    </div>
  </div>
</template>