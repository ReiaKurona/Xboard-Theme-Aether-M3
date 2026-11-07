<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useClashStore } from '../../stores/clash'
import { clashApi } from '../../api/clash'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/textfield/outlined-text-field.js'

const clashStore = useClashStore()

// 🌟 图 4 顶栏分类 Tab：全部 / 策略组 / 节点组
const activeTab = ref<'all' | 'selector' | 'provider'>('all')

// 🌟 折叠状态字典: { [groupName]: boolean (true 为收起) }
const collapsedGroups = ref<Record<string, boolean>>({})

// 测速状态
const testingGroup = ref<Record<string, boolean>>({})
const testingNode = ref<Record<string, boolean>>({})

// 🌟 图 3 完整代理设置状态 (持久化存入 localStorage)
const isSettingsOpen = ref(false)
const sortMode = ref(localStorage.getItem('clash_proxy_sort') || 'default') // default, name_asc, name_desc, latency_asc, latency_desc
const autoDisconnect = ref(localStorage.getItem('clash_auto_disconnect') !== 'false')
const hideUnavailable = ref(localStorage.getItem('clash_hide_unavailable') === 'true')
const cardMinWidth = ref(Number(localStorage.getItem('clash_card_min_width')) || 145)

const toggleGroupCollapse = (groupName: string) => {
  collapsedGroups.value[groupName] = !collapsedGroups.value[groupName]
}

const saveSettings = () => {
  localStorage.setItem('clash_proxy_sort', sortMode.value)
  localStorage.setItem('clash_auto_disconnect', autoDisconnect.value ? 'true' : 'false')
  localStorage.setItem('clash_hide_unavailable', hideUnavailable.value ? 'true' : 'false')
  localStorage.setItem('clash_card_min_width', String(cardMinWidth.value))
  isSettingsOpen.value = false
}

// 统计大类数量 (图 4 顶部的 全部 22 / 策略组 12 / 节点组 10)
const stats = computed(() => {
  const p = clashStore.proxies || {}
  const allGroups = Object.values(p).filter((g: any) => g.all && g.all.length > 0)
  const selectors = allGroups.filter((g: any) => g.type === 'Selector')
  const others = allGroups.filter((g: any) => g.type !== 'Selector')
  return {
    all: allGroups.length,
    selectors: selectors.length,
    others: others.length
  }
})

// 🌟 核心：代理组列表 (默认严格按配置原始顺序排布，同时支持图 3 排序与分类过滤)
const displayGroups = computed(() => {
  const p = clashStore.proxies || {}
  // 保持原始 Object 遍历顺序 (即订阅配置文件的原始顺序)
  let entries = Object.entries(p).filter(([, group]: [string, any]) => group.all && group.all.length > 0)

  // 1. Tab 分类过滤
  if (activeTab.value === 'selector') {
    entries = entries.filter(([, g]) => g.type === 'Selector')
  } else if (activeTab.value === 'provider') {
    entries = entries.filter(([, g]) => g.type !== 'Selector')
  }

  // 2. 组内节点过滤与排序
  return entries.map(([name, group]: [string, any]) => {
    let nodes = [...(group.all || [])]

    // 过滤超时节点
    if (hideUnavailable.value) {
      nodes = nodes.filter(nodeName => {
        const delay = clashStore.nodeDelays[nodeName] || clashStore.proxies[nodeName]?.history?.slice(-1)[0]?.delay || 0
        return delay > 0
      })
    }

    // 组内排序算法
    if (sortMode.value === 'name_asc') {
      nodes.sort((a, b) => a.localeCompare(b))
    } else if (sortMode.value === 'name_desc') {
      nodes.sort((a, b) => b.localeCompare(a))
    } else if (sortMode.value === 'latency_asc') {
      nodes.sort((a, b) => {
        const dA = clashStore.nodeDelays[a] || 9999
        const dB = clashStore.nodeDelays[b] || 9999
        return dA - dB
      })
    } else if (sortMode.value === 'latency_desc') {
      nodes.sort((a, b) => {
        const dA = clashStore.nodeDelays[a] || 0
        const dB = clashStore.nodeDelays[b] || 0
        return dB - dA
      })
    }

    return {
      name,
      group,
      nodes
    }
  })
})

// 🌟 针对某个组的闪电⚡️批量测速 (对齐图 4)
const testGroupLatency = async (e: Event, groupName: string, nodes: string[]) => {
  e.stopPropagation()
  testingGroup.value[groupName] = true
  try {
    // 并发测试该组内的前 16 个节点
    await Promise.allSettled(
      nodes.slice(0, 16).map(nodeName => clashStore.testNodeDelay(nodeName))
    )
  } finally {
    testingGroup.value[groupName] = false
  }
}

