# patch17-node-click-drag.ps1
# app.js: drag from anywhere on node; single click = activate; double click = inspector.

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

if ($raw.Contains('PATCH17')) {
    Write-Host "SKIP 17: already applied" -ForegroundColor Yellow
    exit 0
}

# ============ Replacement 1: mousedown from header to whole node ============
$old1 = @(
    "    header.addEventListener('mousedown', (e) => {",
    "        if (e.button !== 0 || window._pendingConnectionHandler) return;",
    "        dragNodeId = node.id;"
) -join $nl

$new1 = @(
    "    // PATCH17: drag from anywhere on the node (except buttons/checkbox/resize handle)",
    "    el.addEventListener('mousedown', (e) => {",
    "        if (e.button !== 0 || window._pendingConnectionHandler) return;",
    "        if (e.target.closest('.node-btn') || e.target.closest('.start-checkbox') || e.target.closest('.node-resize-handle')) return;",
    "        dragNodeId = node.id;"
) -join $nl

if (-not $raw.Contains($old1)) {
    Write-Host "ERROR 17.1: mousedown anchor not found" -ForegroundColor Red
    Write-Host "Looking for: header.addEventListener('mousedown', (e) => {" -ForegroundColor Yellow
    exit 1
}
$raw = $raw.Replace($old1, $new1)
Write-Host "OK 17.1: mousedown moved to whole node" -ForegroundColor Green

# ============ Replacement 2: click handler split into click + dblclick ============
$old2 = @(
    "    el.addEventListener('click', (e) => {",
    "        if (window._pendingConnectionHandler) return;",
    "        if (",
    "            e.target.closest('.node-btn') ||",
    "            e.target.closest('.start-checkbox') ||",
    "            e.target.closest('.node-resize-handle')",
    "        )",
    "            return;",
    "        selectNode(node.id);",
    "    });"
) -join $nl

$new2 = @(
    "    // PATCH17: single click -- activate only, do not open inspector",
    "    el.addEventListener('click', (e) => {",
    "        if (window._pendingConnectionHandler) return;",
    "        if (",
    "            e.target.closest('.node-btn') ||",
    "            e.target.closest('.start-checkbox') ||",
    "            e.target.closest('.node-resize-handle')",
    "        )",
    "            return;",
    "        activeNodeId = node.id;",
    "        window._pendingGeneratorMode = false;",
    "        requestRenderGraph();",
    "        if (inspectorEl.style.display === 'block') updateInspector();",
    "    });",
    "",
    "    // PATCH17: double click -- open inspector",
    "    el.addEventListener('dblclick', (e) => {",
    "        if (window._pendingConnectionHandler) return;",
    "        if (",
    "            e.target.closest('.node-btn') ||",
    "            e.target.closest('.start-checkbox') ||",
    "            e.target.closest('.node-resize-handle')",
    "        )",
    "            return;",
    "        selectNode(node.id);",
    "    });"
) -join $nl

if (-not $raw.Contains($old2)) {
    Write-Host "ERROR 17.2: click handler anchor not found" -ForegroundColor Red
    Write-Host "Looking for: el.addEventListener('click', (e) => { ... selectNode(node.id); });" -ForegroundColor Yellow
    exit 1
}
$raw = $raw.Replace($old2, $new2)
Write-Host "OK 17.2: click/dblclick split" -ForegroundColor Green

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, $utf8)
Write-Host ""
Write-Host "DONE: $path updated" -ForegroundColor Cyan