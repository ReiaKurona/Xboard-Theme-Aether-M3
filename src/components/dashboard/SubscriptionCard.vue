<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore, formatBytes } from '../../stores/user'
import { useClashStore } from '../../stores/clash'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'

const router = useRouter()
const userStore = useUserStore()
const clashStore = useClashStore()
const copied = ref(false)

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

const isPaused = computed(() => clashStore.config?.mode?.toLowerCase() === 'direct')
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="h-full p-6 sm:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm flex flex-col justify-between select-none relative overflow-hidden">
    
    <div v-if="isLoading" class="flex flex-col gap-5 animate-pulse py-2">
      <div class="flex flex-col gap-2">
        <div class="w-20 h-4 rounded-full bg-white/10"></div>
        <div class="w-36 h-9 rounded-2xl bg-white/15 mt-1"></div>
      </div>
      <div class="w-full h-3 rounded-full bg-white/10 mt-4"></div>
    </div>

    <template v-else>
      <div>
        <!-- 顶栏：我的订阅标题与无头状态 -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold uppercase tracking-wider text-[var(--md-sys-color-primary)]">
              我的订阅
            </span>
            <span
              class="px-2 py-0.2 rounded-full text-[9px] font-bold"
              :class="clashStore.isConnected ? 'bg-[var(--md-sys-color-primary)]/15 text-[var(--md-sys-color-primary)]' : 'bg-zinc-500/15 text-zinc-400'"
            >
              {{ clashStore.isConnected ? `Mihomo ${clashStore.coreVersion}` : '内核未连接' }}
            </span>
          </div>

          <span class="text-xs font-bold opacity-50 font-mono">
            {{ userStore.subscribeInfo?.plan?.transfer_enable }} GB 计划
          </span>
        </div>

        <h2 class="text-3xl font-black tracking-tight text-[var(--md-sys-color-on-surface)]">
          {{ userStore.subscribeInfo?.plan?.name || '无有效订阅' }}
        </h2>
        <p class="text-xs sm:text-sm opacity-70 mt-1">
          {{ planStatusDescription }}
        </p>

        <!-- 激光进度条 (无任何白线，深邃槽底) -->
        <div class="my-4">
          <div class="flex items-center gap-3">
            <div class="flex-1 h-2.5 sm:h-3 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden relative p-[1px]">
              <div
                class="h-full rounded-full laser-progress-bar transition-all duration-700 ease-out"
                :style="{ width: `${userStore.trafficPercent}%` }"
              ></div>
            </div>
            <span class="text-xs font-bold opacity-60 min-w-[45px] text-right font-mono">
              {{ userStore.trafficPercent }}%
            </span>
          </div>

          <div class="flex justify-between items-center text-xs sm:text-sm font-semibold mt-2.5">
            <span>已用 {{ formatBytes(userStore.usedTraffic) }} / 总计 {{ formatBytes(userStore.totalTraffic) }}</span>
            <span class="text-xs opacity-50 font-normal">
              {{ userStore.subscribeInfo?.reset_day ? `${userStore.subscribeInfo.reset_day} 天后重置` : '永久额度' }}
            </span>
          </div>
        </div>

        <!-- 🌟 图 1 / 图 2 深度融入：FlClash 标志性状态与面板专属【量子蓝波浪开关】 (无任何白线) -->
        <div
          v-if="clashStore.isConnected"
          class="flclash-embed-container p-5 rounded-[26px] my-3 flex items-center justify-between gap-4 select-none relative overflow-hidden"
        >
          <!-- 背景水滴弥散暗斑 (对齐图 1 右侧水滴暗纹) -->
          <div class="water-drop-glow pointer-events-none"></div>

          <!-- 左侧：参数与状态 -->
          <div class="flex flex-col gap-2 z-10">
            <!-- 状态胶囊 -->
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold opacity-60">Status</span>
              <span
                class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                :class="isPaused ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500 animate-pulse'"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                {{ isPaused ? 'Paused (直连)' : 'Running' }}
              </span>
            </div>

            <!-- 国旗与大号加粗 IP -->
            <div class="flex items-center gap-3">
              <span class="w-8 h-8 rounded-xl bg-black/25 flex items-center justify-center font-black font-mono text-xs shadow-inner">
                {{ clashStore.outboundIpInfo.countryCode || 'HK' }}
              </span>
              <span class="text-2xl sm:text-3xl font-black font-mono tracking-tight text-[var(--md-sys-color-on-surface)] select-all">
                {{ clashStore.outboundIpInfo.ip || '127.0.0.1' }}
              </span>
            </div>

            <!-- 🌟 中文质量与类型标签 -->
            <div class="flex items-center gap-1.5">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/15 text-zinc-400">
                {{ clashStore.outboundIpInfo.typeCn || '原生住宅' }}
              </span>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                {{ clashStore.outboundIpInfo.qualityCn || '链路优质' }}
              </span>
              <div class="flex items-center gap-3 text-[10px] opacity-60">
                <span>运行: {{ clashStore.runtimeFormatted }}</span>
            <span>·</span>
            <span class="truncate max-w-[150px]" :title="clashStore.outboundIpInfo.isp">
              {{ clashStore.outboundIpInfo.isp }}
            </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 text-[10px] opacity-60">
            
            <!-- 手动快速刷新 IP 按钮 -->
            <button
              @click="clashStore.refreshOutboundIp"
              class="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
              title="重新探测出站 IP"
            >
              <span class="material-symbols-outlined text-xs">sync</span>
            </button>
            <!-- 🌟 右侧：图 1 同款 12 瓣波浪花瓣开关 (已升级为面板专属【量子高光蓝】) -->
          <div class="flex flex-col items-center gap-1 shrink-0 z-10">
            <button
              @click="clashStore.toggleProxyPause"
              class="wavy-switch-btn group"
              :class="isPaused ? 'wavy-paused' : 'wavy-running'"
              :title="isPaused ? '点击恢复代理' : '点击暂停代理 (直连)'"
            >
              <svg viewBox="0 0 48 48" class="w-full h-full wavy-svg">
                <path
                  d="M24 2c2.1 0 4.1 1.1 5.3 2.8 1.9-.5 4-.3 5.7.8 1.7 1.1 2.6 3 2.5 5 2 .8 3.3 2.5 3.7 4.5.4 2-.3 4-1.8 5.4 1.4 1.2 2.2 3.1 2 5.1-.2 2-1.5 3.7-3.3 4.5.8 1.8.7 4-.3 5.7-1 1.7-2.7 2.7-4.8 2.8-.1 2-1.2 3.8-3 4.8-1.8 1-4 .8-5.7-.4-1.4 1.2-3.3 1.9-5.3 1.8-2-.1-3.7-1.1-4.7-2.9-1.8.8-4 .7-5.7-.3-1.7-1-2.7-2.7-2.9-4.8-2-.1-3.8-1.2-4.8-3-1-1.8-.8-4 .4-5.7-1.2-1.4-1.9-3.3-1.8-5.3.1-2 1.1-3.7 2.9-4.7-.8-1.8-.7-4 .3-5.7 1-1.7 2.7-2.7 4.8-2.9.1-2 1.2-3.8 3-4.8 1.8-1 4-.8 5.7.4 1.4-1.2 3.3-1.9 5.3-1.8z"
                />
              </svg>

              <!-- 暂停/播放图标 -->
              <span class="material-symbols-outlined text-3xl font-black text-black select-none z-10 transition-transform group-hover:scale-110">
                {{ isPaused ? 'play_arrow' : 'pause' }}
              </span>
            </button>
            <span class="text-[9px] font-mono opacity-60">{{ isPaused ? '直连' : '代理中' }}</span>
          </div>
          </div>
        </div>

          
        </div>
      

      <!-- 底部操作按钮 -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-black/5 dark:border-white/5">
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
/* 🌟 FlClash 专属嵌入式容器 (完全移除白线，纯阶梯色板) */
.flclash-embed-container {
  background: var(--md-sys-color-surface-container-high);
}

