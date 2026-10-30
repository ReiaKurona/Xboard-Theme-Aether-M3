<script setup lang="ts">
import { computed } from 'vue'
import ActivityCard from '../../components/activities/ActivityCard.vue'

const settings = (window as any).settings || {}
// 动态读取全局配置中的自定义活动代码
const rawActivityCode = computed(() => {
  return String(settings.activity_custom_code || '').trim()
})

// 🌟 强健宽容解析器：支持 3 个或 4 个以上反引号，或直接裸贴代码
const parsedActivities = computed<string[]>(() => {
  const code = rawActivityCode.value
  if (!code) return []

  // 1. 优先匹配 3 或 4 个以上反引号 (``` 或 ````)
  const regex = /(?:`{3,})([\s\S]*?)(?:`{3,})/g
  const list: string[] = []
  let match

  while ((match = regex.exec(code)) !== null) {
    const chunk = match[1].trim()
    if (chunk) list.push(chunk)
  }

  if (list.length > 0) return list

  // 2. 备用匹配：用户如果直接裸贴了 <div> 或 <iframe>，直接作为单个活动完整渲染
  if (code.length > 0) {
    return [code]
  }

  return []
})
</script>

<template>
  <div class="flex flex-col gap-6 w-full">
    <!-- 顶栏说明副标题 -->
    <div class="flex items-center justify-between pb-1 select-none">
      <p class="text-xs md:text-sm opacity-60 leading-relaxed">
        参与本站限时福利、特惠充值与互动活动，解锁专属时长与流量权益。
      </p>

      <span v-if="parsedActivities.length > 0" class="text-xs px-3 py-1 rounded-full font-bold bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
        共 {{ parsedActivities.length }} 个福利项目
      </span>
    </div>

    <!-- 🌟 空状态：没有配置时友好提示 -->
    <div
      v-if="parsedActivities.length === 0"
      class="p-12 md:p-16 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent flex flex-col items-center justify-center text-center gap-3 shadow-sm select-none"
    >
      <div class="w-16 h-16 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center mb-1">
        <span class="material-symbols-outlined text-4xl">celebration</span>
      </div>
      <h3 class="text-xl font-black tracking-tight text-[var(--md-sys-color-on-surface)]">当前暂无进行中的活动</h3>
      <p class="text-xs opacity-60 max-w-sm leading-relaxed">
        站长正在精心筹备下一轮专属福利与优惠活动，敬请关注最新公告！
      </p>
    </div>

    <!-- 🌟 多活动分卡渲染舞台 -->
    <div v-else class="flex flex-col gap-6 w-full">
      <ActivityCard
        v-for="(codeChunk, idx) in parsedActivities"
        :key="idx"
        :code="codeChunk"
        :index="idx"
      />
    </div>
  </div>
</template>