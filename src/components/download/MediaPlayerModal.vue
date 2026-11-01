<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import Player from 'xgplayer'
import 'xgplayer/dist/index.min.css'
import Danmu from 'xgplayer/es/plugins/danmu'
import 'xgplayer/es/plugins/danmu/index.css'
import { importEncryptionKey, decryptApiPayload } from '../../utils/crypto'
import ExternalPlayerLauncher from './ExternalPlayerLauncher.vue'
import '@material/web/button/filled-button.js'
import WebRtcBroadcaster from './WebRtcBroadcaster.vue'

const webRtcBroadcasterRef = ref<any>(null)

const props = defineProps<{
  type: string
  url: string
  resource: any
  baseUrl: string
  currentFolderResources?: any[]
}>()

const emit = defineEmits(['close', 'download', 'switchVideo'])

let playerInstance: any = null
const codecError = ref(false)

// 弹幕配置
const danmuText = ref('')
const selectedColor = ref('#ffffff')
const danmuMode = ref<'scroll' | 'top' | 'bottom'>('scroll')
const danmuSize = ref<'16px' | '20px' | '26px'>('20px')
const DANMU_COLORS = ['#ffffff', '#FF1744', '#00E676', '#29B6F6', '#FFD600', '#E040FB', '#00E5FF']

const isModeMenuOpen = ref(false)
const isSizeMenuOpen = ref(false)
const isSubtitleMenuOpen = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const externalLauncherRef = ref<any>(null)

// 🌟 1. YouTube 同款全屏无死角自适应氛围灯 (屏幕有多大盖多大)
const ambientCanvasRef = ref<HTMLCanvasElement | null>(null)
const isAmbientEnabled = ref(true)
let ambientCtx: CanvasRenderingContext2D | null = null
let ambientAnimId: any = null

const startAmbientLoop = () => {
  if (!ambientCanvasRef.value) return
  const canvas = ambientCanvasRef.value
  canvas.width = 48
  canvas.height = 27
  ambientCtx = canvas.getContext('2d', { willReadFrequently: false })

  let lastDrawTime = 0
  const drawFrame = (time: number) => {
    if (
      isAmbientEnabled.value &&
      playerInstance?.video &&
      !playerInstance.video.paused &&
      !playerInstance.video.ended
    ) {
      if (time - lastDrawTime > 65) {
        try {
          const v = playerInstance.video
          const vw = v.videoWidth || 1920
          const vh = v.videoHeight || 1080
          // 裁切 15% 黑边
          const cropX = vw * 0.15
          const cropY = vh * 0.15
          const cropW = vw * 0.70
          const cropH = vh * 0.70
          ambientCtx?.drawImage(v, cropX, cropY, cropW, cropH, 0, 0, 48, 27)
          lastDrawTime = time
        } catch {}
      }
    }
    ambientAnimId = requestAnimationFrame(drawFrame)
  }
  ambientAnimId = requestAnimationFrame(drawFrame)
}

// ==========================================
// 🌟 2. 字幕引擎与时间轴微调
// ==========================================
export interface RobustCue {
  start: number
  end: number
  text: string
  isZeroDuration?: boolean
}

export interface RobustSubtitleTrack {
  id: string
  label: string
  cues: RobustCue[]
}

const parsedTracks = ref<RobustSubtitleTrack[]>([])
const activeTrackId = ref<string>('off')
const activeSubtitleTexts = ref<string[]>([])
const subtitleFontSize = ref(localStorage.getItem('preferred_sub_size') || '26px')
const isAutoScanningSub = ref(false)

const subtitleOffsetSec = ref<number>(
  parseFloat(localStorage.getItem(`sub_offset_${props.resource?.id}`) || '0')
)

const adjustSubtitleOffset = (delta: number) => {
  subtitleOffsetSec.value = parseFloat((subtitleOffsetSec.value + delta).toFixed(2))
  localStorage.setItem(`sub_offset_${props.resource?.id}`, String(subtitleOffsetSec.value))
  syncSubtitlesWithPlayer()
}

const resetSubtitleOffset = () => {
  subtitleOffsetSec.value = 0
  localStorage.removeItem(`sub_offset_${props.resource?.id}`)
  syncSubtitlesWithPlayer()
}

const setSubtitleFontSize = (size: string) => {
  subtitleFontSize.value = size
  localStorage.setItem('preferred_sub_size', size)
}

const parseFlexibleTimestamp = (timeStr: string): number => {
  const clean = timeStr.trim().replace(',', '.')
  const parts = clean.split(':')
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  } else if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
  }
  return 0
}

