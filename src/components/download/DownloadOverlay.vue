<script setup lang="ts">
import '@material/web/button/filled-button.js'
import '@material/web/progress/circular-progress.js'

defineProps<{
  status: string
  percent: number
  downloadedChunks: number
  decryptedChunks: number
  totalChunks: number
}>()

defineEmits(['close'])
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none">
    <div class="w-full max-w-md p-6 sm:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)] shadow-2xl flex flex-col items-center text-center gap-4 border border-black/5 dark:border-transparent">
      <!-- 进度环 -->
      <div class="relative w-20 h-20 flex items-center justify-center">
        <md-circular-progress
          v-if="percent < 100"
          :value="percent / 100"
          class="w-full h-full"
          style="--md-circular-progress-size: 76px;"
        ></md-circular-progress>
        <span v-else class="material-symbols-outlined text-5xl text-emerald-500 animate-bounce">check_circle</span>
        <span v-if="percent < 100" class="absolute text-sm font-black font-mono text-[var(--md-sys-color-primary)]">
          {{ percent }}%
        </span>
      </div>

      <div>
        <h3 class="text-base font-black tracking-tight">{{ status }}</h3>
        <p class="text-[11px] opacity-60 mt-1">金融级 AES-256-GCM 硬件并行解密，直接流式落盘</p>
      </div>

      <!-- 分块统计看板 -->
      <div v-if="percent < 100" class="w-full flex flex-col gap-2 p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] text-xs font-mono">
        <div class="flex justify-between">
          <span class="opacity-60">碎片拉取进度</span>
          <b>{{ downloadedChunks }} / {{ totalChunks }} 块</b>
        </div>
        <div class="flex justify-between">
          <span class="opacity-60">实时解密完成</span>
          <b class="text-emerald-500">{{ decryptedChunks }} / {{ totalChunks }} 块</b>
        </div>
      </div>

      <md-filled-button v-if="percent >= 100" @click="$emit('close')" class="w-full mt-2">
        完成并关闭
      </md-filled-button>
    </div>
  </div>
</template>