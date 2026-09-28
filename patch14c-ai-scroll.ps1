 # patch14c-ai-scroll.ps1
# vissort-ai-generator.js: scroll canvas to newly created nodes.

$ErrorActionPreference = "Stop"

$path = "vissort-ai-generator.js"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$lines = [System.IO.File]::ReadAllLines((Resolve-Path $path), $utf8)
Write-Host "Lines: $($lines.Length)" -ForegroundColor Gray

$already = $false
foreach ($l in $lines) {
    if ($l -match 'PATCH14C') { $already = $true; break }
}
if ($already) {
    Write-Host "SKIP 14c: already applied" -ForegroundColor Yellow
    exit 0
}

$anchorIdx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].Trim() -eq 'Editor.requestRenderGraph();') {
        $anchorIdx = $i
    }
}

if ($anchorIdx -lt 0) {
    Write-Host "ERROR 14c: Editor.requestRenderGraph() not found" -ForegroundColor Red
    exit 1
}

$indent = ($lines[$anchorIdx] -replace '\S.*$', '')

$scrollLines = @(
    '',
    $indent + '// PATCH14C: auto-scroll canvas to show created nodes',
    $indent + 'if (created.length > 0) {',
    $indent + '    const firstNode = Editor.getNode(created[0]);',
    $indent + '    if (firstNode && canvas) {',
    $indent + '        setTimeout(function() {',
    $indent + '            const el = document.querySelector(''.scenario-node[data-node-id="'' + created[0] + ''"]'');',
    $indent + '            if (el) {',
    $indent + '                el.scrollIntoView({ behavior: ''smooth'', block: ''center'', inline: ''center'' });',
    $indent + '            } else {',
    $indent + '                canvas.scrollLeft = Math.max(0, firstNode.x - 40);',
    $indent + '                canvas.scrollTop = Math.max(0, firstNode.y - 40);',
    $indent + '            }',
    $indent + '        }, 100);',
    $indent + '    }',
    $indent + '}'
)

$out = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt $lines.Length; $i++) {
    [void]$out.Add($lines[$i])
    if ($i -eq $anchorIdx) {
        foreach ($sl in $scrollLines) { [void]$out.Add($sl) }
    }
}

[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host "OK 14c: auto-scroll inserted after requestRenderGraph" -ForegroundColor Green
Write-Host "DONE: $path updated" -ForegroundColor Cyan