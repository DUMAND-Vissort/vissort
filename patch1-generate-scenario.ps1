# patch1-generate-scenario.ps1
# Adds auth check to Edge Function generate-scenario.

$ErrorActionPreference = "Stop"

$path = "supabase\functions\generate-scenario\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    Write-Host "Make sure you are in the project root" -ForegroundColor Yellow
    exit 1
}

$raw = [System.IO.File]::ReadAllText((Resolve-Path $path))
$useCRLF = $raw.Contains("`r`n")

# --- Replacement 1: CORS headers ---
$old1 = "'Access-Control-Allow-Headers': 'Content-Type, Authorization'"
$new1 = "'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey'"

if (-not $raw.Contains($old1)) {
    Write-Host "ERROR 1.1: CORS block not found" -ForegroundColor Red
    exit 1
}
$raw = $raw.Replace($old1, $new1)
Write-Host "OK 1.1: CORS updated" -ForegroundColor Green

# --- Replacement 2: insert auth check ---
$old2 = "    if (req.method !== 'POST') {`r`n        return json({ ok: false, error: 'Method not allowed' }, 405);`r`n    }`r`n`r`n    const apiKey = Deno.env.get('DEEPSEEK_API_KEY');"
if (-not $useCRLF) {
    $old2 = $old2 -replace "`r`n", "`n"
}

$authBlock = @'
    // --- Auth check ---
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    if (!token) {
        return json({ ok: false, error: 'Authorization required' }, 401);
    }
    if (token === anonKey) {
        return json({ ok: false, error: 'Anonymous access disabled' }, 403);
    }

    try {
        const userRes = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/auth/v1/user`,
            {
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'apikey': anonKey
                }
            }
        );
        if (!userRes.ok) {
            return json({ ok: false, error: 'Invalid token' }, 401);
        }
        const user = await userRes.json();
        if (!user || !user.id) {
            return json({ ok: false, error: 'Invalid user' }, 401);
        }
        const ADMIN_EMAILS = ['dumand@gmail.com', 'eremeevap@gmail.com'];
        if (user.email && !ADMIN_EMAILS.includes(user.email)) {
            return json({ ok: false, error: 'Forbidden' }, 403);
        }
    } catch (e) {
        console.error('[generate-scenario] auth check failed:', e);
        return json({ ok: false, error: 'Auth service unavailable' }, 503);
    }
    // --- /Auth check ---

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
'@

if ($useCRLF) {
    $new2 = "    if (req.method !== 'POST') {`r`n        return json({ ok: false, error: 'Method not allowed' }, 405);`r`n    }`r`n`r`n" + $authBlock
} else {
    $authBlock = $authBlock -replace "`r`n", "`n"
    $new2 = "    if (req.method !== 'POST') {`n        return json({ ok: false, error: 'Method not allowed' }, 405);`n    }`n`n" + $authBlock
}

if (-not $raw.Contains($old2)) {
    Write-Host "ERROR 1.2: POST-check block not found" -ForegroundColor Red
    exit 1
}
$raw = $raw.Replace($old2, $new2)
Write-Host "OK 1.2: auth check inserted" -ForegroundColor Green

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, [System.Text.UTF8Encoding]::new($false))
Write-Host ""
Write-Host "DONE: $path updated" -ForegroundColor Cyan
Write-Host "Deploy with:" -ForegroundColor Yellow
Write-Host "  supabase functions deploy generate-scenario" -ForegroundColor Yellow