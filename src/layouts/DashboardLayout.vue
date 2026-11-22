<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute, RouterView } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useConfigStore } from '../stores/config'
import GlobalFooterInjector from '../components/common/GlobalFooterInjector.vue'
import UserAccountPopover from '../components/common/UserAccountPopover.vue'
import DynamicIslandMusic from '../components/common/DynamicIslandMusic.vue'
import '@material/web/dialog/dialog.js'
import { useClashStore } from '../stores/clash'
import ClashSidebarWidget from '../components/clash/ClashSidebarWidget.vue'

const clashStore = useClashStore()
const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const configStore = useConfigStore()

const clientPageOffline = computed(() => clashStore.discoveryComplete && !clashStore.isConnected &&
  (route.path === '/proxies' || route.path.startsWith('/clash/')))
let offlineRedirect: ReturnType<typeof setTimeout> | undefined
watch(clientPageOffline, offline => {
  clearTimeout(offlineRedirect)
  if (offline) offlineRedirect = setTimeout(() => {
    if (clientPageOffline.value) void router.replace('/dashboard')
  }, 5000)
}, { immediate: true })

const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return false
  const cached = localStorage.getItem('theme')
  if (cached) return cached === 'dark'
  return document.documentElement.classList.contains('dark') || 
         window.matchMedia('(prefers-color-scheme: dark)').matches
}

const isDark = ref<boolean>(getInitialTheme())

