<script setup lang="ts">
import ClashAdvancedSettings from '../../components/clash/ClashAdvancedSettings.vue'
</script>

<template>
  <div class="flex flex-col gap-6 w-full select-none">
    <div class="pb-1">
      <h2 class="text-2xl font-black tracking-tight">后端与设置</h2>
      <p class="text-xs opacity-60 mt-1">管理 Mihomo 本地运行核心、修改连接端点以及诊断网络。</p>
    </div>

    <ClashAdvancedSettings />
  </div>
</template>