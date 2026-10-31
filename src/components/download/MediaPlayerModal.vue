<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import Player from 'xgplayer'
import 'xgplayer/dist/index.min.css'
import Danmu from 'xgplayer/es/plugins/danmu'
import 'xgplayer/es/plugins/danmu/index.css'
import { importEncryptionKey, decryptApiPayload } from '../../utils/crypto'
import '@material/web/button/filled-button.js'

const props = defineProps<{
  type: string
  url: string
  resource: any
  baseUrl: string
  currentFolderResources?: any[]
}>()

const emit = defineEmits(['close', 'download'])

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

// 🌟 1. 超广角 YouTube 氛围灯系统
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
      if (time - lastDrawTime > 70) {
        try {
          const v = playerInstance.video
          const vw = v.videoWidth || 1920
          const vh = v.videoHeight || 1080
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

// =========================================================
// 🌟 2. 毫秒级自研时序互锁字幕引擎
// =========================================================
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

    cues.push({
      start,
      end,
      text: textLines.join('\n'),
      isZeroDuration
    })
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
        } catch (e) {
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

// 🌟 核心时序同步器
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

// 自动扫描加载伴生 ZIP 字幕包
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

// 🌟 音画时钟硬同步守护器 (丢帧追赶，绝不慢放)
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

let wsClient: WebSocket | null = null

const fetchDanmaku = async () => {
  try {
    const res = await fetch(`${props.baseUrl}/api/resources/${props.resource.id}/danmaku`)
    const data = await res.json()
    return data.success ? data.comments : []
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

const modeConfig = {
  scroll: { label: '滚动', icon: 'view_stream', desc: '右向左划过' },
  top: { label: '顶部', icon: 'vertical_align_top', desc: '居中停 5 秒' },
  bottom: { label: '底部', icon: 'vertical_align_bottom', desc: '居中停 5 秒' }
}

const sizeConfig = {
  '16px': { label: '小号', text: '16px' },
  '20px': { label: '标准', text: '20px' },
  '26px': { label: '大字', text: '26px' }
}

const closeAllPopups = () => {
  isModeMenuOpen.value = false
  isSizeMenuOpen.value = false
  isSubtitleMenuOpen.value = false
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
    class="fixed inset-0 z-50 flex flex-col justify-between bg-black/92 backdrop-blur-3xl p-2 sm:p-6 select-none overflow-hidden"
    @click="closeAllPopups"
  >
    <input ref="fileInputRef" type="file" accept=".vtt,.srt,.ass,.ssa" class="hidden" @change="handleLocalSubtitleLoad" />

    <!-- 顶栏标题与操作 -->
    <div class="flex items-center justify-between pb-2 shrink-0 z-20">
      <div class="flex items-center gap-2 max-w-[65vw]">
        <span class="text-sm sm:text-base font-bold text-white truncate">{{ resource?.name }}</span>
        <span
          v-if="parsedTracks.length > 0"
          class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 shrink-0 font-mono"
        >
          {{ parsedTracks.length }} 轨字幕
        </span>
      </div>

      <div class="flex items-center gap-2">
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

    <!-- 🌟 核心播放视窗容器 (超大范围 YouTube 氛围灯) -->
    <div
      class="flex-1 w-full max-w-5xl mx-auto flex flex-col justify-center items-center overflow-visible min-h-0 relative"
      :style="{ '--sub-font-size': subtitleFontSize }"
    >
      <div v-if="type === 'image'" class="h-full flex items-center justify-center z-10">
        <img :src="url" class="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl" />
      </div>

      <div v-else class="w-full flex flex-col relative z-10">
        <!-- 🌟 YouTube 氛围灯 (180% 扩展，自适应吞没黑边) -->
        <canvas
          v-show="isAmbientEnabled"
          ref="ambientCanvasRef"
          class="youtube-super-ambient pointer-events-none"
        ></canvas>

        <!-- 🌟 播放器主体卡片：彻底去除黑色背景遮挡，改用微阴影，使氛围光自然透到底栏 -->
        <div class="w-full flex flex-col rounded-[24px] sm:rounded-[28px] overflow-hidden bg-transparent shadow-[0_12px_48px_rgba(0,0,0,0.35)] relative z-10">
          
          <!-- 视频播放层 -->
          <div class="w-full aspect-video bg-black relative overflow-hidden">
            <!-- 🌟 核心修复 1：将字幕渲染层直接放入 #xgplayer-core 内部！无论普通还是全屏，100% 正常显示！ -->
            <div id="xgplayer-core" class="w-full h-full relative">
              <!-- 🌟 核心修复 2：打开字幕菜单时，自动避让隐藏字幕，绝不再挡住字幕选单！ -->
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

          <!-- 🌟 核心修复 3：弹幕栏不透明度调为 40% (背后的氛围光芒完全透入) + 手机自适应折叠布局 -->
          <div class="p-3 sm:p-3.5 ambient-translucent-bar flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 border-t border-white/5 relative z-10" @click.stop>
            
            <!-- 输入行 + 移动端发送按钮 -->
            <div class="flex items-center gap-2 w-full flex-1">
              <input
                v-model="danmuText"
                @keyup.enter="sendCustomDanmu"
                placeholder="发条弹幕参与讨论吧..."
                class="flex-1 w-full bg-[var(--md-sys-color-surface-container-high)]/80 text-xs px-4 py-2 sm:py-2.5 rounded-full outline-none text-[var(--md-sys-color-on-surface)]"
              />
              <md-filled-button @click="sendCustomDanmu" class="h-8 sm:hidden shrink-0">
                <span class="material-symbols-outlined text-xs" slot="icon">send</span>
              </md-filled-button>
            </div>

            <!-- 控制工具集 (手机端自适应折叠流排版) -->
            <div class="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 shrink-0">
              
              <!-- 1. 字幕选单 -->
              <div class="relative">
                <button
                  type="button"
                  @click="isSubtitleMenuOpen = !isSubtitleMenuOpen; isModeMenuOpen = false; isSizeMenuOpen = false"
                  class="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  :class="activeTrackId !== 'off' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[var(--md-sys-color-surface-container-high)] opacity-70'"
                >
                  <span class="material-symbols-outlined text-base">closed_caption</span>
                  <span class="text-[11px]">{{ activeTrackId === 'off' ? '字幕关' : '字幕开' }}</span>
                </button>

                <!-- 选单向上展开并赋予最高层级 z-50 -->
                <div
                  v-if="isSubtitleMenuOpen"
                  class="popover-menu absolute bottom-12 right-0 w-64 p-3 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] shadow-2xl border border-white/10 flex flex-col gap-2.5 z-50 backdrop-blur-2xl"
                >
                  <!-- 时间轴同步微调 -->
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

                  <!-- 字号调节 -->
                  <div class="flex flex-col gap-1.5 pb-2 border-b border-white/10">
                    <span class="text-[10px] font-bold opacity-60">字幕大小调节</span>
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
                        :class="subtitleFontSize === s.val ? 'bg-[var(--md-sys-color-primary)] text-white' : 'bg-white/5 opacity-70 hover:opacity-100'"
                      >
                        {{ s.label }}
                      </button>
                    </div>
                  </div>

                  <!-- 轨道列表 -->
                  <div class="flex flex-col gap-1 max-h-40 overflow-y-auto pr-0.5">
                    <button
                      @click="selectSubtitleTrack('off')"
                      class="px-3 py-1.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer"
                      :class="activeTrackId === 'off' ? 'bg-[var(--md-sys-color-primary)] text-white' : 'opacity-70 hover:opacity-100'"
                    >
                      <span>关闭字幕</span>
                      <span v-if="activeTrackId === 'off'" class="material-symbols-outlined text-xs">check</span>
                    </button>

                    <button
                      v-for="st in parsedTracks"
                      :key="st.id"
                      @click="selectSubtitleTrack(st.id)"
                      class="px-3 py-1.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between truncate cursor-pointer"
                      :class="activeTrackId === st.id ? 'bg-[var(--md-sys-color-primary)] text-white' : 'opacity-70 hover:opacity-100'"
                    >
                      <span class="truncate">{{ st.label }}</span>
                      <span v-if="activeTrackId === st.id" class="material-symbols-outlined text-xs shrink-0">check</span>
                    </button>
                  </div>

                  <!-- 手动导入入口 -->
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

              <!-- 2. 模式 (三选一) -->
              <div class="relative">
                <button
                  type="button"
                  @click="isModeMenuOpen = !isModeMenuOpen; isSizeMenuOpen = false; isSubtitleMenuOpen = false"
                  class="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--md-sys-color-surface-container-high)] opacity-85 hover:opacity-100 transition-all flex items-center gap-1 cursor-pointer"
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
                    class="px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer"
                    :class="danmuMode === key ? 'bg-[var(--md-sys-color-primary)] text-white' : 'opacity-70 hover:opacity-100'"
                  >
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-sm">{{ cfg.icon }}</span>
                      <span>{{ cfg.label }}弹幕</span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- 3. 字号 -->
              <div class="relative">
                <button
                  type="button"
                  @click="isSizeMenuOpen = !isSizeMenuOpen; isModeMenuOpen = false; isSubtitleMenuOpen = false"
                  class="px-2 sm:px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--md-sys-color-surface-container-high)] opacity-85 hover:opacity-100 transition-all flex items-center gap-1 cursor-pointer"
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
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer"
                    :class="danmuSize === key ? 'bg-[var(--md-sys-color-primary)] text-white' : 'opacity-70 hover:opacity-100'"
                  >
                    <span>{{ cfg.label }}</span>
                    <span v-if="danmuSize === key" class="material-symbols-outlined text-xs">check</span>
                  </button>
                </div>
              </div>

              <!-- 4. 氛围灯 -->
              <button
                type="button"
                @click="isAmbientEnabled = !isAmbientEnabled"
                class="w-7 sm:w-8 h-7 sm:h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
                :class="isAmbientEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 opacity-40 hover:opacity-100 text-white'"
                title="切换氛围灯"
              >
                <span class="material-symbols-outlined text-base">flare</span>
              </button>

              <!-- 5. 调色盘 (移动端自动精简) -->
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

              <!-- PC端发送按钮 -->
              <md-filled-button @click="sendCustomDanmu" class="h-8 sm:h-9 hidden sm:inline-flex">
                <span class="material-symbols-outlined text-xs" slot="icon">send</span>
                发送
              </md-filled-button>
            </div>
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

/* 🌟 移动端控制栏等比微缩适配 */
@media (max-width: 640px) {
  :deep(.xgplayer .xgplayer-controls) {
    height: 40px !important;
    padding: 0 6px !important;
  }
  :deep(.xgplayer .xg-icon) {
    width: 28px !important;
    height: 28px !important;
  }
  :deep(.xgplayer .xg-time) {
    font-size: 11px !important;
  }
}

/* 🌟 YouTube 氛围灯 (180% 扩展) */
.youtube-super-ambient {
  position: absolute;
  top: -35%;
  left: -40%;
  width: 180%;
  height: 170%;
  filter: blur(110px) saturate(260%) brightness(1.2);
  opacity: 0.95;
  pointer-events: none;
  z-index: 1;
  border-radius: 80px;
  transition: opacity 0.4s ease;
}

/* 🌟 核心修复：弹幕栏 40% 不透明度 + 高斯模糊，氛围流光完整透入 */
.ambient-translucent-bar {
  background: rgba(18, 20, 24, 0.40) !important;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

/* 齿轮面板安全防遮挡 */
:deep(.xgplayer .xgplayer-danmu-panel) {
  position: absolute !important;
  bottom: 78px !important;
  right: 18px !important;
  max-height: calc(100% - 100px) !important;
  overflow-y: auto !important;
  border-radius: 24px !important;
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

/* 🌟 自研字幕渲染层 (背景完全透明 + 深灰描边 + 投影) */
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