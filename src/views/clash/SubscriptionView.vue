<script setup lang="ts">
import { ref } from 'vue'
import { useClashStore } from '../../stores/clash'
const client = useClashStore()
const url = ref(''), message = ref(''), failed = ref(false)
const run = async (refresh = false) => {
  if (!refresh && !url.value.trim()) return
  message.value = ''; failed.value = false
  try {
    await client.runOperation(refresh ? '/api/subscription/refresh' : '/api/subscription/url', refresh ? undefined : { url: url.value.trim() })
    message.value = '订阅已更新'; url.value = ''
  } catch (error: any) { failed.value = true; message.value = error.message }
}
</script>
<template>
  <div class="flex flex-col gap-6 w-full">
    <div><h1 class="text-2xl font-black">安装 ReiaClash 订阅</h1><p class="text-sm opacity-60 mt-2">站点自动同步之外，也可以手动安装订阅。最新安装的链接会替换客户端保存的旧链接。</p></div>
    <form @submit.prevent="run()" class="rounded-[32px] p-6 bg-[var(--md-sys-color-surface-container)] flex flex-col gap-4">
      <label class="text-sm font-bold" for="reia-subscription-url">订阅链接</label>
      <input id="reia-subscription-url" v-model="url" type="url" required autocomplete="off" spellcheck="false" placeholder="https://订阅地址" class="rounded-2xl p-4 bg-[var(--md-sys-color-surface-container-high)] outline-none focus:ring-2 focus:ring-[var(--md-sys-color-primary)]">
      <div class="flex flex-wrap gap-3">
        <button type="submit" :disabled="!client.isConnected || client.operationBusy" class="rounded-full px-6 py-3 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold disabled:opacity-40">{{ client.operationBusy ? '正在处理…' : '安装订阅' }}</button>
        <button type="button" @click="run(true)" :disabled="!client.subscriptionStatus?.has_url || client.operationBusy" class="rounded-full px-6 py-3 bg-[var(--md-sys-color-surface-container-highest)] disabled:opacity-40">刷新已保存的订阅</button>
        <button v-if="!client.isConnected" type="button" @click="client.connectByUser()" class="px-4 text-[var(--md-sys-color-primary)]">连接本机客户端</button>
      </div>
      <p v-if="message" role="status" class="text-sm whitespace-pre-wrap break-words" :class="failed ? 'text-red-500' : 'text-emerald-500'">{{ message }}</p>
      <p class="text-xs opacity-60 leading-relaxed">打开站点时自动同步，页面保持打开时每 4 小时检查一次。关闭网页后，客户端启动时与每 12 小时使用已保存的链接自动刷新；下载失败会继续使用现有配置。</p>
    </form>
  </div>
</template>
