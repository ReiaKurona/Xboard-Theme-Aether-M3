<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { clashApi } from '../../api/clash'
import { useClashStore } from '../../stores/clash'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/chips/filter-chip.js'
import '@material/web/progress/linear-progress.js'
import '@material/web/textfield/outlined-text-field.js'

interface Rule { index?: number; type: string; payload?: string; proxy: string; extra?: { hitCount?: number; disabled?: boolean } }
interface Provider { behavior?: string; format?: string; vehicleType?: string; ruleCount?: number; updatedAt?: string }

const client = useClashStore()
const rules = ref<Rule[]>([]), providers = ref<Record<string, Provider>>({})
const tab = ref<'rules' | 'providers'>('rules'), search = ref(''), page = ref(1)
const loading = ref(false), failure = ref(''), providerFailure = ref(''), message = ref('')
let read: AbortController | undefined
const PAGE_SIZE = 60

async function refresh() {
  if (!client.kernelReady) return
  read?.abort()
  const request = new AbortController()
  read = request
  loading.value = true; failure.value = ''; providerFailure.value = ''
  const [ruleResult, providerResult] = await Promise.allSettled([
    clashApi.fetchRulesAPI(request.signal), clashApi.fetchRuleProvidersAPI(request.signal),
  ])
  if (read !== request) return
  if (ruleResult.status === 'fulfilled') rules.value = ruleResult.value.data.rules || []
  else failure.value = (ruleResult.reason as Error).message
  if (providerResult.status === 'fulfilled') providers.value = providerResult.value.data.providers || {}
  else providerFailure.value = (providerResult.reason as Error).message
  loading.value = false
}

watch(() => [client.kernelReady, client.secret], () => {
  read?.abort(); read = undefined; loading.value = false
  rules.value = []; providers.value = {}; page.value = 1; message.value = ''; failure.value = ''; providerFailure.value = ''
  void refresh()
}, { immediate: true })
onUnmounted(() => { read?.abort(); read = undefined })

const query = computed(() => search.value.trim().toLowerCase())
const filteredRules = computed(() => rules.value.map((rule, position) => ({ rule, index: (rule.index ?? position) + 1 }))
  .filter(({ rule }) => !query.value || [rule.type, rule.payload, rule.proxy].join(' ').toLowerCase().includes(query.value)))
const filteredProviders = computed(() => Object.entries(providers.value)
  .filter(([name, provider]) => !query.value || [name, provider.behavior, provider.format].join(' ').toLowerCase().includes(query.value)))
const pages = computed(() => Math.max(1, Math.ceil(filteredRules.value.length / PAGE_SIZE)))
const rows = computed(() => filteredRules.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([tab, query], () => { page.value = 1 })
watch(pages, count => { if (page.value > count) page.value = count })
async function update(name: string) {
  message.value = ''; providerFailure.value = ''
  try {
    await client.runMutation(() => clashApi.updateRuleProvider(name))
    message.value = `${name} 已更新`
    await refresh()
  } catch (cause) { providerFailure.value = (cause as Error).message }
}
</script>

<template>
  <div class="clash-page">
    <section class="clash-surface grid gap-4">
      <header class="clash-toolbar justify-between">
        <h2 class="clash-heading">路由规则</h2>
        <md-text-button :disabled="!client.kernelReady || loading || client.operationBusy" @click="refresh">刷新列表</md-text-button>
      </header>
      <div class="clash-toolbar">
        <md-filter-chip :selected="tab === 'rules'" :label="`规则 ${rules.length}`" @click.prevent="tab = 'rules'"></md-filter-chip>
        <md-filter-chip :selected="tab === 'providers'" :label="`规则集 ${Object.keys(providers).length}`" @click.prevent="tab = 'providers'"></md-filter-chip>
        <md-outlined-text-field label="搜索规则、规则集或目标策略" :value="search"
          @input="search = ($event.currentTarget as HTMLInputElement).value"></md-outlined-text-field>
      </div>
      <md-linear-progress v-if="loading" indeterminate aria-label="正在读取规则"></md-linear-progress>
      <p v-if="tab === 'rules' ? failure : providerFailure" role="alert" class="clash-error text-sm">{{ tab === 'rules' ? failure : providerFailure }}</p>
      <p v-else-if="message && tab === 'providers'" role="status" class="clash-muted text-sm">{{ message }}</p>
    </section>
    <section v-if="!client.kernelReady" class="clash-surface clash-empty">等待内核就绪</section>
    <section v-else-if="tab === 'rules'" class="clash-surface">
      <div v-if="!rows.length" class="clash-empty">{{ loading ? '正在读取规则…' : '当前筛选没有匹配的规则' }}</div>
      <div v-else class="clash-table-scroll">
        <table class="clash-table rules-table">
          <thead><tr><th>序号</th><th>匹配项</th><th>目标策略</th><th class="wide-rule">命中</th></tr></thead>
          <tbody>
            <tr v-for="{ rule, index } in rows" :key="index">
              <td>{{ index }}</td>
              <td><p class="font-semibold">{{ rule.payload || '默认匹配' }}</p><p class="clash-muted text-xs">{{ rule.type }}<span v-if="rule.extra?.disabled"> · 已停用</span></p></td>
              <td><span class="clash-pill" :data-level="rule.proxy?.startsWith('REJECT') ? 'error' : undefined">{{ rule.proxy || '—' }}</span></td>
              <td class="wide-rule">{{ rule.extra?.hitCount ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="rows.length" class="clash-toolbar justify-end text-sm">
        <span class="clash-muted">{{ filteredRules.length }} 条 · {{ page }} / {{ pages }}</span>
        <md-text-button :disabled="page <= 1" @click="page--">上一页</md-text-button>
        <md-text-button :disabled="page >= pages" @click="page++">下一页</md-text-button>
      </div>
    </section>
    <section v-else class="grid md:grid-cols-2 gap-3 min-w-0">
      <div v-if="!filteredProviders.length" class="clash-surface clash-empty md:col-span-2">{{ loading ? '正在读取规则集…' : '当前筛选没有匹配的规则集' }}</div>
      <article v-for="[name, provider] in filteredProviders" :key="name" class="clash-surface grid gap-3">
        <div class="clash-toolbar justify-between">
          <h3 class="font-bold break-all">{{ name }}</h3>
          <span class="clash-pill">{{ provider.ruleCount ?? '—' }} 条</span>
        </div>
        <p class="clash-muted text-sm">{{ [provider.behavior, provider.format, provider.vehicleType].filter(Boolean).join(' · ') }}</p>
        <div class="clash-toolbar justify-between">
          <span v-if="provider.updatedAt" class="clash-muted text-xs">{{ new Date(provider.updatedAt).toLocaleString() }}</span>
          <md-filled-tonal-button :disabled="client.operationBusy || provider.vehicleType?.toLowerCase() === 'inline'" @click="update(name)">更新规则集</md-filled-tonal-button>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.rules-table { table-layout: fixed; }
.rules-table th:first-child { width: 3rem; }
.rules-table th:nth-child(3) { width: 27%; }
.rules-table th:last-child { width: 4rem; }
@media (max-width: 560px) {
  .rules-table .wide-rule { display: none; }
}
</style>
