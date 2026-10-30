<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  code: string
  index: number
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const isFullscreen = ref(false)

const renderActivity = () => {
  if (!containerRef.value) return
  containerRef.value.innerHTML = ''
  if (!props.code) return

  // 1. 利用 Range 生成 DOM 片段
  const range = document.createRange()
  range.selectNode(containerRef.value)
  const fragment = range.createContextualFragment(props.code)

  // 2. 重新激活并运行所有的 script 脚本 (支持外部 CDN script 与内联业务代码)
  const scripts = fragment.querySelectorAll('script')
  scripts.forEach((oldScript) => {
    const newScript = document.createElement('script')
    Array.from(oldScript.attributes).forEach((attr) => {
      newScript.setAttribute(attr.name, attr.value)
    })
    newScript.textContent = oldScript.textContent
    oldScript.parentNode?.replaceChild(newScript, oldScript)
  })

  containerRef.value.appendChild(fragment)
}

// 针对包含 iframe 的活动提供全屏切换体验
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

watch(() => props.code, renderActivity)
onMounted(renderActivity)

onUnmounted(() => {
  if (containerRef.value) containerRef.value.innerHTML = ''
})
</script>

<template>
  <div
    class="activity-card-container w-full rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent shadow-sm flex flex-col gap-4 relative transition-all duration-300"
    :class="[
      isFullscreen ? 'fixed inset-4 z-50 p-6 md:p-8 bg-[var(--md-sys-color-surface)] shadow-2xl' : 'p-6 md:p-8'
    ]"
  >
    <!-- 卡片角标头 (附带全屏扩展按钮) -->
    <div class="flex items-center justify-between pb-3 border-b border-[var(--md-sys-color-outline-variant)]/10 text-xs shrink-0 select-none">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
        <span class="font-black text-sm text-[var(--md-sys-color-primary)]">活动 {{ index + 1 }}</span>
      </div>

      <div class="flex items-center gap-2">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500">
          火热进行中
        </span>

        <!-- 全屏伸展按钮 -->
        <button
          @click="toggleFullscreen"
          class="w-7 h-7 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container-high)] transition-all cursor-pointer"
          :title="isFullscreen ? '退出全屏' : '全屏视窗'"
        >
          <span class="material-symbols-outlined text-base">
            {{ isFullscreen ? 'fullscreen_exit' : 'fullscreen' }}
          </span>
        </button>
      </div>
    </div>

    <!-- 🌟 万能 Web 业务注入舞台：彻底解除 contain: paint，弹窗直接覆盖全视口，不再被卡死在框内 -->
    <div
      class="activity-universal-stage w-full flex-1"
      ref="containerRef"
    ></div>
  </div>
</template>

<style scoped>
.activity-card-container {
  /* 允许内容在需要时弹出，绝对不用 contain: paint 或 transform 囚禁内部的 fixed 弹窗 */
  position: relative;
}

.activity-universal-stage {
  width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

/* 🌟 核心解除：仅对普通文档流元素限制宽度防溢出，对 fixed 全屏弹窗与浮层绝对放行！ */
:deep(.activity-universal-stage > *:not([style*="fixed"]):not([class*="fixed"])) {
  max-width: 100% !important;
  box-sizing: border-box;
}

/* 🌟 针对 iframe 业务（如抽奖游戏、H5网页）注入高阶响应式支持 */
:deep(iframe) {
  width: 100% !important;
  min-height: 520px;
  border: none !important;
  border-radius: 20px;
  background: transparent;
  display: block;
}

/* 适配常见第三方活动弹窗的 z-index 穿透 */
:deep([style*="position: fixed"]),
:deep(.modal),
:deep(.dialog),
:deep(.popup) {
  z-index: 9999 !important;
}
</style>