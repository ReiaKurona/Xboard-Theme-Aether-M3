import axiosModule, { type AxiosResponse } from 'axios'
import { decode } from '@msgpack/msgpack'
import { loadingBar } from '../utils/loadingBar'

// 🌟 强壮兼容：解决 ESM/CJS 混调导致 e is not a function 的问题
const axios = (axiosModule as any).default || axiosModule

const routerBase = (window as any).routerBase || '/'

export const api = axios.create({
  baseURL: `${routerBase}api/v1`,
  responseType: 'arraybuffer',
  headers: {
    'Accept': 'application/msgpack, application/json;q=0.9',
    'Content-Language': localStorage.getItem('lang') || 'zh-CN'
  }
})

// 请求拦截器 (标注 : any 解决 ts(7006) 报错)
api.interceptors.request.use((config: any) => {
  loadingBar.start()
  const auth = localStorage.getItem('auth_data')
  if (auth) {
    config.headers = config.headers || {}
    config.headers.Authorization = auth
  }
  return config
})

// 响应拦截器 (标注 : any 解决 ts(7006) 报错)
api.interceptors.response.use(
  (response: any) => {
    loadingBar.finish()
    if (response.status === 304) return undefined

    const data = parseResponsePayload(response)
    if (data && typeof data === 'object') {
      if (data.type !== undefined) return data
      if (data.status === 'success') return data.data
      if (data.status === 'fail') return Promise.reject(new Error(data.message))
      return data.data ?? data
    }
    return data
  },
  (error: any) => {
    loadingBar.fail()
    if (error.response?.data) {
      const errData = parseResponsePayload(error.response)
      if (error.response.status === 403) {
        localStorage.removeItem('auth_data')
        if (!location.hash.startsWith('#/login')) {
          location.hash = '#/login'
        }
        return Promise.reject(new Error(errData?.message || '未登录或登录已过期'))
      }
      if (error.response.status === 422 && errData?.errors) {
        const firstError = Object.values(errData.errors)[0] as string[]
        return Promise.reject(new Error(firstError[0]))
      }
      return Promise.reject(new Error(errData?.message || '请求失败'))
    }
    return Promise.reject(error)
  }
)

function parseResponsePayload(res: AxiosResponse): any {
  const contentType = String(res.headers?.['content-type'] || '')
  if (contentType.includes('application/msgpack')) {
    return decode(new Uint8Array(res.data))
  }
  try {
    const text = new TextDecoder().decode(res.data)
    return JSON.parse(text)
  } catch {
    return res.data
  }
}