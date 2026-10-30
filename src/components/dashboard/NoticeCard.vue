<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '../../stores/user'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import '@material/web/dialog/dialog.js'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'

const userStore = useUserStore()
const isModalOpen = ref(false)
const selectedNotice = ref<any>(null)

const notices = computed(() => userStore.notices || [])
const displayNotices = computed(() => notices.value.slice(0, 3))
const hasMore = computed(() => notices.value.length > 3)

// 🌟 自定义 Markdown 链接渲染器：让链接自动加亮并支持新标签页打开
const customRenderer = new marked.Renderer()
customRenderer.link = ({ href, title, text }) => {
  const titleAttr = title ? `title="${title}"` : ''
  return `<a href="${href}" ${titleAttr} target="_blank" rel="noopener noreferrer" class="text-[var(--md-sys-color-primary)] font-bold underline hover:opacity-80">${text}</a>`
}

marked.use({
  renderer: customRenderer,
  gfm: true,
  breaks: true
})

// 🌟 核心：全量 Markdown 解析与 XSS 净化
const renderedNoticeContent = computed(() => {
  if (!selectedNotice.value?.content) return '<span class="opacity-40">暂无详细内容</span>'
  const rawHtml = marked.parse(selectedNotice.value.content) as string
  return DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'rel']
  })
})

const openNoticeDetail = (item: any) => {
  selectedNotice.value = item
  isModalOpen.value = true
}

const formatDate = (ts: number) => {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="h-full flex flex-col justify-between select-none">
    <div>
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-2xl">campaign</span>
          <h3 class="text-xl font-black tracking-tight text-[var(--md-sys-color-on-surface)]">最新公告</h3>
        </div>
        <span class="text-xs px-2.5 py-1 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] font-bold">
          {{ notices.length }} 条广播
        </span>
      </div>

      <!-- 无公告状态 -->
      <div v-if="notices.length === 0" class="py-8 flex flex-col items-center justify-center opacity-40 text-sm">
        <span class="material-symbols-outlined text-4xl mb-1">notifications_off</span>
        暂无任何系统通知
      </div>

      <!-- 公告列表项 -->
      <div v-else class="flex flex-col gap-2.5">
        <div
          v-for="item in displayNotices"
          :key="item.id"
          @click="openNoticeDetail(item)"
          class="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 hover:bg-[var(--md-sys-color-surface-container-high)] cursor-pointer transition-all active:scale-[0.99] flex items-center justify-between group"
        >
          <div class="flex flex-col truncate mr-2">
            <span class="text-sm font-bold truncate text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)] transition-colors">
              {{ item.title }}
            </span>
            <span class="text-[11px] text-[var(--md-sys-color-on-surface)] opacity-50 mt-0.5 font-mono">
              {{ formatDate(item.created_at) }}
            </span>
          </div>
          <span class="material-symbols-outlined text-base opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
            chevron_right
          </span>
        </div>
      </div>
    </div>

    <!-- 查看更多按钮 -->
    <div v-if="hasMore" class="pt-4 mt-2 border-t border-[var(--md-sys-color-outline-variant)]/10 flex justify-end">
      <button
        @click="openNoticeDetail(notices[0])"
        class="text-xs font-bold text-[var(--md-sys-color-primary)] flex items-center gap-1 hover:underline cursor-pointer"
      >
        <span>查看全部公告 ({{ notices.length }})</span>
        <span class="material-symbols-outlined text-sm">arrow_forward</span>
      </button>
    </div>

    <!-- 🌟 原生 MD3 公告详情对话框 (暗色模式高对比度反白与 Markdown 支持) -->
    <md-dialog :open="isModalOpen" @closed="isModalOpen = false" class="md3-notice-dialog max-w-xl w-full">
      <div slot="headline" class="font-black text-xl tracking-tight text-[var(--md-sys-color-on-surface)]">
        {{ selectedNotice?.title || '公告详情' }}
      </div>

      <div slot="content" class="flex flex-col gap-3 py-2 text-sm leading-relaxed text-[var(--md-sys-color-on-surface)]">
        <!-- 明确反白日期 -->
        <span class="text-xs text-[var(--md-sys-color-on-surface)] opacity-60 font-mono">
          发布时间：{{ formatDate(selectedNotice?.created_at) }}
        </span>

        <!-- 🌟 满血解析后的 Markdown 内容输出 -->
        <div
          class="notice-markdown-body text-sm leading-relaxed text-[var(--md-sys-color-on-surface)] opacity-95 break-words"
          v-html="renderedNoticeContent"
        ></div>
      </div>

      <div slot="actions">
        <md-filled-button @click="isModalOpen = false">我知道了</md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<style scoped>
/* 🌟 核心：强制注入暗色反白变量，解决正文与标题发暗隐形的问题 */
.md3-notice-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}

/* 🌟 公告专用 Markdown 排版美化 */
:deep(.notice-markdown-body p) {
  margin-bottom: 0.8rem;
}
:deep(.notice-markdown-body p:last-child) {
  margin-bottom: 0;
}
:deep(.notice-markdown-body ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin-bottom: 0.8rem;
}
:deep(.notice-markdown-body code) {
  background: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-primary);
  padding: 0.15em 0.35em;
  border-radius: 0.35rem;
  font-family: monospace;
  font-size: 0.88em;
}
:deep(.notice-markdown-body a) {
  color: var(--md-sys-color-primary);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}
:deep(.notice-markdown-body blockquote) {
  border-left: 3px solid var(--md-sys-color-primary);
  padding-left: 0.75rem;
  margin: 0.75rem 0;
  opacity: 0.85;
  font-style: italic;
}
</style>