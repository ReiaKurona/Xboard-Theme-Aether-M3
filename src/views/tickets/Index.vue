<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import TicketDetailChatView from '../../components/tickets/TicketDetailChatView.vue'
import NewTicketModal from '../../components/tickets/NewTicketModal.vue'
import WithdrawModal from '../../components/tickets/WithdrawModal.vue'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/progress/circular-progress.js'

const userStore = useUserStore()
const tickets = ref<any[]>([])
const loading = ref(false)

const selectedTicketId = ref<number | null>(null)
const selectedFilter = ref<'all' | 'open' | 'closed'>('all')

// 弹窗状态
const isNewTicketOpen = ref(false)
const isWithdrawOpen = ref(false)

// 响应式移动端推屏
const windowWidth = ref<number>(typeof window !== 'undefined' ? window.innerWidth : 1200)
const isMobile = computed(() => windowWidth.value < 1024)
const isMobileChatting = ref(false)
const navDirection = ref<'push' | 'pop'>('push')

const handleResize = () => {
  windowWidth.value = window.innerWidth
  if (windowWidth.value >= 1024) isMobileChatting.value = false
}

// 7.1 获取工单列表
const fetchTickets = async () => {
  loading.value = true
  try {
    const res: any = await api.get('/user/ticket/fetch')
    const list = Array.isArray(res) ? res : (res.data || [])
    tickets.value = list

    // 桌面端默认选中第一条工单
    if (!selectedTicketId.value && window.innerWidth >= 1024 && list.length > 0) {
      selectedTicketId.value = list[0].id
    }
  } catch {
    tickets.value = []
  } finally {
    loading.value = false
  }
}

// 筛选逻辑
const filteredTickets = computed(() => {
  if (selectedFilter.value === 'open') return tickets.value.filter(t => t.status === 0)
  if (selectedFilter.value === 'closed') return tickets.value.filter(t => t.status === 1)
  return tickets.value
})

const handleSelectTicket = (id: number) => {
  navDirection.value = 'push'
  selectedTicketId.value = id
  isMobileChatting.value = true
}

const handleBackToList = () => {
  navDirection.value = 'pop'
  isMobileChatting.value = false
}

