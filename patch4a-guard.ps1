# patch4a-guard.ps1
# player-runtime.js: sessionId fallback, reading guard, timer, stopPlayer reset.

$ErrorActionPreference = "Stop"

$path = "player-runtime.js"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$raw = [System.IO.File]::ReadAllText((Resolve-Path $path), $utf8)
$useCRLF = $raw.Contains("`r`n")
$nl = if ($useCRLF) { "`r`n" } else { "`n" }
Write-Host "Line endings: $(if ($useCRLF) {'CRLF'} else {'LF'})" -ForegroundColor Gray

# ============ A1: sessionId fallback ============
$anchor1 = 'sessionId = crypto.randomUUID();'
if ($raw.Contains('window.crypto.randomUUID === ''function''')) {
    Write-Host "SKIP A1: sessionId fallback already applied" -ForegroundColor Yellow
} elseif (-not $raw.Contains($anchor1)) {
    Write-Host "ERROR A1: 'sessionId = crypto.randomUUID();' not found" -ForegroundColor Red
    exit 1
} else {
    $repl1 = @(
        "sessionId = (window.crypto && typeof window.crypto.randomUUID === 'function')",
        "        ? window.crypto.randomUUID()",
        "        : 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);"
    ) -join $nl
    $raw = $raw.Replace($anchor1, $repl1)
    Write-Host "OK A1: sessionId fallback" -ForegroundColor Green
}

# ============ A2: guard vars after gCurrentCompareNode ============
$anchor2 = 'let gCurrentCompareNode = null;'
if ($raw.Contains('let _readingFinishGuard = false;')) {
    Write-Host "SKIP A2: guard vars already declared" -ForegroundColor Yellow
} elseif (-not $raw.Contains($anchor2)) {
    Write-Host "ERROR A2: 'let gCurrentCompareNode = null;' not found" -ForegroundColor Red
    exit 1
} else {
    $repl2 = @(
        "let gCurrentCompareNode = null;",
        "let _readingFinishGuard = false;",
        "let _readingTimerId = null;"
    ) -join $nl
    $raw = $raw.Replace($anchor2, $repl2)
    Write-Host "OK A2: guard vars declared" -ForegroundColor Green
}

# ============ A3: finishGraphReading guard ============
$anchor3 = "function finishGraphReading(node) {`n    readingToolbarEl.style.display = 'none';"
if ($useCRLF) { $anchor3 = $anchor3 -replace "`n", "`r`n" }

if ($raw.Contains('if (_readingFinishGuard) return;')) {
    Write-Host "SKIP A3: finishGraphReading guard already applied" -ForegroundColor Yellow
} elseif (-not $raw.Contains($anchor3)) {
    Write-Host "ERROR A3: finishGraphReading anchor not found" -ForegroundColor Red
    exit 1
} else {
    $repl3 = @(
        "function finishGraphReading(node) {",
        "    if (_readingFinishGuard) return;",
        "    _readingFinishGuard = true;",
        "",
        "    if (_readingTimerId) {",
        "        clearTimeout(_readingTimerId);",
        "        _readingTimerId = null;",
        "    }",
        "    readingToolbarEl.style.display = 'none';"
    ) -join $nl
    $raw = $raw.Replace($anchor3, $repl3)
    Write-Host "OK A3: finishGraphReading guard" -ForegroundColor Green
}

# ============ A4: reading timer in playGraphReading ============
$anchor4 = @(
    "    const dur = node.duration || 60000;",
    "    if (dur > 0) {",
    "        phaseTimers.push(setTimeout(() => finishGraphReading(node), dur));",
    "    }"
) -join $nl

if ($raw.Contains('_readingTimerId = setTimeout(')) {
    Write-Host "SKIP A4: reading timer already patched" -ForegroundColor Yellow
} elseif (-not $raw.Contains($anchor4)) {
    Write-Host "ERROR A4: reading timer anchor not found" -ForegroundColor Red
    exit 1
} else {
    $repl4 = @(
        "    _readingFinishGuard = false;",
        "    if (_readingTimerId) { clearTimeout(_readingTimerId); _readingTimerId = null; }",
        "",
        "    const dur = node.duration || 60000;",
        "    if (dur > 0) {",
        "        _readingTimerId = setTimeout(() => {",
        "            _readingTimerId = null;",
        "            finishGraphReading(node);",
        "        }, dur);",
        "        phaseTimers.push(_readingTimerId);",
        "    }"
    ) -join $nl
    $raw = $raw.Replace($anchor4, $repl4)
    Write-Host "OK A4: reading timer" -ForegroundColor Green
}

# ============ A5: stopPlayer reset ============
$anchor5 = @(
    "    sessionId = null;",
    "    graphActive = false;"
) -join $nl

if ($raw.Contains('_readingFinishGuard = false;' + $nl + '    if (_readingTimerId) { clearTimeout(_readingTimerId); _readingTimerId = null; }' + $nl + '    graphActive = false;')) {
    Write-Host "SKIP A5: stopPlayer reset already applied" -ForegroundColor Yellow
} elseif (-not $raw.Contains($anchor5)) {
    Write-Host "ERROR A5: stopPlayer anchor not found" -ForegroundColor Red
    exit 1
} else {
    $repl5 = @(
        "    sessionId = null;",
        "    _readingFinishGuard = false;",
        "    if (_readingTimerId) { clearTimeout(_readingTimerId); _readingTimerId = null; }",
        "    graphActive = false;"
    ) -join $nl
    $raw = $raw.Replace($anchor5, $repl5)
    Write-Host "OK A5: stopPlayer reset" -ForegroundColor Green
}

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, $utf8)
Write-Host ""
Write-Host "DONE: $path updated (part A)" -ForegroundColor Cyan