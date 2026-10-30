<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'
import { useConfigStore } from '../../stores/config'
import { api } from '../../api/client'
import GiftCardModal from './GiftCardModal.vue'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'

export interface StoredAccount {
  email: string
  auth_data: string
  sub_token?: string
  avatar_url?: string
}
const isGiftCardModalOpen = ref(false)
const router = useRouter()
const userStore = useUserStore()
const configStore = useConfigStore()

const isOpen = ref(false)
const isHovered = ref(false)
const showAccountsList = ref(false)
const popoverRef = ref<HTMLDivElement | null>(null)

// 退出确认对话框状态
const isLogoutModalOpen = ref(false)

// 重置安全信息状态
const isResetModalOpen = ref(false)
const isResetting = ref(false)
const newSubscribeUrl = ref('')
const isSuccessModalOpen = ref(false)

const storedAccounts = ref<StoredAccount[]>([])

// 自动以 email 为唯一标识进行去重读取
const getStoredAccounts = (): StoredAccount[] => {
  try {
    const raw = localStorage.getItem('xboard_accounts')
    if (!raw) return []
    const list: StoredAccount[] = JSON.parse(raw)
    const map = new Map<string, StoredAccount>()
    list.forEach((acc) => {
      if (acc.email && acc.auth_data) {
        map.set(acc.email, acc)
      }
    })
    return Array.from(map.values())
  } catch {
    return []
  }
}

const saveStoredAccounts = (accounts: StoredAccount[]) => {
  localStorage.setItem('xboard_accounts', JSON.stringify(accounts))
  storedAccounts.value = accounts
}

const upsertAccount = (acc: StoredAccount) => {
  if (!acc.email || !acc.auth_data) return
  const list = getStoredAccounts()
  const idx = list.findIndex((a) => a.email === acc.email)
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...acc }
  } else {
    list.push(acc)
  }
  saveStoredAccounts(list)
}

watch(
  () => userStore.userInfo?.email,
  (newEmail) => {
    if (newEmail) {
      const currentAuth = localStorage.getItem('auth_data')
      if (currentAuth) {
        upsertAccount({
          email: newEmail,
          auth_data: currentAuth,
          sub_token: localStorage.getItem('sub_token') || '',
          avatar_url: userStore.userInfo?.avatar_url || ''
        })
      }
    }
  },
  { immediate: true }
)

const loadAccounts = () => {
  storedAccounts.value = getStoredAccounts()
}

const otherAccounts = computed(() => {
  const currentEmail = userStore.userInfo?.email
  const currentAuth = localStorage.getItem('auth_data')
  return storedAccounts.value.filter((a) => a.email !== currentEmail && a.auth_data !== currentAuth)
})

const nickname = computed(() => {
  const email = userStore.userInfo?.email || ''
  return email ? email.split('@')[0] : '用户'
})

// 切换账号
const handleSwitchAccount = (targetAcc: StoredAccount) => {
  if (!targetAcc.auth_data) return

  if (userStore.userInfo?.email) {
    const currentAuth = localStorage.getItem('auth_data')
    if (currentAuth) {
      upsertAccount({
        email: userStore.userInfo.email,
        auth_data: currentAuth,
        sub_token: localStorage.getItem('sub_token') || '',
        avatar_url: userStore.userInfo.avatar_url || ''
      })
    }
  }

  localStorage.setItem('auth_data', targetAcc.auth_data)
  if (targetAcc.sub_token) {
    localStorage.setItem('sub_token', targetAcc.sub_token)
  } else {
    localStorage.removeItem('sub_token')
  }

  isOpen.value = false
  showAccountsList.value = false
  window.location.reload()
}

// 🌟 新增功能 1：删除指定非当前账号记录
const handleRemoveAccount = (targetAcc: StoredAccount) => {
  let list = getStoredAccounts()
  list = list.filter((a) => a.email !== targetAcc.email && a.auth_data !== targetAcc.auth_data)
  saveStoredAccounts(list)
  if (otherAccounts.value.length === 0) {
    showAccountsList.value = false
  }
}

// 添加新账号
const handleAddAccount = () => {
  if (userStore.userInfo?.email) {
    const currentAuth = localStorage.getItem('auth_data')
    if (currentAuth) {
      upsertAccount({
        email: userStore.userInfo.email,
        auth_data: currentAuth,
        sub_token: localStorage.getItem('sub_token') || '',
        avatar_url: userStore.userInfo.avatar_url || ''
      })
    }
  }

  localStorage.removeItem('auth_data')
  localStorage.removeItem('sub_token')
  userStore.userInfo = null
  userStore.subscribeInfo = null

  router.push({ path: '/login', query: { add_account: 'true' } })
  isOpen.value = false
}

