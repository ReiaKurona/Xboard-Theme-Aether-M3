<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api/client'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'

export interface SanctumSession {
  id: number
  name: string
  tokenable_type: string
  tokenable_id: number
  abilities: string[]
  last_used_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

const sessions = ref<SanctumSession[]>([])
const loading = ref(false)
const kickingId = ref<number | null>(null)

// 批量注销状态
const isRevokeAllDialogOpen = ref(false)
const isRevokingAll = ref(false)
const includeCurrentDevice = ref(false)

// 当前正在使用的凭据 ID (从 Bearer ID|token 提取)
const currentSessionId = computed(() => {
  const auth = localStorage.getItem('auth_data') || ''
  const match = auth.match(/(?:Bearer\s+)?(\d+)\|/i)
  return match ? Number(match[1]) : null
})

// 排除当前设备的其余所有活跃会话
const otherSessions = computed(() => {
  return sessions.value.filter((s) => s.id !== currentSessionId.value)
})

const formatIsoDate = (isoStr: string | null | undefined) => {
  if (!isoStr) return '从未活跃'
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return '近期'
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '近期'
  }
}

const maskTokenName = (name: string) => {
  if (!name) return '默认授权凭证'
  if (name.length <= 8) return name
  return `${name.slice(0, 4)}••••${name.slice(-4)}`
}

const fetchSessions = async () => {
  loading.value = true
  try {
    const res: any = await api.get('/user/getActiveSession')
    const rawData = res.data ?? res
    if (Array.isArray(rawData)) {
      sessions.value = rawData
    } else if (typeof rawData === 'object' && rawData !== null) {
      sessions.value = Object.values(rawData)
    } else {
      sessions.value = []
    }
  } catch (err) {
    sessions.value = []
  } finally {
    loading.value = false
  }
}

// 单个踢出
const handleKickSession = async (id: number) => {
  kickingId.value = id
  try {
    await api.post('/user/removeActiveSession', {
      session_id: id
    })
    sessions.value = sessions.value.filter((s) => s.id !== id)
  } catch (err: any) {
    alert(err.message || '踢出会话失败')
  } finally {
    kickingId.value = null
  }
}

// 🌟 核心：批量全部注销凭据（并发调度）
const handleRevokeAll = async () => {
  isRevokingAll.value = true
  try {
    // 决定要清理的目标列表
    const targets = includeCurrentDevice.value
      ? [...sessions.value]
      : sessions.value.filter((s) => s.id !== currentSessionId.value)

    if (targets.length > 0) {
      // 并发请求批量踢出
      await Promise.allSettled(
        targets.map((s) => api.post('/user/removeActiveSession', { session_id: s.id }))
      )
    }

    isRevokeAllDialogOpen.value = false

    if (includeCurrentDevice.value) {
      // 如果勾选了注销本机，彻底清除凭据并退出到登录页
      localStorage.removeItem('auth_data')
      localStorage.removeItem('sub_token')
      window.location.hash = '#/login'
    } else {
      // 重新拉取会话列表
      await fetchSessions()
    }
  } catch (err: any) {
    alert(err.message || '批量注销失败')
  } finally {
    isRevokingAll.value = false
  }
}

