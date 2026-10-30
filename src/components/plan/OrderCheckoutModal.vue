<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/progress/circular-progress.js'

const props = defineProps<{
  open: boolean
  plan: any
}>()

const emit = defineEmits(['close', 'success'])
const router = useRouter()
const userStore = useUserStore()

const PERIOD_KEYS = [
  { key: 'month_price', label: '月付' },
  { key: 'quarter_price', label: '季付' },
  { key: 'half_year_price', label: '半年付' },
  { key: 'year_price', label: '年付' },
  { key: 'two_year_price', label: '两年付' },
  { key: 'three_year_price', label: '三年付' },
  { key: 'onetime_price', label: '一次性' },
  { key: 'reset_price', label: '重置包' }
]

const selectedPeriodKey = ref('')

const availablePeriods = computed(() => {
  if (!props.plan) return []
  return PERIOD_KEYS.filter(
    (pk) => props.plan[pk.key] !== null && props.plan[pk.key] !== undefined
  ).map((pk) => ({
    ...pk,
    price: props.plan[pk.key]
  }))
})

const currentBasePrice = computed(() => {
  if (!props.plan || !selectedPeriodKey.value) return 0
  return props.plan[selectedPeriodKey.value] || 0
})

// 🌟 核心优化 1：默认折叠优惠券，杜绝打开弹窗时键盘自动弹起遮挡屏幕
const isCouponExpanded = ref(false)
const couponCode = ref('')
const couponInfo = ref<any>(null)
const couponError = ref('')
const isCheckingCoupon = ref(false)

const paymentMethods = ref<any[]>([])
const selectedMethod = ref<any>(null)
const isLoadingMethods = ref(false)

const tradeNo = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const qrCodeUrl = ref('')
const isPaidSuccess = ref(false)
let pollTimer: any = null

const showWarningDialog = ref(false)
const warningType = ref<'same_renew' | 'change_plan' | null>(null)

const showPendingConflictDialog = ref(false)
const conflictingOrder = ref<any>(null)
const isCancellingConflict = ref(false)

const discountAmount = computed(() => {
  if (!couponInfo.value) return 0
  if (couponInfo.value.type === 1) return couponInfo.value.value
  if (couponInfo.value.type === 2) return Math.round((currentBasePrice.value * couponInfo.value.value) / 100)
  return 0
})

const priceAfterCoupon = computed(() => {
  const p = currentBasePrice.value - discountAmount.value
  return p < 0 ? 0 : p
})

const handlingFee = computed(() => {
  if (!selectedMethod.value) return 0
  const percent = selectedMethod.value.handling_fee_percent || 0
  const fixed = selectedMethod.value.handling_fee_fixed || 0
  return Math.round((priceAfterCoupon.value * percent) / 100 + fixed)
})

const finalAmount = computed(() => priceAfterCoupon.value + handlingFee.value)

const handleCheckCoupon = async () => {
  if (!couponCode.value.trim() || !props.plan) return
  isCheckingCoupon.value = true
  couponError.value = ''
  try {
    const res: any = await api.post('/user/coupon/check', {
      code: couponCode.value.trim(),
      plan_id: props.plan.id,
      period: selectedPeriodKey.value
    })
    couponInfo.value = res.data ?? res
  } catch (err: any) {
    couponInfo.value = null
    couponError.value = err.message || '优惠码无效'
  } finally {
    isCheckingCoupon.value = false
  }
}

const fetchPaymentMethods = async () => {
  isLoadingMethods.value = true
  try {
    const res: any = await api.get('/user/order/getPaymentMethod')
    paymentMethods.value = Array.isArray(res) ? res : (res.data || [])
    if (paymentMethods.value.length > 0) {
      selectedMethod.value = paymentMethods.value[0]
    }
  } catch {
    paymentMethods.value = []
  } finally {
    isLoadingMethods.value = false
  }
}

const startPolling = (no: string) => {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const res: any = await api.get(`/user/order/check?trade_no=${no}`)
      const status = res.data ?? res
      if (status === 3) {
        stopPolling()
        isPaidSuccess.value = true
        userStore.fetchDashboardData()
        emit('success')
      } else if (status === 2) {
        stopPolling()
        errorMessage.value = '订单已超时或取消'
      }
    } catch {}
  }, 2200)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const checkExistingPendingOrder = async (): Promise<any | null> => {
  try {
    const res: any = await api.get('/user/order/fetch?status=0')
    const list = Array.isArray(res) ? res : (res.data || [])
    return list.length > 0 ? list[0] : null
  } catch {
    return null
  }
}

