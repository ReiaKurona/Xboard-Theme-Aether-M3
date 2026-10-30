<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'

const userStore = useUserStore()
const isConfirmOpen = ref(false)
const isSuccessOpen = ref(false)
const isResetting = ref(false)
const newSubscribeUrl = ref('')

const handleConfirmReset = async () => {
  isResetting.value = true
  try {
    const res: any = await api.get('/user/resetSecurity')
    newSubscribeUrl.value = res.data || res || ''
    isConfirmOpen.value = false
    isSuccessOpen.value = true
    userStore.fetchDashboardData()
  } catch (err: any) {
    alert(err.message || '重置失败')
  } finally {
    isResetting.value = false
  }
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="p-6 md:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm h-full flex flex-col justify-between">
    <div>
      <div class="flex items-center gap-2.5 mb-2">
        <span class="material-symbols-outlined text-red-500 text-2xl">sync_lock</span>
        <h3 class="text-xl font-black tracking-tight">重置订阅与防泄露</h3>
      </div>
      <p class="text-xs opacity-60 mb-5 leading-normal">
        若您的订阅链接疑似泄露被他人盗刷流量，请立即重置。重置将重新生成 UUID 与订阅 Token，旧链接永久失效。
      </p>

      <div class="p-4 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-3">
        <span class="material-symbols-outlined text-lg shrink-0">warning</span>
        <span>重置后，您必须在所有代理客户端中重新导入新链接方可恢复联网。</span>
      </div>
    </div>

    <div class="flex justify-end mt-4 pt-4 border-t border-[var(--md-sys-color-outline-variant)]/10">
      <md-filled-button
        @click="isConfirmOpen = true"
        style="--md-sys-color-primary: #ba1a1a; --md-sys-color-on-primary: #ffffff;"
      >
        <span class="material-symbols-outlined text-base" slot="icon">restart_alt</span>
        重置安全信息
      </md-filled-button>
    </div>

    <!-- 二次确认对话框 (暗色模式反白) -->
    <md-dialog :open="isConfirmOpen" @closed="isConfirmOpen = false" class="md3-profile-dialog">
      <div slot="headline" class="flex items-center gap-2 text-red-500 font-black text-lg">
        <span class="material-symbols-outlined">warning</span>
        确认重置订阅凭证？
      </div>
      <div slot="content" class="text-sm leading-relaxed text-[var(--md-sys-color-on-surface)] py-2">
        重置将立即注销当前的订阅 Token 与 UUID，原有的订阅地址将立刻被服务器切断拦截。确定继续？
      </div>
      <div slot="actions">
        <md-text-button @click="isConfirmOpen = false">取消</md-text-button>
        <md-filled-button
          @click="handleConfirmReset"
          :disabled="isResetting"
          style="--md-sys-color-primary: #ba1a1a; --md-sys-color-on-primary: #ffffff;"
        >
          <md-circular-progress v-if="isResetting" indeterminate slot="icon" style="--md-circular-progress-size: 16px;"></md-circular-progress>
          <span v-else>立即注销并重置</span>
        </md-filled-button>
      </div>
    </md-dialog>

    <!-- 重置成功对话框 -->
    <md-dialog :open="isSuccessOpen" @closed="isSuccessOpen = false" class="md3-profile-dialog">
      <div slot="headline" class="flex items-center gap-2 text-emerald-500 font-black text-lg">
        <span class="material-symbols-outlined">check_circle</span>
        新订阅链接已生成
      </div>
      <div slot="content" class="text-sm flex flex-col gap-2 text-[var(--md-sys-color-on-surface)] py-2">
        <p>您的旧链接已完全失效，新订阅地址如下：</p>
        <div class="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] text-xs font-mono break-all select-all text-[var(--md-sys-color-primary)]">
          {{ newSubscribeUrl }}
        </div>
      </div>
      <div slot="actions">
        <md-filled-button @click="isSuccessOpen = false">知道了</md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<style scoped>
.md3-profile-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>