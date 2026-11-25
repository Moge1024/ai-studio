# 每日用量汇总（UTC 2026-11-25）

> 由 .github/workflows/daily-usage-summary.yml 每天自动生成；查不到的项如实写“未接入”，不编造数字。

- Supabase `tasks` 表行数：0
- Supabase `usage_ledger` 表行数：0
- Supabase `file_records` 表行数：0

## 需人工/控制台查看的用量

- OpenRouter：免费档每天 50 次上限，看控制台用量页：https://openrouter.ai/activity
- Cloudflare Workers：每天 10 万次请求上限，看 Workers 指标页（Cloudflare 控制台 → Workers & Pages → gateway）
- Simular Box：免费测试已结束，$5 额度（约 50 小时，90 天有效），连续睡满 14 天会被删，看 Simular Box 控制台剩余额度
- Cloady：看 Cloady 控制台应用状态（keepalive 每天已 ping，见 cloady-keepalive 运行记录）
- Supabase 免费档：数据库 500MB、Storage 1GB 上限，看 Supabase 项目 Settings → Usage

## 定时任务运行记录

- supabase-keepalive：每天 UTC 01:00，见 Actions 页运行记录
- cloady-keepalive：每天 UTC 01:30，见 Actions 页运行记录

生成时间（UTC）：2026-11-25T10:51:09Z