const handlePreCheckout = async () => {
  const pending = await checkExistingPendingOrder()
  if (pending) {
    conflictingOrder.value = pending
    showPendingConflictDialog.value = true
    return
  }

  const currentSub = userStore.subscribeInfo
  const currentPlanId = currentSub?.plan_id

  if (currentPlanId && props.plan.id === currentPlanId && selectedPeriodKey.value !== 'reset_price') {
    warningType.value = 'same_renew'
    showWarningDialog.value = true
    return
  }

  if (currentPlanId && props.plan.id !== currentPlanId) {
    warningType.value = 'change_plan'
    showWarningDialog.value = true
    return
  }

  proceedToSaveAndPay()
}

const handleCancelConflictAndProceed = async () => {
  if (!conflictingOrder.value) return
  isCancellingConflict.value = true
  try {
    await api.post('/user/order/cancel', { trade_no: conflictingOrder.value.trade_no })
    conflictingOrder.value = null
    showPendingConflictDialog.value = false
    userStore.fetchDashboardData()
    await proceedToSaveAndPay()
  } catch (err: any) {
    alert(err.message || '取消旧订单失败')
  } finally {
    isCancellingConflict.value = false
  }
}

const handleGoToConflictOrder = () => {
  if (!conflictingOrder.value) return
  const no = conflictingOrder.value.trade_no
  showPendingConflictDialog.value = false
  emit('close')
  router.push(`/order/${no}`)
}

