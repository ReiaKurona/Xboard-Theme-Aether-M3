<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '../../stores/user'
import ProfileOverviewCard from '../../components/profile/ProfileOverviewCard.vue'
import SecurityPasswordCard from '../../components/profile/SecurityPasswordCard.vue'
import ResetSecurityCard from '../../components/profile/ResetSecurityCard.vue'
import CommissionTransferCard from '../../components/profile/CommissionTransferCard.vue'
import ActiveSessionsCard from '../../components/profile/ActiveSessionsCard.vue'
import TelegramBindingCard from '../../components/profile/TelegramBindingCard.vue'

const userStore = useUserStore()

onMounted(() => {
  userStore.fetchDashboardData()
})
</script>

<template>
  <div class="flex flex-col gap-8 w-full">
    <!-- 页面顶头标题区 (MD3 Display Typography) -->
    <div class="flex flex-col gap-1">
      <h1 class="text-3xl font-black tracking-tight text-[var(--md-sys-color-on-surface)]">
        账号与安全中心
      </h1>
      <p class="text-sm opacity-60">
        管理您的安全凭据、登录会话、返利划转以及第三方机器人联动。
      </p>
    </div>

    <!-- 6 大卡片响应式网格排布 (宽屏双列并排，移动端单列) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      <!-- 1. 基础信息与 UUID -->
      <ProfileOverviewCard />

      <!-- 2. Telegram 联动 -->
      <TelegramBindingCard />

      <!-- 3. 佣金划转余额 (4.8) -->
      <CommissionTransferCard />

      <!-- 4. 重置订阅与密钥防泄露 (4.7) -->
      <ResetSecurityCard />

      <!-- 5. 登录会话与设备管理 (4.9) -->
      <ActiveSessionsCard />

      <!-- 6. 修改安全密码 (4.6) -->
      <SecurityPasswordCard />
    </div>
  </div>
</template>