<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '../../stores/user'
import '@material/web/button/filled-tonal-button.js'

const userStore = useUserStore()
const copied = ref(false)

const copyUuid = async () => {
  if (!userStore.userInfo?.uuid) return
  await navigator.clipboard.writeText(userStore.userInfo.uuid)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const formatDate = (ts: number) => {
  if (!ts) return '未知'
  return new Date(ts * 1000).toLocaleDateString()
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="p-6 md:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm flex flex-col justify-between h-full">
    <div>
      <div class="flex items-center gap-4 mb-6">
        <img
          v-if="userStore.userInfo?.avatar_url"
          :src="userStore.userInfo.avatar_url"
          class="w-16 h-16 rounded-full object-cover shadow"
        />
        <div v-else class="w-16 h-16 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center font-extrabold text-2xl">
          {{ (userStore.userInfo?.email || 'U').slice(0, 1).toUpperCase() }}
        </div>

        <div class="flex flex-col truncate">
          <span class="text-xl font-black tracking-tight truncate">{{ userStore.userInfo?.email || '加载中...' }}</span>
          <span class="text-xs opacity-60 mt-0.5">注册时间：{{ formatDate(userStore.userInfo?.created_at) }}</span>
        </div>
      </div>

      <!-- 用户凭据与 UUID -->
      <div class="flex flex-col gap-2 p-4 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 text-xs">
        <div class="flex items-center justify-between">
          <span class="font-bold opacity-70">用户全局标识 (UUID)</span>
          <span class="text-[10px] opacity-40 font-mono">通用协议密钥</span>
        </div>
        <div class="font-mono break-all text-[var(--md-sys-color-primary)] font-medium select-all">
          {{ userStore.userInfo?.uuid || '------------------------------------' }}
        </div>
      </div>
    </div>

    <div class="flex justify-end mt-4 pt-4 border-t border-[var(--md-sys-color-outline-variant)]/10">
      <md-filled-tonal-button @click="copyUuid">
        <span class="material-symbols-outlined text-base" slot="icon">{{ copied ? 'check' : 'content_copy' }}</span>
        {{ copied ? 'UUID 已复制' : '复制 UUID' }}
      </md-filled-tonal-button>
    </div>
  </div>
</template>