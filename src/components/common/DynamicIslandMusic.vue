<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { importEncryptionKey, decryptApiPayload } from '../../utils/crypto'

const props = defineProps<{
  currentTitle: string
  isHome: boolean
  isDark: boolean
}>()

// 状态：'idle' (标题岛) | 'compact' (播放微缩跑马灯) | 'expanded' (展开大岛)
const islandState = ref<'idle' | 'compact' | 'expanded'>('idle')
const expandedView = ref<'player' | 'lyrics' | 'playlist'>('player')

// 播放模式：'random' (随机) | 'sequential' (顺序) | 'loop' (单曲循环)
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
const statusNotice = ref('')

// 歌词滚动容器引用
const lyricsScrollRef = ref<HTMLDivElement | null>(null)

const useMemoryFallback = ref(sessionStorage.getItem('music_stream_fallback') === 'true')
const audioElement = ref<HTMLAudioElement | null>(null)
const domeCanvasRef = ref<HTMLCanvasElement | null>(null)

let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let audioSourceNode: MediaElementAudioSourceNode | null = null
let animFrameId: any = null

const currentTrack = computed(() => playlist.value[currentIndex.value] || null)

// 真实音频 4 轨动态频谱
const islandEqBars = ref<number[]>([3, 3, 3, 3])

// 🌟 仅曲目滚动的跑马灯内容 (页面标题已固定在左侧，杜绝重叠)
const marqueeSongText = computed(() => {
  if (!currentTrack.value) return '等待曲目加载...'
  return `${currentTrack.value.title} - ${currentTrack.value.artist}`
})

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
  const map: Record<string, string> = {
    flac: 'audio/flac',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac'
  }
  return map[ext] || 'audio/mpeg'
}

// =========================================================
// 🌟 核心：五源开放式开源音乐元数据与歌词刮削系统
// =========================================================
const parseLrcText = (lrcStr: string): LyricLine[] => {
  if (!lrcStr) return []
  const lines = lrcStr.split(/\r?\n/)
  const result: LyricLine[] = []

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/)
    if (match) {
      const min = parseInt(match[1], 10)
      const sec = parseInt(match[2], 10)
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0
      const text = match[4].trim()
      if (text) {
        result.push({
          time: min * 60 + sec + ms / 1000,
          text
        })
      }
    }
  }
  return result.sort((a, b) => a.time - b.time)
}