const applyTheme = (dark: boolean) => {
  isDark.value = dark
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

applyTheme(isDark.value)

const toggleTheme = () => {
  applyTheme(!isDark.value)
}

// 侧栏与底栏断点控制
const windowWidth = ref<number>(typeof window !== 'undefined' ? window.innerWidth : 1200)
const isMobile = computed(() => windowWidth.value < 768)
const isSidebarCollapsed = ref<boolean>(windowWidth.value < 1280 && windowWidth.value >= 768)

const handleResize = () => {
  windowWidth.value = window.innerWidth
  if (windowWidth.value >= 1280) {
    isSidebarCollapsed.value = false
  } else if (windowWidth.value >= 768) {
    isSidebarCollapsed.value = true
  }
}

onMounted(async () => {
  window.addEventListener('resize', handleResize)
  userStore.fetchDashboardData()
  configStore.fetchConfig()
  // 🌟 初始化自动探测本地 Mihomo 连通态
  clashStore.init()
})

onUnmounted(() => {
  clearTimeout(offlineRedirect)
  window.removeEventListener('resize', handleResize)
  clashStore.stop()
})

// 气泡折叠菜单弹出状态
const activeBubbleMenu = ref<'status_settings' | 'order_tickets' | null>(null)

// 🌟 核心折叠逻辑：未启动时为原本 6 项；启动时自适应折叠为 5 个核心大项
const dynamicNavItems = computed(() => {
  const isMihomoActive = clashStore.isConnected

  if (!isMihomoActive) {
    return [
      { id: 'dashboard', name: '仪表盘', icon: 'dashboard', path: '/dashboard', badge: 0 },
      { id: 'plan', name: '购买订阅', icon: 'shopping_bag', path: '/plan', badge: 0 },
      { id: 'order', name: '我的订单', icon: 'receipt_long', path: '/order', badge: userStore.userStat?.[0] || 0 },
      { id: 'servers', name: '节点状态', icon: 'dns', path: '/servers', badge: 0 },
      { id: 'tickets', name: '工单客服', icon: 'support_agent', path: '/tickets', badge: userStore.userStat?.[1] || 0 },
      { id: 'invite', name: '邀请返利', icon: 'group_add', path: '/invite', badge: 0 }
    ]
  }

  // 🌟 启动后折叠为 5 项胶囊
  return [
    { id: 'dashboard', name: '仪表盘', icon: 'dashboard', path: '/dashboard', badge: 0 },
    { id: 'proxies', name: '代理节点', icon: 'hub', path: '/proxies', badge: 0 },
    { id: 'plan', name: '购买订阅', icon: 'shopping_bag', path: '/plan', badge: 0 },
    {
      id: 'status_settings',
      name: '状态&设置',
      icon: 'tune',
      isFolder: true,
      subItems: [
        { name: '节点状态', icon: 'dns', path: '/servers' },
        { name: '仪表概览', icon: 'grid_view', path: '/clash/overview' },
        { name: '实时连接', icon: 'sync_alt', path: '/clash/connections' },
        { name: '分流规则', icon: 'rule', path: '/clash/rules' },
        { name: '实时日志', icon: 'description', path: '/clash/logs' },
        { name: '客户端设置', icon: 'settings', path: '/clash/settings' },
        { name: '手动安装订阅', icon: 'cloud_download', path: '/clash/subscription' }
      ]
    },
    {
      id: 'order_tickets',
      name: '订单客服',
      icon: 'contact_support',
      isFolder: true,
      badge: (userStore.userStat?.[0] || 0) + (userStore.userStat?.[1] || 0),
      subItems: [
        { name: '我的订单', icon: 'receipt_long', path: '/order', badge: userStore.userStat?.[0] || 0 },
        { name: '工单客服', icon: 'support_agent', path: '/tickets', badge: userStore.userStat?.[1] || 0 },
        { name: '邀请返利', icon: 'group_add', path: '/invite', badge: 0 }
      ]
    }
  ]
})

// 处理按钮点击：若是复合菜单则触发气泡，若是单页则跳转
const handleNavClick = (item: any) => {
  if (item.isFolder) {
    activeBubbleMenu.value = activeBubbleMenu.value === item.id ? null : item.id
  } else {
    activeBubbleMenu.value = null
    router.push(item.path)
  }
}

// 🌟 修复：以 dynamicNavItems 为基准计算 activeIndex，杜绝报错
const activeIndex = computed(() => {
  const currentPath = route.path
  const items = dynamicNavItems.value.slice(0, 5)
  const index = items.findIndex(item => {
    if (item.path === currentPath) return true
    if (item.isFolder && item.subItems) {
      return item.subItems.some((sub: any) => sub.path === currentPath)
    }
    return false
  })
  return index !== -1 ? index : 0
})

const liquidLensStyle = computed(() => {
  const total = Math.min(dynamicNavItems.value.length, 5)
  const itemWidthPercent = 100 / total
  return {
    width: `${itemWidthPercent}%`,
    transform: `translate3d(${activeIndex.value * 100}%, 0, 0)`,
    transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
  }
})

// 🌟 完善动态顶栏名称映射表（彻底解决顶部标题不变的问题）
const routeTitles: Record<string, string> = {
  '/dashboard': '控制中心',
  '/plan': '购买订阅',
  '/order': '我的订单',
  '/servers': '节点状态',
  '/tickets': '工单客服',
  '/invite': '邀请返利',
  '/profile': '账号与安全中心',
  '/knowledge': '使用教程',
  '/download': '软件下载中心',
  '/activities': '福利与活动中心',
  '/proxies': '代理节点选择',
  '/clash/overview': 'Mihomo 概览',
  '/clash/connections': '实时活动连接',
  '/clash/rules': '分流路由规则',
  '/clash/logs': '内核调试日志',
  '/clash/settings': '内核后端与设置'
}

const settings = (window as any).settings || {}
const hasActivityCode = computed(() => {
  const code = (settings.activity_custom_code || '').trim()
  return code.length > 0
})

const showActivityFloatingWidget = computed(() => {
  const isHomePage = route.path === '/dashboard'
  const isActivitiesPage = route.path === '/activities'
  const isEnabled = Boolean(settings.activity_float_enabled)
  const hasCode = hasActivityCode.value
  return !isHomePage && !isActivitiesPage && isEnabled && hasCode
})

const openDownloadCenter = () => {
  router.push('/download')
}

const currentRouteTitle = computed(() => {
  return routeTitles[route.path] || (route.meta?.title as string) || '控制中心'
})

const isHome = computed(() => route.path === '/dashboard')
const isBackNav = ref(false)

const handleBack = () => {
  isBackNav.value = true
  if (window.history.state && window.history.state.back) {
    router.back()
  } else {
    router.push('/dashboard')
  }
  setTimeout(() => {
    isBackNav.value = false
  }, 450)
}

const handleDocumentClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.unified-adaptive-shell')) {
    activeBubbleMenu.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div class="min-h-screen flex bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] transition-colors duration-300 relative overflow-x-hidden">
    
    <!-- 顶部渐进高斯模糊 -->
    <div class="progressive-blur-container pointer-events-none fixed top-0 left-0 right-0 h-32 z-20 overflow-hidden">
      <div class="blur-sublayer blur-1"></div>
      <div class="blur-sublayer blur-2"></div>
      <div class="blur-sublayer blur-3"></div>
      <div class="blur-sublayer blur-4"></div>
      <div class="blur-sublayer blur-5"></div>
      <div class="blur-tint-overlay" :class="isDark ? 'dark-tint' : 'light-tint'"></div>
    </div>

    <!-- 顶部固定悬浮浮岛系统 -->
    <header
      class="fixed top-3.5 left-0 right-0 z-30 pointer-events-none transition-[padding] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
      :class="[
        isMobile ? 'pl-0' : (isSidebarCollapsed ? 'pl-[96px]' : 'pl-[272px]')
      ]"
    >
      <div class="max-w-[1440px] w-full mx-auto px-4 md:px-8 flex items-start justify-between">
        
        <!-- 左侧区域：客户端下载 / 返回按钮 -->
        <div class="flex items-center min-w-[52px] h-11">
          <button
            v-if="isHome"
            @click="openDownloadCenter"
            class="pointer-events-auto h-11 px-3.5 rounded-full flex items-center gap-1.5 liquid-glass-capsule transition-all active:scale-95 group cursor-pointer shadow-lg"
            :class="isDark ? 'top-capsule-dark' : 'top-capsule-light'"
            title="下载官方推荐客户端"
          >
            <span class="material-symbols-outlined text-lg text-[var(--md-sys-color-primary)]">
              download
            </span>
            <span class="text-xs font-bold hidden sm:inline">下载客户端</span>
          </button>

          <button
            v-else
            @click="handleBack"
            class="pointer-events-auto h-11 px-3.5 rounded-full flex items-center gap-1.5 liquid-glass-capsule transition-all active:scale-95 group cursor-pointer shadow-lg"
            :class="isDark ? 'top-capsule-dark' : 'top-capsule-light'"
            title="返回上一级"
          >
            <span class="material-symbols-outlined text-lg transition-transform group-hover:-translate-x-0.5">
              arrow_back_ios_new
            </span>
            <span class="text-xs font-bold hidden sm:inline">返回</span>
          </button>
        </div>

        <!-- 中间：灵动岛音乐与路由标题 -->
        <div class="pointer-events-auto flex-1 flex items-start justify-center relative h-11 mx-2">
          <DynamicIslandMusic
            :current-title="currentRouteTitle"
            :is-home="isHome"
            :is-dark="isDark"
          />
        </div>

        <!-- 右侧区域：主题切换与用户头像 -->
        <div class="pointer-events-auto min-w-[52px] flex justify-end h-11 items-center">
          <div
            class="h-11 px-2.5 rounded-full flex items-center gap-2 shadow-lg transition-all"
            :class="isDark ? 'top-capsule-dark' : 'top-capsule-light'"
          >
            <button
              @click="toggleTheme"
              class="w-7 h-7 rounded-full flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-white/10 transition-all active:scale-90"
              :title="isDark ? '切换亮色' : '切换暗色'"
            >
              <span class="material-symbols-outlined text-base">
                {{ isDark ? 'light_mode' : 'dark_mode' }}
              </span>
            </button>

            <span class="w-[1px] h-3.5 bg-[var(--md-sys-color-outline-variant)]/20"></span>

            <UserAccountPopover />
          </div>
        </div>
      </div>
    </header>

    <!-- 🌟 侧栏与底栏自适应容器 (严格修复为 dynamicNavItems) -->
    <nav
      class="unified-adaptive-shell will-change-[top,bottom,left,right,width,height,border-radius] [transform:translateZ(0)]"
      :class="[
        isMobile ? 'shell-mobile-dock' : (isSidebarCollapsed ? 'shell-desktop-rail' : 'shell-desktop-drawer'),
        isDark ? 'dark-liquid-glass' : 'light-liquid-glass'
      ]"
    >
      <div
        v-if="!isMobile"
        class="w-full flex items-center justify-between px-1 h-12 mb-6 shrink-0"
      >
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="w-11 h-11 shrink-0 rounded-[18px] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center shadow-sm">
            <img :src="configStore.siteLogo" alt="" class="size-full object-contain rounded-xl">
          </div>
          <div
            class="flex flex-col overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
            :class="isSidebarCollapsed ? 'opacity-0 -translate-x-4 w-0 pointer-events-none' : 'opacity-100 translate-x-0 w-auto'"
          >
            <span class="text-base font-extrabold tracking-tight text-[var(--md-sys-color-primary)] whitespace-nowrap">
              {{ configStore.siteTitle }}
            </span>
            <span class="text-[11px] opacity-60 whitespace-nowrap">
              {{ userStore.userConfig?.currency || 'USD' }} 结算区
            </span>
          </div>
        </div>

        <button
          @click="isSidebarCollapsed = !isSidebarCollapsed"
          class="w-8 h-8 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-[var(--md-sys-color-surface-container-high)] transition-all"
        >
          <span class="material-symbols-outlined text-lg transition-transform duration-300" :class="{ 'rotate-180': isSidebarCollapsed }">
            menu_open
          </span>
        </button>
      </div>

      <!-- 移动端底栏液态透镜 -->
      <div v-if="isMobile" class="liquid-lens-container">
        <div class="liquid-lens-slider" :style="liquidLensStyle">
          <div class="prism-rainbow-lens"></div>
        </div>
      </div>

      <!-- 🌟 导航列表项：使用 dynamicNavItems 并绑定气泡展开 -->
      <div
        class="w-full h-full flex transition-all duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] relative z-10"
        :class="isMobile ? 'flex-row items-center justify-around' : 'flex-col gap-1.5 flex-1'"
      >
        <div
          v-for="item in (isMobile ? dynamicNavItems.slice(0, 5) : dynamicNavItems)"
          :key="item.name"
          class="relative flex-1 md:flex-none h-full md:h-12 flex items-center justify-center"
        >
          <button
            @click="handleNavClick(item)"
            class="nav-tab-item group relative flex items-center font-medium transition-all duration-300 active:scale-95 cursor-pointer w-full"
            :class="[
              isMobile 
                ? 'flex-col justify-center h-full py-1 gap-0.5' 
                : (isSidebarCollapsed ? 'justify-center h-12 px-0 rounded-full' : 'h-12 px-4 gap-4 rounded-full'),
              (route.path === item.path || activeBubbleMenu === item.id)
                ? (isMobile ? 'text-[var(--md-sys-color-primary)] font-bold' : 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shadow-sm')
                : (isDark ? 'text-white/70 hover:text-white' : 'text-slate-700 hover:text-slate-900')
            ]"
          >
            <span class="material-symbols-outlined shrink-0 text-2xl">{{ item.icon }}</span>
            <span v-if="!isMobile" class="whitespace-nowrap tracking-wide text-sm">{{ item.name }}</span>
            <span v-if="isMobile" class="text-[10px] tracking-tight font-medium">{{ item.name }}</span>

            <!-- 角标 -->
            <span
              v-if="item.badge && item.badge > 0"
              class="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold shadow-sm"
              :class="isMobile ? 'absolute top-1 right-2' : 'ml-auto'"
            >
              {{ item.badge }}
            </span>
          </button>

          <!-- 🌟 手机端点击折叠项弹出的上浮气泡菜单 (Fluid Bubble Menu) -->
