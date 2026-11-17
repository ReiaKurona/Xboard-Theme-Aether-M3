# ReiaClash 客户端接入

首页控制台现在通过本机 ReiaClash Agent（127.0.0.1:25500）识别客户端，不再探测任意 Clash 控制器。未启动时隐藏客户端卡片，启动后自动显示；暂停代理、内核尚未就绪时仍可管理。浏览器需要本地网络授权时，可点击首页“连接本机客户端”。

原套餐订阅卡和多客户端导入卡保持原文件不变。购买、工单、下载、邀请、其他客户端 Scheme/二维码/复制订阅等业务未修改。已有首页自定义布局只补入 ReiaClash 控制台，不重置其他卡片。

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

Windows 的 npm.ps1 被执行策略拦截时使用 npm.cmd。Chrome 可通过 CHROME_PATH 指定；受限测试宿主可临时设置 CHROME_TEST_NO_SANDBOX=1。浏览器测试只使用模拟 XBoard、Agent、内核和 WebSocket，临时 HTTP 服务仅绑定 loopback，结束后关闭。外部图标字体被测试 CSP 阻止，截图不代表生产字体效果。

`npm run pack` 生成 MD3-Theme.zip，可上传到 XBoard 主题管理；打包会移除 dist/assets/index.html，再次浏览器检查前先 build。请同时升级支持 subscription_refresh 的 ReiaClash 四组件。当前完成本地类型/构建/模拟 DOM 与协议回归，未发布生产站点，真实订阅输出和系统权限仍需部署验证。