const scrapeTrackMetadataAndLyrics = async (track: MusicTrack) => {
  if (track.coverUrl && track.lyrics.length > 0) return
  isScraping.value = true

  const searchQuery = `${track.title} ${track.artist}`.replace(/unknown|未知/gi, '').trim()

  try {
    // 🌟 API 1：LRCLIB（全球开源同步歌词首选）
    const lrcPromise = fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`)
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list) && list.length > 0) {
          const best = list[0]
          if (best.syncedLyrics) track.lyrics = parseLrcText(best.syncedLyrics)
          else if (best.plainLyrics) {
            track.lyrics = best.plainLyrics.split('\n').filter(Boolean).map((t: string, i: number) => ({ time: i * 4, text: t }))
          }
          if (best.artistName && track.artist === '未知歌手') track.artist = best.artistName
          if (best.trackName) track.title = best.trackName
        }
      }).catch(() => {})

    // 🌟 API 2：Apple iTunes API（600x600 超清官方封面）
    const itunesPromise = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&entity=song&limit=1`)
      .then(r => r.json())
      .then(data => {
        if (data.results && data.results.length > 0) {
          const item = data.results[0]
          if (item.artworkUrl100 && !track.coverUrl) {
            track.coverUrl = item.artworkUrl100.replace('100x100bb', '600x600bb')
          }
          if (track.artist === '未知歌手' && item.artistName) track.artist = item.artistName
        }
      }).catch(() => {})

    // 🌟 API 3：Meting 开放镜像 (补充华语/ACG歌词与封面)
    const metingPromise = fetch(`https://api.injahow.cn/meting/?type=search&keyword=${encodeURIComponent(searchQuery)}`)
      .then(r => r.json())
      .then(async (list) => {
        if (Array.isArray(list) && list.length > 0 && (!track.coverUrl || track.lyrics.length === 0)) {
          const first = list[0]
          if (!track.coverUrl && first.pic) track.coverUrl = first.pic
          if (track.lyrics.length === 0 && first.id) {
            const lrcRes = await fetch(`https://api.injahow.cn/meting/?type=lrc&id=${first.id}`).then(r => r.json())
            if (lrcRes && lrcRes.lyric) track.lyrics = parseLrcText(lrcRes.lyric)
          }
        }
      }).catch(() => {})

    // 🌟 API 4：MusicBrainz 开放数据库 (备用)
    const mbPromise = fetch(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(searchQuery)}&fmt=json&limit=1`)
      .then(r => r.json())
      .then(data => {
        if (data.recordings && data.recordings.length > 0 && track.artist === '未知歌手') {
          track.artist = data.recordings[0]['artist-credit']?.[0]?.name || track.artist
        }
      }).catch(() => {})

    // 🌟 API 5：Deezer Open API (跨国备用)
    const deezerPromise = fetch(`https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}&limit=1`)
      .then(r => r.json())
      .then(data => {
        if (data.data && data.data.length > 0 && !track.coverUrl) {
          track.coverUrl = data.data[0].album?.cover_xl || data.data[0].album?.cover_big || ''
        }
      }).catch(() => {})

    await Promise.allSettled([lrcPromise, itunesPromise, metingPromise, mbPromise, deezerPromise])

    if (!track.coverUrl) {
      track.coverUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop'
    }
  } finally {
    isScraping.value = false
  }
}

// 扫描 music 目录 (未登录静默隐藏)
const scanDownloadCenterMusic = async () => {
  const settings = (window as any).settings || {}
  const baseUrl = (settings.download_center_url || 'https://install.reia.fans').replace(/\/+$/, '')
  const token = localStorage.getItem('reiadown_token')
  if (!token) return

  isLoadingMusic.value = true
  try {
    const rootRes = await fetch(`${baseUrl}/api/admin/resources?parentId=0`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!rootRes.ok) return
    const rootData = await rootRes.json()
    const allResources: any[] = rootData.resources || []

    const musicFolder = allResources.find(
      (r) => r.type === 'folder' && (r.name.toLowerCase() === 'music' || r.name.includes('音乐'))
    )

    let targetParentId = musicFolder ? musicFolder.id : 0
    let filesToParse: any[] = []

    if (musicFolder) {
      const subRes = await fetch(`${baseUrl}/api/admin/resources?parentId=${targetParentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const subData = await subRes.json()
      filesToParse = subData.resources || []
    } else {
      filesToParse = allResources
    }

    const audioFiles = filesToParse.filter(
      (r) => r.type === 'file' && /\.(flac|mp3|wav|ogg|m4a|aac)$/i.test(r.name)
    )

    if (audioFiles.length === 0) return

    playlist.value = audioFiles.map((f: any) => {
      const cleanName = f.name.replace(/\.[^/.]+$/, '')
      let artist = '未知歌手'
      let title = cleanName
      if (cleanName.includes(' - ')) {
        const parts = cleanName.split(' - ')
        artist = parts[0].trim()
        title = parts.slice(1).join(' - ').trim()
      }

      return {
        id: f.id,
        name: f.name,
        title,
        artist,
        resource: f,
        coverUrl: '',
        lyrics: []
      }
    })

    if (playlist.value.length > 0 && !isPlaying.value) {
      currentIndex.value = Math.floor(Math.random() * playlist.value.length)
      scrapeTrackMetadataAndLyrics(playlist.value[currentIndex.value])
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
    }
  }
}