const proceedToSaveAndPay = async () => {
  showWarningDialog.value = false
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    const saveRes: any = await api.post('/user/order/save', {
      plan_id: props.plan.id,
      period: selectedPeriodKey.value,
      coupon_code: couponInfo.value ? couponCode.value.trim() : undefined
    })
    const no = saveRes.data || saveRes
    tradeNo.value = no

    const checkoutRes: any = await api.post('/user/order/checkout', {
      trade_no: no,
      method: selectedMethod.value?.id
    })

    const type = Number(checkoutRes.type)
    const data = checkoutRes.data

    if (type === -1) {
      isPaidSuccess.value = true
      userStore.fetchDashboardData()
      emit('success')
      return
    }

    if (type === 0) {
      qrCodeUrl.value = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=200x200`
      startPolling(no)
      return
    }

    if (type === 1) {
      startPolling(no)
      window.location.href = data
      return
    }
  } catch (err: any) {
    const msg = err.message || ''
    if (msg.includes('未支付') || msg.includes('开通中')) {
      const pending = await checkExistingPendingOrder()
      if (pending) {
        conflictingOrder.value = pending
        showPendingConflictDialog.value = true
        return
      }
    }
    errorMessage.value = msg || '下单失败，请检查是否已有未支付订单'
  } finally {
    isSubmitting.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      isCouponExpanded.value = false // 保证每次进入时优惠码输入框不展开
      couponCode.value = ''
      couponInfo.value = null
      couponError.value = ''
      errorMessage.value = ''
      qrCodeUrl.value = ''
      isPaidSuccess.value = false
      tradeNo.value = ''
      showWarningDialog.value = false
      showPendingConflictDialog.value = false
      if (availablePeriods.value.length > 0) {
        selectedPeriodKey.value = availablePeriods.value[0].key
      }
      fetchPaymentMethods()
    } else {
      stopPolling()
    }
  }
)

onUnmounted(stopPolling)
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div>
    <!-- 主收银弹窗 (移动端极致纵向收敛，一屏搞定) -->
    <md-dialog :open="open" @closed="emit('close')" class="md3-checkout-dialog max-w-lg w-full">
      <!-- 紧凑顶栏：标题 + 套餐名合流 -->
      <div slot="headline" class="w-full flex items-center justify-between text-[var(--md-sys-color-on-surface)] select-none">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-xl">shopping_cart_checkout</span>
          <span class="font-black text-lg tracking-tight">{{ plan?.name }}</span>
        </div>
        <span class="text-xs font-bold opacity-60 font-mono">{{ plan?.transfer_enable }} GB 额度</span>
      </div>

      <div slot="content" class="flex flex-col gap-3.5 py-1 text-xs text-[var(--md-sys-color-on-surface)] select-none">
        <!-- 支付成功状态页面 -->
        <div v-if="isPaidSuccess" class="py-8 flex flex-col items-center justify-center text-center gap-3">
          <div class="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <span class="material-symbols-outlined text-3xl">check_circle</span>
          </div>
          <h4 class="text-lg font-black">支付成功！</h4>
          <p class="text-[11px] opacity-70">您的订阅套餐已即刻开通，快去仪表盘一键导入节点吧。</p>
        </div>

        <!-- 二维码扫码支付 -->
        <div v-else-if="qrCodeUrl" class="py-3 flex flex-col items-center justify-center text-center gap-3">
          <div class="p-3 rounded-2xl bg-white shadow-md">
            <img :src="qrCodeUrl" class="w-44 h-44 object-contain" alt="支付二维码" />
          </div>
          <div class="flex items-center gap-2 text-xs font-bold text-[var(--md-sys-color-primary)] animate-pulse">
            <md-circular-progress indeterminate style="--md-circular-progress-size: 14px;"></md-circular-progress>
            等待扫码支付确认中...
          </div>
        </div>

        <!-- 🌟 核心一屏无滚动选单 -->
        <template v-else>
          <div v-if="errorMessage" class="p-2.5 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">error</span>
            <span>{{ errorMessage }}</span>
          </div>

          <!-- 1. 紧凑型周期选择器 (大面积卡片缩小为高保真自适应胶囊网格) -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[11px] font-bold opacity-60">选择订购周期与包类型</span>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div
                v-for="p in availablePeriods"
                :key="p.key"
                @click="selectedPeriodKey = p.key"
                class="py-2 px-2.5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between border select-none active:scale-95"
                :class="selectedPeriodKey === p.key
                  ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-transparent shadow-sm'
                  : 'bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] border-black/5 dark:border-transparent opacity-85'"
              >
                <span class="text-[11px] font-bold" :class="p.key === 'reset_price' ? 'text-amber-500' : ''">
                  {{ p.label }}
                </span>
                <span class="text-sm font-black mt-1 font-mono">
                  {{ userStore.currencySymbol }}{{ (p.price / 100).toFixed(2) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 2. 紧凑型支付网关选择 -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[11px] font-bold opacity-60">支付网关方式</span>
            <div v-if="isLoadingMethods" class="py-2 flex justify-center">
              <md-circular-progress indeterminate style="--md-circular-progress-size: 18px;"></md-circular-progress>
            </div>
            <div v-else class="grid grid-cols-2 gap-2">
              <div
                v-for="m in paymentMethods"
                :key="m.id"
                @click="selectedMethod = m"
                class="py-2 px-3 rounded-2xl cursor-pointer transition-all flex items-center gap-2 border select-none"
                :class="selectedMethod?.id === m.id
                  ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-transparent shadow-sm'
                  : 'bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] border-black/5 dark:border-transparent opacity-80'"
              >
                <img v-if="m.icon" :src="m.icon" class="w-5 h-5 object-contain" />
                <span v-else class="material-symbols-outlined text-base">payments</span>
                <div class="flex flex-col truncate">
                  <span class="text-xs font-bold truncate">{{ m.name }}</span>
                  <span v-if="m.handling_fee_percent || m.handling_fee_fixed" class="text-[9px] opacity-60 font-mono">
                    +{{ m.handling_fee_percent }}% 费率
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 🌟 核心优化 2：优惠折扣码折叠卡（默认绝不聚焦，防弹起手机键盘） -->
          <div class="pt-1">
            <div v-if="!isCouponExpanded" class="flex items-center justify-between">
              <button
                type="button"
                @click="isCouponExpanded = true"
                class="text-[11px] font-bold text-[var(--md-sys-color-primary)] hover:underline flex items-center gap-1 cursor-pointer py-1"
              >
                <span class="material-symbols-outlined text-sm">confirmation_number</span>
                <span>我有优惠折扣码？</span>
              </button>

              <span v-if="couponInfo" class="text-[11px] font-bold text-emerald-500">
                已抵扣 -{{ userStore.currencySymbol }}{{ (discountAmount / 100).toFixed(2) }}
              </span>
            </div>

            <!-- 点击后才展示输入框 -->
            <div v-else class="flex flex-col gap-1.5 p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)] transition-all">
              <div class="flex gap-2 items-center">
                <md-outlined-text-field
                  label="输入优惠券代码"
                  :value="couponCode"
                  @input="(e: any) => couponCode = e.target.value"
                  class="flex-1"
                >
                  <span slot="leading-icon" class="material-symbols-outlined">confirmation_number</span>
                </md-outlined-text-field>

                <md-filled-tonal-button
                  type="button"
                  @click="handleCheckCoupon"
                  :disabled="isCheckingCoupon || !couponCode"
                  class="h-14"
                >
                  {{ isCheckingCoupon ? '...' : '使用' }}
                </md-filled-tonal-button>
              </div>

              <div class="flex justify-between items-center px-1">
                <span v-if="couponInfo" class="text-[11px] font-bold text-emerald-500">
                  ✓ 已应用 -{{ userStore.currencySymbol }}{{ (discountAmount / 100).toFixed(2) }}
                </span>
                <span v-else-if="couponError" class="text-[11px] font-bold text-red-500">
                  ✕ {{ couponError }}
                </span>
                <button
                  type="button"
                  @click="isCouponExpanded = false"
                  class="ml-auto text-[10px] opacity-50 hover:opacity-100 cursor-pointer"
                >
                  收起
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 🌟 核心优化 3：电商级固定吸附底栏（金额、手续费、支付按钮整合，一屏完成） -->
      <div slot="actions" class="w-full flex items-center justify-between gap-3 pt-1">
        <template v-if="!isPaidSuccess && !qrCodeUrl">
          <!-- 左侧：紧凑实付与费用提示 -->
          <div class="flex flex-col select-none">
            <span class="text-[10px] opacity-50">
              应付总额 <span v-if="handlingFee > 0">(含网关手续费)</span>
            </span>
            <span class="text-xl font-black text-[var(--md-sys-color-primary)] font-mono leading-none mt-0.5">
              {{ userStore.currencySymbol }}{{ (finalAmount / 100).toFixed(2) }}
            </span>
          </div>

          <!-- 右侧：取消与立即支付 -->
          <div class="flex items-center gap-1.5">
            <md-text-button @click="emit('close')">取消</md-text-button>
            <md-filled-button
              @click="handlePreCheckout"
              :disabled="isSubmitting || !selectedMethod || availablePeriods.length === 0"
              class="h-11"
            >
              <md-circular-progress v-if="isSubmitting" indeterminate slot="icon" style="--md-circular-progress-size: 14px;"></md-circular-progress>
              <span v-else>立即支付</span>
            </md-filled-button>
          </div>
        </template>

        <template v-else>
          <md-filled-button @click="emit('close')" class="w-full">
            关闭
          </md-filled-button>
        </template>
      </div>
    </md-dialog>

    <!-- 订单冲突弹窗 -->
    <md-dialog :open="showPendingConflictDialog" @closed="showPendingConflictDialog = false" class="md3-checkout-dialog">
      <div slot="headline" class="flex items-center gap-2 text-amber-500 font-black text-lg">
        <span class="material-symbols-outlined">pending_actions</span>
        存在未完成的待支付订单
      </div>
      <div slot="content" class="text-xs leading-relaxed text-[var(--md-sys-color-on-surface)] opacity-90 py-1">
        <p>系统检测到您当前已有处于<b>待支付</b>状态的未完成订单，无法直接创建新订单：</p>
        <div class="mt-2.5 p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-1 font-mono">
          <div class="flex justify-between">
            <span class="opacity-60">未付单号：</span>
            <span class="font-bold">{{ conflictingOrder?.trade_no }}</span>
          </div>
          <div class="flex justify-between">
            <span class="opacity-60">订单金额：</span>
            <span class="text-[var(--md-sys-color-primary)] font-bold">
              {{ userStore.currencySymbol }}{{ ((conflictingOrder?.total_amount || 0) / 100).toFixed(2) }}
            </span>
          </div>
        </div>
      </div>
      <div slot="actions">
        <md-text-button @click="showPendingConflictDialog = false">返回</md-text-button>
        <md-filled-tonal-button @click="handleGoToConflictOrder">去支付旧单</md-filled-tonal-button>
        <md-filled-button
          @click="handleCancelConflictAndProceed"
          :disabled="isCancellingConflict"
          style="--md-sys-color-primary: #ba1a1a; --md-sys-color-on-primary: #ffffff;"
        >
          <span v-if="!isCancellingConflict">取消旧单并继续</span>
          <md-circular-progress v-else indeterminate slot="icon" style="--md-circular-progress-size: 14px;"></md-circular-progress>
        </md-filled-button>
      </div>
    </md-dialog>

    <!-- 规则提醒弹窗 -->
    <md-dialog :open="showWarningDialog" @closed="showWarningDialog = false" class="md3-checkout-dialog">
      <div slot="headline" class="flex items-center gap-2 text-amber-500 font-black text-lg">
        <span class="material-symbols-outlined">warning</span>
        {{ warningType === 'same_renew' ? '续费重置规则提醒' : '变更套餐覆盖提醒' }}
      </div>
      <div slot="content" class="text-xs leading-relaxed text-[var(--md-sys-color-on-surface)] opacity-90 py-1">
        <template v-if="warningType === 'same_renew'">
          <p>您当前正在续费现有套餐。<b>未到该套餐购买日续费将不重置流量</b>。</p>
          <div class="mt-2 p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
            若急需立即恢复流量，请取消并在上方周期中选择【重置包】购买。
          </div>
        </template>
        <template v-else-if="warningType === 'change_plan'">
          <p class="font-bold text-red-500 dark:text-red-400">请注意，变更订阅会导致当前订阅被新订阅覆盖。</p>
          <p class="mt-1 opacity-70">您现有套餐的剩余时间和可用配额将被新套餐直接替代并折抵，确定要继续变更吗？</p>
        </template>
      </div>
      <div slot="actions">
        <md-text-button @click="showWarningDialog = false">返回修改</md-text-button>
        <md-filled-button @click="proceedToSaveAndPay">我已知晓，继续下单</md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<style scoped>
.md3-checkout-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>