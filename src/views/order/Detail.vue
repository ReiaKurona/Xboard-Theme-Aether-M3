<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const tradeNo = computed(() => {
  return (route.params.trade_no as string) || 
         (route.query.trade_no as string) || 
         (route.query.out_trade_no as string) || ''
})

const orderDetail = ref<any>(null)
const orderStatus = ref<number | null>(null) // 0:待支付 1:开通中 2:已取消 3:已完成 4:已折抵
const loading = ref(true)
const cancelling = ref(false)
const paying = ref(false)
let pollTimer: any = null

const fetchOrderDetail = async () => {
  if (!tradeNo.value) return
  try {
    const res: any = await api.get(`/user/order/detail?trade_no=${tradeNo.value}`)
    orderDetail.value = res.data ?? res
  } catch (e) {
    console.error('获取订单详情失败', e)
  }
}

// 5.6 轮询订单状态
const checkOrderStatus = async () => {
  if (!tradeNo.value) return
  try {
    const res: any = await api.get(`/user/order/check?trade_no=${tradeNo.value}`)
    const status = Number(res.data ?? res)
    orderStatus.value = status

    if (status === 3) {
      stopPolling()
      fetchOrderDetail() // 重新拉取以获取支付完成时间
      userStore.fetchDashboardData() // 刷新订阅流量
    } else if (status === 2) {
      stopPolling()
    }
  } catch {}
}

const startPolling = () => {
  stopPolling()
  pollTimer = setInterval(async () => {
    if (orderStatus.value !== 3 && orderStatus.value !== 2) {
      await checkOrderStatus()
    } else {
      stopPolling()
    }
  }, 2200)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 🌟 窗口可见性感知：用户从支付宝/微信切回浏览器时，立刻探测一次，付完钱瞬间出结果！
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && orderStatus.value !== 3 && orderStatus.value !== 2) {
    checkOrderStatus()
  }
}

// 5.7 取消待支付订单
const handleCancelOrder = async () => {
  if (!tradeNo.value) return
  cancelling.value = true
  try {
    await api.post('/user/order/cancel', { trade_no: tradeNo.value })
    orderStatus.value = 2
    if (orderDetail.value) orderDetail.value.status = 2
    userStore.fetchDashboardData()
  } catch (err: any) {
    alert(err.message || '取消订单失败')
  } finally {
    cancelling.value = false
  }
}

// 待支付订单直接继续结算
const handleResumePayment = async () => {
  if (!tradeNo.value || !orderDetail.value) return
  paying.value = true
  try {
    const res: any = await api.post('/user/order/checkout', {
      trade_no: tradeNo.value,
      method: orderDetail.value.payment_id
    })
    const type = Number(res.type)
    const data = res.data
    if (type === 1) {
      window.location.href = data
    } else if (type === 0) {
      alert('请使用扫码方式支付')
    }
  } catch (err: any) {
    alert(err.message || '拉起支付失败')
  } finally {
    paying.value = false
  }
}

const formatDate = (ts: number) => {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleString()
}

