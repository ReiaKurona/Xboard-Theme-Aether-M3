<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../../api/client'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/progress/circular-progress.js'

const props = defineProps<{
  codes: Array<{
    user_id?: number
    code: string
    pv: number
    status: number
    created_at: number
  }>
  loading?: boolean
}>()

const emit = defineEmits(['refresh'])

const isGenerating = ref(false)
const copiedCode = ref<string | null>(null)
const copiedLink = ref<string | null>(null)
const generateError = ref('')

// 拼装完整注册链接: {站点}/#/register?code=<邀请码>
const getInviteLink = (code: string) => {
  const origin = window.location.origin
  const base = (window as any).routerBase || '/'
  return `${origin}${base}#/register?code=${encodeURIComponent(code)}`
}

// 8.2 生成新邀请码 (注意是严格的 HTTP GET)
const handleGenerateCode = async () => {
  isGenerating.value = true
  generateError.value = ''
  try {
    await api.get('/user/invite/save')
    emit('refresh')
  } catch (err: any) {
    generateError.value = err.message || '生成失败，已达到邀请码生成数量上限'
    setTimeout(() => (generateError.value = ''), 4000)
  } finally {
    isGenerating.value = false
  }
}

// 复制纯代码
const copyCodeOnly = async (code: string) => {
  await navigator.clipboard.writeText(code)
  copiedCode.value = code
  setTimeout(() => (copiedCode.value = null), 2000)
}

// 复制注册链接
const copyFullLink = async (code: string) => {
  await navigator.clipboard.writeText(getInviteLink(code))
  copiedLink.value = code
  setTimeout(() => (copiedLink.value = null), 2000)
}

const formatDate = (ts: number) => {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString()
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="p-6 md:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent shadow-sm flex flex-col justify-between gap-5 h-full">
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-2xl">qr_code</span>
          <h3 class="text-xl font-black tracking-tight">专属推广邀请码</h3>
        </div>

        <md-filled-tonal-button @click="handleGenerateCode" :disabled="isGenerating">
          <md-circular-progress v-if="isGenerating" indeterminate slot="icon" style="--md-circular-progress-size: 14px;"></md-circular-progress>
          <span v-else class="material-symbols-outlined text-sm" slot="icon">add</span>
          生成新码
        </md-filled-tonal-button>
      </div>

      <p class="text-xs opacity-60 mb-4 leading-normal">
        将您的专属邀请链接分享给好友。好友通过该链接注册购买后，每次消费您都将获得高额永久返现。
      </p>

      <!-- 生成限额报错提示 -->
      <div v-if="generateError" class="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs mb-3 flex items-center gap-2 animate-bounce">
        <span class="material-symbols-outlined text-sm">warning</span>
        {{ generateError }}
      </div>

      <!-- 载入中 -->
      <div v-if="loading && codes.length === 0" class="py-12 flex justify-center">
        <md-circular-progress indeterminate></md-circular-progress>
      </div>

      <!-- 空码状态 -->
      <div v-else-if="codes.length === 0" class="py-12 flex flex-col items-center justify-center text-center opacity-40 text-xs gap-2">
        <span class="material-symbols-outlined text-4xl">link_off</span>
        <span>您当前还没有生成的有效邀请码，请点击右上角生成</span>
      </div>

      <!-- 邀请码矩阵列表 -->
      <div v-else class="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
        <div
          v-for="c in codes"
          :key="c.code"
          class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm hover:shadow transition-all"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-lg">share</span>
            </div>

            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <span class="font-mono font-black text-sm text-[var(--md-sys-color-on-surface)] select-all">{{ c.code }}</span>
                <!-- PV 点击热度统计 -->
                <span class="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[var(--md-sys-color-surface-container-highest)] opacity-70">
                  {{ c.pv || 0 }} 次访问
                </span>
              </div>
              <span class="text-[10px] opacity-40 mt-0.5">创建于：{{ formatDate(c.created_at) }}</span>
            </div>
          </div>

          <!-- 复制操作按钮组 -->
          <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              @click="copyCodeOnly(c.code)"
              class="px-3 py-1.5 rounded-full text-[11px] font-bold bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-highest)] active:scale-95 transition-all cursor-pointer"
            >
              {{ copiedCode === c.code ? '已复制邀请码' : '复制码' }}
            </button>

            <button
              @click="copyFullLink(c.code)"
              class="px-3.5 py-1.5 rounded-full text-[11px] font-bold text-[var(--md-sys-color-on-primary)] bg-[var(--md-sys-color-primary)] hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <span class="material-symbols-outlined text-xs">{{ copiedLink === c.code ? 'check' : 'content_copy' }}</span>
              <span>{{ copiedLink === c.code ? '已复制链接' : '复制推广链接' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="text-[11px] opacity-40 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/10 text-right">
      好友通过链接打开时将自动计入 PV 访问热度
    </div>
  </div>
</template>