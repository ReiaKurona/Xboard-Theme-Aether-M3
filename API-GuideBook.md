# 📘 Xboard 客户端 API 权威开发全景手册 (V1)

> 本文档基于 `cedar2025/Xboard` 官方核心源码（控制器、路由中间件、数据资源层与模型关系）整理。
> 面向所有自制前端主题、客户端与移动端应用的开发者，提供目前社区最详尽、精准且包含全部边缘异常处理的官方接口级指南。

---

## 目录
- [0. 核心架构认知与避坑必读](#0-核心架构认知与避坑必读)
- [1. 规范约定与通信基础](#1-规范约定与通信基础)
  - [1.1 基础信息](#11-基础信息)
  - [1.2 Sanctum 鉴权与生命周期](#12-sanctum-鉴权与生命周期)
  - [1.3 统一响应模型与错误处理](#13-统一响应模型与错误处理)
  - [1.4 不走标准包装的特殊接口清单](#14-不走标准包装的特殊接口清单)
  - [1.5 核心枚举与度量衡单位换算](#15-核心枚举与度量衡单位换算)
  - [1.6. 主题如何挂载](#16-主题如何挂载)
- [2. Passport 认证模块 (无需登录)](#2-passport-认证模块-无需登录)
  - [2.1 获取站点公开配置](#21-获取站点公开配置)
  - [2.2 验证码机制与动态参数](#22-验证码机制与动态参数)
  - [2.3 邮箱与密码注册](#23-邮箱与密码注册)
  - [2.4 密码登录](#24-密码登录)
  - [2.5 发送邮箱验证码](#25-发送邮箱验证码)
  - [2.6 忘记密码重置](#26-忘记密码重置)
  - [2.7 邮件免密魔术链接登录](#27-邮件免密魔术链接登录)
  - [2.8 快捷免密登录 URL](#28-快捷免密登录-url)
  - [2.9 邀请码 PV 访问统计](#29-邀请码-pv-访问统计)
- [3. 用户核心与账户管理 (需登录)](#3-用户核心与账户管理-需登录)
  - [3.1 登录态核验](#31-登录态核验)
  - [3.2 用户基础信息](#32-用户基础信息)
  - [3.3 订阅详情与客户端通用链接](#33-订阅详情与客户端通用链接)
  - [3.4 用户统计角标](#34-用户统计角标)
  - [3.5 提醒配置修改](#35-提醒配置修改)
  - [3.6 修改安全密码](#36-修改安全密码)
  - [3.7 重置订阅与密钥防泄露](#37-重置订阅与密钥防泄露)
  - [3.8 佣金划转至账户主余额](#38-佣金划转至账户主余额)
  - [3.9 活跃会话管理与远程设备下线](#39-活跃会话管理与远程设备下线)
  - [3.10 登录后站点配置](#310-登录后站点配置)
  - [3.11 Telegram 机器人联动与绑定](#311-telegram-机器人联动与绑定)
- [4. 套餐、订单与支付系统](#4-套餐订单与支付系统)
  - [4.1 获取可用套餐列表](#41-获取可用套餐列表)
  - [4.2 优惠折扣券核验](#42-优惠折扣券核验)
  - [4.3 创建购买订单](#43-创建购买订单)
  - [4.4 支付网关查询与手续费运算](#44-支付网关查询与手续费运算)
  - [4.5 发起订单结算 (多态支付通道)](#45-发起订单结算-多态支付通道)
  - [4.6 轮询订单支付状态](#46-轮询订单支付状态)
  - [4.7 订单列表与明细详情](#47-订单列表与明细详情)
  - [4.8 取消待支付订单](#48-取消待支付订单)
- [5. 节点、流量与系统广播](#5-节点流量与系统广播)
  - [5.1 节点集群列表 (支持 ETag)](#51-节点集群列表-支持-etag)
  - [5.2 周期流量历史记录](#52-周期流量历史记录)
  - [5.3 官方公告列表](#53-官方公告列表)
  - [5.4 知识库与使用教程](#54-知识库与使用教程)
- [6. 客服工单与财务提现](#6-客服工单与财务提现)
  - [6.1 我的工单列表](#61-我的工单列表)
  - [6.2 工单对话消息流 (含 500 防御)](#62-工单对话消息流-含-500-防御)
  - [6.3 创建新工单](#63-创建新工单)
  - [6.4 回复工单消息](#64-回复工单消息)
  - [6.5 关闭工单](#65-关闭工单)
  - [6.6 申请佣金财务提现](#66-申请佣金财务提现)
- [7. 推广邀请与返利系统](#7-推广邀请与返利系统)
  - [7.1 邀请数据看板与未用码列表](#71-邀请数据看板与未用码列表)
  - [7.2 生成专属新邀请码](#72-生成专属新邀请码)
  - [7.3 佣金返利明细账单 (分页)](#73-佣金返利明细账单-分页)
- [8. 礼品卡充值与兑换](#8-礼品卡充值与兑换)
  - [8.1 礼品卡类型映射](#81-礼品卡类型映射)
  - [8.2 兑换前权益预检与可用性校验](#82-兑换前权益预检与可用性校验)
  - [8.3 提交核销兑换](#83-提交核销兑换)
  - [8.4 个人兑换历史账目](#84-个人兑换历史账目)
  - [8.5 单条兑换卡模板详情](#85-单条兑换卡模板详情)
- [9. 前端网络请求层最佳实践 (TypeScript 完整封装)](#9-前端网络请求层最佳实践-typescript-完整封装)
- [10. 项目特色扩展与延伸生态 API 指南](#10-项目特色扩展与延伸生态-API-指南).
  - [10.1 Komari 基础设施遥测系统 (只读免密模式)](#101-Komari-基础设施遥测系统 (只读免密模式)).
    - [10.1.1 批量获取母机节点元数据 (`common:getNodes`)](#1011-批量获取母机节点元数据 (`common:getNodes`)).
    - [10.1.2 批量获取母机最新运行状态 (`common:getNodesLatestStatus`)](#1012-批量获取母机最新运行状态 (`common:getNodesLatestStatus`)).
    - [10.1.3 母机近况深度遥测时序快照 (`/api/recent/{uuid}`)](#1013-母机近况深度遥测时序快照 (`/api/recent/{uuid}`)).
  - [10.2 E2EE 零知识加密虚拟流媒体下载中心](#102-E2EE-零知识加密虚拟流媒体下载中心).
    - [10.2.1 派发下载中心身份令牌 (`POST /api/login`)](#1021-派发下载中心身份令牌 (`POST /api/login`)).
    - [10.2.2 目录与资源列表拉取 (`GET /api/admin/resources`)](#1022-目录与资源列表拉取 (`GET /api/admin/resources`)).
    - [10.2.3 提取下载授权凭证与解密元数据 (`GET /api/resources/{id}/download`)](#1023-提取下载授权凭证与解密元数据 (`GET /api/resources/{id}/download`)).
    - [10.2.4 弹幕数据接口与 WebSocket 实时广播协议](#1024-弹幕数据接口与-WebSocket-实时广播协议).
    - [10.2.5 Service Worker 虚拟切片流控协议 (`public/sw.js`)](#1025-Service-Worker-虚拟切片流控协议 (`public/sw.js`)).
  - [10.3 活动业务注入引擎与 Token 穿透协议](#103-活动业务注入引擎与-Token-穿透协议).
  - [10.4 彩蛋](#104-彩蛋).


---

## 0. 核心架构认知与避坑必读

在编写前端代码前，必须知悉 Xboard 源码实现中的数个关键事实：

1. **废弃路由警示**：`GET /api/v1/user/knowledge/getCategory` 在源码的控制器中未实现对应方法，调用会触发致命 HTTP 500。分类信息请直接从 `GET /api/v1/user/knowledge/fetch` 返回结果中提取（返回值本身已按分类名称分组）。
2. **无需主题前端调用的内部端点**：
   - `guest/payment/notify/*`（第三方支付网关异步回调通道）；
   - `guest/telegram/webhook`（Telegram Bot 官方长轮询/WebHook 回调）；
   - `client/subscribe`、`client/app/*`（专供 Clash/Sing-box 等代理客户端拉取订阅配置，网页端仅需展示由 `user/getSubscribe` 下发的 `subscribe_url` 即可）。
3. **响应格式并不统一**：Xboard 共有 5 个接口不走标准响应包裹（见 [1.4 节](#14-不走标准包装的特殊接口清单)），拦截器必须进行针对性提取。
4. **前端路由推荐使用 Hash 模式**：Xboard 邮件登录与快捷免密登录默认生成的 302 重定向均为 `/#/login?verify=...`，使用 Hash 路由（`createWebHashHistory`）可最大化保证兼容性。

---

## 1. 规范约定与通信基础

### 1.1 基础信息

| 约定项 | 规则 / 参数值 |
| :--- | :--- |
| **API 基地址 (Base URL)** | `{当前站点域名}/api/v1` |
| **跨域支持 (CORS)** | Xboard 核心内置 `config/cors.php`，全域放行 `api/*`，支持前后端分离独立部署调试 |
| **强制 JSON 声明** | 核心中间件 `ForceJson` 默认会将所有进站请求头的 `Accept` 篡改为 `application/json` |
| **国际化语言头** | 传入请求头 `Content-Language: zh-CN`（支持 `en-US`、`ja-JP`、`vi-VN`、`zh-TW`），后端将根据此头返回本地化错误提示 |
| **请求载荷格式** | 支持标准 `application/json` 或 `application/x-www-form-urlencoded` |

### 1.2 Sanctum 鉴权与生命周期

- 用户登录或注册成功后，接口返回形如：
  ```json
  {
    "token": "d982b6c0...", // 订阅专用 Token (用于拼装订阅地址，非登录凭证)
    "auth_data": "Bearer 15|Wth41OXkNtpFuA2y537E...", // 真正的 Sanctum 登录授权令牌
    "is_admin": false
  }
  ```
- **请求鉴权**：除免密游客接口外，所有 `/api/v1/user/*` 请求必须携带请求头：
  ```http
  Authorization: Bearer 15|Wth41OXkNtpFuA2y537E...
  ```
- **鉴权失败判定**：Token 无效或过期时，中间件将抛出 **HTTP 403 Forbidden**，返回 `{"status":"fail","message":"未登录或登陆已过期"}`。前端应统一监听 HTTP 403 错误并引导用户重定向至 `#/login`。
- **令牌生命周期**：Sanctum 令牌有效期通常为 1 年；但当用户调用 `changePassword` 修改密码后，**服务端会自动销毁该用户除当前发起会话外的全部活跃 Token**。

### 1.3 统一响应模型与错误处理

#### 标准业务响应格式
- **成功 (HTTP 200)**：
  ```json
  {
    "status": "success",
    "message": "success",
    "data": true, // 或业务实体对象、数组
    "error": null
  }
  ```
- **业务失败 (HTTP 400 ~ 500)**：
  HTTP 状态码取业务错误码的前三位（例如邮箱已存在错误码 `400201` $\rightarrow$ 映射为 HTTP 400）：
  ```json
  {
    "status": "fail",
    "message": "邮箱已存在于系统中",
    "data": null,
    "error": null
  }
  ```

#### Laravel 表单验证异常格式 (HTTP 422)
当请求参数未通过后端表单验证器（`$request->validate`）时，不会返回标准包装，而是直接抛出 Laravel 原生验证异常包：
```json
{
  "message": "密码至少需要 8 个字符 (and 1 more error)",
  "errors": {
    "password": ["密码至少需要 8 个字符"],
    "email": ["邮箱格式不合法"]
  }
}
```
*前端网络拦截器必须同时兼容业务 `fail` 与 HTTP 422 的 `errors` 提取。*

### 1.4 不走标准包装的特殊接口清单

以下 5 个端点不遵循 `status/message/data` 包装，前端处理时须原样读取：

| 接口端点 (Endpoint) | HTTP Method | 实际返回的数据结构 |
| :--- | :---: | :--- |
| `/user/notice/fetch` | `GET` | `{ "data": [ ... ], "total": 12 }` |
| `/user/server/fetch` | `GET` | `{ "data": [ ... ] }`（支持 ETag 304 缓存） |
| `/user/invite/details` | `GET` | `{ "data": [ ... ], "total": 5 }` |
| `/user/gift-card/history` | `GET` | `{ "data": [ ... ], "pagination": { "current_page": 1, ... } }` |
| `/user/order/checkout` | `POST` | `{ "type": 1, "data": "https://..." }` |

*注：`/passport/auth/token2Login` 成功时返回 `{ "data": { ... } }`，失败时直接返回 HTTP 400 `{ "message": "..." }`。*

### 1.5 核心枚举与度量衡单位换算

- **金额度量**：全系统涉及金额的字段，单位统一为 **分 (Cent)**（整数型）。展示时必须 `/ 100`。
- **流量度量**：
  - 套餐表中的 `transfer_enable` 单位为 **GB**；
  - 用户表与订阅详情中的 `transfer_enable`、`u`（上传）、`d`（下载）单位均为 **字节 (Bytes)**。已用流量 $= u + d$。
- **时间度量**：Unix 秒级时间戳（`expired_at` 为 `null` 代表长期有效）。
- **订购周期旧版键名 (Period Enum)**：
  `month_price`（月付）、`quarter_price`（季付）、`half_year_price`（半年付）、`year_price`（年付）、`two_year_price`（两年付）、`three_year_price`（三年付）、`onetime_price`（一次性购买）、`reset_price`（流量重置包）。
- **订单状态枚举 (`order.status`)**：
  `0`: 待支付、`1`: 开通中、`2`: 已取消、`3`: 已完成、`4`: 已折抵。
- **工单状态枚举 (`ticket.status`)**：
  `0`: 处理中 (开启)、`1`: 已关闭；`reply_status`: `0` 待客服回复，`1` 客服已回复；`level`: `0` 低、`1` 中、`2` 高 (加急/提现)。

### 1.6. 主题如何挂载

后端路由 `GET /` 渲染当前主题的 `dashboard.blade.php`，把站点配置注入为全局变量，你的前端从这里读取运行时配置。

**主题目录结构**：

```
MyTheme/
├── config.json            # 必须，含 name、version、configs（后台可配项）
├── dashboard.blade.php    # 必须，入口模板
└── assets/                # 你的构建产物（js/css/图片）
```

- 打包成 zip 上传（后台主题管理）。`config.json` 里 `name` 不能与系统主题 `Xboard`、`v2board` 同名；更新同名主题要求 `version` 更高。
- 上传后主题放在 `storage/theme/{name}`，首次访问时复制到 `public/theme/{name}`，资源路径为 `/theme/{name}/assets/...`。
- `config.json` 的 `configs` 数组定义后台可配置项（字段：`label`、`placeholder`、`field_name`、`field_type`、`select_options`、`default_value`），官方 Xboard 主题有 `theme_color`（select）、`background_url`（input）、`custom_html`（textarea）作为参考。

**`dashboard.blade.php` 注入的变量示例**（官方主题写法，你照搬即可）：

```html
<script>
  window.routerBase = "/";            // API 基础地址（请求 routerBase + 'api/v1/...'）
  window.settings = {
    title: '{{$title}}',               // 站点名
    description: '{{$description}}',
    assets_path: '/theme/{{$theme}}/assets',
    theme: { color: '{{ $theme_config["theme_color"] ?? "default" }}' },
    version: '{{$version}}',
    background_url: '{{$theme_config["background_url"]}}',
    logo: '{{$logo}}',
    i18n: ['zh-CN','en-US','ja-JP','vi-VN','ko-KR','zh-TW','fa-IR']
  }
</script>
<div id="app"></div>
{!! $theme_config['custom_html'] !!}
```

- Blade 可用变量：`$title`、`$theme`、`$version`、`$description`、`$logo`、`$theme_config`（你在 `config.json` 里定义的配置项取值）。
- 官方主题使用 hash 路由（`/#/login?verify=...&redirect=dashboard`），`token2Login` 的跳转也按这个格式拼，所以**你的路由最好也用 hash 模式**，否则邮件链接登录和快捷登录要自己改。
- 本地开发时参考官方的 `env.example.js`：`window.routerBase = 'http://127.0.0.1:8000/'`，配合 CORS 可前后端分离调试。


---

## 2. Passport 认证模块 (无需登录)

### 2.1 获取站点公开配置
进入登录注册页面前必须首先调用，用于决定页面渲染组件与人机验证流程。

- **URL**: `GET /api/v1/guest/comm/config`
- **鉴权**: 无

#### 响应载荷示例 (Response)
```json
{
  "status": "success",
  "message": "success",
  "data": {
    "tos_url": "https://example.com/tos",       // 服务条款地址 (null 则不渲染)
    "is_email_verify": 1,                       // 1 = 必须填写邮箱验证码，0 = 隐藏验证码项
    "is_invite_force": 0,                       // 1 = 必须填写邀请码，0 = 选填
    "email_whitelist_suffix": ["gmail.com", "qq.com"], // 允许的邮箱后缀 (若为 0 代表不限)
    "is_captcha": 1,                            // 1 = 开启人机安全验证
    "captcha_type": "turnstile",                // "turnstile" | "recaptcha" | "recaptcha-v3"
    "turnstile_site_key": "0x4AAAAAA...",       // Cloudflare Turnstile 密钥
    "recaptcha_site_key": null,                 // Google reCAPTCHA v2 Key
    "recaptcha_v3_site_key": null,              // Google reCAPTCHA v3 Key
    "recaptcha_v3_score_threshold": 0.5,        // v3 分数阈值
    "app_description": "New ME!",               // 站点简要介绍/副标题
    "app_url": "https://next.example.com",      // 站点前台主域名
    "logo": "https://example.com/logo.png"      // 站点 Logo (可为 null)
  }
}
```

### 2.2 验证码机制与动态参数
若 `is_captcha === 1`，在调用 `register` 与 `sendEmailVerify` 时，请求体中必须附加人机验证凭证：
- 若 `captcha_type === 'turnstile'`：带上 `turnstile_token: "<前端组件回调获得的Token>"`
- 若 `captcha_type === 'recaptcha-v3'`：带上 `recaptcha_v3_token: "<Token>"`
- 若 `captcha_type === 'recaptcha'`：带上 `recaptcha_data: "<Token>"`

### 2.3 邮箱与密码注册
- **URL**: `POST /api/v1/passport/auth/register`
- **请求体 (Body)**：

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :---: | :--- |
| `email` | string | 是 | 严格邮箱格式（若开启白名单，后缀必须在数组内） |
| `password` | string | 是 | 至少 8 个字符 |
| `email_code` | string | 视配置 | `is_email_verify=1` 时必填（6 位纯数字验证码） |
| `invite_code` | string | 视配置 | `is_invite_force=1` 时必填 |
| 人机验证参数 | string | 视配置 | 参见 [2.2 节](#22-验证码机制与动态参数) |

#### 响应载荷示例 (注册即自动登入)
```json
{
  "status": "success",
  "data": {
    "token": "49bf300643...",
    "auth_data": "Bearer 10|KuhAljOV6JZcGRIRKCsP...",
    "is_admin": false
  }
}
```

### 2.4 密码登录
- **URL**: `POST /api/v1/passport/auth/login`
- **请求体示例 (Body)**：
  ```json
  {
    "email": "user@example.com",
    "password": "my_secure_password"
  }
  ```
- **响应**：同注册成功，返回 `auth_data` 与 `token`。

### 2.5 发送邮箱验证码
- **URL**: `POST /api/v1/passport/comm/sendEmailVerify`
- **请求体示例 (Body)**：
  ```json
  {
    "email": "user@example.com",
    "turnstile_token": "0.xxxx" // 开启验证码时需携带
  }
  ```
- **说明**：同一邮箱 60 秒内只能下发一次；验证码 5 分钟有效；成功返回 `{"data": true}`。

### 2.6 忘记密码重置
- **URL**: `POST /api/v1/passport/auth/forget`
- **请求体示例 (Body)**：
  ```json
  {
    "email": "user@example.com",
    "email_code": "123456",
    "password": "new_password_8chars"
  }
  ```
- **响应**：成功返回 `{"data": true}`。

### 2.7 邮件免密魔术链接登录
用于无密码快速登录：
1. 前端调用 `POST /api/v1/passport/auth/loginWithMailLink`：
   ```json
   {
     "email": "user@example.com",
     "redirect": "/dashboard"
   }
   ```
2. 后端下发邮件至用户邮箱，邮件内链接指向 `GET /api/v1/passport/auth/token2Login?token=xxx&redirect=/dashboard`；
3. 该链接触发后会 HTTP 302 重定向至 `{app_url}/#/login?verify=xxx&redirect=/dashboard`；
4. 前端在 `#/login` 检测到 URL Query 携带 `verify` 参数时，调用核销端点：
   - **URL**: `GET /api/v1/passport/auth/token2Login?verify=<verify>`
   - **响应**: 成功返回 `{ "data": { "token": "...", "auth_data": "Bearer ...", "is_admin": false } }`。

### 2.8 快捷免密登录 URL
为用户生成一个带有短时临时签名的免密跳转直达 URL（可在已登录态或外挂应用调用）。
- **URL**: `POST /api/v1/passport/auth/getQuickLoginUrl`
- **请求头**: `Authorization: Bearer <auth_data>`
- **请求体**: `{"redirect": "/dashboard"}`
- **响应**: `{"data": "https://next.example.com/#/login?verify=..."}`

### 2.9 邀请码 PV 访问统计
当外部用户通过 `https://site.com/#/register?code=AFF123` 访问时调用，使该邀请码访问计数递增。
- **URL**: `POST /api/v1/passport/comm/pv`
- **请求体**: `{"invite_code": "AFF123"}`
- **响应**: 恒为 `{"data": true}`。

---

## 3. 用户核心与账户管理 (需登录)

### 3.1 登录态核验
- **URL**: `GET /api/v1/user/checkLogin`
- **响应**: `{"data": {"is_login": true, "is_admin": false}}`（Token 失效直接返回 HTTP 403）。

### 3.2 用户基础信息
- **URL**: `GET /api/v1/user/info`
- **响应载荷示例 (Response)**：
  ```json
  {
    "status": "success",
    "data": {
      "email": "admin@reia.fans",
      "transfer_enable": 107374182400,        // 总流量限额 (字节 Bytes, 换算需 / 1024 / 1024 / 1024)
      "last_login_at": 1762000000,            // 最后登入时间戳
      "created_at": 1760000000,               // 账户注册时间戳
      "banned": 0,                            // 1 = 账户已被封禁
      "remind_expire": 1,                     // 到期邮件提醒开关 (0关 1开)
      "remind_traffic": 1,                    // 流量耗尽邮件提醒开关 (0关 1开)
      "expired_at": 1890000000,               // 订阅到期时间 (null 为永久有效)
      "balance": 5000,                        // 账户余额 (单位：分，此处为 50.00 元)
      "commission_balance": 1280,             // 可提现/划转佣金余额 (分，此处为 12.80 元)
      "plan_id": 2,                           // 当前套餐 ID (null 为无有效套餐)
      "discount": null,                       // 用户专享折扣率
      "commission_rate": null,                // 用户专享佣金比例
      "telegram_id": 7441081518,              // 绑定的 TG 用户 ID
      "uuid": "597b3e18-1f5f-4b86-9d1f-...", // 用户节点通用连接密钥
      "avatar_url": "https://cdn.v2ex.com/gravatar/..." // Gravatar 头像直链
    }
  }
  ```

### 3.3 订阅详情与客户端通用链接
用户仪表盘核心指标接口。
- **URL**: `GET /api/v1/user/getSubscribe`
- **响应载荷示例 (Response)**：
  ```json
  {
    "status": "success",
    "data": {
      "plan_id": 2,
      "token": "8ce48ba26dbc6cdcaed...",    // 订阅 Token
      "expired_at": null,                    // null 为一次性/长期有效
      "u": 233312901,                        // 本周期已用上传流量 (Bytes)
      "d": 8047709862,                       // 本周期已用下载流量 (Bytes)
      "transfer_enable": 10737418240000,     // 总流量额度 (Bytes)
      "email": "admin@reia.fans",
      "uuid": "597b3e18-1f5f-4b86-9d1f-...",
      "device_limit": null,                  // 设备连接数限制 (null 为不限制)
      "speed_limit": null,                   // 限速值 (Mbps，null 为不限速)
      "next_reset_at": null,                 // 下次重置时间
      "reset_day": null,                     // 距离下次流量重置天数 (若为 null 且 expired_at 为 null 即为一次性套餐)
      "subscribe_url": "https://sub.domain.com/api/v1/client/subscribe?token=...", // 通用订阅 URL
      "plan": {                              // 套餐完整结构
        "id": 2,
        "name": "ROOT",
        "transfer_enable": 10000,
        ...
      }
    }
  }
  ```

### 3.4 用户统计角标
- **URL**: `GET /api/v1/user/getStat`
- **响应数据格式示例**：**注意返回的是数字位置数组，非对象！**
  ```json
  {
    "status": "success",
    "data": [
      0, // 索引 0: 待支付订单数
      1, // 索引 1: 待客服回复或进行中的工单数
      5  // 索引 2: 成功邀请并注册的下线用户数
    ]
  }
  ```

### 3.5 提醒配置修改
- **URL**: `POST /api/v1/user/update`
- **请求体示例 (Body)**：
  ```json
  {
    "remind_expire": 1, // 0 或 1
    "remind_traffic": 0 // 0 或 1
  }
  ```
- **响应**: `{"data": true}`。

### 3.6 修改安全密码
- **URL**: `POST /api/v1/user/changePassword`
- **请求体示例 (Body)**：
  ```json
  {
    "old_password": "current_password",
    "new_password": "new_password_8chars"
  }
  ```
- **副作用**：成功后，后端会作废本设备以外该用户的所有其他登录会话（Sanctum Tokens）。

### 3.7 重置订阅与密钥防泄露
- **URL**: `GET /api/v1/user/resetSecurity`
- **响应示例**:
  ```json
  {
    "status": "success",
    "data": "https://sub.domain.com/api/v1/client/subscribe?token=new_token..."
  }
  ```
- **作用**：重新生成用户的 `uuid` 和订阅 `token`，旧的订阅链接瞬间作废。必须配合前端二次确认弹窗使用。

### 3.8 佣金划转至账户主余额
- **URL**: `POST /api/v1/user/transfer`
- **请求体示例 (Body)**：
  ```json
  {
    "transfer_amount": 1000 // 整数，单位：分 (必须 >= 1 且 <= commission_balance)
  }
  ```
- **响应**: 成功后佣金减少、账户余额等额增加，返回 `{"data": true}`。

### 3.9 活跃会话管理与远程设备下线
- **拉取活动设备**: `GET /api/v1/user/getActiveSession`
  - 返回 Sanctum `personal_access_tokens` 列表示例：
    ```json
    {
      "status": "success",
      "data": [
        {
          "id": 12,
          "name": "Wth41OXkNtpFuA2y537E",                  // 令牌标识
          "last_used_at": "2026-10-27T13:00:24.000000Z",   // ISO 8601 时间字符串
          "created_at": "2026-10-18T15:05:28.000000Z"
        }
      ]
    }
    ```
- **强制踢出设备**: `POST /api/v1/user/removeActiveSession`
  - 请求体：`{"session_id": 12}`
  - 响应：`{"data": true}`。

### 3.10 登录后站点配置
- **URL**: `GET /api/v1/user/comm/config`
- **响应载荷示例 (Response)**：
  ```json
  {
    "status": "success",
    "data": {
      "is_telegram": 1,                      // 是否启用了 Telegram Bot
      "telegram_discuss_link": "https://t.me/group",
      "stripe_pk": "pk_live_...",            // 全局 Stripe 共有公钥
      "withdraw_methods": ["支付宝", "USDT"], // 允许申请提现的渠道列表
      "withdraw_close": 0,                   // 1 = 关闭提现申请通道
      "currency": "CNY",                     // 结算货币代码
      "currency_symbol": "¥",                // 货币符号
      "commission_distribution_enable": 1,   // 三级分销启用开关
      "commission_distribution_l1": 15,      // 一级返佣百分比
      "commission_distribution_l2": 5,
      "commission_distribution_l3": 2
    }
  }
  ```

### 3.11 Telegram 机器人联动与绑定
- **获取 Bot 用户名**: `GET /api/v1/user/telegram/getBotInfo`
- **响应**: `{"data": {"username": "YourProxyBot"}}`
- **绑定指令实现**: 在 Telegram 中向该机器人私聊发送：
  `/bind {用户的完整订阅URL}`
  或者带参直连：`https://t.me/{username}?start={subscribe_token}`。

---

## 4. 套餐、订单与支付系统

### 4.1 获取可用套餐列表
- **游客 (未登录)**: `GET /api/v1/guest/plan/fetch`
- **用户 (登录后)**: `GET /api/v1/user/plan/fetch`（支持带 `?id=xx` 查询指定套餐）
- **返回套餐实体示例 (Array)**：
  ```json
  [
    {
      "id": 1,
      "group_id": 1,
      "name": "Mini 体验套餐",
      "tags": ["新手推荐", "全专线"],
      "content": "### 特权说明\n- 月度流量：{{transfer}} GB\n- 速率限制：{{speed}}",
      "month_price": 499,          // 单位分，为 4.99 元；若为 null 代表不支持月付
      "quarter_price": 1400,
      "half_year_price": null,     // null 的周期严禁在前端渲染为购买选项
      "year_price": 4800,
      "two_year_price": null,
      "three_year_price": null,
      "onetime_price": null,
      "reset_price": null,         // 流量重置包价格 (单位分)
      "capacity_limit": 10,        // null=不限名额; 正整数=剩余可购名额; 售罄时返回字符串 "Sold out"
      "transfer_enable": 30,       // 套餐内流量单位是 GB
      "speed_limit": 300,          // 限速 Mbps (null 为不限)
      "device_limit": 2,           // 客户端连接数
      "show": true,
      "sell": true,                // sell=false 的套餐不可被订购
      "renew": true                // 是否允许老用户续费此套餐
    }
  ]
  ```
  *说明：`content` 中的 `{{transfer}}`、`{{speed}}`、`{{devices}}`、`{{reset_method}}` 已被服务端替换完毕。*

### 4.2 优惠折扣券核验
- **URL**: `POST /api/v1/user/coupon/check`
- **请求体示例 (Body)**：
  ```json
  {
    "code": "PROMO2026",
    "plan_id": 1,
    "period": "month_price" // 必须使用旧版周期键名
  }
  ```
- **成功响应示例**:
  ```json
  {
    "status": "success",
    "data": {
      "id": 3,
      "name": "立减五元优惠券",
      "type": 1,            // 1: 固定金额立减 (分); 2: 百分比折抵 (0~100)
      "value": 500,         // 若 type=1 减 500 分 (5元)；若 type=2 则为打折百分比 (如 20 代表 8 折/优惠20%)
      "limit_plan_ids": ["1", "2"],
      "limit_period": ["month_price", "year_price"]
    }
  }
  ```

### 4.3 创建购买订单
- **URL**: `POST /api/v1/user/order/save`
- **请求体示例 (Body)**：
  ```json
  {
    "plan_id": 1,
    "period": "month_price",
    "coupon_code": "PROMO2026" // 选填
  }
  ```
- **成功响应**: `{"data": "2026102716103214557019832"}`（返回生成的交易流水号字符串 `trade_no`）。
- **拦截限制**：若该用户当前已有 `status === 0` (待支付) 或 `status === 1` (开通中) 的订单，接口将直接报错拒绝。

### 4.4 支付网关查询与手续费运算
- **URL**: `GET /api/v1/user/order/getPaymentMethod`
- **返回列表示例 (Array)**：
  ```json
  [
    {
      "id": 1,
      "name": "支付宝 (免签直连)",
      "payment": "EPay",
      "icon": "https://example.com/alipay.png",
      "handling_fee_fixed": 10,     // 固定手续费：10 分 (0.10元)
      "handling_fee_percent": 1.5   // 百分比手续费率：1.5%
    }
  ]
  ```
- **手续费数学公式**：
  $$\text{HandlingFee} = \text{round}\left( \text{OrderAmount} \times \frac{\text{Percent}}{100} + \text{Fixed} \right)$$
  *（最终支付金额 $= \text{折后订单金额} + \text{HandlingFee}$）*

### 4.5 发起订单结算 (多态支付通道)
⚠️ **注意：此接口不遵循标准包装，返回体没有 `status` 字段！**
- **URL**: `POST /api/v1/user/order/checkout`
- **请求体示例 (Body)**：
  ```json
  {
    "trade_no": "2026102716103214557019832",
    "method": 1,     // 支付方式 ID
    "token": null    // Stripe 支付时由前端生成的付款 token
  }
  ```
- **响应结构示例**：
  ```json
  {
    "type": 1,
    "data": "https://example.paygateway.com/submit.php?money=..."
  }
  ```
- **`type` 路由处理状态机**：

| `type` 返回值 | 业务含义 | `data` 载荷内容 | 前端处理动作 |
| :---: | :--- | :--- | :--- |
| **`-1`** | 全额余额/优惠抵扣 | `true` | 无需调起网关，已直接扣减开通，前端直接提示成功并刷新资产 |
| **`0`** | 二维码扫码支付 | 二维码 Payload 字符串 | 本地通过 `qrcode` 库生成二维码展示，同时启动后台状态轮询 |
| **`1`** | 网页重定向收银台 | 收银台完整 URL 跳转地址 | **直接执行 `window.location.href = data`** 跳往支付渠道，启动轮询 |
| **其他** | 自定义 SDK 模式 | 由插件定义（如 Stripe 客户端公钥） | 载入对应 SDK 库并在页面渲染 Stripe Elements 完成确认 |

### 4.6 轮询订单支付状态
- **URL**: `GET /api/v1/user/order/check?trade_no=2026102716103214557019832`
- **响应**: `{"data": 3}`
- **状态流转**：
  - `status === 0`: 待支付
  - `status === 1`: 开通中
  - `status === 2`: 已取消/超时
  - `status === 3`: **支付已完成（前端结束轮询，弹出成功）**

### 4.7 订单列表与明细详情
- **拉取列表**: `GET /api/v1/user/order/fetch?status=0`（可选 `status` 0~3 过滤，倒序排列）
  - 返回带 `plan` 对象的订单列表数组。
- **获取单个订单详情**: `GET /api/v1/user/order/detail?trade_no=xxx`
  - 返回包含 `plan`、`payment`（`{id, name, icon}`）及折抵明细 `surplus_orders` 的详情对象。

### 4.8 取消待支付订单
- **URL**: `POST /api/v1/user/order/cancel`
- **请求体**: `{"trade_no": "2026102716103214557019832"}`
- **说明**: 仅 `status === 0` 的订单允许取消，其他状态操作返回错误。成功返回 `{"data": true}`。

---

## 5. 节点、流量与系统广播

### 5.1 节点集群列表 (支持 ETag)
⚠️ **注意：此接口直接返回 `{ "data": [ ... ] }`，不含 status 字段！**
- **URL**: `GET /api/v1/user/server/fetch`
- **特异性说明**：当用户订阅已过期、被封禁或无可用流量时，**返回空数组 `{"data": []}`**。
- **HTTP ETag 缓存优化**：
  服务端会在响应头下发 `ETag: "w/xxxx"`。前端再次请求时应附带请求头 `If-None-Match: "w/xxxx"`。若节点数据无变动，服务器会响应 **HTTP 304 Not Modified（空响应体）**，节省大量用户与服务器流量。
- **返回节点对象结构示例 (Array)**：
  ```json
  [
    {
      "id": 48,
      "name": "UK英国2 IEPL [0.5x]",
      "type": "vless",              // 协议类型: vmess, vless, trojan, shadowsocks, hysteria
      "version": "1.0",
      "rate": "0.5",                // 流量扣费倍率 (通常为字符串或浮点数)
      "tags": ["IEPL", "原生IP"],    // 分组标签
      "is_online": 1,               // 1 在线，0 离线
      "cache_key": "node_48_ping",
      "last_check_at": 1762100000   // 上次心跳探测时间戳
    }
  ]
  ```

### 5.2 周期流量历史记录
- **URL**: `GET /api/v1/user/stat/getTrafficLog`
- **说明**: 获取当前自然月每天的上下行记录（倒序输出）。
- **字段**: `[{ "u": 1234567, "d": 7654321, "record_at": 1761000000, "server_rate": "1.00" }]`（字节为单位）。

### 5.3 官方公告列表
⚠️ **注意：直接返回 `{ "data": [...], "total": 2 }`，无 status！**
- **URL**: `GET /api/v1/user/notice/fetch?current=1`
- **分页**: 固定每页 5 条，返回包含 `id`、`title`、`content`（支持 Markdown）、`img_url`、`created_at` 的列表。

### 5.4 知识库与使用教程
- **获取目录/文章**: `GET /api/v1/user/knowledge/fetch`
  - **必传参数**: `?language=zh-CN`（**务必传，否则后端 SQL 过滤为空**）；
  - **搜索参数**: `&keyword=clash`（模糊匹配标题和正文）；
  - **单篇阅读**: `&id=12`（返回包含完整正文 `body` 的文章对象）。
- **列表返回值结构示例**：按分类名作为 Key 的字典映射：
  ```json
  {
    "status": "success",
    "data": {
      "Android 客户端教程": [
        { "id": 1, "category": "Android 客户端教程", "title": "FlClash 配置指引", "updated_at": 1761000000 }
      ]
    }
  }
  ```
- **权限锁标记**:
  文章正文若带有 `<!--access start-->VIP专享段落<!--access end-->`，当未订阅用户访问时，后端会自动替换为 `<div class="v2board-no-access">...</div>`，前端需通过 CSS 美化该特定样式。

---

## 6. 客服工单与财务提现

### 6.1 我的工单列表
- **URL**: `GET /api/v1/user/ticket/fetch`
- **返回字段**: `[{ "id": 1, "subject": "连接断开排查", "level": 1, "status": 0, "reply_status": 1, "created_at": 1761000000 }]`
  - `status`: `0` 开启 (处理中), `1` 已关闭
  - `reply_status`: `0` 等待客服回复, `1` 客服已回复
  - `level`: `0` 低优先级, `1` 中等优先级, `2` 加急/提现工单

### 6.2 工单对话消息流 (含 500 防御)
- **URL**: `GET /api/v1/user/ticket/fetch?id=1`
- **返回结构示例**: 在详情对象中增加 `message` 数组：
  ```json
  {
    "id": 1,
    "subject": "节点连接超时咨询",
    "message": [
      {
        "id": 101,
        "ticket_id": 1,
        "is_me": true,           // true: 用户自己发送的；false: 客服官方回复
        "message": "这是 **Markdown** 格式的提问文本",
        "created_at": 1761000100
      }
    ]
  }
  ```
- ⚠️ **核心 500 报错陷阱防御**：
  若请求的 `id` 不存在或该工单不属于当前登录用户，**Xboard 源码实现存在缺陷（在 null 实体上强行调用了 `->load()`），会直接抛出 HTTP 500 服务端内部错误**。前端必须对 500 进行优雅捕获，友好提示“工单不存在或已被归档”，严禁白屏！

### 6.3 创建新工单
- **URL**: `POST /api/v1/user/ticket/save`
- **请求体示例 (Body)**：
  ```json
  {
    "subject": "工单主题标题",
    "level": 1, // 0, 1, 2
    "message": "详细问题描述，支持多行文本与 Markdown"
  }
  ```
- **响应**: `{"data": true}`。

### 6.4 回复工单消息
- **URL**: `POST /api/v1/user/ticket/reply`
- **请求体**: `{"id": 1, "message": "这是跟进回复内容"}`
- **限制**: 已关闭工单不可回复；若后台开启了“必须等待客服回复”，用户在客服回复前连续发送将被接口直接拒绝。

### 6.5 关闭工单
- **URL**: `POST /api/v1/user/ticket/close`
- **请求体**: `{"id": 1}`
- **响应**: `{"data": true}`。

### 6.6 申请佣金财务提现
在 Xboard 业务模型中，提现申请本质上是向后台**自动开具一张最高优先级（Level 2）的财务加急工单**。
- **URL**: `POST /api/v1/user/ticket/withdraw`
- **前置校验**: `userConfig.withdraw_close !== 1` 且 `commission_balance >= 最低提现门槛`。
- **请求体示例 (Body)**：
  ```json
  {
    "withdraw_method": "支付宝", // 必须在 userConfig.withdraw_methods 列表内
    "withdraw_account": "user@alipay.com"
  }
  ```
- **响应**: `{"data": true}`。

---

## 7. 推广邀请与返利系统

### 7.1 邀请数据看板与未用码列表
- **URL**: `GET /api/v1/user/invite/fetch`
- **响应载荷示例 (Response)**：
  ```json
  {
    "status": "success",
    "data": {
      "codes": [
        {
          "code": "AFF8888",
          "pv": 42,                  // 链接点击浏览量
          "status": 0,               // 0 可用
          "created_at": 1760000000
        }
      ],
      "stat": [
        12,      // 索引 0: 成功邀请注册人数
        25000,   // 索引 1: 累计已获有效佣金 (分，250.00元)
        3500,    // 索引 2: 确认中待结算佣金 (分，35.00元)
        15,      // 索引 3: 当前返佣比例 (%)
        8800     // 索引 4: 当前可划转/提现可用佣金 (分，88.00元)
      ]
    }
  }
  ```
  *注意：前端拼接链接标准格式为：`{站点域名}/#/register?code={code}`。*

### 7.2 生成专属新邀请码
⚠️ **注意：这是一个带有数据写入副作用的 HTTP GET 接口！**
- **URL**: `GET /api/v1/user/invite/save`
- **限制**: 当用户生成的未用码达到后台设定上限（默认 5 个）时会抛错返回失败。

### 7.3 佣金返利明细账单 (分页)
⚠️ **注意：直接返回 `{ "data": [...], "total": 12 }`，无 status！**
- **URL**: `GET /api/v1/user/invite/details?current=1&page_size=10`
- **注意**: `page_size` 若小于 10，后端会自动强制按 10 处理。
- **返回条目字段示例**:
  ```json
  {
    "data": [
      {
        "id": 1,
        "order_amount": 6999, // 触发分成订单的原金额 (分)
        "trade_no": "202610271610321455...",
        "get_amount": 1050,   // 本单实际分红到账佣金 (分)
        "created_at": 1761000000
      }
    ],
    "total": 1
  }
  ```

---

## 8. 礼品卡充值与兑换

### 8.1 礼品卡类型映射
- **URL**: `GET /api/v1/user/gift-card/types`
- **返回**: 字典映射对象，描述支持充值的卡券种类（时长卡、流量包、余额充值卡等）。

### 8.2 兑换前权益预检与可用性校验
核销前调用此接口预览奖励并提示用户，体验更友好。
- **URL**: `POST /api/v1/user/gift-card/check`
- **请求体**: `{"code": "GIFT-8888-9999"}`
- **响应载荷示例 (Response)**：
  ```json
  {
    "status": "success",
    "data": {
      "can_redeem": true,                         // 是否可以核销
      "reason": "",                               // 不可兑换的原因提示
      "reward_preview": "增加 50GB 流量，时长延期 30 天",
      "code_info": {
        "template_name": "双十一专属充值卡"
      }
    }
  }
  ```

### 8.3 提交核销兑换
- **URL**: `POST /api/v1/user/gift-card/redeem`
- **请求体**: `{"code": "GIFT-8888-9999"}`（8 到 32 字符）
- **响应载荷示例**:
  ```json
  {
    "status": "success",
    "data": {
      "message": "兑换成功！权益已即刻到账",
      "template_name": "双十一专属充值卡",
      "rewards": { ... }
    }
  }
  ```
  *（兑换成功后前端应立即触发 `user/info` 与 `user/getSubscribe` 的并发刷新）*。

### 8.4 个人兑换历史账目
⚠️ **注意：直接返回 `{ "data": [...], "pagination": {...} }`，无 status！**
- **URL**: `GET /api/v1/user/gift-card/history?page=1&per_page=15`（`per_page` 最大 100）
- **说明**: 接口出于安全隐私考虑，返回的 `code` 已被后端自动脱敏，仅保留前 8 位。

### 8.5 单条兑换卡模板详情
- **URL**: `GET /api/v1/user/gift-card/detail?id=5`
- **响应**: 包含该次兑换卡关联的模板配置元数据：`name`、`description`、`type`、`type_name`、`icon`、`theme_color`。

---

## 9. 前端网络请求层最佳实践 (TypeScript 完整封装)

下面提供一套经实战打磨、完美适配上述全部特殊响应格式、内置 MessagePack 二进制解码、多账号注入以及 403 / 422 异常自愈的统一请求库：

```typescript
import axios, { type AxiosResponse } from 'axios'
import { decode } from '@msgpack/msgpack'

// 1. 读取 Xboard 全局注入的基地址
const routerBase = (window as any).routerBase || '/'

export const api = axios.create({
  baseURL: `${routerBase}api/v1`,
  // 必须使用 arraybuffer 接收，兼容 MessagePack 二进制流与 UTF-8 文本回退
  responseType: 'arraybuffer',
  headers: {
    // 明确告诉配套插件优先返回二进制流
    'Accept': 'application/msgpack, application/json;q=0.9',
    'Content-Language': localStorage.getItem('lang') || 'zh-CN'
  }
})

// 2. 请求拦截器：注入鉴权 Token
api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('auth_data')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = token
  }
  return config
})

// 3. 内存级解码辅助函数
function parsePayload(res: AxiosResponse): any {
  const contentType = String(res.headers?.['content-type'] || '')
  
  // 命中 MessagePack 二进制流
  if (contentType.includes('application/msgpack') || contentType.includes('application/x-msgpack')) {
    return decode(new Uint8Array(res.data))
  }

  // 纯文本/JSON 回退
  try {
    const text = new TextDecoder('utf-8').decode(res.data)
    return text ? JSON.parse(text) : null
  } catch {
    return res.data
  }
}

// 4. 响应拦截器：抹平格式差异与异常熔断
api.interceptors.response.use(
  (response: any) => {
    // ETag 缓存生效直接返回 undefined
    if (response.status === 304) return undefined

    const payload = parsePayload(response)

    // 适配 1.4 节特殊接口 (直接放行)
    if (payload && typeof payload === 'object') {
      if (payload.type !== undefined) return payload // checkout 多态返回
      if (payload.pagination !== undefined) return payload // gift-card/history
      if (payload.status === 'success') return payload.data // 标准成功包裹
      if (payload.status === 'fail') return Promise.reject(new Error(payload.message || '业务操作失败'))
      
      // 不带 status 包装的列表 (notice, server, invite details)
      return payload.data ?? payload
    }
    return payload
  },
  (error: any) => {
    if (error.response?.data) {
      const errData = parsePayload(error.response)

      // 403 统一身份失效处理
      if (error.response.status === 403) {
        localStorage.removeItem('auth_data')
        if (!location.hash.startsWith('#/login')) {
          location.hash = '#/login'
        }
        return Promise.reject(new Error(errData?.message || '登录已过期，请重新登录'))
      }

      // 422 Laravel 表单验证错误数组格式提取
      if (error.response.status === 422 && errData?.errors) {
        const firstFieldErrors = Object.values(errData.errors)[0] as string[]
        return Promise.reject(new Error(firstFieldErrors?.[0] || errData.message || '输入校验失败'))
      }

      return Promise.reject(new Error(errData?.message || `网络请求错误 (HTTP ${error.response.status})`))
    }
    return Promise.reject(error)
  }
)
```

---

## 10. 项目特色扩展与延伸生态 API 指南

> 本章节详细说明本项目除了 Xboard 原生 REST 接口之外，所接入的**第三方遥测系统、专属 E2EE 加密下载服务及活动业务引擎**的通信规范。
> 方便社区开发者在此主题框架下二次定制，或将本套流媒体与探针交互移植至其他客户端中。

---

### 10.1 Komari 基础设施遥测系统 (只读免密模式)

本项目放弃了具有越权隐患的管理员 RESTful 接口，全面采用 Komari 官方免密公开的 **JSON-RPC 2.0 规范**，仅读取物理母机的只读性能数据。

- **服务基地址配置**：由主题后台配置项注入 `window.settings.komari_url`（如 `https://stat.example.com`，末尾不带斜杠）。
- **统一通信入口**：`POST {komari_url}/api/rpc2`
- **跨域 (CORS) 穿透策略**：
  - *开发环境*：通过 Vite 代理转发至 `/komari-proxy/api/rpc2`，自动伪造 `Origin` 与 `Referer`；
  - *生产环境*：在 Cloudflare 规则中对 `stat.example.com` 增加响应头 `Access-Control-Allow-Origin: *`或者在Komari中的站点设置页添加CORS白名单，无需修改编译后的 Komari 二进制程序。

---

#### 10.1.1 批量获取母机节点元数据 (`common:getNodes`)

获取当前探针纳管的所有物理母机硬件参数、国家地区、虚拟化类型与网络配置。

- **请求方式**: `POST {komari_url}/api/rpc2`
- **请求头 (Headers)**:
  ```http
  Content-Type: application/json
  Accept: application/json
  ```
- **请求体 (Request Body)**:
  ```json
  {
    "jsonrpc": "2.0",
    "method": "common:getNodes",
    "params": {},
    "id": 1
  }
  ```
- **成功响应载荷 (Response)**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "9d12f9c0-e66b-4a08-aaed-5733509e0c62": {
        "uuid": "9d12f9c0-e66b-4a08-aaed-5733509e0c62",
        "name": "腾讯云|广州|01",
        "cpu_name": "AMD EPYC 7K62 48-Core Processor",
        "virtualization": "kvm",                  // 虚拟化架构: kvm, openvz, lxc, baremetal
        "arch": "amd64",                          // CPU 架构: amd64, arm64
        "cpu_cores": 2,                           // 逻辑核心数
        "cpu_physical_cores": 2,                  // 物理核心数
        "os": "Debian GNU/Linux 13 (trixie)",     // 系统发行版全称
        "kernel_version": "7.0.6-x64v3-xanmod1",  // 内核版本
        "gpu_name": "None",
        "ipv4": "1.1.1.1",                  // 节点公网 IPv4
        "ipv6": "2000:4000:c000:1000:4000:...",   // 节点公网 IPv6
        "region": "🇨🇳",                          // 地区 Emoji 标识
        "mem_total": 1004347392,                  // 物理内存总量 (单位: 字节 Bytes)
        "swap_total": 1073737728,                 // 交换内存总量 (单位: 字节 Bytes)
        "disk_total": 42166988800,                // 存储盘总量 (单位: 字节 Bytes)
        "version": "Snapshot-2610260110",
        "weight": 0
      }
    }
  }
  ```

---

#### 10.1.2 批量获取母机最新运行状态 (`common:getNodesLatestStatus`)

轮询获取母机实时的 CPU、内存、网络上下行瞬时速率与累计传输指标。

- **请求方式**: `POST {komari_url}/api/rpc2`
- **请求体 (Request Body)**:
  ```json
  {
    "jsonrpc": "2.0",
    "method": "common:getNodesLatestStatus",
    "params": {},
    "id": 2
  }
  ```
- **成功响应载荷 (Response)**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": 2,
    "result": {
      "9d12f9c0-e66b-4a08-aaed-5733509e0c62": {
        "online": true,                           // 探针连通状态: true 在线, false 离线
        "uptime": 2862735,                        // 持续运行秒数 (需换算 天/时/分)
        "cpu": 7.2,                               // CPU 使用率百分比 (0.0 ~ 100.0)
        "ram": 314236928,                         // 内存已用 (Bytes, 与 mem_total 相除折算百分比)
        "disk": 30668730368,                      // 磁盘已用 (Bytes, 与 disk_total 相除折算百分比)
        "network_rx": 5103082,                    // 下行实时速率 (Bytes/s, 换算为 KB/s 或 MB/s)
        "network_tx": 4350592,                    // 上行实时速率 (Bytes/s)
        "traffic_rx": 1782309823839,              // 历史累计下载总流量 (Bytes)
        "traffic_tx": 1149961319526               // 历史累计上传总流量 (Bytes)
      }
    }
  }
  ```
  *注意：Komari 在 `status` 中下发的 `ram` 与 `disk` 为**原始已用字节数**，前端计算真实百分比公式为：*
  $$\text{RAM\%} = \frac{\text{status.ram}}{\text{nodeInfo.mem\_total}} \times 100\%$$

---

#### 10.1.3 母机近况深度遥测时序快照 (`/api/recent/{uuid}`)

点击单台母机卡片后调用，提取最近 1~2 分钟的高频采样时序流，用于绘制 **Latency 链路质量双轴曲线** 与系统负载。

- **请求方式**: `GET {komari_url}/api/recent/{uuid}`
- **成功响应载荷 (Response)**:
  ```json
  {
    "status": "success",
    "message": "",
    "data": [
      {
        "uuid": "9d12f9c0-e66b-4a08-aaed-5733509e0c62",
        "cpu": { "usage": 7.90 },
        "ram": { "total": 1004347392, "used": 317681664 },
        "swap": { "total": 1073737728, "used": 152641536 },
        "load": {
          "load1": 0.26,                          // 1 分钟系统平均负载
          "load5": 0.40,                          // 5 分钟系统平均负载
          "load15": 0.29                          // 15 分钟系统平均负载
        },
        "disk": { "total": 42166988800, "used": 30668709888 },
        "network": {
          "up": 3575717,                          // 瞬时上传字节/秒
          "down": 3708372,                        // 瞬时下载字节/秒
          "totalUp": 1149928232339,               // 累计上传总字节
          "totalDown": 1782271389546              // 累计下载总字节
        },
        "connections": {
          "tcp": 254,                             // 当前系统 TCP 活跃连接数
          "udp": 74                               // 当前系统 UDP 活跃连接数
        },
        "process": 124,                           // 系统活跃进程数
        "uptime": 2862725,                        // 运行时间秒数
        "updated_at": "2026-10-27T13:05:51.881712208Z" // ISO 8601 采样时间
      }
    ]
  }
  ```

---

### 10.2 E2EE 零知识加密虚拟流媒体下载中心

该体系对应独立的 Node.js 存储服务（`ReiaDown-Secure-Storage`），支持全链路端到端 AES-256-GCM 硬件加解密与分块串流播放。

- **服务基地址配置**：由主题后台配置项注入 `window.settings.download_center_url`（如 `https://install.example.com`）。
- **会话存储键名**：`localStorage.getItem('reiadown_token')`。

---

#### 10.2.1 派发下载中心身份令牌 (`POST /api/login`)

- **请求方式**: `POST {download_center_url}/api/login`
- **请求体 (Request Body)**:
  ```json
  {
    "email": "user@example.com",
    "password": "user_password"
  }
  ```
- **成功响应**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsIn...", // JWT 会话令牌，通常 24h 有效
    "user": { "email": "user@example.com", "isAdmin": false }
  }
  ```

---

#### 10.2.2 目录与资源列表拉取 (`GET /api/admin/resources`)

已登录用户拉取当前文件夹下的子文件夹、加密资源与目录专属 Markdown 说明。

- **请求方式**: `GET {download_center_url}/api/admin/resources?parentId={parentId}`
- **请求头 (Headers)**:
  ```http
  Authorization: Bearer <reiadown_token>
  ```
- **成功响应载荷**:
  ```json
  {
    "success": true,
    "folder_md": "### 目录说明\n此处为客户端安装包归档目录。", // 当前目录的 Markdown 说明文本
    "resources": [
      {
        "id": 101,
        "parent_id": 0,
        "type": "folder",                         // "folder" 目录 | "file" 文件
        "name": "Windows 客户端",
        "tags": "",
        "file_size": 0,
        "created_at": "2026-10-20T08:00:00.000Z"
      },
      {
        "id": 102,
        "parent_id": 101,
        "type": "file",
        "name": "FlClash-0.9.1-windows.zip",
        "tags": "FlClash,推荐",                   // 逗号分隔的分类标签
        "is_encrypted": 1,                        // 1 = 启用端到端 AES-GCM 分块加密
        "file_size": 43238512,                    // 文件原始明文字节大小
        "total_chunks": 5,                        // 10MB 分块总数
        "oss_id": 1                               // 关联的云端对象存储 ID
      }
    ]
  }
  ```

---

#### 10.2.3 提取下载授权凭证与解密元数据 (`GET /api/resources/{id}/download`)

客户端拉取文件的预签名下载切片地址和对称密钥。服务端采用基于当前用户的 JWT 会话密钥进行 **AES-256-GCM 二次封装传输**。

- **请求方式**: `GET {download_center_url}/api/resources/{id}/download`
- **请求头**: `Authorization: Bearer <reiadown_token>`
- **未解密的外层网络载荷**:
  ```json
  {
    "e2ee": true,
    "iv": "u8Z...==",                             // 12 字节 Base64 初始化向量
    "tag": "k8X...==",                            // 16 字节 Base64 GCM 认证标签
    "data": "A9f...=="                            // Base64 加密密文
  }
  ```
- **前端解密流程 (Web Crypto API)**：
  1. 将当前用户的 `reiadown_token` 经由 SHA-256 散列，派生出 32 字节会话主密钥 $K_{\text{session}}$；
  2. 使用 $K_{\text{session}}$ 和 `iv` 对 `data + tag` 进行硬件解密；
  3. 解密还原出的明文 JSON 结构如下：
     ```json
     {
       "success": true,
       "isLink": false,
       "file_name": "FlClash-0.9.1-windows.zip",
       "is_encrypted": true,
       "encrypt_key": "dGVzdF9rZXlfxxx...", // 文件的 256 位 AES-GCM 还原密钥
       "total_chunks": 5,
       "downloadUrls": [
         "https://oss.example.com/vault/chunk_0.bin?Signature=...",
         "https://oss.example.com/vault/chunk_1.bin?Signature=..."
       ]
     }
     ```

---

#### 10.2.4 弹幕数据接口与 WebSocket 实时广播协议

- **拉取历史弹幕**: `GET {download_center_url}/api/resources/{id}/danmaku`
  - 返回弹幕数组：`[{ "id": "1", "start": 3200, "txt": "前方高能！", "mode": "scroll", "style": { "color": "#ffffff", "fontSize": "20px" } }]`
- **发送新弹幕**: `POST {download_center_url}/api/resources/{id}/danmaku`
  - 请求体：
    ```json
    {
      "start": 3200,      // 视频出现的相对毫秒数
      "txt": "这是一条测试弹幕....",   // 弹幕内容
      "color": "#00e5ff", // 颜色 HEX
      "font_size": "20px",
      "mode": "scroll"    // "scroll" 滚动 | "top" 顶部固定 | "bottom" 底部固定
    }
    ```
- **WebSocket 实时双向流广播**:
  - 连接地址：`ws(s)://{download_center_host}/`
  - 发送广播载荷：
    ```json
    {
      "type": "danmaku_send",
      "resourceId": 102,
      "comment": { "id": "custom_1", "start": 3200, "txt": "全网同步弹幕", "style": { "color": "#ffffff" } }
    }
    ```
  - 接收广播载荷：`type === 'danmaku_receive'`，自动注入西瓜播放器画面中。

---

#### 10.2.5 Service Worker 虚拟切片流控协议 (`public/sw.js`)

解决浏览器播放器原生不支持加密分块的问题，SW 在底层模拟出合法的流媒体服务器。

1. **注册流媒体切片清单 (`postMessage`)**:
   ```javascript
   const channel = new MessageChannel();
   navigator.serviceWorker.controller.postMessage({
     type: 'REGISTER_STREAM',
     id: 'stream_17620000',
     manifest: {
       file_size: 43238512,
       chunk_size: 10485760, // 10MB 标准分块
       urls: [ "https://...", "https://..." ],
       encrypt_key: "base64_aes_key...",
       mime_type: "video/mp4"
     }
   }, [channel.port2]);
   ```
2. **虚拟流访问端点**:
   - URL: `/e2ee-stream/[stream/music]_xxxxxxx`
   - **Range 响应契约**: SW 拦截浏览器 `<video>或<audio>` 发送的 `Range: bytes=start-end`，计算对应的块编号并按需拉取解密，返回标准 **HTTP 206 Partial Content**。
3. **销毁流媒体并释放内存**:
   ```javascript
   navigator.serviceWorker.controller.postMessage({
     type: 'CLOSE_STREAM',
     id: 'stream_17620000'
   });
   ```

---

### 10.3 活动业务注入引擎与 Token 穿透协议

在主题后台【活动页面自定义代码】中填入的代码，通过本引擎实现样式的绝对隔离与免密鉴权穿透。

- **语法块分片标记**:
  使用 ` ```` `（四个连续反引号）包裹各个独立的活动，前端引擎自动切分为独立卡片。
- **免登录 Token 穿透机制**:
  活动前端可通过以下协议从宿主容器读取当前已登录用户的 Xboard 凭据，实现活动服务免输入账密一键授权：
  ```javascript
  // 宿主在拉起活动 iframe 或外链时，自动在 URL 尾部注入 token 参数：
  const targetUrl = `${ACTIVITY_BASE_URL}?token=${encodeURIComponent(localStorage.getItem('auth_data'))}`;
  ```
- **iframe 弹窗关闭回传通信协议**:
  当嵌入在活动视窗中的 H5 页面完成业务（如抽奖完毕或用户点击游戏内关闭）时，可向父容器发送 PostMessage 通知关闭视窗：
  ```javascript
  window.parent.postMessage({ type: 'CLOSE_REIA_DIALOG' }, '*');
  ```
---

根据你提供的最新源码架构与在线接口返回数据（LRCLIB、iTunes、下载中心后端），为你整理出标准 Markdown 格式的 **《10.4 顶栏灵动岛流媒体播放器与全网开源刮削引擎 API 开发文档》**。

你可以直接将其无缝追加到项目现有的 `API-GuideBook.md` 文档第 10 章节中。

---

### 10.4 彩蛋
- q(≧▽≦q)

灵动岛音乐播放器（`DynamicIslandMusic.vue`）是挂载于顶栏中央的沉浸式音频流媒体套件。它集成了**下载中心 E2EE 零知识解密流、Service Worker 虚拟音频串流（支持 HTTP 206 断点续传）、全网五源并发元数据与逐行滚动歌词刮削系统、系统级 Media Session 硬件联动以及底部 osu! 太阳辐射声波可视化**。

```
                                      ┌──> [源1: LRCLIB] ──> 获取逐行时间轴歌词 (LRC)
                                      ├──> [源2: Apple iTunes] ──> 获取 600x600 超清封面
[扫描音乐库] ──> [E2EE 解密/SW 串流] ──┼──> [源3: Meting/网易云] ──> 获取华语/ACG 歌词及封面
                                      ├──> [源4: Deezer] ──> 国际跨国曲库封面兜底
                                      └──> [源5: UOMG/网易直连] ──> 国内高命中率备用
```

---

#### 10.4.1 音乐资产嗅探与目录索引检索

* **概述**：组件初始化时，从 `window.settings.download_center_url` 发起请求，通过两级父子关联智能嗅探名为 `music` 或 `音乐` 的文件夹，并提取其中的受保护音频文件清单。
* **依赖凭据**：请求头必须携带下载中心颁发的 JWT Token（`localStorage.getItem('reiadown_token')`）。若未登录则整机静默，不占用标题栏空间。

##### 1. 扫描根目录与匹配目标文件夹
* **URL**: `GET {download_center_url}/api/admin/resources?parentId=0`
* **请求头 (Headers)**:
  ```http
  Authorization: Bearer <reiadown_token>
  Accept: application/json
  ```
* **前端业务处理**：
  遍历返回的 `resources` 数组，匹配 `type === 'folder'` 且名称为 `music` 或包含 `音乐` 的目录对象，提取其目录 `id`（例如图中的 `parentId=46`）。

##### 2. 拉取音乐目录下的音频文件
* **URL**: `GET {download_center_url}/api/admin/resources?parentId={musicFolderId}`
* **响应示例 (JSON)**:
  ```json
  {
    "success": true,
    "resources": [
      {
        "id": 47,
        "parent_id": 46,
        "type": "file",
        "name": "Iris,SIRIUSBLVCK - Twilight.flac",
        "tags": "未分类",
        "link": "",
        "sync_mode": "general",
        "oss_id": 1,
        "object_key": "encrypted_vault/1793589265413_ersluhyp",
        "is_encrypted": 1,
        "file_size": 17647200,
        "total_chunks": 2,
        "sort_order": 0,
        "folder_md": null,
        "created_at": "2026-11-02T01:45:56.000Z"
      }
    ],
    "folder_md": null
  }
  ```
* **字段说明**：
  * `id`: 音频资源唯一主键编号；
  * `name`: 文件名，前端自动提取并规整为歌手（Artist）与歌曲名（Title）；
  * `file_size`: 原始音频大小（字节）；
  * `total_chunks`: 云端加密碎片总数；
  * `is_encrypted`: 是否受 AES-256-GCM 零知识加密保护。

---

#### 10.4.2 专属音频凭证获取与会话解密

* **URL**: `GET {download_center_url}/api/resources/{id}/download`
* **请求头 (Headers)**:
  ```http
  Authorization: Bearer <reiadown_token>
  ```
* **避坑说明**：原生 `<audio src="...">` 无法携带自定义 `Authorization` 头，直接请求此端点会触发 **HTTP 401 Unauthorized**。前端必须使用 `fetch` 提前拉取加密包，并在前端内存中解密出 S3 预签名直传切片集合与解密密钥。

##### 1. 密文响应示例 (E2EE Package)
```json
{
  "e2ee": true,
  "iv": "3Qx+9J2/gC5jG1a4",
  "tag": "eM84sJkLz0A91VbB+Xg==",
  "data": "kLz0A91VbB+Xg8/q...base64密文..."
}
```

##### 2. 前端解密后还原明文元数据 (Decrypted Payload)
通过 `crypto.ts` 中基于用户 Token 派生的会话密钥 `SHA-256(token)` 解密获得：
```json
{
  "success": true,
  "isLink": false,
  "downloadUrls": [
    "https://s3.endpoint.com/bucket/encrypted_vault/..._chunk_0.bin?X-Amz-Signature=...",
    "https://s3.endpoint.com/bucket/encrypted_vault/..._chunk_1.bin?X-Amz-Signature=..."
  ],
  "total_chunks": 2,
  "is_encrypted": true,
  "encrypt_key": "u8+f...Base64格式AES-256-GCM密钥...",
  "file_name": "Iris,SIRIUSBLVCK - Twilight.flac"
}
```

---

#### 10.4.3 Service Worker 虚拟音频流挂载与内存降级自愈

前端获取到 `downloadUrls` 与 `encrypt_key` 后，通过 IPC 信道向 `sw.js` 注册流式通道，支持原生播放器按需以 **HTTP 206 Partial Content** 播放 FLAC / MP3 / Opus：

##### 1. 注册虚拟音频流 (MessageChannel IPC)
* **向 Service Worker 派发指令**:
  ```javascript
  const streamId = `music_${track.id}_${Date.now()}`
  navigator.serviceWorker.controller.postMessage({
    type: 'REGISTER_STREAM',
    id: streamId,
    manifest: {
      file_size: track.resource.file_size,
      chunk_size: 10 * 1024 * 1024,
      urls: data.downloadUrls,
      encrypt_key: data.encrypt_key,
      mime_type: 'audio/flac' // 严格按扩展名匹配 audio/flac, audio/mpeg, audio/opus
    }
  }, [channel.port2])
  ```
* **虚拟音频挂载挂点**:
  ```
  /e2ee-stream/{streamId}
  ```
* **自愈回退与会话记忆（Session Memory Fallback）**：
  若当前环境处于无痕窗口或不支持 Service Worker 拦截，系统自动捕获并在内存中通过 `crypto.subtle.decrypt` 并发解密切片拼装为 `Blob URL`（`URL.createObjectURL(blob)`）。
  同时将状态写入 `sessionStorage.setItem('music_stream_fallback', 'true')`，本次浏览器运行期间保持免重试顺畅直解。

---

#### 10.4.4 全网五源级联并发刮削引擎

由于网络音频文件名通常带有 `(TV Size)`、`[FLAC]`、`feat.` 或混杂副歌名，播放器内置了**清洗过滤器**与**多源并发竞速级联算法**：
* **清洗预处理**：剥离括号内容、去除连字符，优先以 `纯歌名` 检索（命中率最高）；若无果再降级以 `歌名 + 第一顺位作者` 检索。
* **竞速机制**：5 个源同时发起 `Promise.allSettled`，任一接口先返回封面或歌词立即响应上屏。

##### 1. 源 1：LRCLIB 开放 API（逐行时间轴歌词首选）
* **接口形式**: `GET https://lrclib.net/api/search?q={query}`
* **鉴权/CORS**: 完全免 Key、原生支持跨域 (`Access-Control-Allow-Origin: *`)
* **响应示例 (JSON)**:
  ```json
  [
    {
      "id": 38114877,
      "name": "Deep Dive",
      "trackName": "Deep Dive",
      "artistName": "轟はじめ",
      "albumName": "Deep Dive",
      "duration": 167,
      "instrumental": false,
      "plainLyrics": "Late night 今夜はwith my girlies...",
      "syncedLyrics": "[00:12.45] Late night 今夜はwith my girlies\n[00:15.10] Baby すぐ出なよ (let's get party, yeah)..."
    }
  ]
  ```
* **字段提取**：直接提取 `syncedLyrics` 导入滚动歌词渲染器；若仅有 `plainLyrics` 则作为静态歌词备用展示。

##### 2. 源 2：Apple iTunes Search API（600×600 超清官方封面）
* **接口形式**: `GET https://itunes.apple.com/search?term={query}&media=music&entity=song&country=JP&limit=1`
* **鉴权/CORS**: 官方原生支持跨域、无需 API Key
* **响应示例 (JSON)**:
  ```json
  {
    "resultCount": 1,
    "results": [
      {
        "wrapperType": "track",
        "kind": "song",
        "artistId": 1654897210,
        "trackName": "Deep Dive",
        "artistName": "轟はじめ",
        "collectionName": "Deep Dive - Single",
        "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/a5/1e/40/a51e4063-872e-3600-4b36-559d87132890/cover.jpg/100x100bb.jpg",
        "trackTimeMillis": 167000
      }
    ]
  }
  ```
* **高清封面转换技巧**：前端自动执行 `.replace('100x100bb', '600x600bb')`，提取 600×600 高分辨率印刷级正方形封面。

##### 3. 源 3：Deezer Open API（国际流行乐备用）
* **接口形式**: `GET https://api.deezer.com/search?q={query}&limit=1`
* **响应提取**: 提取 `data[0].album.cover_xl` 或 `cover_big` 作为高清大图兜底。

##### 4. 源 4：Meting 公共镜像聚合源（华语、ACG 与特化歌词）
* **接口形式**: `GET https://api.injahow.cn/meting/?type=search&keyword={query}`
* **歌词与图片二级提取**:
  * 封面：直接取 `item.pic`
  * 歌词：通过 `GET https://api.injahow.cn/meting/?type=lrc&id={id}` 获得纯文本 LRC。

##### 5. 源 5：UOMG API（国内网易云直连检索备用）
* **接口形式**: `GET https://api.uomg.com/api/search/netease?words={query}`
* **响应提取**: 当 `code === 1` 时，直接提取 `data[0].picurl` 作为专辑封面备份。

---

#### 10.4.5 毫秒级时间轴互锁滚动歌词协议

解析标准 LRC 时间戳，将文本解析为内存连续数组结构，并通过 `timeupdate` 事件进行毫秒级精准对齐：

#### 1. LRC 解析器正则表达式与结构定义
```typescript
export interface LyricLine {
  time: number // 转换为秒级浮点数 (如 75.45)
  text: string // 纯文本歌词
}

// 匹配 [mm:ss.xx] 或 [mm:ss.xxx]
const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/)
```

##### 2. 时间轴互锁计算算法
在音频播放过程中，播放器高频计算当前播放进度所在区间：
```typescript
const activeLyricIndex = computed(() => {
  if (!currentTrack.value?.lyrics?.length) return -1
  const t = currentTime.value
  const list = currentTrack.value.lyrics
  for (let i = list.length - 1; i >= 0; i--) {
    if (t >= list[i].time) return i
  }
  return 0
})
```

##### 3. 视口平滑居中同步
通过监听 `activeLyricIndex` 变动，自动将激活行滚动至可视区域几何中心：
```typescript
const activeEl = lyricsScrollRef.value?.querySelector(`.lyric-line-${newIdx}`)
activeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
```

---

#### 10.4.6 系统级 Media Session 硬件外设联动

全面接入 W3C `navigator.mediaSession` 标准，使网页在后台运行时，仍可被操作系统与外部硬件感知并控制：

```typescript
navigator.mediaSession.metadata = new MediaMetadata({
  title: currentTrack.value.title,
  artist: currentTrack.value.artist,
  album: 'Xboard 专属音乐库',
  artwork: [
    { src: currentTrack.value.coverUrl, sizes: '512x512', type: 'image/jpeg' }
  ]
})

// 硬件外设按键绑定 (耳机线控、键盘多媒体键、车载控制盘)
navigator.mediaSession.setActionHandler('play', playMusic)
navigator.mediaSession.setActionHandler('pause', pauseMusic)
navigator.mediaSession.setActionHandler('previoustrack', prevTrack)
navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(false))
```

* **支持的宿主系统**：
  * **iOS / iPadOS**：灵动岛微缩波形显示、锁屏全屏海报展示与控制；
  * **Windows 10/11**：任务栏浮动多媒体框、SMTC 系统音频控制器；
  * **macOS**：控制中心“正在播放”小组件。

---

#### 10.4.7 核心播放状态流转与避坑须知

| 场景 / 异常分支 | 表现现象 | 底层处理机制 |
| :--- | :--- | :--- |
| **浏览器自动播放拦截** | 抛出 `NotAllowedError`，音频未发声 | 不覆盖页面标题，在胶囊右侧挂载 `[🎵 启播]` 呼吸微标，用户点击任意处立即通过手势上下文激活播放。 |
| **音频流拉取死锁 / 超时** | 网络抖动，解密超过 30 秒卡住 | 内部维护 `fallbackTimer` 超时看门狗，30 秒未起播自动跳至下一首，杜绝播放器挂死。 |
| **单曲自然播完切歌** | 当前音频播放完毕触发 `@ended` | 严格判断播放模式：`loop` 则单曲倒回 `0s` 重播；`random` 则使用随机去重抽样算法换曲；`sequential` 顺序递增。 |
| **展开卡片周围元素下移** | 展开大岛时左右按钮被垂直顶下 | 顶栏外层采用 `items-start` 顶部基准线对齐，左右两端固定 `h-11`，大岛采用 `left: 50% + transform: translateX(-50%)`，仅沿纵向向下舒展，邻近元素固定。 |
| **展开变形产生方角棱角** | 药丸展开为大卡片时瞬间变为直角矩形 | 全状态锁定为 `position: absolute`，圆角半径从 `22px` 连续插值至 `36px`，全程基于 `cubic-bezier(0.34, 1.56, 0.64, 1)` 弹簧阻尼变形。 |