<!-- 🌟 核心修复：收起侧栏时使用 fixed 绝对定位向右飞出，100% 解决裁切弹不出的问题 -->
          <Transition name="bubble-spring">
            <div
              v-if="item.isFolder && activeBubbleMenu === item.id"
              class="bubble-menu-panel p-2 rounded-[24px] bg-[var(--md-sys-color-surface-container-high)] shadow-2xl border border-black/5 dark:border-transparent flex flex-col gap-1 z-[999] backdrop-blur-2xl select-none"
              :class="[
                isMobile 
                  ? 'fixed bottom-24 left-1/2 -translate-x-1/2 w-48' 
                  : (isSidebarCollapsed ? 'fixed left-[92px] w-52' : 'absolute bottom-14 left-4 w-48')
              ]"
              :style="!isMobile && isSidebarCollapsed ? { top: '35%' } : {}"
            >
              <div class="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--md-sys-color-primary)] border-b border-[var(--md-sys-color-outline-variant)]/10 mb-1">
                {{ item.name }}
              </div>

              <button
                v-for="sub in item.subItems"
                :key="sub.path"
                @click="router.push(sub.path); activeBubbleMenu = null"
                class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left hover:bg-[var(--md-sys-color-primary-container)] hover:text-[var(--md-sys-color-on-primary-container)] cursor-pointer"
              >
                <span class="material-symbols-outlined text-base">{{ sub.icon }}</span>
                <span>{{ sub.name }}</span>
                <span v-if="(sub as any).badge && (sub as any).badge > 0" class="ml-auto bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                  {{ (sub as any).badge }}
                </span>
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 🌟 在退出登录上方挂载 Zashboard 侧栏监控条 (支持展开/收起双态) -->
      <ClashSidebarWidget  v-if="!isMobile" :is-collapsed="isSidebarCollapsed" class="mb-2" />

      <!-- 退出登录 -->
      <div
        v-if="!isMobile"
        class="w-full pt-4 border-t border-[var(--md-sys-color-outline-variant)]/10 shrink-0"
      >
        <button
          @click="userStore.logout"
          class="w-full flex items-center h-12 rounded-full opacity-60 hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200"
          :class="isSidebarCollapsed ? 'justify-center px-0' : 'px-4 gap-4'"
        >
          <span class="material-symbols-outlined text-2xl shrink-0">logout</span>
          <span
            class="whitespace-nowrap text-sm transition-all duration-300"
            :class="isSidebarCollapsed ? 'opacity-0 -translate-x-3 w-0 overflow-hidden' : 'opacity-100 translate-x-0 w-auto'"
          >
            退出登入
          </span>
        </button>
      </div>
    </nav>

    <!-- 主体视口容器 -->
    <div
      class="main-content-viewport flex-1 flex flex-col min-w-0 min-h-screen transition-[padding] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
      :class="[
        isMobile ? 'pl-0' : (isSidebarCollapsed ? 'pl-[96px]' : 'pl-[272px]')
      ]"
    >
      <main class="flex-1 max-w-[1440px] w-full mx-auto p-4 md:p-8 pt-24 md:pt-28 pb-28 md:pb-8 relative">
        <md-dialog :open="clientPageOffline" @cancel.prevent data-client-offline>
          <span slot="headline">ReiaClash 客户端已离线</span>
          <p slot="content">5 秒后返回首页。客户端重新连接后会保留当前页面。</p>
        </md-dialog>
        <RouterView v-if="!clientPageOffline" v-slot="{ Component, route: currentRoute }">
          <Transition :name="isBackNav ? 'page-slide-back' : 'page-slide-forward'" mode="out-in">
            <component :is="Component" :key="currentRoute.path" />
          </Transition>
        </RouterView>
      </main>

      <GlobalFooterInjector />
    </div>

    <!-- 悬浮活动 FAB 按钮 -->
    <Transition name="fade-spring">
      <button
        v-if="showActivityFloatingWidget"
        @click="$router.push('/activities')"
        class="activity-floating-fab flex items-center justify-center liquid-glass-capsule shadow-2xl opacity-75 hover:opacity-100 transition-all duration-300 active:scale-90 cursor-pointer select-none"
        :class="isDark ? 'top-capsule-dark' : 'top-capsule-light'"
        title="查看进行中的福利活动"
      >
        <span class="material-symbols-outlined text-2xl text-amber-500 animate-bounce">
          celebration
        </span>
        <span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[var(--md-sys-color-surface)] animate-pulse"></span>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.shell-desktop-rail .nav-tab-item {
  justify-content: center !important;
  padding: 0 !important;
}
.shell-desktop-rail .nav-tab-item span:not(.material-symbols-outlined) {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
}


