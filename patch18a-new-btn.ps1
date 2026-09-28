# patch18a-new-btn.ps1
# admin.html: add "New scenario" button next to Save.

$ErrorActionPreference = "Stop"

$path = "admin.html"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$lines = [System.IO.File]::ReadAllLines((Resolve-Path $path), $utf8)
Write-Host "Lines: $($lines.Length)" -ForegroundColor Gray

$already = $false
foreach ($l in $lines) {
    if ($l -match 'id="btn-new"') { $already = $true; break }
}
if ($already) {
    Write-Host "SKIP 18a: already applied" -ForegroundColor Yellow
    exit 0
}

$anchorIdx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'id="btn-save"') {
        $anchorIdx = $i
        break
    }
}

if ($anchorIdx -lt 0) {
    Write-Host "ERROR 18a: btn-save not found" -ForegroundColor Red
    exit 1
}

$newBtn = '<button class="btn btn-success btn-icon" id="btn-new" title="New scenario (clear canvas)">🆕</button>'

$out = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($i -eq $anchorIdx) {
        [void]$out.Add($newBtn)
    }
    [void]$out.Add($lines[$i])
}

[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host "OK 18a: btn-new inserted before btn-save" -ForegroundColor Green
Write-Host "DONE: $path updated" -ForegroundColor Cyan