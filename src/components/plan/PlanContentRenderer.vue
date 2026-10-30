<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  content: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)

const renderContent = () => {
  if (!containerRef.value) return
  containerRef.value.innerHTML = ''
  if (!props.content) return

  // 1. 利用 Range 解析出 DOM 片段
  const range = document.createRange()
  range.selectNode(containerRef.value)
  const fragment = range.createContextualFragment(props.content)

  // 2. 关键：重新实例化 script 标签，使其获得浏览器的真实执行上下文
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

watch(() => props.content, renderContent)
onMounted(renderContent)

onUnmounted(() => {
  if (containerRef.value) containerRef.value.innerHTML = ''
})
</script>

<template>
  <div class="plan-custom-content w-full overflow-hidden leading-relaxed" ref="containerRef"></div>
</template>

<style>
/* 保证后台内嵌的 CSS 容器能撑满卡片宽度 */
.plan-custom-content {
  font-size: 0.875rem;
}
.plan-custom-content pre,
.plan-custom-content code {
  max-width: 100%;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>