# patch5a-idb-v2.ps1
# data-layer.js: line-based patch for _reopenAttempts.
# Reads lines, inserts new lines after specific anchors. Robust to CRLF/LF.

$ErrorActionPreference = "Stop"

$path = "data-layer.js"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$lines = [System.IO.File]::ReadAllLines((Resolve-Path $path), $utf8)
Write-Host "Lines: $($lines.Length)" -ForegroundColor Gray

# Detect already-applied state
$has1 = $false; $has2 = $false; $has3 = $false
foreach ($l in $lines) {
    $t = $l.Trim()
    if ($t -eq 'let _reopenAttempts = 0;') { $has1 = $true }
    if ($t -eq '_reopenAttempts = 0;') { $has2 = $true }
    if ($t -eq '_reopenAttempts = (_reopenAttempts || 0) + 1;') { $has3 = $true }
}

$done1 = $false; $done2 = $false; $done3 = $false
$out = New-Object System.Collections.ArrayList

foreach ($line in $lines) {
    [void]$out.Add($line)

    # 5A.1: after "let db = null;"
    if (-not $done1 -and -not $has1 -and $line.Trim() -eq 'let db = null;') {
        $indent = ($line -replace '\S.*$', '')
        [void]$out.Add($indent + 'let _reopenAttempts = 0;')
        $done1 = $true
        continue
    }

    # 5A.2: after "db = req.result;"
    if (-not $done2 -and -not $has2 -and $line.Trim() -eq 'db = req.result;') {
        $indent = ($line -replace '\S.*$', '')
        [void]$out.Add($indent + '_reopenAttempts = 0;')
        $done2 = $true
        continue
    }

    # 5A.3: after "if (e.name === 'InvalidStateError') {"
    if (-not $done3 -and -not $has3 -and $line.Trim() -eq "if (e.name === 'InvalidStateError') {") {
        $indent = ($line -replace '\S.*$', '')
        [void]$out.Add($indent + '    _reopenAttempts = (_reopenAttempts || 0) + 1;')
        [void]$out.Add($indent + '    if (_reopenAttempts > 3) {')
        [void]$out.Add($indent + "        reject(new Error('IndexedDB failed to reopen after 3 attempts'));")
        [void]$out.Add($indent + '        return;')
        [void]$out.Add($indent + '    }')
        $done3 = $true
        continue
    }
}

if ($has1)      { Write-Host "SKIP 5A.1: already applied" -ForegroundColor Yellow }
elseif ($done1) { Write-Host "OK 5A.1: _reopenAttempts declared" -ForegroundColor Green }
else            { Write-Host "ERROR 5A.1: 'let db = null;' not found" -ForegroundColor Red; exit 1 }

if ($has2)      { Write-Host "SKIP 5A.2: already applied" -ForegroundColor Yellow }
elseif ($done2) { Write-Host "OK 5A.2: reset on open" -ForegroundColor Green }
else            { Write-Host "ERROR 5A.2: 'db = req.result;' not found" -ForegroundColor Red; exit 1 }

if ($has3)      { Write-Host "SKIP 5A.3: already applied" -ForegroundColor Yellow }
elseif ($done3) { Write-Host "OK 5A.3: reopen limit" -ForegroundColor Green }
else            { Write-Host "ERROR 5A.3: InvalidStateError block not found" -ForegroundColor Red; exit 1 }

# Write with system newline (CRLF on Windows), preserves encoding
[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host ""
Write-Host "DONE: $path updated (part 5A)" -ForegroundColor Cyan