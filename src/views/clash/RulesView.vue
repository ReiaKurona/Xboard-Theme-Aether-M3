<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { clashApi } from '../../api/clash'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/progress/circular-progress.js'

const rules = ref<any[]>([])
const providers = ref<Record<string, any>>({})
const loading = ref(false)
const searchQuery = ref('')
const activeTab = ref<'rules' | 'providers'>('rules')

const fetchRulesData = async () => {
  loading.value = true
  try {
    const [ruleRes, provRes] = await Promise.all([
      clashApi.fetchRulesAPI(),
      clashApi.fetchRuleProvidersAPI?.().catch(() => ({ data: { providers: {} } })) || { data: { providers: {} } }
    ])
    rules.value = ruleRes.data.rules || []
    providers.value = provRes.data?.providers || {}
  } catch {}
  finally {
    loading.value = false
  }
}

const providerList = computed(() => Object.values(providers.value || {}))

const filteredRules = computed(() => {
  if (!searchQuery.value.trim()) return rules.value
  const q = searchQuery.value.trim().toLowerCase()
  return rules.value.filter(r => {
    return (r.payload || '').toLowerCase().includes(q) ||
           (r.type || '').toLowerCase().includes(q) ||
           (r.proxy || '').toLowerCase().includes(q)
  })
})

// 目标动作徽章配色 (REJECT, DIRECT, 节点)
const getActionClass = (proxy: string) => {
  const p = (proxy || '').toUpperCase()
  if (p.includes('REJECT')) return 'bg-red-500/15 text-red-500 font-bold'
  if (p.includes('DIRECT')) return 'bg-zinc-500/20 text-zinc-300 font-bold'
  return 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] font-black'
}

onMounted(fetchRulesData)
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-5 w-full select-none">
    
    <!-- 🌟 图 3 顶栏控制器：规则与提供商 Tab + 搜索框 -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-[28px] bg-[var(--md-sys-color-surface-container)] shadow-sm">
      <div class="flex items-center gap-2">
        <button
          @click="activeTab = 'rules'"
          class="px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          :class="activeTab === 'rules'
            ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm'
            : 'bg-[var(--md-sys-color-surface-container-high)] opacity-70 hover:opacity-100'"
        >
          <span class="material-symbols-outlined text-sm">rule</span>
          <span>规则 {{ rules.length }}</span>
        </button>

        <button
          @click="activeTab = 'providers'"
          class="px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          :class="activeTab === 'providers'
            ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm'
            : 'bg-[var(--md-sys-color-surface-container-high)] opacity-70 hover:opacity-100'"
        >
          <span class="material-symbols-outlined text-sm">layers</span>
          <span>规则提供商 {{ providerList.length }}</span>
        </button>
      </div>

      <div class="w-full sm:w-64">
        <md-outlined-text-field
          label="搜索规则 / Payload / 目标..."
          :value="searchQuery"
          @input="(e: any) => searchQuery = e.target.value"
          class="w-full"
        >
          <span slot="leading-icon" class="material-symbols-outlined text-sm">search</span>
        </md-outlined-text-field>
      </div>
    </div>

    <!-- 载入状态 -->
    <div v-if="loading" class="py-20 flex justify-center">
      <md-circular-progress indeterminate></md-circular-progress>
    </div>

    <!-- 🌟 视图 A：图 3 同款单条规则列表 (序号、类型、Payload、REJECT 药丸) -->
    <div v-else-if="activeTab === 'rules'" class="flex flex-col gap-2 max-h-[75vh] overflow-y-auto pr-1">
      <div v-if="filteredRules.length === 0" class="py-16 text-center opacity-40 text-xs">
        未找到匹配的分流规则
      </div>

      <div
        v-for="(r, idx) in filteredRules"
        :key="idx"
        class="p-4 rounded-[22px] bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-between gap-3 text-xs font-mono shadow-sm transition-colors"
      >
        <div class="flex items-center gap-3 truncate">
          <!-- 序号 -->
          <span class="text-[11px] opacity-40 w-6 shrink-0 text-center">{{ idx + 1 }}</span>

          <div class="flex items-center gap-2 truncate">
            <span class="opacity-50 text-[11px] shrink-0">{{ r.type }} :</span>
            <span class="font-bold text-[var(--md-sys-color-on-surface)] truncate" :title="r.payload">
              {{ r.payload || 'Match 默认匹配' }}
            </span>
          </div>
        </div>

        <!-- 目标动作药丸徽章 (REJECT, DIRECT, 节点名称) -->
        <span class="px-3 py-1 rounded-full text-[11px] shrink-0 uppercase tracking-wide" :class="getActionClass(r.proxy)">
          {{ r.proxy }}
        </span>
      </div>
    </div>

    <!-- 视图 B：规则提供商列表 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="p in providerList"
        :key="p.name"
        class="p-5 rounded-[28px] bg-[var(--md-sys-color-surface-container)] flex flex-col justify-between gap-3 shadow-sm"
      >
        <div class="flex items-center justify-between">
          <span class="font-black text-sm text-[var(--md-sys-color-on-surface)]">{{ p.name }}</span>
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
            {{ p.ruleCount || p.behavior || 'RuleSet' }} 条规则
          </span>
        </div>
        <div class="text-[11px] opacity-50 font-mono truncate" :title="p.vehicleType">
          格式: {{ p.format }} · 载具: {{ p.vehicleType }}
        </div>
      </div>
    </div>
  </div>
</template>