onMounted(() => {
  fetchSessions()
})
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="p-6 md:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm h-full flex flex-col justify-between">
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-2xl">vpn_key</span>
          <h3 class="text-xl font-black tracking-tight">活动登录令牌与会话</h3>
        </div>

        <div class="flex items-center gap-2">
          <!-- 🌟 全部注销凭证按钮 (检测到有其他设备时高亮呈现) -->
          <button
            v-if="otherSessions.length > 0"
            @click="isRevokeAllDialogOpen = true"
            class="px-3.5 py-1.5 rounded-full text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all flex items-center gap-1.5"
            title="一键下线所有其他设备"
          >
            <span class="material-symbols-outlined text-base">delete_sweep</span>
            <span>全部注销 ({{ otherSessions.length }})</span>
          </button>

          <button
            @click="fetchSessions"
            class="w-8 h-8 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container-high)] transition-all"
            title="刷新会话"
          >
            <span class="material-symbols-outlined text-base">refresh</span>
          </button>
        </div>
      </div>

      <p class="text-xs opacity-60 mb-5 leading-normal">
        监控账号当前在所有客户端与网页端持有的独立授权凭据。若怀疑凭据外泄，可一键将其批量移除下线。
      </p>

      <!-- 载入状态 -->
      <div v-if="loading && sessions.length === 0" class="py-8 flex justify-center">
        <md-circular-progress indeterminate></md-circular-progress>
      </div>

      <!-- 无活跃会话 -->
      <div v-else-if="sessions.length === 0" class="py-8 flex flex-col items-center justify-center opacity-40 text-xs">
        <span class="material-symbols-outlined text-3xl mb-1">key_off</span>
        暂无已记录的活动授权
      </div>

      <!-- 会话卡片列表 -->
      <div v-else class="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]/60 flex items-center justify-between gap-3 text-xs transition-all"
          :class="{ 'ring-1 ring-[var(--md-sys-color-primary)]/40 bg-[var(--md-sys-color-surface-container-high)]': s.id === currentSessionId }"
        >
          <div class="flex items-center gap-3 truncate">
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              :class="s.id === currentSessionId ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]' : 'bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-primary)]'"
            >
              <span class="material-symbols-outlined text-lg">
                {{ s.id === currentSessionId ? 'laptop_mac' : 'token' }}
              </span>
            </div>

            <div class="flex flex-col truncate">
              <div class="flex items-center gap-2">
                <span class="font-bold text-[var(--md-sys-color-on-surface)] font-mono">
                  Token: {{ maskTokenName(s.name) }}
                </span>
                <span
                  v-if="s.id === currentSessionId"
                  class="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 shrink-0"
                >
                  当前设备
                </span>
              </div>
              <span class="text-[10px] opacity-60 mt-0.5">
                最后活跃：{{ formatIsoDate(s.last_used_at) }}
              </span>
              <span class="text-[10px] opacity-40">
                创建时间：{{ formatIsoDate(s.created_at) }}
              </span>
            </div>
          </div>

          <div class="shrink-0">
            <button
              v-if="s.id !== currentSessionId"
              @click="handleKickSession(s.id)"
              :disabled="kickingId === s.id"
              class="px-3 py-1.5 rounded-full text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all"
            >
              {{ kickingId === s.id ? '注销中...' : '踢出此设备' }}
            </button>
            <span v-else class="text-[11px] opacity-40 font-medium px-2">
              本机活跃
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="text-[11px] opacity-40 mt-4 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/10 text-right">
      修改安全密码后将自动注销除本机外的所有其他会话
    </div>

    <!-- 🌟 原生 MD3 批量注销确认弹窗 (无白框线，暗色模式反白) -->
    <md-dialog :open="isRevokeAllDialogOpen" @closed="isRevokeAllDialogOpen = false" class="md3-profile-dialog">
      <div slot="headline" class="flex items-center gap-2 text-red-500 font-black text-lg">
        <span class="material-symbols-outlined">delete_sweep</span>
        批量注销登录凭据
      </div>
      <div slot="content" class="text-sm leading-relaxed text-[var(--md-sys-color-on-surface)] py-2">
        <p>
          您即将强制下线除本机外的 <b>{{ otherSessions.length }} 个活动设备令牌</b>。<br />
          注销后，对应终端的网页或客户端将立刻失效，无法继续访问网络。
        </p>

        <!-- 包含本机选项 -->
        <label class="flex items-center gap-2.5 cursor-pointer mt-4 p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all select-none">
          <input
            type="checkbox"
            v-model="includeCurrentDevice"
            class="w-4 h-4 accent-red-600 rounded cursor-pointer"
          />
          <span class="text-xs font-semibold">同时注销当前本机设备（全部注销后将返回登录页面）</span>
        </label>
      </div>
      <div slot="actions">
        <md-text-button @click="isRevokeAllDialogOpen = false">取消</md-text-button>
        <md-filled-button
          @click="handleRevokeAll"
          :disabled="isRevokingAll"
          style="--md-sys-color-primary: #ba1a1a; --md-sys-color-on-primary: #ffffff;"
        >
          <md-circular-progress v-if="isRevokingAll" indeterminate slot="icon" style="--md-circular-progress-size: 16px;"></md-circular-progress>
          <span v-else>{{ includeCurrentDevice ? '注销全部并退出' : '确认下线其他设备' }}</span>
        </md-filled-button>
      </div>
    </md-dialog>
  </div>
</template>

<style scoped>
.md3-profile-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface-container-high);
  --md-dialog-headline-color: var(--md-sys-color-on-surface);
  --md-dialog-supporting-text-color: var(--md-sys-color-on-surface);
}
</style>