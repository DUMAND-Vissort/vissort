# patch5a-idb.ps1
# data-layer.js: _reopenAttempts + limit reopen attempts.

$ErrorActionPreference = "Stop"

$path = "data-layer.js"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$raw = [System.IO.File]::ReadAllText((Resolve-Path $path), $utf8)
$useCRLF = $raw.Contains("`r`n")
$nl = if ($useCRLF) { "`r`n" } else { "`n" }
Write-Host "Line endings: $(if ($useCRLF) {'CRLF'} else {'LF'})" -ForegroundColor Gray

# ============ 5A.1: declaration ============
$anchor1 = @(
    "    let db = null;",
    "    let authToken = null;"
) -join $nl

if ($raw.Contains('let _reopenAttempts = 0;')) {
    Write-Host "SKIP 5A.1: already declared" -ForegroundColor Yellow
} elseif (-not $raw.Contains($anchor1)) {
    Write-Host "ERROR 5A.1: 'let db = null; let authToken = null;' not found" -ForegroundColor Red
    exit 1
} else {
    $repl1 = @(
        "    let db = null;",
        "    let _reopenAttempts = 0;",
        "    let authToken = null;"
    ) -join $nl
    $raw = $raw.Replace($anchor1, $repl1)
    Write-Host "OK 5A.1: _reopenAttempts declared" -ForegroundColor Green
}

# ============ 5A.2: reset on successful open ============
$anchor2 = "db = req.result;"
if ($raw.Contains("db = req.result;$nl" + "                _reopenAttempts = 0;")) {
    Write-Host "SKIP 5A.2: reset already added" -ForegroundColor Yellow
} elseif (-not $raw.Contains($anchor2)) {
    Write-Host "ERROR 5A.2: 'db = req.result;' not found" -ForegroundColor Red
    exit 1
} else {
    $repl2 = @(
        "db = req.result;",
        "                _reopenAttempts = 0;"
    ) -join $nl
    $raw = $raw.Replace($anchor2, $repl2)
    Write-Host "OK 5A.2: reset on open" -ForegroundColor Green
}

# ============ 5A.3: limit reopen attempts ============
$anchor3 = "if (e.name === 'InvalidStateError') {"
if ($raw.Contains('_reopenAttempts > 3')) {
    Write-Host "SKIP 5A.3: limit already added" -ForegroundColor Yellow
} elseif (-not $raw.Contains($anchor3)) {
    Write-Host "ERROR 5A.3: InvalidStateError block not found" -ForegroundColor Red
    exit 1
} else {
    # Insert the guard right after the opening brace
    $repl3 = @(
        "if (e.name === 'InvalidStateError') {",
        "                _reopenAttempts = (_reopenAttempts || 0) + 1;",
        "                if (_reopenAttempts > 3) {",
        "                    reject(new Error('IndexedDB failed to reopen after 3 attempts'));",
        "                    return;",
        "                }"
    ) -join $nl
    $raw = $raw.Replace($anchor3, $repl3)
    Write-Host "OK 5A.3: reopen limit" -ForegroundColor Green
}

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, $utf8)
Write-Host ""
Write-Host "DONE: $path updated (part 5A)" -ForegroundColor Cyan