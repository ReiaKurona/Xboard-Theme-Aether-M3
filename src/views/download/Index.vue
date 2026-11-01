<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { formatBytes } from '../../stores/user'
import { importEncryptionKey, decryptApiPayload } from '../../utils/crypto'
import DownloadOverlay from '../../components/download/DownloadOverlay.vue'
import MediaPlayerModal from '../../components/download/MediaPlayerModal.vue'
import DownloadAuthModal from '../../components/download/DownloadAuthModal.vue'
import SwWarningModal from '../../components/download/SwWarningModal.vue'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/progress/circular-progress.js'

const settings = (window as any).settings || {}
const baseUrl = computed(() => (settings.download_center_url || 'https://install.reia.fans').replace(/\/+$/, ''))

const token = ref(localStorage.getItem('reiadown_token') || '')
const isAuthOpen = ref(false)

const resources = ref<any[]>([])
const currentParentId = ref(0)
const pathHistory = ref<{ id: number; name: string }[]>([])
const currentFolderMd = ref('')
const viewMode = ref<'card' | 'list'>('card')
const loading = ref(false)
const fetchError = ref('')

// 下载引擎状态
const isDownloading = ref(false)
const downloadStatus = ref('')
const downloadPercent = ref(0)
const totalChunksCount = ref(0)
const downloadedChunksCount = ref(0)
const decryptedChunksCount = ref(0)

// 媒体播放器状态
const mediaModal = ref({ open: false, type: '', url: '', name: '', resource: null as any })

// 🌟 极端情况 SW 告警弹窗状态
const isSwWarningOpen = ref(false)
const pendingPreviewResource = ref<any>(null)
const isSwRegistered = ref(false)

// ==========================================
// 🌟 核心修复：计算符合 Xboard 主题路径规范的 SW 端点与作用域
// ==========================================
const getSwConfig = () => {
  if (import.meta.env.DEV) {
    return {
      scriptUrl: '/sw.js',
      scope: '/'
    }
  }
  // 生产环境定位到真实解压目录：/theme/{{$theme}}/assets/sw.js
  const assetsPath = (settings.assets_path || '/theme/MD3-Theme/assets').replace(/\/+$/, '')
  return {
    scriptUrl: `${assetsPath}/sw.js`,
    scope: `${assetsPath}/`
  }
}

// 注册 Service Worker
const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    isSwRegistered.value = false
    return
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    isSwRegistered.value = true
    console.log('✅ Service Worker 成功挂载全站根域，管辖作用域:', registration.scope)
  } catch (err: any) {
    isSwRegistered.value = false
    console.warn('⚠️ Service Worker 根路径注册失败:', err)
  }
}

const handleSessionExpired = (msg?: string) => {
  localStorage.removeItem('reiadown_token')
  token.value = ''
  resources.value = []
  currentFolderMd.value = ''
  isAuthOpen.value = true
  fetchError.value = msg || '下载中心凭证已过期，请重新连接'
}

const handleManualLogout = () => {
  localStorage.removeItem('reiadown_token')
  token.value = ''
  resources.value = []
  currentFolderMd.value = ''
  fetchError.value = ''
  isAuthOpen.value = true
}

const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const res = await fetch(`${baseUrl.value}${endpoint}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token.value}`
    }
  })

  if (res.status === 401) {
    handleSessionExpired('下载中心会话已过期，请重新输入密码验证')
    throw new Error('会话过期')
  }

  return res
}

const onAuthSuccess = (newToken: string) => {
  token.value = newToken
  isAuthOpen.value = false
  fetchError.value = ''
  fetchResources()
}

