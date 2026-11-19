<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/dialog/dialog.js'
import '@material/web/progress/linear-progress.js'
import '@material/web/textfield/outlined-text-field.js'
import { useClashStore } from '../../stores/clash'
import { clashApi } from '../../api/clash'
import ClashSelect from './ClashSelect.vue'
import ClashSettingSwitch from './ClashSettingSwitch.vue'

const client = useClashStore()
const settings = computed(() => client.status?.settings)
const unavailable = computed(() => !client.isConnected || client.operationBusy)
const settingsDisabled = computed(() => unavailable.value || !settings.value)
const service = computed(() => client.systemStatus?.core_service_registration)
const serviceError = computed(() => client.systemStatus?.core_service_error || service.value?.error)
const tunDevice = ref('')
const interval = ref('')
watch(() => settings.value?.tun_device, value => { tunDevice.value = value || '' }, { immediate: true })
watch(() => settings.value?.update_interval_hours, value => { interval.value = value ? String(value) : '' }, { immediate: true })
const intervalValid = computed(() => /^\d+$/.test(interval.value) && Number(interval.value) >= 1 && Number(interval.value) <= 168)
const message = ref(''), error = ref('')
const dnsDomain = ref(''), dnsType = ref('A'), dnsResult = ref(''), dnsError = ref(''), dnsBusy = ref(false)
const removeDialog = ref<(HTMLElement & { show(): Promise<void>; close(): Promise<void> }) | null>(null)
const stacks = ['mips', 'mixed', 'gvisor', 'system'].map(value => ({ value, label: value }))
const dnsTypes = ['A', 'AAAA', 'CNAME', 'HTTPS', 'TXT'].map(value => ({ value, label: value }))
const networkOptions = [
  { key: 'use_system_proxy', label: '系统代理', description: '应用到支持系统代理的程序' },
  { key: 'use_tun', label: 'TUN 模式', description: '通过虚拟网卡接管网络流量' },
  { key: 'allow_lan', label: '允许局域网连接', description: '开放代理端口，控制接口仍限本机' },
] as const
const maintenance = [
  { label: '重启内核', path: '/api/core/restart' },
  { label: '更新内核', path: '/api/agent/upgrade', body: { is_silent: false } },
  { label: '清理客户端缓存', path: '/api/agent/cache/clear' },
  { label: '清空客户端日志', path: '/api/agent/logs/clear' },
  { label: '打开缓存目录', path: '/api/agent/directory/open', body: { directory: 'cache' } },
  { label: '打开配置目录', path: '/api/agent/directory/open', body: { directory: 'config' } },
]
const ports = computed(() => [
  { label: '混合代理', value: client.config?.['mixed-port'] },
  { label: 'HTTP', value: client.config?.port },
  { label: 'SOCKS', value: client.config?.['socks-port'] },
  { label: 'Redir', value: client.config?.['redir-port'] },
  { label: 'TProxy', value: client.config?.['tproxy-port'] },
].filter(port => port.value > 0))

const inputValue = (event: Event) => (event.currentTarget as HTMLInputElement).value
async function operation(task: () => Promise<unknown>, success = '设置已应用') {
  message.value = ''; error.value = ''
  try { await task(); message.value = success }
  catch (cause) { error.value = (cause as Error).message }
}
function run(path: string, body?: unknown, success?: string) {
  return operation(() => client.runOperation(path, body), success)
}
function setting(key: string, value: string | number | boolean) {
  return run('/api/agent/settings', { [key]: value })
}
async function testDNS() {
  if (dnsBusy.value || !client.kernelReady || !dnsDomain.value.trim()) return
  dnsBusy.value = true; dnsError.value = ''; dnsResult.value = ''
  try { dnsResult.value = JSON.stringify((await clashApi.queryDNSAPI(dnsDomain.value.trim(), dnsType.value)).data, null, 2) }
  catch (cause) { dnsError.value = (cause as Error).message }
  finally { dnsBusy.value = false }
}
function flush(fakeIP = false) {
  return operation(() => client.runMutation(() => fakeIP ? clashApi.flushFakeIPAPI() : clashApi.flushDNSCacheAPI()), '内核缓存已清空')
}
</script>

