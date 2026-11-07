<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClashStore } from '../../stores/clash'

const router = useRouter()
const clashStore = useClashStore()

const currentGroupName = computed(() => clashStore.primaryProxyGroup?.name || 'ReiaNEXT')
const currentNodeName = computed(() => clashStore.primaryProxyGroup?.now || '未指定节点')

// 读取当前节点的实时测速延迟
const currentDelay = computed(() => {
  return clashStore.nodeDelays[currentNodeName.value] || 
         clashStore.proxies[currentNodeName.value]?.history?.slice(-1)[0]?.delay || 0
})

const getDelayBadge = (delay: number) => {
  if (delay <= 0) return { text: '测速中', class: 'bg-zinc-500/15 text-zinc-400' }
  if (delay < 150) return { text: `${delay} ms`, class: 'bg-emerald-500/15 text-emerald-400' }
  if (delay < 350) return { text: `${delay} ms`, class: 'bg-cyan-500/15 text-cyan-400' }
  return { text: `${delay} ms`, class: 'bg-amber-500/15 text-amber-400' }
}
</script>

<template>
  <div
    @click="router.push('/proxies')"
    class="h-full p-5 md:p-6 rounded-[28px] bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-black/5 dark:border-transparent flex flex-col justify-between shadow-sm cursor-pointer transition-all active:scale-[0.99] select-none group"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-lg">near_me</span>
        <span class="text-xs font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider">
          出站代理 [{{ currentGroupName }}]
        </span>
        <!-- 🌟 实时展示当前节点延迟 -->
        <span class="px-2 py-0.2 rounded-full text-[10px] font-bold font-mono" :class="getDelayBadge(currentDelay).class">
          {{ getDelayBadge(currentDelay).text }}
        </span>
      </div>

      <div class="flex items-center gap-1 text-xs text-[var(--md-sys-color-primary)] font-bold group-hover:translate-x-0.5 transition-transform">
        <span>切换节点</span>
        <span class="material-symbols-outlined text-sm">arrow_forward</span>
      </div>
    </div>

    <!-- 当前出站节点名称展示 -->
    <div class="my-3 flex items-center gap-3.5 truncate">
      <div class="w-11 h-11 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center shrink-0 shadow-sm">
        <span class="material-symbols-outlined text-2xl">rocket_launch</span>
      </div>
      <div class="flex flex-col truncate">
        <span class="text-xl font-black tracking-tight text-[var(--md-sys-color-on-surface)] truncate">
          {{ currentNodeName }}
        </span>
        <span class="text-[11px] opacity-40 truncate mt-0.5">点击全览全部节点与分流策略组</span>
      </div>
    </div>

    <div class="text-[11px] opacity-40 border-t border-[var(--md-sys-color-outline-variant)]/10 pt-2 flex justify-between items-center font-mono">
      <span>类型: {{ clashStore.proxies[currentNodeName]?.type || 'Proxy' }}</span>
      <span class="text-[var(--md-sys-color-primary)] font-bold">管理所有 {{ clashStore.primaryProxyGroup?.all?.length || 0 }} 个节点 →</span>
    </div>
  </div>
</template>