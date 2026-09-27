// Sentry proxy — пересылает envelope от клиента в Sentry.
// Обходит гео-блокировку Sentry для российских IP.
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': '*'
            }
        });
    }

    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    const SENTRY_URL = 'https://o4512152794038272.ingest.de.sentry.io/api/4512152834801744/envelope/';

    const url = new URL(req.url);
    const query = url.searchParams.toString();
    const target = query ? `${SENTRY_URL}?${query}` : SENTRY_URL;

    const body = await req.text();

    try {
        const res = await fetch(target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-sentry-envelope' },
            body
        });

        return new Response(await res.text(), {
            status: res.status,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            }
        });
    } catch (e) {
        console.error('[sentry-proxy]', e);
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
    }
});