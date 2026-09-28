# patch15c-zoom-logic.ps1
# app.js: install zoom logic and fix drag/resize for scale.

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

# --- Already applied? ---
if ($raw.Contains('window.__vissort_zoom')) {
    Write-Host "SKIP 15c: already applied" -ForegroundColor Yellow
    exit 0
}

# ============ Replacement A: drag start (offsetX/offsetY) ============
$oldA = "        offsetX = e.clientX - r.left - node.x;`n        offsetY = e.clientY - r.top - node.y;"
if ($useCRLF) { $oldA = $oldA -replace "`n", "`r`n" }

$newA = @(
    "        const _zoomA = window.__vissort_zoom || 1;",
    "        offsetX = (e.clientX - r.left) / _zoomA - node.x;",
    "        offsetY = (e.clientY - r.top) / _zoomA - node.y;"
) -join $nl

if (-not $raw.Contains($oldA)) {
    Write-Host "ERROR 15c.A: drag-start anchor not found" -ForegroundColor Red
    Write-Host "Looking for: 'offsetX = e.clientX - r.left - node.x;'" -ForegroundColor Yellow
    exit 1
}
$raw = $raw.Replace($oldA, $newA)
Write-Host "OK 15c.A: drag start corrected" -ForegroundColor Green

# ============ Replacement B: onDragMove ============
$oldB = @(
    "        const r = canvas.getBoundingClientRect();",
    "        node.x = e.clientX - r.left - offsetX;",
    "        node.y = e.clientY - r.top - offsetY;"
) -join $nl

$newB = @(
    "        const r = canvas.getBoundingClientRect();",
    "        const _zoomB = window.__vissort_zoom || 1;",
    "        node.x = (e.clientX - r.left) / _zoomB - offsetX;",
    "        node.y = (e.clientY - r.top) / _zoomB - offsetY;"
) -join $nl

if (-not $raw.Contains($oldB)) {
    Write-Host "ERROR 15c.B: onDragMove anchor not found" -ForegroundColor Red
    exit 1
}
$raw = $raw.Replace($oldB, $newB)
Write-Host "OK 15c.B: onDragMove corrected" -ForegroundColor Green

# ============ Replacement C: onResizeMove ============
$oldC = @(
    "        node.width = Math.max(200, startW + e.clientX - startMouseX);",
    "        node.height = Math.max(180, startH + e.clientY - startMouseY);"
) -join $nl

$newC = @(
    "        const _zoomC = window.__vissort_zoom || 1;",
    "        node.width = Math.max(200, startW + (e.clientX - startMouseX) / _zoomC);",
    "        node.height = Math.max(180, startH + (e.clientY - startMouseY) / _zoomC);"
) -join $nl

if (-not $raw.Contains($oldC)) {
    Write-Host "ERROR 15c.C: onResizeMove anchor not found" -ForegroundColor Red
    exit 1
}
$raw = $raw.Replace($oldC, $newC)
Write-Host "OK 15c.C: onResizeMove corrected" -ForegroundColor Green

# ============ Insert installZoom() block at end of file ============
$zoomBlock = @(
    "",
    "// ==================== PATCH15C: canvas zoom ====================",
    "(function installZoom() {",
    "    var ZOOM_KEY = 'vissort_canvas_zoom';",
    "    var MIN_ZOOM = 0.3;",
    "    var MAX_ZOOM = 2.0;",
    "    var STEP = 0.1;",
    "",
    "    var canvasEl = document.getElementById('canvas');",
    "    if (!canvasEl) {",
    "        console.warn('[zoom] canvas not found');",
    "        return;",
    "    }",
    "",
    "    var zoomLevel = parseFloat(localStorage.getItem(ZOOM_KEY)) || 1.0;",
    "    window.__vissort_zoom = zoomLevel;",
    "",
    "    var btnIn = document.getElementById('btn-zoom-in');",
    "    var btnOut = document.getElementById('btn-zoom-out');",
    "    var btnReset = document.getElementById('btn-zoom-reset');",
    "",
    "    function applyZoom() {",
    "        zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel));",
    "        zoomLevel = Math.round(zoomLevel * 100) / 100;",
    "        window.__vissort_zoom = zoomLevel;",
    "        canvasEl.style.zoom = zoomLevel;",
    "        if (btnReset) btnReset.textContent = Math.round(zoomLevel * 100) + '%';",
    "        try { localStorage.setItem(ZOOM_KEY, String(zoomLevel)); } catch (_) {}",
    "    }",
    "",
    "    function zoomBy(delta) {",
    "        zoomLevel = Math.round((zoomLevel + delta) * 100) / 100;",
    "        applyZoom();",
    "    }",
    "",
    "    if (btnIn) btnIn.addEventListener('click', function () { zoomBy(STEP); });",
    "    if (btnOut) btnOut.addEventListener('click', function () { zoomBy(-STEP); });",
    "    if (btnReset) btnReset.addEventListener('click', function () {",
    "        zoomLevel = 1.0;",
    "        applyZoom();",
    "    });",
    "",
    "    document.addEventListener('keydown', function (e) {",
    "        if (!e.ctrlKey && !e.metaKey) return;",
    "        var t = e.target;",
    "        if (t && /input|textarea|select/i.test(t.tagName)) return;",
    "        if (e.key === '=' || e.key === '+') {",
    "            e.preventDefault();",
    "            zoomBy(STEP);",
    "        } else if (e.key === '-') {",
    "            e.preventDefault();",
    "            zoomBy(-STEP);",
    "        } else if (e.key === '0') {",
    "            e.preventDefault();",
    "            zoomLevel = 1.0;",
    "            applyZoom();",
    "        }",
    "    });",
    "",
    "    applyZoom();",
    "    console.log('[zoom] installed, level =', zoomLevel);",
    "})();"
) -join $nl

$raw = $raw + $nl + $zoomBlock + $nl
Write-Host "OK 15c.D: installZoom block appended" -ForegroundColor Green

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, $utf8)
Write-Host ""
Write-Host "DONE: $path updated" -ForegroundColor Cyan