# patch6-cam-indicator.ps1
# Adds responsive media query for #cam-indicator in player.html and user.html.

$ErrorActionPreference = "Stop"

$files = @("player.html", "user.html")
$newStyleLine = '<style id="cam-indicator-media">@media (max-width:520px){#cam-indicator{width:70px !important;min-width:70px !important;max-width:70px !important;flex:0 0 70px !important;}}</style>'

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        Write-Host "SKIP: $file not found" -ForegroundColor Yellow
        continue
    }

    $utf8 = [System.Text.UTF8Encoding]::new($false)
    $lines = [System.IO.File]::ReadAllLines((Resolve-Path $file), $utf8)

    $has = $false
    foreach ($l in $lines) {
        if ($l.Contains('cam-indicator-media')) { $has = $true; break }
    }
    if ($has) {
        Write-Host "SKIP $file : already applied" -ForegroundColor Yellow
        continue
    }

    $idx = -1
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i].Contains('id="cam-indicator-fix"')) { $idx = $i; break }
    }
    if ($idx -lt 0) {
        Write-Host "ERROR $file : cam-indicator-fix anchor not found" -ForegroundColor Red
        continue
    }

    $out = New-Object System.Collections.ArrayList
    for ($i = 0; $i -lt $lines.Length; $i++) {
        [void]$out.Add($lines[$i])
        if ($i -eq $idx) {
            [void]$out.Add($newStyleLine)
        }
    }

    [System.IO.File]::WriteAllLines((Resolve-Path $file), $out, $utf8)
    Write-Host "OK $file : media query added (line $($idx+1))" -ForegroundColor Green
}

Write-Host ""
Write-Host "DONE: patch 6 complete" -ForegroundColor Cyan