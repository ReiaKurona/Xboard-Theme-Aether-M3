<script setup lang="ts">
import { ref } from 'vue'
import { useClashStore } from '../../stores/clash'
import { clashApi } from '../../api/clash'
import '@material/web/button/filled-button.js'
import '@material/web/textfield/outlined-text-field.js'

const clashStore = useClashStore()
const isSaving = ref(false)

// 后端配置状态
const inputEndpoint = ref(clashStore.endpoint)
const inputSecret = ref(clashStore.secret)

// 诊断工具状态
const dnsDomain = ref('www.google.com')
const dnsType = ref('A')
const dnsResult = ref('')

const handleSaveBackend = async () => {
  isSaving.value = true
  try {
    const ok = await clashStore.saveConnectionSettings(inputEndpoint.value, inputSecret.value)
    if (ok) alert('连接成功！配置已更新。')
    else alert('无法连接到该后端端点。')
  } finally {
    isSaving.value = false
  }
}

const runOp = async (name: string, apiFunc: () => Promise<any>) => {
  try {
    await apiFunc()
    alert(`${name} 成功执行`)
  } catch (err: any) {
    alert(`${name} 失败: ` + err.message)
  }
}

const testDNS = async () => {
  if (!dnsDomain.value.trim()) return
  dnsResult.value = '查询中...'
  try {
    const res = await clashApi.queryDNSAPI(dnsDomain.value.trim(), dnsType.value)
    dnsResult.value = JSON.stringify(res.data, null, 2)
  } catch (err: any) {
    dnsResult.value = `查询失败: ${err.message}`
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 w-full select-none text-sm">
    
    <!-- 1. 当前后端 -->
    <div class="flex flex-col gap-3">
      <span class="text-[11px] font-bold opacity-60">当前后端</span>
      <div class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-4 border border-black/5 dark:border-transparent shadow-sm">
        
        <div class="flex items-center gap-2 pb-3 border-b border-[var(--md-sys-color-outline-variant)]/10">
          <span class="w-2.5 h-2.5 rounded-full" :class="clashStore.isConnected ? 'bg-emerald-500' : 'bg-red-500'"></span>
          <span class="font-mono font-bold">{{ inputEndpoint.replace(/^https?:\/\//, '') }}</span>
          <span class="ml-auto text-[10px] opacity-40 font-mono">v{{ clashStore.coreVersion }}</span>
        </div>

        <md-outlined-text-field label="后端完整地址" :value="inputEndpoint" @input="(e: any) => inputEndpoint = e.target.value" class="w-full font-mono"></md-outlined-text-field>
        <md-outlined-text-field label="访问密钥 Secret" type="password" :value="inputSecret" @input="(e: any) => inputSecret = e.target.value" class="w-full font-mono"></md-outlined-text-field>
        
        <md-filled-button @click="handleSaveBackend" :disabled="isSaving" class="self-end mt-1">
          {{ isSaving ? '连接探测中...' : '保存并重连' }}
        </md-filled-button>
      </div>
    </div>

    <!-- 2. 网络监听端口 -->
    <div class="flex flex-col gap-3">
      <span class="text-[11px] font-bold opacity-60">网络监听与 Tun 模式</span>
      <div class="p-5 rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent flex flex-col gap-5 shadow-sm font-mono text-xs">
        
        <div class="grid grid-cols-5 gap-2">
          <div class="flex flex-col gap-1"><span class="opacity-60 text-[9px]">Mixed 端口</span><span class="font-bold p-2 bg-black/10 dark:bg-white/5 rounded-lg text-center">{{ clashStore.config?.['mixed-port'] || 0 }}</span></div>
          <div class="flex flex-col gap-1"><span class="opacity-60 text-[9px]">HTTP 端口</span><span class="font-bold p-2 bg-black/10 dark:bg-white/5 rounded-lg text-center">{{ clashStore.config?.port || 0 }}</span></div>
          <div class="flex flex-col gap-1"><span class="opacity-60 text-[9px]">Socks 端口</span><span class="font-bold p-2 bg-black/10 dark:bg-white/5 rounded-lg text-center">{{ clashStore.config?.['socks-port'] || 0 }}</span></div>
          <div class="flex flex-col gap-1"><span class="opacity-60 text-[9px]">Redir 端口</span><span class="font-bold p-2 bg-black/10 dark:bg-white/5 rounded-lg text-center">{{ clashStore.config?.['redir-port'] || 0 }}</span></div>
          <div class="flex flex-col gap-1"><span class="opacity-60 text-[9px]">TProxy 端口</span><span class="font-bold p-2 bg-black/10 dark:bg-white/5 rounded-lg text-center">{{ clashStore.config?.['tproxy-port'] || 0 }}</span></div>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-[var(--md-sys-color-outline-variant)]/10">
          <span>允许局域网连接 (Allow LAN)</span>
          <span class="font-bold" :class="clashStore.config?.allowLan ? 'text-emerald-500' : 'opacity-40'">
            {{ clashStore.config?.allowLan ? '已开启' : '关闭' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 3. 内核运维操作 -->
    <div class="flex flex-col gap-3">
      <span class="text-[11px] font-bold opacity-60">内核高级运维</span>
      <div class="flex flex-col p-2 rounded-2xl bg-[var(--md-sys-color-surface-container)] shadow-sm">
        <button @click="runOp('升级核心', () => clashApi.upgradeCoreAPI())" class="flex items-center justify-between p-3.5 hover:bg-[var(--md-sys-color-surface-container-high)] rounded-xl transition-colors">
          <span>检查并升级核心</span>
          <span class="material-symbols-outlined text-sm opacity-40">update</span>
        </button>
        <button @click="runOp('重启核心', () => clashApi.restartCoreAPI())" class="flex items-center justify-between p-3.5 hover:bg-[var(--md-sys-color-surface-container-high)] rounded-xl transition-colors">
          <span>冷启动重启核心</span>
          <span class="material-symbols-outlined text-sm opacity-40">restart_alt</span>
        </button>
        <button @click="runOp('重载配置', () => clashApi.reloadConfigsAPI())" class="flex items-center justify-between p-3.5 hover:bg-[var(--md-sys-color-surface-container-high)] rounded-xl transition-colors">
          <span>热重载 YML 配置</span>
          <span class="material-symbols-outlined text-sm opacity-40">sync</span>
        </button>
        <button @click="runOp('清空 DNS 缓存', () => clashApi.flushDNSCacheAPI())" class="flex items-center justify-between p-3.5 hover:bg-[var(--md-sys-color-surface-container-high)] rounded-xl transition-colors text-red-500">
          <span>强制清空 DNS 缓存</span>
          <span class="material-symbols-outlined text-sm">delete</span>
        </button>
        <button @click="runOp('清空 Fake IP', () => clashApi.flushFakeIPAPI())" class="flex items-center justify-between p-3.5 hover:bg-[var(--md-sys-color-surface-container-high)] rounded-xl transition-colors text-red-500">
          <span>强制清空 Fake IP 池</span>
          <span class="material-symbols-outlined text-sm">delete</span>
        </button>
      </div>
    </div>

    <!-- 4. 诊断工具 (DNS 查询) -->
    <div class="flex flex-col gap-3 mb-6">
      <span class="text-[11px] font-bold opacity-60">内核网络诊断</span>
      <div class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-3 shadow-sm">
        <div class="flex gap-2 items-center">
          <md-outlined-text-field label="DNS 解析测线域名" :value="dnsDomain" @input="(e: any) => dnsDomain = e.target.value" class="flex-1 font-mono"></md-outlined-text-field>
          <select v-model="dnsType" class="h-14 px-3 rounded-[12px] bg-[var(--md-sys-color-surface-container-high)] outline-none border border-[var(--md-sys-color-outline)] font-bold cursor-pointer">
            <option value="A">A 记录</option>
            <option value="AAAA">AAAA 记录</option>
          </select>
          <md-filled-button @click="testDNS" class="h-14">查询</md-filled-button>
        </div>
        <pre v-if="dnsResult" class="p-3 bg-black/20 rounded-xl text-[10px] font-mono whitespace-pre-wrap break-all opacity-80">{{ dnsResult }}</pre>
      </div>
    </div>

  </div>
</template>