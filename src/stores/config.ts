import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'

export interface SiteConfig {
  tos_url: string | null
  is_email_verify: number
  is_invite_force: number
  email_whitelist_suffix: string[] | 0
  is_captcha: number
  captcha_type: 'turnstile' | 'recaptcha' | 'recaptcha-v3'
  recaptcha_site_key: string | null
  recaptcha_v3_site_key: string | null
  turnstile_site_key: string | null
  app_description: string // 站点描述 (例如你站点的 "New ME!")
  app_url: string         // 站点域名 URL
  logo: string | null     // Logo 图片地址
  theme_api_accelerated?: boolean
}

const CACHE_KEY = 'xboard_guest_config'

export const useConfigStore = defineStore('config', () => {
  // 1. 初始化时先读本地持久化缓存，实现 0ms 首屏秒开
  const cached = localStorage.getItem(CACHE_KEY)
  const config = ref<SiteConfig | null>(cached ? JSON.parse(cached) : null)
  const loading = ref(false)

  // 站点 Logo（接口没有配置时，回退到 Blade 注入的 settings.logo）
  const siteLogo = computed(() => {
    return config.value?.logo || (window as any).settings?.logo || null
  })

  // 站点主标题（优先 Blade 注入的 title，回退为 Xboard）
  const siteTitle = computed(() => {
    return (window as any).settings?.title || 'Xboard'
  })

  // 站点描述（即接口返回的 app_description）
  const siteDescription = computed(() => {
    return config.value?.app_description || (window as any).settings?.description || ''
  })

  // 站点主页链接
  const siteUrl = computed(() => {
    return config.value?.app_url || (window as any).routerBase || '/'
  })

  // 2. 调取 guest/comm/config
  const fetchConfig = async () => {
    loading.value = true
    try {
      const res: any = await api.get('/guest/comm/config')
      config.value = res
      // 写入本地持久化缓存
      localStorage.setItem(CACHE_KEY, JSON.stringify(res))
      return res
    } catch (e) {
      console.error('获取站点配置失败:', e)
    } finally {
      loading.value = false
    }
  }

  return {
    config,
    loading,
    siteLogo,
    siteTitle,
    siteDescription,
    siteUrl,
    fetchConfig
  }
})