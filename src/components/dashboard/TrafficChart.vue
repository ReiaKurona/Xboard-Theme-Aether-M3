<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUserStore, formatBytes } from '../../stores/user'

const userStore = useUserStore()
const hoveredIndex = ref<number | null>(null)

// 1. 严格按自然日聚合数据
const dailyAggregatedData = computed(() => {
  const logs = userStore.trafficLogs || []
  if (logs.length === 0) return []

  const dayMap = new Map<string, { dateKey: string; label: string; fullDate: string; u: number; d: number; total: number; timestamp: number }>()

  logs.forEach((item) => {
    const dateObj = new Date(item.record_at * 1000)
    const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
    const label = `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`
    const fullDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`

    const u = item.u || 0
    const d = item.d || 0

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        dateKey,
        label,
        fullDate,
        u,
        d,
        total: u + d,
        timestamp: item.record_at
      })
    } else {
      const entry = dayMap.get(dateKey)!
      entry.u += u
      entry.d += d
      entry.total += (u + d)
    }
  })

  // 按时间先后升序排列，取最近 14 天
  const sorted = Array.from(dayMap.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-14)

  // 计算累计总走势
  let runningTotal = 0
  return sorted.map((day) => {
    runningTotal += day.total
    return {
      ...day,
      cumulative: runningTotal
    }
  })
})

// 🌟 算法：计算易于人类阅读的整齐刻度上限 (Nice Ceiling)
function calculateNiceCeil(bytes: number): number {
  if (bytes <= 0) return 1024 * 1024 * 1024 // 默认 1GB 兜底
  const gb = 1024 * 1024 * 1024
  const mb = 1024 * 1024
  
  if (bytes < gb) {
    // 小于 1GB，按 100MB 档位上取整
    const mbs = bytes / mb
    const niceMbs = [50, 100, 200, 300, 500, 800, 1024].find(step => step >= mbs) || 1024
    return niceMbs * mb
  }
  
  // 大于 1GB，按规范梯级取整: 2, 4, 6, 8, 10, 15, 20, 30, 50, 100...
  const gbs = bytes / gb
  const niceGbs = [2, 4, 6, 8, 10, 15, 20, 30, 50, 80, 100, 150, 200, 300, 500, 1000].find(step => step >= gbs) || Math.ceil(gbs * 1.2)
  return niceGbs * gb
}

// 左 Y 轴（单日峰值）规范化上限
const maxDailyY = computed(() => {
  const actualMax = Math.max(...dailyAggregatedData.value.map(d => d.total), 0)
  return calculateNiceCeil(actualMax)
})

// 右 Y 轴（累计总量）规范化上限
const maxCumulativeY = computed(() => {
  const actualMax = Math.max(...dailyAggregatedData.value.map(d => d.cumulative), 0)
  return calculateNiceCeil(actualMax)
})

// 🌟 核心：X 轴日期智能抽样显示判定（首尾必显，中间均匀抽样，彻底杜绝重叠！）
const isTickVisible = (idx: number, totalCount: number) => {
  if (idx === 0 || idx === totalCount - 1) return true
  if (totalCount <= 7) return true
  // 14 天模式：仅显示被 3 整除的索引（如 0, 3, 6, 9, 13），文字绝不撞车
  return idx % 3 === 0
}

// 矢量画布坐标配置
const svgW = 740
const svgH = 170
const chartPadLeft = 45   // 为左 Y 轴刻度留白
const chartPadRight = 50  // 为右 Y 轴刻度留白
const chartPadTop = 15
const chartPadBottom = 25
const drawWidth = svgW - chartPadLeft - chartPadRight
const drawHeight = svgH - chartPadTop - chartPadBottom

// 计算每个立柱与折线锚点的 X 坐标
const getColumnCenterX = (idx: number, total: number) => {
  if (total <= 1) return chartPadLeft + drawWidth / 2
  const step = drawWidth / (total - 1)
  return chartPadLeft + idx * step
}

// 计算累计折线 SVG 路径
const cumulativeLinePath = computed(() => {
  const data = dailyAggregatedData.value
  if (data.length <= 1) return ''

  const points = data.map((item, idx) => {
    const x = getColumnCenterX(idx, data.length)
    const y = chartPadTop + drawHeight - (item.cumulative / maxCumulativeY.value) * drawHeight
    return { x, y }
  })

  return points.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`
    const prev = arr[i - 1]
    const cx = (prev.x + pt.x) / 2
    return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`
  }, '')
})

// 闭合面积渐变路径
const cumulativeAreaPath = computed(() => {
  const data = dailyAggregatedData.value
  if (data.length <= 1) return ''
  const line = cumulativeLinePath.value
  const startX = getColumnCenterX(0, data.length)
  const endX = getColumnCenterX(data.length - 1, data.length)
  const baseY = chartPadTop + drawHeight
  return `${line} L ${endX} ${baseY} L ${startX} ${baseY} Z`
})

const currentPeriodTotal = computed(() => {
  const data = dailyAggregatedData.value
  if (data.length === 0) return '0 B'
  return formatBytes(data[data.length - 1].cumulative)
})
</script>

<template>
  <div class="p-6 md:p-7 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent shadow-sm overflow-hidden flex flex-col justify-between h-full select-none">
    
    <!-- 卡片顶栏：图例与累计总额 -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--md-sys-color-primary)]">流量趋势分析</span>
        </div>
        <h3 class="text-xl font-black mt-0.5 tracking-tight text-[var(--md-sys-color-on-surface)]">每日使用与累计走势</h3>
      </div>

      <!-- 图例与周期累计胶囊 -->
      <div class="flex flex-wrap items-center gap-2.5 text-xs font-medium opacity-85">
        <span class="flex items-center gap-1.5 text-[var(--md-sys-color-on-surface)]">
          <span class="w-2.5 h-2.5 rounded-full bg-[var(--md-sys-color-primary)]"></span>下载流量
        </span>
        <span class="flex items-center gap-1.5 text-[var(--md-sys-color-on-surface)]">
          <span class="w-2.5 h-2.5 rounded-full bg-purple-400"></span>上传流量
        </span>
        <span class="flex items-center gap-1.5 text-cyan-400 font-bold">
          <span class="w-3.5 h-0.5 border-t-2 border-dashed border-cyan-400"></span>累计走势
        </span>
        <span class="px-2.5 py-1 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] font-mono font-bold">
          周期累计 {{ currentPeriodTotal }}
        </span>
      </div>
    </div>

    <!-- 无数据状态 -->
    <div v-if="dailyAggregatedData.length === 0" class="h-56 flex flex-col items-center justify-center opacity-40 text-sm">
      <span class="material-symbols-outlined text-4xl mb-1">query_stats</span>
      暂无周期流量记录
    </div>

    <!-- 🌟 全矢量自适应坐标系图表区 -->
    <div v-else class="relative w-full h-56 flex flex-col justify-end">
      
      <!-- 动态悬浮数据展示卡 (带全量精确指标) -->
      <Transition name="fade-fast">
        <div
          v-if="hoveredIndex !== null && dailyAggregatedData[hoveredIndex]"
          class="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] text-xs shadow-xl flex items-center gap-3.5 pointer-events-none z-30 backdrop-blur-xl border border-black/5 dark:border-transparent"
        >
          <span class="font-bold text-[var(--md-sys-color-primary)]">{{ dailyAggregatedData[hoveredIndex].fullDate }}</span>
          <span>下行: <b>{{ formatBytes(dailyAggregatedData[hoveredIndex].d) }}</b></span>
          <span class="text-purple-400">上行: <b>{{ formatBytes(dailyAggregatedData[hoveredIndex].u) }}</b></span>
          <span class="text-cyan-400 font-mono font-bold pl-2 border-l border-white/15">累计: {{ formatBytes(dailyAggregatedData[hoveredIndex].cumulative) }}</span>
        </div>
      </Transition>

      <svg class="w-full h-full overflow-visible" :viewBox="`0 0 ${svgW} ${svgH}`" preserveAspectRatio="none">
        <defs>
          <linearGradient id="curveFillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.0" />
          </linearGradient>
        </defs>

        <!-- 🌟 1. 自适应 Y 轴参考网格与刻度数字 (左右双轴自适应标注) -->
        <!-- 顶线 (100%) -->
        <g class="text-[9px] font-mono select-none">
          <line
            :x1="chartPadLeft" :y1="chartPadTop"
            :x2="svgW - chartPadRight" :y2="chartPadTop"
            stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3 3"
          />
          <!-- 左轴 (单日峰值上限) -->
          <text :x="chartPadLeft - 6" :y="chartPadTop + 3" text-anchor="end" fill="currentColor" fill-opacity="0.4">
            {{ formatBytes(maxDailyY) }}
          </text>
          <!-- 右轴 (累计上限) -->
          <text :x="svgW - chartPadRight + 6" :y="chartPadTop + 3" text-anchor="start" fill="#22d3ee" fill-opacity="0.75" font-weight="bold">
            {{ formatBytes(maxCumulativeY) }}
          </text>
        </g>

        <!-- 中线 (50%) -->
        <g class="text-[9px] font-mono select-none">
          <line
            :x1="chartPadLeft" :y1="chartPadTop + drawHeight / 2"
            :x2="svgW - chartPadRight" :y2="chartPadTop + drawHeight / 2"
            stroke="currentColor" stroke-opacity="0.06" stroke-dasharray="3 3"
          />
          <text :x="chartPadLeft - 6" :y="chartPadTop + drawHeight / 2 + 3" text-anchor="end" fill="currentColor" fill-opacity="0.4">
            {{ formatBytes(maxDailyY / 2) }}
          </text>
          <text :x="svgW - chartPadRight + 6" :y="chartPadTop + drawHeight / 2 + 3" text-anchor="start" fill="#22d3ee" fill-opacity="0.5">
            {{ formatBytes(maxCumulativeY / 2) }}
          </text>
        </g>

        <!-- 基线 (0) -->
        <g class="text-[9px] font-mono select-none">
          <line
            :x1="chartPadLeft" :y1="chartPadTop + drawHeight"
            :x2="svgW - chartPadRight" :y2="chartPadTop + drawHeight"
            stroke="currentColor" stroke-opacity="0.12"
          />
          <text :x="chartPadLeft - 6" :y="chartPadTop + drawHeight + 3" text-anchor="end" fill="currentColor" fill-opacity="0.3">
            0 B
          </text>
          <text :x="svgW - chartPadRight + 6" :y="chartPadTop + drawHeight + 3" text-anchor="start" fill="#22d3ee" fill-opacity="0.3">
            0 B
          </text>
        </g>

        <!-- 🌟 2. 累计走势发光曲线与其渐变阴影 -->
        <path :d="cumulativeAreaPath" fill="url(#curveFillGrad)" />
        <path
          :d="cumulativeLinePath"
          fill="none"
          stroke="#22d3ee"
          stroke-width="2.5"
          stroke-dasharray="5 3"
          stroke-linecap="round"
        />

        <!-- 🌟 3. 单日聚合柱体与 X 轴智能抽样标签 -->
        <g v-for="(item, idx) in dailyAggregatedData" :key="item.dateKey">
          <!-- 透明全高触发区 (鼠标悬浮检测) -->
          <rect
            :x="getColumnCenterX(idx, dailyAggregatedData.length) - 12"
            :y="chartPadTop"
            width="24"
            :height="drawHeight"
            fill="transparent"
            class="cursor-pointer"
            @mouseenter="hoveredIndex = idx"
            @mouseleave="hoveredIndex = null"
          />

          <!-- 悬停指示背景高亮柱 -->
          <rect
            v-if="hoveredIndex === idx"
            :x="getColumnCenterX(idx, dailyAggregatedData.length) - 8"
            :y="chartPadTop"
            width="16"
            :height="drawHeight"
            rx="8"
            fill="currentColor"
            fill-opacity="0.05"
            pointer-events="none"
          />

          <!-- 实际流量柱 (上行紫 + 下行主色) -->
          <!-- 下载量 (主色) -->
          <rect
            :x="getColumnCenterX(idx, dailyAggregatedData.length) - 6"
            :y="chartPadTop + drawHeight - (item.d / maxDailyY) * drawHeight"
            width="12"
            :height="Math.max((item.d / maxDailyY) * drawHeight, 0)"
            rx="5"
            fill="var(--md-sys-color-primary)"
            pointer-events="none"
            class="transition-all duration-300"
          />

          <!-- 上传量 (叠加在下载量上方，紫色) -->
          <rect
            v-if="item.u > 0"
            :x="getColumnCenterX(idx, dailyAggregatedData.length) - 6"
            :y="chartPadTop + drawHeight - ((item.d + item.u) / maxDailyY) * drawHeight"
            width="12"
            :height="Math.max((item.u / maxDailyY) * drawHeight, 2)"
            rx="5"
            fill="#c084fc"
            pointer-events="none"
            class="transition-all duration-300"
          />

          <!-- 🌟 核心：X 轴智能抽样日期 (彻底消除重叠，只有特定关键索引才绘制文字) -->
          <text
            v-if="isTickVisible(idx, dailyAggregatedData.length)"
            :x="getColumnCenterX(idx, dailyAggregatedData.length)"
            :y="svgH - 6"
            text-anchor="middle"
            class="text-[9.5px] font-mono select-none transition-colors"
            :fill="hoveredIndex === idx ? 'var(--md-sys-color-primary)' : 'currentColor'"
            :fill-opacity="hoveredIndex === idx ? 1 : 0.5"
            :font-weight="hoveredIndex === idx ? 'bold' : 'normal'"
          >
            {{ item.label }}
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.fade-fast-enter-active, .fade-fast-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fade-fast-enter-from, .fade-fast-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}
</style>