const fetchResources = async () => {
  if (!token.value) {
    isAuthOpen.value = true
    return
  }

  loading.value = true
  fetchError.value = ''
  try {
    const res = await fetchWithAuth(`/api/admin/resources?parentId=${currentParentId.value}`)
    const data = await res.json()
    if (data.success) {
      resources.value = data.resources || []
      currentFolderMd.value = data.folder_md || ''
    } else {
      throw new Error(data.message || '获取资源失败')
    }
  } catch (err: any) {
    if (err.message !== '会话过期') {
      fetchError.value = err.message || '无法连接到下载服务'
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  registerServiceWorker()
  fetchResources()
})

const enterFolder = (id: number, name: string) => {
  pathHistory.value.push({ id, name })
  currentParentId.value = id
  fetchResources()
}

const navigateTo = (id: number, _name: string, index: number = -1) => {
  currentParentId.value = id
  pathHistory.value = index === -1 ? [] : pathHistory.value.slice(0, index + 1)
  fetchResources()
}

const folders = computed(() => resources.value.filter((r) => r.type === 'folder'))
const filesByTag = computed(() => {
  const groups: Record<string, any[]> = {}
  const files = resources.value.filter((r) => r.type === 'file')
  files.forEach((res) => {
    const tags = res.tags ? res.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
    if (tags.length === 0) tags.push('未分类资源')
    tags.forEach((tag: string) => {
      if (!groups[tag]) groups[tag] = []
      groups[tag].push(res)
    })
  })
  return groups
})

const isMedia = (name: string) => /\.(mp4|mkv|webm|mp3|wav|flac|aac|ogg|jpg|jpeg|png|gif|webp)$/i.test(name)
const getMediaType = (name: string) => {
  if (/\.(mp4|mkv|webm)$/i.test(name)) return 'video'
  if (/\.(mp3|wav|flac|aac|ogg)$/i.test(name)) return 'audio'
  return 'image'
}
const getMediaIcon = (name: string) => {
  if (/\.(mp4|mkv|webm)$/i.test(name)) return 'movie'
  if (/\.(mp3|wav|flac|aac|ogg)$/i.test(name)) return 'audio_file'
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(name)) return 'image'
  if (/\.(zip|7z|rar|gz|tar)$/i.test(name)) return 'folder_zip'
  if (/\.(apk|exe|dmg|msi)$/i.test(name)) return 'apps'
  return 'description'
}

// 并发切片下载管线
const executeDownloadPipeline = async (resource: any, isPreview: boolean = false) => {
  try {
    const res = await fetchWithAuth(`/api/resources/${resource.id}/download`)
    const rawData = await res.json()
    const data = rawData.e2ee ? await decryptApiPayload(rawData, token.value) : rawData

    if (!data.success) throw new Error(data.message)
    if (data.isLink || !data.is_encrypted) {
      window.open(data.downloadUrl || data.downloadUrls[0], '_blank')
      return
    }

    let fileHandle: any = null
    let writable: any = null
    if (!isPreview && 'showSaveFilePicker' in window) {
      try {
        fileHandle = await (window as any).showSaveFilePicker({ suggestedName: data.file_name })
        if (fileHandle) writable = await fileHandle.createWritable()
      } catch (err: any) {
        if (err.name === 'AbortError') return
      }
    }

    isDownloading.value = true
    downloadPercent.value = 0
    downloadedChunksCount.value = 0
    decryptedChunksCount.value = 0
    totalChunksCount.value = data.total_chunks || 1
    downloadStatus.value = '☁️ 并发管线建立中...'

    const CHUNK_SIZE = 10 * 1024 * 1024
    const urls = data.downloadUrls
    const key = await importEncryptionKey(data.encrypt_key)
    const totalEncryptedBytes = resource.file_size + totalChunksCount.value * 28
    const chunksLoadedBytes = new Array(totalChunksCount.value).fill(0)
    const fallbackChunks = new Array(totalChunksCount.value)
    const concurrency = Math.min(6, navigator.hardwareConcurrency || 4)
    let nextChunkIndex = 0

    const downloadWorker = async () => {
      while (true) {
        const i = nextChunkIndex++
        if (i >= totalChunksCount.value) break
        //加入 referrerPolicy: 'no-referrer' 彻底抹除来源，并加 no-store 杜绝写盘
        const chunkRes = await fetch(urls[i], {
          referrerPolicy: 'no-referrer',
          cache: 'no-store'
        })
        if (!chunkRes.ok) throw new Error(`碎片 ${i} 拉取失败`)
        const reader = chunkRes.body!.getReader()
        const chunks = []
        let loaded = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          loaded += value.length
          chunksLoadedBytes[i] = loaded
          const globalLoaded = chunksLoadedBytes.reduce((a, b) => a + b, 0)
          downloadPercent.value = Math.min(99, Math.round((globalLoaded / totalEncryptedBytes) * 100))
          downloadStatus.value = `⚡ ${isPreview ? '内存流式缓冲' : '并发拉取'}中...`
        }
        downloadedChunksCount.value++

        const combinedBuffer = new Uint8Array(loaded)
        let offsetArr = 0
        for (const c of chunks) {
          combinedBuffer.set(c, offsetArr)
          offsetArr += c.length
        }
        const iv = combinedBuffer.slice(0, 12)
        const cipherBuffer = combinedBuffer.slice(12)
        const decryptedBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuffer)
        decryptedChunksCount.value++

        if (writable) {
          await writable.write({ type: 'write', position: i * CHUNK_SIZE, data: decryptedBuffer })
        } else {
          fallbackChunks[i] = decryptedBuffer
        }
      }
    }

    const workers = []
    for (let w = 0; w < Math.min(concurrency, totalChunksCount.value); w++) {
      workers.push(downloadWorker())
    }
    await Promise.all(workers)

    if (writable) {
      await writable.close()
      downloadPercent.value = 100
      downloadStatus.value = '✅ 完美落盘！'
    } else {
      const mimeType = isPreview ? 'video/mp4' : 'application/octet-stream'
      const finalBlob = new Blob(fallbackChunks, { type: mimeType })
      if (isPreview) {
        mediaModal.value.url = window.URL.createObjectURL(finalBlob)
        isDownloading.value = false
      } else {
        const a = document.createElement('a')
        a.href = window.URL.createObjectURL(finalBlob)
        a.download = data.file_name
        a.click()
        downloadPercent.value = 100
        downloadStatus.value = '✅ 完美落盘！'
      }
    }
  } catch (e: any) {
    if (e.message !== '会话过期') {
      alert(e.message || '下载解密异常')
    }
    isDownloading.value = false
  }
}

