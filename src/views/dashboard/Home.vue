<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TrafficChart from '../../components/dashboard/TrafficChart.vue'
import NoticeCard from '../../components/dashboard/NoticeCard.vue'
import SubscriptionCard from '../../components/dashboard/SubscriptionCard.vue'
import ClientConfigCard from '../../components/dashboard/ClientConfigCard.vue'

const router = useRouter()


const isEditMode = ref(false)
const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

export interface DashboardCardConfig {
  id: 'subscription' | 'traffic' | 'client' | 'notice'
  name: string
  size: '4x2' | '2x2'
  visible: boolean
}

const DEFAULT_LAYOUT: DashboardCardConfig[] = [
  { id: 'subscription', name: '套餐订阅信息', size: '4x2', visible: true },
  { id: 'traffic', name: '流量趋势分析', size: '2x2', visible: true },
  { id: 'client', name: '快捷客户端接入', size: '2x2', visible: true },
  { id: 'notice', name: '最新系统广播', size: '4x2', visible: true }
]

const layoutCards = ref<DashboardCardConfig[]>([])

const loadLayout = () => {
  try {
    const raw = localStorage.getItem('xboard_dashboard_layout_v2')
    if (raw) {
      layoutCards.value = JSON.parse(raw)
      return
    }
  } catch {}
  layoutCards.value = JSON.parse(JSON.stringify(DEFAULT_LAYOUT))
}

const saveLayout = () => {
  localStorage.setItem('xboard_dashboard_layout_v2', JSON.stringify(layoutCards.value))
}

const resetDefaultLayout = () => {
  layoutCards.value = JSON.parse(JSON.stringify(DEFAULT_LAYOUT))
  saveLayout()
  isEditMode.value = false
}

const toggleCardSize = (card: DashboardCardConfig) => {
  card.size = card.size === '4x2' ? '2x2' : '4x2'
  saveLayout()
}

const onDragStart = (idx: number) => { draggedIndex.value = idx }
const onDragOver = (idx: number) => { dragOverIndex.value = idx }
const onDrop = (idx: number) => {
  if (draggedIndex.value === null || draggedIndex.value === idx) return
  const item = layoutCards.value.splice(draggedIndex.value, 1)[0]
  layoutCards.value.splice(idx, 0, item)
  saveLayout()
}
const onDragEnd = () => {
  draggedIndex.value = null
  dragOverIndex.value = null
}

onMounted(loadLayout)
</script>

<template>
  <div class="flex flex-col gap-6 w-full">
    <!-- 仪表盘控制栏 -->
    <div class="flex items-center justify-between pb-1 min-h-[36px]">
      <div>

        <!-- 🌟 修改后：使用模板全局 $router.push，100% 杜绝 undefined 报错，点击秒级跳转 -->
<button
  @click="$router.push('/activities')"
  class="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer bg-[var(--md-sys-color-surface-container-high)] opacity-80 hover:opacity-100 hover:text-[var(--md-sys-color-primary)] active:scale-95 select-none"
>
  <span class="material-symbols-outlined text-base text-amber-500">celebration</span>
  <span>活动中心</span>
</button>

        <span v-if="isEditMode" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-500 animate-pulse">
          自由布局编辑中
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="isEditMode"
          @click="resetDefaultLayout"
          class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--md-sys-color-surface-container-high)] hover:bg-red-500/10 hover:text-red-500 transition-all cursor-pointer"
        >
          恢复默认布局
        </button>
        <button
          @click="isEditMode = !isEditMode"
          class="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer"
          :class="isEditMode ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-md' : 'bg-[var(--md-sys-color-surface-container-high)] opacity-80 hover:opacity-100'"
        >
          <span class="material-symbols-outlined text-base">{{ isEditMode ? 'check' : 'dashboard_customize' }}</span>
          <span>{{ isEditMode ? '完成自定义' : '自定义布局' }}</span>
        </button>
      </div>
    </div>

    <!-- 4列弹性网格 -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 auto-rows-min w-full">
      <template v-for="(card, idx) in layoutCards" :key="card.id">
        <div
          v-if="card.visible || isEditMode"
          :draggable="isEditMode"
          @dragstart="onDragStart(idx)"
          @dragover.prevent="onDragOver(idx)"
          @drop="onDrop(idx)"
          @dragend="onDragEnd"
          class="relative transition-all duration-300"
          :class="[
            card.size === '4x2' ? 'col-span-1 md:col-span-2 xl:col-span-4' : 'col-span-1 md:col-span-2 xl:col-span-2',
            isEditMode ? 'cursor-grab active:cursor-grabbing hover:scale-[1.01]' : '',
            dragOverIndex === idx && draggedIndex !== idx ? 'outline-2 outline-dashed outline-[var(--md-sys-color-primary)] rounded-[32px] p-1 bg-[var(--md-sys-color-primary)]/5' : ''
          ]"
        >
          <!-- 编辑模式覆盖工具栏 -->
          <div
            v-if="isEditMode"
            class="absolute top-4 right-4 z-20 flex items-center gap-2 bg-[var(--md-sys-color-surface-container-highest)]/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-black/5 dark:border-transparent"
          >
            <button
              @click="toggleCardSize(card)"
              class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
            >
              {{ card.size === '4x2' ? '全宽 4x2' : '半宽 2x2' }}
            </button>
            <button
              @click="card.visible = !card.visible; saveLayout()"
              class="w-6 h-6 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 hover:text-red-500"
            >
              <span class="material-symbols-outlined text-sm">{{ card.visible ? 'visibility' : 'visibility_off' }}</span>
            </button>
          </div>

          <!-- 🌟 1. 独立解耦：我的订阅卡片 -->
          <SubscriptionCard v-if="card.id === 'subscription'" />

          <!-- 2. 流量趋势图 -->
          <TrafficChart v-else-if="card.id === 'traffic'" />

          <!-- 🌟 3. 独立解耦：客户端快速接入卡片 -->
          <ClientConfigCard v-else-if="card.id === 'client'" />

          <!-- 4. 公告广播卡片 -->
          <div v-else-if="card.id === 'notice'" class="h-full p-6 md:p-7 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm">
            <NoticeCard />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>