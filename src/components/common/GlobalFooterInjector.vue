<script setup lang="ts">
import { onMounted, ref } from 'vue'

const containerRef = ref<HTMLDivElement | null>(null)

onMounted(() => {
  // 从 Xboard 全局注入的 settings 中读取 custom_html
  const customHtml = (window as any).settings?.custom_html || ''
  if (!customHtml || !containerRef.value) return

  // 关键：利用 createContextualFragment 确保外部脚本、样式与 div 标签全域穿透执行
  const range = document.createRange()
  range.selectNode(containerRef.value)
  const fragment = range.createContextualFragment(customHtml)
  containerRef.value.appendChild(fragment)
})
</script>

<template>
  <div id="xboard-custom-footer" ref="containerRef"></div>
</template>