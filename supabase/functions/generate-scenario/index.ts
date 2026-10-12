// Edge Function generate-scenario
// Проксирует запросы к DeepSeek API. Обходит гео-блокировки.
// Принимает от клиента: { prompt, schema, temperature }
// Возвращает: { ok, data } или { ok: false, error }

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_TIMEOUT_MS = 60000;
const DEEPSEEK_RETRY_DELAY_MS = 1500;
const PROMPT_MAX_LEN = 8000;

function getCorsHeaders(req: Request): Record<string, string> {
    const allowed = (Deno.env.get('ALLOWED_ORIGINS') || 'https://vissort.com,http://localhost:5500,http://127.0.0.1:5500')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const origin = req.headers.get('Origin') || '';
    const allow = allowed.includes(origin) ? origin : allowed[0] || 'https://vissort.com';
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
        Vary: 'Origin'
    };
}

function json(obj: unknown, status = 200, req?: Request) {
    const cors = req ? getCorsHeaders(req) : { 'Access-Control-Allow-Origin': 'https://vissort.com' };
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors }
    });
}

function getAdminEmails(): string[] {
    const raw = Deno.env.get('AI_ADMIN_EMAILS') || 'dumand@gmail.com';
    return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

async function reportToSentry(message: string, context: Record<string, unknown> = {}) {
    const dsn = Deno.env.get('SENTRY_DSN');
    if (!dsn) return;
    try {
        // DSN format: https://<key>@<host>/<project_id>
        const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
        if (!m) return;
        const [, key, host, projectId] = m;
        const eventId = crypto.randomUUID().replace(/-/g, '');
        const envelope =
            JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }) +
            '\n' +
            JSON.stringify({ type: 'event' }) +
            '\n' +
            JSON.stringify({
                event_id: eventId,
                timestamp: Date.now() / 1000,
                level: 'error',
                logger: 'generate-scenario',
                message,
                extra: context,
                environment: Deno.env.get('DENO_ENV') || 'production'
            });
        await fetch(`https://${host}/api/${projectId}/envelope/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': `Sentry sentry_key=${key}, sentry_version=7, sentry_client=deno-edge/1.0` },
            body: envelope
        });
    } catch (_) {
        // ignore sentry errors
    }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
        clearTimeout(tid);
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: getCorsHeaders(req) });
    }

    if (req.method !== 'POST') {
        return json({ ok: false, error: 'Method not allowed' }, 405, req);
    }

    // --- Pre-flight: env must be sane ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!supabaseUrl || !anonKey) {
        console.error('[generate-scenario] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
        return json({ ok: false, error: 'Server misconfigured' }, 500, req);
    }

    // --- Auth check ---
    let user: { id: string; email: string } | null = null;
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
        return json({ ok: false, error: 'Authorization required' }, 401, req);
    }
    if (token === anonKey) {
        return json({ ok: false, error: 'Anonymous access disabled' }, 403, req);
    }

    try {
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { Authorization: 'Bearer ' + token, apikey: anonKey }
        });
        if (!userRes.ok) {
            return json({ ok: false, error: 'Invalid token' }, 401, req);
        }
        const u = await userRes.json();
        if (!u || !u.id) {
            return json({ ok: false, error: 'Invalid user' }, 401, req);
        }
        const admins = getAdminEmails();
        if (!u.email || !admins.includes(String(u.email).toLowerCase())) {
            return json({ ok: false, error: 'Forbidden' }, 403, req);
        }
        user = { id: u.id, email: u.email };
    } catch (e) {
        console.error('[generate-scenario] auth check failed:', e);
        await reportToSentry('auth check failed', { error: String(e) });
        return json({ ok: false, error: 'Auth service unavailable' }, 503, req);
    }

    // --- Rate limit ---
    const AI_LIMIT_PER_HOUR = parseInt(Deno.env.get('AI_RATE_LIMIT_PER_HOUR') ?? '20', 10);
    const AI_WINDOW_SEC = parseInt(Deno.env.get('AI_RATE_LIMIT_WINDOW_SEC') ?? '3600', 10);

    try {
        const rlRes = await fetch(`${supabaseUrl}/rest/v1/rpc/check_ai_rate_limit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token,
                apikey: anonKey
            },
            body: JSON.stringify({ p_limit: AI_LIMIT_PER_HOUR, p_window_seconds: AI_WINDOW_SEC })
        });
        if (!rlRes.ok) {
            const t = await rlRes.text().catch(() => '');
            console.error('[generate-scenario] rate-limit rpc failed:', rlRes.status, t);
            return json({ ok: false, error: 'Rate limit check failed' }, 503, req);
        }
        const allowed = await rlRes.json();
        if (allowed !== true) {
            console.warn('[generate-scenario] rate limit exceeded for', user.email);
            return json({ ok: false, error: `Rate limit exceeded: max ${AI_LIMIT_PER_HOUR} requests per hour` }, 429, req);
        }
    } catch (e) {
        console.error('[generate-scenario] rate-limit fetch error:', e);
        await reportToSentry('rate-limit fetch error', { error: String(e) });
        return json({ ok: false, error: 'Rate limit service unavailable' }, 503, req);
    }

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) {
        return json({ ok: false, error: 'DEEPSEEK_API_KEY not configured' }, 500, req);
    }

    let body: { prompt?: string; schema?: unknown; temperature?: number };
    try {
        body = await req.json();
    } catch (_) {
        return json({ ok: false, error: 'Invalid JSON body' }, 400, req);
    }

    const { prompt, schema, temperature } = body;
    if (!prompt || typeof prompt !== 'string') {
        return json({ ok: false, error: 'prompt is required' }, 400, req);
    }
    if (prompt.length > PROMPT_MAX_LEN) {
        return json({ ok: false, error: `prompt too long (max ${PROMPT_MAX_LEN} chars)` }, 400, req);
    }

    const messages = [
        {
            role: 'system',
            content:
                'Ты — эксперт по тренировке зрения. Генерируешь сценарии в формате JSON. Всегда возвращаешь ТОЛЬКО валидный JSON без пояснений.'
        },
        { role: 'user', content: prompt }
    ];

    const payload: Record<string, unknown> = {
        model: 'deepseek-chat',
        messages,
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        stream: false
    };

    if (schema && typeof schema === 'object') {
        payload.response_format = { type: 'json_object' };
    }

    // --- DeepSeek fetch с retry на 429/5xx ---
    let dsRes: Response | null = null;
    let lastErrText = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            dsRes = await fetchWithTimeout(
                DEEPSEEK_URL,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
                    body: JSON.stringify(payload)
                },
                DEEPSEEK_TIMEOUT_MS
            );
        } catch (e) {
            console.error('[generate-scenario] DeepSeek fetch failed (attempt ' + (attempt + 1) + '):', e);
            lastErrText = String(e);
            dsRes = null;
            if (attempt === 0) {
                await new Promise((r) => setTimeout(r, DEEPSEEK_RETRY_DELAY_MS));
                continue;
            }
            await reportToSentry('DeepSeek fetch failed', { error: lastErrText, attempt });
            return json({ ok: false, error: 'DeepSeek unavailable' }, 502, req);
        }

        if (dsRes.ok) break;

        // Retry только для 429 и 5xx
        const shouldRetry = dsRes.status === 429 || (dsRes.status >= 500 && dsRes.status < 600);
        if (attempt === 0 && shouldRetry) {
            console.warn('[generate-scenario] DeepSeek ' + dsRes.status + ', retrying...');
            await new Promise((r) => setTimeout(r, DEEPSEEK_RETRY_DELAY_MS));
            continue;
        }
        break;
    }

    if (!dsRes) {
        return json({ ok: false, error: 'DeepSeek unavailable' }, 502, req);
    }

    const text = await dsRes.text();

    if (!dsRes.ok) {
        console.error('[generate-scenario] DeepSeek error:', dsRes.status, text.slice(0, 500));
        await reportToSentry('DeepSeek error', { status: dsRes.status });
        return json({ ok: false, error: 'DeepSeek ' + dsRes.status }, dsRes.status, req);
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
        data = JSON.parse(text);
    } catch (_) {
        await reportToSentry('Bad DeepSeek response', { status: dsRes.status });
        return json({ ok: false, error: 'Bad response from DeepSeek' }, 502, req);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        return json({ ok: false, error: 'Empty content' }, 502, req);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch (_) {
        const m = content.match(/\{[\s\S]*\}/) || content.match(/\[[\s\S]*\]/);
        if (!m) return json({ ok: false, error: 'Content is not JSON' }, 502, req);
        try {
            parsed = JSON.parse(m[0]);
        } catch (_) {
            return json({ ok: false, error: 'Cannot parse JSON from content' }, 502, req);
        }
    }

    return json({ ok: true, data: parsed }, 200, req);
});