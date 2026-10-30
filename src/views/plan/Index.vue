<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import PlanContentRenderer from '../../components/plan/PlanContentRenderer.vue'
import OrderCheckoutModal from '../../components/plan/OrderCheckoutModal.vue'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/progress/circular-progress.js'

const userStore = useUserStore()
const plans = ref<any[]>([])
const loading = ref(false)

// 周期映射字典
const PERIOD_KEYS = [
  { key: 'month_price', label: '月付' },
  { key: 'quarter_price', label: '季付' },
  { key: 'half_year_price', label: '半年付' },
  { key: 'year_price', label: '年付' },
  { key: 'two_year_price', label: '两年付' },
  { key: 'three_year_price', label: '三年付' },
  { key: 'onetime_price', label: '一次性' },
  { key: 'reset_price', label: '流量重置包' }
]

// 记录每个套餐当前选中的周期: { [planId]: selectedPeriodKey }
const selectedPeriods = ref<Record<number, string>>({})

// 结账弹窗状态
const isCheckoutOpen = ref(false)
const checkoutPlan = ref<any>(null)
const checkoutPeriod = ref('')
const checkoutPeriodLabel = ref('')
const checkoutBasePrice = ref(0)

const fetchPlans = async () => {
  loading.value = true
  try {
    const res: any = await api.get('/user/plan/fetch')
    const list = Array.isArray(res) ? res : (res.data || [])
    plans.value = list

    // 初始化每个套餐默认可用的最低周期
    list.forEach((p: any) => {
      const available = getAvailablePeriods(p)
      if (available.length > 0) {
        selectedPeriods.value[p.id] = available[0].key
      }
    })
  } catch {
    plans.value = []
  } finally {
    loading.value = false
  }
}

// 提取当前套餐可用的周期（价格不为 null）
const getAvailablePeriods = (plan: any) => {
  return PERIOD_KEYS.filter((pk) => plan[pk.key] !== null && plan[pk.key] !== undefined)
}

// 判定是否售罄
const isSoldOut = (plan: any) => {
  if (plan.sell === false) return true
  if (typeof plan.capacity_limit === 'string') return true // "Sold out"
  if (typeof plan.capacity_limit === 'number' && plan.capacity_limit <= 0) return true
  return false
}

// 打开收银结账单
const handleOpenCheckout = (plan: any) => {
  if (isSoldOut(plan)) return
  const periodKey = selectedPeriods.value[plan.id]
  const periodItem = PERIOD_KEYS.find((pk) => pk.key === periodKey)

  checkoutPlan.value = plan
  checkoutPeriod.value = periodKey
  checkoutPeriodLabel.value = periodItem?.label || '默认周期'
  checkoutBasePrice.value = plan[periodKey] || 0
  isCheckoutOpen.value = true
}

