<script setup lang="ts">
import { ref } from 'vue'
import { useClashStore } from '../../stores/clash'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/progress/linear-progress.js'
import '@material/web/textfield/outlined-text-field.js'

const client = useClashStore()
const url = ref(''), message = ref(''), failed = ref(false)
const run = async (refresh = false) => {
  if (!refresh && !url.value.trim()) return
  message.value = ''; failed.value = false
  try {
    await client.runOperation(refresh ? '/api/subscription/refresh' : '/api/subscription/url', refresh ? undefined : { url: url.value.trim() })
    message.value = '订阅已更新'
    if (!refresh) url.value = ''
  } catch (error) { failed.value = true; message.value = (error as Error).message }
}
</script>
<template>
  <div class="clash-page">
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
        <md-filled-tonal-button v-if="!client.isConnected" type="button" :disabled="client.isProbing" @click="client.connectByUser()">连接本机客户端</md-filled-tonal-button>
      </div>
      <md-linear-progress v-if="client.operationBusy" indeterminate aria-label="正在更新订阅"></md-linear-progress>
      <p v-if="message" role="status" class="text-sm" :class="failed ? 'clash-error' : 'clash-muted'">{{ message }}</p>
      <p v-else-if="client.subscriptionStatus?.last_success_at" class="clash-muted text-sm">
        最近更新 · {{ new Date(client.subscriptionStatus.last_success_at * 1000).toLocaleString() }}
      </p>
    </form>
  </div>
</template>
