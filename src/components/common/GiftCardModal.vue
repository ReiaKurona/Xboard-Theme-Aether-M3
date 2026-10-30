<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/progress/circular-progress.js'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits(['close'])
const userStore = useUserStore()

// 兑换表单状态
const code = ref('')
const isChecking = ref(false)
const checkResult = ref<any>(null)
const isRedeeming = ref(false)
const redeemSuccessInfo = ref<any>(null)
const errorMsg = ref('')

// 🌟 窗口展开状态控制 (false 为紧凑核销窗，true 为非线性放大展示记录大窗)
const isExpanded = ref(false)

// 历史记录状态
const historyList = ref<any[]>([])
const historyLoading = ref(false)
const selectedDetail = ref<any>(null)
const isDetailLoading = ref(false)

// 9.2 校验礼品卡 (预检与奖励预览)
const handleCheckCode = async () => {
  const trimmed = code.value.trim()
  if (!trimmed || trimmed.length < 8) {
    errorMsg.value = '兑换码长度通常在 8 到 32 位之间'
    return
  }

  isChecking.value = true
  errorMsg.value = ''
  checkResult.value = null
  try {
    const res: any = await api.post('/user/gift-card/check', { code: trimmed })
    const data = res.data ?? res
    checkResult.value = data
    if (!data.can_redeem) {
      errorMsg.value = data.reason || '该兑换码当前不可用'
    }
  } catch (err: any) {
    checkResult.value = null
    errorMsg.value = err.message || '查询兑换码失败，请检查输入'
  } finally {
    isChecking.value = false
  }
}

// 9.3 执行核销兑换
const handleRedeemCode = async () => {
  const trimmed = code.value.trim()
  if (!trimmed) return
  isRedeeming.value = true
  errorMsg.value = ''
  try {
    const res: any = await api.post('/user/gift-card/redeem', { code: trimmed })
    const data = res.data ?? res
    redeemSuccessInfo.value = data
    code.value = ''
    checkResult.value = null
    // 兑换成功刷新全局用户信息、余额与订阅数据
    userStore.fetchDashboardData()
  } catch (err: any) {
    errorMsg.value = err.message || '兑换失败，请稍后再试'
  } finally {
    isRedeeming.value = false
  }
}

// 9.4 拉取历史兑换记录
const fetchHistory = async () => {
  historyLoading.value = true
  try {
    const res: any = await api.get('/user/gift-card/history?page=1&per_page=20')
    const list = Array.isArray(res) ? res : (res.data || [])
    historyList.value = list
  } catch {
    historyList.value = []
  } finally {
    historyLoading.value = false
  }
}

// 9.5 查询单条记录模板详情
const handleViewDetail = async (item: any) => {
  if (selectedDetail.value?.id === item.id) {
    selectedDetail.value = null
    return
  }
  isDetailLoading.value = true
  try {
    const res: any = await api.get(`/user/gift-card/detail?id=${item.id}`)
    selectedDetail.value = res.data ?? res
  } catch {
    selectedDetail.value = item
  } finally {
    isDetailLoading.value = false
  }
}

// 🌟 窗口展开/收起切换 (触发非线性形变与记录拉取)
const toggleExpandRecords = () => {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value && historyList.value.length === 0) {
    fetchHistory()
  }
}

