// Sentry proxy — пересылает envelope от клиента в Sentry.
// Обходит гео-блокировку Sentry для российских IP.
// CORS whitelist, обязательный tunnel key, ограничение размера в байтах.

const MAX_BODY_BYTES = 1_000_000; // 1 MB

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
        'Access-Control-Allow-Headers': '*',
        Vary: 'Origin'
    };
}

Deno.serve(async (req) => {
    const cors = getCorsHeaders(req);

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors });
    }

    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: cors });
    }

    // Content-type whitelist (Sentry SDK uses text/plain to avoid preflight)
    const contentType = (req.headers.get('Content-Type') || '').toLowerCase();
    const okType =
        contentType.includes('application/x-sentry-envelope') ||
        contentType.includes('text/plain') ||
        contentType === '';
    if (!okType) {
        return new Response('Bad content-type', { status: 415, headers: cors });
    }

    // Tunnel key обязателен: без него любой может слать через прокси
    const secretKey = Deno.env.get('SENTRY_TUNNEL_KEY');
    if (!secretKey) {
        console.error('[sentry-proxy] SENTRY_TUNNEL_KEY is not configured');
        return new Response('Server misconfigured', { status: 500, headers: cors });
    }
    const url = new URL(req.url);
    const provided = url.searchParams.get('key') || '';
    if (provided !== secretKey) {
        return new Response('Forbidden', { status: 403, headers: cors });
    }

    const body = await req.text();
    // Размер в байтах — правильно для UTF-8
    const bodyBytes = new TextEncoder().encode(body).length;
    if (bodyBytes > MAX_BODY_BYTES) {
        return new Response('Payload too large', { status: 413, headers: cors });
    }

    const dsn = Deno.env.get('SENTRY_DSN');
    if (!dsn) {
        console.error('[sentry-proxy] SENTRY_DSN is not configured');
        return new Response('Server misconfigured', { status: 500, headers: cors });
    }
    // DSN: https://<key>@<host>/<project_id> → envelope endpoint
    const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
    if (!m) {
        console.error('[sentry-proxy] SENTRY_DSN format invalid');
        return new Response('Server misconfigured', { status: 500, headers: cors });
    }
    const target = `https://${m[2]}/api/${m[3]}/envelope/`;

    // Убираем key из query string перед отправкой в Sentry
    url.searchParams.delete('key');
    const query = url.searchParams.toString();
    const targetUrl = query ? `${target}?${query}` : target;

    try {
        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-sentry-envelope' },
            body
        });

        return new Response(await res.text(), {
            status: res.status,
            headers: { ...cors, 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error('[sentry-proxy]', e);
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { ...cors, 'Content-Type': 'application/json' }
        });
    }
});