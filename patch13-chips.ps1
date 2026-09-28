# patch13-chips.ps1
# admin.html: never hide folder-status and templates-folder-status chips.

$ErrorActionPreference = "Stop"

$path = "admin.html"
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
    if ($l -match 'PATCH13') { $already = $true; break }
}
if ($already) {
    Write-Host "SKIP 13: already applied" -ForegroundColor Yellow
    exit 0
}

$out = New-Object System.Collections.ArrayList
$done1 = $false
$done2 = $false

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]

    # Replacement 1: neutralize the 1500px media-query that hides folder-status chips
    if (-not $done1 -and $line.Trim() -eq '@media (max-width: 1500px) {') {
        [void]$out.Add('/* PATCH13: folder-status and templates-folder-status are always visible */')
        # Skip original block: find matching closing } on its own line
        $j = $i + 1
        while ($j -lt $lines.Length) {
            if ($lines[$j] -match '^\}') {
                # advance past closing brace
                $i = $j
                break
            }
            $j++
        }
        $done1 = $true
        continue
    }

    # Replacement 2: in @media 900px block, change .status-chip rule
    if (-not $done2 -and $line.Trim() -eq '.status-chip { display: none !important; }') {
        $indent = ($line -replace '\S.*$', '')
        [void]$out.Add($indent + '.status-chip:not(#folder-status):not(#templates-folder-status) { display: none !important; }')
        [void]$out.Add($indent + '#folder-status, #templates-folder-status { max-width: 110px !important; font-size: 9px !important; }')
        $done2 = $true
        continue
    }

    [void]$out.Add($line)
}

if (-not $done1) { Write-Host "WARN 13.1: 1500px media-query not found (maybe changed)" -ForegroundColor Yellow }
if (-not $done2) { Write-Host "WARN 13.2: 900px .status-chip rule not found (maybe changed)" -ForegroundColor Yellow }
if (-not $done1 -and -not $done2) {
    Write-Host "ERROR 13: no anchors found" -ForegroundColor Red
    exit 1
}

[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host ""
Write-Host "OK 13: applied (1500px=$done1, 900px=$done2)" -ForegroundColor Green
Write-Host "DONE: $path updated" -ForegroundColor Cyan