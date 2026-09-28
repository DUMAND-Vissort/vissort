# patch18c-fix-emoji.ps1
# admin.html: rewrite btn-new line with proper UTF-8 emoji bytes.

$ErrorActionPreference = "Stop"

$path = "admin.html"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$lines = [System.IO.File]::ReadAllLines((Resolve-Path $path), $utf8)
Write-Host "Lines: $($lines.Length)" -ForegroundColor Gray

# Build correct emoji via code point (survives PS 5.1 encoding issues)
$emoji = [char]::ConvertFromUtf32(0x1F195)  # U+1F195 = NEW button symbol

$fixed = $false
$out = New-Object System.Collections.ArrayList
foreach ($line in $lines) {
    if (-not $fixed -and $line -match 'id="btn-new"') {
        # Preserve everything up to and including the ">", replace content, keep "</button>..."
        if ($line -match '^(.*?id="btn-new".*?>)(.*?)(</button>.*)$') {
            $newLine = $matches[1] + $emoji + $matches[3]
            [void]$out.Add($newLine)
            $fixed = $true
            Write-Host "  fixed line: $($newLine.Trim())" -ForegroundColor Gray
        } else {
            [void]$out.Add($line)
        }
    } else {
        [void]$out.Add($line)
    }
}

if (-not $fixed) {
    Write-Host "ERROR 18c: btn-new line not found" -ForegroundColor Red
    exit 1
}

[System.IO.File]::WriteAllLines((Resolve-Path $path), $out, $utf8)
Write-Host "OK 18c: emoji fixed" -ForegroundColor Green
Write-Host "DONE: $path updated" -ForegroundColor Cyan