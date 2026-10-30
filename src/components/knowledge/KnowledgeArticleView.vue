<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import '@material/web/button/filled-tonal-button.js'

const props = defineProps<{
  article: {
    id: number
    category: string
    title: string
    body?: string
    updated_at: number
  } | null
}>()

const emit = defineEmits(['back'])
const router = useRouter()
const copied = ref(false)

// 配置 marked 开启全量 GFM 特性 (表格、换行、删除线等)
marked.setOptions({
  gfm: true,
  breaks: true
})

// 🌟 满血 Markdown 解析与 XSS 过滤
const renderedContent = computed(() => {
  if (!props.article?.body) return ''
  
  // 1. 将 Markdown 解析为原生 HTML
  const rawHtml = marked.parse(props.article.body) as string

  // 2. 使用 DOMPurify 清理危险标签，但放行安全的文档元素与视频 iframe
  return DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target']
  })
})

const formatDate = (ts?: number) => {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString()
}

const copyShareLink = async () => {
  if (!props.article) return
  await navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div v-if="article" class="p-6 md:p-10 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm flex flex-col gap-6 w-full min-h-[500px]">
    <!-- 文章顶栏 -->
    <div class="flex flex-col gap-3 pb-6 border-b border-[var(--md-sys-color-outline-variant)]/10">
      <div class="flex items-center justify-between">
        <!-- 移动端返回分类列表按钮 -->
        <button
          @click="emit('back')"
          class="lg:hidden flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] active:scale-95 transition-all"
        >
          <span class="material-symbols-outlined text-sm">arrow_back</span>
          <span>返回目录</span>
        </button>

        <span class="px-3 py-1 rounded-full text-xs font-bold bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
          {{ article.category }}
        </span>

        <span class="text-xs opacity-50 font-mono hidden sm:inline">
          更新于 {{ formatDate(article.updated_at) }}
        </span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
        <h1 class="text-2xl md:text-3xl font-black tracking-tight text-[var(--md-sys-color-on-surface)] leading-tight">
          {{ article.title }}
        </h1>

        <button
          @click="copyShareLink"
          class="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] opacity-80 hover:opacity-100 transition-all self-start sm:self-auto shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <span class="material-symbols-outlined text-sm">{{ copied ? 'check' : 'share' }}</span>
          <span>{{ copied ? '已复制链接' : '分享教程' }}</span>
        </button>
      </div>
    </div>

    <!-- 🌟 满血 Markdown 与权限锁内容呈现区 -->
    <div
      class="md3-markdown-body text-sm leading-relaxed text-[var(--md-sys-color-on-surface)]"
      v-html="renderedContent"
    ></div>

    <!-- 底部互动栏 -->
    <div class="pt-6 mt-6 border-t border-[var(--md-sys-color-outline-variant)]/10 flex items-center justify-between text-xs opacity-60">
      <span>知识库文档编号: #{{ article.id }}</span>
      <button @click="router.push('/tickets')" class="hover:underline flex items-center gap-1 text-[var(--md-sys-color-primary)]">
        <span>教程有疑问？发起工单</span>
        <span class="material-symbols-outlined text-xs">arrow_forward</span>
      </button>
    </div>
  </div>

  <!-- 未选择文章时的空状态 -->
  <div v-else class="p-12 rounded-[32px] bg-[var(--md-sys-color-surface-container)] flex flex-col items-center justify-center text-center gap-3 w-full min-h-[400px] opacity-50">
    <span class="material-symbols-outlined text-5xl mb-1">menu_book</span>
    <h3 class="text-lg font-black tracking-tight">请在左侧选择一篇教程进行阅读</h3>
    <p class="text-xs max-w-xs">包含 Windows、macOS、iOS、Android 各大客户端配置指引与疑难排解。</p>
  </div>
</template>

<style>
/* =========================================================
   🌟 MD3 Expressive 满血 Markdown 样式引擎
   ========================================================= */
.md3-markdown-body {
  word-break: break-word;
  line-height: 1.8;
}

/* 标题样式 */
.md3-markdown-body h1,
.md3-markdown-body h2,
.md3-markdown-body h3,
.md3-markdown-body h4 {
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: 1.8rem;
  margin-bottom: 0.8rem;
  color: var(--md-sys-color-on-surface);
}

.md3-markdown-body h1 { font-size: 1.6rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 0.4rem; }
.md3-markdown-body h2 { font-size: 1.35rem; }
.md3-markdown-body h3 { font-size: 1.15rem; }

/* 段落与列表 */
.md3-markdown-body p {
  margin-bottom: 1.1rem;
}

.md3-markdown-body ul,
.md3-markdown-body ol {
  padding-left: 1.4rem;
  margin-bottom: 1.2rem;
}

.md3-markdown-body ul { list-style-type: disc; }
.md3-markdown-body ol { list-style-type: decimal; }
.md3-markdown-body li { margin-bottom: 0.4rem; }

/* 引用块 (Blockquote) */
.md3-markdown-body blockquote {
  border-left: 4px solid var(--md-sys-color-primary);
  background: var(--md-sys-color-surface-container-high);
  padding: 0.8rem 1.2rem;
  margin: 1.4rem 0;
  border-radius: 0 1rem 1rem 0;
  opacity: 0.9;
  font-style: italic;
}

/* 行内代码与多行代码块 */
.md3-markdown-body code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
  padding: 0.2em 0.45em;
  border-radius: 0.5rem;
  background: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-primary);
  font-weight: 600;
}

.md3-markdown-body pre {
  background: var(--md-sys-color-surface-container-lowest);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 1.1rem;
  border-radius: 1.2rem;
  overflow-x: auto;
  margin: 1.4rem 0;
}

.md3-markdown-body pre code {
  background: transparent;
  padding: 0;
  color: inherit;
  font-size: 0.85rem;
  line-height: 1.6;
}

/* 链接 */
.md3-markdown-body a {
  color: var(--md-sys-color-primary);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: opacity 0.2s;
}

.md3-markdown-body a:hover {
  opacity: 0.8;
}

/* 图片 */
.md3-markdown-body img {
  max-width: 100%;
  border-radius: 1.2rem;
  margin: 1.5rem auto;
  box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.2);
}

/* GFM 表格样式 */
.md3-markdown-body table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 1.5rem 0;
  border-radius: 1.2rem;
  overflow: hidden;
  background: var(--md-sys-color-surface-container-high);
}

.md3-markdown-body th,
.md3-markdown-body td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.md3-markdown-body th {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  font-weight: 800;
}

/* =========================================================
   🔒 文档 6.4 专属：无有效订阅时的权限锁样式容器
   ========================================================= */
.v2board-no-access {
  background: rgba(239, 68, 68, 0.12) !important;
  border: 1.5px dashed rgba(239, 68, 68, 0.4) !important;
  color: #ef4444 !important;
  padding: 1.5rem !important;
  border-radius: 1.5rem !important;
  margin: 1.8rem 0 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  text-align: center !important;
  gap: 0.5rem !important;
  font-weight: 700 !important;
}

.v2board-no-access::before {
  content: 'lock';
  font-family: 'Material Symbols Outlined';
  font-size: 2.2rem;
  display: block;
}
</style>