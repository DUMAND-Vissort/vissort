# patch8-framecounter.ps1
# player-runtime.js: reset _frameSkipCounter in startPlayer.

$ErrorActionPreference = "Stop"

$path = "player-runtime.js"
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
    if ($l.Trim() -eq '_frameSkipCounter = 0;') { $already = $true; break }
}
if ($already) {
    Write-Host "SKIP 8: already applied" -ForegroundColor Yellow
    exit 0
}

# Find "playerRunning = true;" inside startPlayer and insert reset after
# But there could be multiple "playerRunning = true;" — we want the one in startPlayer.
# Distinguish: in startPlayer, the next non-empty line is "isPaused = false;"
# followed soon by "completedSeries = successfulSeries = failedSeries = 0;"

$out = New-Object System.Collections.ArrayList
$inserted = $false
$inStartPlayer = $false

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    [void]$out.Add($line)

    if (-not $inserted) {
        if ($line -match '^function startPlayer\(' -or $line -match '^\s*function startPlayer\(') {
            $inStartPlayer = $true
            continue
        }
        if ($inStartPlayer -and -not $inserted -and $line.Trim() -eq 'playerRunning = true;') {
            # Check that within next 5 lines there's "isPaused = false;"
            $found = $false
            $limit = [Math]::Min($i + 6, $lines.Length)
            for ($j = $i + 1; $j -lt $limit; $j++) {
                if ($lines[$j].Trim() -eq 'isPaused = false;') { $found = $true; break }
            }
            if ($found) {
                $indent = ($line -replace '\S.*$', '')
                [void]$out.Add($indent + '_frameSkipCounter = 0;')
                $inserted = $true
            }
        }
    }
}

if (-not $inserted) {
    Write-Host "ERROR 8: startPlayer anchor not found" -ForegroundColor Red
    Write-Host "Diagnostic: lines containing 'playerRunning = true;'" -ForegroundColor Yellow
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match 'playerRunning\s*=\s*true') {
            Write-Host "  line $i : $($lines[$i].Trim())" -ForegroundColor Yellow
        }
    }
    exit 1
}

[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host "OK 8: _frameSkipCounter reset added to startPlayer" -ForegroundColor Green
Write-Host ""
Write-Host "DONE: $path updated" -ForegroundColor Cyan