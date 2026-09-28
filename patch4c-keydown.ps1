# patch4c-keydown.ps1
# player-runtime.js: in compare-mode ignore Up/Down keys.

$ErrorActionPreference = "Stop"

$path = "player-runtime.js"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$raw = [System.IO.File]::ReadAllText((Resolve-Path $path), $utf8)
$useCRLF = $raw.Contains("`r`n")
$nl = if ($useCRLF) { "`r`n" } else { "`n" }
Write-Host "Line endings: $(if ($useCRLF) {'CRLF'} else {'LF'})" -ForegroundColor Gray

if ($raw.Contains('[PATCH4C]')) {
    Write-Host "SKIP 4C: keydown already patched" -ForegroundColor Yellow
    exit 0
}

$anchor = @(
    "    if (!responsePhaseActive) return;",
    "    const map = {"
) -join $nl

if (-not $raw.Contains($anchor)) {
    Write-Host "ERROR 4C: keydown anchor not found" -ForegroundColor Red
    exit 1
}

$repl = @(
    "    if (!responsePhaseActive) return;",
    "    // [PATCH4C] compare-mode: ignore Up/Down (only Left/Right = Da/Net)",
    "    if (((graphActive && gCurrentCompareNode) || (!graphActive && userScenario?.params?.trainingType === 'compare')) && compareMode === 'direction' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;",
    "    const map = {"
) -join $nl

$raw = $raw.Replace($anchor, $repl)
Write-Host "OK 4C: keydown patched" -ForegroundColor Green

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, $utf8)
Write-Host ""
Write-Host "DONE: $path updated (part C)" -ForegroundColor Cyan