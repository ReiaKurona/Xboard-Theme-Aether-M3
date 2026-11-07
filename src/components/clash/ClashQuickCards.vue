<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClashStore } from '../../stores/clash'
import { formatBytes } from '../../stores/user'

const router = useRouter()
const clashStore = useClashStore()

const currentNodeName = computed(() => {
  return clashStore.primaryProxyGroup?.now || '未指定节点'
})

const currentNodeDelay = computed(() => {
  const node = clashStore.proxies[currentNodeName.value]
  return node?.history?.slice(-1)[0]?.delay || 0
})
</script>

<template>
  <div v-if="clashStore.isEnabled && clashStore.isConnected" class="col-span-1 md:col-span-2 xl:col-span-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full select-none">
    
    <!-- 1. 实时吞吐带宽卡 -->
    <div class="p-5 rounded-[28px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider">实时吞吐</span>
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      </div>
      <div class="my-3 flex items-baseline justify-between font-mono">
        <div class="flex flex-col">
          <span class="text-[10px] opacity-40">上行</span>
          <span class="text-lg font-black text-purple-400">↑ {{ formatBytes(clashStore.traffic.up) }}/s</span>
        </div>
        <div class="flex flex-col text-right">
          <span class="text-[10px] opacity-40">下行</span>
          <span class="text-lg font-black text-cyan-400">↓ {{ formatBytes(clashStore.traffic.down) }}/s</span>
        </div>
      </div>
      <span class="text-[10px] opacity-40">内核版本: {{ clashStore.coreVersion }}</span>
    </div>

    <!-- 2. 路由分流模式切换 -->
    <div class="p-5 rounded-[28px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider">分流模式</span>
        <span class="material-symbols-outlined text-base opacity-40">alt_route</span>
      </div>
      <div class="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] my-2">
        <button
          v-for="m in [
            { id: 'rule', label: '规则分流' },
            { id: 'global', label: '全局代理' },
            { id: 'direct', label: '全直连' }
          ]"
          :key="m.id"
          @click="clashStore.changeMode(m.id as any)"
          class="py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          :class="clashStore.config?.mode?.toLowerCase() === m.id
            ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm'
            : 'opacity-60 hover:opacity-100'"
        >
          {{ m.label }}
        </button>
      </div>
      <span class="text-[10px] opacity-40 font-mono">端口: {{ clashStore.config?.['mixed-port'] || 7890 }}</span>
    </div>

    <!-- 🌟 3. 出站主代理组卡片：彻底移除滚动条，改为高质感跳转卡片 -->
    <div
      @click="router.push('/proxies')"
      class="col-span-1 md:col-span-2 p-5 rounded-[28px] bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-black/5 dark:border-transparent flex flex-col justify-between shadow-sm cursor-pointer transition-all active:scale-[0.99] group"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider">
            当前出站 [{{ clashStore.primaryProxyGroup?.name || 'ReiaNEXT' }}]
          </span>
          <span v-if="currentNodeDelay > 0" class="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 font-mono">
            {{ currentNodeDelay }} ms
          </span>
        </div>

        <div class="flex items-center gap-1 text-xs text-[var(--md-sys-color-primary)] font-bold group-hover:translate-x-0.5 transition-transform">
          <span>进入节点选择</span>
          <span class="material-symbols-outlined text-sm">arrow_forward</span>
        </div>
      </div>

      <!-- 当前出站节点展示 -->
      <div class="my-3 flex items-center justify-between">
        <div class="flex items-center gap-2.5 truncate">
          <div class="w-10 h-10 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-xl">rocket_launch</span>
          </div>
          <span class="text-lg font-black tracking-tight text-[var(--md-sys-color-on-surface)] truncate">
            {{ currentNodeName }}
          </span>
        </div>
      </div>

      <span class="text-[10px] opacity-40">点击卡片全览所有分流组与落地节点</span>
    </div>

  </div>
</template>