<script setup lang="ts">
import { ref, computed } from 'vue'
import { api } from '../../api/client'
import { useConfigStore } from '../../stores/config'
import CaptchaBox from '../common/CaptchaBox.vue'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/button/text-button.js'
import '@material/web/progress/circular-progress.js'

const emit = defineEmits(['switch-tab'])
const configStore = useConfigStore()
const config = computed(() => configStore.config)

const email = ref('')
const emailCode = ref('')
const password = ref('')
const captchaToken = ref('')
const loading = ref(false)
const errorMsg = ref('')
const countdown = ref(0)

const onEmailInput = (e: Event) => { email.value = (e.target as HTMLInputElement).value }
const onCodeInput = (e: Event) => { emailCode.value = (e.target as HTMLInputElement).value }
const onPasswordInput = (e: Event) => { password.value = (e.target as HTMLInputElement).value }

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
    errorMsg.value = '请先完成人机验证'
    return
  }
  try {
    // 3.5 开启人机验证时需携带参数
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

const handleReset = async () => {
  if (!password.value || password.value.length < 8) {
    errorMsg.value = '新密码至少为 8 位'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    await api.post('/passport/auth/forget', {
      email: email.value,
      email_code: emailCode.value,
      password: password.value
    })
    alert('密码重置成功，请使用新密码登录')
    emit('switch-tab', 'login')
  } catch (err: any) {
    errorMsg.value = err.message || '重置失败'
  } finally {
    loading.value = false
  }
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <form class="flex flex-col gap-4 w-full" @submit.prevent="handleReset">
    <div v-if="errorMsg" class="p-3.5 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
      <span class="material-symbols-outlined text-base">error</span>
      {{ errorMsg }}
    </div>

    <md-outlined-text-field label="绑定邮箱" type="email" :value="email" @input="onEmailInput" required>
      <span slot="leading-icon" class="material-symbols-outlined">mail</span>
    </md-outlined-text-field>

    <div class="flex gap-2 items-center">
      <md-outlined-text-field label="验证码" :value="emailCode" @input="onCodeInput" class="flex-1" required>
        <span slot="leading-icon" class="material-symbols-outlined">verified</span>
      </md-outlined-text-field>
      <md-filled-tonal-button type="button" @click="sendEmailVerify" :disabled="countdown > 0" class="h-14">
        {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
      </md-filled-tonal-button>
    </div>

    <md-outlined-text-field label="新密码 (≥8位)" type="password" :value="password" @input="onPasswordInput" required>
      <span slot="leading-icon" class="material-symbols-outlined">key</span>
    </md-outlined-text-field>

    <!-- 3.2 人机验证组件 -->
    <CaptchaBox
      v-if="config?.is_captcha"
      :type="config?.captcha_type"
      :site-key="config?.turnstile_site_key || config?.recaptcha_site_key || config?.recaptcha_v3_site_key"
      @success="captchaToken = $event"
      @reset="captchaToken = ''"
    />

    <md-filled-button type="submit" class="w-full h-12 rounded-full font-medium mt-1" :disabled="loading">
      <md-circular-progress v-if="loading" indeterminate slot="icon" style="--md-circular-progress-size: 20px;"></md-circular-progress>
      <span v-else>重置并保存密码</span>
    </md-filled-button>

    <div class="text-center mt-1">
      <md-text-button type="button" @click="emit('switch-tab', 'login')">返回登录</md-text-button>
    </div>
  </form>
</template>