const prepareTrackAudioSource = async (track: MusicTrack): Promise<string> => {
  const settings = (window as any).settings || {}
  const baseUrl = (settings.download_center_url || 'https://install.reia.fans').replace(/\/+$/, '')
  const token = localStorage.getItem('reiadown_token') || ''

  const res = await fetch(`${baseUrl}/api/resources/${track.id}/download`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const rawData = await res.json()
  const data = rawData.e2ee ? await decryptApiPayload(rawData, token) : rawData
  if (!data.success) throw new Error(data.message)

  if (data.isLink || !data.is_encrypted) {
    return data.downloadUrl || data.downloadUrls[0]
  }

  const mimeType = getAudioMimeType(track.name)

// SW 串流模式
  const sw = navigator.serviceWorker?.controller
  if (!useMemoryFallback.value && sw) {
    try {
      const streamId = `music_${track.id}_${Date.now()}`
      const manifest = {
        file_size: track.resource.file_size,
        chunk_size: 10 * 1024 * 1024,
        urls: data.downloadUrls,
        encrypt_key: data.encrypt_key,
        mime_type: mimeType
      }

      const channel = new MessageChannel()
      const registered = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 1200)
        channel.port1.onmessage = (event) => {
          clearTimeout(timer)
          resolve(event.data?.success === true)
        }
        // 🌟 这里直接用局部常量 sw，彻底杜绝 null 报警
        sw.postMessage({ type: 'REGISTER_STREAM', id: streamId, manifest }, [channel.port2])
      })

      if (registered) {
        statusNotice.value = 'SW 虚拟串流加速中'
        return `/e2ee-stream/${streamId}`
      }
    } catch (e) {
      console.warn('[Music] SW 注册串流失败，回退内存解密')
    }
  }

  sessionStorage.setItem('music_stream_fallback', 'true')
  useMemoryFallback.value = true

  const urls: string[] = data.downloadUrls
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

  const blob = new Blob([combined.buffer], { type: mimeType })
  return URL.createObjectURL(blob)
}

const toggleFallbackMode = () => {
  if (useMemoryFallback.value) {
    sessionStorage.removeItem('music_stream_fallback')
    useMemoryFallback.value = false
  } else {
    sessionStorage.setItem('music_stream_fallback', 'true')
    useMemoryFallback.value = true
  }
}

const cyclePlayMode = () => {
  if (playMode.value === 'random') playMode.value = 'sequential'
  else if (playMode.value === 'sequential') playMode.value = 'loop'
  else playMode.value = 'random'
}

const playModeIcon = computed(() => {
  switch (playMode.value) {
    case 'random': return 'shuffle'
    case 'sequential': return 'repeat'
    case 'loop': return 'repeat_one'
    default: return 'shuffle'
  }
})

