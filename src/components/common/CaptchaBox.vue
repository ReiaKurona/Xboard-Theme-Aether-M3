<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  type?: 'turnstile' | 'recaptcha' | 'recaptcha-v3'
  siteKey?: string | null
}>()

const emit = defineEmits<{
  (e: 'success', token: string): void
  (e: 'reset'): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let widgetId: any = null

const renderTurnstile = () => {
  if (!window.turnstile || !containerRef.value || !props.siteKey) return
  if (widgetId !== null) window.turnstile.remove(widgetId)

  widgetId = window.turnstile.render(containerRef.value, {
    sitekey: props.siteKey,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    callback: (token: string) => emit('success', token),
    'expired-callback': () => emit('reset'),
    'error-callback': () => emit('reset')
  })
}

onMounted(() => {
  if (!props.siteKey) return

  if (props.type === 'turnstile') {
    if (!document.getElementById('turnstile-script')) {
      const script = document.createElement('script')
      script.id = 'turnstile-script'
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.onload = () => renderTurnstile()
      document.head.appendChild(script)
    } else if (window.turnstile) {
      renderTurnstile()
    }
  }
})

onUnmounted(() => {
  if (window.turnstile && widgetId !== null) {
    window.turnstile.remove(widgetId)
  }
})

declare global {
  interface Window {
    turnstile?: any
  }
}
</script>

<template>
  <div class="flex justify-center my-2 min-h-[65px] items-center">
    <div ref="containerRef"></div>
  </div>
</template>