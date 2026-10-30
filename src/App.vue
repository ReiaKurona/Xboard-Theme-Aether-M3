<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import GlobalLoadingBar from './components/common/GlobalLoadingBar.vue'
import { loadingBar } from './utils/loadingBar'

onMounted(() => {
  // 🌟 开机仪式感：初次进入或刷新页面时，自动巡航一遍粒子流光！
  loadingBar.start()
  setTimeout(() => {
    loadingBar.finish()
  }, 1000)
})
</script>

<template>
  <!-- 挂载全局置顶粒子流光进度条 -->
  <GlobalLoadingBar />

  <!-- 页面主路由 -->
  <RouterView />
</template>

<style>
html, body, #app {
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0;
}
</style>