const parseSrtOrVttToCues = (rawContent: string): RobustCue[] => {
  const content = rawContent.replace(/^\uFEFF/, '').replace(/\r\n|\r/g, '\n')
  const blocks = content.split(/\n\s*\n/)
  const cues: RobustCue[] = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length === 0) continue

    const timeLineIdx = lines.findIndex(l => l.includes('-->'))
    if (timeLineIdx === -1) continue

    const [startStr, endStr] = lines[timeLineIdx].split('-->')
    if (!startStr || !endStr) continue

    const start = parseFlexibleTimestamp(startStr.trim().split(' ')[0])
    let end = parseFlexibleTimestamp(endStr.trim().split(' ')[0])

    const textLines = lines.slice(timeLineIdx + 1).map(l => l.trim()).filter(Boolean)
    if (textLines.length === 0) continue

    let isZeroDuration = false
    if (end <= start || Math.abs(end - start) < 0.05) {
      isZeroDuration = true
      end = start + 2.0
    }

    cues.push({ start, end, text: textLines.join('\n'), isZeroDuration })
  }
  return cues.sort((a, b) => a.start - b.start)
}

const parseAssToCues = (rawContent: string): RobustCue[] => {
  const content = rawContent.replace(/^\uFEFF/, '').replace(/\r\n|\r/g, '\n')
  const lines = content.split('\n')
  let formatCols: string[] = []
  const cues: RobustCue[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith('Format:')) {
      formatCols = line.replace('Format:', '').split(',').map(c => c.trim().toLowerCase())
    } else if (line.startsWith('Dialogue:')) {
      const parts = line.replace('Dialogue:', '').split(',')
      const textIdx = formatCols.indexOf('text')
      const startIdx = formatCols.indexOf('start')
      const endIdx = formatCols.indexOf('end')

      if (startIdx !== -1 && endIdx !== -1) {
        const start = parseFlexibleTimestamp(parts[startIdx])
        let end = parseFlexibleTimestamp(parts[endIdx])
        const textRaw = parts.slice(textIdx !== -1 ? textIdx : 9).join(',')

        const cleanText = textRaw
          .replace(/\{[^}]*\}/g, '')
          .replace(/\\N/gi, '\n')
          .replace(/\\n/gi, '\n')
          .replace(/\\h/gi, ' ')
          .trim()

        if (cleanText) {
          let isZeroDuration = false
          if (end <= start || Math.abs(end - start) < 0.05) {
            isZeroDuration = true
            end = start + 2.0
          }
          cues.push({ start, end, text: cleanText, isZeroDuration })
        }
      }
    }
  }
  return cues.sort((a, b) => a.start - b.start)
}

const extractZipEntries = async (zipBuf: ArrayBuffer): Promise<Array<{ filename: string; content: string }>> => {
  const view = new DataView(zipBuf)
  const uint8 = new Uint8Array(zipBuf)
  const results: Array<{ filename: string; content: string }> = []
  let offset = 0

  while (offset < view.byteLength - 4) {
    const sig = view.getUint32(offset, true)
    if (sig !== 0x04034b50) break

    const compression = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const nameLen = view.getUint16(offset + 26, true)
    const extraLen = view.getUint16(offset + 28, true)

    const nameBytes = uint8.subarray(offset + 30, offset + 30 + nameLen)
    const filename = new TextDecoder('utf-8').decode(nameBytes)

    const dataStart = offset + 30 + nameLen + extraLen
    const dataEnd = dataStart + compressedSize

    if (dataEnd <= uint8.length) {
      const fileData = uint8.subarray(dataStart, dataEnd)
      let uncompressedBytes: Uint8Array

      if (compression === 0) {
        uncompressedBytes = fileData
      } else if (compression === 8) {
        try {
          const ds = new DecompressionStream('deflate-raw')
          const stream = new Response(fileData).body!.pipeThrough(ds)
          const ab = await new Response(stream).arrayBuffer()
          uncompressedBytes = new Uint8Array(ab)
        } catch {
          uncompressedBytes = new Uint8Array(0)
        }
      } else {
        uncompressedBytes = new Uint8Array(0)
      }

      if (uncompressedBytes.length > 0) {
        const text = new TextDecoder('utf-8').decode(uncompressedBytes)
        results.push({ filename, content: text })
      }
    }
    offset = dataEnd
  }
  return results
}

const syncSubtitlesWithPlayer = () => {
  if (activeTrackId.value === 'off') {
    activeSubtitleTexts.value = []
    return
  }

  const track = parsedTracks.value.find(t => t.id === activeTrackId.value)
  if (!track || track.cues.length === 0) {
    activeSubtitleTexts.value = []
    return
  }

  const v = playerInstance?.video
  const rawTime = v ? v.currentTime : (playerInstance?.currentTime || 0)
  const currentTime = Math.max(0, rawTime + subtitleOffsetSec.value)

  const regularCues = track.cues.filter(
    c => !c.isZeroDuration && currentTime >= c.start && currentTime < c.end
  )

  if (regularCues.length > 0) {
    activeSubtitleTexts.value = regularCues.map(c => c.text)
    return
  }

  const zeroCues = track.cues.filter(c => c.isZeroDuration && currentTime >= c.start && currentTime < c.end)
  if (zeroCues.length > 0) {
    const nextRegular = track.cues.find(c => !c.isZeroDuration && c.start > zeroCues[0].start)
    if (nextRegular && currentTime >= nextRegular.start) {
      activeSubtitleTexts.value = []
    } else {
      activeSubtitleTexts.value = zeroCues.map(c => c.text)
    }
    return
  }

  activeSubtitleTexts.value = []
}

