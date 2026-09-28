# patch2-app.ps1
# Adds window.supabaseClient export and params.ppi in saveGraph.

$ErrorActionPreference = "Stop"

$path = "app.js"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$raw = [System.IO.File]::ReadAllText((Resolve-Path $path))
$useCRLF = $raw.Contains("`r`n")

# --- Replacement 1: export supabaseClient to window ---
$old1 = 'supabaseClient.auth.getSession().then(({ data }) => {'
$new1 = "window.supabaseClient = supabaseClient;`r`nsupabaseClient.auth.getSession().then(({ data }) => {"
if (-not $useCRLF) { $new1 = $new1 -replace "`r`n", "`n" }

if (-not $raw.Contains($old1)) {
    Write-Host "ERROR 2.1: initSupabase anchor not found" -ForegroundColor Red
    Write-Host "Trying alternative anchor..." -ForegroundColor Yellow
    $alt = 'supabaseClient = window.supabase.createClient('
    if ($raw.Contains($alt)) {
        Write-Host "Alternative anchor exists, but script needs manual fix. Send output to operator." -ForegroundColor Yellow
    }
    exit 1
}
if ($raw.Contains('window.supabaseClient = supabaseClient;')) {
    Write-Host "SKIP 2.1: already applied" -ForegroundColor Yellow
} else {
    $raw = $raw.Replace($old1, $new1)
    Write-Host "OK 2.1: window.supabaseClient exported" -ForegroundColor Green
}

# --- Replacement 2: add ppi to saveGraph params ---
$old2 = "                },`r`n                distances: {`r`n                    general: generalDistance,"
if (-not $useCRLF) { $old2 = $old2 -replace "`r`n", "`n" }

$new2 = "                },`r`n                ppi: screenPPI || 96,`r`n                distances: {`r`n                    general: generalDistance,"
if (-not $useCRLF) { $new2 = $new2 -replace "`r`n", "`n" }

if (-not $raw.Contains($old2)) {
    Write-Host "ERROR 2.2: saveGraph distances anchor not found" -ForegroundColor Red
    exit 1
}
if ($raw.Contains("ppi: screenPPI || 96,")) {
    Write-Host "SKIP 2.2: already applied" -ForegroundColor Yellow
} else {
    $raw = $raw.Replace($old2, $new2)
    Write-Host "OK 2.2: ppi added to saveGraph" -ForegroundColor Green
}

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, [System.Text.UTF8Encoding]::new($false))
Write-Host ""
Write-Host "DONE: $path updated" -ForegroundColor Cyan