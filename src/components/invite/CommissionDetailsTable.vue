<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import '@material/web/progress/circular-progress.js'

const userStore = useUserStore()

export interface CommissionItem {
  id: number
  order_amount: number
  trade_no: string
  get_amount: number
  created_at: number
}

const details = ref<CommissionItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = 10
const loading = ref(false)

// 8.3 获取佣金记录 (page_size 最小传 10)
const fetchCommissionDetails = async (page = 1) => {
  currentPage.value = page
  loading.value = true
  try {
    const res: any = await api.get(`/user/invite/details?current=${page}&page_size=${pageSize}`)
    // 返回格式: { data: [...], total }
    details.value = res.data || []
    total.value = res.total || 0
  } catch {
    details.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const formatDate = (ts: number) => {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  fetchCommissionDetails(1)
})
</script>

<template>
  <div class="p-6 md:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent shadow-sm flex flex-col justify-between gap-5 h-full">
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-2xl">receipt_long</span>
          <h3 class="text-xl font-black tracking-tight">返佣明细流水</h3>
        </div>
        <span class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[var(--md-sys-color-surface-container-high)] opacity-70">
          共 {{ total }} 笔入账
        </span>
      </div>

      <p class="text-xs opacity-60 mb-4 leading-normal">
        详细记录受邀用户每笔订购为您产生的佣金分成数据。
      </p>

      <!-- 载入中 -->
      <div v-if="loading && details.length === 0" class="py-12 flex justify-center">
        <md-circular-progress indeterminate></md-circular-progress>
      </div>

      <!-- 无流水 -->
      <div v-else-if="details.length === 0" class="py-12 flex flex-col items-center justify-center text-center opacity-40 text-xs gap-2">
        <span class="material-symbols-outlined text-4xl">payments</span>
        <span>暂无任何返利入账记录，快去分享邀请码吧</span>
      </div>

      <!-- 记录列表 (全自适应，无多余白线) -->
      <div v-else class="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
        <div
          v-for="d in details"
          :key="d.id"
          class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 flex items-center justify-between gap-3 text-xs shadow-sm"
        >
          <div class="flex items-center gap-3 truncate">
            <div class="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 font-bold">
              +
            </div>
            <div class="flex flex-col truncate">
              <span class="font-bold text-[var(--md-sys-color-on-surface)] truncate font-mono">
                订单 #{{ d.trade_no }}
              </span>
              <span class="text-[10px] opacity-50 mt-0.5">
                订单金额：{{ userStore.currencySymbol }}{{ ((d.order_amount || 0) / 100).toFixed(2) }}
              </span>
              <span class="text-[10px] opacity-40">{{ formatDate(d.created_at) }}</span>
            </div>
          </div>

          <div class="text-right shrink-0">
            <div class="text-sm font-black text-emerald-500 font-mono">
              +{{ userStore.currencySymbol }}{{ ((d.get_amount || 0) / 100).toFixed(2) }}
            </div>
            <span class="text-[10px] opacity-50 font-bold">已入账</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页控制器 -->
    <div v-if="total > pageSize" class="flex items-center justify-between pt-3 border-t border-[var(--md-sys-color-outline-variant)]/10 text-xs">
      <span class="opacity-50">第 {{ currentPage }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页</span>
      <div class="flex items-center gap-1.5">
        <button
          @click="fetchCommissionDetails(currentPage - 1)"
          :disabled="currentPage <= 1 || loading"
          class="px-3 py-1 rounded-full bg-[var(--md-sys-color-surface-container-high)] disabled:opacity-30 hover:opacity-100 transition-all cursor-pointer"
        >
          上一页
        </button>
        <button
          @click="fetchCommissionDetails(currentPage + 1)"
          :disabled="currentPage * pageSize >= total || loading"
          class="px-3 py-1 rounded-full bg-[var(--md-sys-color-surface-container-high)] disabled:opacity-30 hover:opacity-100 transition-all cursor-pointer"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>