<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { importEncryptionKey, decryptApiPayload } from '../../utils/crypto'

const props = defineProps<{
  currentTitle: string
  isHome: boolean
  isDark: boolean
}>()

const islandState = ref<'idle' | 'compact' | 'expanded'>('idle')
const expandedView = ref<'player' | 'lyrics' | 'playlist'>('player')
const playMode = ref<'random' | 'sequential' | 'loop'>('random')
const isAutoplayBlocked = ref(false)

export interface LyricLine {
  time: number
  text: string
}

export interface MusicTrack {
  id: number
  name: string
  title: string
  artist: string
  resource: any
  coverUrl: string
  lyrics: LyricLine[]
}

const playlist = ref<MusicTrack[]>([])
const currentIndex = ref(0)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const isLoadingMusic = ref(false)
const isDeciphering = ref(false)
const isScraping = ref(false)
const currentLoadedTrackId = ref<number | null>(null)

const lyricsScrollRef = ref<HTMLDivElement | null>(null)

const useMemoryFallback = ref(sessionStorage.getItem('music_stream_fallback') === 'true')
const audioElement = ref<HTMLAudioElement | null>(null)
const domeCanvasRef = ref<HTMLCanvasElement | null>(null)

let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let audioSourceNode: MediaElementAudioSourceNode | null = null
let animFrameId: any = null

const currentTrack = computed(() => playlist.value[currentIndex.value] || null)
const islandEqBars = ref<number[]>([3, 3, 3, 3])

