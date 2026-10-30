<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '../../stores/user'
import { useConfigStore } from '../../stores/config'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'

const userStore = useUserStore()
const configStore = useConfigStore()
const isQrModalOpen = ref(false)
const copied = ref(false)

const subscribeUrl = computed(() => userStore.subscribeInfo?.subscribe_url || '')
const siteTitle = computed(() => configStore.siteTitle || 'Xboard')

// 复制纯链接
const copyUrl = async () => {
  if (!subscribeUrl.value) return
  await navigator.clipboard.writeText(subscribeUrl.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

// 🌟 覆盖全主流现代客户端 Scheme 协议拉起
const importClient = (client: string) => {
  const url = subscribeUrl.value
  if (!url) return
  const title = encodeURIComponent(siteTitle.value)
  const encodedUrl = encodeURIComponent(url)
  let targetLink = ''

  switch (client) {
    // 兼容 Mihomo Party / Clash Verge Rev / FlClash / ClashMi / Clash Nyanpasu
    case 'clash':
      targetLink = `clash://install-config?url=${encodedUrl}&name=${title}`
      break
    case 'shadowrocket':
      targetLink = `shadowrocket://add/sub://${btoa(url)}?title=${title}`
      break
    case 'singbox':
      targetLink = `sing-box://import-remote-profile?url=${encodedUrl}#${title}`
      break
    case 'surge':
      targetLink = `surge:///install-config?url=${encodedUrl}`
      break
    case 'quantumultx':
      targetLink = `quantumult-x:///add-resource?remote-resource=${encodeURIComponent(JSON.stringify({ server_remote: [`${url}, tag=${siteTitle.value}`] }))}`
      break
    case 'surfboard':
      targetLink = `surfboard:///install-config?url=${encodedUrl}`
      break
  }

  if (targetLink) {
    window.location.href = targetLink
  }
}

// 客户端列表配置 (图 3 专属胶囊色系)
const clientList = [
  { id: 'copy', label: '复制', icon: 'content_copy', bg: 'bg-emerald-600 hover:bg-emerald-500 text-white', action: copyUrl },
  { id: 'qr', label: '二维码', icon: 'qr_code', bg: 'bg-cyan-600 hover:bg-cyan-500 text-white', action: () => (isQrModalOpen.value = true) },
  { id: 'clash', label: 'Mihomo / Clash', icon: 'pets', bg: 'bg-slate-700 hover:bg-slate-600 text-white', desc: '支持 FlClash / Verge / Party', action: () => importClient('clash') },
  { id: 'shadowrocket', label: 'Shadowrocket', icon: 'rocket_launch', bg: 'bg-blue-700 hover:bg-blue-600 text-white', desc: '小火箭一键导入', action: () => importClient('shadowrocket') },
  { id: 'singbox', label: 'Sing-box', icon: 'deployed_code', bg: 'bg-amber-600 hover:bg-amber-500 text-white', desc: '通用配置一键拉取', action: () => importClient('singbox') },
  { id: 'surge', label: 'Surge 订阅', icon: 'graphic_eq', bg: 'bg-indigo-700 hover:bg-indigo-600 text-white', action: () => importClient('surge') },
  { id: 'quantumultx', label: 'Quantumult X', icon: 'all_inclusive', bg: 'bg-purple-800 hover:bg-purple-700 text-white', action: () => importClient('quantumultx') },
  { id: 'surfboard', label: 'Surfboard', icon: 'surfing', bg: 'bg-orange-800 hover:bg-orange-700 text-white', action: () => importClient('surfboard') }
]
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="h-full p-6 sm:p-7 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm flex flex-col justify-between select-none">
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-bold uppercase tracking-wider text-[var(--md-sys-color-primary)]">客户端配置</span>
        <span class="text-[10px] opacity-40">自动写入现代代理内核</span>
      </div>
      <h3 class="text-xl font-extrabold mt-0.5 mb-2">快速接入节点</h3>
      <p class="text-xs opacity-60 mb-5 leading-normal">
        点击下方对应客户端胶囊即可唤起软件并自动配置，或直接扫码跨设备导入。
      </p>

      <!-- 🌟 对齐图 3：现代多客户端快捷胶囊阵列 -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <button
          v-for="c in clientList"
          :key="c.id"
          @click="c.action"
          class="py-2.5 px-3 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          :class="c.bg"
        >
          <span class="material-symbols-outlined text-sm shrink-0">{{ c.icon }}</span>
          <span class="truncate">{{ c.id === 'copy' && copied ? '已复制' : c.label }}</span>
        </button>
      </div>
    </div>

    <!-- 底部状态概览 (去除白线) -->
    <div class="pt-4 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-xs opacity-60">
      <span>测速节点数：{{ userStore.subscribeInfo?.plan?.transfer_enable ? '正常连通' : '维护中' }}</span>
      <span>设备限制：{{ userStore.subscribeInfo?.device_limit || '不限' }} 台</span>
    </div>

    <!-- 🌟 原生 MD3 扫码订阅二维码弹窗 -->
    <md-dialog :open="isQrModalOpen" @closed="isQrModalOpen = false" class="md3-qr-dialog max-w-sm w-full">
      <div slot="headline" class="font-black text-lg flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
        <span class="material-symbols-outlined text-cyan-500">qr_code_2</span>
        扫码快速导入
      </div>
      <div slot="content" class="flex flex-col items-center justify-center py-3 gap-3 text-xs text-[var(--md-sys-color-on-surface)]">
        <div class="p-4 rounded-3xl bg-white shadow-md">
          <img
            :src="`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(subscribeUrl)}&size=200x200`"
            class="w-48 h-48 object-contain"
            alt="订阅二维码"
          />
        </div>
        <p class="opacity-60 text-center max-w-xs">
          请在手机端打开小火箭或相关代理客户端，选择“扫码添加”即可快速拉取节点。
        </p>
      </div>
      <div slot="actions">
        <md-text-button @click="isQrModalOpen = false">完成</md-text-button>
        <md-filled-button @click="copyUrl">
          <span class="material-symbols-outlined text-sm" slot="icon">content_copy</span>
          {{ copied ? '已复制' : '复制链接' }}
        </md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<style scoped>
.md3-qr-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>