# patch9-sw-fallback.ps1
# sw.js: return a friendly offline page instead of empty 503.
# All-ASCII (no Cyrillic) to survive PowerShell 5.1.

$ErrorActionPreference = "Stop"

$path = "sw.js"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$lines = [System.IO.File]::ReadAllLines((Resolve-Path $path), $utf8)
Write-Host "Lines: $($lines.Length)" -ForegroundColor Gray

# Already applied?
$already = $false
foreach ($l in $lines) {
    if ($l -match 'OFFLINE_HTML') { $already = $true; break }
}
if ($already) {
    Write-Host "SKIP 9: already applied" -ForegroundColor Yellow
    exit 0
}

# Find the staleWhileRevalidate function
$funcStart = -1
$funcEnd = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'async function staleWhileRevalidate\(') {
        $funcStart = $i
    }
    if ($funcStart -ge 0 -and $i -gt $funcStart -and $lines[$i] -match '^\}') {
        $funcEnd = $i
        break
    }
}

if ($funcStart -lt 0 -or $funcEnd -lt 0) {
    Write-Host "ERROR 9: staleWhileRevalidate function not found" -ForegroundColor Red
    Write-Host "Diagnostic:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match 'staleWhileRevalidate') {
            Write-Host "  line $i : $($lines[$i].Trim())" -ForegroundColor Yellow
        }
    }
    exit 1
}

Write-Host "Function found: lines $funcStart to $funcEnd" -ForegroundColor Gray

# Offline HTML (all-ASCII on purpose; user can localize later)
$offlineHtmlLines = @(
    '// PATCH9: offline fallback page (ASCII placeholder -- localize later)',
    'const OFFLINE_HTML = ''<!DOCTYPE html>'',
    '<html lang="en"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Offline - Vissort</title>',
    '<style>',
    'body{margin:0;font-family:Segoe UI,Tahoma,sans-serif;background:#0b0b12;color:#e8e8f0;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}',
    '.box{max-width:400px}',
    'h1{font-size:22px;margin:0 0 12px}',
    'p{color:#9494a8;font-size:14px;line-height:1.5}',
    'button{margin-top:20px;padding:10px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}',
    'button:hover{background:#8b5cf6}',
    '</style></head><body><div class="box">',
    '<h1>No connection</h1>',
    '<p>This page is not available offline. Check your internet and try again.</p>',
    '<button onclick="location.reload()">Reload</button>',
    '</div></body></html>'';'
)

# New function body
$newFuncLines = @(
    'async function staleWhileRevalidate(request, cacheName) {',
    '    const cache = await caches.open(cacheName);',
    '    const cached = await cache.match(request);',
    '',
    '    const networkPromise = fetch(request)',
    '        .then((res) => {',
    '            if (res && res.ok && res.type !== ''opaque'') {',
    '                cache.put(request, res.clone());',
    '            }',
    '            return res;',
    '        })',
    '        .catch((err) => {',
    '            console.warn(''[SW] fetch error for'', request.url, err.message);',
    '            if (cached) return cached;',
    '            // PATCH9: friendly offline fallback for HTML requests',
    '            const accept = request.headers.get(''accept'') || '''';',
    '            if (request.mode === ''navigate'' || accept.includes(''text/html'')) {',
    '                return new Response(OFFLINE_HTML, {',
    '                    status: 200,',
    '                    headers: { ''Content-Type'': ''text/html; charset=utf-8'' }',
    '                });',
    '            }',
    '            return new Response('''', { status: 503 });',
    '        });',
    '',
    '    return cached || networkPromise;',
    '}'
)

# Rebuild
$out = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($i -eq $funcStart) {
        foreach ($l in $offlineHtmlLines) { [void]$out.Add($l) }
        [void]$out.Add('')
        foreach ($l in $newFuncLines) { [void]$out.Add($l) }
        $i = $funcEnd
        continue
    }
    [void]$out.Add($lines[$i])
}

[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host "OK 9: offline fallback added to staleWhileRevalidate" -ForegroundColor Green
Write-Host ""
Write-Host "DONE: $path updated" -ForegroundColor Cyan