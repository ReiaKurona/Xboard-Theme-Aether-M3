<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useClashStore } from '../../stores/clash'
const client = useClashStore()
const message = ref('')
const settings = computed(() => client.status?.settings)
const title = computed(() => !client.kernelReady ? '内核待就绪' : client.status?.is_actually_intercepting ? '正在保护你的连接' : '代理已暂停')
const update = async (path: string, body: unknown) => {
  message.value = ''
  try { await client.runOperation(path, body) } catch (error: any) { message.value = error.message }
}
const lastSync = computed(() => client.subscriptionStatus?.last_success_at ? new Date(client.subscriptionStatus.last_success_at * 1000).toLocaleString() : '等待首次同步')
</script>

<template>
  <section data-reia-console class="h-full rounded-[32px] p-6 sm:p-7 bg-[var(--md-sys-color-surface-container)] shadow-sm flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-5">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-3xl text-[var(--md-sys-color-primary)]">shield</span>
        <div><p class="text-xs font-bold text-[var(--md-sys-color-primary)]">ReiaClash 控制台</p><h3 class="text-xl font-extrabold mt-1">{{ title }}</h3></div>
      </div>
      <button data-reia-master role="switch" :aria-checked="settings?.enabled || false" :disabled="client.operationBusy || !settings"
        @click="update('/api/agent/master', { enable: !settings?.enabled })"
        class="reia-master-switch font-bold transition-colors disabled:opacity-50"
        :class="settings?.enabled ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]' : 'bg-[var(--md-sys-color-surface-container-highest)]'">
        {{ client.operationBusy ? '正在应用…' : settings?.enabled ? '暂停代理' : '启动代理' }}
        <span aria-hidden="true" class="reia-switch-track" :class="{ selected: settings?.enabled }"><span></span></span>
      </button>
    </div>
    <div class="flex flex-wrap items-center gap-4 text-sm">
      <label class="flex items-center gap-2"><input type="checkbox" :checked="settings?.use_system_proxy" :disabled="client.operationBusy || !settings" @change="update('/api/agent/settings', { use_system_proxy: ($event.target as HTMLInputElement).checked })">系统代理</label>
      <label class="flex items-center gap-2"><input type="checkbox" :checked="settings?.use_tun" :disabled="client.operationBusy || !settings" @change="update('/api/agent/settings', { use_tun: ($event.target as HTMLInputElement).checked })">TUN 模式</label>
      <span class="text-xs opacity-60">{{ client.kernelReady ? `Mihomo ${client.coreVersion}` : '客户端已连接，等待内核' }}</span>
      <RouterLink :to="{ name: 'ClashSettings' }" class="ml-auto text-[var(--md-sys-color-primary)] font-bold">客户端设置 →</RouterLink>
    </div>
    <div class="flex flex-wrap justify-between gap-2 text-xs opacity-70">
      <span>{{ client.subscriptionStatus?.refreshing ? '正在刷新订阅…' : `最近订阅同步：${lastSync}` }}</span>
      <RouterLink :to="{ name: 'ReiaSubscription' }" class="text-[var(--md-sys-color-primary)]">手动安装订阅</RouterLink>
    </div>
    <p v-if="message || client.lastError || client.subscriptionError || client.subscriptionStatus?.last_error" role="alert" class="text-xs text-red-500 whitespace-pre-wrap break-words">{{ message || client.lastError || client.subscriptionError || client.subscriptionStatus?.last_error }}</p>
  </section>
</template>
<style scoped>
.reia-master-switch { display:inline-flex; align-items:center; gap:14px; padding:12px 18px; border-radius:999px; }
.reia-switch-track { width:48px; height:28px; border-radius:999px; display:inline-flex; align-items:center; padding:4px; background:var(--md-sys-color-outline-variant, #a8abb3); }
.reia-switch-track > span { width:20px; height:20px; border-radius:50%; background:var(--md-sys-color-surface, #fff); transition:transform .2s; }
.reia-switch-track.selected { background:var(--md-sys-color-primary-container); }
.reia-switch-track.selected > span { transform:translateX(20px); background:var(--md-sys-color-primary); }
</style>