// 🌟 串流媒体预览调度：带 SW 失败弹窗与内存自愈降级
const handleMediaPreview = async (resource: any) => {
  try {
    const res = await fetchWithAuth(`/api/resources/${resource.id}/download`)
    const rawData = await res.json()
    const data = rawData.e2ee ? await decryptApiPayload(rawData, token.value) : rawData

    if (!data.success) throw new Error(data.message)

    if (data.isLink || !data.is_encrypted) {
      mediaModal.value = {
        open: true,
        type: getMediaType(resource.name),
        url: data.downloadUrl || data.downloadUrls[0],
        name: resource.name,
        resource
      }
      return
    }

    // 检查 Service Worker 是否就绪可用
    // 异步确认 Service Worker 控制器完全就绪
    let sw = navigator.serviceWorker?.controller
    if (!sw && 'serviceWorker' in navigator) {
      try {
        const reg = (await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject('timeout'), 1200))
        ])) as ServiceWorkerRegistration
        sw = navigator.serviceWorker.controller || reg?.active || null
      } catch {}
    }

    if (!sw) {
      // 只有在彻底不可用时才弹窗提示并准备内存降级
      pendingPreviewResource.value = resource
      isSwWarningOpen.value = true
      return
    }

    const streamId = `vid_${Date.now()}`
    const manifest = {
      file_size: resource.file_size,
      chunk_size: 10 * 1024 * 1024,
      urls: data.downloadUrls,
      encrypt_key: data.encrypt_key,
      mime_type: 'video/mp4'
    }

    const channel = new MessageChannel()
    channel.port1.onmessage = (event) => {
      if (event.data.success) {
        // 🌟 虚拟流地址直接对齐全站根作用域
        mediaModal.value = {
          open: true,
          type: getMediaType(resource.name),
          url: `/e2ee-stream/${streamId}`,
          name: resource.name,
          resource
        }
      }
    }
    sw.postMessage({ type: 'REGISTER_STREAM', id: streamId, manifest }, [channel.port2])
  } catch (e: any) {
    if (e.message !== '会话过期') {
      alert(e.message || '预览调度异常')
    }
  }
}

// 弹窗中选择继续播放：直接走内存解密模式
const handleContinueMemoryPlay = () => {
  isSwWarningOpen.value = false
  if (pendingPreviewResource.value) {
    executeDownloadPipeline(pendingPreviewResource.value, true)
    mediaModal.value = {
      open: true,
      type: getMediaType(pendingPreviewResource.value.name),
      url: '',
      name: pendingPreviewResource.value.name,
      resource: pendingPreviewResource.value
    }
  }
}

