<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-tonal-button.js'
import { reiaApi } from '../../api/reia'
import { useClashStore } from '../../stores/clash'
import ClashSettingSwitch from '../../components/clash/ClashSettingSwitch.vue'

type Resource = { id: string; name: string; bytes: number; updated_at?: number }
type ResourceStatus = { entries: Resource[]; auto_update: boolean; interval_hours: number; kinds: string[]; last_updated: number }
const client = useClashStore()
const status = ref<ResourceStatus | null>(null)
const selected = ref<string[]>([])
const autoUpdate = ref(false)
const interval = ref(24)
const busy = ref(false)
const error = ref('')
const message = ref('')
let request: AbortController | undefined

function show(data: ResourceStatus, settings = true) {
  status.value = data
  if (settings) {
    selected.value = data.kinds
    autoUpdate.value = data.auto_update
    interval.value = data.interval_hours
  }
}

async function refresh(settings = true) {
  request?.abort()
  const current = new AbortController()
  request = current
  try {
    const data = await reiaApi.agent<ResourceStatus>('/api/agent/resources', 'GET', undefined, current.signal)
    if (request === current) show(data, settings)
  } catch (cause) {
    if (!current.signal.aborted) error.value = (cause as Error).message
  }
}
function choose(id: string, checked: boolean) {
  selected.value = checked ? [...selected.value, id] : selected.value.filter(item => item !== id)
}
async function action(sync: boolean) {
  busy.value = true
  error.value = message.value = ''
  try {
    const data = await client.runMutation(() => reiaApi.agent<ResourceStatus>(
      sync ? '/api/agent/resources/sync' : '/api/agent/resources/settings', 'POST',
      sync ? { kinds: selected.value } : { kinds: selected.value, enable: autoUpdate.value, interval_hours: interval.value }
    ))
    show(data, !sync)
    message.value = sync ? '资源同步完成' : '定时设置已保存'
  } catch (cause) {
    error.value = (cause as Error).message
    if (sync) await refresh(false)
  } finally { busy.value = false }
}
watch(() => client.isConnected, connected => { if (connected) void refresh() }, { immediate: true })
onUnmounted(() => request?.abort())
</script>

<template>
  <div class="clash-page text-sm">
    <section class="clash-surface grid gap-3">
      <div class="clash-toolbar justify-between">
        <h2 class="clash-heading">外部资源管理</h2>
        <RouterLink :to="{ name: 'ClashSettings' }" custom v-slot="{ href, navigate }">
          <md-text-button :href="href" @click="navigate">返回客户端设置</md-text-button>
        </RouterLink>
      </div>
      <p v-if="!status && !error" role="status">正在读取资源…</p>
      <ClashSettingSwitch v-for="item of status?.entries || []" :key="item.id" :label="item.name"
        :description="item.updated_at ? `${(item.bytes / 1048576).toFixed(1)} MiB · ${new Date(item.updated_at * 1000).toLocaleString()}` : item.id === 'rules' ? '同步当前配置中声明的远程规则集' : '尚未缓存'"
        :selected="selected.includes(item.id)" :disabled="busy" @change="choose(item.id, $event)" />
      <ClashSettingSwitch label="定时更新所选资源" :selected="autoUpdate" :disabled="busy || !status" @change="autoUpdate = $event" />
      <label class="clash-inline-control">
        更新间隔（小时）
        <input v-model.number="interval" class="clash-input" type="number" min="1" max="168" :disabled="busy || !status" />
      </label>
      <p v-if="status?.last_updated" class="clash-muted">最近定时同步 {{ new Date(status.last_updated * 1000).toLocaleString() }}</p>
      <p v-if="error" role="alert" class="clash-error">{{ error }}</p>
      <p v-else-if="message" role="status">{{ message }}</p>
      <div class="clash-toolbar">
        <md-filled-tonal-button :disabled="busy || !client.isConnected || !selected.length" @click="action(true)">同步所选资源</md-filled-tonal-button>
        <md-text-button :disabled="busy || !status || interval < 1 || interval > 168 || (autoUpdate && !selected.length)" @click="action(false)">保存定时设置</md-text-button>
      </div>
    </section>
  </div>
</template>
