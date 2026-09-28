# patch16-wheel-zoom.ps1
# app.js: Ctrl+wheel zooms the canvas.

$ErrorActionPreference = "Stop"

$path = "app.js"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$raw = [System.IO.File]::ReadAllText((Resolve-Path $path), $utf8)
$useCRLF = $raw.Contains("`r`n")
$nl = if ($useCRLF) { "`r`n" } else { "`n" }
Write-Host "Line endings: $(if ($useCRLF) {'CRLF'} else {'LF'})" -ForegroundColor Gray

if ($raw.Contains('PATCH16')) {
    Write-Host "SKIP 16: already applied" -ForegroundColor Yellow
    exit 0
}

# Anchor: end of installZoom IIFE
$anchor = "    applyZoom();`n    console.log('[zoom] installed, level =', zoomLevel);`n})();"
if ($useCRLF) { $anchor = $anchor -replace "`n", "`r`n" }

if (-not $raw.Contains($anchor)) {
    Write-Host "ERROR 16: installZoom end marker not found" -ForegroundColor Red
    Write-Host "Looking for: 'console.log(''[zoom] installed, level ='', zoomLevel);')" -ForegroundColor Yellow
    exit 1
}

# Insert wheel handler + patch marker just before the closing of installZoom
$wheelBlock = @(
    "",
    "    // PATCH16: Ctrl+wheel zoom",
    "    canvasEl.addEventListener('wheel', function (e) {",
    "        if (!e.ctrlKey && !e.metaKey) return;",
    "        e.preventDefault();",
    "        var delta = e.deltaY > 0 ? -STEP : STEP;",
    "        zoomBy(delta);",
    "    }, { passive: false });",
    "",
    "    applyZoom();",
    "    console.log('[zoom] installed, level =', zoomLevel, '[PATCH16]');"
) -join $nl

$replacement = $wheelBlock + $nl + "})();"
$raw = $raw.Replace($anchor, $replacement)
Write-Host "OK 16: Ctrl+wheel handler inserted" -ForegroundColor Green

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, $utf8)
Write-Host ""
Write-Host "DONE: $path updated" -ForegroundColor Cyan