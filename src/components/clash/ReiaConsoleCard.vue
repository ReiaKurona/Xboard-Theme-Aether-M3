<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/linear-progress.js'
import { useClashStore } from '../../stores/clash'
import ClashSettingSwitch from './ClashSettingSwitch.vue'

const client = useClashStore()
const settings = computed(() => client.status?.settings)
const disabled = computed(() => client.operationBusy || !settings.value)
const modes = { rule: '规则分流', global: '全局代理', direct: '直连' }
const route = computed(() => settings.value ? modes[settings.value.outbound_mode] : '')
const title = computed(() => {
  if (!client.kernelReady) return '等待内核就绪'
  return client.status?.is_actually_intercepting ? '代理已启用' : '代理已暂停'
})
const error = computed(() => client.operationError || client.lastError || client.subscriptionError)

function toggleProxy() {
  void client.setEnabled(!client.isEnabled).catch(() => {})
}

function setPreference(key: 'use_system_proxy' | 'use_tun', value: boolean) {
  void client.runOperation('/api/agent/settings', { [key]: value }).catch(() => {})
}
</script>

<template>
  <section data-reia-console class="clash-surface h-full flex flex-col gap-4">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm font-bold">ReiaClash</p>
      <span class="clash-pill" :data-active="client.kernelReady">{{ client.kernelReady ? (client.coreVersion ? `${client.status?.core_kind === 'meow-rs' ? 'meow-rs' : 'mihomo'} ${client.coreVersion}` : '内核就绪') : '客户端已连接' }}</span>
    </header>

    <div class="reia-outbound">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="clash-heading" data-reia-proxy-status>{{ title }}</h3>
          <span v-if="route && client.kernelReady" class="reia-route">{{ route }}</span>
        </div>
        <p class="mt-2 text-xs font-semibold">出口 IP <span v-if="client.outboundIpInfo?.countryCode">· {{ client.outboundIpInfo.countryCode }}</span></p>
        <p data-reia-outbound-ip aria-live="polite" class="reia-address mt-0.5" :class="{ 'has-address': client.outboundIpInfo }">
          {{ client.outboundIpInfo?.ipv6 && client.outboundIpInfo.ip === client.outboundIpInfo.ipv6
            ? 'IPv4 未测得'
            : client.outboundIpInfo?.ip || (client.outboundIpLoading ? '正在检测…' : '出口 IP 暂不可用') }}
        </p>
        <p v-if="client.outboundIpInfo?.ipv6 !== undefined" class="reia-address mt-0.5" data-reia-outbound-ipv6>
          IPv6 · {{ client.outboundIpInfo.ipv6 || '未测得' }}
        </p>
      </div>
      <md-filled-button data-reia-master :aria-pressed="client.isEnabled || false" :disabled="disabled" @click="toggleProxy">
        {{ client.operationBusy ? '正在应用…' : client.isEnabled ? '暂停代理' : '启动代理' }}
      </md-filled-button>
      <md-linear-progress v-if="client.operationBusy" indeterminate aria-label="正在应用客户端设置"></md-linear-progress>
    </div>

    <div class="grid sm:grid-cols-2 gap-2 text-sm">
      <ClashSettingSwitch label="系统代理" :selected="!!settings?.use_system_proxy" :disabled="disabled" @change="setPreference('use_system_proxy', $event)" />
      <ClashSettingSwitch label="TUN 模式" :selected="!!settings?.use_tun" :disabled="disabled" @change="setPreference('use_tun', $event)" />
    </div>

    <div class="flex flex-wrap items-center justify-end gap-1">
      <RouterLink :to="{ name: 'ReiaSubscription' }" custom v-slot="{ href, navigate }"><md-text-button :href="href" @click="navigate">订阅同步</md-text-button></RouterLink>
      <RouterLink :to="{ name: 'ClashSettings' }" custom v-slot="{ href, navigate }"><md-text-button :href="href" @click="navigate">客户端设置</md-text-button></RouterLink>
    </div>
    <p v-if="error" role="alert" class="clash-error text-sm">{{ error }}</p>
  </section>
</template>

<style scoped>
[data-reia-console] { container-type: inline-size; }
.reia-outbound {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: clamp(1rem, 3vw, 1.5rem);
  border-radius: 22px;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}
.reia-outbound md-filled-button { --md-filled-button-container-height: 52px; --md-filled-button-container-shape: 17px; }
.reia-outbound md-linear-progress { grid-column: 1 / -1; }
.reia-route { border-radius: 999px; border: 1px solid currentColor; padding: .2rem .55rem; font-size: .72rem; }
.reia-address { overflow-wrap: anywhere; font-size: .9rem; }
.reia-address.has-address { font: 700 clamp(1rem, 2.4vw, 1.5rem) / 1.3 ui-monospace, monospace; }
@container (max-width: 470px) {
  .reia-outbound { grid-template-columns: minmax(0, 1fr); }
  .reia-outbound md-filled-button { width: 100%; }
}
</style>
