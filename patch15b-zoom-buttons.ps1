 # patch15b-zoom-buttons.ps1
# admin.html: add zoom buttons to header (ASCII-only to survive PS 5.1).

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
    if ($l -match 'id="btn-zoom-in"') { $already = $true; break }
}
if ($already) {
    Write-Host "SKIP 15b: already applied" -ForegroundColor Yellow
    exit 0
}

$anchorIdx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'id="btn-scenario-time"') {
        $anchorIdx = $i
        break
    }
}

if ($anchorIdx -lt 0) {
    Write-Host "ERROR 15b: btn-scenario-time not found" -ForegroundColor Red
    exit 1
}

# ASCII-only button markup. Russian titles will be added separately.
$zoomButtons = @(
    '<span class="header-sep"></span>',
    '<button class="btn btn-mode btn-icon" id="btn-zoom-out" title="Zoom out (Ctrl+-)">-</button>',
    '<button class="btn btn-secondary" id="btn-zoom-reset" title="Reset zoom (Ctrl+0)" style="min-width:52px;font-size:11px;">100%</button>',
    '<button class="btn btn-mode btn-icon" id="btn-zoom-in" title="Zoom in (Ctrl++)">+</button>'
)

$out = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt $lines.Length; $i++) {
    [void]$out.Add($lines[$i])
    if ($i -eq $anchorIdx) {
        foreach ($zb in $zoomButtons) { [void]$out.Add($zb) }
    }
}

[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host "OK 15b: zoom buttons inserted" -ForegroundColor Green
Write-Host "DONE: $path updated" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT: translate titles manually in Notepad++ (see below)" -ForegroundColor Yellow