<script setup lang="ts">
import { ref, computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  minHeight?: string
}>()

const emit = defineEmits(['update:modelValue'])

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const currentMode = ref<'edit' | 'preview'>('edit')

marked.setOptions({ gfm: true, breaks: true })

// 实时预览渲染
const renderedPreview = computed(() => {
  if (!props.modelValue) return '<span class="opacity-40 text-xs">暂无输入内容，点击上方工具栏或直接输入 Markdown 语法</span>'
  return DOMPurify.sanitize(marked.parse(props.modelValue) as string)
})

// 工具栏便捷插入函数
const insertMarkdown = (prefix: string, suffix: string = '', defaultText: string = '') => {
  const el = textareaRef.value
  if (!el) return

  const start = el.selectionStart
  const end = el.selectionEnd
  const text = props.modelValue
  const selectedText = text.substring(start, end) || defaultText

  const replacement = `${prefix}${selectedText}${suffix}`
  const newContent = text.substring(0, start) + replacement + text.substring(end)

  emit('update:modelValue', newContent)

  // 重新聚焦并选中文本
  setTimeout(() => {
    el.focus()
    el.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length)
  }, 0)
}
</script>

<template>
  <div class="w-full rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent flex flex-col overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-[var(--md-sys-color-primary)] transition-all">
    <!-- 编辑器顶部工具栏 -->
    <div class="px-3 py-2 border-b border-[var(--md-sys-color-outline-variant)]/10 flex items-center justify-between gap-2 bg-[var(--md-sys-color-surface-container-high)]/60">
      <!-- 格式化工具按钮组 -->
      <div class="flex items-center gap-1 overflow-x-auto scrollbar-none">
        <button
          type="button"
          @click="insertMarkdown('**', '**', '粗体文字')"
          class="w-7 h-7 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all text-xs font-bold"
          title="粗体 (Bold)"
        >
          <b>B</b>
        </button>
        <button
          type="button"
          @click="insertMarkdown('*', '*', '斜体文字')"
          class="w-7 h-7 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all text-xs font-serif italic"
          title="斜体 (Italic)"
        >
          <i>I</i>
        </button>
        <button
          type="button"
          @click="insertMarkdown('`', '`', 'code')"
          class="w-7 h-7 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all text-xs font-mono"
          title="行内代码"
        >
          &lt;/&gt;
        </button>
        <button
          type="button"
          @click="insertMarkdown('\n```\n', '\n```\n', '多行代码块')"
          class="w-7 h-7 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all text-xs font-mono"
          title="代码块"
        >
          { }
        </button>
        <button
          type="button"
          @click="insertMarkdown('> ', '', '引用内容')"
          class="w-7 h-7 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all text-xs"
          title="引用 (Quote)"
        >
          <span class="material-symbols-outlined text-sm">format_quote</span>
        </button>
        <button
          type="button"
          @click="insertMarkdown('- ', '', '列表项')"
          class="w-7 h-7 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all text-xs"
          title="无序列表"
        >
          <span class="material-symbols-outlined text-sm">format_list_bulleted</span>
        </button>
        <button
          type="button"
          @click="insertMarkdown('[', '](https://example.com)', '链接描述')"
          class="w-7 h-7 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all text-xs"
          title="插入超链接"
        >
          <span class="material-symbols-outlined text-sm">link</span>
        </button>
      </div>

      <!-- 编辑 / 预览模式切换胶囊 -->
      <div class="flex p-0.5 rounded-full bg-[var(--md-sys-color-surface-container-highest)] shrink-0">
        <button
          type="button"
          @click="currentMode = 'edit'"
          class="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer"
          :class="currentMode === 'edit' ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm' : 'opacity-60 hover:opacity-100'"
        >
          编辑
        </button>
        <button
          type="button"
          @click="currentMode = 'preview'"
          class="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer"
          :class="currentMode === 'preview' ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm' : 'opacity-60 hover:opacity-100'"
        >
          预览
        </button>
      </div>
    </div>

    <!-- 编辑器输入框主体 -->
    <div class="p-3 w-full">
      <textarea
        v-show="currentMode === 'edit'"
        ref="textareaRef"
        :value="modelValue"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        :placeholder="placeholder || '支持 Markdown 格式编排，支持代码块、链接与加粗格式...'"
        class="w-full bg-transparent resize-y outline-none text-xs leading-relaxed text-[var(--md-sys-color-on-surface)] placeholder:opacity-40 font-mono"
        :style="{ minHeight: minHeight || '100px' }"
      ></textarea>

      <!-- 实时预览区 -->
      <div
        v-show="currentMode === 'preview'"
        class="w-full overflow-y-auto text-xs leading-relaxed md3-editor-preview p-1"
        :style="{ minHeight: minHeight || '100px' }"
        v-html="renderedPreview"
      ></div>
    </div>
  </div>
</template>

<style>
.md3-editor-preview blockquote {
  border-left: 3px solid var(--md-sys-color-primary);
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  opacity: 0.8;
}
.md3-editor-preview code {
  background: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-primary);
  padding: 0.15em 0.35em;
  border-radius: 0.3rem;
  font-family: monospace;
}
.md3-editor-preview pre {
  background: var(--md-sys-color-surface-container-lowest);
  padding: 0.75rem;
  border-radius: 0.75rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}
.md3-editor-preview pre code {
  background: transparent;
  padding: 0;
}
.md3-editor-preview ul {
  list-style-type: disc;
  padding-left: 1.2rem;
}
</style>