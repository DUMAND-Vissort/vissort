# patch5b-token-v2.ps1
# data-layer.js: skip expired token in syncAuthFromStorage.
# Line-based: inserts guard between "if (token) {" and "authToken = token;".

$ErrorActionPreference = "Stop"

$path = "data-layer.js"
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
    if ($l -match 'token from localStorage expired') { $already = $true; break }
}
if ($already) {
    Write-Host "SKIP 5B: already applied" -ForegroundColor Yellow
    exit 0
}

$out = New-Object System.Collections.ArrayList
$done = $false
$pendingTokenBrace = $false

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    [void]$out.Add($line)

    if ($done) { continue }

    # Step 1: detect "if (token) {"
    if (-not $pendingTokenBrace -and $line.Trim() -eq 'if (token) {') {
        $pendingTokenBrace = $true
        continue
    }

    # Step 2: on next line, if it's "authToken = token;", insert guard before it
    if ($pendingTokenBrace -and $line.Trim() -eq 'authToken = token;') {
        # Remove the just-added authToken line — we'll re-add it after guard
        [void]$out.RemoveAt($out.Count - 1)

        $indent = ($line -replace '\S.*$', '')
        [void]$out.Add($indent + 'const exp = parsed && (parsed.expires_at || (parsed.currentSession && parsed.currentSession.expires_at));')
        [void]$out.Add($indent + 'if (exp && exp * 1000 < Date.now()) {')
        [void]$out.Add($indent + "    warn('token from localStorage expired, skipping');")
        [void]$out.Add($indent + '    continue;')
        [void]$out.Add($indent + '}')
        [void]$out.Add($line)
        $done = $true
        continue
    }

    # If pending but not matched (unexpected), reset flag and continue
    if ($pendingTokenBrace -and $line.Trim() -ne 'authToken = token;') {
        $pendingTokenBrace = $false
    }
}

if (-not $done) {
    Write-Host "ERROR 5B: anchor pattern not found" -ForegroundColor Red
    Write-Host "Diagnostic:" -ForegroundColor Yellow
    $idx = 0
    foreach ($l in $lines) {
        if ($l -match 'if \(token\)') {
            Write-Host "  line $idx : $($l.Trim())" -ForegroundColor Yellow
        }
        $idx++
    }
    exit 1
}

[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host "OK 5B: expired token check inserted" -ForegroundColor Green
Write-Host ""
Write-Host "DONE: $path updated (part 5B)" -ForegroundColor Cyan