<script setup lang="ts">
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'

defineProps<{
  open: boolean
}>()

const emit = defineEmits(['close', 'download', 'continue'])
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <md-dialog :open="open" @closed="emit('close')" class="md3-sw-dialog max-w-md w-full">
    <div slot="headline" class="font-black text-lg flex items-center gap-2 text-amber-500">
      <span class="material-symbols-outlined text-2xl">stream</span>
      流媒体虚拟切片加速提示
    </div>

    <div slot="content" class="flex flex-col gap-3 py-2 text-xs leading-relaxed text-[var(--md-sys-color-on-surface)]">
      <p class="opacity-90">
        检测到您的当前浏览器环境未开放 <b>Service Worker 虚拟流媒体通道</b>（通常出现在无痕隐私窗口、内嵌网页视图或未配置 HTTPS 的环境下）。
      </p>

      <div class="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-1.5 text-[11px] leading-normal border border-black/5 dark:border-transparent">
        <span class="font-bold text-amber-500">• 已自动为您启用「全量内存解密降级」模式</span>
        <span class="opacity-70">视频将在完整解密缓冲后开始播放；若文件较大（如大于 500MB），建议直接下载到本地流畅观看。</span>
      </div>
    </div>

    <div slot="actions">
      <md-text-button @click="emit('close')">取消</md-text-button>
      <md-filled-tonal-button @click="emit('download')">直接下载原文件</md-filled-tonal-button>
      <md-filled-button @click="emit('continue')">继续内存缓冲播放</md-filled-button>
    </div>
  </md-dialog>
</template>

<style scoped>
.md3-sw-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>