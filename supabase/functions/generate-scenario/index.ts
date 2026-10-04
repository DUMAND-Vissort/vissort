// Edge Function generate-scenario
// Проксирует запросы к DeepSeek API. Обходит гео-блокировки.
// Принимает от клиента: { prompt, schema, temperature }
// Возвращает: { ok, data } или { ok: false, error }

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const ADMIN_EMAILS = ['dumand@gmail.com', 'eremeevap@gmail.com'];

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey'
            }
        });
    }

    if (req.method !== 'POST') {
        return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    // --- Pre-flight: env must be sane ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!supabaseUrl || !anonKey) {
        console.error('[generate-scenario] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
        return json({ ok: false, error: 'Server misconfigured' }, 500);
    }

    // --- Auth check ---
    let user: { id: string; email: string } | null = null;
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
        return json({ ok: false, error: 'Authorization required' }, 401);
    }
    if (token === anonKey) {
        return json({ ok: false, error: 'Anonymous access disabled' }, 403);
    }

    try {
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': 'Bearer ' + token,
                'apikey': anonKey
            }
        });
        if (!userRes.ok) {
            return json({ ok: false, error: 'Invalid token' }, 401);
        }
        const u = await userRes.json();
        if (!u || !u.id) {
            return json({ ok: false, error: 'Invalid user' }, 401);
        }
        if (!u.email || !ADMIN_EMAILS.includes(u.email)) {
            return json({ ok: false, error: 'Forbidden' }, 403);
        }
        user = { id: u.id, email: u.email };
    } catch (e) {
        console.error('[generate-scenario] auth check failed:', e);
        return json({ ok: false, error: 'Auth service unavailable' }, 503);
    }
    // --- /Auth check ---

    // --- Rate limit ---
    const AI_LIMIT_PER_HOUR = parseInt(Deno.env.get('AI_RATE_LIMIT_PER_HOUR') ?? '20', 10);
    const AI_WINDOW_SEC = parseInt(Deno.env.get('AI_RATE_LIMIT_WINDOW_SEC') ?? '3600', 10);

    try {
        const rlRes = await fetch(`${supabaseUrl}/rest/v1/rpc/check_ai_rate_limit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token,
                'apikey': anonKey
            },
            body: JSON.stringify({
                p_limit: AI_LIMIT_PER_HOUR,
                p_window_seconds: AI_WINDOW_SEC
            })
        });
        if (!rlRes.ok) {
            const t = await rlRes.text().catch(() => '');
            console.error('[generate-scenario] rate-limit rpc failed:', rlRes.status, t);
            return json({ ok: false, error: 'Rate limit check failed' }, 503);
        }
        const allowed = await rlRes.json();
        if (allowed !== true) {
            console.warn('[generate-scenario] rate limit exceeded for', user.email);
            return json({
                ok: false,
                error: `Rate limit exceeded: max ${AI_LIMIT_PER_HOUR} requests per hour`
            }, 429);
        }
    } catch (e) {
        console.error('[generate-scenario] rate-limit fetch error:', e);
        return json({ ok: false, error: 'Rate limit service unavailable' }, 503);
    }
    // --- /Rate limit ---

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) {
        return json({ ok: false, error: 'DEEPSEEK_API_KEY not configured' }, 500);
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return json({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    const { prompt, schema, temperature } = body;
    if (!prompt || typeof prompt !== 'string') {
        return json({ ok: false, error: 'prompt is required' }, 400);
    }
    if (prompt.length > 8000) {
        return json({ ok: false, error: 'prompt too long (max 8000 chars)' }, 400);
    }

    const messages = [
        {
            role: 'system',
            content: 'Ты — эксперт по тренировке зрения. Генерируешь сценарии в формате JSON. Всегда возвращаешь ТОЛЬКО валидный JSON без пояснений.'
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

    try {
        const res = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify(payload)
        });

        const text = await res.text();

        if (!res.ok) {
            console.error('[generate-scenario] DeepSeek error:', res.status, text);
            return json({ ok: false, error: 'DeepSeek ' + res.status, details: text.slice(0, 500) }, res.status);
        }

        let data;
        try { data = JSON.parse(text); } catch (_) {
            return json({ ok: false, error: 'Bad response from DeepSeek', raw: text.slice(0, 500) }, 502);
        }

        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            return json({ ok: false, error: 'Empty content' }, 502);
        }

        let parsed;
        try { parsed = JSON.parse(content); } catch (_) {
            const m = content.match(/\{[\s\S]*\}/) || content.match(/\[[\s\S]*\]/);
            if (!m) return json({ ok: false, error: 'Content is not JSON', raw: content.slice(0, 500) }, 502);
            try { parsed = JSON.parse(m[0]); } catch (_) {
                return json({ ok: false, error: 'Cannot parse JSON from content', raw: content.slice(0, 500) }, 502);
            }
        }

        return json({
            ok: true,
            data: parsed,
            usage: data.usage || null
        });
    } catch (e) {
        console.error('[generate-scenario] fetch error:', e);
        return json({ ok: false, error: 'Fetch failed: ' + String(e) }, 502);
    }
});

function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}