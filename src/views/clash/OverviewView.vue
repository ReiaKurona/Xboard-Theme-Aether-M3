<script setup lang="ts">
import { onMounted } from 'vue'
import { useClashStore } from '../../stores/clash'
import ClashOverviewCard from '../../components/clash/ClashOverviewCard.vue'

const clashStore = useClashStore()

onMounted(() => {
  clashStore.checkConnection()
})
</script>

<template>
  <div class="flex flex-col gap-6 w-full select-none">
    <div class="flex items-center justify-between pb-1">
      <p class="text-xs md:text-sm opacity-60">
        已连接本地控制端 ({{ clashStore.endpoint }})
      </p>
      <span class="text-xs font-bold text-emerald-500 font-mono">
        {{ clashStore.coreVersion }}
      </span>
    </div>

    <!-- 加载纯净的概览波形卡片群 -->
    <ClashOverviewCard />
  </div>
</template>