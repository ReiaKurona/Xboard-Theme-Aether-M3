<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useClashStore } from '../../stores/clash'
import { clashApi } from '../../api/clash'
const client = useClashStore()
const settings = computed(() => client.status?.settings)
const message = ref(''), failed = ref(false), dnsDomain = ref('example.com'), dnsType = ref('A'), dnsResult = ref('')
const run = async (path: string, body?: unknown) => {
  message.value = '正在处理，请完成可能出现的系统授权…'; failed.value = false
  try { await client.runOperation(path, body); message.value = '操作已完成' }
  catch (error: any) { failed.value = true; message.value = error.message }
}
const pref = (key: string, event: Event) => run('/api/agent/settings', { [key]: (event.target as HTMLInputElement).checked })
const testDNS = async () => {
  try { dnsResult.value = JSON.stringify((await clashApi.queryDNSAPI(dnsDomain.value, dnsType.value)).data, null, 2) }
  catch (error: any) { dnsResult.value = error.message }
}
const flush = async (fakeIP = false) => {
  if (client.operationBusy) return
  client.operationBusy = true; failed.value = false
  try { await (fakeIP ? clashApi.flushFakeIPAPI() : clashApi.flushDNSCacheAPI()); message.value = '内核缓存已清空' }
  catch (error: any) { failed.value = true; message.value = error.message }
  finally { client.operationBusy = false }
}
const maintenance = [
  { label: '重启内核', path: '/api/core/restart' },
  { label: '更新内核', path: '/api/agent/upgrade', body: { is_silent: false } },
  { label: '清理客户端缓存', path: '/api/agent/cache/clear' },
  { label: '清空客户端日志', path: '/api/agent/logs/clear' },
  { label: '打开缓存目录', path: '/api/agent/directory/open', body: { directory: 'cache' } },
  { label: '打开配置目录', path: '/api/agent/directory/open', body: { directory: 'config' } },
]
</script>
<template>
  <div class="flex flex-col gap-6 text-sm">
    <section class="p-5 rounded-3xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="font-black text-lg">ReiaClash 客户端</h2><button @click="client.connectByUser()" class="text-[var(--md-sys-color-primary)]">连接本机客户端</button></div>
      <p class="opacity-60">{{ client.isConnected ? '客户端已连接' : '未探测到客户端，请启动 ReiaClash 并允许浏览器访问本地网络' }} · {{ client.kernelReady ? `Mihomo ${client.coreVersion}` : '内核待就绪' }}</p>
      <p v-if="message || client.lastError" role="status" class="whitespace-pre-wrap break-words text-xs" :class="failed || client.lastError ? 'text-red-500' : 'text-emerald-500'">{{ message || client.lastError }}</p>
      <RouterLink :to="{ name: 'ReiaSubscription' }" class="text-[var(--md-sys-color-primary)] font-bold">手动安装或刷新订阅 →</RouterLink>
    </section>
    <fieldset :disabled="!client.isConnected || client.operationBusy || !settings" class="p-5 rounded-3xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-5 disabled:opacity-60">
      <legend class="font-bold px-2">代理与网络</legend>
      <label class="flex justify-between gap-4">启动代理<input type="checkbox" :checked="settings?.enabled" @change="run('/api/agent/master', { enable: ($event.target as HTMLInputElement).checked })"></label>
      <label class="flex justify-between gap-4">系统代理<input type="checkbox" :checked="settings?.use_system_proxy" @change="pref('use_system_proxy', $event)"></label>
      <label class="flex justify-between gap-4">TUN 模式<input type="checkbox" :checked="settings?.use_tun" @change="pref('use_tun', $event)"></label>
      <label class="flex justify-between gap-4">允许局域网连接<input type="checkbox" :checked="settings?.allow_lan" @change="pref('allow_lan', $event)"></label>
      <label class="flex justify-between gap-4">TUN 协议栈<select :value="settings?.tun_stack" @change="run('/api/agent/settings', { tun_stack: ($event.target as HTMLSelectElement).value })" class="rounded-xl p-2 bg-[var(--md-sys-color-surface-container-high)]"><option v-for="stack in ['mixed','gvisor','system','mips']" :key="stack">{{ stack }}</option></select></label>
      <label class="flex justify-between gap-4">Geo 低内存模式<input type="checkbox" :checked="settings?.geo_low_memory" @change="run('/api/agent/geo-low-memory', { enable: ($event.target as HTMLInputElement).checked })"></label>
      <label class="flex justify-between gap-4">用户登录后启动<input type="checkbox" :checked="client.systemStatus?.autostart_enabled" @change="run('/api/system/autostart', { enable: ($event.target as HTMLInputElement).checked })"></label>
      <p class="text-xs opacity-60">系统代理 {{ client.status?.real_system_proxy ? '已接管' : '未接管' }} · TUN {{ client.status?.real_tun ? '已接管' : '未接管' }}</p>
      <p class="text-xs font-mono opacity-60">Mixed {{ client.config?.['mixed-port'] || 7890 }} · HTTP {{ client.config?.port || 0 }} · SOCKS {{ client.config?.['socks-port'] || 0 }} · Redir {{ client.config?.['redir-port'] || 0 }} · TProxy {{ client.config?.['tproxy-port'] || 0 }}</p>
    </fieldset>
    <fieldset :disabled="!client.isConnected || client.operationBusy" class="p-5 rounded-3xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-4">
      <legend class="font-bold px-2">特权内核服务</legend>
      <p class="text-xs opacity-70">{{ client.systemStatus?.core_service_registration?.installed ? '服务已注册' : '服务未注册' }} · {{ client.systemStatus?.core_service_ready ? '服务已就绪' : '服务未就绪' }}</p>
      <p v-if="client.systemStatus?.core_service_error || client.systemStatus?.core_service_registration?.error" class="text-xs text-red-500 break-words">{{ client.systemStatus.core_service_error || client.systemStatus.core_service_registration.error }}</p>
      <div class="flex flex-wrap gap-3"><button @click="run('/api/system/core-service', { enable: true, repair: true })" class="rounded-full px-4 py-2 bg-[var(--md-sys-color-primary-container)]">安装 / 修复服务</button><button @click="run('/api/system/core-service', { enable: false })" class="rounded-full px-4 py-2 bg-[var(--md-sys-color-surface-container-highest)]">关闭并卸载服务</button></div>
      <p class="text-xs opacity-60">服务模式退出托盘后，代理和网页管理仍可继续；卸载服务会关闭 TUN。</p>
    </fieldset>
    <fieldset :disabled="!client.isConnected || client.operationBusy" class="p-5 rounded-3xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-4">
      <legend class="font-bold px-2">内核维护</legend>
      <label class="flex justify-between gap-4">自动更新内核<input type="checkbox" :checked="settings?.auto_update_enabled" @change="pref('auto_update_enabled', $event)"></label>
      <label class="flex justify-between gap-4">内核更新检查间隔（小时）<input type="number" min="1" max="168" :value="settings?.update_interval_hours || 24" @change="run('/api/agent/settings', { update_interval_hours: Number(($event.target as HTMLInputElement).value) })" class="w-20 rounded-xl p-2 bg-[var(--md-sys-color-surface-container-high)]"></label>
      <div class="grid sm:grid-cols-2 gap-3"><button v-for="item in maintenance" :key="item.path + JSON.stringify(item.body)" @click="run(item.path, item.body)" class="text-left rounded-2xl p-3 bg-[var(--md-sys-color-surface-container-high)]">{{ item.label }}</button></div>
      <div class="flex flex-wrap gap-3 text-xs"><button :disabled="!client.kernelReady" @click="flush()" class="px-3 py-2 text-red-500 disabled:opacity-40">清空内核 DNS 缓存</button><button :disabled="!client.kernelReady" @click="flush(true)" class="px-3 py-2 text-red-500 disabled:opacity-40">清空内核 Fake IP</button></div>
    </fieldset>
    <fieldset :disabled="!client.kernelReady" class="p-5 rounded-3xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-3">
      <legend class="font-bold px-2">DNS 查询</legend>
      <div class="flex flex-wrap gap-2"><input v-model="dnsDomain" placeholder="example.com" class="flex-1 min-w-0 rounded-xl p-3 bg-[var(--md-sys-color-surface-container-high)]"><select v-model="dnsType" class="rounded-xl p-2 bg-[var(--md-sys-color-surface-container-high)]"><option>A</option><option>AAAA</option></select><button @click="testDNS" class="px-4 text-[var(--md-sys-color-primary)]">查询</button></div>
      <pre v-if="dnsResult" class="text-xs whitespace-pre-wrap break-all">{{ dnsResult }}</pre>
    </fieldset>
  </div>
</template>