onMounted(async () => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  loading.value = true
  await fetchOrderDetail()
  await checkOrderStatus()
  loading.value = false

  if (orderStatus.value !== 3 && orderStatus.value !== 2) {
    startPolling()
  }
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopPolling()
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-6 w-full max-w-2xl mx-auto">
    <!-- 加载中 -->
    <div v-if="loading" class="py-24 flex flex-col items-center justify-center gap-3">
      <md-circular-progress indeterminate></md-circular-progress>
      <span class="text-xs opacity-60">查询订单状态中...</span>
    </div>

    <!-- 订单卡片 -->
    <div v-else class="p-6 md:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm flex flex-col gap-6">
      
      <!-- 🌟 状态 3：支付成功完成 (轮询自动跳转到此状态，无需刷新) -->
      <div v-if="orderStatus === 3" class="py-6 flex flex-col items-center text-center gap-3">
        <div class="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shadow-sm animate-bounce">
          <span class="material-symbols-outlined text-4xl">check_circle</span>
        </div>
        <h2 class="text-2xl font-black tracking-tight text-emerald-500">支付成功，服务已开通！</h2>
        <p class="text-xs opacity-70 max-w-sm">
          系统已成功完成自动结算与配额下发，您的订阅已就绪。
        </p>
      </div>

      <!-- 状态 1 / 0：等待开通或待支付 -->
      <div v-else-if="orderStatus === 1 || orderStatus === 0" class="py-6 flex flex-col items-center text-center gap-3">
        <div class="w-16 h-16 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center">
          <md-circular-progress indeterminate style="--md-circular-progress-size: 36px;"></md-circular-progress>
        </div>
        <h2 class="text-xl font-black tracking-tight text-amber-500">
          {{ orderStatus === 1 ? '服务开通中...' : '等待支付确认...' }}
        </h2>
        <p class="text-xs opacity-60">正在等待支付完成，系统将在检测到到账后自动更新。</p>
      </div>

      <!-- 状态 2：已取消 -->
      <div v-else-if="orderStatus === 2" class="py-6 flex flex-col items-center text-center gap-3">
        <div class="w-16 h-16 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center">
          <span class="material-symbols-outlined text-4xl">cancel</span>
        </div>
        <h2 class="text-xl font-black tracking-tight text-red-500">订单已取消</h2>
        <p class="text-xs opacity-60">该笔订单未完成支付或已被取消。</p>
      </div>

      <!-- 订单明细清单 -->
      <div class="p-5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 flex flex-col gap-3 text-xs">
        <div class="flex justify-between items-center pb-2 border-b border-[var(--md-sys-color-outline-variant)]/10">
          <span class="font-bold opacity-60">系统订单号</span>
          <span class="font-mono font-bold select-all">{{ tradeNo }}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="opacity-60">订阅套餐</span>
          <span class="font-bold text-sm">{{ orderDetail?.plan?.name || '订阅套餐' }}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="opacity-60">支付网关</span>
          <span>{{ orderDetail?.payment?.name || '在线支付' }}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="opacity-60">创建时间</span>
          <span>{{ formatDate(orderDetail?.created_at) }}</span>
        </div>
        <div v-if="orderDetail?.paid_at" class="flex justify-between items-center">
          <span class="opacity-60">支付时间</span>
          <span>{{ formatDate(orderDetail?.paid_at) }}</span>
        </div>
        <div class="flex justify-between items-center pt-2 border-t border-[var(--md-sys-color-outline-variant)]/10 font-bold text-sm">
          <span>实付金额</span>
          <span class="text-base text-[var(--md-sys-color-primary)]">
            {{ userStore.currencySymbol }}{{ ((orderDetail?.total_amount || 0) / 100).toFixed(2) }}
          </span>
        </div>
      </div>

      <!-- 操作按钮栏 -->
      <div class="flex items-center justify-between gap-3 pt-2">
        <md-text-button @click="router.push('/order')">
          返回订单列表
        </md-text-button>

        <div class="flex items-center gap-2">
          <!-- 待支付状态下：取消订单 与 继续支付 -->
          <template v-if="orderStatus === 0">
            <button
              @click="handleCancelOrder"
              :disabled="cancelling"
              class="px-4 py-2.5 rounded-full text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
            >
              {{ cancelling ? '取消中...' : '取消此订单' }}
            </button>
            <md-filled-button @click="handleResumePayment" :disabled="paying">
              {{ paying ? '跳转中...' : '继续支付' }}
            </md-filled-button>
          </template>

          <!-- 成功后一键前往仪表盘 -->
          <md-filled-button v-else-if="orderStatus === 3" @click="router.push('/dashboard')">
            <span class="material-symbols-outlined text-sm" slot="icon">dashboard</span>
            前往仪表盘使用
          </md-filled-button>
        </div>
      </div>
    </div>
  </div>
</template>