const selectSubtitleTrack = (trackId: string) => {
  activeTrackId.value = trackId
  isSubtitleMenuOpen.value = false
  syncSubtitlesWithPlayer()
}

const scanAndLoadCompanionZip = async () => {
  if (!props.resource?.name) return
  isAutoScanningSub.value = true

  try {
    const token = localStorage.getItem('reiadown_token') || ''
    const expectedZipName = `${props.resource.name}.zip`.toLowerCase()
    const folderList = props.currentFolderResources || []
    const matchedZip = folderList.find((r: any) => r.name.toLowerCase() === expectedZipName)

    if (!matchedZip) {
      isAutoScanningSub.value = false
      return
    }

    const res = await fetch(`${props.baseUrl}/api/resources/${matchedZip.id}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const rawData = await res.json()
    const data = rawData.e2ee ? await decryptApiPayload(rawData, token) : rawData

    if (!data.success) throw new Error(data.message)

    let zipBuffer: ArrayBuffer
    if (data.is_encrypted && data.downloadUrls) {
      const urls = data.downloadUrls
      const key = await importEncryptionKey(data.encrypt_key)
      const decryptedParts: Uint8Array[] = []

      for (let i = 0; i < urls.length; i++) {
        const cRes = await fetch(urls[i])
        const encBuf = await cRes.arrayBuffer()
        const iv = encBuf.slice(0, 12)
        const cipher = encBuf.slice(12)
        const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, cipher)
        decryptedParts.push(new Uint8Array(dec))
      }

      const totalLen = decryptedParts.reduce((acc, b) => acc + b.length, 0)
      const combined = new Uint8Array(totalLen)
      let offset = 0
      for (const b of decryptedParts) {
        combined.set(b, offset)
        offset += b.length
      }
      zipBuffer = combined.buffer
    } else {
      const zipRes = await fetch(data.downloadUrl || data.downloadUrls[0])
      zipBuffer = await zipRes.arrayBuffer()
    }

    const files = await extractZipEntries(zipBuffer)
    const newTracks: RobustSubtitleTrack[] = []

    for (const f of files) {
      const lower = f.filename.toLowerCase()
      let cues: RobustCue[] = []

      if (lower.endsWith('.srt') || lower.endsWith('.vtt')) {
        cues = parseSrtOrVttToCues(f.content)
      } else if (lower.endsWith('.ass') || lower.endsWith('.ssa')) {
        cues = parseAssToCues(f.content)
      }

      if (cues.length > 0) {
        newTracks.push({
          id: `zip_sub_${newTracks.length}_${Date.now()}`,
          label: f.filename.replace(/\.[^/.]+$/, ''),
          cues
        })
      }
    }

    parsedTracks.value = newTracks

    if (newTracks.length > 0) {
      activeTrackId.value = newTracks[0].id
      syncSubtitlesWithPlayer()
    }
  } catch (e) {
    console.warn('[Subtitle] 自动解析伴生字幕包异常:', e)
  } finally {
    isAutoScanningSub.value = false
  }
}

const triggerImportSubtitle = () => fileInputRef.value?.click()

const handleLocalSubtitleLoad = async (event: any) => {
  const file = event.target.files?.[0]
  if (!file) return

  const text = await file.text()
  const lower = file.name.toLowerCase()
  let cues: RobustCue[] = []

  if (lower.endsWith('.ass') || lower.endsWith('.ssa')) {
    cues = parseAssToCues(text)
  } else {
    cues = parseSrtOrVttToCues(text)
  }

  if (cues.length > 0) {
    const newTrack: RobustSubtitleTrack = {
      id: `manual_sub_${Date.now()}`,
      label: file.name.replace(/\.[^/.]+$/, '') + ' (手动导入)',
      cues
    }
    parsedTracks.value.push(newTrack)
    activeTrackId.value = newTrack.id
    syncSubtitlesWithPlayer()
  }

  isSubtitleMenuOpen.value = false
}

// 🌟 3. 音画时钟硬同步守护器
let syncWatchdogTimer: any = null
let lastWallClockTime = 0
let lastVideoMediaTime = 0

const startSyncWatchdog = () => {
  lastWallClockTime = performance.now()
  const v: HTMLVideoElement = playerInstance?.video
  if (!v) return
  lastVideoMediaTime = v.currentTime

  syncWatchdogTimer = setInterval(() => {
    if (!v || v.paused || v.seeking || v.ended) {
      lastWallClockTime = performance.now()
      lastVideoMediaTime = v ? v.currentTime : 0
      return
    }

    const now = performance.now()
    const wallElapsedSec = (now - lastWallClockTime) / 1000
    const mediaElapsedSec = v.currentTime - lastVideoMediaTime

    if (wallElapsedSec >= 0.6) {
      const lag = (wallElapsedSec * v.playbackRate) - mediaElapsedSec

      if (lag > 0.35 && lag < 6.0) {
        v.currentTime += lag
        lastVideoMediaTime = v.currentTime
        lastWallClockTime = performance.now()
        syncSubtitlesWithPlayer()
        return
      }

      lastWallClockTime = now
      lastVideoMediaTime = v.currentTime
    }
  }, 250)
}

const stopSyncWatchdog = () => {
  if (syncWatchdogTimer) {
    clearInterval(syncWatchdogTimer)
    syncWatchdogTimer = null
  }
}

// ==========================================
// 🌟 4. 实时弹幕列表与 WebSocket 通信
// ==========================================
const danmakuList = ref<any[]>([])
let wsClient: WebSocket | null = null

const fetchDanmaku = async () => {
  try {
    const res = await fetch(`${props.baseUrl}/api/resources/${props.resource.id}/danmaku`)
    const data = await res.json()
    const list = data.success ? data.comments : []
    danmakuList.value = list.sort((a: any, b: any) => a.start - b.start)
    return list
  } catch {
    return []
  }
}

const sendDanmakuApi = async (danmu: any) => {
  try {
    await fetch(`${props.baseUrl}/api/resources/${props.resource.id}/danmaku`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: danmu.start,
        txt: danmu.txt,
        color: danmu.style?.color || '#ffffff',
        font_size: danmu.style?.fontSize || '20px',
        mode: danmu.mode || 'scroll'
      })
    })
  } catch {}
}

const initPlayer = async () => {
  if (playerInstance || !props.url) return
  try {
    const comments = await fetchDanmaku()

    playerInstance = new Player({
      id: 'xgplayer-core',
      url: props.url,
      videoInit: true,
      autoplay: true,
      fluid: true,
      fitVideoSize: 'fixWidth',
      playbackRate: [0.5, 0.75, 1, 1.25, 1.5, 2, 3],
      plugins: [Danmu],
      danmu: {
        comments,
        area: { start: 0, end: 1 },
        defaultOpen: true,
        panel: true,
        sendAction: (danmu: any) => { sendDanmakuApi(danmu) }
      }
    })

    playerInstance.on('error', () => { codecError.value = true })

    const v = playerInstance.video
    if (v) {
      v.addEventListener('timeupdate', syncSubtitlesWithPlayer)
      v.addEventListener('seeked', syncSubtitlesWithPlayer)
      v.addEventListener('seeking', syncSubtitlesWithPlayer)
      v.addEventListener('ratechange', syncSubtitlesWithPlayer)
    }

    startAmbientLoop()
    scanAndLoadCompanionZip()
    startSyncWatchdog()

    const wsProto = props.baseUrl.startsWith('https') ? 'wss' : 'ws'
    const wsHost = props.baseUrl.replace(/^https?:\/\//, '')
    wsClient = new WebSocket(`${wsProto}://${wsHost}`)

    wsClient.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        if (parsed.type === 'danmaku_receive' && parsed.resourceId === props.resource.id && playerInstance) {
          playerInstance.danmu.sendComment(parsed.comment)
          danmakuList.value.push(parsed.comment)
        }
      } catch {}
    }
  } catch {
    codecError.value = true
  }
}

