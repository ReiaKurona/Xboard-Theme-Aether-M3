<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import TicketMarkdownEditor from './TicketMarkdownEditor.vue'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'

const props = defineProps<{
  ticketId: number | null
}>()

const emit = defineEmits(['back', 'ticket-updated'])
const userStore = useUserStore()

const ticketDetail = ref<any>(null)
const messages = ref<any[]>([])
const loading = ref(false)
const is500Error = ref(false)

// 回复输入状态
const replyContent = ref('')
const isReplying = ref(false)
const replyError = ref('')
const isClosing = ref(false)
const chatScrollRef = ref<HTMLDivElement | null>(null)

marked.setOptions({ gfm: true, breaks: true })

const renderMarkdown = (text: string) => {
  if (!text) return ''
  return DOMPurify.sanitize(marked.parse(text) as string)
}

// 7.1 获取工单详情 (加入文档特别警告的 500 严重错误安全兜底)
const fetchDetail = async () => {
  if (!props.ticketId) return
  loading.value = true
  is500Error.value = false
  try {
    const res: any = await api.get(`/user/ticket/fetch?id=${props.ticketId}`)
    const data = res.data ?? res
    ticketDetail.value = data
    messages.value = Array.isArray(data?.message) ? data.message : []
    scrollToBottom()
  } catch (err: any) {
    // 🌟 核心防雪崩：捕获后端由于 null->load() 抛出的 500
    is500Error.value = true
    ticketDetail.value = null
    messages.value = []
  } finally {
    loading.value = false
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
    }
  })
}

// 7.2 回复工单
const handleReply = async () => {
  if (!replyContent.value.trim() || !props.ticketId) return
  isReplying.value = true
  replyError.value = ''
  try {
    await api.post('/user/ticket/reply', {
      id: props.ticketId,
      message: replyContent.value.trim()
    })
    replyContent.value = ''
    await fetchDetail()
    emit('ticket-updated')
  } catch (err: any) {
    // 捕获“必须等待客服回复”业务报错
    replyError.value = err.message || '回复失败，请稍后再试'
  } finally {
    isReplying.value = false
  }
}

// 7.3 关闭工单
const handleClose = async () => {
  if (!props.ticketId) return
  isClosing.value = true
  try {
    await api.post('/user/ticket/close', { id: props.ticketId })
    if (ticketDetail.value) ticketDetail.value.status = 1
    emit('ticket-updated')
  } catch (err: any) {
    alert(err.message || '关闭工单失败')
  } finally {
    isClosing.value = false
  }
}

