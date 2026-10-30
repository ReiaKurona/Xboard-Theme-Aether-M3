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

**`dashboard.blade.php` 注入的变量**（官方主题写法，你照搬即可）：

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

#### 响应载荷 (Response)
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

#### 响应载荷 (注册即自动登入)
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
- **请求体 (Body)**：
  ```json
  {
    "email": "user@example.com",
    "password": "my_secure_password"
  }
  ```
- **响应**：同注册成功，返回 `auth_data` 与 `token`。

### 2.5 发送邮箱验证码
- **URL**: `POST /api/v1/passport/comm/sendEmailVerify`
- **请求体 (Body)**：
  ```json
  {
    "email": "user@example.com",
    "turnstile_token": "0.xxxx" // 开启验证码时需携带
  }
  ```
- **说明**：同一邮箱 60 秒内只能下发一次；验证码 5 分钟有效；成功返回 `{"data": true}`。

### 2.6 忘记密码重置
- **URL**: `POST /api/v1/passport/auth/forget`
- **请求体 (Body)**：
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
- **响应载荷 (Response)**：
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
- **响应载荷 (Response)**：
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
- **响应数据格式**：**注意返回的是数字位置数组，非对象！**
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
- **请求体 (Body)**：
  ```json
  {
    "remind_expire": 1, // 0 或 1
    "remind_traffic": 0 // 0 或 1
  }
  ```
- **响应**: `{"data": true}`。

### 3.6 修改安全密码
- **URL**: `POST /api/v1/user/changePassword`
- **请求体 (Body)**：
  ```json
  {
    "old_password": "current_password",
    "new_password": "new_password_8chars"
  }
  ```
- **副作用**：成功后，后端会作废本设备以外该用户的所有其他登录会话（Sanctum Tokens）。

### 3.7 重置订阅与密钥防泄露
- **URL**: `GET /api/v1/user/resetSecurity`
- **响应**:
  ```json
  {
    "status": "success",
    "data": "https://sub.domain.com/api/v1/client/subscribe?token=new_token..."
  }
  ```
- **作用**：重新生成用户的 `uuid` 和订阅 `token`，旧的订阅链接瞬间作废。必须配合前端二次确认弹窗使用。

### 3.8 佣金划转至账户主余额
- **URL**: `POST /api/v1/user/transfer`
- **请求体 (Body)**：
  ```json
  {
    "transfer_amount": 1000 // 整数，单位：分 (必须 >= 1 且 <= commission_balance)
  }
  ```
- **响应**: 成功后佣金减少、账户余额等额增加，返回 `{"data": true}`。

### 3.9 活跃会话管理与远程设备下线
- **拉取活动设备**: `GET /api/v1/user/getActiveSession`
  - 返回 Sanctum `personal_access_tokens` 列表：
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
- **响应载荷 (Response)**：
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
- **返回套餐实体 (Array)**：
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
- **请求体 (Body)**：
  ```json
  {
    "code": "PROMO2026",
    "plan_id": 1,
    "period": "month_price" // 必须使用旧版周期键名
  }
  ```
- **成功响应**:
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
- **请求体 (Body)**：
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
- **返回列表 (Array)**：
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
- **请求体 (Body)**：
  ```json
  {
    "trade_no": "2026102716103214557019832",
    "method": 1,     // 支付方式 ID
    "token": null    // Stripe 支付时由前端生成的付款 token
  }
  ```
- **多态响应结构**：
  ```json
  {
    "type": 1,
    "data": "https://upnp.rka.jp/submit.php?money=..."
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
- **返回节点对象结构 (Array)**：
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
- **列表返回值结构**：按分类名作为 Key 的字典映射：
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
- **返回结构**: 在详情对象中增加 `message` 数组：
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
- **请求体 (Body)**：
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
- **请求体 (Body)**：
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
- **响应载荷 (Response)**：
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
- **返回条目字段**:
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
- **响应载荷 (Response)**：
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
- **响应载荷**:
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

