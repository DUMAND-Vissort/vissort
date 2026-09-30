// Sentry proxy — пересылает envelope от клиента в Sentry.
// Обходит гео-блокировку Sentry для российских IP.
// BUG-13 FIX + PATCH27b: accept text/plain (Sentry SDK avoids preflight), CORS on all responses.

const MAX_BODY_BYTES = 1_000_000; // 1 MB

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*'
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS });
    }

    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    // BUG-13: accept Sentry SDK's actual content-types.
    // Sentry JS SDK uses text/plain for tunnel requests to avoid CORS preflight.
    const contentType = (req.headers.get('Content-Type') || '').toLowerCase();
    const okType =
        contentType.includes('application/x-sentry-envelope') ||
        contentType.includes('text/plain') ||
        contentType === '';
    if (!okType) {
        return new Response('Bad content-type', { status: 415, headers: CORS });
    }

    // Optional secret (only if env var is set)
    const secretKey = Deno.env.get('SENTRY_TUNNEL_KEY');
    if (secretKey) {
        const url = new URL(req.url);
        const provided = url.searchParams.get('key') || '';
        if (provided !== secretKey) {
            return new Response('Forbidden', { status: 403, headers: CORS });
        }
    }

    const body = await req.text();
    if (body.length > MAX_BODY_BYTES) {
        return new Response('Payload too large', { status: 413, headers: CORS });
    }

    const SENTRY_URL = 'https://o4512152794038272.ingest.de.sentry.io/api/4512152834801744/envelope/';
    const url = new URL(req.url);
    url.searchParams.delete('key');
    const query = url.searchParams.toString();
    const target = query ? `${SENTRY_URL}?${query}` : SENTRY_URL;

    try {
        const res = await fetch(target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-sentry-envelope' },
            body
        });

        return new Response(await res.text(), {
            status: res.status,
            headers: { ...CORS, 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error('[sentry-proxy]', e);
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { ...CORS, 'Content-Type': 'application/json' }
        });
    }
});