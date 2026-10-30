<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute, RouterView } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useConfigStore } from '../stores/config'
import GlobalFooterInjector from '../components/common/GlobalFooterInjector.vue'
import UserAccountPopover from '../components/common/UserAccountPopover.vue'
import ClientDownloadModal from '../components/common/ClientDownloadModal.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const configStore = useConfigStore()



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

// 侧栏与底栏断点控制 (原样保留)
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
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const navItems = computed(() => [
  { name: '仪表盘', icon: 'dashboard', path: '/dashboard', badge: 0 },
  { name: '购买订阅', icon: 'shopping_bag', path: '/plan', badge: 0 },
  { name: '我的订单', icon: 'receipt_long', path: '/order', badge: userStore.userStat?.[0] || 0 },
  { name: '节点状态', icon: 'dns', path: '/servers', badge: 0 },
  { name: '工单客服', icon: 'support_agent', path: '/tickets', badge: userStore.userStat?.[1] || 0 },
  { name: '邀请返利', icon: 'group_add', path: '/invite', badge: 0 }
])

const activeIndex = computed(() => {
  const currentPath = route.path
  const index = navItems.value.slice(0, 5).findIndex(item => item.path === currentPath)
  return index !== -1 ? index : 0
})

const liquidLensStyle = computed(() => {
  const total = Math.min(navItems.value.length, 5)
  const itemWidthPercent = 100 / total
  return {
    width: `${itemWidthPercent}%`,
    transform: `translate3d(${activeIndex.value * 100}%, 0, 0)`,
    transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
  }
})

// 动态顶栏名称与返回
const routeTitles: Record<string, string> = {
  '/dashboard': '控制中心',
  '/plan': '购买订阅',
  '/order': '我的订单',
  '/servers': '节点状态',
  '/tickets': '工单客服',
  '/invite': '邀请返利',
  '/profile': '账号与安全中心',
  '/knowledge': '使用教程',
  '/download': '软件下载中心',// 🌟 新增：下载中心独立浮岛标题
  '/activities': '福利与活动中心' // 🌟 浮岛标题
}

const settings = (window as any).settings || {}
// 🌟 检测是否有有效活动代码 (用于控制悬浮窗强制关闭)
const hasActivityCode = computed(() => {
  const code = (settings.activity_custom_code || '').trim()
  return code.length > 0
})

// 🌟 悬浮窗显示条件：非首页 + 非活动页自身 + 后台开关开启 + 后台填有活动代码
const showActivityFloatingWidget = computed(() => {
  const isHomePage = route.path === '/dashboard'
  const isActivitiesPage = route.path === '/activities' // 🌟 排除活动页自身
  const isEnabled = Boolean(settings.activity_float_enabled)
  const hasCode = hasActivityCode.value

  return !isHomePage && !isActivitiesPage && isEnabled && hasCode
})

