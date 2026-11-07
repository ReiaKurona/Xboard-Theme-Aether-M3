<script setup lang="ts">
import { useClashStore } from '../../stores/clash'

const clashStore = useClashStore()
</script>

<template>
  <div class="h-full p-5 md:p-6 rounded-[28px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent flex flex-col justify-between shadow-sm select-none">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-lg">alt_route</span>
        <span class="text-xs font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider">分流路由模式</span>
      </div>
      <span class="text-[10px] opacity-50 font-mono">端口: {{ clashStore.config?.['mixed-port'] || 7890 }}</span>
    </div>

    <!-- 模式选择分段器 -->
    <div class="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] my-3">
      <button
        v-for="m in [
          { id: 'rule', label: '规则分流' },
          { id: 'global', label: '全局代理' },
          { id: 'direct', label: '全直连' }
        ]"
        :key="m.id"
        @click="clashStore.changeMode(m.id as any)"
        class="py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
        :class="clashStore.config?.mode?.toLowerCase() === m.id
          ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm'
          : 'opacity-60 hover:opacity-100'"
      >
        {{ m.label }}
      </button>
    </div>

    <div class="text-[10px] opacity-40 border-t border-[var(--md-sys-color-outline-variant)]/10 pt-2">
      点击即时下发 PATCH /configs 切换内核工作方式
    </div>
  </div>
</template>