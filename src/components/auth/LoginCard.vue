<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../../api/client'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'

const emit = defineEmits(['switch-tab', 'login-success'])

// 登录模式：密码登录 | 邮件免密链接登录 (3.7)
const loginMode = ref<'password' | 'mailLink'>('password')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const mailSent = ref(false)

const onEmailInput = (e: Event) => { email.value = (e.target as HTMLInputElement).value }
const onPasswordInput = (e: Event) => { password.value = (e.target as HTMLInputElement).value }

const handleLogin = async () => {
  if (!email.value) {
    errorMsg.value = '请输入邮箱'
    return
  }

  // 3.7 邮件免密链接登录流程
  if (loginMode.value === 'mailLink') {
    loading.value = true
    errorMsg.value = ''
    try {
      await api.post('/passport/auth/loginWithMailLink', {
        email: email.value,
        redirect: '/dashboard'
      })
      mailSent.value = true
    } catch (err: any) {
      errorMsg.value = err.message || '发送登录邮件失败'
    } finally {
      loading.value = false
    }
    return
  }

  // 3.4 标准密码登录
  if (!password.value || password.value.length < 8) {
    errorMsg.value = '密码不能少于 8 位'
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    const res: any = await api.post('/passport/auth/login', {
      email: email.value,
      password: password.value
    })
    localStorage.setItem('auth_data', res.auth_data)
    localStorage.setItem('sub_token', res.token)
    localStorage.setItem('is_admin', res.is_admin ? '1' : '0')
    try {
      const raw = localStorage.getItem('xboard_accounts')
      const list = raw ? JSON.parse(raw) : []
      const idx = list.findIndex((a: any) => a.email === email.value)
      const accData = {
        email: email.value,
        auth_data: res.auth_data,
        sub_token: res.token,
        avatar_url: ''
      }
      if (idx !== -1) {
        list[idx] = accData
      } else {
        list.push(accData)
      }
      localStorage.setItem('xboard_accounts', JSON.stringify(list))
    } catch {}

    emit('login-success')
  } catch (err: any) {
    errorMsg.value = err.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <form class="flex flex-col gap-4 w-full" @submit.prevent="handleLogin">
    <!-- 错误反馈 -->
    <div v-if="errorMsg" class="p-3.5 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
      <span class="material-symbols-outlined text-base">error</span>
      {{ errorMsg }}
    </div>

    <!-- 邮件免密发送成功提示 -->
    <div v-if="mailSent" class="p-4 rounded-2xl bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 text-sm flex flex-col gap-1">
      <div class="flex items-center gap-2 font-medium">
        <span class="material-symbols-outlined">mark_email_read</span>
        登录邮件已送达
      </div>
      <p class="text-xs opacity-90">请前往邮箱点击快捷登录链接，页面将自动完成登录。</p>
    </div>

    <md-outlined-text-field
      label="邮箱地址"
      type="email"
      :value="email"
      @input="onEmailInput"
      class="w-full"
      required
    >
      <span slot="leading-icon" class="material-symbols-outlined">mail</span>
    </md-outlined-text-field>

    <md-outlined-text-field
      v-if="loginMode === 'password'"
      label="密码 (≥8位)"
      type="password"
      :value="password"
      @input="onPasswordInput"
      class="w-full"
      required
    >
      <span slot="leading-icon" class="material-symbols-outlined">lock</span>
    </md-outlined-text-field>

    <div class="flex justify-between items-center text-xs px-1">
      <!-- 切换密码登录 / 邮件免密登录 -->
      <md-text-button type="button" @click="loginMode = loginMode === 'password' ? 'mailLink' : 'password'; mailSent = false">
        {{ loginMode === 'password' ? '使用邮件免密登录' : '改用密码登录' }}
      </md-text-button>

      <md-text-button v-if="loginMode === 'password'" type="button" @click="emit('switch-tab', 'forget')">
        忘记密码？
      </md-text-button>
    </div>

    <md-filled-button type="submit" class="w-full h-12 rounded-full font-medium mt-1" :disabled="loading">
      <md-circular-progress v-if="loading" indeterminate slot="icon" style="--md-circular-progress-size: 20px;"></md-circular-progress>
      <span v-else>{{ loginMode === 'password' ? '立即登入' : '发送免密登录链接' }}</span>
    </md-filled-button>
  </form>
</template>