const sendCustomDanmu = async () => {
  if (!danmuText.value.trim() || !playerInstance) return
  const currentMs = Math.round(playerInstance.currentTime * 1000)

  const newComment = {
    id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    duration: 5000,
    start: currentMs,
    txt: danmuText.value.trim(),
    mode: danmuMode.value,
    style: {
      color: selectedColor.value,
      fontSize: danmuSize.value,
      textShadow: '-1.5px -1.5px 0 #1a1a1a, 1.5px -1.5px 0 #1a1a1a, -1.5px 1.5px 0 #1a1a1a, 1.5px 1.5px 0 #1a1a1a, 0 2px 4px rgba(0,0,0,0.9)',
      fontWeight: 'bold'
    }
  }

  playerInstance.danmu.sendComment(newComment)
  danmakuList.value.push(newComment)

  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({
      type: 'danmaku_send',
      resourceId: props.resource.id,
      comment: newComment
    }))
  }

  await sendDanmakuApi(newComment)
  danmuText.value = ''
}

// 🌟 点击弹幕列表项：视频瞬间跳转至对应时间戳！
const seekToDanmaku = (ms: number) => {
  if (playerInstance) {
    playerInstance.currentTime = Math.max(0, ms / 1000)
    if (playerInstance.video?.paused) playerInstance.play()
  }
}