// 单节点测速
const testSingleNode = async (e: Event, nodeName: string) => {
  e.stopPropagation()
  testingNode.value[nodeName] = true
  try {
    await clashStore.testNodeDelay(nodeName)
  } finally {
    testingNode.value[nodeName] = false
  }
}

const getNodeDelay = (nodeName: string) => {
  return clashStore.nodeDelays[nodeName] || 
         clashStore.proxies[nodeName]?.history?.slice(-1)[0]?.delay || 0
}

const getDelayClass = (delay: number) => {
  if (delay <= 0) return 'text-red-500 font-bold'
  if (delay < 150) return 'text-emerald-500 font-bold'
  if (delay < 350) return 'text-cyan-400 font-bold'
  return 'text-amber-500 font-bold'
}

onMounted(() => {
  clashStore.checkConnection()
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-6 w-full select-none">
    
    <!-- 🌟 图 4 顶栏：分类胶囊 + 设置齿轮按钮 -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
      <div class="flex items-center gap-2 overflow-x-auto scrollbar-none">
        <button
          @click="activeTab = 'all'"
          class="px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          :class="activeTab === 'all'
            ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm'
            : 'bg-[var(--md-sys-color-surface-container)] opacity-70 hover:opacity-100'"
        >
          <span class="material-symbols-outlined text-sm">grid_view</span>
          <span>全部 {{ stats.all }}</span>
        </button>

        <button
          @click="activeTab = 'selector'"
          class="px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          :class="activeTab === 'selector'
            ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm'
            : 'bg-[var(--md-sys-color-surface-container)] opacity-70 hover:opacity-100'"
        >
          <span class="material-symbols-outlined text-sm">folder</span>
          <span>策略组 {{ stats.selectors }}</span>
        </button>

        <button
          @click="activeTab = 'provider'"
          class="px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          :class="activeTab === 'provider'
            ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm'
            : 'bg-[var(--md-sys-color-surface-container)] opacity-70 hover:opacity-100'"
        >
          <span class="material-symbols-outlined text-sm">dns</span>
          <span>节点组 {{ stats.others }}</span>
        </button>
      </div>

      <!-- 🌟 图 3 入口：代理设置按钮 -->
      <button
        @click="isSettingsOpen = true"
        class="w-10 h-10 rounded-2xl bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center transition-all cursor-pointer shrink-0 self-end sm:self-auto"
        title="代理偏好设置"
      >
        <span class="material-symbols-outlined text-lg opacity-70">settings</span>
      </button>
    </div>

    <!-- 代理组列表 (完全对齐图 4 排版) -->
    <div class="flex flex-col gap-4">
      <div
        v-for="item in displayGroups"
        :key="item.name"
        class="rounded-[32px] bg-[var(--md-sys-color-surface-container)] p-5 md:p-7 shadow-sm transition-all flex flex-col gap-4"
      >
        <!-- 🌟 组标题栏：点击整行可展开/折叠，右侧带闪电⚡️批量测速按钮 -->
        <div
          @click="toggleGroupCollapse(item.name)"
          class="flex items-center justify-between cursor-pointer group py-1 border-b border-[var(--md-sys-color-outline-variant)]/10"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="material-symbols-outlined text-base opacity-40 transition-transform duration-300"
              :class="{ '-rotate-90': collapsedGroups[item.name] }"
            >
              expand_more
            </span>

            <h3 class="text-base md:text-lg font-black text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)] transition-colors">
              {{ item.name }}
            </h3>

            <span class="px-2 py-0.2 rounded-md text-[10px] font-mono font-bold bg-[var(--md-sys-color-surface-container-high)] opacity-60">
              {{ item.group.type }} · {{ item.nodes.length }}
            </span>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-xs font-bold text-[var(--md-sys-color-primary)] font-mono">
              当前: {{ item.group.now }}
            </span>

            <!-- ⚡️ 批量测速按钮 -->
            <button
              @click="testGroupLatency($event, item.name, item.nodes)"
              :disabled="testingGroup[item.name]"
              class="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-primary-container)] hover:text-[var(--md-sys-color-on-primary-container)] active:scale-90 transition-all cursor-pointer"
              title="测试本组节点延迟"
            >
              <span class="material-symbols-outlined text-sm" :class="{ 'animate-spin': testingGroup[item.name] }">
                bolt
              </span>
            </button>
          </div>
        </div>

        <!-- 节点网格卡片 (支持展开/折叠，动态宽度) -->
        <div
          v-show="!collapsedGroups[item.name]"
          class="grid gap-2.5 transition-all duration-300"
          :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinWidth}px, 1fr))` }"
        >
          <div
            v-for="nodeName in item.nodes"
            :key="nodeName"
            @click="clashStore.selectNode(item.name, nodeName)"
            class="p-3.5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between border active:scale-95 select-none"
            :class="item.group.now === nodeName
              ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-transparent shadow-md ring-1 ring-[var(--md-sys-color-primary)] font-bold'
              : 'bg-[var(--md-sys-color-surface-container-high)]/60 hover:bg-[var(--md-sys-color-surface-container-high)] border-transparent opacity-80'"
          >
            <span class="text-xs truncate font-medium">{{ nodeName }}</span>

            <div class="flex items-center justify-between mt-2.5 pt-1.5 border-t border-black/5 dark:border-white/5 text-[10px] font-mono">
              <span class="opacity-40">{{ clashStore.proxies[nodeName]?.type || 'Proxy' }}</span>

              <!-- 延迟测速徽章 -->
              <button
                @click="testSingleNode($event, nodeName)"
                class="hover:underline cursor-pointer"
                :class="getDelayClass(getNodeDelay(nodeName))"
              >
                <span v-if="testingNode[nodeName]" class="animate-spin">↻</span>
                <span v-else-if="getNodeDelay(nodeName) > 0">{{ getNodeDelay(nodeName) }} ms</span>
                <span v-else class="opacity-40">测速</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 🌟 图 3 完整复刻：代理设置弹窗 (Proxy Settings Dialog) -->
    <md-dialog :open="isSettingsOpen" @closed="isSettingsOpen = false" class="md3-clash-settings-dialog max-w-md w-full">
      <div slot="headline" class="font-black text-xl flex items-center justify-between w-full">
        <span>代理设置</span>
        <button @click="isSettingsOpen = false" class="w-7 h-7 rounded-full flex items-center justify-center opacity-50 hover:opacity-100">
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      <div slot="content" class="flex flex-col gap-4 py-2 text-xs text-[var(--md-sys-color-on-surface)]">
        <!-- 1. 排序方式下拉菜单 -->
        <div class="flex items-center justify-between p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)]">
          <span class="font-bold">排序方式</span>
          <select
            v-model="sortMode"
            class="px-3 py-1.5 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-xs font-bold outline-none cursor-pointer"
          >
            <option value="default">按配置排序 (默认)</option>
            <option value="name_asc">按名称升序</option>
            <option value="name_desc">按名称降序</option>
            <option value="latency_asc">按延迟升序</option>
            <option value="latency_desc">按延迟降序</option>
          </select>
        </div>

        <!-- 2. 切换节点时自动断开连接开关 -->
        <div class="flex items-center justify-between p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)]">
          <div>
            <div class="font-bold">切换节点时自动断开连接</div>
            <div class="text-[10px] opacity-50 mt-0.5">强制切断长连接，使出站公网 IP 立即刷新</div>
          </div>
          <input type="checkbox" v-model="autoDisconnect" class="w-4 h-4 accent-[var(--md-sys-color-primary)] cursor-pointer" />
        </div>

        <!-- 3. 隐藏不可用节点开关 -->
        <div class="flex items-center justify-between p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)]">
          <div>
            <div class="font-bold">隐藏不可用节点</div>
            <div class="text-[10px] opacity-50 mt-0.5">自动隐藏延迟为 0 或超时的无效节点</div>
          </div>
          <input type="checkbox" v-model="hideUnavailable" class="w-4 h-4 accent-[var(--md-sys-color-primary)] cursor-pointer" />
        </div>

        <!-- 4. 节点卡片最小宽度输入 -->
        <div class="flex items-center justify-between p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)]">
          <span class="font-bold">节点卡片最小宽度</span>
          <div class="flex items-center gap-2">
            <input
              type="number"
              v-model.number="cardMinWidth"
              min="100"
              max="300"
              class="w-16 px-2 py-1 rounded-lg bg-[var(--md-sys-color-surface-container-high)] text-center font-mono font-bold outline-none"
            />
            <button
              @click="cardMinWidth = 145"
              class="px-2 py-1 rounded-lg bg-[var(--md-sys-color-surface-container-high)] text-[10px] font-bold opacity-60 hover:opacity-100"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      <div slot="actions">
        <md-filled-button @click="saveSettings">保存偏好</md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<style scoped>
.md3-clash-settings-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>