-- AI 工作室 Supabase 建表脚本
-- 用法：Supabase 项目 → SQL Editor → 粘贴本文件全部内容 → Run。
-- 免费档注意：数据库上限 500MB；7 天无活动自动暂停（靠 GitHub Actions keepalive 保活）；
-- 每周导出备份一次（见 supabase/README.md）。

-- ============================================================
-- 1) tasks：任务表
-- ============================================================
create table if not exists public.tasks (
id uuid primary key default gen_random_uuid(),
title text not null,
status text not null default 'pending',
-- 约定状态值（应用层约束，本表不做 check，方便以后扩展）：
-- 'pending' 待办 / 'running' 进行中 / 'done' 完成 / 'failed' 失败
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
meta jsonb not null default '{}'::jsonb
);

-- updated_at 自动维护：每次 UPDATE 时刷新为 now()
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
new.updated_at = now();
return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_created_at_idx on public.tasks (created_at desc);

-- ============================================================
-- 2) usage_ledger：用量台账
-- 每行 = 某个服务在某个时间点的一条用量记录
-- 例：service='openrouter', metric='requests', amount=12
-- ============================================================
create table if not exists public.usage_ledger (
id uuid primary key default gen_random_uuid(),
service text not null, -- 如 openrouter / workers / simular / supabase / cloady
metric text not null, -- 如 requests / credits / rows / bytes
amount numeric not null default 0,
recorded_at timestamptz not null default now()
);

create index if not exists usage_ledger_service_recorded_idx
on public.usage_ledger (service, recorded_at desc);

-- ============================================================
-- 3) file_records：文件元数据表
-- 文件本体存在 Supabase Storage（免费 1GB），这里只存元数据，
-- 不用 Cloudflare R2。
-- ============================================================
create table if not exists public.file_records (
id uuid primary key default gen_random_uuid(),
filename text not null,
storage_path text not null, -- Storage 里的路径，如 uploads/2026-11-09/xxx.png
size_bytes bigint not null default 0,
created_at timestamptz not null default now()
);

create index if not exists file_records_created_at_idx
on public.file_records (created_at desc);

-- ============================================================
-- RLS（行级安全）说明 —— 重要，部署时在控制台按需开启
-- ============================================================
-- 本脚本故意在这里强制开启 RLS、也不写死 policy，原因：
-- 1. anon key + RLS 全开后，未写 policy 的表默认拒绝一切访问，
-- keepalive 用的 anon key 查询会直接失败；
-- 2. policy 取决于调用场景（公开读 / 仅登录用户 / 仅服务端），应由部署时按需定。
--
-- 部署时建议做法（二选一）：
-- A. 仅服务端访问（推荐起步）：保持 RLS 开启，只给 service_role key 用，
-- 前端一律走 Cloudflare Workers 网关，不直接连 Supabase。
-- alter table public.tasks enable row level security;
-- （不建任何 anon policy；service_role 默认绕过 RLS。）
-- B. 需要 anon key 直接读（如 keepalive 查询）：
-- 先 enable RLS，再给每张表建一条只读 policy，例如：
-- create policy "anon read tasks" on public.tasks
-- for select to anon using (true);
-- 写操作一律不给 anon，只允许 service_role（或 authenticated + 严格条件）。
--
-- 无论哪种：service_role key 绝不放前端、不进仓库、不进公开代码。
-- 泄露后立即去 Supabase 项目 Settings → API 里轮换（Reset）该 key。
