<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'

const props = defineProps<{
  streamUrl: string
  videoName: string
}>()

const emit = defineEmits(['pauseVideo'])

const isModalOpen = ref(false)
const currentStep = ref<'confirm' | 'result'>('confirm')
const selectedPlayer = ref<'potplayer' | 'vlc' | 'mpv' | 'generic'>('potplayer')
const countdown = ref(3)
const isCopied = ref(false)
let timer: any = null

const players = [
  { id: 'potplayer', name: 'PotPlayer', desc: 'Windows 首选播放器 (快捷键 Ctrl+U)', icon: 'play_circle' },
  { id: 'vlc', name: 'VLC Media Player', desc: '跨平台全能播放器 (快捷键 Ctrl+N)', icon: 'traffic' },
  { id: 'mpv', name: 'MPV Player', desc: '极客轻量级播放器 (支持拖拽/命令行)', icon: 'terminal' },
  { id: 'generic', name: '通用网络串流', desc: '直接复制 E2EE 解密直链至任何播放器', icon: 'link' }
]

const getFullStreamUrl = () => {
  if (props.streamUrl.startsWith('http')) return props.streamUrl
  return `${window.location.origin}${props.streamUrl}`
}

// 复制流地址
const copyStreamUrl = async () => {
  try {
    await navigator.clipboard.writeText(getFullStreamUrl())
    isCopied.value = true
    setTimeout(() => (isCopied.value = false), 2000)
  } catch {}
}

// 🌟 终极兜底：生成单次 .m3u 文件下载 (双击 100% 唤起本地默认播放器，彻底解决没有关联协议的电脑)
const downloadM3uFile = () => {
  const fullUrl = getFullStreamUrl()
  const cleanName = props.videoName.replace(/\.[^/.]+$/, '')
  const content = `#EXTM3U\n#EXTINF:-1,${props.videoName}\n${fullUrl}\n`
  const blob = new Blob([content], { type: 'audio/x-mpegurl;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${cleanName}.m3u`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// 🌟 核心：用户真实点击手势触发唤起 (100% 绕过浏览器的静默拦截，唤出授权弹窗)
const handleExecuteLaunch = async () => {
  clearInterval(timer)
  const fullUrl = getFullStreamUrl()

  // 1. 先把解密流链接强制写入剪贴板（兜底保障）
  try {
    await navigator.clipboard.writeText(fullUrl)
    isCopied.value = true
  } catch {}

  // 2. 网页端播放器自动暂停，但绝不关闭，SW 继续在后台维持流供应
  emit('pauseVideo')

  // 3. 构建协议 URL
  let protocolUrl = ''
  if (selectedPlayer.value === 'potplayer') {
    protocolUrl = `potplayer://${fullUrl}`
  } else if (selectedPlayer.value === 'vlc') {
    protocolUrl = `vlc://${fullUrl}`
  } else if (selectedPlayer.value === 'mpv') {
    protocolUrl = `mpv://${fullUrl}`
  }

  // 4. 发起真实手势唤起 (若已关联播放器，浏览器此时必定弹出确认窗)
  if (protocolUrl) {
    const a = document.createElement('a')
    a.href = protocolUrl
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => a.remove(), 1000)
  }

  // 5. 切换到兜底指引页
  currentStep.value = 'result'
}

// 开启外链弹窗
const openDialog = () => {
  clearInterval(timer)
  countdown.value = 3
  currentStep.value = 'confirm'
  isCopied.value = false
  isModalOpen.value = true

  // 启动 3 秒提示倒计时
  timer = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
    } else {
      clearInterval(timer)
    }
  }, 1000)
}

