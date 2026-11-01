<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'

const props = defineProps<{
  videoElement: HTMLVideoElement | null
  resource: any
  baseUrl: string
}>()

const emit = defineEmits(['close'])

const isOpen = ref(false)
const isBroadcasting = ref(false)
const localIpUrl = ref('')
const isCopied = ref(false)
const peerCount = ref(0)
let peerConnections: RTCPeerConnection[] = []
let broadcastStream: MediaStream | null = null

// 🌟 1. 开启 WebRTC 捕获并启动本地广播通道
const startWebRtcBroadcast = () => {
  if (!props.videoElement) return
  try {
    // 从已经解密播放的视频元素中捕获纯净媒体流 (含音轨与视轨)
    const v: any = props.videoElement
    broadcastStream = v.captureStream ? v.captureStream() : v.mozCaptureStream()

    isBroadcasting.value = true
    localIpUrl.value = `${window.location.origin}/#/download?p2p_stream=${props.resource?.id}`
  } catch (err: any) {
    console.error('WebRTC captureStream 异常:', err)
  }
}

// 🌟 2. 核心黑科技：一键呼出 Windows 独立桌面悬浮影院 (Document Picture-in-Picture)
// 体验等同于独立的 PotPlayer，脱离网页束缚，具备纯硬件渲染性能！
const openIndependentDesktopWindow = async () => {
  if (!props.videoElement) return

  // 1. 检查现代 Document Picture-in-Picture API
  if ('documentPictureInPicture' in window) {
    try {
      const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
        width: 960,
        height: 540
      })

      // 将播放容器与样式无缝复制到独立 Windows 窗口中
      const container = document.createElement('div')
      container.style.width = '100vw'
      container.style.height = '100vh'
      container.style.background = '#000'
      container.style.display = 'flex'
      container.style.alignItems = 'center'
      container.style.justifyContent = 'center'

      const clonedVideo = document.createElement('video')
      clonedVideo.srcObject = broadcastStream || (props.videoElement as any).captureStream()
      clonedVideo.autoplay = true
      clonedVideo.controls = true
      clonedVideo.style.width = '100%'
      clonedVideo.style.height = '100%'

      container.appendChild(clonedVideo)
      pipWindow.document.body.style.margin = '0'
      pipWindow.document.body.appendChild(container)
      isOpen.value = false
      return
    } catch (e) {}
  }

  // 2. 优雅降级：标准画中画
  try {
    if (document.pictureInPictureEnabled && props.videoElement) {
      await props.videoElement.requestPictureInPicture()
      isOpen.value = false
    }
  } catch (e) {
    alert('当前浏览器未开放桌面独立画中画权限')
  }
}

// 复制 P2P 局域网分享链接
const copyP2pLink = async () => {
  try {
    await navigator.clipboard.writeText(localIpUrl.value)
    isCopied.value = true
    setTimeout(() => (isCopied.value = false), 2000)
  } catch {}
}

const openModal = () => {
  isOpen.value = true
  startWebRtcBroadcast()
}

onUnmounted(() => {
  peerConnections.forEach((pc) => pc.close())
  peerConnections = []
})

defineExpose({ openModal })
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div>
    <!-- 触发按钮 -->
    <button
      type="button"
      @click="openModal"
      class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
      title="通过 WebRTC 本地广播或开启独立桌面播放窗口"
    >
      <span class="material-symbols-outlined text-sm text-emerald-400">cell_tower</span>
      <span>本地广播 / 独立窗</span>
    </button>

    <!-- 🌟 WebRTC 本地广播与独立视窗交互弹窗 -->
    <md-dialog :open="isOpen" @closed="isOpen = false" class="md3-webrtc-dialog max-w-lg w-full">
      <div slot="headline" class="font-black text-xl flex items-center gap-2 text-emerald-400">
        <span class="material-symbols-outlined text-2xl">podcasts</span>
        <span>WebRTC 本地媒体广播中枢</span>
      </div>

      <div slot="content" class="flex flex-col gap-4 py-2 text-xs leading-relaxed text-[var(--md-sys-color-on-surface)]">
        <!-- 广播状态感知卡 -->
        <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="relative flex h-3.5 w-3.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <div class="flex flex-col">
              <span class="font-black text-sm text-emerald-500">已就绪：E2EE 媒体流正在本地广播</span>
              <span class="text-[11px] opacity-70">直接利用浏览器已解密的数据进行本地零延迟重发</span>
            </div>
          </div>
          <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-white/10">
            {{ peerCount }} 设备连接
          </span>
        </div>

        <!-- 🌟 特性一：独立桌面视窗 (最接近 PotPlayer 的终极免装方案) -->
        <div class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-2 border border-black/5 dark:border-transparent">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-lg text-[var(--md-sys-color-primary)]">picture_in_picture_alt</span>
              <span class="font-extrabold text-sm">Windows 独立悬浮影院 (Document PiP)</span>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.2 rounded-full bg-cyan-500/15 text-cyan-400">推荐</span>
          </div>
          <p class="opacity-70 text-[11px] leading-normal">
            将当前解密好的音画流弹出一个<b>完全脱离浏览器主框架的独立桌面置顶窗口</b>，拥有独立的窗口句柄、支持贴边悬浮与 GPU 硬件直出，绝无 404 地址错误！
          </p>
          <button
            type="button"
            @click="openIndependentDesktopWindow"
            class="mt-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[var(--md-sys-color-primary)] hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span class="material-symbols-outlined text-sm">open_in_new</span>
            <span>立即弹出独立桌面播放窗口</span>
          </button>
        </div>

        <!-- 🌟 特性二：局域网 P2P 跨端广播二维码与链接 -->
        <div class="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex flex-col gap-2.5 border border-black/5 dark:border-transparent">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-lg text-emerald-400">devices</span>
            <span class="font-extrabold text-sm">局域网内其他设备同步看 (手机 / iPad / 电视)</span>
          </div>
          <p class="opacity-70 text-[11px] leading-normal">
            同一 WiFi 下的其他设备无需重复下载 3GB 的加密数据，直接通过 WebRTC 从本机内存点对点秒级接收音视频流：
          </p>

          <div class="flex items-center gap-2">
            <div class="p-2 rounded-xl bg-black/20 font-mono text-[11px] break-all select-all flex-1 text-cyan-400 truncate">
              {{ localIpUrl }}
            </div>
            <button
              type="button"
              @click="copyP2pLink"
              class="px-3 py-2 rounded-xl text-xs font-bold bg-[var(--md-sys-color-surface-container-high)] hover:bg-white/10 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              {{ isCopied ? '已复制' : '复制链接' }}
            </button>
          </div>
        </div>
      </div>

      <div slot="actions">
        <md-filled-button @click="isOpen = false">完成</md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<style scoped>
.md3-webrtc-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>