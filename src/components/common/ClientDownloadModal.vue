<script setup lang="ts">
import { ref } from 'vue'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'

defineProps<{
  open: boolean
}>()

const emit = defineEmits(['close'])

const activePlatform = ref<'windows' | 'mac' | 'android' | 'ios'>('windows')

const clientsData = {
  windows: [
    { name: 'Clash Verge Rev', desc: '现代内核，原生支持 Meta / Mihomo，界面极其优雅', url: 'https://github.com/clash-verge-rev/clash-verge-rev/releases', badge: '推荐' },
    { name: 'Mihomo Party', desc: '新一代全功能 Mihomo 客户端，轻量极致体验', url: 'https://github.com/mihomo-party-org/mihomo-party/releases', badge: '最新' },
    { name: 'FlClash', desc: '基于 Flutter 的跨平台高颜值现代客户端', url: 'https://github.com/chen08209/FlClash/releases' }
  ],
  mac: [
    { name: 'Clash Verge Rev (macOS)', desc: '完美适配 Apple Silicon M 系列与 Intel 芯片', url: 'https://github.com/clash-verge-rev/clash-verge-rev/releases', badge: '推荐' },
    { name: 'Surge Mac', desc: 'macOS 顶级网络调试与分流利器', url: 'https://nssurge.com/' }
  ],
  android: [
    { name: 'FlClash Android', desc: 'Material Design 3 风格客户端，极度丝滑', url: 'https://github.com/chen08209/FlClash/releases', badge: '推荐' },
    { name: 'Sing-box Android', desc: '通用通用内核官方客户端，内存占用极低', url: 'https://github.com/SagerNet/sing-box/releases' },
    { name: 'Surfboard', desc: '冲浪板，经典的 Android 代理客户端', url: 'https://getsurfboard.com/' }
  ],
  ios: [
    { name: 'Shadowrocket (小火箭)', desc: 'iOS 首选代理客户端，需境外 Apple ID 下载', url: 'https://apps.apple.com/app/shadowrocket/id932747118', badge: '必选' },
    { name: 'Sing-box iOS', desc: 'App Store 官方免费下载，无需购买美区账号', url: 'https://apps.apple.com/app/sing-box/id6451272673', badge: '免费' },
    { name: 'Quantumult X', desc: '功能强大的专业网络调试工具', url: 'https://apps.apple.com/app/quantumult-x/id1453926390' }
  ]
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <md-dialog :open="open" @closed="emit('close')" class="md3-client-dialog max-w-xl w-full">
    <div slot="headline" class="font-black text-xl tracking-tight flex items-center gap-2.5 text-[var(--md-sys-color-on-surface)]">
      <div class="w-9 h-9 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center shadow-sm">
        <span class="material-symbols-outlined text-xl">download</span>
      </div>
      <span>客户端分发与下载中心</span>
    </div>

    <div slot="content" class="flex flex-col gap-4 py-1 text-xs text-[var(--md-sys-color-on-surface)]">
      <!-- 平台切换分段器 -->
      <div class="flex p-1 rounded-full bg-[var(--md-sys-color-surface-container)] select-none">
        <button
          v-for="p in [
            { id: 'windows', label: 'Windows', icon: 'desktop_windows' },
            { id: 'mac', label: 'macOS', icon: 'laptop_mac' },
            { id: 'android', label: 'Android', icon: 'phone_android' },
            { id: 'ios', label: 'iOS', icon: 'phone_iphone' }
          ]"
          :key="p.id"
          @click="activePlatform = p.id as any"
          class="flex-1 py-1.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
          :class="activePlatform === p.id ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm' : 'opacity-65 hover:opacity-100'"
        >
          <span class="material-symbols-outlined text-sm">{{ p.icon }}</span>
          <span>{{ p.label }}</span>
        </button>
      </div>

      <!-- 客户端项目列表 -->
      <div class="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
        <div
          v-for="c in clientsData[activePlatform]"
          :key="c.name"
          class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex items-center justify-between gap-3 shadow-sm hover:shadow transition-all"
        >
          <div class="flex flex-col truncate mr-2">
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm text-[var(--md-sys-color-on-surface)] truncate">{{ c.name }}</span>
              <span v-if="c.badge" class="px-2 py-0.2 rounded-full text-[9px] font-bold bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
                {{ c.badge }}
              </span>
            </div>
            <span class="text-[11px] opacity-60 mt-0.5 leading-normal">{{ c.desc }}</span>
          </div>

          <a
            :href="c.url"
            target="_blank"
            class="px-3.5 py-1.5 rounded-full text-xs font-bold text-[var(--md-sys-color-on-primary)] bg-[var(--md-sys-color-primary)] hover:opacity-90 active:scale-95 transition-all shrink-0 flex items-center gap-1 shadow-sm"
          >
            <span>下载</span>
            <span class="material-symbols-outlined text-xs">open_in_new</span>
          </a>
        </div>
      </div>
    </div>

    <div slot="actions">
      <md-filled-button @click="emit('close')">完成</md-filled-button>
    </div>
  </md-dialog>
</template>

<style scoped>
.md3-client-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>