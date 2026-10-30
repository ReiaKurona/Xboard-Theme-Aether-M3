<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '../../stores/user'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'

const props = defineProps<{
  // stat: [已邀请注册人数, 累计有效佣金, 确认中佣金, 佣金比例(%), 可用佣金]
  stat: [number, number, number, number, number] | null
}>()

const emit = defineEmits(['open-transfer', 'open-withdraw'])
const userStore = useUserStore()

// 8.1 严格解构位置数组并换算单位（金额全为分）
const invitedUsersCount = computed(() => props.stat?.[0] || 0)
const totalCommissionYuan = computed(() => (((props.stat?.[1] || 0) / 100).toFixed(2)))
const pendingCommissionYuan = computed(() => (((props.stat?.[2] || 0) / 100).toFixed(2)))
const commissionRate = computed(() => props.stat?.[3] || 0)
const availableCommissionYuan = computed(() => (((props.stat?.[4] || 0) / 100).toFixed(2)))
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 w-full">
    <!-- 1. 可用佣金主资产卡 (突出大卡) -->
    <div class="col-span-1 md:col-span-2 xl:col-span-2 p-6 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent shadow-sm flex flex-col justify-between gap-4">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--md-sys-color-primary)]">账户可用佣金</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
            可划转 / 提现
          </span>
        </div>
        <div class="text-3xl md:text-4xl font-black tracking-tight text-emerald-500 font-mono">
          {{ userStore.currencySymbol }}{{ availableCommissionYuan }}
        </div>
        <p class="text-xs opacity-50 mt-1">好友每次产生订阅消费，返利实时入账。</p>
      </div>

      <!-- 快速资产流转按钮组 -->
      <div class="flex items-center gap-2 pt-2 border-t border-[var(--md-sys-color-outline-variant)]/10">
        <button
          @click="emit('open-transfer')"
          class="flex-1 py-2.5 px-3 rounded-full text-xs font-bold text-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)] hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span class="material-symbols-outlined text-base">currency_exchange</span>
          <span>转为余额</span>
        </button>

        <button
          @click="emit('open-withdraw')"
          class="flex-1 py-2.5 px-3 rounded-full text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
        >
          <span class="material-symbols-outlined text-base">payments</span>
          <span>申请提现</span>
        </button>
      </div>
    </div>

    <!-- 2. 累计有效佣金 -->
    <div class="p-6 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent shadow-sm flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold opacity-60">累计已获佣金</span>
          <span class="material-symbols-outlined text-lg text-[var(--md-sys-color-primary)]">savings</span>
        </div>
        <div class="text-2xl font-black tracking-tight text-[var(--md-sys-color-on-surface)] font-mono">
          {{ userStore.currencySymbol }}{{ totalCommissionYuan }}
        </div>
      </div>
      <span class="text-[11px] opacity-40 mt-3 pt-2 border-t border-[var(--md-sys-color-outline-variant)]/10">
        历史总计产生收益
      </span>
    </div>

    <!-- 3. 邀请成功人数 & 返利比例 -->
    <div class="p-6 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent shadow-sm flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold opacity-60">邀请注册人数</span>
          <span class="material-symbols-outlined text-lg text-blue-400">group</span>
        </div>
        <div class="text-2xl font-black tracking-tight text-[var(--md-sys-color-on-surface)] font-mono">
          {{ invitedUsersCount }} <span class="text-xs font-normal opacity-50">人</span>
        </div>
      </div>
      <div class="flex items-center justify-between text-[11px] opacity-60 mt-3 pt-2 border-t border-[var(--md-sys-color-outline-variant)]/10">
        <span>当前返佣比例</span>
        <b class="text-[var(--md-sys-color-primary)] font-mono">{{ commissionRate }}%</b>
      </div>
    </div>

    <!-- 4. 确认中待结算佣金 -->
    <div class="p-6 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent shadow-sm flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold opacity-60">待确认佣金</span>
          <span class="material-symbols-outlined text-lg text-amber-500">hourglass_top</span>
        </div>
        <div class="text-2xl font-black tracking-tight text-amber-500 font-mono">
          {{ userStore.currencySymbol }}{{ pendingCommissionYuan }}
        </div>
      </div>
      <span class="text-[11px] opacity-40 mt-3 pt-2 border-t border-[var(--md-sys-color-outline-variant)]/10">
        待审核与防欺诈冻结期
      </span>
    </div>
  </div>
</template>