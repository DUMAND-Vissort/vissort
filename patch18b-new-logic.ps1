# patch18b-new-logic.ps1
# app.js: append installNewScenario IIFE at end of file.

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

if ($raw.Contains('__vissort_newScenario')) {
    Write-Host "SKIP 18b: already applied" -ForegroundColor Yellow
    exit 0
}

$block = @(
    "",
    "// ==================== PATCH18B: new scenario ====================",
    "(function installNewScenario() {",
    "    var btn = document.getElementById('btn-new');",
    "    if (!btn) { console.warn('[new] btn-new not found'); return; }",
    "",
    "    function doNew() {",
    "        var hasContent = (typeof nodes !== 'undefined' && nodes.length > 0) ||",
    "                         (typeof connections !== 'undefined' && connections.length > 0);",
    "        if (hasContent) {",
    "            if (!confirm('Start a new scenario? Unsaved changes will be lost.')) return;",
    "        }",
    "",
    "        nodes.length = 0;",
    "        connections.length = 0;",
    "        window._books = {};",
    "        window._currentScenarioKey = generateScenarioKey();",
    "        window._currentScenarioId = null;",
    "        window._currentScenarioFileName = null;",
    "        activeNodeId = null;",
    "",
    "        if (typeof inspectorEl !== 'undefined' && inspectorEl) inspectorEl.style.display = 'none';",
    "",
    "        if (typeof nodeElements !== 'undefined' && nodeElements) nodeElements.clear();",
    "        if (typeof connectionElements !== 'undefined' && connectionElements) connectionElements.clear();",
    "",
    "        var canvasEl = document.getElementById('canvas');",
    "        if (canvasEl) {",
    "            var allNodes = canvasEl.querySelectorAll('.scenario-node');",
    "            for (var i = 0; i < allNodes.length; i++) allNodes[i].remove();",
    "            var allLines = canvasEl.querySelectorAll('.html-graph-line, .line-arrow');",
    "            for (var j = 0; j < allLines.length; j++) allLines[j].remove();",
    "        }",
    "",
    "        requestRenderGraph();",
    "        updateInspector();",
    "",
    "        var startId = createNewNode('STIMULUS', 200, 150);",
    "        if (typeof switchMode === 'function' && currentMode !== 'nodes') switchMode('nodes');",
    "",
    "        if (startId && typeof getNode === 'function') {",
    "            var st = getNode(startId);",
    "            if (st) st.isStart = true;",
    "        }",
    "",
    "        console.log('[new] new scenario created, key =', window._currentScenarioKey);",
    "    }",
    "",
    "    btn.addEventListener('click', doNew);",
    "    window.__vissort_newScenario = doNew;",
    "    console.log('[new] installed');",
    "})();"
) -join $nl

$raw = $raw + $nl + $block + $nl

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, $utf8)
Write-Host "OK 18b: installNewScenario appended" -ForegroundColor Green
Write-Host "DONE: $path updated" -ForegroundColor Cyan