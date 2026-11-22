export interface ReiaSettings {
  enabled: boolean; use_system_proxy: boolean; use_tun: boolean; tun_stack: string; tun_device?: string;
  allow_lan: boolean; geo_low_memory: boolean; autostart_enabled: boolean;
  auto_update_enabled: boolean; update_interval_hours: number; outbound_mode: 'rule' | 'global' | 'direct';
}
export type CoreKind = "mihomo" | "meow-rs";
export interface ReiaStatus {
  core_kind?: CoreKind;
  settings: ReiaSettings; mihomo_running: boolean; real_system_proxy: boolean; real_tun: boolean;
  is_actually_intercepting: boolean; last_error?: string; real_tun_device?: string;
  actual_mode?: string;
}
export interface ReiaSystemStatus {
  silent_proxy_on_login?: boolean;
  autostart_enabled: boolean;
  core_service_supported: boolean;
  core_service_ready: boolean;
  core_service_delegated?: boolean;
  core_service_error?: string;
  core_service_registration?: { installed: boolean; running?: boolean; error?: string };
}
export interface SubscriptionStatus {
  successful_attempt?: number;
  auto_sync_paused?: boolean;
  has_url: boolean; refreshing: boolean; last_success_at: number; last_attempt_at: number;
  next_refresh_at: number; refresh_interval_hours: number; last_error?: string;
}
export class ReiaError extends Error {
  constructor(message: string, public code = 'request_failed', public uncertain = false) { super(message) }
}

// Separate from XBoard axios: no site authentication on loopback requests.
export class ReiaApi {
  readonly agentBase = 'http://127.0.0.1:25500';
  readonly coreBase = 'http://127.0.0.1:9090';
  secret = '';
  agentPID = 0;
  private pairedURL = '';
  private session: { features?: string[] } | undefined;
  coreBusy = false;
  private pendingWrite = false;
  private generation = 0;
  constructor(private fetchImpl: typeof fetch = (...args) => fetch(...args)) {}
  private async request<T = any>(base: string, path: string, method = 'GET', body?: unknown,
    options: { signal?: AbortSignal; timeout?: number; core?: boolean; handshake?: boolean } = {}): Promise<T> {
    const target = new URL(path, base);
    if (!path.startsWith('/') || target.origin !== base) throw new ReiaError('无效的本机接口路径');
    const write = method !== 'GET' && !options.handshake;
    if (write && this.pendingWrite) throw new ReiaError('上一项客户端操作尚未完成', 'operation_in_progress');
    if (write) this.pendingWrite = true;
    const abort = new AbortController();
    const cancel = () => abort.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const timer = setTimeout(cancel, options.timeout ?? (write ? 300000 : 10000));
    let sent = false;
    try {
      if (abort.signal.aborted) throw new ReiaError('操作已取消', 'aborted');
      const headers: Record<string, string> = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (options.core) {
        if (!this.secret) throw new ReiaError('ReiaClash 尚未连接', 'not_connected');
        headers.Authorization = `Bearer ${this.secret}`;
      }
      sent = true;
      const response = await this.fetchImpl(target.href, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: abort.signal,
        credentials: 'omit', mode: 'cors', cache: 'no-store', redirect: 'error', ...({ targetAddressSpace: 'loopback' } as any),
      });
      const text = await response.text();
      let data: any;
      try { data = text ? JSON.parse(text) : null } catch { throw new ReiaError('本机接口返回格式无效', 'invalid_response', write) }
      if (!response.ok || data?.success === false) throw new ReiaError(data?.message || `操作失败 (${response.status})`, data?.code || 'http_error');
      return data as T;
    } catch (error) {
      if (error instanceof ReiaError) throw error;
      throw new ReiaError(abort.signal.aborted ? '请求超时或已取消，请先查询实际状态' : '无法连接 ReiaClash，请检查客户端与浏览器本地网络权限',
        abort.signal.aborted ? 'aborted' : 'network_error', write && sent);
    } finally {
      clearTimeout(timer); options.signal?.removeEventListener('abort', cancel);
      if (write) this.pendingWrite = false;
    }
  }
  agent<T = any>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal) { return this.request<T>(this.agentBase, path, method, body, { signal }); }
  core<T = any>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal) { return this.request<T>(this.coreBase, path, method, body, { core: true, signal }); }
  async connect(signal?: AbortSignal) {
    const generation = ++this.generation;
    try {
      const health = await this.request(this.agentBase, '/api/health', 'GET', undefined, { signal, timeout: 5000 });
      if (health?.status !== 'ok' || typeof health.agent_version !== 'string' || !Number.isInteger(health.agent_pid)) throw new ReiaError('本机接口不是 ReiaClash', 'invalid_agent');
      const page = new URL(window.location.href);
      this.coreBusy = health.core_busy === true;
      if (generation !== this.generation || signal?.aborted) throw new ReiaError('连接已取消', 'aborted');
      if (this.session && this.agentPID === health.agent_pid && this.pairedURL === page.href) return this.session;
      const session = await this.request(this.agentBase, '/api/handshake', 'POST', { panel_origin: page.origin, panel_url: page.href }, { signal, timeout: 5000, handshake: true });
      if (!session?.mihomo_controller?.secret || session.mihomo_controller.api_base !== this.coreBase) throw new ReiaError('ReiaClash 握手无效', 'invalid_handshake');
      if (generation !== this.generation || signal?.aborted) throw new ReiaError('连接已取消', 'aborted');
      this.secret = session.mihomo_controller.secret; this.agentPID = health.agent_pid;
      this.pairedURL = page.href; this.session = session;
      return session;
    } catch (error) {
      throw error;
    }
  }
  disconnect() { ++this.generation; this.secret = ''; this.agentPID = 0; this.pairedURL = ''; this.session = undefined; this.coreBusy = false }
  socket(path: string, params: Record<string, string> = {}) {
    if (!this.secret) throw new ReiaError('ReiaClash 尚未连接', 'not_connected');
    const url = new URL(path, this.coreBase);
    if (!path.startsWith('/') || url.origin !== this.coreBase) throw new ReiaError('无效的实时接口');
    url.protocol = 'ws:'; url.search = new URLSearchParams({ ...params, token: this.secret }).toString();
    try {
      const LoopbackWebSocket = WebSocket as unknown as new (url: string, options: { targetAddressSpace: string }) => WebSocket;
      return new LoopbackWebSocket(url.href, { targetAddressSpace: 'loopback' });
    } catch {
      return new WebSocket(url.href);
    }
  }
}
export const reiaApi = new ReiaApi();
