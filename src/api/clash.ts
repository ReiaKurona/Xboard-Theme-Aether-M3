import axios from 'axios'

// 🌟 1:1 原装移植 Zashboard 官方 API 接口
class ClashApiManager {
  public endpoint = 'http://127.0.0.1:9090'
  public secret = ''

  private client = axios.create({
    baseURL: 'http://127.0.0.1:9090',
    timeout: 8000
  })

  constructor() {
    this.initInterceptors()
  }

  public configure(endpoint?: string, secret?: string) {
    if (endpoint) this.endpoint = endpoint.replace(/\/+$/, '')
    if (secret !== undefined) this.secret = secret
    this.client.defaults.baseURL = this.endpoint
  }

  private initInterceptors() {
    this.client.interceptors.request.use((config) => {
      if (this.secret) {
        config.headers.Authorization = `Bearer ${this.secret}`
      }
      return config
    })
  }

  // 1. 版本与握手
  public fetchClashVersion() {
    return this.client.get<{ version: string }>('/version')
  }

  // 2. 节点与代理组 (Zashboard 规范)
  public fetchProxiesAPI() {
    return this.client.get<{ proxies: Record<string, any> }>('/proxies')
  }

  // 🌟 核心：精准对应截图中的 PUT /proxies/{groupName}，支持 204 返回
  public selectProxyAPI(proxyGroup: string, name: string) {
    return this.client.put(`/proxies/${encodeURIComponent(proxyGroup)}`, { name })
  }

  public fetchProxyLatencyAPI(proxyName: string, url = 'http://www.gstatic.com/generate_204', timeout = 5000) {
    return this.client.get<{ delay: number }>(`/proxies/${encodeURIComponent(proxyName)}/delay`, {
      params: { url, timeout }
    })
  }

  public fetchProxyGroupLatencyAPI(proxyName: string, url = 'http://www.gstatic.com/generate_204', timeout = 5000) {
    return this.client.get<Record<string, number>>(`/group/${encodeURIComponent(proxyName)}/delay`, {
      params: { url, timeout }
    })
  }

  // 3. 核心配置与模式切换
  public getConfigsAPI() {
    return this.client.get<any>('/configs')
  }

  public patchConfigsAPI(configs: Record<string, any>) {
    return this.client.patch('/configs', configs)
  }

  // 4. 连接与规则
  public fetchRulesAPI() {
    return this.client.get<any>('/rules')
  }

    // 🌟 新增：解决 RulesView 中找不到 fetchRuleProvidersAPI 的报错
  public fetchRuleProvidersAPI() {
    return this.client.get<any>('/providers/rules')
  }

  public fetchConnectionsAPI() {
    return this.client.get<any>('/connections')
  }

  public disconnectClashByIdAPI(id: string) {
    return this.client.delete(`/connections/${id}`)
  }

  public disconnectAllClashAPI() {
    return this.client.delete('/connections')
  }

  // 5. 实时 WebSocket 流 (吞吐 / 日志)
  public createClashWebSocket<T>(url: string, searchParams?: Record<string, string>) {
    const wsUrl = new URL(`${this.endpoint.replace(/^http/, 'ws')}/${url}`)
    if (this.secret) wsUrl.searchParams.append('token', this.secret)
    if (searchParams) {
      Object.entries(searchParams).forEach(([k, v]) => wsUrl.searchParams.append(k, v))
    }

    const ws = new WebSocket(wsUrl.toString())
    return ws
  }

  // 别名方法，解决 ProxiesView 调用的 TS 报错
  public async getProxyDelay(proxyName: string, url = 'http://www.gstatic.com/generate_204', timeout = 5000) {
    const res = await this.fetchProxyLatencyAPI(proxyName, url, timeout)
    return res.data
  }

  // 获取内存占用流 (对应 Zashboard metrics.memory)
  public createMemoryWebSocket(onData: (data: { inuse: number; oslimit?: number }) => void): WebSocket {
    const wsUrl = new URL(`${this.endpoint.replace(/^http/, 'ws')}/memory`)
    if (this.secret) wsUrl.searchParams.append('token', this.secret)
    const ws = new WebSocket(wsUrl.toString())
    ws.onmessage = (e) => {
      try { onData(JSON.parse(e.data)) } catch {}
    }
    return ws
  }

  // 核心运维
  public restartCoreAPI() {
    return this.client.post('/restart')
  }

  public reloadConfigsAPI() {
    return this.client.put('/configs?reload=true', { path: '', payload: '' })
  }

  public upgradeCoreAPI() {
    return this.client.post('/upgrade')
  }

  public flushFakeIPAPI() {
    return this.client.post('/cache/fakeip/flush')
  }

  public flushDNSCacheAPI() {
    return this.client.post('/cache/dns/flush')
  }

  public queryDNSAPI(name: string, type = 'A') {
    return this.client.get('/dns/query', { params: { name, type } })
  }
}

export const clashApi = new ClashApiManager()