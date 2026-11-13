/**
 * AI 工作室 API 网关（Cloudflare Workers）
 *
 * 职责：校验共享密钥 → 每日限流 50 次 → 转发到 OpenRouter。
 *
 * 设计约束：
 * - Workers 每次调用 CPU 只有 10ms：逻辑保持轻量，不做重解析、不做重试。
 * - fail-closed：GATEWAY_SECRET 未配置，或请求头密钥缺失/错误，一律 403，不放行。
 * - 限流与 OpenRouter 免费档（每天 50 次）对齐，超了返回 429，不再转发。
 * - 所有错误返回规范 JSON：{ "error": { "code": "...", "message": "..." } }。
 *
 * 环境变量（Secrets，用 `wrangler secret put` 设置，不要写进仓库）：
 * - GATEWAY_SECRET       共享密钥；调用方在请求头 x-gateway-secret 里带同一个值。
 * - OPENROUTER_API_KEY   OpenRouter API Key。
 * - FREE_MODEL           可选：默认免费模型名；不填则走 "openrouter/free" 路由。
 *
 * 可选 KV 绑定（推荐，见 wrangler.toml）：
 * - RATE_LIMIT_KV：绑定后每日计数在所有实例间共享；不绑定时本函数退化为
 *   “放行并依赖 OpenRouter 自身的免费 50 次/天上限”，网关不再硬拦。
 *   （Workers 实例间内存不共享，进程内计数器不可靠，故不用内存计数。）
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DAILY_LIMIT = 50; // 与 OpenRouter 免费档每天 50 次对齐
const FALLBACK_MODEL = "openrouter/free";

export default {
  async fetch(request, env) {
    try {
      // 只接受 POST，其余方法直接 405（轻量前置检查，不耗 CPU）
      if (request.method !== "POST") {
        return jsonError(405, "method_not_allowed", "Only POST is allowed.");
      }

      // --- 1) 校验共享密钥（fail-closed）---
      // GATEWAY_SECRET 未配置 = 配置错误，拒绝一切请求，不放行。
      const secret = env.GATEWAY_SECRET;
      const provided = request.headers.get("x-gateway-secret");
      if (!secret || !provided || provided !== secret) {
        return jsonError(403, "forbidden", "Invalid or missing gateway secret.");
      }

      // --- 2) 每日限流 50 次（KV 计数；未绑定 KV 时放行，靠 OpenRouter 自身上限兜底）---
      const kv = env.RATE_LIMIT_KV;
      if (kv) {
        const today = new Date().toISOString().slice(0, 10); // UTC 日期 YYYY-MM-DD
        const key = `rl:${today}`;
        const current = parseInt((await kv.get(key)) || "0", 10) || 0;
        if (current >= DAILY_LIMIT) {
          return jsonError(429, "rate_limited", `Daily limit of ${DAILY_LIMIT} requests reached. Try again tomorrow.`);
        }
        // 先占位再转发：计数+1，24 小时后过期（86400 秒）。即使转发失败也计一次，
        // 避免失败重试绕过限流；失败重试由调用方明天再试。
        await kv.put(key, String(current + 1), { expirationTtl: 86400 });
      }

      // --- 3) 读请求体（只做一次 JSON 解析；解析失败返回 400）---
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonError(400, "invalid_json", "Request body must be valid JSON.");
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return jsonError(400, "invalid_body", "Request body must be a JSON object.");
      }

      // 模型默认用免费模型：客户端没传 model 时用 FREE_MODEL，未配则走 openrouter/free 路由。
      // 客户端传了 model 则原样透传（只用免费模型的约定由调用方遵守）。
      const model = body.model || env.FREE_MODEL || FALLBACK_MODEL;
      const upstreamBody = { ...body, model };

      // --- 4) 转发到 OpenRouter（单次 fetch，不重试）---
      const upstream = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          // OpenRouter 建议带的标识头，缺失也不影响调用；有就带上。
          "HTTP-Referer": "https://ai-studio.local",
          "X-Title": "AI Studio Gateway",
        },
        body: JSON.stringify(upstreamBody),
      });

      // 上游返回什么状态码就原样透传什么状态码，正文原样透传（流式也一样透传）。
      // 注意：这里不解析上游 JSON，避免流式响应被破坏，也不额外耗 CPU。
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
      });
    } catch (err) {
      // 兜底：任何未预料的异常都返回规范 JSON 500，不泄露内部细节。
      return jsonError(500, "internal_error", "Gateway failed to process the request.");
    }
  },
};

/** 返回规范 JSON 错误：{ "error": { "code", "message" } } */
function jsonError(status, code, message) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
