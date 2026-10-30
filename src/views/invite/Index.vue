<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import InviteStatCards from '../../components/invite/InviteStatCards.vue'
import InviteCodesManager from '../../components/invite/InviteCodesManager.vue'
import CommissionDetailsTable from '../../components/invite/CommissionDetailsTable.vue'
import CommissionTransferCard from '../../components/profile/CommissionTransferCard.vue'
import WithdrawModal from '../../components/tickets/WithdrawModal.vue'
import '@material/web/dialog/dialog.js'
import '@material/web/button/text-button.js'

const userStore = useUserStore()

const inviteData = ref<{
  codes: any[]
  stat: [number, number, number, number, number] | null
}>({
  codes: [],
  stat: null
})

const loading = ref(false)

// 划转与提现弹窗
const isTransferModalOpen = ref(false)
const isWithdrawModalOpen = ref(false)

// 8.1 拉取邀请与佣金概览数据
const fetchInviteOverview = async () => {
  loading.value = true
  try {
    const res: any = await api.get('/user/invite/fetch')
    const data = res.data ?? res
    inviteData.value = {
      codes: Array.isArray(data?.codes) ? data.codes : [],
      stat: Array.isArray(data?.stat) ? data.stat : null
    }
  } catch {
    inviteData.value = { codes: [], stat: null }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchInviteOverview()
  userStore.fetchDashboardData()
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-8 w-full">
    <!-- 顶栏说明副标题 (大标题已升华至浮动顶栏中) -->
    <div class="flex items-center justify-between pb-1">
      <p class="text-xs md:text-sm opacity-60 leading-relaxed">
        邀请好友加入享受持续高额返现，佣金支持一键划转为主余额或申请财务提现。
      </p>
    </div>

    <!-- 1. 核心资产统计卡片组 (8.1 stat 严格解构) -->
    <InviteStatCards
      :stat="inviteData.stat"
      @open-transfer="isTransferModalOpen = true"
      @open-withdraw="isWithdrawModalOpen = true"
    />

    <!-- 2. 双列排布：邀请码管理 + 佣金返利明细流水 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-stretch">
      <!-- 专属邀请码与链接分享 -->
      <InviteCodesManager
        :codes="inviteData.codes"
        :loading="loading"
        @refresh="fetchInviteOverview"
      />

      <!-- 8.3 佣金流水明细分页表 -->
      <CommissionDetailsTable />
    </div>

    <!-- 佣金划转余额模态对话框 (复用成熟模块) -->
    <md-dialog :open="isTransferModalOpen" @closed="isTransferModalOpen = false" class="md3-invite-dialog max-w-lg w-full">
      <div slot="headline" class="font-black text-lg">划转返利到账户余额</div>
      <div slot="content">
        <CommissionTransferCard />
      </div>
      <div slot="actions">
        <md-text-button @click="isTransferModalOpen = false">完成</md-text-button>
      </div>
    </md-dialog>

    <!-- 佣金提现申请弹窗 -->
    <WithdrawModal
      :open="isWithdrawModalOpen"
      @close="isWithdrawModalOpen = false"
      @success="isWithdrawModalOpen = false; fetchInviteOverview(); userStore.fetchDashboardData()"
    />
  </div>
</template>

<style scoped>
.md3-invite-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>