<script setup lang="ts">
import { useClashStore } from '../../stores/clash'
import ClashOverviewCard from '../../components/clash/ClashOverviewCard.vue'

const client = useClashStore()
</script>

<template>
  <div class="clash-page">
    <section class="clash-surface clash-toolbar justify-between">
      <h2 class="clash-heading">内核概览</h2>
      <span class="clash-pill" :data-active="client.kernelReady">
        {{ client.kernelReady ? (client.coreVersion ? `Mihomo ${client.coreVersion}` : '内核就绪') : client.isConnected ? '等待内核就绪' : '等待连接' }}
      </span>
    </section>
    <ClashOverviewCard />
  </div>
</template>
