<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClashStore } from '../../stores/clash'
import { reiaApi } from '../../api/reia'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/progress/linear-progress.js'
import '@material/web/textfield/outlined-text-field.js'

const client = useClashStore()
const subscriptionSource = reiaApi.agentBase + '/subscription/source'
const url = ref(''), message = ref(''), failed = ref(false)
const beforeSuccess = ref(0), beforeAttempt = ref(0), awaitingAgent = ref(false)
const laterSuccess = computed(() => (
  (client.subscriptionStatus?.last_success_at || 0) > beforeSuccess.value ||
  (client.subscriptionStatus?.successful_attempt || 0) > beforeAttempt.value
))
const displayedMessage = computed(() => {
  if (laterSuccess.value && (failed.value || awaitingAgent.value)) return '客户端已完成订阅更新'
  if (awaitingAgent.value && client.subscriptionStatus?.last_error) return ''
  return message.value
})
const run = async (refresh = false) => {
  if (!refresh && !url.value.trim()) return
  message.value = ''; failed.value = false; awaitingAgent.value = false
  beforeSuccess.value = client.subscriptionStatus?.last_success_at || 0
  beforeAttempt.value = client.subscriptionStatus?.successful_attempt || 0
  try {
    const outcome = await client.runSubscription(refresh ? '/api/subscription/refresh' : '/api/subscription/url', refresh ? undefined : { url: url.value.trim() })
    message.value = outcome === 'confirmed' ? '订阅已更新' : outcome === 'reconciled' ? '已确认客户端最近完成了更新' : '客户端仍在刷新订阅'
    awaitingAgent.value = outcome === 'pending'
    if (!refresh && outcome === 'confirmed') url.value = ''
  } catch (error) { failed.value = true; message.value = (error as Error).message }
}
</script>
<template>
  <div class="clash-page">
    <p v-if="client.subscriptionStatus?.auto_sync_paused" class="clash-muted">自动订阅同步已暂停，手动导入后恢复。</p>
    <form @submit.prevent="run()" class="clash-surface grid gap-4">
      <h2 class="clash-heading">订阅同步</h2>
      <p class="clash-muted text-sm">客户端会自动刷新已保存的订阅。安装新链接后，将从新链接获取配置。</p>
      <md-outlined-text-field id="reia-subscription-url" label="订阅链接" type="url" :value="url" required autocomplete="off" spellcheck="false"
        :disabled="!client.isConnected || client.operationBusy" placeholder="https://订阅地址"
        @input="url = ($event.currentTarget as HTMLInputElement).value"></md-outlined-text-field>
      <div class="clash-toolbar">
        <md-filled-button type="submit" :disabled="!client.isConnected || client.operationBusy || !url.trim()">安装订阅</md-filled-button>
        <md-filled-tonal-button type="button" :disabled="!client.isConnected || !client.subscriptionStatus?.has_url || client.operationBusy"
          @click="run(true)">刷新已保存的订阅</md-filled-tonal-button>
        <a v-if="client.isConnected" :href="subscriptionSource" target="_blank" rel="noopener noreferrer" data-reia-subscription-source
          class="text-sm font-semibold underline underline-offset-4">查看订阅与内核配置</a>
        <md-filled-tonal-button v-if="!client.isConnected" type="button" :disabled="client.isProbing" @click="client.connectByUser()">连接本机客户端</md-filled-tonal-button>
      </div>
      <md-linear-progress v-if="client.operationBusy" indeterminate aria-label="正在更新订阅"></md-linear-progress>
      <p v-if="client.subscriptionStatus?.refreshing" role="status" class="clash-muted">客户端正在刷新订阅</p>
      <p v-else-if="displayedMessage" role="status" class="text-sm" :class="failed && !laterSuccess ? 'clash-error' : 'clash-muted'">{{ displayedMessage }}</p>
      <p v-if="client.subscriptionStatus?.last_error && !client.subscriptionStatus.refreshing && !(failed && !laterSuccess && displayedMessage)" class="clash-error text-sm">
        {{ client.subscriptionStatus.last_error }}
      </p>
      <p v-if="client.subscriptionStatus?.last_success_at" class="clash-muted text-sm">
        最近更新 · {{ new Date(client.subscriptionStatus.last_success_at * 1000).toLocaleString() }}
      </p>
    </form>
  </div>
</template>