onMounted(() => {
  fetchPlans()
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-8 w-full">
    <!-- 顶栏说明副标题（大标题已提至浮动岛） -->
    <div class="flex items-center justify-between pb-1">
      <p class="text-xs md:text-sm opacity-60 leading-relaxed">
        选择适合您的网络订阅套餐与计费周期，畅享全球无缝漫游体验。
      </p>
    </div>

    <!-- 加载中 -->
    <div v-if="loading && plans.length === 0" class="py-20 flex justify-center">
      <md-circular-progress indeterminate></md-circular-progress>
    </div>

    <!-- 无套餐可用 -->
    <div v-else-if="plans.length === 0" class="py-16 flex flex-col items-center justify-center opacity-40 text-sm">
      <span class="material-symbols-outlined text-4xl mb-2">production_quantity_limits</span>
      暂无开放购买的订阅套餐
    </div>

    <!-- 套餐网格卡片矩阵 (全宽弹性多列) -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent p-6 md:p-8 flex flex-col justify-between shadow-sm transition-all hover:shadow-md relative overflow-hidden"
      >
        <!-- 售罄/剩余名额角标 -->
        <div class="flex justify-between items-start gap-2 mb-4">
          <div>
            <h3 class="text-2xl font-black tracking-tight text-[var(--md-sys-color-on-surface)]">
              {{ plan.name }}
            </h3>
            <!-- 标签列表 -->
            <div v-if="plan.tags && plan.tags.length > 0" class="flex flex-wrap gap-1.5 mt-2">
              <span
                v-for="t in plan.tags"
                :key="t"
                class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)]"
              >
                {{ t }}
              </span>
            </div>
          </div>

          <!-- 名额徽章 -->
          <span
            v-if="isSoldOut(plan)"
            class="px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-500 shrink-0"
          >
            已售罄
          </span>
          <span
            v-else-if="typeof plan.capacity_limit === 'number'"
            class="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-500 shrink-0"
          >
            仅剩 {{ plan.capacity_limit }} 席
          </span>
        </div>

        <!-- 价格展示 (动态匹配当前选中的周期) -->
        <div class="my-4 p-4 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 flex items-baseline gap-1.5">
          <span class="text-xs font-bold opacity-60">{{ userStore.currencySymbol }}</span>
          <span class="text-3xl font-black tracking-tight text-[var(--md-sys-color-primary)]">
            {{ ((plan[selectedPeriods[plan.id]] || 0) / 100).toFixed(2) }}
          </span>
          <span class="text-xs opacity-60 font-medium">
            / {{ PERIOD_KEYS.find(pk => pk.key === selectedPeriods[plan.id])?.label }}
          </span>
        </div>

        <!-- 核心规格胶囊属性 -->
        <div class="flex flex-wrap gap-2 mb-5 text-xs font-medium">
          <span class="px-3 py-1.5 rounded-xl bg-[var(--md-sys-color-surface-container-highest)] flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm">wifi</span>
            {{ plan.transfer_enable }} GB 流量
          </span>
          <span v-if="plan.speed_limit" class="px-3 py-1.5 rounded-xl bg-[var(--md-sys-color-surface-container-highest)] flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm">speed</span>
            最高 {{ plan.speed_limit }} Mbps
          </span>
          <span v-if="plan.device_limit" class="px-3 py-1.5 rounded-xl bg-[var(--md-sys-color-surface-container-highest)] flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm">devices</span>
            允许 {{ plan.device_limit }} 台设备
          </span>
        </div>

        <!-- 🌟 核心：内联 HTML、CSS 与 JS 脚本动态渲染器（支持你在后台设置的赛博朋克/MD3呼吸卡片样式） -->
        <div class="mb-6 flex-1">
          <PlanContentRenderer :content="plan.content" />
        </div>

        <!-- 周期切换药丸分段选择器 -->
        <div class="flex flex-col gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]/10">
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="pk in getAvailablePeriods(plan)"
              :key="pk.key"
              @click="selectedPeriods[plan.id] = pk.key"
              class="px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer"
              :class="selectedPeriods[plan.id] === pk.key
                ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shadow-sm'
                : 'bg-[var(--md-sys-color-surface-container-high)] opacity-70 hover:opacity-100'"
            >
              {{ pk.label }}
            </button>
          </div>

          <!-- 立即订购按钮 -->
          <md-filled-button
            @click="handleOpenCheckout(plan)"
            class="w-full h-12 rounded-full font-bold mt-2"
            :disabled="isSoldOut(plan)"
          >
            <span class="material-symbols-outlined text-sm" slot="icon">shopping_bag</span>
            {{ isSoldOut(plan) ? '当前不可订购' : '立即订购' }}
          </md-filled-button>
        </div>
      </div>
    </div>

    <!-- 订单结算与支付弹窗 -->
    <OrderCheckoutModal
      :open="isCheckoutOpen"
      :plan="checkoutPlan"
      :period="checkoutPeriod"
      :periodLabel="checkoutPeriodLabel"
      :basePrice="checkoutBasePrice"
      @close="isCheckoutOpen = false"
      @success="isCheckoutOpen = false"
    />
  </div>
</template>