<template>
  <div class="clash-page text-sm">
    <section class="clash-surface grid gap-3">
      <div class="clash-toolbar justify-between">
        <h2 class="clash-heading">本机客户端</h2>
        <span class="clash-pill" :data-active="client.kernelReady" data-reia-settings-state>
          {{ client.kernelReady ? `内核就绪${client.coreVersion ? ' · ' + client.coreVersion : ''}` : client.isConnected ? '等待内核就绪' : '客户端未连接' }}
        </span>
      </div>
      <div class="clash-toolbar">
        <md-filled-tonal-button v-if="!client.isConnected" :disabled="client.isProbing" @click="client.connectByUser()">连接本机客户端</md-filled-tonal-button>
        <RouterLink :to="{ name: 'ReiaSubscription' }" custom v-slot="{ href, navigate }"><md-text-button :href="href" @click="navigate">订阅同步</md-text-button></RouterLink>
      </div>
      <md-linear-progress v-if="client.operationBusy" indeterminate aria-label="正在应用客户端设置"></md-linear-progress>
      <p v-if="error || client.lastError" role="alert" class="clash-error">{{ error || client.lastError }}</p>
      <p v-else-if="client.operationBusy || message" role="status" class="clash-muted">{{ client.operationBusy ? '正在应用设置，系统可能会请求授权' : message }}</p>
    </section>

    <section class="clash-surface grid gap-3" aria-labelledby="reia-network-heading">
      <h2 id="reia-network-heading" class="clash-heading">代理与网络</h2>
      <ClashSettingSwitch label="接管流量" :selected="!!settings?.enabled" :disabled="settingsDisabled"
        @change="run('/api/agent/master', { enable: $event })" />
      <ClashSettingSwitch v-for="item in networkOptions" :key="item.key" :label="item.label" :description="item.description"
        :selected="!!settings?.[item.key]" :disabled="settingsDisabled" @change="setting(item.key, $event)" />
      <div class="clash-inline-control">
        <ClashSelect label="TUN 协议栈" :model-value="settings?.tun_stack || ''" :options="stacks" :disabled="settingsDisabled"
          @update:model-value="setting('tun_stack', $event)" />
        <template v-if="settings?.tun_device !== undefined">
          <md-outlined-text-field label="TUN 网卡名" placeholder="留空自动选择" maxlength="15" :value="tunDevice"
            :disabled="settingsDisabled" @input="tunDevice = inputValue($event)"></md-outlined-text-field>
          <md-filled-tonal-button :disabled="settingsDisabled || tunDevice.trim() === settings.tun_device"
            @click="setting('tun_device', tunDevice.trim())">保存网卡名</md-filled-tonal-button>
        </template>
      </div>
      <p v-if="client.status" class="clash-muted text-xs">
        系统代理 {{ client.status.real_system_proxy ? '已接管' : '未接管' }} · TUN {{ client.status.real_tun ? '已接管' : '未接管' }}
        <span v-if="client.status.real_tun_device"> · {{ client.status.real_tun_device }}</span>
      </p>
      <dl v-if="ports.length" class="clash-stat-grid">
        <div v-for="port in ports" :key="port.label" class="clash-stat"><dt>{{ port.label }}</dt><dd>{{ port.value }}</dd></div>
      </dl>
    </section>

    <section class="clash-surface grid gap-3" aria-labelledby="reia-service-heading">
      <div class="clash-toolbar justify-between">
        <h2 id="reia-service-heading" class="clash-heading">特权内核服务</h2>
        <span class="clash-pill" :data-active="client.systemStatus?.core_service_ready">
          {{ client.systemStatus?.core_service_ready ? '服务已就绪' : service?.installed ? '已注册 · 等待就绪' : service ? '未注册' : '等待状态' }}
        </span>
      </div>
      <p v-if="serviceError" class="clash-error" role="alert">{{ serviceError }}</p>
      <div class="clash-toolbar">
        <md-filled-tonal-button :disabled="unavailable || client.systemStatus?.core_service_supported === false"
          @click="run('/api/system/core-service', { enable: true, repair: true }, '服务操作已完成')">安装或修复</md-filled-tonal-button>
        <md-text-button :disabled="unavailable || !(service?.installed || client.systemStatus?.core_service_delegated)"
          @click="removeDialog?.show()">卸载服务</md-text-button>
      </div>
      <ClashSettingSwitch label="登录时启动客户端" :selected="!!client.systemStatus?.autostart_enabled"
        :disabled="unavailable || !client.systemStatus" @change="run('/api/system/autostart', { enable: $event })" />
      <md-dialog ref="removeDialog">
        <span slot="headline">卸载内核服务</span>
        <p slot="content">卸载会关闭 TUN 并切换到普通模式。</p>
        <div slot="actions">
          <md-text-button @click="removeDialog?.close()">取消</md-text-button>
          <md-filled-button :disabled="unavailable" @click="removeDialog?.close(); run('/api/system/core-service', { enable: false }, '服务已卸载')">卸载</md-filled-button>
        </div>
      </md-dialog>
    </section>

    <section class="clash-surface grid gap-3" aria-labelledby="reia-maintenance-heading">
      <h2 id="reia-maintenance-heading" class="clash-heading">内核维护</h2>
      <ClashSettingSwitch label="Geo 低内存模式" description="更改后会重新启动内核" :selected="!!settings?.geo_low_memory"
        :disabled="settingsDisabled" @change="run('/api/agent/geo-low-memory', { enable: $event })" />
      <ClashSettingSwitch label="自动检查内核更新" :selected="!!settings?.auto_update_enabled"
        :disabled="settingsDisabled" @change="setting('auto_update_enabled', $event)" />
      <div class="clash-inline-control">
        <md-outlined-text-field label="更新检查间隔（小时）" supporting-text="1–168 小时" type="number" min="1" max="168"
          :value="interval" :disabled="settingsDisabled" @input="interval = inputValue($event)"></md-outlined-text-field>
        <md-filled-tonal-button :disabled="settingsDisabled || !intervalValid || Number(interval) === settings?.update_interval_hours"
          @click="setting('update_interval_hours', Number(interval))">保存间隔</md-filled-tonal-button>
      </div>
      <div class="clash-toolbar">
        <md-filled-tonal-button v-for="item in maintenance" :key="item.label" :disabled="unavailable"
          @click="run(item.path, item.body, item.path === '/api/core/restart' ? '已请求重启内核' : '操作已完成')">{{ item.label }}</md-filled-tonal-button>
      </div>
    </section>

    <section class="clash-surface grid gap-3" aria-labelledby="reia-dns-heading">
      <h2 id="reia-dns-heading" class="clash-heading">DNS 诊断</h2>
      <form class="clash-toolbar" @submit.prevent="testDNS">
        <md-outlined-text-field label="查询域名" placeholder="example.com" :value="dnsDomain" :disabled="!client.kernelReady || dnsBusy"
          @input="dnsDomain = inputValue($event)"></md-outlined-text-field>
        <ClashSelect label="记录类型" :options="dnsTypes" v-model="dnsType" :disabled="!client.kernelReady || dnsBusy" />
        <md-filled-button type="submit" :disabled="!client.kernelReady || dnsBusy || !dnsDomain.trim()">{{ dnsBusy ? '正在查询' : '查询' }}</md-filled-button>
      </form>
      <p v-if="dnsError" role="alert" class="clash-error">{{ dnsError }}</p>
      <pre v-if="dnsResult" class="clash-muted whitespace-pre-wrap break-all rounded-2xl p-3 bg-[var(--md-sys-color-surface-container-low)]">{{ dnsResult }}</pre>
      <div class="clash-toolbar">
        <md-text-button :disabled="unavailable || !client.kernelReady" @click="flush()">清空 DNS 缓存</md-text-button>
        <md-text-button :disabled="unavailable || !client.kernelReady" @click="flush(true)">清空 Fake IP 缓存</md-text-button>
      </div>
    </section>
  </div>
</template>
