<script setup lang="ts">
import { ref, computed } from 'vue'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/progress/circular-progress.js'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits(['close', 'success'])
const userStore = useUserStore()

const withdrawMethod = ref('')
const withdrawAccount = ref('')
const isSubmitting = ref(false)
const errorMsg = ref('')

// 可用提现方式列表 (从 4.10 user/comm/config 读取)
const availableMethods = computed<string[]>(() => {
  return userStore.userConfig?.withdraw_methods || ['支付宝', 'USDT-TRC20']
})

// 是否关闭了提现通道
const isWithdrawClosed = computed(() => {
  return Number(userStore.userConfig?.withdraw_close) === 1
})

const commissionYuan = computed(() => {
  return ((userStore.userInfo?.commission_balance || 0) / 100).toFixed(2)
})

const handleWithdraw = async () => {
  if (isWithdrawClosed.value) {
    errorMsg.value = '系统当前已关闭提现通道'
    return
  }
  if (!withdrawMethod.value || !withdrawAccount.value.trim()) {
    errorMsg.value = '请选择提现方式并输入收款账号'
    return
  }

  isSubmitting.value = true
  errorMsg.value = ''
  try {
    // 7.6 发起提现工单
    await api.post('/user/ticket/withdraw', {
      withdraw_method: withdrawMethod.value,
      withdraw_account: withdrawAccount.value.trim()
    })
    withdrawAccount.value = ''
    userStore.fetchDashboardData()
    emit('success')
  } catch (err: any) {
    errorMsg.value = err.message || '申请提现失败'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <md-dialog :open="open" @closed="emit('close')" class="md3-ticket-dialog max-w-lg w-full">
    <div slot="headline" class="font-black text-xl tracking-tight flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
      <span class="material-symbols-outlined text-emerald-500">account_balance_wallet</span>
      佣金提现申请
    </div>

    <div slot="content" class="flex flex-col gap-4 py-2 text-xs text-[var(--md-sys-color-on-surface)]">
      <div v-if="errorMsg" class="p-3 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 flex items-center gap-2">
        <span class="material-symbols-outlined text-base">error</span>
        {{ errorMsg }}
      </div>

      <div class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex items-center justify-between">
        <span class="opacity-70">当前可提现佣金总额</span>
        <span class="text-xl font-black text-emerald-500">{{ userStore.currencySymbol }}{{ commissionYuan }}</span>
      </div>

      <!-- 提现方式选项 -->
      <div class="flex flex-col gap-1.5">
        <span class="font-bold opacity-70">选择收款渠道</span>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="m in availableMethods"
            :key="m"
            @click="withdrawMethod = m"
            class="p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-2 border select-none active:scale-95"
            :class="withdrawMethod === m
              ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-transparent shadow-sm font-bold'
              : 'bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] border-black/5 dark:border-transparent opacity-80'"
          >
            <span class="material-symbols-outlined text-base">credit_card</span>
            <span class="truncate">{{ m }}</span>
          </div>
        </div>
      </div>

      <!-- 账号输入 -->
      <md-outlined-text-field
        label="收款账号 (如支付宝账号 / 钱包地址)"
        :value="withdrawAccount"
        @input="(e: any) => withdrawAccount = e.target.value"
        class="w-full"
        required
      >
        <span slot="leading-icon" class="material-symbols-outlined">badge</span>
      </md-outlined-text-field>

      <p class="text-[11px] opacity-50 leading-relaxed">
        提交后系统将自动生成一张最高优先级加急工单，财务审核后会将资金下发至对应账户。
      </p>
    </div>

    <div slot="actions">
      <md-text-button @click="emit('close')">取消</md-text-button>
      <md-filled-button
        @click="handleWithdraw"
        :disabled="isSubmitting || isWithdrawClosed || (userStore.userInfo?.commission_balance || 0) <= 0"
      >
        <md-circular-progress v-if="isSubmitting" indeterminate slot="icon" style="--md-circular-progress-size: 14px;"></md-circular-progress>
        <span v-else>{{ isWithdrawClosed ? '提现通道维护' : '确认申请提现' }}</span>
      </md-filled-button>
    </div>
  </md-dialog>
</template>

<style scoped>
.md3-ticket-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>