<script setup lang="ts">
import { ref, defineAsyncComponent, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../../api/client'
import { useConfigStore } from '../../stores/config'
import GlobalFooterInjector from '../../components/common/GlobalFooterInjector.vue'
import '@material/web/iconbutton/icon-button.js'

// 异步加载三张表单卡片
const LoginCard = defineAsyncComponent(() => import('../../components/auth/LoginCard.vue'))
const RegisterCard = defineAsyncComponent(() => import('../../components/auth/RegisterCard.vue'))
const ForgetCard = defineAsyncComponent(() => import('../../components/auth/ForgetCard.vue'))

const router = useRouter()
const route = useRoute()
const configStore = useConfigStore()

const currentTab = ref<'login' | 'register' | 'forget'>('login')
const isDark = ref(false)

// ⚡ 关键：页面脚本加载阶段立即发起请求，不必干等 onMounted
configStore.fetchConfig()

onMounted(async () => {
  isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (isDark.value) document.documentElement.classList.add('dark')

  if (route.query.code) currentTab.value = 'register'

  if (route.query.verify) {
    try {
      const res: any = await api.get(`/passport/auth/token2Login?verify=${route.query.verify}`)
      localStorage.setItem('auth_data', res.auth_data)
      localStorage.setItem('sub_token', res.token)
      router.push('/dashboard')
    } catch {
      alert('免密链接已失效，请重新登录')
    }
  }
})

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}

const onAuthSuccess = () => {
  const redirect = (route.query.redirect as string) || '/dashboard'
  router.push(redirect)
}
</script>

<template>
  <div class="min-h-screen flex flex-col justify-between items-center px-4 py-8 relative overflow-hidden transition-colors duration-300">
    <!-- 右上角 MD3 原生切换暗黑模式按钮 -->
    <div class="absolute top-6 right-6 z-10">
      <md-icon-button @click="toggleTheme" class="bg-[var(--md-sys-color-surface-container)] rounded-full">
        <span class="material-symbols-outlined">
          {{ isDark ? 'light_mode' : 'dark_mode' }}
        </span>
      </md-icon-button>
    </div>

    <div class="my-auto w-full max-w-md flex flex-col items-center">
      <!-- 🌟 核心：根据 guest/comm/config 动态渲染站点信息 -->
      <div class="text-center mb-7 flex flex-col items-center">
        <!-- Logo 展示区：支持自定义图片或 MD3 原生图标容器 -->
        <a :href="configStore.siteUrl" class="inline-block transition-transform hover:scale-105 active:scale-95 duration-200">
          <img
            v-if="configStore.siteLogo"
            :src="configStore.siteLogo"
            :alt="configStore.siteTitle"
            class="h-16 w-auto max-w-[220px] object-contain mb-3 drop-shadow-sm"
          />
          <div
            v-else
            class="w-16 h-16 rounded-[24px] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center mb-3 shadow-sm transition-colors"
          >
            <span class="material-symbols-outlined text-3xl">rocket_launch</span>
          </div>
        </a>

        <!-- 站点标题 (从 settings.title 或域名读取) -->
        <h1 class="text-3xl font-extrabold tracking-tight text-[var(--md-sys-color-on-surface)]">
          {{ configStore.siteTitle }}
        </h1>

        <!-- 站点副标题 / 描述 (来自接口的 app_description) -->
        <p v-if="configStore.siteDescription" class="text-sm font-medium text-[var(--md-sys-color-primary)] mt-1.5 opacity-90 tracking-wide">
          {{ configStore.siteDescription }}
        </p>
      </div>

      <!-- MD3 Exp 主体卡片容器 -->
      <div class="w-full bg-[var(--md-sys-color-surface-container)] rounded-[32px] p-7 shadow-sm border border-[var(--md-sys-color-outline-variant)]/20 transition-all">
        <!-- MD3 分段选择药丸栏 -->
        <div v-if="currentTab !== 'forget'" class="flex p-1.5 bg-[var(--md-sys-color-surface-container-high)] rounded-full mb-6">
          <button
            type="button"
            class="flex-1 py-2 text-sm font-medium rounded-full transition-all duration-300"
            :class="currentTab === 'login' ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm' : 'opacity-70 hover:opacity-100'"
            @click="currentTab = 'login'"
          >
            登入
          </button>
          <button
            type="button"
            class="flex-1 py-2 text-sm font-medium rounded-full transition-all duration-300"
            :class="currentTab === 'register' ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm' : 'opacity-70 hover:opacity-100'"
            @click="currentTab = 'register'"
          >
            注册
          </button>
        </div>

        <!-- 异步卡片容器，搭配流式过渡 -->
        <Transition mode="out-in" name="fade-slide">
          <Suspense>
            <component
              :is="currentTab === 'login' ? LoginCard : currentTab === 'register' ? RegisterCard : ForgetCard"
              @switch-tab="currentTab = $event"
              @login-success="onAuthSuccess"
              @register-success="onAuthSuccess"
            />
            <template #fallback>
              <div class="py-12 flex justify-center items-center">
                <md-circular-progress indeterminate></md-circular-progress>
              </div>
            </template>
          </Suspense>
        </Transition>
      </div>
    </div>

    <!-- 底部注入外挂视窗缩放引擎组件 -->
    <GlobalFooterInjector />
  </div>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>