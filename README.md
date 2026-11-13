# 免费 AI 工作室

零花费搭建的个人 AI 工作室：云电脑 + API 网关 + 免费模型 + 免费数据库/存储 + 定时任务，全部用免费档跑起来，不充值、不用真实手机号。

> 本仓库只有配置文件与代码，不含任何真实密钥。所有密钥、API Key 一律用占位符，部署时再填。

## 架构（文字版）

```
                        ┌──────────────────────────────┐
                        │  Sakupa 静态站（前端页面）      │
                        │  纯静态 HTML/JS，调网关接口      │
                        └──────────────┬───────────────┘
                                       │ HTTPS + x-gateway-secret
                                       ▼
┌────────────────┐   ┌───────────────────────────────────┐
│ Simular Box    │   │  Cloudflare Workers API 网关       │
│ MCP 云电脑      │   │  workers/gateway/src/index.js      │
│ (moge1024@gmail│   │  · 校验共享密钥，缺失/错误 → 403    │
│  .com，免费套餐 │   │  · 每天最多转发 50 次，超了 → 429   │
│  1,000 credits │   │  · 转发到 OpenRouter                │
│  /天，盒子 main)│   └───────────────┬───────────────────┘
│  · 跑脚本/任务  │                   │ Authorization: Bearer OPENROUTER_API_KEY
│  · 通过 MCP 被  │                   ▼
│    Muse 调用   │   ┌───────────────────────────────────┐
└───────┬────────┘   │  OpenRouter 模型 API               │
        │            │  免费档：每天 50 次请求，不充值      │
        │            │  默认模型：FREE_MODEL 环境变量，     │
        │            │  未配时走 openrouter/free 路由       │
        └────────────┴───────────────────────────────────┘
        │
        │ 读写数据 / 存文件
        ▼
┌───────────────────────────────────────────────────────┐
│  Supabase（免费档）                                     │
│  · Postgres：tasks / usage_ledger / file_records        │
│    （建表见 supabase/schema.sql）                       │
│  · Storage：文件存这里（免费 1GB），不用 Cloudflare R2   │
│  · 注意：500MB 数据库上限；7 天无活动自动暂停            │
└───────────────────────────────────────────────────────┘

        ┌─────────────────────────────────────────────┐
        │  GitHub Actions 定时任务（本仓库 .github/     │
        │  workflows/，全部免费额度内跑）                │
        │  · supabase-keepalive：每天 ping Supabase 防暂停│
        │  · cloady-keepalive：每天 ping Cloady 应用防暂停 │
        │  · daily-usage-summary：每天汇总各服务用量      │
        └─────────────────────────────────────────────┘

        ┌─────────────────────────────────────────────┐
        │  Colab 人工 GPU（暂缓）                        │
        │  需要 GPU 跑重活时，人工打开 Colab 手动跑，     │
        │  不进自动流程；Kaggle GPU（30h/周）同样暂缓。   │
        └─────────────────────────────────────────────┘
```

数据流一句话：前端 / 云电脑 → Workers 网关（鉴权+限流）→ OpenRouter（免费模型）；任务、用量、文件元数据 → Supabase；定时任务 → GitHub Actions。

## 各服务免费额度一览

| 服务 | 免费额度 | 关键限制 | 本工作室用途 |
|---|---|---|---|
| Simular Box | 1,000 credits/天 | 免费套餐 | MCP 云电脑，跑脚本/任务（盒子 main） |
| Instabox | 1 台免费沙箱：4 vCPU / 8GB 内存 / 20GB 磁盘 | 闲置 30 分钟自动暂停；单次最长运行 2 小时；无专属入站 IPv4，只能走其 HTTPS/SSH 网关对外访问；免费档官方表述为“free until we figure it out” | 主力云电脑（机器 ai-studio，Running），突发任务用，不适合 24 小时常驻服务 |
| Cloudflare Workers | 每天 10 万次请求 | 每次调用 CPU 只有 10ms，逻辑必须轻量 | API 网关（鉴权+限流+转发） |
| OpenRouter | 每天 50 次请求 | 免费模型 only，不充值 | 模型 API，网关每天最多转发 50 次与之对齐 |
| Supabase | 数据库 500MB；Storage 1GB | 7 天无活动自动暂停；注意不要把 service_role key 放前端 | Postgres 三张表 + 文件存储 |
| GitHub Actions | 公开仓库每月 2,000 分钟 | 定时任务最短间隔 5 分钟，cron 用 UTC | 三个 keepalive / 汇总任务 |
| Cloady | 免费档（以官网当时为准） | 7 天闲置暂停 | 部署应用，靠 keepalive 保活 |
| Kaggle | GPU 30h/周 | 手机未验证，暂缓 | 暂缓，人工 GPU 备选 |
| Colab | 免费 GPU（以官网当时为准） | 需人工打开 | 人工 GPU，暂缓进自动流程 |
| Sakupa | 静态托管免费档 | 纯静态 | 前端静态站 |

> 额度以各服务官网当时公布的为准，免费档政策可能调整，部署前复核一次。

## 进展（2026-11-09 15:00，部署进行中）