/* 🌟 气泡弹出非线性弹簧动画 */
.bubble-spring-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.bubble-spring-leave-active {
  transition: all 0.2s ease-in;
}
.bubble-spring-enter-from {
  opacity: 0;
  transform: translate(-50%, 15px) scale(0.85);
}
.bubble-spring-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px) scale(0.9);
}




/* =========================================================
   1. 图 2 真实光学方案：5 层阶梯渐进采样模糊 + 上层透明度渐隐蒙版
   ========================================================= */
.progressive-blur-container {
  pointer-events: none;
}

.blur-sublayer {
  position: absolute;
  inset: 0;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) var(--mask-stop));
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) var(--mask-stop));
}

.blur-1 {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  --mask-stop: 15%;
}

.blur-2 {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  --mask-stop: 30%;
}

.blur-3 {
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  --mask-stop: 50%;
}

.blur-4 {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  --mask-stop: 85%;
}

.blur-5 {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  --mask-stop: 110%;
}

/* 顶部背景色阶梯消退层（上层透明度减少透过，底层采样不受影响） */
.blur-tint-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.dark-tint {
  background: linear-gradient(to bottom, rgba(17, 20, 24, 0.6) 0%, rgba(17, 20, 24, 0.5) 55%, rgba(17, 20, 24, 0) 100%);
}

