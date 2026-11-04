import { createWebHashHistory, type RouterHistory } from 'vue-router'

// 🌟 1. 客户端持久化混淆主密钥 (每个用户设备独享，保证在当前设备始终可逆)
const MASTER_SEED_KEY = 'xboard_route_entropy_seed'
let masterSeed = 0

function initMasterSeed(): number {
  if (typeof window === 'undefined') return 0x6d2b79f5
  let stored = localStorage.getItem(MASTER_SEED_KEY)
  if (!stored) {
    const randomVal = (Math.random() * 0xffffffff) >>> 0
    stored = String(randomVal)
    localStorage.setItem(MASTER_SEED_KEY, stored)
  }
  return parseInt(stored, 10) || 0x6d2b79f5
}

masterSeed = initMasterSeed()

// 高性能轻量 PRNG (Mulberry32 算法，用于产生瞬时混淆流)
function createPrng(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) & 0xff
  }
}

// 16 位轻量校验和 (用于辨识当前字符串是乱码哈希还是未加密的明文)
function calculateChecksum(bytes: Uint8Array): number {
  let sum1 = 0xff
  let sum2 = 0xff
  for (let i = 0; i < bytes.length; i++) {
    sum1 = (sum1 + bytes[i]) % 255
    sum2 = (sum2 + sum1) % 255
  }
  return (sum2 << 8) | sum1
}

// =========================================================
// 🌟 2. 动态随机加盐编码器 (每次调用生成完全不同的哈希串)
// =========================================================
export function encodeObfuscatedPath(rawPath: string): string {
  if (!rawPath || rawPath === '/') return '/'

  try {
    const encoder = new TextEncoder()
    const pathBytes = encoder.encode(rawPath)

    // 生成 4 字节的瞬时随机盐 (Salt)
    const saltInt = (Math.random() * 0xffffffff) >>> 0
    const saltHex = saltInt.toString(16).padStart(8, '0')

    // 计算校验和
    const checksum = calculateChecksum(pathBytes)
    const packet = new Uint8Array(2 + pathBytes.length)
    packet[0] = (checksum >> 8) & 0xff
    packet[1] = checksum & 0xff
    packet.set(pathBytes, 2)

    // 生成混淆流并异或
    const prng = createPrng(masterSeed ^ saltInt)
    const cipherBytes = new Uint8Array(packet.length)
    for (let i = 0; i < packet.length; i++) {
      cipherBytes[i] = packet[i] ^ prng()
    }

    let cipherHex = ''
    for (let i = 0; i < cipherBytes.length; i++) {
      cipherHex += cipherBytes[i].toString(16).padStart(2, '0')
    }

    return `/${saltHex}${cipherHex}`
  } catch {
    return rawPath
  }
}

// =========================================================
// 🌟 3. 动态混淆解码器 (瞬间还原真实路径，带明文兜底兼容)
// =========================================================
export function decodeObfuscatedPath(obfuscatedPath: string): string {
  if (!obfuscatedPath || obfuscatedPath === '/') return '/'

  const clean = obfuscatedPath.startsWith('/') ? obfuscatedPath.slice(1) : obfuscatedPath

  // 兜底：如果不是十六进制串或长度不足，说明是外部进来的明文链接 (如 /login?verify=...)
  if (!/^[0-9a-fA-F]{12,}$/.test(clean)) {
    return obfuscatedPath
  }

  try {
    const saltHex = clean.slice(0, 8)
    const cipherHex = clean.slice(8)
    const saltInt = parseInt(saltHex, 16)

    const cipherBytes = new Uint8Array(cipherHex.length / 2)
    for (let i = 0; i < cipherBytes.length; i++) {
      cipherBytes[i] = parseInt(cipherHex.slice(i * 2, i * 2 + 2), 16)
    }

    const prng = createPrng(masterSeed ^ saltInt)
    const packet = new Uint8Array(cipherBytes.length)
    for (let i = 0; i < packet.length; i++) {
      packet[i] = cipherBytes[i] ^ prng()
    }

    const expectedChecksum = (packet[0] << 8) | packet[1]
    const pathBytes = packet.subarray(2)
    const actualChecksum = calculateChecksum(pathBytes)

    if (expectedChecksum !== actualChecksum) {
      return obfuscatedPath
    }

    const decoder = new TextDecoder('utf-8')
    return decoder.decode(pathBytes)
  } catch {
    return obfuscatedPath
  }
}

// =========================================================
// 🌟 4. 全局透明的 Vue Router 4 自定义历史栈封装 (无类型报错版)
// =========================================================
export function createObfuscatedHashHistory(base?: string): RouterHistory {
  const rawHistory = createWebHashHistory(base)

  return {
    get base() {
      return rawHistory.base
    },

    get location() {
      return decodeObfuscatedPath(rawHistory.location)
    },

    get state() {
      return rawHistory.state
    },

    // 🌟 修复：直接以 string 接收并安全取值，彻底消除 TS 报错
    push(to: string, data?: any) {
      const targetStr = (typeof to === 'string' ? to : (to as any)?.path) || '/'
      const obfuscated = encodeObfuscatedPath(targetStr)
      rawHistory.push(obfuscated, data)
    },

    // 🌟 修复：直接以 string 接收并安全取值
    replace(to: string, data?: any) {
      const targetStr = (typeof to === 'string' ? to : (to as any)?.path) || '/'
      const obfuscated = encodeObfuscatedPath(targetStr)
      rawHistory.replace(obfuscated, data)
    },

    go(delta: number, triggerListeners?: boolean) {
      rawHistory.go(delta, triggerListeners)
    },

    // 🌟 修复：使用标准的回调函数类型签名
    listen(callback: (to: string, from: string, info: any) => void) {
      return rawHistory.listen((to, from, info) => {
        const realTo = decodeObfuscatedPath(to)
        const realFrom = decodeObfuscatedPath(from)
        callback(realTo, realFrom, info)
      })
    },

    // 🌟 修复：直接以 string 接收
    createHref(location: string): string {
      const targetStr = (typeof location === 'string' ? location : (location as any)?.path) || '/'
      const obfuscated = encodeObfuscatedPath(targetStr)
      return rawHistory.createHref(obfuscated)
    },

    destroy() {
      rawHistory.destroy()
    }
  }
}