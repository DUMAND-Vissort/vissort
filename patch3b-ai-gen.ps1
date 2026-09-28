# patch3b-ai-gen.ps1
# Re-applies all 4 fixes for vissort-ai-generator.js, with UTF-8 read/write
# and ASCII-only anchors (no Cyrillic).

$ErrorActionPreference = "Stop"

$path = "vissort-ai-generator.js"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
$raw = [System.IO.File]::ReadAllText((Resolve-Path $path), $utf8)
$useCRLF = $raw.Contains("`r`n")
$nl = if ($useCRLF) { "`r`n" } else { "`n" }
Write-Host "Line endings: $(if ($useCRLF) {'CRLF'} else {'LF'})" -ForegroundColor Gray

# ============ 3.1: callGenerate ============
if ($raw.Contains('sessionRes.data.session.access_token')) {
    Write-Host "SKIP 3.1: already applied" -ForegroundColor Yellow
} else {
    $startMarker = "async function callGenerate(prompt) {"
    $endMarker = "function mapNodeType(t) {"

    $startIdx = $raw.IndexOf($startMarker)
    $endIdx = if ($startIdx -ge 0) { $raw.IndexOf($endMarker, $startIdx) } else { -1 }

    if ($startIdx -lt 0 -or $endIdx -lt 0) {
        Write-Host "ERROR 3.1: markers not found (callGenerate / mapNodeType)" -ForegroundColor Red
        exit 1
    }

    $before = $raw.Substring(0, $startIdx)
    $after = $raw.Substring($endIdx)

    $newBody = @(
        "async function callGenerate(prompt) {",
        "        const sb = window.supabaseClient || (window.supabase && window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));",
        "        if (!sb) throw new Error('Supabase client not initialized');",
        "        const sessionRes = await sb.auth.getSession();",
        "        const token = sessionRes && sessionRes.data && sessionRes.data.session && sessionRes.data.session.access_token;",
        "        if (!token) throw new Error('Not authorized. Please sign in as admin.');",
        "",
        "        const res = await fetch(FN_URL, {",
        "            method: 'POST',",
        "            headers: {",
        "                'Content-Type': 'application/json',",
        "                'Authorization': 'Bearer ' + token,",
        "                'apikey': SUPABASE_ANON_KEY",
        "            },",
        "            body: JSON.stringify({",
        "                prompt: prompt,",
        "                schema: { type: 'object' },",
        "                temperature: 0.7",
        "            })",
        "        });",
        "",
        "        if (!res.ok) {",
        "            let msg = 'HTTP ' + res.status;",
        "            try {",
        "                const j = await res.json();",
        "                if (j && j.error) msg = j.error + (j.details ? ' - ' + String(j.details).slice(0, 200) : '');",
        "            } catch (_) {",
        "                try { const t = await res.text(); if (t) msg += ': ' + t.slice(0, 200); } catch (_) {}",
        "            }",
        "            throw new Error(msg);",
        "        }",
        "        return await res.json();",
        "    }",
        "",
        "    "
    ) -join $nl

    $raw = $before + $newBody + $after
    Write-Host "OK 3.1: callGenerate replaced" -ForegroundColor Green
}

# ============ 3.2: createNodesFromAI ============
if ($raw.Contains('let nodesArr;')) {
    Write-Host "SKIP 3.2: already applied" -ForegroundColor Yellow
} else {
    $startMarker = "function createNodesFromAI(data) {"
    $endMarker = "const Editor = window.AppEditorCore;"

    $startIdx = $raw.IndexOf($startMarker)
    $endIdx = if ($startIdx -ge 0) { $raw.IndexOf($endMarker, $startIdx) } else { -1 }

    if ($startIdx -lt 0 -or $endIdx -lt 0) {
        Write-Host "ERROR 3.2: markers not found (createNodesFromAI / Editor)" -ForegroundColor Red
        exit 1
    }

    $before = $raw.Substring(0, $startIdx)
    $after = $raw.Substring($endIdx)

    $newBody = @(
        "function createNodesFromAI(data) {",
        "        let nodesArr;",
        "        if (Array.isArray(data)) {",
        "            nodesArr = data;",
        "        } else if (data && Array.isArray(data.nodes)) {",
        "            nodesArr = data.nodes;",
        "        } else {",
        "            throw new Error('AI response does not contain nodes array');",
        "        }",
        "        if (nodesArr.length === 0) {",
        "            throw new Error('AI returned empty nodes array');",
        "        }",
        "        "
    ) -join $nl

    $raw = $before + $newBody + $after
    Write-Host "OK 3.2: createNodesFromAI replaced" -ForegroundColor Green
}

# ============ 3.3: data.nodes.forEach -> nodesArr.forEach ============
if ($raw.Contains('nodesArr.forEach((n, i) => {')) {
    Write-Host "SKIP 3.3: already applied" -ForegroundColor Yellow
} elseif ($raw.Contains('data.nodes.forEach((n, i) => {')) {
    $raw = $raw.Replace('data.nodes.forEach((n, i) => {', 'nodesArr.forEach((n, i) => {')
    Write-Host "OK 3.3: forEach replaced" -ForegroundColor Green
} else {
    Write-Host "ERROR 3.3: data.nodes.forEach not found" -ForegroundColor Red
    exit 1
}

# ============ 3.4: dead res.ok check ============
if ($raw.Contains("throw new Error(res.error || 'Unknown generation error');")) {
    Write-Host "SKIP 3.4: already applied" -ForegroundColor Yellow
} else {
    $pattern = 'throw new Error\(res\.error \+ \(res\.details \?.*?: ''''\)\);'
    if ([regex]::IsMatch($raw, $pattern)) {
        $raw = [regex]::Replace($raw, $pattern, "throw new Error(res.error || 'Unknown generation error');")
        Write-Host "OK 3.4: dead check replaced" -ForegroundColor Green
    } else {
        Write-Host "SKIP 3.4: pattern not found (maybe already fixed or line differs)" -ForegroundColor Yellow
    }
}

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, $utf8)
Write-Host ""
Write-Host "DONE: $path updated" -ForegroundColor Cyan