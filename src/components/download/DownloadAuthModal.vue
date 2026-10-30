<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '../../stores/user'
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'
import '@material/web/textfield/outlined-text-field.js'

const props = defineProps<{
  open: boolean
  baseUrl: string
}>()

const emit = defineEmits(['close', 'authenticated'])
const userStore = useUserStore()

const email = ref(userStore.userInfo?.email || '')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

const handleLogin = async () => {
  if (!email.value || !password.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${props.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message)

    localStorage.setItem('reiadown_token', data.token)
    emit('authenticated', data.token)
  } catch (err: any) {
    errorMsg.value = err.message || '连接下载中心凭证失败'
  } finally {
    loading.value = false
  }
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <md-dialog :open="open" @closed="emit('close')" class="max-w-md w-full">
    <div slot="headline" class="font-black text-xl flex items-center gap-2">
      <span class="material-symbols-outlined text-[var(--md-sys-color-primary)]">vpn_key</span>
      连接专属下载中心
    </div>
    <div slot="content" class="flex flex-col gap-3 py-2 text-xs">
      <p class="opacity-60">下载中心服务受零知识加密保护，请验证身份以派发临时端到端解密会话材料。</p>
      <div v-if="errorMsg" class="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
        {{ errorMsg }}
      </div>
      <md-outlined-text-field label="注册邮箱" :value="email" @input="(e: any) => email = e.target.value" class="w-full"></md-outlined-text-field>
      <md-outlined-text-field label="密码" type="password" :value="password" @input="(e: any) => password = e.target.value" class="w-full"></md-outlined-text-field>
    </div>
    <div slot="actions">
      <md-text-button @click="emit('close')">取消</md-text-button>
      <md-filled-button @click="handleLogin" :disabled="loading">确认连接</md-filled-button>
    </div>
  </md-dialog>
</template>