const formatDate = (ts: number) => {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString()
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  fetchTickets()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-6 w-full overflow-hidden">
    <!-- 顶栏说明与快捷新建栏 -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
      <p class="text-xs md:text-sm opacity-60 leading-relaxed">
        实时追踪客户服务请求、节点故障工单及提现加急申请。
      </p>

      <div class="flex items-center gap-2.5 shrink-0">
        <!-- 佣金提现入口 -->
        <button
          @click="isWithdrawOpen = true"
          class="px-4 py-2 rounded-full text-xs font-bold text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span class="material-symbols-outlined text-base">payments</span>
          <span>佣金提现</span>
        </button>

        <!-- 发起新工单 -->
        <button
          @click="isNewTicketOpen = true"
          class="px-4 py-2 rounded-full text-xs font-bold text-[var(--md-sys-color-on-primary)] bg-[var(--md-sys-color-primary)] shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span class="material-symbols-outlined text-base">add</span>
          <span>新建工单</span>
        </button>
      </div>
    </div>

    <!-- 手机端原生推屏 / 桌面端双列布局 -->
    <div class="w-full relative min-h-[580px]">
      <!-- ========================================================
           🌟 手机端：Android 17 Spring 导航推屏过渡动效 (Push & Pop)
           ======================================================== -->
      <div v-if="isMobile">
        <Transition
          :name="navDirection === 'push' ? 'mobile-nav-push' : 'mobile-nav-pop'"
          mode="out-in"
        >
          <!-- 手机列表视图 -->
          <div v-if="!isMobileChatting" key="ticket-list" class="flex flex-col gap-4">
            <!-- 状态过滤分段器 -->
            <div class="flex p-1 rounded-full bg-[var(--md-sys-color-surface-container)] self-start">
              <button
                v-for="f in [
                  { label: '全部', val: 'all' },
                  { label: '处理中', val: 'open' },
                  { label: '已关闭', val: 'closed' }
                ]"
                :key="f.val"
                @click="selectedFilter = f.val as any"
                class="px-3.5 py-1 rounded-full text-xs font-bold transition-all"
                :class="selectedFilter === f.val ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm' : 'opacity-60'"
              >
                {{ f.label }}
              </button>
            </div>

            <div v-if="loading && tickets.length === 0" class="py-16 flex justify-center">
              <md-circular-progress indeterminate></md-circular-progress>
            </div>

            <div v-else-if="filteredTickets.length === 0" class="py-16 text-center opacity-40 text-xs">
              暂无匹配工单
            </div>

            <div v-else class="flex flex-col gap-2.5 pb-8">
              <div
                v-for="t in filteredTickets"
                :key="t.id"
                @click="handleSelectTicket(t.id)"
                class="p-4.5 rounded-[24px] bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] cursor-pointer transition-all active:scale-[0.98] flex items-center justify-between shadow-sm"
              >
                <div class="flex flex-col truncate mr-2">
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="w-2 h-2 rounded-full"
                      :class="t.status === 0 ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'"
                    ></span>
                    <span class="font-extrabold text-sm truncate text-[var(--md-sys-color-on-surface)]">{{ t.subject }}</span>
                  </div>
                  <div class="flex items-center gap-2 text-[10px] opacity-50 font-mono">
                    <span>#{{ t.id }}</span>
                    <span>·</span>
                    <span>{{ formatDate(t.created_at) }}</span>
                    <span>·</span>
                    <span :class="t.reply_status === 1 ? 'text-[var(--md-sys-color-primary)] font-bold' : ''">
                      {{ t.reply_status === 1 ? '客服已回复' : '等待回复' }}
                    </span>
                  </div>
                </div>

                <span class="material-symbols-outlined text-lg opacity-40 shrink-0">arrow_forward_ios</span>
              </div>
            </div>
          </div>

          <!-- 手机聊天视图 -->
          <div v-else key="ticket-chat" class="w-full">
            <TicketDetailChatView
              :ticket-id="selectedTicketId"
              @back="handleBackToList"
              @ticket-updated="fetchTickets"
            />
          </div>
        </Transition>
      </div>

      <!-- ========================================================
           🌟 桌面端：双列分栏（左侧工单卡片流 + 右侧实时对话流）
           ======================================================== -->
      <div v-else class="flex flex-row gap-6 w-full items-start">
        <!-- 左侧工单抽屉栏 -->
        <aside class="w-80 shrink-0 flex flex-col gap-3.5 sticky top-24">
          <!-- 状态筛选 -->
          <div class="flex p-1 rounded-full bg-[var(--md-sys-color-surface-container)] self-start">
            <button
              v-for="f in [
                { label: '全部', val: 'all' },
                { label: '处理中', val: 'open' },
                { label: '已关闭', val: 'closed' }
              ]"
              :key="f.val"
              @click="selectedFilter = f.val as any"
              class="px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer"
              :class="selectedFilter === f.val ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm' : 'opacity-60'"
            >
              {{ f.label }}
            </button>
          </div>

          <div v-if="loading && tickets.length === 0" class="py-12 flex justify-center">
            <md-circular-progress indeterminate></md-circular-progress>
          </div>

          <div v-else-if="filteredTickets.length === 0" class="py-12 text-center opacity-40 text-xs">
            暂无匹配工单
          </div>

          <div v-else class="flex flex-col gap-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            <div
              v-for="t in filteredTickets"
              :key="t.id"
              @click="selectedTicketId = t.id"
              class="p-4 rounded-2xl transition-all cursor-pointer flex flex-col gap-1.5 shadow-sm"
              :class="selectedTicketId === t.id
                ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]'
                : 'bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] opacity-85 hover:opacity-100'"
            >
              <div class="flex items-center justify-between">
                <span class="font-extrabold text-sm truncate mr-2">{{ t.subject }}</span>
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="t.status === 0 ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'"
                ></span>
              </div>

              <div class="flex items-center justify-between text-[11px] opacity-60 font-mono">
                <span>#{{ t.id }} · {{ formatDate(t.created_at) }}</span>
                <span :class="t.reply_status === 1 ? 'font-bold underline' : ''">
                  {{ t.reply_status === 1 ? '已回复' : '等待中' }}
                </span>
              </div>
            </div>
          </div>
        </aside>

        <!-- 右侧对话详情主体 -->
        <main class="flex-1 w-full min-w-0">
          <Transition name="desktop-chat-swap" mode="out-in">
            <TicketDetailChatView
              :key="selectedTicketId || 'none'"
              :ticket-id="selectedTicketId"
              @back="handleBackToList"
              @ticket-updated="fetchTickets"
            />
          </Transition>
        </main>
      </div>
    </div>

    <!-- 新建工单弹窗 -->
    <NewTicketModal
      :open="isNewTicketOpen"
      @close="isNewTicketOpen = false"
      @success="isNewTicketOpen = false; fetchTickets(); userStore.fetchDashboardData()"
    />

    <!-- 佣金提现弹窗 -->
    <WithdrawModal
      :open="isWithdrawOpen"
      @close="isWithdrawOpen = false"
      @success="isWithdrawOpen = false; fetchTickets(); userStore.fetchDashboardData()"
    />
  </div>
</template>

<style scoped>
.mobile-nav-push-enter-active,
.mobile-nav-push-leave-active,
.mobile-nav-pop-enter-active,
.mobile-nav-pop-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.35, 0.64, 1);
  will-change: transform, opacity;
}

.mobile-nav-push-enter-from {
  opacity: 0;
  transform: translate3d(48px, 0, 0);
}
.mobile-nav-push-leave-to {
  opacity: 0;
  transform: translate3d(-32px, 0, 0);
}

.mobile-nav-pop-enter-from {
  opacity: 0;
  transform: translate3d(-48px, 0, 0);
}
.mobile-nav-pop-leave-to {
  opacity: 0;
  transform: translate3d(32px, 0, 0);
}

.desktop-chat-swap-enter-active,
.desktop-chat-swap-leave-active {
  transition: all 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);
  will-change: transform, opacity;
}

.desktop-chat-swap-enter-from {
  opacity: 0;
  transform: translate3d(0, 14px, 0) scale(0.98);
}
.desktop-chat-swap-leave-to {
  opacity: 0;
  transform: translate3d(0, -10px, 0) scale(0.99);
}
</style>