const formatDanmuTime = (ms: number) => {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 🌟 5. 过滤同文件夹下的其他视频文件 (排除 zip、doc 等)
const playlistVideos = computed(() => {
  const list = props.currentFolderResources || []
  return list.filter((r: any) => {
    return r.type === 'file' && /\.(mp4|mkv|webm)$/i.test(r.name)
  })
})

const modeConfig = {
  scroll: { label: '滚动', icon: 'view_stream' },
  top: { label: '顶部', icon: 'vertical_align_top' },
  bottom: { label: '底部', icon: 'vertical_align_bottom' }
}

const sizeConfig = {
  '16px': { label: '小号' },
  '20px': { label: '标准' },
  '26px': { label: '大字' }
}

const closeAllPopups = () => {
  isModeMenuOpen.value = false
  isSizeMenuOpen.value = false
  isSubtitleMenuOpen.value = false
}

// 暂停网页播放（配合外链播放器）
const pauseWebPlayer = () => {
  if (playerInstance) {
    playerInstance.pause()
  }
}

watch(() => props.url, (u) => { if (u) initPlayer() })
onMounted(() => { if (props.url) initPlayer() })
onUnmounted(() => {
  stopSyncWatchdog()
  if (ambientAnimId) cancelAnimationFrame(ambientAnimId)
  if (wsClient) wsClient.close()
  if (playerInstance) {
    playerInstance.destroy()
    playerInstance = null
  }
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex flex-col justify-between bg-black/92 backdrop-blur-3xl select-none overflow-hidden"
    @click="closeAllPopups"
  >
    <input ref="fileInputRef" type="file" accept=".vtt,.srt,.ass,.ssa" class="hidden" @change="handleLocalSubtitleLoad" />

    <!-- 🌟 全屏自适应 YouTube 氛围灯 (100vw x 100vh 无死角覆盖，彻底消灭黑边) -->
    <canvas
      v-show="isAmbientEnabled"
      ref="ambientCanvasRef"
      class="youtube-fullscreen-ambient pointer-events-none"
    ></canvas>

    <!-- 顶栏标题栏 -->
    <div class="flex items-center justify-between p-3 sm:px-6 sm:py-3 shrink-0 z-30 border-b border-white/5">
      <div class="flex items-center gap-2.5 max-w-[55vw] truncate">
        <span class="text-sm sm:text-base font-bold text-white truncate">{{ resource?.name }}</span>
        <span
          v-if="parsedTracks.length > 0"
          class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 shrink-0 font-mono hidden sm:inline"
        >
          {{ parsedTracks.length }} 轨字幕
        </span>
      </div>

      <div class="flex items-center gap-2">
        <!-- 🌟 PC 专属外链播放模组 -->
        <ExternalPlayerLauncher
          ref="externalLauncherRef"
          :stream-url="url"
          :video-name="resource?.name || 'video'"
          @pause-video="pauseWebPlayer"
          class="hidden sm:inline-block"
        />

        <!-- 🌟 WebRTC 局域网广播与独立桌面悬浮窗模组 -->
        <WebRtcBroadcaster
          ref="webRtcBroadcasterRef"
          :video-element="playerInstance?.video || null"
          :resource="resource"
          :base-url="baseUrl"
        />

        <button
          @click="$emit('download')"
          class="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1 cursor-pointer"
        >
          <span class="material-symbols-outlined text-sm">download</span>
          <span class="hidden sm:inline">下载</span>
        </button>

        <button
          @click="$emit('close')"
          class="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <span class="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>

    <!-- 🌟 核心视窗：纯正 YouTube 响应式双端排版 -->
    <div
      class="flex-1 w-full max-w-[1440px] mx-auto p-2 sm:p-6 overflow-y-auto z-20 flex flex-col lg:flex-row gap-6 min-h-0"
      :style="{ '--sub-font-size': subtitleFontSize }"
    >
      <!-- ========================================================
           左栏（手机端置顶）：播放器主体 + 弹幕发射台 + 弹幕讨论流
           ======================================================== -->
      <div class="flex-1 flex flex-col gap-4 min-w-0">
        <!-- 播放器主体卡片 -->
        <div class="w-full flex flex-col rounded-[24px] sm:rounded-[28px] overflow-hidden bg-transparent shadow-[0_12px_48px_rgba(0,0,0,0.35)] relative">
          <!-- 视频层 -->
          <div class="w-full aspect-video bg-black relative overflow-hidden">
            <div id="xgplayer-core" class="w-full h-full relative">
              <!-- 自研字幕层 (全屏下同样完美显示) -->
              <div
                v-if="activeSubtitleTexts.length > 0 && !isSubtitleMenuOpen"
                class="subtitle-overlay-layer pointer-events-none absolute inset-x-0 bottom-12 sm:bottom-14 flex flex-col items-center justify-end z-25 px-4 pb-2"
              >
                <div
                  v-for="(text, idx) in activeSubtitleTexts"
                  :key="idx"
                  class="custom-subtitle-text"
                >
                  {{ text }}
                </div>
              </div>
            </div>
          </div>

          <!-- 🌟 弹幕发射栏：降至 40% 不透明度 + 高斯模糊 (氛围流光真实漫透) -->
          <div class="p-3 sm:p-3.5 ambient-translucent-bar flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 border-t border-white/5 relative z-10" @click.stop>
            <!-- 输入框行 -->
            <div class="flex items-center gap-2 w-full flex-1">
              <input
                v-model="danmuText"
                @keyup.enter="sendCustomDanmu"
                placeholder="发条弹幕参与讨论吧..."
                class="flex-1 w-full bg-white/10 text-xs px-4 py-2 sm:py-2.5 rounded-full outline-none text-white placeholder:text-white/40"
              />
              <md-filled-button @click="sendCustomDanmu" class="h-8 sm:hidden shrink-0">
                <span class="material-symbols-outlined text-xs" slot="icon">send</span>
              </md-filled-button>
            </div>

            <!-- 控制工具集 (手机端弹性折叠) -->
            <div class="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 shrink-0">
              <!-- 字幕选单 (手机端居中防越界) -->
              <div class="relative">
                <button
                  type="button"
                  @click="isSubtitleMenuOpen = !isSubtitleMenuOpen; isModeMenuOpen = false; isSizeMenuOpen = false"
                  class="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  :class="activeTrackId !== 'off' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/10 text-white/70'"
                >
                  <span class="material-symbols-outlined text-base">closed_caption</span>
                  <span class="text-[11px]">{{ activeTrackId === 'off' ? '字幕关' : '字幕开' }}</span>
                </button>

                <div
                  v-if="isSubtitleMenuOpen"
                  class="popover-menu absolute bottom-12 right-0 w-64 p-3 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] shadow-2xl border border-white/10 flex flex-col gap-2.5 z-50 backdrop-blur-2xl"
                >
                  <div class="flex flex-col gap-1.5 pb-2 border-b border-white/10">
                    <div class="flex items-center justify-between text-[10px] font-bold">
                      <span class="opacity-60">时间轴同步微调</span>
                      <span class="font-mono" :class="subtitleOffsetSec !== 0 ? 'text-amber-400' : 'opacity-40'">
                        {{ subtitleOffsetSec > 0 ? `+${subtitleOffsetSec}s` : `${subtitleOffsetSec}s` }}
                      </span>
                    </div>
                    <div class="grid grid-cols-5 gap-1">
                      <button @click="adjustSubtitleOffset(-1.0)" class="py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-white/10">-1.0s</button>
                      <button @click="adjustSubtitleOffset(-0.5)" class="py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-white/10">-0.5s</button>
                      <button @click="resetSubtitleOffset" class="py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-white/10 opacity-70">复位</button>
                      <button @click="adjustSubtitleOffset(0.5)" class="py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-white/10">+0.5s</button>
                      <button @click="adjustSubtitleOffset(1.0)" class="py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-white/10">+1.0s</button>
                    </div>
                  </div>

                  <div class="flex flex-col gap-1.5 pb-2 border-b border-white/10">
                    <span class="text-[10px] font-bold opacity-60">字幕大小</span>
                    <div class="grid grid-cols-4 gap-1">
                      <button
                        v-for="s in [
                          { label: '小', val: '18px' },
                          { label: '中', val: '26px' },
                          { label: '大', val: '32px' },
                          { label: '特大', val: '38px' }
                        ]"
                        :key="s.val"
                        @click="setSubtitleFontSize(s.val)"
                        class="py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        :class="subtitleFontSize === s.val ? 'bg-[var(--md-sys-color-primary)] text-white' : 'bg-white/5 opacity-70'"
                      >
                        {{ s.label }}
                      </button>
                    </div>
                  </div>

                  <div class="flex flex-col gap-1 max-h-40 overflow-y-auto pr-0.5">
                    <button
                      @click="selectSubtitleTrack('off')"
                      class="px-3 py-1.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between"
                      :class="activeTrackId === 'off' ? 'bg-[var(--md-sys-color-primary)] text-white' : 'opacity-70'"
                    >
                      <span>关闭字幕</span>
                      <span v-if="activeTrackId === 'off'" class="material-symbols-outlined text-xs">check</span>
                    </button>

                    <button
                      v-for="st in parsedTracks"
                      :key="st.id"
                      @click="selectSubtitleTrack(st.id)"
                      class="px-3 py-1.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between truncate"
                      :class="activeTrackId === st.id ? 'bg-[var(--md-sys-color-primary)] text-white' : 'opacity-70'"
                    >
                      <span class="truncate">{{ st.label }}</span>
                      <span v-if="activeTrackId === st.id" class="material-symbols-outlined text-xs shrink-0">check</span>
                    </button>
                  </div>

                  <div class="pt-1 border-t border-white/10">
                    <button
                      @click="triggerImportSubtitle"
                      class="w-full px-3 py-1.5 rounded-xl text-xs font-semibold text-left opacity-70 hover:opacity-100 hover:text-cyan-400 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span class="material-symbols-outlined text-sm">upload_file</span>
                      <span>手动载入本地字幕</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- 模式 (三选一) -->
              <div class="relative">
                <button
                  type="button"
                  @click="isModeMenuOpen = !isModeMenuOpen; isSizeMenuOpen = false; isSubtitleMenuOpen = false"
                  class="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/80 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span class="material-symbols-outlined text-base">{{ modeConfig[danmuMode].icon }}</span>
                  <span class="hidden sm:inline">{{ modeConfig[danmuMode].label }}</span>
                </button>

                <div
                  v-if="isModeMenuOpen"
                  class="popover-menu absolute bottom-12 right-0 w-44 p-1.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] shadow-2xl border border-white/10 flex flex-col gap-1 z-50 backdrop-blur-2xl"
                >
                  <button
                    v-for="(cfg, key) in modeConfig"
                    :key="key"
                    @click="danmuMode = key as any; isModeMenuOpen = false"
                    class="px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between"
                    :class="danmuMode === key ? 'bg-[var(--md-sys-color-primary)] text-white' : 'opacity-70'"
                  >
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-sm">{{ cfg.icon }}</span>
                      <span>{{ cfg.label }}弹幕</span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- 字号 -->
              <div class="relative">
                <button
                  type="button"
                  @click="isSizeMenuOpen = !isSizeMenuOpen; isModeMenuOpen = false; isSubtitleMenuOpen = false"
                  class="px-2 sm:px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/80 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span class="material-symbols-outlined text-base">format_size</span>
                  <span class="hidden sm:inline">{{ sizeConfig[danmuSize].label }}</span>
                </button>

                <div
                  v-if="isSizeMenuOpen"
                  class="popover-menu absolute bottom-12 right-0 w-36 p-1.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] shadow-2xl border border-white/10 flex flex-col gap-1 z-50 backdrop-blur-2xl"
                >
                  <button
                    v-for="(cfg, key) in sizeConfig"
                    :key="key"
                    @click="danmuSize = key as any; isSizeMenuOpen = false"
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between"
                    :class="danmuSize === key ? 'bg-[var(--md-sys-color-primary)] text-white' : 'opacity-70'"
                  >
                    <span>{{ cfg.label }}</span>
                    <span v-if="danmuSize === key" class="material-symbols-outlined text-xs">check</span>
                  </button>
                </div>
              </div>

              <!-- 氛围灯切换 -->
              <button
                type="button"
                @click="isAmbientEnabled = !isAmbientEnabled"
                class="w-7 sm:w-8 h-7 sm:h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
                :class="isAmbientEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 opacity-40 text-white'"
              >
                <span class="material-symbols-outlined text-base">flare</span>
              </button>

              <!-- 调色盘 -->
              <div class="flex items-center gap-1 px-1">
                <span
                  v-for="c in DANMU_COLORS.slice(0, 5)"
                  :key="c"
                  @click="selectedColor = c"
                  class="w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full cursor-pointer transition-transform"
                  :class="{ 'scale-125 ring-2 ring-white': selectedColor === c }"
                  :style="{ backgroundColor: c }"
                ></span>
              </div>

              <md-filled-button @click="sendCustomDanmu" class="h-8 sm:h-9 hidden sm:inline-flex">
                <span class="material-symbols-outlined text-xs" slot="icon">send</span>
                发送
              </md-filled-button>
            </div>
          </div>
        </div>

        <!-- 🌟 YouTube 风格：实时弹幕列表 (复用原有加载器数据，点击跳转秒数) -->
        <div class="p-4 sm:p-5 rounded-3xl bg-[var(--md-sys-color-surface-container)]/80 backdrop-blur-xl border border-white/5 shadow-sm flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-base text-[var(--md-sys-color-primary)]">chat</span>
              <span class="font-extrabold text-xs sm:text-sm text-[var(--md-sys-color-on-surface)]">
                实时弹幕记录 ({{ danmakuList.length }})
              </span>
            </div>
            <span class="text-[10px] opacity-40">点击时间戳快速跳转</span>
          </div>

          <div v-if="danmakuList.length === 0" class="py-6 text-center opacity-40 text-xs">
            暂无历史弹幕，发一条开启讨论吧
          </div>

          <div v-else class="flex flex-col gap-2 max-h-60 sm:max-h-80 overflow-y-auto pr-1">
            <div
              v-for="d in danmakuList"
              :key="d.id"
              class="p-2.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 hover:bg-[var(--md-sys-color-surface-container-high)] transition-all flex items-center justify-between text-xs group cursor-pointer"
              @click="seekToDanmaku(d.start)"
            >
              <div class="flex items-center gap-2.5 truncate mr-2">
                <span class="px-2 py-0.5 rounded-lg bg-black/20 text-[var(--md-sys-color-primary)] font-mono font-bold text-[10px]">
                  {{ formatDanmuTime(d.start) }}
                </span>
                <span class="truncate text-[var(--md-sys-color-on-surface)]" :style="{ color: d.style?.color }">
                  {{ d.txt }}
                </span>
              </div>
              <span class="material-symbols-outlined text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                play_arrow
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ========================================================
           右栏（手机端下方）：当前目录同类视频列表 (自动过滤非视频)
           ======================================================== -->
      <div class="w-full lg:w-80 shrink-0 flex flex-col gap-3">
        <div class="flex items-center justify-between px-1">
          <span class="text-xs font-bold uppercase tracking-wider text-[var(--md-sys-color-primary)] flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm">video_library</span>
            <span>合辑 · 目录视频 ({{ playlistVideos.length }})</span>
          </span>
        </div>

        <div class="flex flex-col gap-2.5 max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
          <div
            v-for="v in playlistVideos"
            :key="v.id"
            @click="v.id !== resource?.id && $emit('switchVideo', v)"
            class="p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 shadow-sm border"
            :class="v.id === resource?.id
              ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-transparent font-bold'
              : 'bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] border-black/5 dark:border-transparent opacity-80'"
          >
            <div class="flex items-center gap-3 truncate">
              <span class="material-symbols-outlined text-lg shrink-0">
                {{ v.id === resource?.id ? 'play_circle' : 'movie' }}
              </span>
              <span class="text-xs truncate">{{ v.name }}</span>
            </div>

            <span v-if="v.id === resource?.id" class="text-[10px] font-bold shrink-0 opacity-70">
              播放中
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.xgplayer) {
  --xgplayer-theme-color: var(--md-sys-color-primary) !important;
}

/* 🌟 YouTube 氛围灯 (屏幕有多大铺多大，无边际覆盖) */
.youtube-fullscreen-ambient {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  filter: blur(110px) saturate(240%) brightness(1.15) !important;
  opacity: 0.65;
  pointer-events: none;
  z-index: 0;
  transition: opacity 0.5s ease;
}

/* 🌟 弹幕栏 40% 不透明度 (高斯模糊漫透氛围灯) */
.ambient-translucent-bar {
  background: rgba(18, 20, 24, 0.40) !important;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

/* 移动端控制条微缩 */
@media (max-width: 640px) {
  :deep(.xgplayer .xgplayer-controls) {
    height: 38px !important;
    padding: 0 4px !important;
  }
  :deep(.xgplayer .xg-icon) {
    width: 26px !important;
    height: 26px !important;
  }
  :deep(.xgplayer .xg-time) {
    font-size: 10px !important;
  }

  /* 🌟 核心：手机端弹窗菜单自动居中为底部抽屉，绝不出界 */
  .popover-menu {
    position: fixed !important;
    bottom: 84px !important;
    left: 16px !important;
    right: 16px !important;
    width: auto !important;
    max-width: none !important;
    z-index: 99 !important;
  }
}

/* 齿轮面板防遮挡 */
:deep(.xgplayer .xgplayer-danmu-panel) {
  position: absolute !important;
  bottom: 74px !important;
  right: 16px !important;
  max-height: calc(100% - 90px) !important;
  overflow-y: auto !important;
  border-radius: 20px !important;
  background: rgba(18, 20, 24, 0.96) !important;
  backdrop-filter: blur(25px) !important;
  -webkit-backdrop-filter: blur(25px) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8) !important;
  scrollbar-width: thin;
  padding: 16px 18px !important;
  z-index: 100 !important;
}

:deep(.xgplayer .xgplayer-danmu-panel input[type="range"]) {
  accent-color: var(--md-sys-color-primary) !important;
}

/* 字幕渲染层 (透明底 + 深灰描边 + 投影) */
.custom-subtitle-text {
  background: transparent !important;
  background-color: transparent !important;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: var(--sub-font-size, 26px);
  font-weight: 800;
  text-align: center;
  white-space: pre-wrap;
  line-height: 1.35;
  text-shadow:
    -1.5px -1.5px 0 #1a1a1a,
     1.5px -1.5px 0 #1a1a1a,
    -1.5px  1.5px 0 #1a1a1a,
     1.5px  1.5px 0 #1a1a1a,
     0px 2px 4px rgba(0, 0, 0, 0.95),
     0px 4px 10px rgba(0, 0, 0, 0.75);
  margin-bottom: 4px;
  pointer-events: none;
}

.popover-menu {
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.85);
}
</style>