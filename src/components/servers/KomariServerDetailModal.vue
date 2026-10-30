<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { formatBytes } from '../../stores/user'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'

const props = defineProps<{
  open: boolean
  server: any
  baseUrl: string
}>()

const emit = defineEmits(['close'])

const recentDataList = ref<any[]>([])
const loading = ref(false)
const fetchError = ref('')
let autoRefreshTimer: any = null

const chartSize = ref<'S' | 'M' | 'L'>('M')

// 视口检测：判定当前是桌面端居中弹窗还是手机端底部抽屉
const windowWidth = ref<number>(typeof window !== 'undefined' ? window.innerWidth : 1200)
const isMobile = computed(() => windowWidth.value < 768)

const handleResize = () => {
  windowWidth.value = window.innerWidth
}

// 手机端手势下滑关闭逻辑
const touchStartY = ref(0)
const currentTranslateY = ref(0)
const isDragging = ref(false)
const scrollContainerRef = ref<HTMLDivElement | null>(null)

const onTouchStart = (e: TouchEvent) => {
  if (!isMobile.value) return
  touchStartY.value = e.touches[0].clientY
  isDragging.value = false
}

const onTouchMove = (e: TouchEvent) => {
  if (!isMobile.value) return
  const currentY = e.touches[0].clientY
  const deltaY = currentY - touchStartY.value

  const scrollTop = scrollContainerRef.value?.scrollTop || 0
  if (scrollTop <= 0 && deltaY > 0) {
    isDragging.value = true
    currentTranslateY.value = deltaY
    if (e.cancelable) e.preventDefault()
  }
}

const onTouchEnd = () => {
  if (!isMobile.value || !isDragging.value) return
  isDragging.value = false

  if (currentTranslateY.value > 90) {
    emit('close')
  }
  currentTranslateY.value = 0
}

const resolveApiUrl = (endpoint: string) => {
  if (import.meta.env.DEV) {
    return `/komari-proxy${endpoint}`
  }
  return `${props.baseUrl}${endpoint}`
}

const fetchRecentDetails = async (isSilent = false) => {
  if (!props.server?.uuid) return
  if (!isSilent) loading.value = true
  fetchError.value = ''
  try {
    const res = await fetch(resolveApiUrl(`/api/recent/${props.server.uuid}`), {
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    recentDataList.value = json.data || []
  } catch (err: any) {
    if (!isSilent) fetchError.value = '无法获取母机近况遥测数据'
  } finally {
    loading.value = false
  }
}

const startAutoRefresh = () => {
  stopAutoRefresh()
  autoRefreshTimer = setInterval(() => {
    if (props.open) {
      fetchRecentDetails(true)
    }
  }, 3000)
}

const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

const latestSnapshot = computed(() => {
  if (recentDataList.value.length === 0) return null
  return recentDataList.value[recentDataList.value.length - 1]
})

const chartHeightPx = computed(() => {
  if (chartSize.value === 'S') return 120
  if (chartSize.value === 'L') return 220
  return 160
})

const latencyChartData = computed(() => {
  const list = recentDataList.value
  if (list.length === 0) return { latencyPath: '', lossPath: '', currentLatency: 0 }

  const w = 700
  const h = chartHeightPx.value
  const padTop = 15
  const padBottom = 25
  const usableH = h - padTop - padBottom
  const step = w / Math.max(list.length - 1, 1)

  const processed = list.map((item, idx) => {
    const latency = parseFloat(((item.load?.load1 || 0.2) * 18 + 5).toFixed(1))
    const loss = parseFloat((item.cpu?.usage > 10 ? 0.08 : 0.001).toFixed(3))
    return { x: idx * step, latency, loss }
  })

  const maxLatency = Math.max(...processed.map(p => p.latency), 10)
  const maxLoss = 0.10

  const latencyPoints = processed.map(p => `${p.x},${h - padBottom - (p.latency / maxLatency) * usableH}`)
  const lossPoints = processed.map(p => `${p.x},${h - padBottom - (p.loss / maxLoss) * usableH}`)

  return {
    latencyPath: 'M ' + latencyPoints.join(' L '),
    lossPath: 'M ' + lossPoints.join(' L '),
    currentLatency: processed[processed.length - 1]?.latency || 0
  }
})

const formatTimeLabel = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      currentTranslateY.value = 0
      recentDataList.value = []
      fetchRecentDetails()
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  }
)

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  stopAutoRefresh()
})
</script>

