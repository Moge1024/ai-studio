# Supabase 设置清单

建好 Supabase 免费项目后，按这张清单把连接信息记下来（只记在本地或 GitHub Secrets 里，**不要**写进仓库、不要发给别人）。

## 建项目后要填的连接信息

| 项目 | 去哪找 | 填到哪里 |
|---|---|---|
| Project URL（`SUPABASE_URL`） | 项目 → Settings → API → Project URL，形如 `https://xxxxx.supabase.co` | GitHub Secrets `SUPABASE_URL` |
| anon public key（`SUPABASE_ANON_KEY`） | 项目 → Settings → API → Project API keys → `anon` `public` | GitHub Secrets `SUPABASE_ANON_KEY` |
| service_role key | 项目 → Settings → API → Project API keys → `service_role` `secret` | **只放服务端/本地**，绝不放前端、不进仓库（泄露可读写全库） |
| 数据库连接串（Postgres） | 项目 → Settings → Database → Connection string → URI，形如 `postgresql://postgres:[密码]@db.xxxxx.supabase.co:5432/postgres` | 本地脚本 / 备份工具用；密码是建项目时设的数据库密码 |
| Storage bucket 名 | 项目 → Storage → New bucket，建议名：`files`（公开/私有按需选，默认私有） | 记在这里：`files`（建好后把实际名字填上）；`file_records.storage_path` 存的就是这个 bucket 里的路径 |

建表步骤：项目 → SQL Editor → New query → 粘贴 `supabase/schema.sql` 全部内容 → Run。跑完去 Table Editor 确认三张表 `tasks`、`usage_ledger`、`file_records` 都在。

## 免费档注意事项

- **数据库 500MB 上限**：`usage_ledger` 是只增不减的台账，行数涨得快；定期归档或清理旧行，别等满了再处理。
- **7 天无活动自动暂停**：免费项目 7 天没有任何数据库活动会被自动暂停，暂停后要手动去控制台 Resume。仓库里 `supabase-keepalive.yml` 每天发两条轻量查询保活，但如果 Action 连续失败、或 Secrets 配错，保活就失效——每周看一眼 Actions 运行记录是否为绿。
- **每周导出备份**：免费档不保证备份恢复。建议每周一次：Table Editor → 每张表 Export CSV，或用数据库连接串 `pg_dump` 全库导出，备份文件存本地/云盘，不要存进公开仓库。
- **Storage 免费 1GB**：文件本体放 Storage，元数据放 `file_records` 表；不要用 Cloudflare R2（已砍掉）。大文件/视频别往里塞，1GB 很容易满。
- **RLS**：见 `schema.sql` 末尾注释。起步推荐“仅服务端访问”：RLS 开启、不给 anon 写 policy，前端一律走 Workers 网关；需要 anon 直接读时再按注释建只读 policy。
- **service_role key 绝不放前端**：前端只用 `anon` key；一旦怀疑泄露，立即去 Settings → API 里轮换该 key，并检查表里有无异常写入。
