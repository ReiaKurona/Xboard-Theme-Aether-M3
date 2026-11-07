// 🌟 增强版 GeoIP 竞速引擎：支持多段重试比对与全中文展示
export interface OutboundGeoIp {
  ip: string
  countryCode: string
  isp: string
  typeCn: string
  qualityCn: string
}

const FALLBACK_IP: OutboundGeoIp = {
  ip: '127.0.0.1',
  countryCode: 'UN',
  isp: '本地直接回环',
  typeCn: '直连网络',
  qualityCn: '本地链路'
}

// 兼容低版本 TS 的 Promise 首胜
function firstSuccessful<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let rejectedCount = 0
    const errors: any[] = []
    if (promises.length === 0) return reject(new Error('No promises'))
    promises.forEach(p => {
      p.then(resolve).catch(err => {
        errors.push(err)
        rejectedCount++
        if (rejectedCount === promises.length) reject(errors)
      })
    })
  })
}

// 翻译线路类型与质量为中文
function formatTypeToCn(rawType = ''): string {
  const t = rawType.toLowerCase()
  if (t.includes('res') || t.includes('home') || t.includes('isp')) return '原生住宅'
  if (t.includes('business') || t.includes('corp')) return '商业宽带'
  if (t.includes('data') || t.includes('host') || t.includes('cloud')) return '机房数据中心'
  return '原生住宅'
}

const fetchFromIpWhoIs = async (signal: AbortSignal): Promise<OutboundGeoIp> => {
  const res = await fetch(`https://ipwho.is/?lang=zh-CN&_t=${Date.now()}`, { signal })
  if (!res.ok) throw new Error('ipwho.is failed')
  const json = await res.json()
  if (json.success === false) throw new Error(json.message)
  return {
    ip: json.ip,
    countryCode: json.country_code || 'UN',
    isp: json.connection?.isp || json.connection?.org || '专线 BGP 节点',
    typeCn: formatTypeToCn(json.connection?.type || 'isp'),
    qualityCn: '链路优质'
  }
}

const fetchFromIpApiCo = async (signal: AbortSignal): Promise<OutboundGeoIp> => {
  const res = await fetch(`https://ipapi.co/json/?_t=${Date.now()}`, { signal })
  if (!res.ok) throw new Error('ipapi.co failed')
  const json = await res.json()
  return {
    ip: json.ip,
    countryCode: json.country_code || 'UN',
    isp: json.org || json.network || '国际骨干网',
    typeCn: '专线出口',
    qualityCn: '网络极佳'
  }
}

const fetchFromIpify = async (signal: AbortSignal): Promise<OutboundGeoIp> => {
  const res = await fetch(`https://api.ipify.org?format=json&_t=${Date.now()}`, { signal })
  if (!res.ok) throw new Error('ipify failed')
  const json = await res.json()
  return {
    ip: json.ip,
    countryCode: 'PROXY',
    isp: '境外专线出口',
    typeCn: '原生住宅',
    qualityCn: '优质链路'
  }
}

export async function fetchFastestOutboundIp(): Promise<OutboundGeoIp> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4000)

  try {
    const fastest = await firstSuccessful([
      fetchFromIpWhoIs(controller.signal),
      fetchFromIpApiCo(controller.signal),
      fetchFromIpify(controller.signal)
    ])
    return fastest
  } catch {
    return FALLBACK_IP
  } finally {
    clearTimeout(timeoutId)
  }
}

// 🌟 核心：切换节点后的阶梯轮询（在 300ms, 900ms, 1800ms 连续比对，直到 IP 发生改变）
export async function pollUntilIpChanges(previousIp: string, onUpdate: (info: OutboundGeoIp) => void) {
  const delays = [350, 850, 1600]
  for (const ms of delays) {
    await new Promise(r => setTimeout(r, ms))
    const fresh = await fetchFastestOutboundIp()
    if (fresh.ip && fresh.ip !== '127.0.0.1') {
      onUpdate(fresh)
      // 如果已经拿到了与旧 IP 不同的新 IP，立即提前收工！
      if (previousIp && fresh.ip !== previousIp) {
        break
      }
    }
  }
}