.light-tint {
  background: linear-gradient(to bottom, rgba(248, 249, 255, 0.6) 0%, rgba(248, 249, 255, 0.5) 55%, rgba(248, 249, 255, 0) 100%);
}

/* =========================================================
   2. 顶栏浮岛专用液态材质 (彻底消除暗色发白，与底栏同源)
   ========================================================= */
/* 暗色顶栏胶囊：纯正深色光学液体，高对比度白字 */
.top-capsule-dark {
  transform: scale(1.0);
  transform-origin: center top;left: 20px;
  right: 20px;
  background: rgba(40, 40, 58, 0.6) !important;
  color: #ffffff !important;
  border: 1px solid transparent;
  background-clip: padding-box, border-box;
  background-origin: padding-box, border-box;
  background-image: 
    linear-gradient(to bottom, rgba(22, 26, 34, 0.92), rgba(14, 18, 24, 0.95)),
    linear-gradient(135deg, 
      rgba(255, 255, 255, 0.75) 0%, 
      rgba(130, 215, 255, 0.45) 28%, 
      rgba(240, 140, 255, 0.35) 60%, 
      rgba(255, 230, 130, 0.3) 82%, 
      rgba(255, 255, 255, 0.75) 100%
    );
  box-shadow:
    inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.25),
    inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.6),
    0 16px 36px -6px rgba(0, 0, 0, 0.6);
}

