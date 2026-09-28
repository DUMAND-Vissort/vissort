# patch5c-scenario-v2.ps1
# data-layer.js: pushToCloud('scenario') -- cleanup cloud if local record vanished.
# Line-based: find "emit('scenarios-changed', { id: cloudId, renamed: true });",
# then insert "else { ... }" right after the following "}".

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
    if ($l -match 'local record not found, deleting cloud') { $already = $true; break }
}
if ($already) {
    Write-Host "SKIP 5C: already applied" -ForegroundColor Yellow
    exit 0
}

# Locate the anchor line
$anchorIdx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "emit\('scenarios-changed', \{ id: cloudId, renamed: true \}\);") {
        $anchorIdx = $i
        break
    }
}

if ($anchorIdx -lt 0) {
    Write-Host "ERROR 5C: emit scenarios-changed anchor not found" -ForegroundColor Red
    Write-Host "Diagnostic: lines containing 'scenarios-changed':" -ForegroundColor Yellow
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match "scenarios-changed") {
            Write-Host "  line $i : $($lines[$i].Trim())" -ForegroundColor Yellow
        }
    }
    exit 1
}

# Find next line that is exactly a closing brace on its own (trim == '}')
$closingIdx = -1
for ($i = $anchorIdx + 1; $i -lt [Math]::Min($anchorIdx + 15, $lines.Length); $i++) {
    if ($lines[$i].Trim() -eq '}') {
        $closingIdx = $i
        break
    }
}

if ($closingIdx -lt 0) {
    Write-Host "ERROR 5C: closing brace of if(localRec) not found" -ForegroundColor Red
    exit 1
}

Write-Host "Anchor at line $anchorIdx, closing brace at line $closingIdx" -ForegroundColor Gray

# Determine indent from the if-line above anchor
# Just use 16 spaces like in original file
$elseIndent = '                '
$bodyIndent = '                    '

$elseBlock = @(
    '                } else {',
    "                    warn('local record not found, deleting cloud ' + cloudId);",
    '                    try {',
    "                        await sbFetch('scenarios?id=eq.' + encodeURIComponent(cloudId), { method: 'DELETE' });",
    '                    } catch (e) {',
    "                        warn('rollback failed: ' + e.message);",
    '                    }',
    '                }'
)

# Build new lines: replace the closing "}" line with else block
$out = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($i -eq $closingIdx) {
        foreach ($el in $elseBlock) { [void]$out.Add($el) }
    } else {
        [void]$out.Add($lines[$i])
    }
}

[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host "OK 5C: else-block inserted" -ForegroundColor Green
Write-Host ""
Write-Host "DONE: $path updated (part 5C)" -ForegroundColor Cyan