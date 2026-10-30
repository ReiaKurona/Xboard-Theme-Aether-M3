<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../../api/client'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/button/filled-button.js'
import '@material/web/progress/circular-progress.js'

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const handleChangePassword = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  if (!oldPassword.value) {
    errorMsg.value = '请输入当前密码'
    return
  }
  if (!newPassword.value || newPassword.value.length < 8) {
    errorMsg.value = '新密码长度不能少于 8 位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = '两次输入的新密码不一致'
    return
  }

  loading.value = true
  try {
    await api.post('/user/changePassword', {
      old_password: oldPassword.value,
      new_password: newPassword.value
    })
    successMsg.value = '密码修改成功！其他设备的登录状态已同步失效'
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err: any) {
    errorMsg.value = err.message || '修改密码失败'
  } finally {
    loading.value = false
  }
}
</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <div class="p-6 md:p-8 rounded-[32px] bg-[var(--md-sys-color-surface-container)] shadow-sm h-full flex flex-col justify-between">
    <div>
      <div class="flex items-center gap-2.5 mb-2">
        <span class="material-symbols-outlined text-[var(--md-sys-color-primary)] text-2xl">password</span>
        <h3 class="text-xl font-black tracking-tight">修改安全密码</h3>
      </div>
      <p class="text-xs opacity-60 mb-5 leading-normal">建议使用包含大小写字母、数字与符号的高强度密码。成功后将登出其他活跃设备。</p>

      <form class="flex flex-col gap-3.5" @submit.prevent="handleChangePassword">
        <div v-if="errorMsg" class="p-3 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">error</span>
          {{ errorMsg }}
        </div>
        <div v-if="successMsg" class="p-3 rounded-2xl bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 text-xs flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">check_circle</span>
          {{ successMsg }}
        </div>

        <md-outlined-text-field
          label="当前旧密码"
          type="password"
          :value="oldPassword"
          @input="(e: any) => oldPassword = e.target.value"
          required
        >
          <span slot="leading-icon" class="material-symbols-outlined">key</span>
        </md-outlined-text-field>

        <md-outlined-text-field
          label="新密码 (至少8位)"
          type="password"
          :value="newPassword"
          @input="(e: any) => newPassword = e.target.value"
          required
        >
          <span slot="leading-icon" class="material-symbols-outlined">lock_reset</span>
        </md-outlined-text-field>

        <md-outlined-text-field
          label="确认新密码"
          type="password"
          :value="confirmPassword"
          @input="(e: any) => confirmPassword = e.target.value"
          required
        >
          <span slot="leading-icon" class="material-symbols-outlined">lock</span>
        </md-outlined-text-field>

        <div class="flex justify-end mt-2 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/10">
          <md-filled-button type="submit" :disabled="loading">
            <md-circular-progress v-if="loading" indeterminate slot="icon" style="--md-circular-progress-size: 16px;"></md-circular-progress>
            <span v-else>确认修改</span>
          </md-filled-button>
        </div>
      </form>
    </div>
  </div>
</template>