const handleClose = () => {
  clearInterval(timer)
  isModalOpen.value = false
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

defineExpose({ openDialog })
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div>
    <!-- PC 端顶栏外链播放按键 -->
    <button
      type="button"
      @click="openDialog"
      class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
      title="使用本地 PotPlayer / VLC / MPV 等软件串流播放"
    >
      <span class="material-symbols-outlined text-sm text-cyan-400">desktop_windows</span>
      <span>外链播放</span>
    </button>

    <!-- 🌟 MD3 外链播放核心决策与兜底弹窗 -->
    <md-dialog :open="isModalOpen" @closed="handleClose" class="md3-launcher-dialog max-w-lg w-full">
      <!-- 弹窗标题 -->
      <div slot="headline" class="font-black text-xl flex items-center gap-2 text-cyan-400">
        <span class="material-symbols-outlined text-2xl">sensors</span>
        <span>外部播放器串流</span>
      </div>

      <!-- 步骤 1：先弹窗明确警告提示与选择播放器 -->
      <div v-if="currentStep === 'confirm'" slot="content" class="flex flex-col gap-4 py-2 text-xs leading-relaxed text-[var(--md-sys-color-on-surface)]">
        <!-- 🌟 核心重要提示 (先展示警告) -->
        <div class="p-3.5 rounded-2xl bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 leading-normal flex items-start gap-2.5">
          <span class="material-symbols-outlined text-xl shrink-0 mt-0.5">warning</span>
          <span>外部播放期间请勿关闭或最小化浏览器或切换到其他标签页，您只需保持您对应播放器放在浏览器前面即可。</span>
        </div>

        <p class="opacity-70">
          系统将自动生成一次性虚拟 E2EE 解密直链，请选择您安装的本地播放器：
        </p>

        <!-- 播放器选择清单 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            v-for="p in players"
            :key="p.id"
            @click="selectedPlayer = p.id as any"
            class="p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between border"
            :class="selectedPlayer === p.id
              ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-transparent shadow-sm font-bold'
              : 'bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] border-black/5 dark:border-transparent opacity-80'"
          >
            <div class="flex items-center gap-2.5 truncate">
              <span class="material-symbols-outlined text-lg">{{ p.icon }}</span>
              <div class="flex flex-col truncate">
                <span class="text-xs truncate">{{ p.name }}</span>
                <span class="text-[10px] opacity-60 font-normal truncate">{{ p.desc.split('(')[0] }}</span>
              </div>
            </div>
            <span v-if="selectedPlayer === p.id" class="material-symbols-outlined text-sm">check</span>
          </div>
        </div>
      </div>

      <!-- 步骤 2：尝试打开后的兜底结果与直接操作指导 (解决没有关联协议的问题) -->
      <div v-else slot="content" class="flex flex-col gap-4 py-2 text-xs leading-relaxed text-[var(--md-sys-color-on-surface)]">
        <div class="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex flex-col gap-1">
          <div class="flex items-center gap-2 font-black text-sm">
            <span class="material-symbols-outlined text-lg">check_circle</span>
            <span>已尝试唤醒播放器，并已同步复制串流直链！</span>
          </div>
          <p class="text-[11px] opacity-90 mt-1">
            如果浏览器弹出了授权窗口，请点击<b>「允许/打开」</b>；若系统未关联播放器或无响应，请按照下方方式播放：
          </p>
        </div>

        <!-- 串流直链展示卡 (带一键复制) -->
        <div class="flex flex-col gap-1.5 p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent">
          <div class="flex justify-between items-center text-[10px] opacity-60 font-mono">
            <span>E2EE 虚拟串流直链</span>
            <span v-if="isCopied" class="text-emerald-500 font-bold">✓ 链接已复制到剪贴板</span>
          </div>
          <div class="p-2 rounded-xl bg-black/20 font-mono text-[11px] break-all select-all text-cyan-400">
            {{ getFullStreamUrl() }}
          </div>
        </div>

        <!-- 播放器无关联时的两种终极解决方案 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <!-- 方案 A：快捷键直接粘贴 -->
          <div class="p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-1">
            <span class="font-bold text-[var(--md-sys-color-primary)]">方案一：快捷键粘贴播放</span>
            <span class="opacity-70 leading-normal">
              打开 PotPlayer 按 <kbd class="px-1.5 py-0.5 rounded bg-white/10 font-mono">Ctrl + U</kbd><br>
              或打开 VLC 按 <kbd class="px-1.5 py-0.5 rounded bg-white/10 font-mono">Ctrl + N</kbd>，直接粘贴回车即可！
            </span>
          </div>

          <!-- 方案 B：一键下载 .m3u 关联文件 -->
          <div class="p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col justify-between gap-2">
            <div>
              <span class="font-bold text-[var(--md-sys-color-primary)]">方案二：下载快捷文件</span>
              <p class="opacity-70 text-[10px] mt-0.5 leading-normal">下载 1KB 播放引导文件，双击直接用本地软件打开。</p>
            </div>
            <button
              type="button"
              @click="downloadM3uFile"
              class="w-full py-2 rounded-xl text-xs font-bold bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <span class="material-symbols-outlined text-sm">download</span>
              <span>下载 .m3u 文件双击播放</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 操作按钮区 -->
      <div slot="actions">
        <!-- 步骤 1 操作按键 -->
        <template v-if="currentStep === 'confirm'">
          <md-text-button @click="handleClose">取消</md-text-button>
          <md-filled-button @click="handleExecuteLaunch">
            <span class="material-symbols-outlined text-sm" slot="icon">launch</span>
            <span>确认启动并复制链接 {{ countdown > 0 ? `(${countdown}s)` : '' }}</span>
          </md-filled-button>
        </template>

        <!-- 步骤 2 操作按键 -->
        <template v-else>
          <md-filled-tonal-button @click="copyStreamUrl">
            <span class="material-symbols-outlined text-sm" slot="icon">content_copy</span>
            <span>再次复制链接</span>
          </md-filled-tonal-button>
          <md-filled-button @click="handleClose">完成</md-filled-button>
        </template>
      </div>
    </md-dialog>
  </div>
</template>

<style scoped>
.md3-launcher-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>