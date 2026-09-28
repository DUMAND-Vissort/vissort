# patch3-ai-gen.ps1
# Fixes for vissort-ai-generator.js:
#   1. callGenerate: use session token, pass schema, parse errors
#   2. createNodesFromAI: accept array OR object
#   3. replace data.nodes.forEach with nodesArr.forEach
#   4. remove dead res.ok check

$ErrorActionPreference = "Stop"

$path = "vissort-ai-generator.js"
if (-not (Test-Path $path)) {
    Write-Host "ERROR: file not found: $path" -ForegroundColor Red
    exit 1
}

$raw = [System.IO.File]::ReadAllText((Resolve-Path $path))
$useCRLF = $raw.Contains("`r`n")
Write-Host "Line endings: $(if ($useCRLF) {'CRLF'} else {'LF'})" -ForegroundColor Gray

# ============ Replacement 1: callGenerate ============
$old1 = @'
    async function callGenerate(prompt) {
        const res = await fetch(FN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ prompt })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 200));
        }
        return await res.json();
    }
'@

$new1 = @'
    async function callGenerate(prompt) {
        const sb = window.supabaseClient || (window.supabase && window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
        if (!sb) throw new Error('Supabase client not initialized');
        const sessionRes = await sb.auth.getSession();
        const token = sessionRes && sessionRes.data && sessionRes.data.session && sessionRes.data.session.access_token;
        if (!token) throw new Error('Not authorized. Please sign in as admin.');

        const res = await fetch(FN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                prompt: prompt,
                schema: { type: 'object' },
                temperature: 0.7
            })
        });

        if (!res.ok) {
            let msg = 'HTTP ' + res.status;
            try {
                const j = await res.json();
                if (j && j.error) msg = j.error + (j.details ? ' - ' + String(j.details).slice(0, 200) : '');
            } catch (_) {
                try { const t = await res.text(); if (t) msg += ': ' + t.slice(0, 200); } catch (_) {}
            }
            throw new Error(msg);
        }
        return await res.json();
    }
'@

if ($useCRLF) {
    $old1 = $old1 -replace "`r`n", "`r`n"
    $new1 = $new1 -replace "`r`n", "`r`n"
} else {
    $old1 = $old1 -replace "`r`n", "`n"
    $new1 = $new1 -replace "`r`n", "`n"
}

if ($raw.Contains('sessionRes.data.session.access_token')) {
    Write-Host "SKIP 3.1: callGenerate already patched" -ForegroundColor Yellow
} elseif (-not $raw.Contains($old1)) {
    Write-Host "ERROR 3.1: callGenerate anchor not found" -ForegroundColor Red
    Write-Host "Search manually in file: 'async function callGenerate(prompt)'" -ForegroundColor Yellow
    exit 1
} else {
    $raw = $raw.Replace($old1, $new1)
    Write-Host "OK 3.1: callGenerate replaced" -ForegroundColor Green
}

# ============ Replacement 2: createNodesFromAI header ============
$old2 = @'
    function createNodesFromAI(data) {
        if (!data || !Array.isArray(data.nodes)) {
            throw new Error('Нет поля nodes в ответе');
        }
        const Editor = window.AppEditorCore;
'@

$new2 = @'
    function createNodesFromAI(data) {
        let nodesArr;
        if (Array.isArray(data)) {
            nodesArr = data;
        } else if (data && Array.isArray(data.nodes)) {
            nodesArr = data.nodes;
        } else {
            throw new Error('AI response does not contain nodes array');
        }
        if (nodesArr.length === 0) {
            throw new Error('AI returned empty nodes array');
        }
        const Editor = window.AppEditorCore;
'@

if ($useCRLF) {
    # nothing, keep CRLF in both
} else {
    $old2 = $old2 -replace "`r`n", "`n"
    $new2 = $new2 -replace "`r`n", "`n"
}

if ($raw.Contains('let nodesArr;')) {
    Write-Host "SKIP 3.2: createNodesFromAI already patched" -ForegroundColor Yellow
} elseif (-not $raw.Contains($old2)) {
    Write-Host "ERROR 3.2: createNodesFromAI anchor not found" -ForegroundColor Red
    Write-Host "Search manually in file: 'function createNodesFromAI(data)'" -ForegroundColor Yellow
    exit 1
} else {
    $raw = $raw.Replace($old2, $new2)
    Write-Host "OK 3.2: createNodesFromAI replaced" -ForegroundColor Green
}

# ============ Replacement 3: forEach -> nodesArr.forEach ============
$old3 = 'data.nodes.forEach((n, i) => {'
$new3 = 'nodesArr.forEach((n, i) => {'

if ($raw.Contains($new3)) {
    Write-Host "SKIP 3.3: forEach already replaced" -ForegroundColor Yellow
} elseif (-not $raw.Contains($old3)) {
    Write-Host "ERROR 3.3: data.nodes.forEach not found" -ForegroundColor Red
    exit 1
} else {
    $raw = $raw.Replace($old3, $new3)
    Write-Host "OK 3.3: forEach replaced" -ForegroundColor Green
}

# ============ Replacement 4: dead res.ok check ============
$old4 = "throw new Error(res.error + (res.details ? ' ' + res.details : ''));"
$new4 = "throw new Error(res.error || 'Unknown generation error');"

if ($raw.Contains($new4)) {
    Write-Host "SKIP 3.4: dead check already fixed" -ForegroundColor Yellow
} elseif (-not $raw.Contains($old4)) {
    # try alternate variant with em-dash
    $old4b = [char]0x2014
    $old4alt = "throw new Error(res.error + (res.details ? ' " + $old4b + " ' + res.details : ''));"
    if ($raw.Contains($old4alt)) {
        $raw = $raw.Replace($old4alt, $new4)
        Write-Host "OK 3.4: dead check replaced (em-dash variant)" -ForegroundColor Green
    } else {
        Write-Host "SKIP 3.4: dead check not found (maybe already fixed)" -ForegroundColor Yellow
    }
} else {
    $raw = $raw.Replace($old4, $new4)
    Write-Host "OK 3.4: dead check replaced" -ForegroundColor Green
}

[System.IO.File]::WriteAllText((Resolve-Path $path), $raw, [System.Text.UTF8Encoding]::new($false))
Write-Host ""
Write-Host "DONE: $path updated" -ForegroundColor Cyan