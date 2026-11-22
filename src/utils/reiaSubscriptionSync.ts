export const WEB_SUBSCRIPTION_INTERVAL = 4 * 60 * 60 * 1000

export class ReiaSubscriptionSync {
  private busy = false
  private generation = 0
  private owner = ''
  private lastSuccess = 0
  private retryAt = 0
  private lastURL = ''
  private pendingForce = false
  constructor(private options: {
    connected: () => boolean; auth: () => string; loadURL: () => Promise<string>;
    push: (url: string) => Promise<unknown>; error: (message: string) => void; now?: () => number;
  }) {}
  reset() { ++this.generation; this.owner = ''; this.lastSuccess = 0; this.retryAt = 0; this.lastURL = ''; this.pendingForce = false }
  async tick(force = false) {
    const now = (this.options.now || Date.now)()
    const owner = this.options.auth()
    if (!owner || !this.options.connected()) return
    if (this.busy) { this.pendingForce ||= force; return }
    if (!force && owner === this.owner && (this.retryAt > 0 ? now < this.retryAt : this.lastSuccess > 0 && now - this.lastSuccess < WEB_SUBSCRIPTION_INTERVAL)) return
    const generation = this.generation
    this.busy = true
    try {
      const url = await this.options.loadURL()
      if (generation !== this.generation || owner !== this.options.auth() || !this.options.connected()) return
      if (!url) { this.owner = owner; this.retryAt = now + 60000; return }
      if (force && owner === this.owner && url === this.lastURL && this.retryAt === 0 && now - this.lastSuccess < WEB_SUBSCRIPTION_INTERVAL) return
      await this.options.push(url)
      if (generation !== this.generation || owner !== this.options.auth()) return
      this.owner = owner; this.lastURL = url; this.lastSuccess = (this.options.now || Date.now)(); this.retryAt = 0
      this.options.error('')
    } catch {
      if (generation !== this.generation || owner !== this.options.auth()) return
      this.owner = owner; this.retryAt = (this.options.now || Date.now)() + 60000
      this.options.error('订阅同步暂未完成，稍后自动重试，也可手动安装订阅')
    } finally {
      this.busy = false
      if (this.pendingForce) { this.pendingForce = false; void this.tick(true) }
    }
  }
}


export function subscriptionAdvanced(before: { last_success_at: number; successful_attempt?: number } | null,
  after: { last_success_at: number; successful_attempt?: number; last_error?: string; refreshing: boolean } | null) {
  return !!before && !!after?.last_success_at && !after.refreshing && !after.last_error &&
    ((after.successful_attempt ?? 0) > (before.successful_attempt ?? 0) ||
      after.last_success_at > before.last_success_at)
}
