<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api/client'
import { useUserStore } from '../../stores/user'
import XboardNodeCard from '../../components/servers/XboardNodeCard.vue'
import KomariMonitorCard from '../../components/servers/KomariMonitorCard.vue'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/button/filled-button.js'
import '@material/web/progress/circular-progress.js'

const router = useRouter()
const userStore = useUserStore()

const servers = ref<any[]>([])
const loading = ref(false)
const searchQuery = ref('')
const selectedProtocol = ref<string>('all')

// 6.1 拉取节点列表 (支持 ETag 304 缓存)
const fetchServers = async () => {
  loading.value = true
  try {
    const res: any = await api.get('/user/server/fetch')
    // 文档 1.4 说明：server/fetch 接口返回 { data: [...] }
    servers.value = Array.isArray(res) ? res : (res.data || [])
  } catch {
    servers.value = []
  } finally {
    loading.value = false
  }
}

// 提取所有节点中存在的协议分类
const availableProtocols = computed(() => {
  const set = new Set<string>()
  servers.value.forEach((s) => {
    if (s.type) set.add(s.type.toLowerCase())
  })
  return Array.from(set)
})

// 筛选与搜索计算
const filteredServers = computed(() => {
  let list = servers.value

  // 协议筛选
  if (selectedProtocol.value !== 'all') {
    list = list.filter((s) => (s.type || '').toLowerCase() === selectedProtocol.value)
  }

  // 关键字搜索
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((s) => {
      const matchName = (s.name || '').toLowerCase().includes(q)
      const matchTag = (s.tags || []).some((t: string) => t.toLowerCase().includes(q))
      return matchName || matchTag
    })
  }

  return list
})

// 统计指标
const onlineCount = computed(() => servers.value.filter((s) => s.is_online).length)
const hasActiveSubscription = computed(() => Boolean(userStore.subscribeInfo?.plan_id))

onMounted(() => {
  fetchServers()
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-8 w-full">
    <!-- 顶部概括与说明 -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
      <p class="text-xs md:text-sm opacity-60 leading-relaxed">
        实时监控集群各协议出口服务器可用性、连通率及流量结算倍率。
      </p>

      <div class="flex items-center gap-3 shrink-0">
        <div class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--md-sys-color-surface-container)] flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>集群在线: {{ onlineCount }} / {{ servers.length }}</span>
        </div>
      </div>
    </div>

    <!-- 🌟 模块 1：Komari 探针监控接入模块 (按后台 config 开关与地址自适应渲染) -->
    <KomariMonitorCard />

    <!-- 🌟 模块 2：Xboard 节点列表核心区 -->
    <div class="flex flex-col gap-5">
      <!-- 筛选与搜索工具条 -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <!-- 协议标签胶囊筛选 -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            @click="selectedProtocol = 'all'"
            class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            :class="selectedProtocol === 'all'
              ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm'
              : 'bg-[var(--md-sys-color-surface-container)] opacity-70 hover:opacity-100'"
          >
            全部协议 ({{ servers.length }})
          </button>
          
          <button
            v-for="p in availableProtocols"
            :key="p"
            @click="selectedProtocol = p"
            class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer uppercase whitespace-nowrap"
            :class="selectedProtocol === p
              ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm'
              : 'bg-[var(--md-sys-color-surface-container)] opacity-70 hover:opacity-100'"
          >
            {{ p }}
          </button>
        </div>

        <!-- 搜索输入框 -->
        <div class="w-full sm:w-64">
          <md-outlined-text-field
            label="搜索节点或国家标签"
            :value="searchQuery"
            @input="(e: any) => searchQuery = e.target.value"
            class="w-full"
          >
            <span slot="leading-icon" class="material-symbols-outlined">search</span>
          </md-outlined-text-field>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="loading && servers.length === 0" class="py-20 flex justify-center">
        <md-circular-progress indeterminate></md-circular-progress>
      </div>

      <!-- 文档 6.1：订阅无效或无节点时展示 -->
      <div
        v-else-if="servers.length === 0"
        class="p-8 md:p-12 rounded-[32px] bg-[var(--md-sys-color-surface-container)] flex flex-col items-center justify-center text-center gap-3 shadow-sm"
      >
        <div class="w-16 h-16 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center mb-1">
          <span class="material-symbols-outlined text-3xl">dns</span>
        </div>
        <h3 class="text-xl font-black tracking-tight">暂未获取到可用节点</h3>
        <p class="text-xs opacity-60 max-w-sm leading-relaxed">
          {{ hasActiveSubscription ? '节点集群正在维护同步中，请稍后再试。' : '您当前没有生效中的有效订阅套餐，或流量额度已耗尽，请先选购订阅。' }}
        </p>

        <md-filled-button v-if="!hasActiveSubscription" @click="router.push('/plan')" class="mt-2">
          选购可用套餐
        </md-filled-button>
      </div>

      <!-- 节点网格卡片矩阵 (全宽自适应，无多余白线) -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 w-full">
        <XboardNodeCard
          v-for="server in filteredServers"
          :key="server.id"
          :server="server"
        />
      </div>
    </div>
  </div>
</template>