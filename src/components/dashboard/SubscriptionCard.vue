<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore, formatBytes } from '../../stores/user'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'

const router = useRouter()
const userStore = useUserStore()
const copied = ref(false)

// 判定是否正在加载（避免闪现“无有效订阅”）
const isLoading = computed(() => userStore.loading && !userStore.subscribeInfo)

const planStatusDescription = computed(() => {
  const sub = userStore.subscribeInfo
  if (!sub) return '暂无有效订阅'

  const hasExpire = sub.expired_at !== null
  const resetDay = sub.reset_day

  if (!hasExpire && (resetDay === null || resetDay === undefined)) {
    return '一次性订阅的流量没有时间限制'
  }
  if (!hasExpire && resetDay !== null) {
    return `${resetDay} 天后重置流量`
  }
  const expireDate = new Date(sub.expired_at * 1000).toLocaleDateString()
  if (hasExpire && resetDay !== null) {
    return `将于 ${expireDate} 到期 (${resetDay} 天后重置流量)`
  }
  return `将于 ${expireDate} 到期 (流量不重置)`
})

const copySubscribeUrl = async () => {
  const url = userStore.subscribeInfo?.subscribe_url
  if (!url) return
  await navigator.clipboard.writeText(url)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="h-full p-6 sm:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm flex flex-col justify-between select-none relative overflow-hidden">
    
    <!-- 🌟 骨架屏状态：数据加载时优雅呼吸占位，绝不闪现“无用户订阅” -->
    <div v-if="isLoading" class="flex flex-col gap-5 animate-pulse py-2">
      <div class="flex flex-col gap-2">
        <div class="w-20 h-4 rounded-full bg-white/10"></div>
        <div class="w-36 h-9 rounded-2xl bg-white/15 mt-1"></div>
        <div class="w-56 h-4 rounded-full bg-white/10 mt-1"></div>
      </div>
      <div class="w-full h-3 rounded-full bg-white/10 mt-4"></div>
      <div class="flex justify-between mt-1">
        <div class="w-32 h-4 rounded-full bg-white/10"></div>
        <div class="w-20 h-4 rounded-full bg-white/10"></div>
      </div>
      <div class="flex gap-3 mt-6 pt-6 border-t border-white/5">
        <div class="w-28 h-10 rounded-full bg-white/10"></div>
        <div class="w-28 h-10 rounded-full bg-white/10"></div>
        <div class="w-32 h-10 rounded-full bg-white/15 ml-auto"></div>
      </div>
    </div>

    <!-- 真实订阅信息展示 -->
    <template v-else>
      <div>
        <div class="text-xs font-bold uppercase tracking-wider text-[var(--md-sys-color-primary)] mb-1">
          我的订阅
        </div>

        <h2 class="text-3xl font-black tracking-tight text-[var(--md-sys-color-on-surface)]">
          {{ userStore.subscribeInfo?.plan?.name || '无有效订阅' }}
        </h2>

        <p class="text-xs sm:text-sm opacity-70 mt-1.5 mb-6">
          {{ planStatusDescription }}
        </p>

        <!-- 🌟 核心升级：高阶流光激光进度条 (解决白底与生硬样式) -->
        <div class="mb-4">
          <div class="flex items-center gap-3">
            <!-- 槽底在暗色模式下为深邃深色质感，绝不发白 -->
            <div class="flex-1 h-2.5 sm:h-3 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden relative p-[1px]">
              <!-- 激光发光条 -->
              <div
                class="h-full rounded-full laser-progress-bar transition-all duration-700 ease-out"
                :style="{ width: `${userStore.trafficPercent}%` }"
              ></div>
            </div>
            <span class="text-xs font-bold opacity-60 min-w-[45px] text-right font-mono">
              {{ userStore.trafficPercent }}%
            </span>
          </div>

          <div class="flex justify-between items-center text-xs sm:text-sm font-semibold mt-3">
            <span>已用 {{ formatBytes(userStore.usedTraffic) }} / 总计 {{ formatBytes(userStore.totalTraffic) }}</span>
            <span class="text-xs opacity-50 font-normal">
              {{ userStore.subscribeInfo?.reset_day ? `${userStore.subscribeInfo.reset_day} 天后重置` : '永久额度' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 🌟 按钮区：手机端 DPI 自适应网格/折行排版，彻底移除暗黑模式刺眼白线 -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6 pt-5 border-t border-black/5 dark:border-white/5">
        <div class="grid grid-cols-2 sm:flex sm:items-center gap-2.5">
          <md-filled-tonal-button @click="router.push('/plan')" class="w-full sm:w-auto">
            <span class="material-symbols-outlined text-sm" slot="icon">calendar_month</span>
            续费订阅
          </md-filled-tonal-button>

          <md-filled-tonal-button @click="router.push('/knowledge')" class="w-full sm:w-auto">
            <span class="material-symbols-outlined text-sm" slot="icon">menu_book</span>
            查看教程
          </md-filled-tonal-button>
        </div>

        <md-filled-button @click="copySubscribeUrl" class="w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
          <span class="material-symbols-outlined text-sm" slot="icon">{{ copied ? 'check' : 'content_copy' }}</span>
          {{ copied ? '已复制链接' : '复制订阅' }}
        </md-filled-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 🌟 赛博霓虹激光流光进度条动效 */
.laser-progress-bar {
  background: linear-gradient(90deg, #00f2fe 0%, #38bdf8 50%, #4facfe 100%);
  box-shadow: 
    0 0 10px rgba(56, 189, 248, 0.6),
    0 0 18px rgba(0, 242, 254, 0.35);
  animation: laser-pulse 2.5s ease-in-out infinite alternate;
}

@keyframes laser-pulse {
  0% { filter: brightness(1); }
  100% { filter: brightness(1.25); }
}
</style>