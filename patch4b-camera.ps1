# patch4b-camera.ps1
# player-runtime.js: reset distance and blink state in disableCamera.

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

if ($raw.Contains('curDistanceM = null;' + $nl + '    camBaseline = null;')) {
    Write-Host "SKIP 4B: disableCamera already patched" -ForegroundColor Yellow
    exit 0
}

$anchor = @(
    "    camActive = false;",
    "    camIndicator.style.display = 'none';",
    "}"
) -join $nl

if (-not $raw.Contains($anchor)) {
    Write-Host "ERROR 4B: disableCamera tail not found" -ForegroundColor Red
    Write-Host "Expected tail:" -ForegroundColor Yellow
    Write-Host $anchor -ForegroundColor Yellow
    exit 1
}

$repl = @(
    "    camActive = false;",
    "    if (camIndicator) camIndicator.style.display = 'none';",
    "",
    "    curDistanceM = null;",
    "    camBaseline = null;",
    "    camWarnKind = null;",
    "    lastEyeDistPx = null;",
    "    _blinkIsClosed = false;",
    "    _blinkClosedSince = 0;",
    "}"
) -join $nl

$raw = $raw.Replace($anchor, $repl)
Write-Host "OK 4B: disableCamera patched" -ForegroundColor Green

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, $utf8)
Write-Host ""
Write-Host "DONE: $path updated (part B)" -ForegroundColor Cyan