// 点击“退出账号”触发二次弹窗
const handleLogoutTrigger = () => {
  isOpen.value = false
  isLogoutModalOpen.value = true
}

// 🌟 新增功能 2A：仅退出并删除当前账号，自动切换到下一个可用账号
const handleLogoutCurrentOnly = () => {
  const currentEmail = userStore.userInfo?.email
  const currentAuth = localStorage.getItem('auth_data')
  let list = getStoredAccounts()
  
  // 移除当前账号
  list = list.filter((a) => a.email !== currentEmail && a.auth_data !== currentAuth)
  saveStoredAccounts(list)
  isLogoutModalOpen.value = false

  if (list.length > 0) {
    // 切换到剩下的第一个账号
    handleSwitchAccount(list[0])
  } else {
    // 已经没有其他账号了，彻底清空退出
    handleLogoutAll()
  }
}

// 🌟 新增功能 2B：退出并彻底清空所有账号本地记录
const handleLogoutAll = () => {
  localStorage.removeItem('xboard_accounts')
  localStorage.removeItem('auth_data')
  localStorage.removeItem('sub_token')
  localStorage.removeItem('is_admin')
  isLogoutModalOpen.value = false
  userStore.logout()
}

// 4.7 重置订阅
const handleConfirmReset = async () => {
  isResetting.value = true
  try {
    const res: any = await api.get('/user/resetSecurity')
    newSubscribeUrl.value = res.data || res || ''
    isResetModalOpen.value = false
    isSuccessModalOpen.value = true
    userStore.fetchDashboardData()
  } catch (err: any) {
    alert(err.message || '重置失败')
  } finally {
    isResetting.value = false
  }
}

