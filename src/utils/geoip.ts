export interface OutboundGeoIp {
  ip: string
  ipv6?: string
  countryCode: string
  colo: string
}

interface IpResponse {
  ip?: string
  ipv6?: string
  country_code?: string
  colo?: string
  error?: boolean
}

export function parseOutboundIp(data: IpResponse): OutboundGeoIp {
  const ip = data?.ip?.trim()
  if (data?.error || !ip || !isPublicAddress(ip)) throw new Error('未取得公网出口 IP')
  const countryCode = data.country_code?.toUpperCase() || ''
  const colo = data.colo?.toUpperCase() || ''
  const info: OutboundGeoIp = { ip, countryCode: /^[A-Z]{2}$/.test(countryCode) && countryCode !== 'XX' ? countryCode : '', colo: /^[A-Z]{3}$/.test(colo) ? colo : '' }
  if (typeof data.ipv6 === 'string') {
    const ipv6 = data.ipv6.trim()
    info.ipv6 = ipv6.includes(':') && isPublicAddress(ipv6) ? ipv6 : ''
  }
  return info
}

export function parseCloudflareTrace(trace: string): OutboundGeoIp {
  const fields = new Map(trace.split(/\r?\n/).map(line => {
    const equals = line.indexOf('=')
    return equals < 0 ? ['', ''] : [line.slice(0, equals), line.slice(equals + 1).trim()]
  }))
  return parseOutboundIp({ ip: fields.get('ip'), country_code: fields.get('loc'), colo: fields.get('colo') })
}

function isPublicAddress(ip: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const octets = ip.split('.').map(Number)
    const [a = 0, b = 0] = octets
    return octets.every(value => value <= 255) && a > 0 && a < 224 && a !== 10 && a !== 127 &&
      !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) &&
      !(a === 192 && b === 168) && !(a === 100 && b >= 64 && b <= 127)
  }
  if (!/^[23][a-f\d]{0,3}:/i.test(ip) || !/^[a-f\d:]+$/i.test(ip)) return false
  try { return new URL(`http://[${ip}]/`).hostname.length > 0 } catch { return false }
}

// Older Agent versions leave the lookup to the current browser connection.
export async function fetchOutboundIpFromBrowser(signal: AbortSignal): Promise<OutboundGeoIp> {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) cancel()
  const timeout = setTimeout(cancel, 4500)
  try {
    const response = await fetch('https://1.1.1.1/cdn-cgi/trace', {
      signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
    })
    if (!response.ok) throw new Error('公网 IP 查询失败')
    return parseCloudflareTrace(await response.text())
  } finally {
    cancel()
    clearTimeout(timeout)
    signal.removeEventListener('abort', cancel)
  }
}