- 已到手：Instabox（机器 ai-studio，Running）、GitHub（原有账号 Moge1024，公开仓库已建）、Supabase（项目 ai-studio-db，Healthy，美国东部，Storage 私有桶 files 已建）、OpenRouter（Key 名 ai-studio-v2，限额 $0、永不过期）。
- 注意：OpenRouter 注册引导提过新账号有 $100 credits，但后台实际显示剩余 $0.00，以实际显示为准，只走免费模型；两把 Key 的完整值都没能取回，部署网关时需新建一把并在弹窗里当场抄下完整值再填（免费重建即可）。
- 进行中：Cloudflare 注册（正在读 Gmail 验证邮件）。待办：Cloady 注册、Simular Box MCP 授权。

## 部署顺序

1. **GitHub**：新建公开仓库，把本仓库全部文件推上去（先在仓库 Settings → Secrets and variables → Actions 里把密钥清单里的 Secrets 填好，见下）。
2. **Supabase**：新建项目（免费档）→ 在 SQL Editor 里执行 `supabase/schema.sql` 建三张表 → 按 `supabase/README.md` 的清单记下连接信息、建 Storage bucket、按需开 RLS → 把 `SUPABASE_URL` / `SUPABASE_ANON_KEY` 填进 GitHub Secrets。
3. **OpenRouter**：注册账号 → 取 API Key → 填进 Cloudflare Workers 的 Secret `OPENROUTER_API_KEY`（只用免费模型，不充值）。
4. **Cloudflare Workers**：`cd workers/gateway` → `npx wrangler login` → `npx wrangler secret put OPENROUTER_API_KEY`、`npx wrangler secret put GATEWAY_SECRET` → `npx wrangler deploy`。可选：绑定一个 KV namespace 做跨实例的每日限流计数（见 `workers/gateway/src/index.js` 顶部注释）。
5. **Cloady**：部署应用 → 把应用地址填进 GitHub Secrets `CLOADY_APP_URL`。
6. **Simular Box**：已有账号（moge1024@gmail.com，盒子 main），MCP 接入后即可调用云电脑。
7. **Sakupa**：静态站部署前端页面，接口地址指向 Workers 网关域名，请求头带 `x-gateway-secret`。
8. **验证**：依次跑通——网关 403（无密钥）→ 网关正常转发一次 → Supabase keepalive Action 变绿 → Cloady keepalive 变绿 → 用量汇总产出。

## 密钥清单（只列密钥名和去哪取，不写值）

| 密钥名 | 放哪里 | 去哪取 |
|---|---|---|
| `SUPABASE_URL` | GitHub Secrets | Supabase 项目 → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | GitHub Secrets | Supabase 项目 → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | 只放服务端/本地，绝不放前端、不进仓库 | Supabase 项目 → Settings → API → service_role key（泄露可读写全库，保管好） |
| `OPENROUTER_API_KEY` | Cloudflare Workers Secret（`wrangler secret put`） | OpenRouter 官网 → Keys 页面新建 |
| `GATEWAY_SECRET` | Cloudflare Workers Secret + 调用方请求头 | 自己编一个长随机字符串，两边填同一个值 |
| `CLOADY_APP_URL` | GitHub Secrets | Cloady 控制台里已部署应用的访问地址 |
| `FREE_MODEL` | Cloudflare Workers 环境变量（wrangler.toml 的 `[vars]`，非敏感可明文） | 填 OpenRouter 上的免费模型名；不填则走 `openrouter/free` 路由 |

补充说明：
- GitHub Secrets 入口：仓库 → Settings → Secrets and variables → Actions → New repository secret。
- `.env`、密钥文件一律不进仓库（见 `.gitignore`）。
- `GATEWAY_SECRET` 未设置时网关直接 403（fail-closed），不会放行任何请求。
- Supabase `service_role` key 权限极大，只在服务端脚本里用，前端只用 `anon` key，并按需开 RLS（见 `supabase/schema.sql` 注释）。

## 仓库结构

```
.
├── README.md                              # 本文件
├── .gitignore
├── .github/workflows/
│   ├── supabase-keepalive.yml             # 每天 ping Supabase 防 7 天暂停
│   ├── cloady-keepalive.yml               # 每天 ping Cloady 应用防暂停
│   └── daily-usage-summary.yml            # 每天汇总各服务用量
├── workers/gateway/
│   ├── wrangler.toml                       # Workers 项目配置
│   └── src/index.js                        # API 网关：鉴权 + 限流 + 转发 OpenRouter
└── supabase/
    ├── schema.sql                          # 三张表：tasks / usage_ledger / file_records
    └── README.md                           # 建项目后要填的连接信息清单
```

## 定时任务时间（UTC）

| 任务 | cron（UTC） | 北京时间 |
|---|---|---|
| supabase-keepalive | `0 1 * * *` | 每天 09:00 |
| cloady-keepalive | `30 1 * * *` | 每天 09:30 |
| daily-usage-summary | `0 2 * * *` | 每天 10:00 |

三个任务错开半小时，避免同时打 Supabase。注意 GitHub Actions 的 cron 是 UTC 时间，且免费档定时任务可能有几分钟延迟，属正常现象。
