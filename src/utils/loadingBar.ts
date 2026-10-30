import { ref } from 'vue'

export type LoadingStatus = 'loading' | 'success' | 'error' | 'idle'

export const loadingProgress = ref(0)
export const loadingStatus = ref<LoadingStatus>('idle')
export const isBarVisible = ref(false)

let activeRequests = 0
let trickleTimer: any = null

export const loadingBar = {
  start() {
    activeRequests++
    if (activeRequests === 1) {
      loadingStatus.value = 'loading'
      isBarVisible.value = true
      // 启动瞬间弹性冲刺至 25%
      loadingProgress.value = 25
      this.startTrickle()
    }
  },

  finish() {
    if (activeRequests > 0) activeRequests--
    if (activeRequests === 0) {
      this.stopTrickle()
      loadingProgress.value = 100
      loadingStatus.value = 'success'

      // 🌟 视觉留存：在 100% 停留 350ms 让用户充分看清粒子烟花爆裂，然后再平滑淡出
      setTimeout(() => {
        if (loadingStatus.value === 'success') {
          isBarVisible.value = false
          setTimeout(() => {
            if (!isBarVisible.value) {
              loadingProgress.value = 0
              loadingStatus.value = 'idle'
            }
          }, 400)
        }
      }, 350)
    }
  },

  fail() {
    activeRequests = 0
    this.stopTrickle()
    loadingProgress.value = 100
    loadingStatus.value = 'error'
    setTimeout(() => {
      isBarVisible.value = false
      setTimeout(() => {
        loadingProgress.value = 0
        loadingStatus.value = 'idle'
      }, 400)
    }, 600)
  },

  set(val: number) {
    loadingProgress.value = Math.min(Math.max(val, 0), 100)
  },

  startTrickle() {
    this.stopTrickle()
    trickleTimer = setInterval(() => {
      if (loadingStatus.value !== 'loading') return
      const cur = loadingProgress.value
      let step = 0
      if (cur < 50) step = Math.random() * 6 + 2
      else if (cur < 75) step = Math.random() * 3 + 1
      else if (cur < 92) step = Math.random() * 1 + 0.2
      loadingProgress.value = Math.min(cur + step, 92)
    }, 180)
  },

  stopTrickle() {
    if (trickleTimer) {
      clearInterval(trickleTimer)
      trickleTimer = null
    }
  }
}

// 🌟 调试神器：挂载在全局 window 上，你可以随时在 F12 控制台输入 __testLoadingBar() 触发查看！
if (typeof window !== 'undefined') {
  ;(window as any).__testLoadingBar = () => {
    loadingBar.start()
    setTimeout(() => {
      loadingBar.finish()
    }, 1800)
  }
}