<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClashStore } from '../../stores/clash'
import { clashApi } from '../../api/clash'
import ClashSelect from '../../components/clash/ClashSelect.vue'
import ClashSettingSwitch from '../../components/clash/ClashSettingSwitch.vue'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/chips/filter-chip.js'
import '@material/web/textfield/outlined-text-field.js'

const client = useClashStore()
const activeTab = ref<'all' | 'selector' | 'provider'>('all'), search = ref(''), error = ref('')
const collapsed = ref<Record<string, boolean>>({})
const testing = ref<Record<string, boolean>>({})
const groupTesting = ref('')
const preferences = ref<(HTMLElement & { show(): Promise<void>; close(): Promise<void> }) | null>(null)
const sort = ref(localStorage.getItem('clash_proxy_sort') || 'default')
const hideUnavailable = ref(localStorage.getItem('clash_hide_unavailable') === 'true')
const cardWidth = ref(Math.max(100, Math.min(300, Number(localStorage.getItem('clash_card_min_width')) || 145)))
const draft = ref({ sort: sort.value, hide: hideUnavailable.value, width: String(cardWidth.value) })
const sorts = [
  { value: 'default', label: '订阅原始顺序' }, { value: 'name_asc', label: '名称升序' }, { value: 'name_desc', label: '名称降序' },
  { value: 'latency_asc', label: '延迟升序' }, { value: 'latency_desc', label: '延迟降序' },
]
const stats = computed(() => {
  const groups = client.orderedGroups
  const selectors = groups.filter(([, group]) => group.type === 'Selector').length
  return { all: groups.length, selector: selectors, provider: groups.length - selectors }
})
const tabs = [{ value: 'all', label: '全部' }, { value: 'selector', label: '策略组' }, { value: 'provider', label: '其他组' }] as const
function delay(node: string): number | undefined {
  return client.nodeDelays[node] ?? client.proxies[node]?.history?.at(-1)?.delay
}
const displayGroups = computed(() => {
  const query = search.value.trim().toLowerCase()
  return client.orderedGroups
    .filter(([, group]) => activeTab.value === 'all' || (activeTab.value === 'selector') === (group.type === 'Selector'))
    .map(([name, group]) => {
      const matchesGroup = name.toLowerCase().includes(query)
      const nodes = (group.all as string[]).filter(node => (matchesGroup || node.toLowerCase().includes(query)) &&
        (!hideUnavailable.value || delay(node) !== 0))
      if (sort.value === 'name_asc') nodes.sort((a, b) => a.localeCompare(b))
      if (sort.value === 'name_desc') nodes.sort((a, b) => b.localeCompare(a))
      if (sort.value === 'latency_asc' || sort.value === 'latency_desc') {
        const ascending = sort.value === 'latency_asc'
        nodes.sort((a, b) => {
          const da = delay(a) || 0, db = delay(b) || 0
          if (!da || !db) return Number(!da) - Number(!db)
          return ascending ? da - db : db - da
        })
      }
      return { name, group, nodes, matchesGroup }
    }).filter(group => group.matchesGroup || group.nodes.length)
})
function showPreferences() {
  draft.value = { sort: sort.value, hide: hideUnavailable.value, width: String(cardWidth.value) }
  void preferences.value?.show()
}
function savePreferences() {
  sort.value = draft.value.sort
  hideUnavailable.value = draft.value.hide
  cardWidth.value = Math.max(100, Math.min(300, Number(draft.value.width) || 145))
  localStorage.setItem('clash_proxy_sort', sort.value)
  localStorage.setItem('clash_hide_unavailable', String(hideUnavailable.value))
  localStorage.setItem('clash_card_min_width', String(cardWidth.value))
  void preferences.value?.close()
}
async function selectNode(group: string, node: string) {
  error.value = ''
  try { await client.selectNode(group, node) }
  catch (cause) { error.value = (cause as Error).message }
}
async function testGroup(name: string) {
  if (groupTesting.value) return
  groupTesting.value = name; error.value = ''
  try {
    const { data } = await client.runMutation(() => clashApi.fetchProxyGroupLatencyAPI(name))
    for (const [node, value] of Object.entries(data || {})) {
      if (typeof value === 'number') client.nodeDelays[node] = value
    }
  } catch (cause) { error.value = (cause as Error).message }
  finally { groupTesting.value = '' }
}
async function testNode(name: string) {
  if (testing.value[name]) return
  testing.value[name] = true
  try { await client.testNodeDelay(name) }
  finally { testing.value[name] = false }
}
</script>

