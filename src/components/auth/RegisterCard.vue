<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../../api/client'
import { useConfigStore } from '../../stores/config'
import CaptchaBox from '../common/CaptchaBox.vue'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/progress/circular-progress.js'

const route = useRoute()
const configStore = useConfigStore()
const emit = defineEmits(['register-success'])

const email = ref('')
const password = ref('')
const emailCode = ref('')
const inviteCode = ref('')
const captchaToken = ref('')
const loading = ref(false)
const errorMsg = ref('')
const countdown = ref(0)

const config = computed(() => configStore.config)

onMounted(async () => {
  // 确保站点配置已就绪
  await configStore.fetchConfig()

  if (route.query.code) {
    inviteCode.value = String(route.query.code)
    api.post('/passport/comm/pv', { invite_code: inviteCode.value }).catch(() => {})
  }
})

// 根据文档 3.2 构造验证码额外参数
const buildCaptchaParams = () => {
  if (!config.value?.is_captcha) return {}
  const type = config.value.captcha_type
  if (type === 'turnstile') return { turnstile_token: captchaToken.value }
  if (type === 'recaptcha-v3') return { recaptcha_v3_token: captchaToken.value }
  if (type === 'recaptcha') return { recaptcha_data: captchaToken.value }
  return {}
}

const sendEmailVerify = async () => {
  if (!email.value) {
    errorMsg.value = '请先输入邮箱'
    return
  }
  if (config.value?.is_captcha && !captchaToken.value) {
    errorMsg.value = '请先完成下方的人机安全验证'
    return
  }
  try {
    await api.post('/passport/comm/sendEmailVerify', {
      email: email.value,
      ...buildCaptchaParams()
    })
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch (err: any) {
    errorMsg.value = err.message || '验证码发送频繁'
  }
}

const handleRegister = async () => {
  if (config.value?.is_invite_force && !inviteCode.value) {
    errorMsg.value = '本站必须填写邀请码才可注册'
    return
  }
  if (config.value?.is_captcha && !captchaToken.value) {
    errorMsg.value = '请完成人机安全验证'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res: any = await api.post('/passport/auth/register', {
      email: email.value,
      password: password.value,
      email_code: config.value?.is_email_verify ? emailCode.value : undefined,
      invite_code: inviteCode.value || undefined,
      ...buildCaptchaParams()
    })
    localStorage.setItem('auth_data', res.auth_data)
    localStorage.setItem('sub_token', res.token)
    emit('register-success')
  } catch (err: any) {
    errorMsg.value = err.message || '注册失败'
  } finally {
    loading.value = false
  }
}

const onEmailInput = (e: Event) => { email.value = (e.target as HTMLInputElement).value }
const onCodeInput = (e: Event) => { emailCode.value = (e.target as HTMLInputElement).value }
const onPasswordInput = (e: Event) => { password.value = (e.target as HTMLInputElement).value }
const onInviteInput = (e: Event) => { inviteCode.value = (e.target as HTMLInputElement).value }
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <form class="flex flex-col gap-4 w-full" @submit.prevent="handleRegister">
    <div v-if="errorMsg" class="p-3.5 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
      <span class="material-symbols-outlined text-base">error</span>
      {{ errorMsg }}
    </div>

    <!-- 邮箱输入与白名单后缀提示 -->
    <div>
      <md-outlined-text-field label="邮箱地址" type="email" :value="email" @input="onEmailInput" class="w-full" required>
        <span slot="leading-icon" class="material-symbols-outlined">mail</span>
      </md-outlined-text-field>
      <div v-if="Array.isArray(config?.email_whitelist_suffix)" class="text-xs opacity-60 mt-1 px-1">
        仅支持后缀：{{ config?.email_whitelist_suffix.join(', ') }}
      </div>
    </div>

    <!-- 3.1 动态控制：只有在 is_email_verify == 1 时才渲染验证码输入框 -->
    <div v-if="config?.is_email_verify === 1" class="flex gap-2 items-center">
      <md-outlined-text-field label="邮箱验证码" :value="emailCode" @input="onCodeInput" class="flex-1" required>
        <span slot="leading-icon" class="material-symbols-outlined">verified</span>
      </md-outlined-text-field>
      <md-filled-tonal-button type="button" @click="sendEmailVerify" :disabled="countdown > 0" class="h-14">
        {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
      </md-filled-tonal-button>
    </div>

    <md-outlined-text-field label="密码 (至少8位)" type="password" :value="password" @input="onPasswordInput" class="w-full" required>
      <span slot="leading-icon" class="material-symbols-outlined">lock</span>
    </md-outlined-text-field>

    <!-- 3.1 动态控制：is_invite_force 决定是否必填 -->
    <md-outlined-text-field
      :label="config?.is_invite_force ? '邀请码 (必填)' : '邀请码 (选填)'"
      :value="inviteCode"
      @input="onInviteInput"
      class="w-full"
      :required="Boolean(config?.is_invite_force)"
    >
      <span slot="leading-icon" class="material-symbols-outlined">group_add</span>
    </md-outlined-text-field>

    <!-- 3.2 动态控制：开启人机验证时渲染对应厂商插件 -->
    <CaptchaBox
      v-if="config?.is_captcha"
      :type="config?.captcha_type"
      :site-key="config?.turnstile_site_key || config?.recaptcha_site_key || config?.recaptcha_v3_site_key"
      @success="captchaToken = $event"
      @reset="captchaToken = ''"
    />

    <md-filled-button type="submit" class="w-full h-12 rounded-full font-medium mt-1" :disabled="loading">
      <md-circular-progress v-if="loading" indeterminate slot="icon" style="--md-circular-progress-size: 20px;"></md-circular-progress>
      <span v-else>立即注册</span>
    </md-filled-button>

    <!-- 服务条款链接 -->
    <div v-if="config?.tos_url" class="text-center text-xs opacity-60 mt-1">
      注册即代表您同意
      <a :href="config.tos_url" target="_blank" class="text-[var(--md-sys-color-primary)] underline">服务条款</a>
    </div>
  </form>
</template>