const updateSystemMediaSession = () => {
  if (!('mediaSession' in navigator) || !currentTrack.value) return
  navigator.mediaSession.metadata = new MediaMetadata({
    title: currentTrack.value.title,
    artist: currentTrack.value.artist,
    album: 'Xboard 音乐中心',
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
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.82

    audioSourceNode = audioCtx.createMediaElementSource(audioElement.value)
    audioSourceNode.connect(analyser)
    analyser.connect(audioCtx.destination)

    startVisualizerLoop()
  } catch (e) {}
}

const smoothBarHeights = new Float32Array(64)
const startVisualizerLoop = () => {
  if (!domeCanvasRef.value || !analyser) return
  const canvas = domeCanvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)

  const draw = () => {
    animFrameId = requestAnimationFrame(draw)

    const w = (canvas.width = window.innerWidth)
    const baseRadius = w / 2
    // 🌟 画布高度适当放宽，方便整体下沉 100px
    const h = (canvas.height = Math.min(baseRadius + 140, 420))

    if (!isPlaying.value) {
      ctx.clearRect(0, 0, w, h)
      islandEqBars.value = [3, 3, 3, 3]
      return
    }

    analyser!.getByteFrequencyData(dataArray)
    ctx.clearRect(0, 0, w, h)

    // 真音频数据驱动小岛频谱
    const b1 = Math.max(3, (dataArray[2] / 255) * 13)
    const b2 = Math.max(3, (dataArray[5] / 255) * 14)
    const b3 = Math.max(3, (dataArray[9] / 255) * 13)
    const b4 = Math.max(3, (dataArray[14] / 255) * 11)
    islandEqBars.value[0] += (b1 - islandEqBars.value[0]) * 0.35
    islandEqBars.value[1] += (b2 - islandEqBars.value[1]) * 0.35
    islandEqBars.value[2] += (b3 - islandEqBars.value[2]) * 0.35
    islandEqBars.value[3] += (b4 - islandEqBars.value[3]) * 0.35

    // 🌟 osu! 赛博半球渲染
    const centerX = w / 2
    const centerY = h // 辐射底部
    const totalBars = 64
    const now = performance.now()
    const sweepProgress = (now % 2200) / 2200
    const sweepAngle = Math.PI + sweepProgress * Math.PI
    const breathHue = (now / 40) % 360

    ctx.save()
    ctx.beginPath()
    ctx.arc(centerX, centerY, baseRadius, Math.PI, 0, false)
    ctx.strokeStyle = `hsla(${breathHue}, 90%, 65%, 0.25)`
    ctx.lineWidth = 2
    ctx.stroke()

    for (let i = 0; i < totalBars; i++) {
      const angle = Math.PI + (i / (totalBars - 1)) * Math.PI
      const dataIdx = Math.floor((i / totalBars) * 48)
      const rawVal = dataArray[dataIdx] || 0

      smoothBarHeights[i] = Math.max(rawVal, smoothBarHeights[i] * 0.90)
      const heightFactor = smoothBarHeights[i] / 255
      const barLen = heightFactor * 110

      const angleDiff = Math.abs(angle - sweepAngle)
      const isSwept = angleDiff < 0.12 || angleDiff > (Math.PI - 0.12)
      const sweepBoost = isSwept ? 1.25 : 1.0

      const x1 = centerX + Math.cos(angle) * (baseRadius - 2)
      const y1 = centerY + Math.sin(angle) * (baseRadius - 2)
      const x2 = centerX + Math.cos(angle) * (baseRadius + barLen * sweepBoost)
      const y2 = centerY + Math.sin(angle) * (baseRadius + barLen * sweepBoost)

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)

      const barGrad = ctx.createLinearGradient(x1, y1, x2, y2)
      if (isSwept) {
        barGrad.addColorStop(0, '#ffffff')
        barGrad.addColorStop(0.6, `hsla(${breathHue + 60}, 100%, 75%, 0.9)`)
        barGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
      } else {
        barGrad.addColorStop(0, `hsla(${breathHue}, 100%, 60%, 0.75)`)
        barGrad.addColorStop(0.7, `hsla(${breathHue + 90}, 90%, 65%, 0.5)`)
        barGrad.addColorStop(1, 'rgba(0, 242, 254, 0)')
      }

      ctx.strokeStyle = barGrad
      ctx.lineWidth = Math.max(w / 180, 2.5)
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    const sweepX = centerX + Math.cos(sweepAngle) * (baseRadius + 80)
    const sweepY = centerY + Math.sin(sweepAngle) * (baseRadius + 80)
    const sweepGrad = ctx.createRadialGradient(sweepX, sweepY, 0, sweepX, sweepY, 120)
    sweepGrad.addColorStop(0, `hsla(${breathHue}, 100%, 75%, 0.22)`)
    sweepGrad.addColorStop(1, 'transparent')

    ctx.fillStyle = sweepGrad
    ctx.beginPath()
    ctx.arc(sweepX, sweepY, 120, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  draw()
}

// 歌词与音频进度互锁
const activeLyricIndex = computed(() => {
  if (!currentTrack.value?.lyrics || currentTrack.value.lyrics.length === 0) return -1
  const t = currentTime.value
  const list = currentTrack.value.lyrics
  for (let i = list.length - 1; i >= 0; i--) {
    if (t >= list[i].time) return i
  }
  return 0
})

watch(activeLyricIndex, (newIdx) => {
  if (expandedView.value === 'lyrics' && lyricsScrollRef.value && newIdx >= 0) {
    nextTick(() => {
      const activeEl = lyricsScrollRef.value?.querySelector(`.lyric-line-${newIdx}`) as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }
})

// 播放音乐
const playMusic = async () => {
  if (!audioElement.value || !currentTrack.value) return

  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume()
  } else {
    initAudioContext()
  }

  isDeciphering.value = true
  try {
    if (!audioElement.value.src || currentLoadedTrackId.value !== currentTrack.value.id) {
      const realAudioSrc = await prepareTrackAudioSource(currentTrack.value)
      audioElement.value.src = realAudioSrc
      currentLoadedTrackId.value = currentTrack.value.id
    }

    await audioElement.value.play()
    isPlaying.value = true
    isAutoplayBlocked.value = false
    
    // 🌟 真正出声起播时，才顺畅物理展开为 compact
    islandState.value = 'compact'
    
    updateSystemMediaSession()
    scrapeTrackMetadataAndLyrics(currentTrack.value)
  } finally {
    isDeciphering.value = false
  }
}

const pauseMusic = () => {
  if (audioElement.value) {
    audioElement.value.pause()
    isPlaying.value = false
  }
}

const togglePlay = () => {
  if (isPlaying.value) pauseMusic()
  else playMusic()
}

const nextTrack = (isAutoEnded = false) => {
  if (playlist.value.length === 0) return

  if (playMode.value === 'loop' && isAutoEnded) {
    if (audioElement.value) {
      audioElement.value.currentTime = 0
      audioElement.value.play()
    }
    return
  }

  if (playMode.value === 'random') {
    if (playlist.value.length === 1) {
      currentIndex.value = 0
    } else {
      let nextIdx = currentIndex.value
      while (nextIdx === currentIndex.value) {
        nextIdx = Math.floor(Math.random() * playlist.value.length)
      }
      currentIndex.value = nextIdx
    }
  } else {
    currentIndex.value = (currentIndex.value + 1) % playlist.value.length
  }

  playMusic()
}

const prevTrack = () => {
  if (playlist.value.length === 0) return
  if (audioElement.value && audioElement.value.currentTime > 3) {
    audioElement.value.currentTime = 0
    return
  }

  if (playMode.value === 'random' && playlist.value.length > 1) {
    let nextIdx = currentIndex.value
    while (nextIdx === currentIndex.value) {
      nextIdx = Math.floor(Math.random() * playlist.value.length)
    }
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
  const rect = target.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  if (audioElement.value && duration.value > 0) {
    audioElement.value.currentTime = percent * duration.value
  }
}

let touchTimer: any = null
const handleTouchStart = () => {
  touchTimer = setTimeout(() => {
    if (islandState.value !== 'idle') {
      islandState.value = 'expanded'
    }
  }, 400)
}
const handleTouchEnd = () => {
  if (touchTimer) clearTimeout(touchTimer)
}

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
  <div class="relative flex items-center justify-center select-none">
    <audio
      ref="audioElement"
      @timeupdate="onTimeUpdate"
      @ended="nextTrack(true)"
      crossorigin="anonymous"
    ></audio>

    <!-- 🌟 单一连续物理弹簧外壳 (保持 position: relative 杜绝图层切换闪跳) -->
    <div
      @click="handleIslandClick"
      @contextmenu="handleContextMenu"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
      @touchmove="handleTouchEnd"
      class="island-fluid-shell will-change-[width,height,border-radius,background-color] [transform:translateZ(0)]"
      :class="[
        islandState === 'idle' 
          ? (isHome ? 'island-idle-home' : 'island-idle-sub') 
          : (islandState === 'compact' ? 'island-compact' : 'island-expanded'),
        isDark ? 'island-theme-dark' : 'island-theme-light'
      ]"
    >
      <!-- ========================================================
           🌟 模式 A：默认/未播放状态 (不占位！纯粹展示页面标题，带起播小徽标)
           ======================================================== -->
      <div v-if="islandState === 'idle'" class="w-full h-full flex items-center justify-center">
        <Transition name="fade-spring" mode="out-in">
          <div :key="currentTitle + (isHome ? '-home' : '-sub')" class="flex items-center justify-center px-4">
            <span
              class="font-black tracking-tight whitespace-nowrap truncate select-none text-xs sm:text-sm md:text-base"
              :class="isHome ? 'drop-shadow-md text-[var(--md-sys-color-on-surface)]' : ''"
            >
              {{ currentTitle }}
            </span>

            <button
              v-if="isAutoplayBlocked && playlist.length > 0"
              @click.stop="isAutoplayBlocked = false; playMusic()"
              class="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 active:scale-95 transition-all flex items-center gap-0.5 cursor-pointer animate-pulse shrink-0"
              title="点击激活背景音乐"
            >
              <span class="material-symbols-outlined text-xs">music_note</span>
              
            </button>
          </div>
        </Transition>
      </div>

      <!-- ========================================================
           🌟 模式 B：紧凑灵动岛播放态 (页面标题固定 + 跑马灯独立视口 + 彻底杜绝叠字)
           ======================================================== -->
      <div
        v-else-if="islandState === 'compact'"
        class="w-full h-full flex items-center justify-between px-2.5 cursor-pointer overflow-hidden"
      >
        <!-- 1. 严格锁死 24x24 封面容器 (彻底解决图片拉伸爆框) -->
        <div class="w-6 h-6 min-w-[24px] max-w-[24px] rounded-full overflow-hidden shrink-0 shadow-sm relative mr-1.5 border border-white/20">
          <img
            :src="currentTrack?.coverUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop'"
            class="w-full h-full object-cover"
            :class="{ 'animate-spin-slow': isPlaying }"
          />
        </div>

        <!-- 2. 🌟 固定不动的页面标题 (保证任何时候都知道在什么页面，绝不滚动) -->
        <span class="text-[11px] font-black tracking-tight text-white shrink-0 mr-1 whitespace-nowrap">
          {{ currentTitle }}
        </span>

        <span class="text-[10px] text-white/30 shrink-0 mr-1 select-none">•</span>

        <!-- 3. 🌟 仅曲目跑马灯独立视口 (加 min-w-0 彻底解决 flex 挤爆叠字) -->
        <div class="marquee-window flex-1 min-w-0 overflow-hidden relative">
          <div class="marquee-content inline-flex items-center text-[10px] sm:text-[11px] font-bold text-white/90 whitespace-nowrap">
            <span>{{ isDeciphering ? '解密音频流...' : (isScraping ? '匹配元数据...' : marqueeSongText) }}</span>
            <span class="mx-5 text-cyan-400 opacity-60">♪</span>
            <span>{{ isDeciphering ? '解密音频流...' : (isScraping ? '匹配元数据...' : marqueeSongText) }}</span>
          </div>
        </div>

        <!-- 4. 真实音频振幅驱动的声波条 (微缩尺寸，绝不挤压) -->
        <div class="flex items-end gap-0.5 h-3 px-0.5 shrink-0 ml-1.5">
          <span
            v-for="(val, idx) in islandEqBars"
            :key="idx"
            class="w-0.5 rounded-full bg-cyan-400 transition-[height] duration-75 ease-out"
            :style="{ height: `${val}px` }"
          ></span>
        </div>
      </div>

      <!-- ========================================================
           🌟 模式 C：展开大控制器岛 (含实时滚动歌词与五源刮削封面)
           ======================================================== -->
      <div
        v-else-if="islandState === 'expanded'"
        class="w-full h-full p-5 flex flex-col justify-between overflow-hidden"
        @contextmenu.prevent="islandState = 'compact'"
        @click.stop
      >
        <div class="flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3.5 truncate">
            <img
              :src="currentTrack?.coverUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&fit=crop'"
              class="w-12 h-12 rounded-2xl object-cover shadow-md shrink-0"
            />
            <div class="flex flex-col truncate">
              <h4 class="font-extrabold text-sm truncate tracking-tight text-white">{{ currentTrack?.title }}</h4>
              <span class="text-xs text-white/60 truncate mt-0.5">{{ currentTrack?.artist }}</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <div class="flex p-0.5 rounded-full bg-white/10 text-[10px] font-bold">
              <button
                @click="expandedView = 'player'"
                class="px-2 py-0.5 rounded-full transition-all cursor-pointer"
                :class="expandedView === 'player' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'"
              >
                控制
              </button>
              <button
                @click="expandedView = 'lyrics'"
                class="px-2 py-0.5 rounded-full transition-all cursor-pointer flex items-center gap-0.5"
                :class="expandedView === 'lyrics' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'"
              >
                <span>歌词</span>
                <span v-if="currentTrack?.lyrics && currentTrack.lyrics.length > 0" class="w-1 h-1 rounded-full bg-cyan-400"></span>
              </button>
            </div>

            <button
              @click="islandState = 'compact'"
              class="w-7 h-7 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 bg-white/10 text-white transition-all cursor-pointer"
            >
              <span class="material-symbols-outlined text-sm">keyboard_arrow_up</span>
            </button>
          </div>
        </div>

        <div v-if="expandedView === 'player'" class="flex flex-col gap-1.5 my-2">
          <div
            class="w-full h-1.5 rounded-full bg-white/20 cursor-pointer relative overflow-hidden"
            @click="seek"
          >
            <div
              class="h-full bg-white rounded-full transition-all duration-150"
              :style="{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }"
            ></div>
          </div>
          <div class="flex justify-between text-[10px] font-mono text-white/60 px-0.5">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ remainingTime }}</span>
          </div>
        </div>

        <div
          v-else-if="expandedView === 'lyrics'"
          ref="lyricsScrollRef"
          class="my-2 h-24 overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-none text-center relative"
        >
          <div v-if="!currentTrack?.lyrics || currentTrack.lyrics.length === 0" class="py-8 text-xs text-white/40">
            {{ isScraping ? '全网五源歌词检索中...' : '暂无匹配的 LRC 滚动歌词' }}
          </div>
          <div
            v-else
            v-for="(line, idx) in currentTrack.lyrics"
            :key="idx"
            :class="[
              `lyric-line-${idx}`,
              'transition-all duration-300 text-xs select-none',
              idx === activeLyricIndex ? 'text-cyan-300 font-extrabold scale-105 drop-shadow' : 'text-white/40 font-medium'
            ]"
          >
            {{ line.text }}
          </div>
        </div>

        <div v-else-if="expandedView === 'playlist'" class="my-2 h-24 overflow-y-auto pr-1 flex flex-col gap-1">
          <div
            v-for="(t, idx) in playlist"
            :key="t.id"
            @click="currentIndex = idx; playMusic()"
            class="p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all text-white"
            :class="currentIndex === idx ? 'bg-white/20 font-bold' : 'opacity-70 hover:opacity-100 hover:bg-white/5'"
          >
            <span class="truncate mr-2">{{ t.title }} - {{ t.artist }}</span>
            <span v-if="currentIndex === idx" class="material-symbols-outlined text-sm shrink-0">equalizer</span>
          </div>
        </div>

        <div class="flex items-center justify-between pt-1 shrink-0">
          <div class="flex items-center gap-1">
            <button
              @click="cyclePlayMode"
              class="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <span class="material-symbols-outlined text-lg">{{ playModeIcon }}</span>
            </button>
            <button
              @click="expandedView = expandedView === 'playlist' ? 'player' : 'playlist'"
              class="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <span class="material-symbols-outlined text-lg">queue_music</span>
            </button>
          </div>

          <div class="flex items-center gap-4 text-white">
            <button @click="prevTrack" class="opacity-80 hover:opacity-100 active:scale-90 transition-all cursor-pointer">
              <span class="material-symbols-outlined text-2xl">fast_rewind</span>
            </button>

            <button
              @click="togglePlay"
              :disabled="isDeciphering"
              class="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <span class="material-symbols-outlined text-3xl">
                {{ isPlaying ? 'pause' : 'play_arrow' }}
              </span>
            </button>

            <button @click="nextTrack(false)" class="opacity-80 hover:opacity-100 active:scale-90 transition-all cursor-pointer">
              <span class="material-symbols-outlined text-2xl">fast_forward</span>
            </button>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              @click="toggleFallbackMode"
              class="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono transition-all cursor-pointer"
              :class="useMemoryFallback ? 'bg-amber-500/20 text-amber-300' : 'bg-cyan-500/20 text-cyan-300'"
              :title="useMemoryFallback ? '当前为内存直解' : '当前为SW串流'"
            >
              {{ useMemoryFallback ? '内存' : 'SW' }}
            </button>
            <button
              @click="scanDownloadCenterMusic"
              class="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              :class="{ 'animate-spin': isLoadingMusic }"
              title="刷新音乐"
            >
              <span class="material-symbols-outlined text-base">refresh</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 🌟 底部半球太阳辐射声波可视化 (下移 100px 形成地平线晨曦效果) -->
    <Teleport to="body">
      <canvas
        ref="domeCanvasRef"
        class="fixed left-0 right-0 pointer-events-none z-10 osu-dome-canvas"
        style="bottom: -100px;"
      ></canvas>
    </Teleport>
  </div>