/* 浅色顶栏胶囊 */
.top-capsule-light {
  transform: scale(1.0);
  transform-origin: center top;
  background: rgba(219, 224, 238, 0.6) !important;
  color: #191c20 !important;
  border: 1.2px solid transparent;
  background-clip: padding-box, border-box;
  background-origin: padding-box, border-box;
  background-image: 
    linear-gradient(to bottom, rgba(245, 248, 255, 0.92), rgba(230, 236, 246, 0.94)),
    linear-gradient(135deg, 
      rgba(255, 255, 255, 0.95) 0%, 
      rgba(150, 210, 255, 0.5) 30%, 
      rgba(255, 170, 240, 0.35) 65%, 
      rgba(255, 255, 255, 0.8) 100%
    );
  box-shadow:
    inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.95),
    inset 0 -1px 2px 0 rgba(0, 0, 0, 0.06),
    0 16px 32px -8px rgba(0, 30, 80, 0.12);
}

/* =========================================================
   3. 原样保留的自适应外壳、侧栏与底栏样式 (未作任何更改)
   ========================================================= */
.page-slide-forward-enter-active,
.page-slide-forward-leave-active,
.page-slide-back-enter-active,
.page-slide-back-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.35, 0.64, 1);
}

.page-slide-forward-enter-from {
  opacity: 0;
  transform: translate3d(36px, 0, 0);
}
.page-slide-forward-leave-to {
  opacity: 0;
  transform: translate3d(-24px, 0, 0);
}

.page-slide-back-enter-from {
  opacity: 0;
  transform: translate3d(-36px, 0, 0);
}
.page-slide-back-leave-to {
  opacity: 0;
  transform: translate3d(24px, 0, 0);
}