const formatDate = (ts: any) => {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  return isNaN(d.getTime()) ? String(ts) : d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      code.value = ''
      checkResult.value = null
      errorMsg.value = ''
      redeemSuccessInfo.value = null
      isExpanded.value = false
      selectedDetail.value = null
    }
  }
)
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <Teleport to="body">
    <Transition name="modal-spring">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 select-none overflow-hidden"
      >
        <!-- 遮罩背景 (无白边，平滑淡入) -->
        <div class="fixed inset-0 bg-black/65 backdrop-blur-sm cursor-pointer" @click="emit('close')"></div>

        <!-- 🌟 核心弹窗：支持 Android 17 Spring 曲线的非线性尺寸形变 (max-w-md -> max-w-2xl) -->
        <div
          class="gift-card-window relative z-10 w-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] rounded-[36px] shadow-2xl flex flex-col p-6 md:p-8 overflow-hidden will-change-[max-width,height] [transform:translateZ(0)]"
          :class="isExpanded ? 'max-w-2xl' : 'max-w-md'"
        >
          <!-- 顶栏：标题与关闭 -->
          <div class="flex items-center justify-between pb-4 shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shadow-sm">
                <span class="material-symbols-outlined text-2xl">card_giftcard</span>
              </div>
              <div class="flex flex-col">
                <h3 class="font-black text-xl tracking-tight leading-tight">礼品卡兑换中心</h3>
                <span class="text-[11px] opacity-50 font-medium mt-0.5">核销兑换码或查询历史到账</span>
              </div>
            </div>

            <button
              @click="emit('close')"
              class="w-8 h-8 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container)] transition-all cursor-pointer"
            >
              <span class="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          <!-- 主体内容区 (双栏或折叠动态排版) -->
          <div class="flex flex-col gap-5 text-xs overflow-y-auto max-h-[75vh] pr-0.5">
            
            <!-- 兑换成功祝贺卡片 -->
            <div
              v-if="redeemSuccessInfo"
              class="p-4.5 rounded-[26px] bg-emerald-500/15 text-emerald-500 flex items-center gap-3.5 animate-bounce"
            >
              <span class="material-symbols-outlined text-3xl shrink-0">celebration</span>
              <div class="flex flex-col gap-0.5">
                <span class="font-black text-sm">核销成功！</span>
                <span class="text-[11px] opacity-90">{{ redeemSuccessInfo.message || '权益与配额已即刻充值到账' }}</span>
              </div>
            </div>

            <!-- 报错反馈 -->
            <div
              v-if="errorMsg"
              class="p-3 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 flex items-center gap-2"
            >
              <span class="material-symbols-outlined text-base">error</span>
              <span>{{ errorMsg }}</span>
            </div>

            <!-- 1. 核销输入区 -->
            <div class="flex flex-col gap-2 p-4 rounded-[26px] bg-[var(--md-sys-color-surface-container)]">
              <div class="flex gap-2 items-center">
                <md-outlined-text-field
                  label="输入 8~32 位礼品兑换码"
                  :value="code"
                  @input="(e: any) => code = e.target.value.trim()"
                  class="flex-1 font-mono"
                  required
                >
                  <span slot="leading-icon" class="material-symbols-outlined">vpn_key</span>
                </md-outlined-text-field>

                <md-filled-tonal-button
                  type="button"
                  @click="handleCheckCode"
                  :disabled="isChecking || code.length < 8"
                  class="h-14"
                >
                  <md-circular-progress v-if="isChecking" indeterminate slot="icon" style="--md-circular-progress-size: 16px;"></md-circular-progress>
                  <span v-else>预检</span>
                </md-filled-tonal-button>
              </div>

              <!-- 9.2 预检权益预览卡片 -->
              <div
                v-if="checkResult?.can_redeem"
                class="mt-2 p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] text-xs flex flex-col gap-1.5"
              >
                <div class="flex items-center justify-between font-bold text-emerald-500">
                  <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">verified</span>
                    兑换码有效，可立即核销
                  </span>
                  <span>{{ checkResult.code_info?.template_name || '礼品卡' }}</span>
                </div>
                <div class="text-[11px] opacity-70">
                  奖励内容：{{ checkResult.reward_preview || '包含专属流量、时长或余额充值' }}
                </div>
              </div>

              <!-- 核销按钮 -->
              <md-filled-button
                @click="handleRedeemCode"
                :disabled="isRedeeming || code.length < 8"
                class="w-full h-11 rounded-full font-bold mt-2"
              >
                <md-circular-progress v-if="isRedeeming" indeterminate slot="icon" style="--md-circular-progress-size: 16px;"></md-circular-progress>
                <span v-else class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-base">redeem</span>
                  <span>立即兑换充值</span>
                </span>
              </md-filled-button>
            </div>

            <!-- 🌟 核心要求：点击展开/放大展示历史兑换记录 -->
            <div class="flex flex-col gap-3">
              <button
                @click="toggleExpandRecords"
                class="w-full py-3 px-4 rounded-full text-xs font-bold text-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-highest)] active:scale-[0.99] transition-all flex items-center justify-between cursor-pointer"
              >
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-base">manage_search</span>
                  <span>{{ isExpanded ? '收起历史兑换清单' : '查询我的历史兑换记录' }}</span>
                </div>
                <span
                  class="material-symbols-outlined text-sm transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
                  :class="{ 'rotate-180': isExpanded }"
                >
                  expand_more
                </span>
              </button>

              <!-- 展开的历史流水面板 (平滑滑出) -->
              <div v-if="isExpanded" class="flex flex-col gap-2.5 pt-1">
                <div v-if="historyLoading && historyList.length === 0" class="py-8 flex justify-center">
                  <md-circular-progress indeterminate style="--md-circular-progress-size: 24px;"></md-circular-progress>
                </div>

                <div v-else-if="historyList.length === 0" class="py-8 text-center opacity-40 text-xs">
                  暂无历史核销兑换记录
                </div>

                <!-- 历史项目瀑布 -->
                <div v-else class="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                  <div
                    v-for="item in historyList"
                    :key="item.id"
                    @click="handleViewDetail(item)"
                    class="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-highest)] cursor-pointer transition-all flex flex-col gap-2"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <!-- 9.4 已脱敏前 8 位码展示 -->
                        <span class="font-mono font-bold text-xs text-[var(--md-sys-color-primary)]">
                          {{ item.code }}••••
                        </span>
                        <span class="px-2 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-500">
                          已核销
                        </span>
                      </div>
                      <span class="text-[10px] opacity-40 font-mono">{{ formatDate(item.created_at) }}</span>
                    </div>

                    <!-- 点击展开单条模板详情 -->
                    <div
                      v-if="selectedDetail?.id === item.id"
                      class="pt-2 border-t border-[var(--md-sys-color-outline-variant)]/10 text-[11px] flex flex-col gap-1 opacity-80"
                    >
                      <div class="flex justify-between">
                        <span class="opacity-60">模板名称：</span>
                        <span class="font-bold">{{ selectedDetail.name || '通用卡券' }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="opacity-60">类型：</span>
                        <span>{{ selectedDetail.type_name || '综合权益' }}</span>
                      </div>
                      <div v-if="selectedDetail.description" class="text-[10px] opacity-50 mt-0.5">
                        {{ selectedDetail.description }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 🌟 核心：弹窗打开与收起非线性物理弹簧动效 */
.modal-spring-enter-active {
  transition: all 0.45s cubic-bezier(0.34, 1.45, 0.64, 1);
}
.modal-spring-leave-active {
  transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
}
.modal-spring-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}
.modal-spring-leave-to {
  opacity: 0;
  transform: scale(0.94) translateY(10px);
}

/* 🌟 核心：窗口点击“查询记录”时，平滑展开扩大的连续非线性过渡动画 */
.gift-card-window {
  transition:
    max-width 0.5s cubic-bezier(0.34, 1.35, 0.64, 1),
    max-height 0.5s cubic-bezier(0.34, 1.35, 0.64, 1);
}
</style>