# patch12-diff-size.ps1
# differences-wolf.html: remove upper cap for difference size.

$ErrorActionPreference = "Stop"

$path = "differences-wolf.html"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$lines = [System.IO.File]::ReadAllLines((Resolve-Path $path), $utf8)
Write-Host "Lines: $($lines.Length)" -ForegroundColor Gray

$oldPattern = 'S = Math.max(4, Math.min(60, px * scale));'
$newPattern = 'S = Math.max(4, px * scale);'

$found = $false
$out = New-Object System.Collections.ArrayList

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line.Contains($oldPattern)) {
        $found = $true
        $newLine = $line.Replace($oldPattern, $newPattern)
        [void]$out.Add($newLine)
        Write-Host "  line $($i + 1): $($line.Trim())" -ForegroundColor Gray
    } else {
        [void]$out.Add($line)
    }
}

if (-not $found) {
    $already = $false
    foreach ($l in $lines) {
        if ($l.Contains('S = Math.max(4, px * scale);')) { $already = $true; break }
    }
    if ($already) {
        Write-Host "SKIP 12: already applied" -ForegroundColor Yellow
        exit 0
    }
    Write-Host "ERROR 12: pattern not found" -ForegroundColor Red
    Write-Host "Diagnostic: lines containing 'Math.min':" -ForegroundColor Yellow
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match 'Math\.min') {
            Write-Host "  line $i : $($lines[$i].Trim())" -ForegroundColor Yellow
        }
    }
    exit 1
}

[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host ""
Write-Host "OK 12: upper cap removed" -ForegroundColor Green
Write-Host "DONE: $path updated" -ForegroundColor Cyan