const formatTime = (secs: number) => {
  if (isNaN(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

const remainingTime = computed(() => {
  const rem = duration.value - currentTime.value
  return `-${formatTime(Math.max(0, rem))}`
})

const getAudioMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = { flac: 'audio/flac', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac' ,opus: 'audio/opus'}
  return map[ext] || 'audio/mpeg'
}

// =========================================================
// 🌟 1. 扩充至 6 源并发无阻塞刮削引擎 (CORS 免疫 + 全网兜底)
// =========================================================
const parseLrcText = (lrcStr: string): LyricLine[] => {
  if (!lrcStr) return []
  const result: LyricLine[] = []
  for (const line of lrcStr.split(/\r?\n/)) {
    const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/)
    if (match) {
      const min = parseInt(match[1], 10), sec = parseInt(match[2], 10), ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0
      const text = match[4].trim()
      if (text) result.push({ time: min * 60 + sec + ms / 1000, text })
    }
  }
  return result.sort((a, b) => a.time - b.time)
}

const scrapeTrackMetadataAndLyrics = async (track: MusicTrack) => {
  if (track.coverUrl && track.lyrics.length > 0) return
  isScraping.value = true
  const searchQuery = `${track.title} ${track.artist}`.replace(/unknown|未知/gi, '').trim()

  try {
    // 源 1: LRCLIB (全球开源歌词首选)
    const lrcP = fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json()).then(list => {
      if (list[0]) {
        if (list[0].syncedLyrics && track.lyrics.length === 0) track.lyrics = parseLrcText(list[0].syncedLyrics)
        if (list[0].artistName && track.artist === '未知歌手') track.artist = list[0].artistName
        if (list[0].trackName) track.title = list[0].trackName
      }
    }).catch(() => {})

    // 源 2: iTunes API (600x600 超清封面首选)
    const itunesP = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&entity=song&limit=1`).then(r => r.json()).then(data => {
      if (data.results[0]?.artworkUrl100 && !track.coverUrl) {
        track.coverUrl = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb')
      }
    }).catch(() => {})

    // 源 3: Deezer Open API (跨国封面与元数据)
    const deezerP = fetch(`https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}&limit=1`).then(r => r.json()).then(data => {
      if (data.data && data.data[0]?.album?.cover_xl && !track.coverUrl) {
        track.coverUrl = data.data[0].album.cover_xl
      }
    }).catch(() => {})

    // 源 4: Meting (网易云/QQ 镜像，华语兜底)
    const metingP = fetch(`https://api.injahow.cn/meting/?type=search&keyword=${encodeURIComponent(searchQuery)}`).then(r => r.json()).then(async list => {
      const first = list[0]
      if (first?.pic && !track.coverUrl) track.coverUrl = first.pic
      if (first?.id && track.lyrics.length === 0) {
        const lrcRes = await fetch(`https://api.injahow.cn/meting/?type=lrc&id=${first.id}`).then(r => r.json())
        if (lrcRes?.lyric) track.lyrics = parseLrcText(lrcRes.lyric)
      }
    }).catch(() => {})

    // 源 5: UOMG API (网易云直连)
    const uomgP = fetch(`https://api.uomg.com/api/search/netease?words=${encodeURIComponent(searchQuery)}`).then(r => r.json()).then(data => {
      if (data.code === 1 && data.data?.[0]?.picurl && !track.coverUrl) {
        track.coverUrl = data.data[0].picurl
      }
    }).catch(() => {})

    // 源 6: MusicBrainz (维基数据兜底)
    const mbP = fetch(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(searchQuery)}&fmt=json&limit=1`).then(r => r.json()).then(data => {
      if (data.recordings[0]?.['artist-credit']?.[0]?.name && track.artist === '未知歌手') {
        track.artist = data.recordings[0]['artist-credit'][0].name
      }
    }).catch(() => {})

    await Promise.allSettled([lrcP, itunesP, deezerP, metingP, uomgP, mbP])

    // 如果全网都没查到封面，给个默认图
    if (!track.coverUrl) {
      track.coverUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop'
    }
  } finally {
    isScraping.value = false
  }
}

// =========================================================
// 🌟 2. 下载中心扫描与媒体获取
// =========================================================
const scanDownloadCenterMusic = async () => {
  const settings = (window as any).settings || {}
  const baseUrl = (settings.download_center_url || 'https://install.reia.fans').replace(/\/+$/, '')
  const token = localStorage.getItem('reiadown_token')
  if (!token) return

  isLoadingMusic.value = true
  try {
    const rootRes = await fetch(`${baseUrl}/api/admin/resources?parentId=0`, { headers: { Authorization: `Bearer ${token}` } })
    if (!rootRes.ok) return
    const allResources: any[] = (await rootRes.json()).resources || []

    const musicFolder = allResources.find((r) => r.type === 'folder' && (r.name.toLowerCase() === 'music' || r.name.includes('音乐')))
    let filesToParse = allResources
    if (musicFolder) {
      const subRes = await fetch(`${baseUrl}/api/admin/resources?parentId=${musicFolder.id}`, { headers: { Authorization: `Bearer ${token}` } })
      filesToParse = (await subRes.json()).resources || []
    }

    const audioFiles = filesToParse.filter((r) => r.type === 'file' && /\.(flac|mp3|wav|ogg|m4a|aac|opus)$/i.test(r.name))
    if (audioFiles.length === 0) return

    playlist.value = audioFiles.map((f: any) => {
      const cleanName = f.name.replace(/\.[^/.]+$/, '')
      let artist = '未知歌手', title = cleanName
      if (cleanName.includes(' - ')) {
        const parts = cleanName.split(' - ')
        artist = parts[0].trim()
        title = parts.slice(1).join(' - ').trim()
      }
      return { id: f.id, name: f.name, title, artist, resource: f, coverUrl: '', lyrics: [] }
    })

    if (playlist.value.length > 0 && !isPlaying.value) {
      currentIndex.value = Math.floor(Math.random() * playlist.value.length)
      triggerAutoStart()
    }
  } catch (err) {
  } finally {
    isLoadingMusic.value = false
  }
}

const triggerAutoStart = async () => {
  try {
    await playMusic()
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      isAutoplayBlocked.value = true
      if (islandState.value === 'idle') islandState.value = 'compact'
    }
  }
}

const prepareTrackAudioSource = async (track: MusicTrack): Promise<string> => {
  const settings = (window as any).settings || {}
  const baseUrl = (settings.download_center_url || 'https://install.reia.fans').replace(/\/+$/, '')
  const token = localStorage.getItem('reiadown_token') || ''

  const res = await fetch(`${baseUrl}/api/resources/${track.id}/download`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const rawData = await res.json()
  const data = rawData.e2ee ? await decryptApiPayload(rawData, token) : rawData
  if (!data.success) throw new Error(data.message)

  if (data.isLink || !data.is_encrypted) return data.downloadUrl || data.downloadUrls[0]

  const mimeType = getAudioMimeType(track.name)
  const swController = navigator.serviceWorker?.controller

  // 尝试走 SW 虚拟串流
  if (!useMemoryFallback.value && swController) {
    try {
      const streamId = `music_${track.id}_${Date.now()}`
      const manifest = { file_size: track.resource.file_size, chunk_size: 10 * 1024 * 1024, urls: data.downloadUrls, encrypt_key: data.encrypt_key, mime_type: mimeType }
      const channel = new MessageChannel()
      const registered = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 1500)
        channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data?.success === true) }
        swController.postMessage({ type: 'REGISTER_STREAM', id: streamId, manifest }, [channel.port2])
      })
      if (registered) return `/e2ee-stream/${streamId}`
    } catch (e) {}
  }

  // 内存解密回退
  sessionStorage.setItem('music_stream_fallback', 'true')
  useMemoryFallback.value = true

  const key = await importEncryptionKey(data.encrypt_key)
  const decryptedParts: Uint8Array[] = []
  for (const u of data.downloadUrls) {
    const encBuf = await (await fetch(u)).arrayBuffer()
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(encBuf.slice(0, 12)) }, key, encBuf.slice(12))
    decryptedParts.push(new Uint8Array(dec))
  }

  const combined = new Uint8Array(decryptedParts.reduce((acc, b) => acc + b.length, 0))
  let offset = 0
  for (const b of decryptedParts) { combined.set(b, offset); offset += b.length }

  return URL.createObjectURL(new Blob([combined.buffer], { type: mimeType }))
}

const toggleFallbackMode = () => {
  if (useMemoryFallback.value) { sessionStorage.removeItem('music_stream_fallback'); useMemoryFallback.value = false }
  else { sessionStorage.setItem('music_stream_fallback', 'true'); useMemoryFallback.value = true }
}

const cyclePlayMode = () => {
  if (playMode.value === 'random') playMode.value = 'sequential'
  else if (playMode.value === 'sequential') playMode.value = 'loop'
  else playMode.value = 'random'
}
const playModeIcon = computed(() => ({ 'random': 'shuffle', 'sequential': 'repeat', 'loop': 'repeat_one' }[playMode.value]))

const playModeTooltip = computed(() => {
  switch (playMode.value) {
    case 'random': return '随机播放'
    case 'sequential': return '顺序播放'
    case 'loop': return '单曲循环'
    default: return '播放模式'
  }
})

const updateSystemMediaSession = () => {
  if (!('mediaSession' in navigator) || !currentTrack.value) return
  navigator.mediaSession.metadata = new MediaMetadata({
    title: currentTrack.value.title, artist: currentTrack.value.artist, album: 'Xboard 音乐中心',
    artwork: [{ src: currentTrack.value.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
  })
  navigator.mediaSession.setActionHandler('play', playMusic)
  navigator.mediaSession.setActionHandler('pause', pauseMusic)
  navigator.mediaSession.setActionHandler('previoustrack', prevTrack)
  navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(false))
}

const initAudioContext = () => {
  if (audioCtx || !audioElement.value) return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    audioCtx = new AudioContextClass()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.85
    audioSourceNode = audioCtx.createMediaElementSource(audioElement.value)
    audioSourceNode.connect(analyser)
    analyser.connect(audioCtx.destination)
    startVisualizerLoop()
  } catch (e) {}
}

const startVisualizerLoop = () => {
  if (!domeCanvasRef.value || !analyser) return
  const canvas = domeCanvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dataArray = new Uint8Array(analyser.frequencyBinCount)

  const draw = () => {
    animFrameId = requestAnimationFrame(draw)
    const w = canvas.width = window.innerWidth
    const baseRadius = w / 2
    const h = canvas.height = Math.min(baseRadius + 140, 420)

    if (!isPlaying.value) {
      ctx.clearRect(0, 0, w, h); islandEqBars.value = [3, 3, 3, 3]; return
    }

    analyser!.getByteFrequencyData(dataArray)
    ctx.clearRect(0, 0, w, h)

    islandEqBars.value[0] += (Math.max(3, (dataArray[2] / 255) * 13) - islandEqBars.value[0]) * 0.35
    islandEqBars.value[1] += (Math.max(3, (dataArray[5] / 255) * 14) - islandEqBars.value[1]) * 0.35
    islandEqBars.value[2] += (Math.max(3, (dataArray[9] / 255) * 13) - islandEqBars.value[2]) * 0.35
    islandEqBars.value[3] += (Math.max(3, (dataArray[14] / 255) * 11) - islandEqBars.value[3]) * 0.35

    const centerX = w / 2
    // 🌟 视觉优化：下沉半球圆心 100px，形成地平线升起的柔和曙光效果
    const centerY = h - 100 
    const totalRays = 48
    const breathHue = (performance.now() / 40) % 360

    ctx.save()
    for (let i = 0; i < totalRays; i++) {
      const angle = Math.PI + (i / totalRays) * Math.PI
      const val = dataArray[Math.floor((i / totalRays) * dataArray.length * 0.75)] || 0
      const rayLen = baseRadius + (val / 255) * 100

      const x1 = centerX + Math.cos(angle) * baseRadius
      const y1 = centerY + Math.sin(angle) * baseRadius
      const x2 = centerX + Math.cos(angle) * rayLen
      const y2 = centerY + Math.sin(angle) * rayLen

      const grad = ctx.createLinearGradient(x1, y1, x2, y2)
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)')
      grad.addColorStop(0.6, 'rgba(236, 72, 153, 0.15)')
      grad.addColorStop(1, 'rgba(251, 191, 36, 0)')

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.strokeStyle = grad
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.stroke()
    }
    const innerGlow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, baseRadius + 40)
    innerGlow.addColorStop(0, 'rgba(56, 189, 248, 0.15)')
    innerGlow.addColorStop(0.8, 'rgba(236, 72, 153, 0.05)')
    innerGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = innerGlow
    ctx.beginPath()
    ctx.arc(centerX, centerY, baseRadius + 40, Math.PI, 0, false)
    ctx.fill()
    ctx.restore()
  }
  draw()
}

const activeLyricIndex = computed(() => {
  if (!currentTrack.value?.lyrics?.length) return -1
  const t = currentTime.value
  const list = currentTrack.value.lyrics
  for (let i = list.length - 1; i >= 0; i--) if (t >= list[i].time) return i
  return 0
})

watch(activeLyricIndex, (newIdx) => {
  if (expandedView.value === 'lyrics' && lyricsScrollRef.value && newIdx >= 0) {
    nextTick(() => {
      const activeEl = lyricsScrollRef.value?.querySelector(`.lyric-line-${newIdx}`) as HTMLElement
      if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
})

// =========================================================
// 🌟 3. 极度强壮的播放控制引擎 (异常拦截自动降级、超时自动切歌)
// =========================================================
const playMusic = async () => {
  if (!audioElement.value || !currentTrack.value) return
  if (isDeciphering.value) return 

  if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume()
  else initAudioContext()

  isDeciphering.value = true
  let timeoutTriggered = false

  // 设立 8 秒物理超时熔断器：如果流媒体拉取死锁，自动跳过此曲！
  const fallbackTimer = setTimeout(() => {
    timeoutTriggered = true
    isDeciphering.value = false
    console.warn('[Music] 解密加载超时，自动跳下一首防卡死')
    nextTrack()
  }, 8000)

  try {
    if (!audioElement.value.src || currentLoadedTrackId.value !== currentTrack.value.id) {
      audioElement.value.src = '' // 物理清空旧流防崩溃
      const realAudioSrc = await prepareTrackAudioSource(currentTrack.value)
      if (timeoutTriggered) return // 已经超时切走了，丢弃迟来的数据
      audioElement.value.src = realAudioSrc
      currentLoadedTrackId.value = currentTrack.value.id
    }

    await audioElement.value.play()
    clearTimeout(fallbackTimer)
    isPlaying.value = true
    isAutoplayBlocked.value = false
    
    // 只有真实出声时才优雅展开胶囊
    if (islandState.value === 'idle') islandState.value = 'compact'
    
    updateSystemMediaSession()
    scrapeTrackMetadataAndLyrics(currentTrack.value)
  } catch (e: any) {
    clearTimeout(fallbackTimer)
    if (e.name === 'NotAllowedError') {
      // 浏览器自动播放拦截
      isAutoplayBlocked.value = true
    } else {
      // 🌟 核心：流媒体断流、网络崩溃自动自愈！
      console.warn('[Music] 播放崩溃，自动降级内存模式并重试:', e)
      if (!useMemoryFallback.value) {
        toggleFallbackMode()
        setTimeout(() => playMusic(), 1000) // 降级后再试一次
      } else {
        setTimeout(() => nextTrack(), 2000) // 连内存模式都炸了，跳过此曲
      }
    }
  } finally {
    if (!timeoutTriggered) isDeciphering.value = false
  }
}

const pauseMusic = () => {
  if (audioElement.value) { audioElement.value.pause(); isPlaying.value = false }
}
const togglePlay = () => isPlaying.value ? pauseMusic() : playMusic()

const nextTrack = (isAutoEnded = false) => {
  if (playlist.value.length === 0) return
  if (playMode.value === 'loop' && isAutoEnded) {
    if (audioElement.value) { audioElement.value.currentTime = 0; audioElement.value.play() }
    return
  }
  if (playMode.value === 'random') {
    if (playlist.value.length > 1) {
      let nextIdx = currentIndex.value
      while (nextIdx === currentIndex.value) nextIdx = Math.floor(Math.random() * playlist.value.length)
      currentIndex.value = nextIdx
    }
  } else {
    currentIndex.value = (currentIndex.value + 1) % playlist.value.length
  }
  playMusic()
}

const prevTrack = () => {
  if (playlist.value.length === 0) return
  if (audioElement.value && audioElement.value.currentTime > 3) { audioElement.value.currentTime = 0; return }
  if (playMode.value === 'random' && playlist.value.length > 1) {
    let nextIdx = currentIndex.value
    while (nextIdx === currentIndex.value) nextIdx = Math.floor(Math.random() * playlist.value.length)
    currentIndex.value = nextIdx
  } else {
    currentIndex.value = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length
  }
  playMusic()
}

const onTimeUpdate = () => {
  if (audioElement.value) {
    currentTime.value = audioElement.value.currentTime
    duration.value = audioElement.value.duration || 0
  }
}

const seek = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement
  const percent = (e.clientX - target.getBoundingClientRect().left) / target.getBoundingClientRect().width
  if (audioElement.value && duration.value > 0) audioElement.value.currentTime = percent * duration.value
}

// =========================================================
// 🌟 4. 彻底解决手机端点击无响应 (移除 Touch 干扰，统一 Click 派发)
// =========================================================
const handleContextMenu = (e: MouseEvent) => {
  e.preventDefault()
  if (islandState.value !== 'idle') {
    islandState.value = islandState.value === 'expanded' ? 'compact' : 'expanded'
  } else if (playlist.value.length > 0) {
    playMusic()
  }
}

const handleIslandClick = () => {
  if (isAutoplayBlocked.value) {
    isAutoplayBlocked.value = false
    playMusic()
    return
  }
  if (islandState.value === 'compact') {
    islandState.value = 'expanded'
  }
}

onMounted(() => {
  scanDownloadCenterMusic()
})

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (audioCtx) audioCtx.close()
})
</script>

<template>
  <!-- 🌟 点击事件挂载于根系，绝不被 flex 吞噬 -->
  <div 
    class="relative flex items-center justify-center select-none w-full max-w-[360px] h-full"
    @click="handleIslandClick"
    @contextmenu="handleContextMenu"
  >
    <audio ref="audioElement" @timeupdate="onTimeUpdate" @ended="nextTrack(true)" crossorigin="anonymous"></audio>

    <div
      class="island-fluid-shell will-change-[width,height,border-radius,background-color] [transform:translateZ(0)]"
      :class="[
        islandState === 'idle' 
          ? (isHome ? 'island-idle-home' : 'island-idle-sub') 
          : (islandState === 'compact' ? 'island-compact' : 'island-expanded'),
        isDark ? 'island-theme-dark' : 'island-theme-light'
      ]"
    >
      <div v-if="islandState === 'idle'" class="w-full h-full flex items-center justify-center">
        <Transition name="fade-spring" mode="out-in">
          <div :key="currentTitle + (isHome ? '-home' : '-sub')" class="flex items-center justify-center px-4 w-full">
            <span
              class="font-black tracking-tight whitespace-nowrap truncate select-none text-xs sm:text-sm md:text-base flex-1 text-center"
              :class="isHome ? 'drop-shadow-md text-[var(--md-sys-color-on-surface)]' : ''"
            >
              {{ currentTitle }}
            </span>

            <div
              v-if="isAutoplayBlocked && playlist.length > 0"
              class="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 transition-all flex items-center gap-0.5 animate-pulse shrink-0"
              title="点击激活背景音乐"
            >
              <span class="material-symbols-outlined text-xs">music_note</span>
              <span>启播</span>
            </div>
          </div>
        </Transition>
      </div>

      <!-- 🌟 极致精简版：仅专辑图 + 标题 + 频谱 (杜绝挤压换行) -->
      <div
        v-else-if="islandState === 'compact'"
        class="w-full h-full flex items-center justify-between px-2.5 overflow-hidden"
      >
        <div v-if="isAutoplayBlocked" class="w-full flex items-center justify-center gap-2 text-cyan-300 font-bold text-xs animate-pulse">
          <span class="material-symbols-outlined text-base">music_note</span>
          <span>点击启播</span>
        </div>

        <template v-else>
          <!-- 封面 -->
          <div class="w-6 h-6 min-w-[24px] max-w-[24px] rounded-full overflow-hidden shrink-0 shadow-sm relative mr-2 border border-white/20">
            <img :src="currentTrack?.coverUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop'" class="w-full h-full object-cover" :class="{ 'animate-spin-slow': isPlaying }" />
          </div>

          <!-- 页面标题 -->
          <span class="text-[11px] sm:text-xs font-black tracking-tight text-white flex-1 truncate text-center mx-1">
            {{ currentTitle }}
          </span>

          <!-- 真音频频谱 -->
          <div class="flex items-end gap-0.5 h-3 px-1 shrink-0 ml-1">
            <span v-for="(val, idx) in islandEqBars" :key="idx" class="w-0.5 rounded-full bg-cyan-400 transition-[height] duration-75 ease-out" :style="{ height: `${val}px` }"></span>
          </div>
        </template>
      </div>

      <!-- 大控制器 -->
      <div
        v-else-if="islandState === 'expanded'"
        class="w-full h-full p-5 flex flex-col justify-between overflow-hidden"
        @contextmenu.prevent.stop="islandState = 'compact'"
        @click.stop
      >
        <div class="flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3.5 truncate min-w-0">
            <img :src="currentTrack?.coverUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&fit=crop'" class="w-12 h-12 rounded-2xl object-cover shadow-md shrink-0" />
            <div class="flex flex-col truncate min-w-0">
              <h4 class="font-extrabold text-sm truncate tracking-tight text-white">{{ currentTrack?.title }}</h4>
              <span class="text-xs text-white/60 truncate mt-0.5">{{ currentTrack?.artist }}</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <div class="flex p-0.5 rounded-full bg-white/10 text-[10px] font-bold">
              <button @click.stop="expandedView = 'player'" class="px-2 py-0.5 rounded-full transition-all" :class="expandedView === 'player' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'">控制</button>
              <button @click.stop="expandedView = 'lyrics'" class="px-2 py-0.5 rounded-full transition-all flex items-center gap-0.5" :class="expandedView === 'lyrics' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'">
                <span>词</span>
                <span v-if="currentTrack?.lyrics?.length > 0" class="w-1 h-1 rounded-full bg-cyan-400"></span>
              </button>
            </div>
            <button @click.stop="islandState = 'compact'" class="w-7 h-7 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 bg-white/10 text-white transition-all"><span class="material-symbols-outlined text-sm">keyboard_arrow_up</span></button>
          </div>
        </div>

        <div v-if="expandedView === 'player'" class="flex flex-col gap-1.5 my-2">
          <div class="w-full h-1.5 rounded-full bg-white/20 cursor-pointer relative overflow-hidden" @click.stop="seek">
            <div class="h-full bg-white rounded-full transition-all duration-150" :style="{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }"></div>
          </div>
          <div class="flex justify-between text-[10px] font-mono text-white/60 px-0.5">
            <span>{{ formatTime(currentTime) }}</span><span>{{ remainingTime }}</span>
          </div>
        </div>

        <div v-else-if="expandedView === 'lyrics'" ref="lyricsScrollRef" class="my-2 h-24 overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-none text-center relative" @click.stop>
          <div v-if="!currentTrack?.lyrics?.length" class="py-8 text-xs text-white/40">{{ isScraping ? '全网寻词中...' : '暂无同步歌词' }}</div>
          <div v-else v-for="(line, idx) in currentTrack.lyrics" :key="idx" :class="[`lyric-line-${idx}`, 'transition-all duration-300 text-xs select-none', idx === activeLyricIndex ? 'text-cyan-300 font-extrabold scale-105 drop-shadow' : 'text-white/40 font-medium']">
            {{ line.text }}
          </div>
        </div>

        <div v-else-if="expandedView === 'playlist'" class="my-2 h-24 overflow-y-auto pr-1 flex flex-col gap-1" @click.stop>
          <div v-for="(t, idx) in playlist" :key="t.id" @click.stop="currentIndex = idx; playMusic()" class="p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all text-white" :class="currentIndex === idx ? 'bg-white/20 font-bold' : 'opacity-70 hover:opacity-100 hover:bg-white/5'">
            <span class="truncate mr-2">{{ t.title }} - {{ t.artist }}</span>
            <span v-if="currentIndex === idx" class="material-symbols-outlined text-sm shrink-0">equalizer</span>
          </div>
        </div>

        <div class="flex items-center justify-between pt-1 shrink-0">
          <div class="flex items-center gap-1">
            <button @click.stop="cyclePlayMode" class="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all" :title="playModeTooltip"><span class="material-symbols-outlined text-lg">{{ playModeIcon }}</span></button>
            <button @click.stop="expandedView = expandedView === 'playlist' ? 'player' : 'playlist'" class="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all" title="查看列表"><span class="material-symbols-outlined text-lg">queue_music</span></button>
          </div>

          <div class="flex items-center gap-4 text-white">
            <button @click.stop="prevTrack" class="opacity-80 hover:opacity-100 active:scale-90 transition-all"><span class="material-symbols-outlined text-2xl">fast_rewind</span></button>
            <button @click.stop="togglePlay" :disabled="isDeciphering" class="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-all"><span class="material-symbols-outlined text-3xl">{{ isPlaying ? 'pause' : 'play_arrow' }}</span></button>
            <button @click.stop="nextTrack(false)" class="opacity-80 hover:opacity-100 active:scale-90 transition-all"><span class="material-symbols-outlined text-2xl">fast_forward</span></button>
          </div>

          <div class="flex items-center gap-1.5">
            <button @click.stop="toggleFallbackMode" class="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono transition-all" :class="useMemoryFallback ? 'bg-amber-500/20 text-amber-300' : 'bg-cyan-500/20 text-cyan-300'">{{ useMemoryFallback ? '内存' : 'SW' }}</button>
            <button @click.stop="scanDownloadCenterMusic" class="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all" :class="{ 'animate-spin': isLoadingMusic }"><span class="material-symbols-outlined text-base">refresh</span></button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部半球太阳辐射声波可视化 -->
    <Teleport to="body">
      <canvas ref="domeCanvasRef" class="fixed left-0 right-0 pointer-events-none z-10 osu-dome-canvas" style="bottom: -100px;"></canvas>
    </Teleport>
  </div>
</template>

<style scoped>
/* 🌟 核心：永远使用绝对居中的定位法进行弹簧宽度形变，确保 100% 圆润和居中对齐！ */
.island-fluid-shell {
  position: absolute !important;
  left: 50% !important;
  top: 0 !important;
  transform: translateX(-50%) translateZ(0) !important;
  
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  
  /* 🌟 从 22px 到 36px 全程纯数值插值，绝对不会变方块 */
  transition:
    width 0.48s cubic-bezier(0.34, 1.56, 0.64, 1),
    height 0.48s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-radius 0.48s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.3s ease,
    box-shadow 0.4s ease;
}

.island-idle-home {
  width: 150px;
  height: 44px;
  border-radius: 22px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.island-idle-sub {
  width: 140px;
  height: 44px;
  border-radius: 22px;
}

/* 🌟 极致精简：微缩播放态去除了跑马灯，仅留封面+标题+声波，绝不挤压 */
.island-compact {
  width: clamp(160px, calc(100vw - 180px), 240px);
  height: 44px;
  border-radius: 22px !important; 
  background: rgba(0, 0, 0, 0.94) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5) !important;
}

.island-expanded {
  width: min(350px, calc(100vw - 32px));
  height: 205px;
  border-radius: 36px !important;
  background: rgba(0, 0, 0, 0.95) !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7) !important;
  z-index: 50;
}

.osu-dome-canvas {
  opacity: 0.40 !important;
}

.fade-spring-enter-active,
.fade-spring-leave-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-spring-enter-from {
  opacity: 0;
  transform: scale(0.85) translateY(4px);
}
.fade-spring-leave-to {
  opacity: 0;
  transform: scale(0.85) translateY(-4px);
}

.island-theme-dark {
  background: rgba(18, 20, 24, 0.88);
  color: #ffffff;
  border: 1.2px solid transparent;
  background-clip: padding-box, border-box;
  background-origin: padding-box, border-box;
  background-image:
    linear-gradient(to bottom, rgba(22, 26, 34, 0.92), rgba(14, 18, 24, 0.95)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(130, 215, 255, 0.45) 28%, rgba(240, 140, 255, 0.35) 60%, rgba(255, 230, 130, 0.3) 82%, rgba(255, 255, 255, 0.75) 100%);
  box-shadow: inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.25), inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.6), 0 16px 36px -6px rgba(0, 0, 0, 0.6);
}

.island-theme-light {
  background: rgba(240, 243, 248, 0.88);
  color: #191c20;
  border: 1.2px solid transparent;
  background-clip: padding-box, border-box;
  background-origin: padding-box, border-box;
  background-image:
    linear-gradient(to bottom, rgba(245, 248, 255, 0.92), rgba(230, 236, 246, 0.94)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(150, 210, 255, 0.5) 30%, rgba(255, 170, 240, 0.35) 65%, rgba(255, 255, 255, 0.8) 100%);
  box-shadow: inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 2px 0 rgba(0, 0, 0, 0.06), 0 16px 32px -8px rgba(0, 30, 80, 0.12);
}

.animate-spin-slow {
  animation: spin 8s linear infinite;
}
@keyframes spin {
  100% { transform: rotate(360deg); }
}

.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>