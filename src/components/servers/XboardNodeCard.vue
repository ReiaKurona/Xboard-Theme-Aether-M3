<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  server: {
    id: number
    type: string
    version?: string
    name: string
    rate: string | number
    tags: string[]
    is_online: boolean | number
    cache_key?: string
    last_check_at?: number
  }
}>()

// 协议颜色映射
const protocolBadge = computed(() => {
  const t = (props.server.type || '').toLowerCase()
  if (t.includes('trojan')) return { text: 'Trojan', class: 'bg-emerald-500/15 text-emerald-500' }
  if (t.includes('vmess')) return { text: 'Vmess', class: 'bg-blue-500/15 text-blue-500' }
  if (t.includes('vless')) return { text: 'Vless', class: 'bg-cyan-500/15 text-cyan-500' }
  if (t.includes('shadowsocks') || t.includes('ss')) return { text: 'SS', class: 'bg-purple-500/15 text-purple-400' }
  if (t.includes('hysteria')) return { text: 'Hysteria', class: 'bg-amber-500/15 text-amber-500' }
  return { text: t.toUpperCase() || 'PROXY', class: 'bg-zinc-500/15 text-zinc-400' }
})

// 倍率样式
const rateDisplay = computed(() => {
  const r = parseFloat(String(props.server.rate || 1))
  return `${r.toFixed(1)}x`
})

const isOnline = computed(() => Boolean(props.server.is_online))

const formatDate = (ts?: number) => {
  if (!ts) return '近期检测'
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-5 md:p-6 rounded-[28px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-all group">
    <div>
      <!-- 顶栏：协议、倍率与在线指示灯 -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider" :class="protocolBadge.class">
            {{ protocolBadge.text }}
          </span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)]">
            {{ rateDisplay }} 消耗
          </span>
        </div>

        <!-- 动态呼吸在线指示灯 -->
        <div class="flex items-center gap-1.5" :title="isOnline ? '节点在线连通' : '节点离线维护'">
          <span
            class="w-2.5 h-2.5 rounded-full"
            :class="isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-red-500'"
          ></span>
          <span class="text-[11px] font-semibold opacity-60">
            {{ isOnline ? '正常' : '离线' }}
          </span>
        </div>
      </div>

      <!-- 节点名称 -->
      <h4 class="text-lg font-black tracking-tight text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)] transition-colors">
        {{ server.name }}
      </h4>

      <!-- 节点特性标签 -->
      <div v-if="server.tags && server.tags.length > 0" class="flex flex-wrap gap-1.5 mt-3">
        <span
          v-for="tag in server.tags"
          :key="tag"
          class="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[var(--md-sys-color-surface-container-highest)]/80 text-[var(--md-sys-color-on-surface)] opacity-80"
        >
          #{{ tag }}
        </span>
      </div>
    </div>

    <!-- 底部状态条 -->
    <div class="pt-3 border-t border-[var(--md-sys-color-outline-variant)]/10 flex items-center justify-between text-[11px] opacity-40">
      <span>心跳：{{ formatDate(server.last_check_at) }}</span>
      <span class="font-mono">ID: {{ server.id }}</span>
    </div>
  </div>
</template>