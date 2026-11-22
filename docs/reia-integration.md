# ReiaClash 客户端接入

首页控制台现在通过本机 ReiaClash Agent（127.0.0.1:25500）识别客户端，不再探测任意 Clash 控制器。未启动时隐藏客户端卡片，启动后自动显示；暂停代理、内核尚未就绪时仍可管理。浏览器需要本地网络授权时，可点击首页“连接本机客户端”。

套餐订阅和其他客户端导入保留原业务入口。首页只在 ReiaClash 控制卡提供代理总开关和出口 IP，出口使用 Cloudflare `1.1.1.1` Trace。已有首页布局继续使用，原套餐卡现在只展示套餐与订阅操作。

客户端设置、订阅、内核概览、节点、规则、连接和日志统一使用主题色板与 Material Web 控件。连接支持活动与会话内历史、速率排序、详情和断开。日志支持自动重连、级别与正则搜索、暂停显示和复制筛选结果。图标优先使用 `custom_icon_url`。CSS 外链直接加载，WOFF2 走浏览器缓存与匿名沙盒。未配置、请求失败或超时后自动使用内置字体。

「客户端设置 → 内核维护」支持 mihomo / meow-rs 双向切换，以及检查更新、手动更新和静默更新。请求交给 Agent，完成后更新 Vue 状态。健康轮询读取 `core_busy` 同步客户端操作锁，连续三次探测失败才清理连接状态。主题默认 favicon、登录和控制台的默认站点 Logo 使用 ReiaClash 图标。

## 订阅

检测到客户端后，登录用户的 subscribe_url 自动发送给 Agent，之后页面运行期间每 4 小时重新从 XBoard 取链接并发送。链接变化立即同步；账号变化时丢弃旧的未完成响应。后台页面被浏览器休眠后，恢复可见会检查是否到期。

客户端保存最新 URL，覆盖旧 URL；启动时与每 12 小时自行刷新，不依赖网页。下载/校验失败保留可用配置，继续用新 URL 重试。代理/TUN 总开关不会因自动同步被开启，系统服务安装仍由用户操作触发。

状态&设置菜单及首页控制台提供“手动安装订阅”页，实际路由 `/clash/subscription`，地址栏仍混淆。可安装自定义链接或刷新已保存订阅。原其他客户端订阅入口保留。

## 协议与安全边界

- `GET /api/health` 检查 Agent 身份，再 `POST /api/handshake` 上报当前完整页面 URL。
- 总开关、模式/节点、服务、自启、Geo、维护走 Agent；控制器只负责原生查询和实时流。
- `POST /api/subscription/url` 推送 URL；`GET /api/subscription/status` 查询不含凭证的刷新状态；`POST /api/subscription/refresh` 刷新当前链接。
- 站点登录凭证只发给 XBoard，控制器密钥只保存在页面内存，不写 localStorage；loopback 使用独立 fetch，不经过站点 API 混淆与认证拦截器。
- 页面卸载会停止发现/推送计时器及流，不停止客户端服务。超时写操作不自动重放；订阅自动同步有独立的重试策略。
- HTTPS 站点访问本机仍受浏览器本地网络权限和站点 CSP 限制，生产部署需实测；旧 clash_api_endpoint/clash_api_secret 不再决定本机控制目标。

## 构建与检查

```text
node --test scripts/reia.test.mjs
npm run build
node scripts/reia-browser-test.mjs
npm run pack
```

Windows 的 npm.ps1 被执行策略拦截时使用 npm.cmd。Chrome 可通过 CHROME_PATH 指定。受限测试宿主可临时设置 CHROME_TEST_NO_SANDBOX=1。浏览器测试使用模拟 XBoard、Agent、内核和 WebSocket，在桌面浅色与移动暗色下检查状态同步和本地图标。

`npm run pack` 生成 MD3-Theme.zip，可上传到 XBoard 主题管理。打包会移除 dist/assets/index.html，再次浏览器检查前先 build。使用握手声明 `outbound_ip_trace` 的新版 Agent，可从当前内核出站探测。旧 Agent 使用浏览器查询 Trace。真实订阅输出、系统权限与站点 CSP 仍需部署验证。