</template>

<style scoped>
/* =========================================================
   🌟 核心修复：全生命周期保持 position: relative 杜绝图层切换闪断！
   iOS 苹果非线性弹簧物理插值 cubic-bezier(0.34, 1.56, 0.64, 1)
   ========================================================= */
.island-fluid-shell {
  position: relative !important;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  /* 🌟 纯数值连续平滑插值，展开绝不出现方角或直角矩形！ */
  transition:
    width 0.48s cubic-bezier(0.34, 1.56, 0.64, 1),
    height 0.48s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-radius 0.48s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.3s ease,
    box-shadow 0.4s ease;
}

.island-idle-home {
  width: auto;
  height: 44px;
  border-radius: 22px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.island-idle-sub {
  min-width: 120px;
  height: 44px;
  border-radius: 22px;
}

/* 🌟 移动端与桌面端自适应紧凑宽度 (手机端最大不超过视口余量，绝对不挤爆) */
.island-compact {
  width: clamp(190px, 32vw, 270px);
  max-width: calc(100vw - 165px);
  height: 44px;
  border-radius: 22px !important;
  background: rgba(0, 0, 0, 0.94) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5) !important;
}

/* 展开大岛 */
.island-expanded {
  width: min(350px, calc(100vw - 32px));
  height: 205px;
  border-radius: 36px !important;
  background: rgba(0, 0, 0, 0.95) !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7) !important;
  z-index: 50;
}

/* 跑马灯视口羽化 */
.marquee-window {
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%);
}

.marquee-content {
  display: inline-flex;
  white-space: nowrap;
  animation: led-bus-marquee 10s linear infinite;
}

@keyframes led-bus-marquee {
  0% { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(-50%, 0, 0); }
}

/* 🌟 底部 osu! 半球透明度 40% (40% 可视 / 60% 晶莹通透) */
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