# patch15a-node-buttons.ps1
# admin.html: node buttons become vertical (column layout).

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
    if ($l -match 'PATCH15A') { $already = $true; break }
}
if ($already) {
    Write-Host "SKIP 15a: already applied" -ForegroundColor Yellow
    exit 0
}

# Find the PATCH14B style block closing tag
$anchorIdx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].Trim() -eq '</style>' -and $i -gt 0) {
        # Check that above is our PATCH14B style
        $found14b = $false
        for ($j = [Math]::Max(0, $i - 30); $j -lt $i; $j++) {
            if ($lines[$j] -match 'PATCH14B') { $found14b = $true; break }
        }
        if ($found14b) {
            $anchorIdx = $i
            break
        }
    }
}

if ($anchorIdx -lt 0) {
    Write-Host "ERROR 15a: PATCH14B style block not found" -ForegroundColor Red
    exit 1
}

# Insert new style block right after
$newCss = @(
    '<!-- PATCH15A: vertical node buttons -->',
    '<style id="patch15a-node-buttons">',
    '.node-body {',
    '    display: flex !important;',
    '    flex-direction: column !important;',
    '    gap: 2px !important;',
    '    padding: 3px !important;',
    '    border-top: 1px solid #2a2a3a !important;',
    '    flex-wrap: nowrap !important;',
    '}',
    '.node-btn {',
    '    width: 100% !important;',
    '    padding: 2px 4px !important;',
    '    font-size: 8px !important;',
    '    text-align: center !important;',
    '    white-space: nowrap !important;',
    '}',
    '</style>'
)

$out = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt $lines.Length; $i++) {
    [void]$out.Add($lines[$i])
    if ($i -eq $anchorIdx) {
        foreach ($cl in $newCss) { [void]$out.Add($cl) }
    }
}

[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host "OK 15a: node buttons vertical style inserted" -ForegroundColor Green
Write-Host "DONE: $path updated" -ForegroundColor Cyan