const formatDate = (ts: number) => {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 优先级与状态胶囊
const levelText = computed(() => {
  switch (ticketDetail.value?.level) {
    case 0: return { text: '低优先级', class: 'bg-zinc-500/15 text-zinc-400' }
    case 1: return { text: '中优先级', class: 'bg-blue-500/15 text-blue-500' }
    case 2: return { text: '高优先级 (提现/加急)', class: 'bg-red-500/15 text-red-500 font-bold' }
    default: return { text: '普通', class: 'bg-zinc-500/15 text-zinc-400' }
  }
})

watch(() => props.ticketId, fetchDetail, { immediate: true })
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="h-full flex flex-col justify-between rounded-[32px] bg-[var(--md-sys-color-surface-container)] p-5 md:p-8 shadow-sm relative overflow-hidden min-h-[550px]">
    <!-- 1. 顶栏：工单基本信息与结单按钮 -->
    <div v-if="ticketDetail" class="flex flex-col gap-3 pb-4 border-b border-[var(--md-sys-color-outline-variant)]/10 shrink-0">
      <div class="flex items-center justify-between">
        <button
          @click="emit('back')"
          class="lg:hidden flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] active:scale-95 transition-all"
        >
          <span class="material-symbols-outlined text-sm">arrow_back</span>
          <span>返回列表</span>
        </button>

        <div class="flex items-center gap-2 ml-auto lg:ml-0">
          <span class="px-2.5 py-0.5 rounded-full text-[11px]" :class="levelText.class">
            {{ levelText.text }}
          </span>
          <span
            class="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
            :class="ticketDetail.status === 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-zinc-500/15 text-zinc-400'"
          >
            {{ ticketDetail.status === 0 ? '处理中 (开放)' : '已结单 (关闭)' }}
          </span>
        </div>

        <button
          v-if="ticketDetail.status === 0"
          @click="handleClose"
          :disabled="isClosing"
          class="hidden sm:flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <span class="material-symbols-outlined text-sm">lock</span>
          <span>{{ isClosing ? '正在结单...' : '关闭工单' }}</span>
        </button>
      </div>

      <div class="flex items-center justify-between">
        <h2 class="text-xl md:text-2xl font-black tracking-tight text-[var(--md-sys-color-on-surface)] truncate mr-2">
          {{ ticketDetail.subject }}
        </h2>
        <span class="text-xs opacity-50 font-mono shrink-0">#{{ ticketDetail.id }}</span>
      </div>
    </div>

    <!-- 🌟 500 异常捕获报错回退状态 -->
    <div v-if="is500Error" class="my-auto py-16 flex flex-col items-center justify-center text-center gap-3">
      <div class="w-14 h-14 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center">
        <span class="material-symbols-outlined text-3xl">error</span>
      </div>
      <h3 class="text-lg font-black text-red-500">无法读取工单内容</h3>
      <p class="text-xs opacity-60 max-w-sm">该工单可能已被归档清理或不属于当前账户，请返回工单列表。</p>
      <md-filled-tonal-button @click="emit('back')">返回工单列表</md-filled-tonal-button>
    </div>

    <!-- 载入中 -->
    <div v-else-if="loading && messages.length === 0" class="my-auto py-24 flex justify-center">
      <md-circular-progress indeterminate></md-circular-progress>
    </div>

    <!-- 2. 中间：IM 风格消息对话流 (支持 Markdown 气泡) -->
    <div
      v-else-if="ticketDetail"
      ref="chatScrollRef"
      class="flex-1 w-full overflow-y-auto py-4 flex flex-col gap-4 my-2 pr-1"
    >
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="flex flex-col max-w-[85%] md:max-w-[75%]"
        :class="msg.is_me ? 'self-end items-end' : 'self-start items-start'"
      >
        <!-- 发送者与时间 -->
        <div class="flex items-center gap-2 mb-1 px-1 text-[11px] opacity-50">
          <span v-if="!msg.is_me" class="px-1.5 py-0.2 rounded bg-[var(--md-sys-color-primary)] text-white text-[9px] font-bold">客服支持</span>
          <span>{{ msg.is_me ? '我' : '官方技术客服' }}</span>
          <span>·</span>
          <span>{{ formatDate(msg.created_at) }}</span>
        </div>

        <!-- 气泡主体：满血 Markdown 渲染 -->
        <div
          class="p-4 rounded-3xl text-xs md:text-sm leading-relaxed shadow-sm break-words overflow-hidden"
          :class="msg.is_me
            ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] rounded-tr-sm'
            : 'bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] rounded-tl-sm'"
          v-html="renderMarkdown(msg.message)"
        ></div>
      </div>
    </div>

    <!-- 未选择工单时的初始空状态 -->
    <div v-else class="my-auto py-20 flex flex-col items-center justify-center text-center gap-3 opacity-40">
      <span class="material-symbols-outlined text-5xl">support_agent</span>
      <h3 class="text-lg font-black tracking-tight">请在左侧选择或发起新工单</h3>
      <p class="text-xs max-w-xs">官方技术客服将竭诚为您排查节点故障与网络异常。</p>
    </div>

    <!-- 3. 底部：Markdown 封装回复输入区 -->
    <div v-if="ticketDetail" class="pt-3 border-t border-[var(--md-sys-color-outline-variant)]/10 flex flex-col gap-2 shrink-0">
      <!-- 已关闭禁用提示 -->
      <div v-if="ticketDetail.status === 1" class="py-3 text-center text-xs opacity-50 font-bold bg-[var(--md-sys-color-surface-container-high)]/60 rounded-2xl">
        此工单已关闭，如需进一步支持请发起新工单
      </div>

      <template v-else>
        <!-- 回复报错信息 -->
        <div v-if="replyError" class="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">warning</span>
          {{ replyError }}
        </div>

        <!-- Markdown 编辑输入器 -->
        <TicketMarkdownEditor
          v-model="replyContent"
          placeholder="输入回复内容，支持 Markdown 排版语法与代码块..."
          min-height="80px"
        />

        <div class="flex items-center justify-between pt-1">
          <span class="text-[10px] opacity-40">若客服开启排队限制，连续快速回复可能会被拦截</span>
          <md-filled-button
            @click="handleReply"
            :disabled="isReplying || !replyContent.trim()"
            class="h-10"
          >
            <md-circular-progress v-if="isReplying" indeterminate slot="icon" style="--md-circular-progress-size: 14px;"></md-circular-progress>
            <span v-else>发送回复</span>
          </md-filled-button>
        </div>
      </template>
    </div>
  </div>
</template>