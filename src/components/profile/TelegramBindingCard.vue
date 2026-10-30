<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../../stores/user'
import { api } from '../../api/client'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'

const userStore = useUserStore()
const botUsername = ref('')
const copied = ref(false)

const isBound = computed(() => Boolean(userStore.userInfo?.telegram_id))

const fetchBotInfo = async () => {
  try {
    const res: any = await api.get('/user/telegram/getBotInfo')
    botUsername.value = res.username || res.data?.username || ''
  } catch (err) {
    botUsername.value = ''
  }
}

// 复制一键绑定指令
const copyBindCommand = async () => {
  const subUrl = userStore.subscribeInfo?.subscribe_url || ''
  const cmd = `/bind ${subUrl}`
  await navigator.clipboard.writeText(cmd)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

// 跳转机器人
const openTelegramBot = () => {
  if (!botUsername.value) return
  const token = userStore.subscribeInfo?.token || ''
  window.open(`https://t.me/${botUsername.value}?start=${token}`, '_blank')
}

onMounted(() => {
  fetchBotInfo()
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="p-6 md:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm h-full flex flex-col justify-between">
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-2xl">send</span>
          <h3 class="text-xl font-black tracking-tight">Telegram 机器人联动</h3>
        </div>
        <span
          class="text-xs px-2.5 py-1 rounded-full font-bold"
          :class="isBound ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'"
        >
          {{ isBound ? '已绑定' : '未绑定' }}
        </span>
      </div>
      <p class="text-xs opacity-60 mb-5 leading-normal">
        绑定 Telegram 账号后，您可在 Telegram 群组享受验证服务，并随时向机器人发送指令查询流量与获取最新节点。
      </p>

      <!-- 绑定状态与卡片 -->
      <div v-if="isBound" class="p-4 rounded-2xl bg-emerald-500/10 text-xs flex flex-col gap-1.5">
        <span class="font-bold text-emerald-600 dark:text-emerald-400">✅ 您的 Telegram 账户已成功绑定</span>
        <span class="opacity-70">绑定 Telegram ID：{{ userStore.userInfo?.telegram_id }}</span>
      </div>

      <div v-else class="flex flex-col gap-3">
        <div class="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 text-xs flex flex-col gap-1">
          <span class="font-bold">绑定方式一（推荐一键绑定）：</span>
          <span class="opacity-60">点击下方按钮直接跳转机器人，发送 /start 即可完成自动化握手绑定。</span>
        </div>
        <div class="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 text-xs flex flex-col gap-1">
          <span class="font-bold">绑定方式二（手动私聊绑定）：</span>
          <span class="opacity-60">向 @{{ botUsername || '官方机器人' }} 发送指令：<code>/bind 您的订阅链接</code></span>
        </div>
      </div>
    </div>

    <!-- 交互动作 -->
    <div class="flex flex-wrap items-center justify-end gap-2.5 mt-4 pt-4 border-t border-[var(--md-sys-color-outline-variant)]/10">
      <md-filled-tonal-button v-if="!isBound" @click="copyBindCommand">
        <span class="material-symbols-outlined text-base" slot="icon">{{ copied ? 'check' : 'content_copy' }}</span>
        {{ copied ? '指令已复制' : '复制 /bind 指令' }}
      </md-filled-tonal-button>

      <md-filled-button @click="openTelegramBot" :disabled="!botUsername">
        <span class="material-symbols-outlined text-base" slot="icon">open_in_new</span>
        打开 Telegram 机器人
      </md-filled-button>
    </div>
  </div>
</template>