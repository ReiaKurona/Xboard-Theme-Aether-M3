<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Player from 'xgplayer'
import 'xgplayer/dist/index.min.css'
import Danmu from 'xgplayer/es/plugins/danmu'
import 'xgplayer/es/plugins/danmu/index.css'
import '@material/web/button/filled-button.js'

const props = defineProps<{
  type: string
  url: string
  resource: any
  baseUrl: string
}>()

const emit = defineEmits(['close', 'download'])

let playerInstance: any = null
const codecError = ref(false)
const danmuText = ref('')
const selectedColor = ref('#ffffff')
const danmuMode = ref<'scroll' | 'top' | 'bottom'>('scroll')
const danmuSize = ref('22px')
const DANMU_COLORS = ['#ffffff', '#FF1744', '#00E676', '#29B6F6', '#FFD600', '#E040FB', '#00E5FF']

let wsClient: WebSocket | null = null

// 拉取历史弹幕
const fetchDanmaku = async () => {
  try {
    const res = await fetch(`${props.baseUrl}/api/resources/${props.resource.id}/danmaku`)
    const data = await res.json()
    return data.success ? data.comments : []
  } catch {
    return []
  }
}

// 保存弹幕到后端
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
      playbackRate: [0.5, 1, 1.25, 1.5, 2, 3],
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

    // 建立 WebSocket 实时弹幕广播通道
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
    txt: danmuText.value,
    mode: danmuMode.value,
    style: {
      color: selectedColor.value,
      fontSize: danmuSize.value,
      textShadow: '1px 1px 2px #000000'
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

watch(() => props.url, (u) => { if (u) initPlayer() })
onMounted(() => { if (props.url) initPlayer() })
onUnmounted(() => {
  if (wsClient) wsClient.close()
  if (playerInstance) { playerInstance.destroy(); playerInstance = null }
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col justify-between bg-black/85 backdrop-blur-2xl p-4 sm:p-6 select-none overflow-hidden">
    <!-- 头部工具条 -->
    <div class="flex items-center justify-between pb-3 shrink-0">
      <span class="text-base font-bold text-white truncate max-w-[70vw]">{{ resource?.name }}</span>
      <div class="flex items-center gap-2">
        <button
          @click="$emit('download')"
          class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1 cursor-pointer"
        >
          <span class="material-symbols-outlined text-sm">download</span>
          <span>下载原文件</span>
        </button>
        <button
          @click="$emit('close')"
          class="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <span class="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>

    <!-- 播放器中心视窗 -->
    <div class="flex-1 w-full max-w-5xl mx-auto flex flex-col justify-center items-center overflow-hidden">
      <div v-if="type === 'image'" class="h-full flex items-center justify-center">
        <img :src="url" class="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl" />
      </div>

      <div v-else class="w-full flex flex-col rounded-[28px] overflow-hidden bg-black shadow-2xl border border-white/10">
        <div id="xgplayer-core" class="w-full aspect-video bg-black"></div>

        <!-- 弹幕发射底栏 -->
        <div class="p-4 bg-[var(--md-sys-color-surface-container)] flex flex-col sm:flex-row items-center gap-3 border-t border-white/5">
          <input
            v-model="danmuText"
            @keyup.enter="sendCustomDanmu"
            placeholder="发条弹幕参与讨论吧..."
            class="flex-1 w-full bg-[var(--md-sys-color-surface-container-high)] text-xs px-4 py-2.5 rounded-full outline-none text-[var(--md-sys-color-on-surface)]"
          />

          <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <!-- 调色盘 -->
            <div class="flex items-center gap-1.5 px-2">
              <span
                v-for="c in DANMU_COLORS"
                :key="c"
                @click="selectedColor = c"
                class="w-4 h-4 rounded-full cursor-pointer transition-transform"
                :class="{ 'scale-125 ring-2 ring-white': selectedColor === c }"
                :style="{ backgroundColor: c }"
              ></span>
            </div>

            <md-filled-button @click="sendCustomDanmu" class="h-9">
              <span class="material-symbols-outlined text-xs" slot="icon">send</span>
              发送
            </md-filled-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>