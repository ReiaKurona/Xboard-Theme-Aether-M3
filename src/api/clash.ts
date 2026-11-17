import { reiaApi } from './reia'

// Keep the existing component contract, route managed writes to the Agent.
class ClashApiManager {
  get endpoint() { return reiaApi.coreBase }
  get secret() { return reiaApi.secret }
  private async read<T = any>(path: string) { return { data: await reiaApi.core<T>(path) } }
  private async agent(path: string, body?: unknown, method = 'POST') { return { data: await reiaApi.agent(path, method, body) } }
  fetchClashVersion() { return this.read<{ version: string }>('/version') }
  fetchProxiesAPI() { return reiaApi.agent('/api/core/proxies').then(data => ({ data })) }
  selectProxyAPI(group: string, node: string) { return this.agent('/api/core/select', { group, node }) }
  fetchProxyLatencyAPI(name: string, url = 'http://www.gstatic.com/generate_204', timeout = 5000) {
    return this.read<{ delay: number }>(`/proxies/${encodeURIComponent(name)}/delay?` + new URLSearchParams({ url, timeout: String(timeout) }))
  }
  fetchProxyGroupLatencyAPI(group: string) { return this.agent('/api/core/group-delay', { group }) }
  getConfigsAPI() { return this.read('/configs') }
  patchConfigsAPI(config: Record<string, any>) {
    const patch: Record<string, any> = {}
    if (config.mode !== undefined) patch.outbound_mode = config.mode
    if (config['allow-lan'] !== undefined) patch.allow_lan = config['allow-lan']
    return this.agent('/api/agent/settings', patch)
  }
  fetchRulesAPI() { return this.read('/rules') }
  fetchRuleProvidersAPI() { return this.read('/providers/rules') }
  fetchConnectionsAPI() { return this.agent('/api/core/connections', undefined, 'GET') }
  disconnectClashByIdAPI(id: string) { return this.agent('/api/core/connections/' + encodeURIComponent(id), undefined, 'DELETE') }
  disconnectAllClashAPI() { return this.agent('/api/core/connections', undefined, 'DELETE') }
  createClashWebSocket<T>(path: string, params?: Record<string, string>) { return reiaApi.socket('/' + path, params) }
  async getProxyDelay(name: string, url?: string, timeout?: number) { return (await this.fetchProxyLatencyAPI(name, url, timeout)).data }
  createMemoryWebSocket(onData: (data: { inuse: number; oslimit?: number }) => void) {
    const ws = reiaApi.socket('/memory'); ws.onmessage = event => { try { onData(JSON.parse(event.data)) } catch {} }; return ws
  }
  restartCoreAPI() { return this.agent('/api/core/restart') }
  reloadConfigsAPI() { return this.restartCoreAPI() }
  upgradeCoreAPI() { return this.agent('/api/agent/upgrade', { is_silent: false }) }
  flushFakeIPAPI() { return reiaApi.core('/cache/fakeip/flush', 'POST').then(data => ({ data })) }
  flushDNSCacheAPI() { return reiaApi.core('/cache/dns/flush', 'POST').then(data => ({ data })) }
  queryDNSAPI(name: string, type = 'A') { return this.agent('/api/core/dns/query?' + new URLSearchParams({ name, type }), undefined, 'GET') }
}
export const clashApi = new ClashApiManager()
