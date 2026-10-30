<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'

const router = useRouter()
const userStore = useUserStore()
const orders = ref<any[]>([])
const loading = ref(false)

// 状态筛选：all, 0:待支付, 3:已完成, 2:已取消
const selectedStatus = ref<number | 'all'>('all')

// 取消确认弹窗状态
const isCancelModalOpen = ref(false)
const cancelTargetTradeNo = ref('')
const isCancelling = ref(false)

const fetchOrders = async () => {
  loading.value = true
  try {
    const res: any = await api.get('/user/order/fetch')
    orders.value = Array.isArray(res) ? res : (res.data || [])
  } catch {
    orders.value = []
  } finally {
    loading.value = false
  }
}

const filteredOrders = computed(() => {
  if (selectedStatus.value === 'all') return orders.value
  return orders.value.filter((o) => o.status === selectedStatus.value)
})

const getStatusBadge = (status: number) => {
  switch (status) {
    case 0:
      return { text: '待支付', class: 'bg-amber-500/15 text-amber-500' }
    case 1:
      return { text: '开通中', class: 'bg-blue-500/15 text-blue-500' }
    case 2:
      return { text: '已取消', class: 'bg-zinc-500/15 text-zinc-400' }
    case 3:
      return { text: '已完成', class: 'bg-emerald-500/15 text-emerald-500' }
    case 4:
      return { text: '已折抵', class: 'bg-purple-500/15 text-purple-400' }
    default:
      return { text: '处理中', class: 'bg-zinc-500/15 text-zinc-400' }
  }
}

// 触发取消订单弹窗
const openCancelModal = (e: Event, tradeNo: string) => {
  e.stopPropagation()
  cancelTargetTradeNo.value = tradeNo
  isCancelModalOpen.value = true
}

const handleConfirmCancel = async () => {
  if (!cancelTargetTradeNo.value) return
  isCancelling.value = true
  try {
    await api.post('/user/order/cancel', { trade_no: cancelTargetTradeNo.value })
    isCancelModalOpen.value = false
    fetchOrders()
    userStore.fetchDashboardData()
  } catch (err: any) {
    alert(err.message || '取消订单失败')
  } finally {
    isCancelling.value = false
  }
}

const formatDate = (ts: number) => {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleString()
}

onMounted(fetchOrders)
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-6 w-full">
    <!-- 顶栏状态筛选分段器 -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
      <p class="text-xs md:text-sm opacity-60 leading-relaxed">
        查询您的所有历史订购清单、缴费状态与扣款记录。
      </p>

      <div class="flex items-center gap-1.5 p-1 rounded-full bg-[var(--md-sys-color-surface-container)] shrink-0 self-start sm:self-auto">
        <button
          v-for="tab in [
            { label: '全部', value: 'all' },
            { label: '待支付', value: 0 },
            { label: '已完成', value: 3 },
            { label: '已取消', value: 2 }
          ]"
          :key="tab.label"
          @click="selectedStatus = tab.value as any"
          class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer"
          :class="selectedStatus === tab.value
            ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm'
            : 'opacity-65 hover:opacity-100'"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading && orders.length === 0" class="py-20 flex justify-center">
      <md-circular-progress indeterminate></md-circular-progress>
    </div>

    <!-- 无订单 -->
    <div v-else-if="filteredOrders.length === 0" class="py-16 flex flex-col items-center justify-center opacity-40 text-sm">
      <span class="material-symbols-outlined text-4xl mb-2">receipt_long</span>
      暂无符合条件的订单记录
    </div>

    <!-- 订单列表 -->
    <div v-else class="flex flex-col gap-3.5 w-full">
      <div
        v-for="order in filteredOrders"
        :key="order.trade_no"
        @click="router.push(`/order/${order.trade_no}`)"
        class="p-5 md:p-6 rounded-[28px] bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] cursor-pointer transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group"
      >
        <div class="flex items-start md:items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-2xl">receipt</span>
          </div>

          <div class="flex flex-col">
            <div class="flex items-center gap-2.5">
              <span class="font-extrabold text-base">{{ order.plan?.name || '套餐订阅' }}</span>
              <span
                class="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                :class="getStatusBadge(order.status).class"
              >
                {{ getStatusBadge(order.status).text }}
              </span>
            </div>
            <span class="text-xs font-mono opacity-50 mt-1">单号：{{ order.trade_no }}</span>
            <span class="text-[11px] opacity-40 mt-0.5">{{ formatDate(order.created_at) }}</span>
          </div>
        </div>

        <div class="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-[var(--md-sys-color-outline-variant)]/10">
          <div class="text-right">
            <span class="text-xs opacity-60 mr-1">实付</span>
            <span class="text-lg font-black text-[var(--md-sys-color-primary)]">
              {{ userStore.currencySymbol }}{{ ((order.total_amount || 0) / 100).toFixed(2) }}
            </span>
          </div>

          <!-- 待支付订单快捷操作 -->
          <div v-if="order.status === 0" class="flex items-center gap-2" @click.stop>
            <button
              @click="openCancelModal($event, order.trade_no)"
              class="px-3 py-1.5 rounded-full text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
            >
              取消订单
            </button>
            <button
              @click="router.push(`/order/${order.trade_no}`)"
              class="px-3 py-1.5 rounded-full text-xs font-bold text-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)] active:scale-95 transition-all cursor-pointer"
            >
              去支付
            </button>
          </div>

          <span v-else class="material-symbols-outlined text-base opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
            arrow_forward_ios
          </span>
        </div>
      </div>
    </div>

    <!-- 取消订单确认弹窗 -->
    <md-dialog :open="isCancelModalOpen" @closed="isCancelModalOpen = false" class="md3-order-dialog">
      <div slot="headline" class="flex items-center gap-2 text-red-500 font-black text-lg">
        <span class="material-symbols-outlined">warning</span>
        取消未支付订单
      </div>
      <div slot="content" class="text-sm leading-relaxed text-[var(--md-sys-color-on-surface)] opacity-90 py-2">
        确定要放弃并取消单号为 <b class="font-mono">{{ cancelTargetTradeNo }}</b> 的这笔待支付订单吗？取消后若需购买需要重新下单。
      </div>
      <div slot="actions">
        <md-text-button @click="isCancelModalOpen = false">保留订单</md-text-button>
        <md-filled-button
          @click="handleConfirmCancel"
          :disabled="isCancelling"
          style="--md-sys-color-primary: #ba1a1a; --md-sys-color-on-primary: #ffffff;"
        >
          <md-circular-progress v-if="isCancelling" indeterminate slot="icon" style="--md-circular-progress-size: 16px;"></md-circular-progress>
          <span v-else>确认取消</span>
        </md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<style scoped>
.md3-order-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>