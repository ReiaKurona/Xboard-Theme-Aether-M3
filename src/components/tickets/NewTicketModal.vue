<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../../api/client'
import TicketMarkdownEditor from './TicketMarkdownEditor.vue'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/progress/circular-progress.js'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits(['close', 'success'])

const subject = ref('')
const level = ref<number>(1) // 默认中等优先级
const message = ref('')
const isSubmitting = ref(false)
const errorMsg = ref('')

const priorityOptions = [
  { label: '低优先级 (日常闲聊/反馈)', value: 0 },
  { label: '中等优先级 (节点异常/疑问)', value: 1 },
  { label: '高优先级 (网络严重阻断/加急)', value: 2 }
]

const handleCreateTicket = async () => {
  if (!subject.value.trim() || !message.value.trim()) {
    errorMsg.value = '请填写工单主题和详细描述'
    return
  }

  isSubmitting.value = true
  errorMsg.value = ''
  try {
    await api.post('/user/ticket/save', {
      subject: subject.value.trim(),
      level: level.value,
      message: message.value.trim()
    })
    subject.value = ''
    message.value = ''
    level.value = 1
    emit('success')
  } catch (err: any) {
    errorMsg.value = err.message || '提交工单失败'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <md-dialog :open="open" @closed="emit('close')" class="md3-ticket-dialog max-w-xl w-full">
    <div slot="headline" class="font-black text-xl tracking-tight flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
      <span class="material-symbols-outlined text-[var(--md-sys-color-primary)]">add_circle</span>
      发起技术与客诉工单
    </div>

    <div slot="content" class="flex flex-col gap-4 py-2 text-xs text-[var(--md-sys-color-on-surface)]">
      <div v-if="errorMsg" class="p-3 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 flex items-center gap-2">
        <span class="material-symbols-outlined text-base">error</span>
        {{ errorMsg }}
      </div>

      <!-- 主题 -->
      <md-outlined-text-field
        label="工单主题 / 概要描述"
        :value="subject"
        @input="(e: any) => subject = e.target.value"
        class="w-full"
        required
      >
        <span slot="leading-icon" class="material-symbols-outlined">title</span>
      </md-outlined-text-field>

      <!-- 优先级级别选择 -->
      <div class="flex flex-col gap-1.5">
        <span class="font-bold opacity-70">问题加急等级</span>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div
            v-for="p in priorityOptions"
            :key="p.value"
            @click="level = p.value"
            class="p-2.5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between border select-none active:scale-95 text-center"
            :class="level === p.value
              ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-transparent shadow-sm font-bold'
              : 'bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] border-black/5 dark:border-transparent opacity-80'"
          >
            <span class="text-xs">{{ p.label.split(' ')[0] }}</span>
            <span class="text-[10px] opacity-60 mt-0.5 truncate">{{ p.label.split(' ')[1] }}</span>
          </div>
        </div>
      </div>

      <!-- Markdown 消息封装编辑器 -->
      <div class="flex flex-col gap-1.5">
        <span class="font-bold opacity-70">详细问题内容说明 (Markdown)</span>
        <TicketMarkdownEditor
          v-model="message"
          placeholder="请详细描述您遇到的问题现象、客户端版本或报错截图链接..."
          min-height="120px"
        />
      </div>
    </div>

    <div slot="actions">
      <md-text-button @click="emit('close')">取消</md-text-button>
      <md-filled-button @click="handleCreateTicket" :disabled="isSubmitting">
        <md-circular-progress v-if="isSubmitting" indeterminate slot="icon" style="--md-circular-progress-size: 14px;"></md-circular-progress>
        <span v-else>立即提交工单</span>
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