const handleDocumentClick = (e: MouseEvent) => {
  if (popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  loadAccounts()
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="relative select-none" ref="popoverRef">
    <!-- 头像触发器 -->
    <div
      class="relative cursor-pointer group"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
      @click.stop="isOpen = !isOpen"
    >
      <img
        v-if="userStore.userInfo?.avatar_url"
        :src="userStore.userInfo.avatar_url"
        class="w-9 h-9 rounded-full object-cover transition-transform active:scale-95"
      />
      <div v-else class="w-9 h-9 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center font-bold text-xs">
        {{ nickname.slice(0, 1).toUpperCase() }}
      </div>

      <!-- 悬停提示卡 -->
      <Transition name="fade-fast">
        <div
          v-if="isHovered && !isOpen"
          class="absolute top-12 right-0 px-3.5 py-2 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] shadow-xl text-xs flex flex-col pointer-events-none z-30 whitespace-nowrap"
        >
          <span class="font-bold text-[var(--md-sys-color-primary)]">Google 账号</span>
          <span class="font-medium text-[var(--md-sys-color-on-surface)] mt-0.5">{{ nickname }}</span>
          <span class="text-[11px] opacity-60">{{ userStore.userInfo?.email }}</span>
        </div>
      </Transition>
    </div>

    <!-- 弹窗面板 (纯阶梯色无白边) -->
    <Transition name="md3-spring-pop">
      <div
        v-if="isOpen"
        class="absolute top-14 right-0 w-[340px] p-5 rounded-[32px] bg-[var(--md-sys-color-surface-container-high)] shadow-2xl z-40 flex flex-col gap-4 backdrop-blur-2xl"
      >
        <!-- 顶栏核心信息卡 -->
        <div class="relative flex flex-col items-center p-4 rounded-[26px] bg-[var(--md-sys-color-surface-container)]">
          <button
            @click="isOpen = false"
            class="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container-high)] transition-all"
          >
            <span class="material-symbols-outlined text-base">close</span>
          </button>

          <!-- 大头像 + 编辑小徽标 -->
          <div class="relative mb-3">
            <img
              v-if="userStore.userInfo?.avatar_url"
              :src="userStore.userInfo.avatar_url"
              class="w-16 h-16 rounded-full object-cover shadow-sm"
            />
            <div class="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center shadow">
              <span class="material-symbols-outlined text-[11px]">edit</span>
            </div>
          </div>

          <span class="font-bold text-base tracking-tight text-[var(--md-sys-color-on-surface)]">{{ nickname }}</span>
          <span class="text-xs opacity-60 mt-0.5">{{ userStore.userInfo?.email }}</span>

          <!-- 切换账号展开按钮 -->
          <button
            v-if="otherAccounts.length > 0"
            @click="showAccountsList = !showAccountsList"
            class="mt-3 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-primary-container)] hover:text-[var(--md-sys-color-on-primary-container)] transition-all cursor-pointer"
          >
            <span>切换账号 ({{ otherAccounts.length }})</span>
            <span class="material-symbols-outlined text-sm transition-transform duration-300" :class="{ 'rotate-180': showAccountsList }">
              expand_more
            </span>
          </button>
        </div>

        <!-- 🌟 多账号抽屉：增加每一项独立的【删除按钮】 -->
        <div v-if="showAccountsList && otherAccounts.length > 0" class="flex flex-col gap-1.5 max-h-48 overflow-y-auto px-1 py-1">
          <div
            v-for="acc in otherAccounts"
            :key="acc.email"
            @click="handleSwitchAccount(acc)"
            class="flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-highest)] cursor-pointer transition-all active:scale-[0.98] group"
          >
            <img
              v-if="acc.avatar_url"
              :src="acc.avatar_url"
              class="w-8 h-8 rounded-full object-cover shrink-0"
            />
            <div v-else class="w-8 h-8 rounded-full bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center font-bold text-xs shrink-0">
              {{ acc.email.slice(0, 1).toUpperCase() }}
            </div>
            
            <div class="flex flex-col truncate flex-1">
              <span class="text-xs font-bold truncate">{{ acc.email.split('@')[0] }}</span>
              <span class="text-[10px] opacity-60 truncate">{{ acc.email }}</span>
            </div>

            <!-- 操作按钮组：删除单项 / 点击切换 -->
            <div class="flex items-center gap-1">
              <!-- 🌟 独立移除对应账号按钮 -->
              <button
                type="button"
                @click.stop="handleRemoveAccount(acc)"
                class="w-7 h-7 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-red-500/15 hover:text-red-500 transition-all"
                title="从设备中移除此账号"
              >
                <span class="material-symbols-outlined text-sm">close</span>
              </button>
              
              <span class="material-symbols-outlined text-base opacity-40 group-hover:opacity-100 group-hover:text-[var(--md-sys-color-primary)] transition-all">
                swap_horiz
              </span>
            </div>
          </div>
        </div>

        <!-- 操作区 -->
        <div class="flex flex-col gap-2">
          <button
            @click="handleAddAccount"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-semibold bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all active:scale-[0.98]"
          >
            <span class="material-symbols-outlined text-lg">person_add</span>
            <span>添加其他账号</span>
          </button>

          <!-- 🌟 点击退出账号：触发二次弹窗决策 -->
          <button
            @click="handleLogoutTrigger"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-semibold bg-[var(--md-sys-color-surface-container)] hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-[0.98]"
          >
            <span class="material-symbols-outlined text-lg">logout</span>
            <span>退出账号</span>
          </button>

          <button
            @click="router.push('/profile'); isOpen = false"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-semibold bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all active:scale-[0.98]"
          >
            <span class="material-symbols-outlined text-lg text-[var(--md-sys-color-primary)]">manage_accounts</span>
            <span>管理您的账号与安全</span>
          </button>

          <!-- 🌟 新增：礼品卡核销与查询入口按钮 -->
          <button
            @click="isGiftCardModalOpen = true; isOpen = false"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-semibold bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all active:scale-[0.98]"
          >
            <span class="material-symbols-outlined text-lg text-amber-500">card_giftcard</span>
            <span>礼品卡兑换</span>
          </button>

          <button
            @click="isResetModalOpen = true; isOpen = false"
            class="w-full flex items-center justify-between px-4 py-3.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 shadow-md transition-all active:scale-[0.98] mt-1"
          >
            <div class="flex items-center gap-2.5">
              <span class="material-symbols-outlined text-lg">sync_lock</span>
              <span>重置订阅与密钥</span>
            </div>
            <span class="material-symbols-outlined text-sm opacity-70">arrow_forward_ios</span>
          </button>
        </div>

        <div class="pt-1 text-center text-[10px] opacity-40">
          <a v-if="configStore.config?.tos_url" :href="configStore.config.tos_url" target="_blank" class="hover:underline">服务条款</a>
          <span class="mx-1">·</span>
          <span>隐私政策</span>
        </div>
      </div>
    </Transition>

    <!-- 🌟 原生 MD3 对话框：多账号智能退出确认弹窗 -->
    <md-dialog :open="isLogoutModalOpen" @closed="isLogoutModalOpen = false" class="md3-custom-dialog">
      <div slot="headline" class="flex items-center gap-2 font-black text-lg text-[var(--md-sys-color-on-surface)]">
        <span class="material-symbols-outlined text-red-500">logout</span>
        退出账号确认
      </div>
      <div slot="content" class="text-sm leading-relaxed text-[var(--md-sys-color-on-surface)] opacity-90 py-2">
        <!-- 多个账号时的退出指引 -->
        <template v-if="otherAccounts.length > 0">
          检测到您当前在设备上登录了 <b>{{ storedAccounts.length }} 个账号</b>。请选择您的退出操作：
          <div class="mt-3 flex flex-col gap-2 p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container)] text-xs leading-normal">
            <div><b class="text-[var(--md-sys-color-primary)]">• 仅退出此账号：</b>从设备中移除 <b>{{ userStore.userInfo?.email }}</b>，并自动切换到列表中的其他账号。</div>
            <div class="mt-1"><b class="text-red-500">• 退出全部账号：</b>彻底清除本设备上保存的所有账号会话及本地缓存。</div>
          </div>
        </template>
        <!-- 仅有单个账号时的普通确认 -->
        <template v-else>
          确定要退出当前账号并清除登录状态吗？
        </template>
      </div>
      <div slot="actions">
        <md-text-button @click="isLogoutModalOpen = false">取消</md-text-button>
        <!-- 多个账号时提供两个按钮 -->
        <template v-if="otherAccounts.length > 0">
          <md-filled-tonal-button @click="handleLogoutCurrentOnly">仅退出此账号</md-filled-tonal-button>
          <md-filled-button
            @click="handleLogoutAll"
            style="--md-sys-color-primary: #ba1a1a; --md-sys-color-on-primary: #ffffff;"
          >
            退出全部账号
          </md-filled-button>
        </template>
        <!-- 单个账号时提供单一退出按钮 -->
        <template v-else>
          <md-filled-button
            @click="handleLogoutAll"
            style="--md-sys-color-primary: #ba1a1a; --md-sys-color-on-primary: #ffffff;"
          >
            确认退出
          </md-filled-button>
        </template>
      </div>
    </md-dialog>

    <!-- 重置确认弹窗 -->
    <md-dialog :open="isResetModalOpen" @closed="isResetModalOpen = false" class="md3-custom-dialog">
      <div slot="headline" class="flex items-center gap-2 text-red-500 font-black text-lg">
        <span class="material-symbols-outlined">warning</span>
        重置订阅安全信息
      </div>
      <div slot="content" class="text-sm leading-relaxed text-[var(--md-sys-color-on-surface)] opacity-90 py-2">
        执行重置后，您的 <strong class="text-red-500 dark:text-red-400 font-bold">订阅 Token 和 UUID 将被永久注销并重新生成</strong>。<br />
        旧的订阅链接将立刻失效，您必须在所有代理客户端中重新导入。是否确认执行？
      </div>
      <div slot="actions">
        <md-text-button @click="isResetModalOpen = false">取消</md-text-button>
        <md-filled-button
          @click="handleConfirmReset"
          :disabled="isResetting"
          style="--md-sys-color-primary: #ba1a1a; --md-sys-color-on-primary: #ffffff;"
        >
          <md-circular-progress v-if="isResetting" indeterminate slot="icon" style="--md-circular-progress-size: 16px;"></md-circular-progress>
          <span v-else>立即重置</span>
        </md-filled-button>
      </div>
    </md-dialog>

    <!-- 重置成功弹窗 -->
    <md-dialog :open="isSuccessModalOpen" @closed="isSuccessModalOpen = false" class="md3-custom-dialog">
      <div slot="headline" class="flex items-center gap-2 text-emerald-500 font-black text-lg">
        <span class="material-symbols-outlined">check_circle</span>
        订阅重置成功
      </div>
      <div slot="content" class="text-sm flex flex-col gap-2 text-[var(--md-sys-color-on-surface)] py-2">
        <p>您的新订阅链接已生效，请复制并在客户端中重新配置：</p>
        <div class="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container)] text-xs font-mono break-all select-all text-[var(--md-sys-color-primary)]">
          {{ newSubscribeUrl }}
        </div>
      </div>
      <div slot="actions">
        <md-filled-button @click="isSuccessModalOpen = false">完成</md-filled-button>
      </div>
    </md-dialog>
    <!-- 挂载独立礼品卡兑换与历史查询弹窗 -->
    <GiftCardModal
      :open="isGiftCardModalOpen"
      @close="isGiftCardModalOpen = false"
    />
  
  </div>
</template>

<style scoped>
.md3-spring-pop-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.md3-spring-pop-leave-active {
  transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
}
.md3-spring-pop-enter-from {
  opacity: 0;
  transform: scale(0.88) translateY(-14px);
}
.md3-spring-pop-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(-8px);
}

.fade-fast-enter-active, .fade-fast-leave-active {
  transition: opacity 0.15s ease;
}
.fade-fast-enter-from, .fade-fast-leave-to {
  opacity: 0;
}

.md3-custom-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>