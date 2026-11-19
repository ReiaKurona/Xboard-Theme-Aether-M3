import { onUnmounted, ref, watch } from 'vue'
import { useClashStore } from '../stores/clash'
import { reiaApi } from '../api/reia'

export function useClashStream(path: string, params: () => Record<string, string>, consume: (data: unknown) => void, enabled = () => true) {
  const client = useClashStore()
  const streamState = ref<'waiting' | 'connecting' | 'live' | 'retrying'>('waiting')
  let socket: WebSocket | undefined, retry: ReturnType<typeof setTimeout> | undefined, delay = 500

  function stop() {
    clearTimeout(retry)
    const old = socket
    socket = undefined
    old?.close()
  }

  function open() {
    if (!client.isConnected || !client.kernelReady || !client.secret || !enabled()) {
      streamState.value = 'waiting'
      return
    }
    streamState.value = 'connecting'
    try {
      const current = reiaApi.socket(path, params())
      socket = current
      current.onopen = () => {
        if (socket !== current) return
        streamState.value = 'live'
        delay = 500
      }
      current.onmessage = event => {
        if (socket !== current) return
        try { consume(JSON.parse(event.data)) } catch { /* ignore malformed frames */ }
      }
      current.onerror = () => current.close()
      current.onclose = () => {
        if (socket !== current) return
        socket = undefined
        scheduleRetry()
      }
    } catch {
      scheduleRetry()
    }
  }

  function scheduleRetry() {
    streamState.value = 'retrying'
    retry = setTimeout(open, delay)
    delay = Math.min(delay * 2, 5000)
  }

  function reconnect() { stop(); delay = 500; open() }
  watch(() => [client.isConnected, client.kernelReady, client.secret, JSON.stringify(params()), enabled()], reconnect, { immediate: true })
  onUnmounted(stop)
  return { streamState, reconnect }
}
