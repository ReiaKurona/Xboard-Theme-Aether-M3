export interface ClashConnection {
  id: string
  metadata?: { host?: string; sniffHost?: string; destinationIP?: string; destinationPort?: string; sourceIP?: string; sourcePort?: string; network?: string; type?: string; process?: string; processPath?: string }
  upload: number
  download: number
  start: string
  chains?: string[]
  rule?: string
  rulePayload?: string
}

export interface ConnectionSample extends ClashConnection {
  sampledAt: number
  closedAt?: number
  upRate: number
  downRate: number
}

export function collectConnections(previous: Map<string, ConnectionSample>, incoming: readonly ClashConnection[], now: number) {
  const live = new Map<string, ConnectionSample>()
  for (const row of incoming) {
    if (!row?.id) continue
    const prior = previous.get(row.id)
    const seconds = prior ? (now - prior.sampledAt) / 1000 : 0
    live.set(row.id, { ...row, sampledAt: now,
      upRate: prior && seconds > 0 ? Math.max(0, row.upload - prior.upload) / seconds : 0,
      downRate: prior && seconds > 0 ? Math.max(0, row.download - prior.download) / seconds : 0,
    })
  }
  const closed = [...previous.values()].filter(row => !live.has(row.id)).map(row => ({ ...row, closedAt: now, upRate: 0, downRate: 0 }))
  return { live, closed }
}

export function formatEndpoint(host?: string, port?: string) {
  if (!host) return '—'
  if (!port) return host
  return (host.includes(':') ? `[${host}]` : host) + ':' + port
}

export function formatConnectionRule(row: ClashConnection) {
  return [row.rule, row.rulePayload].filter(Boolean).join(' · ') || '—'
}