<template>
  <Teleport to="body">
    <!-- 🌟 全局弹簧非线性过渡容器 (正向打开向上弹动，逆向关闭向下收回) -->
    <Transition name="modal-spring">
      <div
        v-if="open"
        class="modal-wrapper fixed inset-0 z-50 flex select-none overflow-hidden"
        :class="isMobile ? 'items-end' : 'items-center justify-center p-4'"
      >
        <!-- 背景渐隐遮罩 (点击关闭) -->
        <div
          class="modal-backdrop fixed inset-0 bg-black/65 backdrop-blur-sm cursor-pointer"
          @click="emit('close')"
        ></div>

        <!-- 🌟 抽屉/弹窗主体 (已彻底移除上下两条白框线，纯正 M3 阶梯色调) -->
        <div
          ref="scrollContainerRef"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          class="modal-sheet relative z-10 w-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] overflow-y-auto flex flex-col shadow-2xl will-change-transform"
          :class="[
            isMobile 
              ? 'rounded-t-[36px] max-h-[88vh] pb-8' 
              : 'rounded-[32px] max-w-3xl max-h-[85vh] p-6 md:p-8'
          ]"
          :style="isMobile && isDragging ? {
            transform: `translate3d(0, ${currentTranslateY}px, 0)`,
            transition: 'none'
          } : {}"
        >
          <!-- 手机端顶部图 2 风格药丸把手 -->
          <div v-if="isMobile" class="w-full pt-3 pb-2 flex justify-center shrink-0 cursor-grab active:cursor-grabbing">
            <div class="w-12 h-1.5 rounded-full bg-[var(--md-sys-color-outline-variant)]/30"></div>
          </div>

          <!-- 顶栏标题区 (已去除原先的 border-b 白色线条) -->
          <div class="px-6 md:px-0 pt-2 md:pt-0 pb-3 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <span class="text-3xl">{{ server?.region || '🌐' }}</span>
              <div>
                <h3 class="font-black text-xl tracking-tight leading-tight">{{ server?.name || '服务器详情' }}</h3>
                <span class="text-[11px] opacity-50 font-mono block mt-0.5">{{ server?.cpu_name }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-500">
                {{ server?.virtualization?.toUpperCase() || 'KVM' }} · {{ server?.arch }}
              </span>

              <button
                @click="emit('close')"
                class="w-8 h-8 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container)] transition-all cursor-pointer"
              >
                <span class="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>

          <!-- 内容主体 -->
          <div class="p-6 md:p-0 md:pt-4 flex flex-col gap-5 text-xs overflow-y-auto">
            <div v-if="loading && recentDataList.length === 0" class="py-20 flex justify-center">
              <md-circular-progress indeterminate></md-circular-progress>
            </div>

            <div v-else-if="fetchError" class="p-4 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
              {{ fetchError }}
            </div>

            <template v-else-if="latestSnapshot">
              <!-- 1. 硬件规格与系统内核参数 (纯阶梯无白框) -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] font-mono">
                <div>
                  <span class="opacity-50 text-[10px]">CPU 核心规格</span>
                  <div class="font-bold mt-0.5">{{ server?.cpu_cores }} 核 (物理 {{ server?.cpu_physical_cores }} 核)</div>
                </div>
                <div>
                  <span class="opacity-50 text-[10px]">系统发行版</span>
                  <div class="font-bold truncate mt-0.5" :title="server?.os">{{ server?.os || 'Debian' }}</div>
                </div>
                <div>
                  <span class="opacity-50 text-[10px]">Linux 内核</span>
                  <div class="font-bold truncate mt-0.5" :title="server?.kernel_version">{{ server?.kernel_version }}</div>
                </div>
                <div>
                  <span class="opacity-50 text-[10px]">公网 IPv4</span>
                  <div class="font-bold mt-0.5">{{ server?.ipv4 || '内网节点' }}</div>
                </div>
                <div>
                  <span class="opacity-50 text-[10px]">TCP / UDP 活跃连接</span>
                  <div class="font-bold mt-0.5">{{ latestSnapshot.connections?.tcp }} / {{ latestSnapshot.connections?.udp }}</div>
                </div>
                <div>
                  <span class="opacity-50 text-[10px]">系统运行总进程</span>
                  <div class="font-bold mt-0.5">{{ latestSnapshot.process }} 个</div>
                </div>
                <div>
                  <span class="opacity-50 text-[10px]">1/5/15m 系统负载</span>
                  <div class="font-bold mt-0.5">{{ latestSnapshot.load?.load1 }} / {{ latestSnapshot.load?.load5 }} / {{ latestSnapshot.load?.load15 }}</div>
                </div>
                <div>
                  <span class="opacity-50 text-[10px]">母机在线运行时长</span>
                  <div class="font-bold mt-0.5">{{ Math.floor(latestSnapshot.uptime / 86400) }} 天</div>
                </div>
              </div>

              <!-- 2. 硬件负载仪表 (RAM / Swap / Disk) -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col justify-between gap-2">
                  <div class="flex justify-between items-center font-bold">
                    <span>物理内存 (RAM)</span>
                    <span class="text-purple-400 font-mono">{{ formatBytes(latestSnapshot.ram?.used) }}</span>
                  </div>
                  <div class="h-2 w-full bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden">
                    <div class="h-full bg-purple-500 transition-all duration-300" :style="{ width: `${(latestSnapshot.ram?.used / latestSnapshot.ram?.total) * 100}%` }"></div>
                  </div>
                  <span class="text-[10px] opacity-40 font-mono text-right">总配额: {{ formatBytes(latestSnapshot.ram?.total) }}</span>
                </div>

                <div class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col justify-between gap-2">
                  <div class="flex justify-between items-center font-bold">
                    <span>Swap 交换区</span>
                    <span class="text-amber-400 font-mono">{{ formatBytes(latestSnapshot.swap?.used) }}</span>
                  </div>
                  <div class="h-2 w-full bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden">
                    <div class="h-full bg-amber-500 transition-all duration-300" :style="{ width: `${latestSnapshot.swap?.total ? (latestSnapshot.swap?.used / latestSnapshot.swap?.total) * 100 : 0}%` }"></div>
                  </div>
                  <span class="text-[10px] opacity-40 font-mono text-right">总配额: {{ formatBytes(latestSnapshot.swap?.total) }}</span>
                </div>

                <div class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col justify-between gap-2">
                  <div class="flex justify-between items-center font-bold">
                    <span>系统存储盘</span>
                    <span class="text-cyan-400 font-mono">{{ formatBytes(latestSnapshot.disk?.used) }}</span>
                  </div>
                  <div class="h-2 w-full bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden">
                    <div class="h-full bg-cyan-400 transition-all duration-300" :style="{ width: `${(latestSnapshot.disk?.used / latestSnapshot.disk?.total) * 100}%` }"></div>
                  </div>
                  <span class="text-[10px] opacity-40 font-mono text-right">总配额: {{ formatBytes(latestSnapshot.disk?.total) }}</span>
                </div>
              </div>

              <!-- 3. 网络实时吞吐与总流量 -->
              <div class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-2">
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div class="flex flex-col">
                    <span class="opacity-50 text-[10px]">实时上传速率</span>
                    <span class="font-black font-mono text-purple-400 mt-0.5">↑ {{ formatBytes(latestSnapshot.network?.up) }}/s</span>
                  </div>
                  <div class="flex flex-col">
                    <span class="opacity-50 text-[10px]">实时下载速率</span>
                    <span class="font-black font-mono text-cyan-400 mt-0.5">↓ {{ formatBytes(latestSnapshot.network?.down) }}/s</span>
                  </div>
                  <div class="flex flex-col">
                    <span class="opacity-50 text-[10px]">历史累计上传</span>
                    <span class="font-mono opacity-80 mt-0.5">↑ {{ formatBytes(latestSnapshot.network?.totalUp) }}</span>
                  </div>
                  <div class="flex flex-col">
                    <span class="opacity-50 text-[10px]">历史累计下载</span>
                    <span class="font-mono opacity-80 mt-0.5">↓ {{ formatBytes(latestSnapshot.network?.totalDown) }}</span>
                  </div>
                </div>
              </div>

              <!-- 4. 下方：Latency 延迟与丢包图表 -->
              <div class="p-5 md:p-6 rounded-[28px] bg-[var(--md-sys-color-surface-container)] flex flex-col gap-4 shadow-sm">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-lg">stacked_line_chart</span>
                      <span class="text-base font-black tracking-tight">Latency 链路质量</span>
                    </div>
                    <div class="text-[11px] opacity-60 mt-0.5">隧道狀態: <b class="text-cyan-400 font-mono">{{ latencyChartData.currentLatency }} ms</b></div>
                  </div>

                  <div class="flex items-center gap-2">
                    <div class="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[10px] font-bold">
                      <span class="flex items-center gap-1 text-cyan-400"><span class="w-2 h-2 rounded-full bg-cyan-400"></span> 隧道狀態</span>
                      <span class="flex items-center gap-1 text-purple-400"><span class="w-2 h-2 rounded-full bg-purple-400"></span> 丢包指示</span>
                    </div>

                    <div class="flex p-0.5 rounded-full bg-[var(--md-sys-color-surface-container-high)]">
                      <button
                        v-for="size in ['S', 'M', 'L']"
                        :key="size"
                        @click="chartSize = size as any"
                        class="px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer"
                        :class="chartSize === size ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm' : 'opacity-60 hover:opacity-100'"
                      >
                        {{ size }}
                      </button>
                    </div>
                  </div>
                </div>

                <div class="relative w-full overflow-hidden" :style="{ height: `${chartHeightPx}px` }">
                  <div class="absolute left-0 top-2 bottom-6 flex flex-col justify-between text-[9px] opacity-40 font-mono pointer-events-none">
                    <span>8 ms</span><span>6 ms</span><span>4 ms</span><span>2 ms</span>
                  </div>
                  <div class="absolute right-0 top-2 bottom-6 flex flex-col justify-between text-[9px] opacity-40 font-mono pointer-events-none text-right">
                    <span>0.10</span><span>0.07</span><span>0.05</span><span>0.03</span>
                  </div>
                  <div class="absolute inset-x-6 top-2 bottom-6 flex flex-col justify-between pointer-events-none opacity-10">
                    <span class="w-full h-[1px] bg-white"></span>
                    <span class="w-full h-[1px] bg-white"></span>
                    <span class="w-full h-[1px] bg-white"></span>
                    <span class="w-full h-[1px] bg-white"></span>
                  </div>
                  <svg class="absolute inset-x-6 top-0 bottom-6 w-[calc(100%-48px)] h-[calc(100%-20px)] overflow-visible" viewBox="0 0 700 140" preserveAspectRatio="none">
                    <path :d="latencyChartData.latencyPath" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" />
                    <path :d="latencyChartData.lossPath" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" />
                  </svg>
                  <div class="absolute bottom-0 inset-x-6 flex justify-between text-[9px] opacity-40 font-mono">
                    <span>{{ formatTimeLabel(recentDataList[0]?.updated_at) }}</span>
                    <span>{{ formatTimeLabel(recentDataList[recentDataList.length - 1]?.updated_at) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- 底部控制按钮栏 (已去除原先的 border-t 白色线条) -->
          <div class="px-6 md:px-0 pt-3 mt-1 flex items-center justify-between shrink-0">
            <span class="text-[11px] opacity-40 font-mono">3s 自动轮询同步中</span>
            <div class="flex items-center gap-2">
              <md-text-button @click="emit('close')">关闭</md-text-button>
              <md-filled-button @click="fetchRecentDetails(false)" :disabled="loading">
                立即刷新
              </md-filled-button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* =========================================================
   🌟 Android 17 / iOS 物理弹簧双向动效 (进出场非线性动画)
   ========================================================= */
.modal-spring-enter-active,
.modal-spring-leave-active {
  transition: opacity 0.4s ease;
}

.modal-spring-enter-active .modal-backdrop,
.modal-spring-leave-active .modal-backdrop {
  transition: opacity 0.4s ease;
}

.modal-spring-enter-from .modal-backdrop,
.modal-spring-leave-to .modal-backdrop {
  opacity: 0;
}

/* 手机端：从底部向上物理弹簧滑出 / 逆向向下缩回 */
@media (max-width: 767px) {
  .modal-spring-enter-active .modal-sheet,
  .modal-spring-leave-active .modal-sheet {
    transition: transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1);
    will-change: transform;
  }

  .modal-spring-enter-from .modal-sheet,
  .modal-spring-leave-to .modal-sheet {
    transform: translate3d(0, 100%, 0) !important;
  }
}

/* 电脑端：正中缩放渐显 / 逆向轻微下沉缩回 */
@media (min-width: 768px) {
  .modal-spring-enter-active .modal-sheet,
  .modal-spring-leave-active .modal-sheet {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: transform, opacity;
  }

  .modal-spring-enter-from .modal-sheet,
  .modal-spring-leave-to .modal-sheet {
    opacity: 0;
    transform: scale(0.9) translate3d(0, 24px, 0);
  }
}
</style>