// 弹窗中选择直接下载
const handleDirectDownloadFromWarning = () => {
  isSwWarningOpen.value = false
  if (pendingPreviewResource.value) {
    executeDownloadPipeline(pendingPreviewResource.value, false)
  }
}

const renderedFolderMd = computed(() => {
  if (!currentFolderMd.value) return ''
  return DOMPurify.sanitize(marked.parse(currentFolderMd.value) as string)
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="flex flex-col gap-6 w-full max-w-7xl mx-auto py-2">
    <!-- 面包屑导航与工具条 -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent shadow-sm">
      <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs font-bold">
        <button
          @click="navigateTo(0, '首页')"
          class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] hover:opacity-100 opacity-80 cursor-pointer"
        >
          <span class="material-symbols-outlined text-base">home</span>
          <span>根目录</span>
        </button>

        <template v-for="(nav, index) in pathHistory" :key="index">
          <span class="opacity-40">/</span>
          <button
            @click="navigateTo(nav.id, nav.name, index)"
            class="px-3 py-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] hover:opacity-100 opacity-80 cursor-pointer truncate max-w-[120px]"
          >
            {{ nav.name }}
          </button>
        </template>
      </div>

      <div class="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
        <button
          v-if="token"
          @click="handleManualLogout"
          class="px-3 py-1.5 rounded-full text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          title="注销当前下载中心凭证并重新验证"
        >
          <span class="material-symbols-outlined text-sm">lock_reset</span>
          <span>重置/注销凭证</span>
        </button>
        <button
          v-else
          @click="isAuthOpen = true"
          class="px-3.5 py-1.5 rounded-full text-xs font-bold text-[var(--md-sys-color-on-primary)] bg-[var(--md-sys-color-primary)] active:scale-95 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
        >
          <span class="material-symbols-outlined text-sm">vpn_key</span>
          <span>连接凭证</span>
        </button>

        <div class="flex p-1 rounded-full bg-[var(--md-sys-color-surface-container-high)]">
          <button
            @click="viewMode = 'card'"
            class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
            :class="viewMode === 'card' ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow' : 'opacity-60'"
          >
            <span class="material-symbols-outlined text-lg">grid_view</span>
          </button>
          <button
            @click="viewMode = 'list'"
            class="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
            :class="viewMode === 'list' ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow' : 'opacity-60'"
          >
            <span class="material-symbols-outlined text-lg">view_list</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 目录 Markdown 描述卡片 -->
    <div
      v-if="renderedFolderMd"
      class="p-6 md:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent text-sm leading-relaxed prose dark:prose-invert max-w-none"
      v-html="renderedFolderMd"
    ></div>

    <div v-if="loading && resources.length === 0" class="py-24 flex justify-center">
      <md-circular-progress indeterminate></md-circular-progress>
    </div>

    <div
      v-else-if="!token || fetchError"
      class="p-8 md:p-14 rounded-[32px] bg-[var(--md-sys-color-surface-container)] border border-black/5 dark:border-transparent flex flex-col items-center justify-center text-center gap-3 shadow-sm"
    >
      <div class="w-16 h-16 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center mb-1">
        <span class="material-symbols-outlined text-3xl">lock_clock</span>
      </div>
      <h3 class="text-xl font-black tracking-tight">下载中心会话未连接或已过期</h3>
      <p class="text-xs opacity-60 max-w-sm leading-relaxed">
        {{ fetchError || '由于安全策略，下载中心会话已超时失效。请重新连接以派发端到端解密材料。' }}
      </p>

      <md-filled-button @click="isAuthOpen = true" class="mt-2">
        <span class="material-symbols-outlined text-sm" slot="icon">vpn_key</span>
        重新连接下载中心
      </md-filled-button>
    </div>

    <div v-else-if="resources.length === 0" class="py-20 flex flex-col items-center justify-center opacity-40 text-sm gap-2">
      <span class="material-symbols-outlined text-5xl">folder_off</span>
      <span>此目录下暂无任何资源文件</span>
    </div>

    <div v-else class="flex flex-col gap-8">
      <!-- 文件夹集合 -->
      <div v-if="folders.length > 0" class="flex flex-col gap-3">
        <span class="text-xs font-black tracking-wider uppercase text-[var(--md-sys-color-primary)] flex items-center gap-1.5 px-1">
          <span class="material-symbols-outlined text-base">folder</span>
          目录集合 ({{ folders.length }})
        </span>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div
            v-for="f in folders"
            :key="f.id"
            @click="enterFolder(f.id, f.name)"
            class="p-4 rounded-3xl bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] cursor-pointer transition-all active:scale-[0.98] shadow-sm flex items-center justify-between group"
          >
            <div class="flex items-center gap-3 truncate mr-2">
              <div class="w-10 h-10 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-2xl">folder</span>
              </div>
              <span class="font-extrabold text-sm truncate text-[var(--md-sys-color-on-surface)]">{{ f.name }}</span>
            </div>
            <span class="material-symbols-outlined text-lg opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
              arrow_forward_ios
            </span>
          </div>
        </div>
      </div>

      <!-- 文件集合 (按标签分组) -->
      <div v-for="(files, tag) in filesByTag" :key="tag" class="flex flex-col gap-3">
        <span class="text-xs font-black tracking-wider uppercase text-[var(--md-sys-color-primary)] flex items-center gap-1.5 px-1">
          <span class="material-symbols-outlined text-base">sell</span>
          {{ tag }} ({{ files.length }})
        </span>

        <div
          class="gap-4"
          :class="viewMode === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col'"
        >
          <div
            v-for="res in files"
            :key="res.id"
            class="p-5 rounded-3xl bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] transition-all shadow-sm flex justify-between gap-4"
            :class="viewMode === 'card' ? 'flex-col' : 'flex-row items-center'"
          >
            <div class="flex items-start gap-3.5 truncate">
              <div class="w-11 h-11 rounded-2xl bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-2xl">{{ getMediaIcon(res.name) }}</span>
              </div>

              <div class="flex flex-col truncate">
                <h4 class="font-bold text-sm truncate text-[var(--md-sys-color-on-surface)]" :title="res.name">{{ res.name }}</h4>
                <div class="flex items-center gap-2 mt-1">
                  <span v-if="res.is_encrypted" class="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">lock</span> E2EE 加密
                  </span>
                  <span class="text-[11px] opacity-50 font-mono">{{ formatBytes(res.file_size) }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                v-if="isMedia(res.name)"
                @click="handleMediaPreview(res)"
                class="px-3.5 py-1.5 rounded-full text-xs font-bold text-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)] hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span class="material-symbols-outlined text-sm">play_circle</span>
                <span>在线预览</span>
              </button>

              <button
                @click="executeDownloadPipeline(res, false)"
                class="px-3.5 py-1.5 rounded-full text-xs font-bold text-[var(--md-sys-color-on-primary)] bg-[var(--md-sys-color-primary)] hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <span class="material-symbols-outlined text-sm">download</span>
                <span>安全下载</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 并发分块下载进度 Overlay -->
    <DownloadOverlay
      v-if="isDownloading && !mediaModal.open"
      :status="downloadStatus"
      :percent="downloadPercent"
      :downloaded-chunks="downloadedChunksCount"
      :decrypted-chunks="decryptedChunksCount"
      :total-chunks="totalChunksCount"
      @close="isDownloading = false"
    />

    <!-- 挂载媒体播放器 Modal -->
    <MediaPlayerModal
      v-if="mediaModal.open"
      :type="mediaModal.type"
      :url="mediaModal.url"
      :resource="mediaModal.resource"
      :base-url="baseUrl"
      :current-folder-resources="resources"
      @close="mediaModal.open = false"
      @download="executeDownloadPipeline(mediaModal.resource, false)"
    />

    <!-- 下载中心登录授权弹窗 -->
    <DownloadAuthModal
      :open="isAuthOpen"
      :base-url="baseUrl"
      @close="isAuthOpen = false"
      @authenticated="onAuthSuccess"
    />

    <!-- 🌟 挂载极端情况 SW 无法注册降级提醒弹窗 -->
    <SwWarningModal
      :open="isSwWarningOpen"
      @close="isSwWarningOpen = false"
      @continue="handleContinueMemoryPlay"
      @download="handleDirectDownloadFromWarning"
    />
  </div>
</template>