/* 图 1 右侧水滴扩散暗斑 */
.water-drop-glow {
  position: absolute;
  right: -20px;
  top: -20px;
  width: 170px;
  height: 170px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);
  filter: blur(15px);
}

/* 🌟 12 瓣波浪花瓣按钮：升级为面板专属【量子高光蓝】 */
.wavy-switch-btn {
  position: relative;
  width: 58px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  border: none;
  outline: none;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.wavy-switch-btn:active {
  transform: scale(0.88);
}

.wavy-svg {
  position: absolute;
  inset: 0;
  transition: all 0.3s ease;
}

/* 运行态：面板专属高光天蓝 (对齐主题色) */
.wavy-running .wavy-svg path {
  fill: #38bdf8;
}
.wavy-running .wavy-svg {
  filter: drop-shadow(0 4px 14px rgba(56, 189, 248, 0.45));
}

/* 暂停直连态：冷灰 */
.wavy-paused .wavy-svg path {
  fill: #94a3b8;
}

.laser-progress-bar {
  background: linear-gradient(90deg, #00f2fe 0%, #38bdf8 50%, #4facfe 100%);
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.6), 0 0 18px rgba(0, 242, 254, 0.35);
  animation: laser-pulse 2.5s ease-in-out infinite alternate;
}
@keyframes laser-pulse {
  0% { filter: brightness(1); }
  100% { filter: brightness(1.25); }
}
</style>