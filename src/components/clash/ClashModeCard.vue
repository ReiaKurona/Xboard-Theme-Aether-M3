<script setup lang="ts">
import { ref } from 'vue'
import { useClashStore } from '../../stores/clash'
import '@material/web/chips/filter-chip.js'

const client = useClashStore()
const error = ref('')
const modes = [{ id: 'rule', label: '规则分流' }, { id: 'global', label: '全局代理' }, { id: 'direct', label: '直连' }] as const
async function select(mode: typeof modes[number]['id']) {
  if (!client.kernelReady || client.operationBusy || client.status?.settings.outbound_mode === mode) return
  error.value = ''
  try { await client.changeMode(mode) }
  catch (cause) { error.value = (cause as Error).message }
}
</script>

<template>
  <section class="clash-surface h-full flex flex-col justify-between gap-3">
    <div class="clash-toolbar justify-between">
      <h3 class="clash-heading">路由模式</h3>
      <span v-if="client.config?.['mixed-port']" class="clash-muted text-xs">混合代理 {{ client.config['mixed-port'] }}</span>
    </div>
    <div class="clash-toolbar">
      <md-filter-chip v-for="mode in modes" :key="mode.id" :selected="client.status?.settings.outbound_mode === mode.id"
        :disabled="!client.kernelReady || client.operationBusy" :label="mode.label" @click.prevent="select(mode.id)"></md-filter-chip>
    </div>
    <p v-if="error" role="alert" class="clash-error text-sm">{{ error }}</p>
  </section>
</template>
