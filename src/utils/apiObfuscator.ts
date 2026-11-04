// 🌟 前后端 100% 字节对齐的 RC4 极速对称流加密器
const MASTER_KEY = 'xboard_aether_m3_secure_seed'

function rc4(key: string, data: Uint8Array): Uint8Array {
  const s = new Uint8Array(256)
  for (let i = 0; i < 256; i++) s[i] = i

  let j = 0
  const keyLen = key.length
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % keyLen)) % 256
    const tmp = s[i]
    s[i] = s[j]
    s[j] = tmp
  }

  let i = 0
  j = 0
  const res = new Uint8Array(data.length)
  for (let y = 0; y < data.length; y++) {
    i = (i + 1) % 256
    j = (j + s[i]) % 256
    const tmp = s[i]
    s[i] = s[j]
    s[j] = tmp
    res[y] = data[y] ^ s[(s[i] + s[j]) % 256]
  }
  return res
}

/**
 * 🌟 将任意 API 路径动态加盐打包为混淆路由
 * 例如: /user/info -> /e/3a9f0b12c8...
 * 例如: /user/order/detail?trade_no=123 -> /e/88bc2a1... (连参数都完全混淆隐藏！)
 */
export function obfuscateApiPath(originalUrl: string): string {
  if (!originalUrl) return originalUrl

  // 仅混淆相对路径 (若是 http 开头的第三方请求则原样放行)
  if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
    return originalUrl
  }

  // 清洗开头的 / 和 /api/v1/ 前缀
  let cleanPath = originalUrl.replace(/^\/?(api\/v1\/)?/, '')

  try {
    // 1. 生成 8 字符瞬时随机十六进制盐 (Salt)
    const saltInt = (Math.random() * 0xffffffff) >>> 0
    const saltHex = saltInt.toString(16).padStart(8, '0')

    // 2. 派生瞬时会话密钥
    const sessionKey = `${saltHex}_${MASTER_KEY}`

    // 3. UTF-8 编码路径与参数
    const pathBytes = new TextEncoder().encode(cleanPath)

    // 4. 执行极速流式加密
    const cipherBytes = rc4(sessionKey, pathBytes)

    // 5. 转为十六进制
    let cipherHex = ''
    for (let i = 0; i < cipherBytes.length; i++) {
      cipherHex += cipherBytes[i].toString(16).padStart(2, '0')
    }

    // 6. 返回动态网关格式
    return `/e/${saltHex}${cipherHex}`
  } catch {
    return originalUrl
  }
}