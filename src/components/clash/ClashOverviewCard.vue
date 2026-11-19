<script setup lang="ts">
import { computed } from 'vue'
import { useClashStore } from '../../stores/clash'
import { formatBytes } from '../../stores/user'

const client = useClashStore()
const ceiling = computed(() => Math.max(1024, ...client.trafficHistory.flatMap(point => [point.up, point.down])))
function points(direction: 'up' | 'down') {
  const samples = client.trafficHistory
  return samples.map((sample, index) => `${100 * index / Math.max(1, samples.length - 1)},${35 - 34 * sample[direction] / ceiling.value}`).join(' ')
}
</script>

<template>
  <div class="clash-page">
    <section class="clash-surface grid gap-4">
      <h3 class="clash-heading">实时流量</h3>
      <dl class="clash-stat-grid">
        <div class="clash-stat"><dt class="traffic-label">下载速率</dt><dd>{{ formatBytes(client.traffic.down) }}/s</dd></div>
        <div class="clash-stat"><dt class="traffic-label traffic-upload">上传速率</dt><dd>{{ formatBytes(client.traffic.up) }}/s</dd></div>
        <div class="clash-stat"><dt>累计下载</dt><dd>{{ formatBytes(client.totalDownload) }}</dd></div>
        <div class="clash-stat"><dt>累计上传</dt><dd>{{ formatBytes(client.totalUpload) }}</dd></div>
      </dl>
      <svg v-if="client.trafficHistory.length > 1" class="h-32 w-full" viewBox="0 0 100 36" preserveAspectRatio="none" role="img" aria-label="最近三十个实时流量采样">
        <polyline :points="points('down')" class="traffic-line" />
        <polyline :points="points('up')" class="traffic-line traffic-upload" />
      </svg>
      <p v-else class="clash-empty">{{ client.kernelReady ? '等待流量采样…' : '内核就绪后显示实时流量' }}</p>
    </section>
    <section class="clash-surface grid gap-4">
      <h3 class="clash-heading">运行状态</h3>
      <dl class="clash-stat-grid">
        <div class="clash-stat"><dt>活动连接</dt><dd>{{ client.activeConnectionsCount }}</dd></div>
        <div class="clash-stat"><dt>内核内存</dt><dd>{{ formatBytes(client.memoryInUse) }}</dd></div>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.traffic-line { fill: none; stroke: var(--md-sys-color-primary); stroke-width: 2; vector-effect: non-scaling-stroke; }
.traffic-line.traffic-upload { stroke: var(--md-sys-color-tertiary, var(--md-sys-color-secondary)); stroke-dasharray: 5 3; }
.traffic-label::before { display: inline-block; width: .55rem; height: .55rem; margin-inline-end: .35rem; border-radius: 50%; background: var(--md-sys-color-primary); content: ''; }
.traffic-label.traffic-upload::before { background: var(--md-sys-color-tertiary, var(--md-sys-color-secondary)); }
</style>