<template>
  <div class="clash-page">
    <section class="clash-surface grid gap-4">
      <header class="clash-toolbar justify-between">
        <h2 class="clash-heading">代理节点</h2>
        <md-text-button @click="showPreferences">显示设置</md-text-button>
      </header>
      <div class="clash-toolbar">
        <md-filter-chip v-for="tab in tabs" :key="tab.value" :selected="activeTab === tab.value"
          :label="`${tab.label} ${stats[tab.value]}`" @click.prevent="activeTab = tab.value"></md-filter-chip>
        <md-outlined-text-field label="搜索代理组或节点" :value="search"
          @input="search = ($event.currentTarget as HTMLInputElement).value"></md-outlined-text-field>
      </div>
      <p v-if="error" role="alert" class="clash-error text-sm">{{ error }}</p>
    </section>

    <section v-if="!displayGroups.length" class="clash-surface clash-empty">
      {{ !client.kernelReady ? '等待内核就绪' : client.status?.settings.outbound_mode === 'direct' ? '直连模式下隐藏节点组' : '当前筛选没有匹配的代理组' }}
    </section>
    <section v-for="{ name, group, nodes } in displayGroups" :key="name" class="clash-surface grid gap-4" data-clash-proxy-group>
      <header class="clash-toolbar justify-between">
        <div class="min-w-0">
          <h3 class="clash-heading break-words">{{ name }}</h3>
          <p class="clash-muted mt-1 text-sm break-words">{{ group.type }} · {{ nodes.length }} 个节点<span v-if="group.now"> · 当前使用 {{ group.now }}</span></p>
        </div>
        <div class="clash-toolbar">
          <md-filled-tonal-button :disabled="!!groupTesting || client.operationBusy || !client.kernelReady" @click="testGroup(name)">
            {{ groupTesting === name ? '测速中' : '测试本组' }}
          </md-filled-tonal-button>
          <md-text-button :aria-expanded="!collapsed[name]" @click="collapsed[name] = !collapsed[name]">
            {{ collapsed[name] ? '展开' : '收起' }}
          </md-text-button>
        </div>
      </header>
      <div v-show="!collapsed[name]" class="grid gap-2 min-w-0"
        :style="{ gridTemplateColumns: `repeat(auto-fill,minmax(min(100%,${cardWidth}px),1fr))` }">
        <article v-for="node in nodes" :key="node" class="proxy-node" :data-active="group.now === node">
          <button class="proxy-name" :title="node" :disabled="!client.kernelReady || client.operationBusy || group.now === node"
            :aria-pressed="group.now === node" @click="selectNode(name, node)">{{ node }}</button>
          <div class="flex flex-wrap items-center justify-between gap-1 text-xs">
            <span>{{ client.proxies[node]?.type || '—' }}</span>
            <md-text-button :disabled="testing[node] || !client.kernelReady" :aria-label="`测试 ${node} 的延迟`" @click="testNode(node)">
              {{ testing[node] ? '测速中' : delay(node) ? `${delay(node)} ms` : delay(node) === 0 ? '超时 · 重测' : '测速' }}
            </md-text-button>
          </div>
        </article>
      </div>
    </section>

    <md-dialog ref="preferences">
      <span slot="headline">节点显示设置</span>
      <div slot="content" class="grid gap-3">
        <ClashSelect label="节点顺序" :options="sorts" v-model="draft.sort" />
        <ClashSettingSwitch label="隐藏已测速失败的节点" :selected="draft.hide" @change="draft.hide = $event" />
        <md-outlined-text-field label="卡片最小宽度（像素）" type="number" min="100" max="300" :value="draft.width"
          @input="draft.width = ($event.currentTarget as HTMLInputElement).value"></md-outlined-text-field>
      </div>
      <div slot="actions"><md-text-button @click="preferences?.close()">取消</md-text-button><md-filled-button @click="savePreferences">保存</md-filled-button></div>
    </md-dialog>
  </div>
</template>

<style scoped>
.proxy-node { padding: .75rem; min-width: 0; border-radius: 18px; background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface); }
.proxy-node[data-active="true"] { background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
.proxy-node md-text-button { --md-text-button-container-height: 32px; }
.proxy-name { width: 100%; display: block; text-align: start; font-weight: 700; overflow-wrap: anywhere; }
.proxy-name:not(:disabled):hover { text-decoration: underline; }
</style>