// 🌟 新增：点击下载按钮直接在新分页打开 SPA 软件下载中心
const openDownloadCenter = () => {
  const origin = window.location.origin
  const base = (window as any).routerBase || '/'
  // 拼接当前站点的 Hash 路由地址，在新标签页打开
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
</script>

<template>
  <div class="min-h-screen flex bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] transition-colors duration-300 relative overflow-x-hidden">
    
    <!-- 🌟 图 2 同款：阶梯渐进高斯模糊 + 上层透明度渐进输出蒙版 -->
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
      <div class="max-w-[1440px] w-full mx-auto px-4 md:px-8 flex items-center justify-between">
        
        <!-- 左侧：返回胶囊 (严格根据 isDark 切换深浅液态材质，彻底告别暗色发白) -->
        <!-- 左侧区域：非首页显示返回按钮，首页显示【下载客户端】液态胶囊 -->
<div class="flex items-center min-w-[52px]">
  <!-- 首页展示：点击直接在新分页打开下载中心 -->
  <button
    v-if="isHome"
    @click="openDownloadCenter"
    class="pointer-events-auto h-11 px-3.5 rounded-full flex items-center gap-1.5 liquid-glass-capsule transition-all active:scale-95 group cursor-pointer shadow-lg"
    :class="isDark ? 'top-capsule-dark' : 'top-capsule-light'"
    title="在新分页打开专属软件库"
  >
    <span class="material-symbols-outlined text-lg text-[var(--md-sys-color-primary)]">
      download
    </span>
    <span class="text-xs font-bold hidden sm:inline">下载客户端</span>
  </button>

          <!-- 子页面展示：返回上一级 -->
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

        <!-- 中间：液态玻璃名称岛 -->
        <div class="pointer-events-auto flex items-center justify-center">
          <Transition name="fade-spring" mode="out-in">
            <!-- 仪表盘首页：纯文字带质感阴影 -->
            <div v-if="isHome" :key="'home'" class="flex items-center">
              <span class="text-xl md:text-2xl font-black tracking-tight text-[var(--md-sys-color-on-surface)] drop-shadow-md select-none">
                {{ currentRouteTitle }}
              </span>
            </div>

            <!-- 子页面：液态玻璃岛 -->
            <div
              v-else
              :key="'subpage'"
              class="h-11 px-6 rounded-full flex items-center justify-center shadow-lg select-none transition-all"
              :class="isDark ? 'top-capsule-dark' : 'top-capsule-light'"
            >
              <span class="text-sm md:text-base font-black tracking-tight">
                {{ currentRouteTitle }}
              </span>
            </div>
          </Transition>
        </div>

        <!-- 右侧：聚合控制胶囊 (深浅切换 + 头像) -->
        <div class="pointer-events-auto min-w-[52px] flex justify-end">
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

    <!-- 侧栏 (代码与动画 100% 严格保持原样) -->
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
            <span class="material-symbols-outlined text-2xl">rocket_launch</span>
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

      <!-- 移动端底栏液态透镜 (原样保留) -->
      <div v-if="isMobile" class="liquid-lens-container">
        <div class="liquid-lens-slider" :style="liquidLensStyle">
          <div class="prism-rainbow-lens"></div>
        </div>
      </div>

      <!-- 导航列表项 (原样保留) -->
      <div
        class="w-full h-full flex transition-all duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] relative z-10"
        :class="isMobile ? 'flex-row items-center justify-around' : 'flex-col gap-1.5 flex-1'"
      >
        <button
          v-for="item in (isMobile ? navItems.slice(0, 5) : navItems)"
          :key="item.path"
          @click="router.push(item.path)"
          class="nav-tab-item group relative flex items-center font-medium transition-all duration-300 active:scale-95 cursor-pointer"
          :class="[
            isMobile 
              ? 'flex-col justify-center flex-1 h-full py-1 gap-0.5' 
              : (isSidebarCollapsed ? 'justify-center h-12 px-0 rounded-full' : 'h-12 px-4 gap-4 rounded-full'),
            route.path === item.path
              ? (isMobile ? 'text-[var(--md-sys-color-primary)] font-bold' : 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shadow-sm')
              : (isDark ? 'text-white/70 hover:text-white' : 'text-slate-700 hover:text-slate-900')
          ]"
        >
          <span class="material-symbols-outlined shrink-0 transition-transform duration-300 group-hover:scale-110 text-2xl">
            {{ item.icon }}
          </span>

          <span
            v-if="!isMobile"
            class="whitespace-nowrap tracking-wide text-sm transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            :class="isSidebarCollapsed ? 'opacity-0 -translate-x-3 w-0 overflow-hidden' : 'opacity-100 translate-x-0 w-auto'"
          >
            {{ item.name }}
          </span>

          <span v-if="isMobile" class="text-[10px] tracking-tight font-medium">
            {{ item.name }}
          </span>

          <span
            v-if="item.badge > 0"
            class="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold shadow-sm"
            :class="isMobile ? 'absolute top-1 right-3' : (isSidebarCollapsed ? 'absolute top-2 right-2' : 'ml-auto')"
          >
            {{ item.badge }}
          </span>
        </button>
      </div>

      <!-- 退出登录 (原样保留) -->
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

    <!-- 右侧主体内容容器 -->
    <div
      class="main-content-viewport flex-1 flex flex-col min-w-0 min-h-screen transition-[padding] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
      :class="[
        isMobile ? 'pl-0' : (isSidebarCollapsed ? 'pl-[96px]' : 'pl-[272px]')
      ]"
    >
      <main class="flex-1 max-w-[1440px] w-full mx-auto p-4 md:p-8 pt-24 md:pt-28 pb-28 md:pb-8 relative">
        <RouterView v-slot="{ Component, route: currentRoute }">
          <Transition :name="isBackNav ? 'page-slide-back' : 'page-slide-forward'" mode="out-in">
            <component :is="Component" :key="currentRoute.path" />
          </Transition>
        </RouterView>
      </main>


      
      <GlobalFooterInjector />
    </div>
  </div>
  <!-- 🌟 特性：非首页右下角约 1/4 处【圆形/方圆悬浮活动 FAB 按钮】 (75% 不透明度，带右上角红点，不遮挡底栏) -->
    <Transition name="fade-spring">
      <button
        v-if="showActivityFloatingWidget"
        @click="$router.push('/activities')"
        class="activity-floating-fab flex items-center justify-center liquid-glass-capsule shadow-2xl opacity-75 hover:opacity-100 transition-all duration-300 active:scale-90 cursor-pointer select-none"
        :class="isDark ? 'top-capsule-dark' : 'top-capsule-light'"
        title="查看进行中的福利活动"
      >
        <!-- 内部图标 -->
        <span class="material-symbols-outlined text-2xl text-amber-500 animate-bounce">
          celebration
        </span>

        <!-- 🌟 右上角未读呼吸红点角标 -->
        <span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[var(--md-sys-color-surface)] animate-pulse"></span>
      </button>
    </Transition>
</template>

<style scoped>
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
  transform: scale(1.1);
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
  transform: scale(1.1);
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

.unified-adaptive-shell {
  position: fixed;
  z-index: 35;
  box-sizing: border-box;
  display: flex;
  overflow: hidden;
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