.fade-spring-enter-active,
.fade-spring-leave-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-spring-enter-from,
.fade-spring-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

/* 🌟 核心修复 1：解除统一外壳的全局 overflow: hidden，转交由内部独立控制，让气泡彻底越狱 */
.unified-adaptive-shell {
  position: fixed;
  z-index: 35;
  box-sizing: border-box;
  display: flex;
  /* 移除 overflow: hidden，让子元素可以自由向外浮动！ */
  transition:
    top 0.55s cubic-bezier(0.34, 1.35, 0.64, 1),
    bottom 0.55s cubic-bezier(0.34, 1.35, 0.64, 1),
    left 0.55s cubic-bezier(0.34, 1.35, 0.64, 1),
    right 0.55s cubic-bezier(0.34, 1.35, 0.64, 1),
    width 0.55s cubic-bezier(0.34, 1.35, 0.64, 1),
    height 0.55s cubic-bezier(0.34, 1.35, 0.64, 1),
    border-radius 0.55s cubic-bezier(0.34, 1.35, 0.64, 1),
    background-color 0.4s ease,
    box-shadow 0.4s ease;
}

.shell-mobile-dock {
  top: calc(100vh - 84px);
  bottom: 16px;
  left: 20px;
  right: 20px;
  width: calc(100vw - 40px);
  max-width: 460px;
  margin-left: auto;
  margin-right: auto;
  height: 66px;
  border-radius: 9999px;
  flex-direction: row;
  align-items: center;
  padding: 6px 10px;
}

.shell-desktop-rail {
  top: 16px;
  bottom: 16px;
  left: 16px;
  right: auto;
  width: 80px;
  height: calc(100vh - 32px);
  border-radius: 28px;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px 10px;
}

.shell-desktop-drawer {
  top: 16px;
  bottom: 16px;
  left: 16px;
  right: auto;
  width: 256px;
  height: calc(100vh - 32px);
  border-radius: 28px;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px 14px;
}

.liquid-lens-container {
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 10px;
  right: 10px;
  width: calc(100% - 20px);
  pointer-events: none;
  z-index: 5;
}

.liquid-lens-slider {
  height: 100%;
  padding: 2px 4px;
  box-sizing: border-box;
}

.prism-rainbow-lens {
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  position: relative;
  transition: all 0.3s ease;
}

.dark-liquid-glass .prism-rainbow-lens {
  background: rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.45),
    inset 0 -1px 2px 0 rgba(0, 0, 0, 0.5),
    0 4px 12px rgba(0, 0, 0, 0.3);
}

.light-liquid-glass .prism-rainbow-lens {
  background: rgba(255, 255, 255, 0.75);
  box-shadow:
    inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.95),
    inset 0 -1px 2px 0 rgba(0, 0, 0, 0.08),
    0 4px 14px rgba(0, 30, 80, 0.1);
}

.prism-rainbow-lens::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 9999px;
  padding: 1.5px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.85) 0%,
    rgba(120, 220, 255, 0.65) 28%,
    rgba(255, 130, 230, 0.5) 58%,
    rgba(255, 230, 120, 0.5) 80%,
    rgba(255, 255, 255, 0.9) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.dark-liquid-glass {
  background: rgba(50, 50, 59, 0.85) !important;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.16),
    inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.6),
    0 24px 50px -12px rgba(0, 0, 0, 0.7);
}

.light-liquid-glass {
  background: rgba(240, 243, 248, 0.88) !important;
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow:
    inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.95),
    inset 0 -1px 2px 0 rgba(0, 0, 0, 0.06),
    0 20px 40px -8px rgba(0, 30, 80, 0.12);
}


.activity-floating-fab {
  position: fixed !important;
  bottom: 25% !important;
  right: 24px !important;
  left: auto !important;
  width: 48px !important;
  height: 48px !important;
  border-radius: 20px !important;
  z-index: 45 !important;
}

@media (max-width: 767px) {
  .activity-floating-fab {
    bottom: 24% !important;
    right: 16px !important;
    left: auto !important;
    border-radius: 9999px !important;
  }
}
</style>
