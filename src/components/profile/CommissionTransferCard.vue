<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '../../stores/user'
import { api } from '../../api/client'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/button/filled-button.js'
import '@material/web/progress/circular-progress.js'

const userStore = useUserStore()
const transferYuan = ref<string>('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// 佣金与余额 (分换算为元)
const commissionBalanceYuan = computed(() => {
  return ((userStore.userInfo?.commission_balance || 0) / 100).toFixed(2)
})

const balanceYuan = computed(() => {
  return ((userStore.userInfo?.balance || 0) / 100).toFixed(2)
})

const handleAllIn = () => {
  transferYuan.value = commissionBalanceYuan.value
}

const handleTransfer = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  const amountYuan = parseFloat(transferYuan.value)
  if (isNaN(amountYuan) || amountYuan <= 0) {
    errorMsg.value = '请输入有效的划转金额'
    return
  }

  // 转换为整数分
  const amountCents = Math.round(amountYuan * 100)
  const maxCents = userStore.userInfo?.commission_balance || 0

  if (amountCents > maxCents) {
    errorMsg.value = '划转金额不能超出可用佣金'
    return
  }

  loading.value = true
  try {
    await api.post('/user/transfer', {
      transfer_amount: amountCents
    })
    successMsg.value = `成功划转 ${userStore.currencySymbol}${amountYuan.toFixed(2)} 到账户余额！`
    transferYuan.value = ''
    userStore.fetchDashboardData()
  } catch (err: any) {
    errorMsg.value = err.message || '划转失败'
  } finally {
    loading.value = false
  }
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="p-6 md:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm h-full flex flex-col justify-between">
    <div>
      <div class="flex items-center gap-2.5 mb-2">
        <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-2xl">currency_exchange</span>
        <h3 class="text-xl font-black tracking-tight">佣金划转余额</h3>
      </div>
      <p class="text-xs opacity-60 mb-5 leading-normal">
        将您推广邀请获得的返利佣金划转至账户主余额，可直接用于购买或续费订阅套餐。
      </p>

      <!-- 双资金资产卡 -->
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] flex flex-col">
          <span class="text-[11px] opacity-60">可用返利佣金</span>
          <span class="text-lg font-black text-emerald-500 mt-1">{{ userStore.currencySymbol }}{{ commissionBalanceYuan }}</span>
        </div>
        <div class="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] flex flex-col">
          <span class="text-[11px] opacity-60">当前账户余额</span>
          <span class="text-lg font-black text-[var(--md-sys-color-primary)] mt-1">{{ userStore.currencySymbol }}{{ balanceYuan }}</span>
        </div>
      </div>

      <form class="flex flex-col gap-3" @submit.prevent="handleTransfer">
        <div v-if="errorMsg" class="p-3 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">error</span>
          {{ errorMsg }}
        </div>
        <div v-if="successMsg" class="p-3 rounded-2xl bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 text-xs flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">check_circle</span>
          {{ successMsg }}
        </div>

        <div class="relative">
          <md-outlined-text-field
            label="划转金额 (元)"
            type="number"
            step="0.01"
            :value="transferYuan"
            @input="(e: any) => transferYuan = e.target.value"
            class="w-full"
            required
          >
            <span slot="leading-icon" class="material-symbols-outlined">payments</span>
          </md-outlined-text-field>

          <button
            type="button"
            @click="handleAllIn"
            class="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full text-xs font-bold text-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)] hover:opacity-90 transition-all"
          >
            全部划转
          </button>
        </div>

        <div class="flex justify-end mt-2 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/10">
          <md-filled-button type="submit" :disabled="loading || (userStore.userInfo?.commission_balance || 0) <= 0">
            <md-circular-progress v-if="loading" indeterminate slot="icon" style="--md-circular-progress-size: 16px;"></md-circular-progress>
            <span v-else>立即划转</span>
          </md-filled-button>
        </div>
      </form>
    </div>
  </div>
</template>