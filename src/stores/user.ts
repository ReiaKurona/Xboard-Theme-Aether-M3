import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'

export function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<any>(null)
  const subscribeInfo = ref<any>(null)
  const userStat = ref<[number, number, number]>([0, 0, 0])
  const userConfig = ref<any>(null) // 4.10 登录后站点配置
  const trafficLogs = ref<any[]>([]) // 6.2 每日流量日志
  const notices = ref<any[]>([])
  const loading = ref(false)

  // 货币符号（来自 4.10 user/comm/config）
  const currencySymbol = computed(() => userConfig.value?.currency_symbol || '¥')

  // 已用流量 (u + d)
  const usedTraffic = computed(() => {
    if (!subscribeInfo.value) return 0
    return (subscribeInfo.value.u || 0) + (subscribeInfo.value.d || 0)
  })

  // 总流量额度
  const totalTraffic = computed(() => subscribeInfo.value?.transfer_enable || 0)

  // 流量百分比
  const trafficPercent = computed(() => {
    if (!totalTraffic.value) return 0
    const pct = ((usedTraffic.value / totalTraffic.value) * 100)
    return pct > 100 ? 100 : parseFloat(pct.toFixed(1))
  })

  // 并行拉取登录态全量数据
  const fetchDashboardData = async () => {
    loading.value = true
    try {
      const [info, sub, stat, cfg, logs, noticeRes] = await Promise.allSettled([
        api.get('/user/info'),
        api.get('/user/getSubscribe'),
        api.get('/user/getStat'),
        api.get('/user/comm/config'), // 4.10 登录后配置
        api.get('/user/stat/getTrafficLog'), // 6.2 流量日志
        api.get('/user/notice/fetch?current=1')
      ])

      if (info.status === 'fulfilled') userInfo.value = info.value
      if (sub.status === 'fulfilled') subscribeInfo.value = sub.value
      if (stat.status === 'fulfilled' && Array.isArray(stat.value)) userStat.value = stat.value as any
      if (cfg.status === 'fulfilled') userConfig.value = cfg.value
      if (logs.status === 'fulfilled' && Array.isArray(logs.value)) trafficLogs.value = logs.value
      if (noticeRes.status === 'fulfilled') {
  const val: any = noticeRes.value
  notices.value = Array.isArray(val) ? val : (Array.isArray(val?.data) ? val.data : [])
}
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    localStorage.removeItem('auth_data')
    localStorage.removeItem('sub_token')
    localStorage.removeItem('is_admin')
    window.location.hash = '#/login'
  }

  return {
    userInfo,
    subscribeInfo,
    userStat,
    userConfig,
    trafficLogs,
    notices,
    loading,
    usedTraffic,
    totalTraffic,
    trafficPercent,
    currencySymbol,
    fetchDashboardData,
    logout
  }
})