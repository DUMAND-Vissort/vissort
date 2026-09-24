// ==================== user.js: Начало части 1 из 4 ====================
'use strict';

const SUPABASE_URL = 'https://hzvypwdpdhsjzaclxmbm.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6dnlwd2RwZGhzanphY2x4bWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjIyNTIsImV4cCI6MjEwNDE5ODI1Mn0.HK0VE9KdzS8c7WoMCIlvOUn02vSOQEN0ahGPgsYzKac';

let supabaseClient = null;
let currentUser = null;
let userScenarios = [];
let userScenario = null;
let sessionId = null;
let authMode = 'signin';

let playerRunning = false;
let isPaused = false;
let phaseTimers = [];
let currentShowTimer = null;
let responsePhaseActive = false;
let responseStartTime = 0;
let lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
let currentCorrectDirection = null;
let lastDirection = null;

let completedSeries = 0,
    successfulSeries = 0,
    failedSeries = 0;
let seriesCorrect = 0,
    seriesIncorrect = 0,
    seriesNoAnswer = 0;
let seriesStep = 0,
    noAnswerSeriesStreak = 0;
let currentAcuity = 1.0;
let currentStimColor = { r: 0, g: 255, b: 0 };
let currentBgColor = { r: 0, g: 0, b: 0 };
let currentSize = 27;
let currentDuration = 2550;
let currentSingleCell = { row: 0, col: 0 };
let compareMode = 'direction',
    gridX = 3,
    gridY = 3;
let activeCells = [],
    cellParams = [];
let currentCompareAnswer = null;
let _findSameState = null;

let singleStimAnimId = null,
    singleBgAnimId = null;
let singleStimAnimStart = null,
    singleBgAnimStart = null;
let _circleAnimId = null,
    _circleAnimStart = null;
let _circleInnerPhases = null,
    _circleOuterPhases = null;
let _circleInnerDurationMs = 10000,
    _circleOuterDurationMs = 10000;
let _circleInnerLoop = true,
    _circleOuterLoop = true;
let _periAnimId = null,
    _periAnimStart = null;

// --- МОРГАНИЕ ---
let _blinkTimerId = null;
let _blinkLocalState = { tick: 0, current: 'A' };

let readingPage = 0,
    readingTotalPages = 1,
    readingPaused = false;
let readingBgAnimId = null,
    readingBgAnimStart = null,
    readingBgAnimPausedAt = null;

let camStream = null,
    camActive = false,
    camFrameId = null;
let focalLengthPx = parseFloat(localStorage.getItem('focalLengthPx') || '0') || null;
const realIPD_MM = 63;
let lastEyeDistPx = null;
let curDistanceM = null;
let camBaseline = null;
let camWarnKind = null;
let _blinkClosedSince = 0;
let _blinkIsClosed = false;
const BLINK_THRESHOLD = 0.21;

// === ПЛЕЕР ГРАФА (объявления ДО первого использования в updateCounters) ===
let graphActive = false;
let gNodes = [];
let gConnections = [];
let gQueue = [];
let gIndex = 0;
let gCurrentNodeId = null;
let gNodeAcuityCurrent = 1.0;
let gCurrentCompareNode = null;

// ==================== RATE LIMIT ====================
let _answerTimestamps = [];
function checkRateLimit() {
    const now = Date.now();
    _answerTimestamps = _answerTimestamps.filter((t) => now - t < 60000);
    if (_answerTimestamps.length >= 100) {
        console.warn('[rate-limit] Слишком много ответов в минуту');
        return false;
    }
    _answerTimestamps.push(now);
    return true;
}

// ==================== SCENARIO VALIDATION ====================
function validateScenario(scenario) {
    if (!scenario || typeof scenario !== 'object') return false;
    const p = scenario.params;
    if (!p || typeof p !== 'object') return false;

    if (p.graph) {
        if (!Array.isArray(p.graph.nodes)) return false;
        if (p.graph.nodes.length > 500) return false;
        for (const node of p.graph.nodes) {
            if (typeof node.id !== 'string') return false;
            if (typeof node.x !== 'number' || node.x < -100000 || node.x > 100000) return false;
            if (typeof node.y !== 'number' || node.y < -100000 || node.y > 100000) return false;
            if (node.width && (node.width < 0 || node.width > 10000)) return false;
            if (node.height && (node.height < 0 || node.height > 10000)) return false;
            if (node.seriesCount && (node.seriesCount < 0 || node.seriesCount > 1000)) return false;
            if (node.seriesSize && (node.seriesSize < 0 || node.seriesSize > 1000)) return false;
            if (node.duration && (node.duration < 0 || node.duration > 3600000)) return false;
        }
    }

    if (p.graph && p.graph.books) {
        for (const id of Object.keys(p.graph.books)) {
            const book = p.graph.books[id];
            if (typeof book.text === 'string' && book.text.length > 10000000) {
                console.warn('Книга слишком большая:', id);
                return false;
            }
        }
    }

    if (p.distanceMeters && (p.distanceMeters < 0.01 || p.distanceMeters > 100)) return false;
    if (p.ppi && (p.ppi < 20 || p.ppi > 2000)) return false;

    return true;
}

const $ = (id) => document.getElementById(id);
const stimDisplay = $('stim');
const stimArea = $('stim-display');
const responseButtons = $('response-buttons');
const hdrScenario = $('hdr-scenario');
const hdrUser = $('hdr-user');
const statusOverlay = $('status-overlay');
const statusTitle = $('status-title');
const statusText = $('status-text');
const statusAction = $('status-action');
const authModal = $('auth-modal');
const pauseModal = $('pause-modal');
const btnPlayer = $('btn-player');
const btnPlayerPause = $('btn-player-pause');
const btnPlayerStop = $('btn-player-stop');
const btnLogout = $('btn-logout');
const btnHistory = $('btn-history');
const cntProgress = $('cnt-series-progress');
const cntAcuity = $('cnt-acuity');
const cntCorrect = $('cnt-correct');
const cntIncorrect = $('cnt-incorrect');
const cntNoAnswer = $('cnt-noanswer');
const readingViewportEl = $('reading-viewport');
const readingContentEl = $('reading-content');
const readingToolbarEl = $('reading-toolbar');
const camIndicator = $('cam-indicator');

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}
function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 0, g: 0, b: 0 };
}
function rgbToHex(r, g, b) {
    const s = (c) => Math.min(255, Math.max(0, c || 0));
    return '#' + [s(r), s(g), s(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
}
function lerpColor(a, b, t) {
    return {
        r: Math.round(a.r + (b.r - a.r) * t),
        g: Math.round(a.g + (b.g - a.g) * t),
        b: Math.round(a.b + (b.b - a.b) * t)
    };
}
function getThreshold(size) {
    switch (size) {
        case 4:
            return 3;
        case 5:
            return 4;
        case 6:
            return 4;
        case 7:
            return 5;
        case 8:
            return 6;
        default:
            return Math.ceil(size / 2);
    }
}
function randomDirection() {
    const d = ['вверх', 'вниз', 'влево', 'вправо'];
    return d[Math.floor(Math.random() * d.length)];
}
function acuityToSizeMm(a, d) {
    d = d && d > 0 ? d : 1;
    const V = Math.max(0.01, a || 1);
    return (d * 1.454) / V;
}
function acuityToSizePx(a, d, ppi) {
    const mm = acuityToSizeMm(a, d);
    const dpr = window.devicePixelRatio || 1;
    const p = (mm * (ppi || 96)) / 25.4;
    return Math.round(Math.max(1, Math.min(3000, p / dpr)));
}
function acuityToFontSizePx(a, d, ppi) {
    const xh = acuityToSizeMm(a, d);
    const mm = xh / 0.5;
    const dpr = window.devicePixelRatio || 1;
    const p = (mm * (ppi || 96)) / 25.4;
    return Math.round(Math.max(8, Math.min(2000, p / dpr)));
}
function detectDeviceType() {
    const ua = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';
    if (/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua)) return 'mobile';
    return 'desktop';
}
function detectPPIHeuristic() {
    const t = detectDeviceType(),
        dpr = window.devicePixelRatio || 1;
    if (t === 'mobile') {
        if (dpr >= 3.5) return 500;
        if (dpr >= 3) return 460;
        if (dpr >= 2.75) return 400;
        if (dpr >= 2) return 320;
        return 220;
    }
    if (t === 'tablet') return dpr >= 2 ? 264 : 160;
    return Math.round(96 * dpr);
}
function loadPPI() {
    const s = localStorage.getItem('screenPPI');
    return s && !isNaN(parseInt(s)) ? parseInt(s) : detectPPIHeuristic();
}
let screenPPI = loadPPI();

function showStatus(title, text, actionLabel, actionFn) {
    statusTitle.textContent = title;
    statusText.textContent = text || '';
    statusAction.classList.toggle('hidden', !actionLabel);
    statusAction.onclick = actionFn || null;
    if (actionLabel) statusAction.textContent = actionLabel;
    statusOverlay.classList.remove('hidden');
}
function hideStatus() {
    statusOverlay.classList.add('hidden');
}

function initSupabase() {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabaseClient.auth.getSession().then(({ data }) => {
        currentUser = data?.session?.user || null;
        if (currentUser) onLoggedIn();
        else promptLogin();
    });
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        if (event === 'SIGNED_OUT') promptLogin();
    });
}
function promptLogin() {
    hideStatus();
    authMode = 'signin';
    updateAuthModal();
    authModal.classList.add('open');
    hdrUser.textContent = '—';
    hdrScenario.textContent = '—';
    btnPlayer.disabled = true;
}
function updateAuthModal() {
    const t = $('auth-title'),
        tb = $('auth-toggle'),
        sb = $('auth-submit');
    if (authMode === 'signin') {
        t.textContent = 'Вход';
        tb.textContent = 'Регистрация';
        sb.textContent = 'Войти';
    } else {
        t.textContent = 'Регистрация';
        tb.textContent = 'Уже есть аккаунт';
        sb.textContent = 'Зарегистрироваться';
    }
}
async function doAuth() {
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;
    if (!email || !password) {
        alert('Введите email и пароль');
        return;
    }
    if (authMode === 'signin') {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            alert('Ошибка: ' + error.message);
            return;
        }
    } else {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
            alert('Ошибка: ' + error.message);
            return;
        }
    }
    authModal.classList.remove('open');
}
async function onLoggedIn() {
    authModal.classList.remove('open');
    hdrUser.textContent = currentUser.email || '—';
    showStatus('Загрузка сценария…', 'Читаем назначения.');
    userScenarios = await loadUserScenarios();
    if (!userScenarios.length) {
        showStatus('Сценарий не назначен', 'Обратитесь к администратору.', 'Обновить', () => onLoggedIn());
        return;
    }
    if (userScenarios.length === 1) {
        userScenario = userScenarios[0];
        hdrScenario.textContent = userScenario.name || 'Сценарий';
        applyScenarioDefaults();
        updateCounters();
        hideStatus();
        btnPlayer.disabled = false;
    } else {
        openScenarioPicker();
        hideStatus();
    }
    if (userScenario?.params?.cameraCheck) {
        if (typeof VissortDevice !== 'undefined' && typeof Onboarding !== 'undefined') {
            try {
                const fp = await VissortDevice.getFingerprint();
                VissortDevice.setCurrent(fp);
                await Onboarding.start({
                    client: supabaseClient,
                    userId: currentUser ? currentUser.id : null,
                    onDone: () => enableCamera()
                });
            } catch (e) {
                console.warn('[user] onboarding:', e);
                enableCamera();
            }
        } else {
            enableCamera();
        }
    }
}
async function loadUserScenarios() {
    const { data: assigns, error: e1 } = await supabaseClient
        .from('user_scenarios')
        .select('scenario_id')
        .eq('user_id', currentUser.id);
    if (e1) {
        console.error('[user] user_scenarios:', e1);
        return [];
    }
    if (!assigns || !assigns.length) return [];
    const ids = assigns.map((a) => a.scenario_id);
    const { data: list, error: e2 } = await supabaseClient
        .from('scenarios')
        .select('id,name,training_type,params')
        .in('id', ids);
    if (e2) {
        console.error('[user] scenarios:', e2);
        return [];
    }
    return (list || []).map((s) => ({
        id: s.id,
        name: s.name,
        params: s.params || {},
        trainingType: s.training_type
    }));
}

function openScenarioPicker() {
    const list = $('scenario-list');
    list.innerHTML = '';
    userScenarios.forEach((s) => {
        const el = document.createElement('div');
        el.className = 'scenario-item' + (userScenario && userScenario.id === s.id ? ' active' : '');
        el.innerHTML = `<div><div style="font-weight:600">${escapeHtml(s.name)}</div><div style="font-size:11px;color:#9ca3af">${escapeHtml(s.trainingType || 'single')}</div></div><div>▶</div>`;
        el.addEventListener('click', () => {
            userScenario = s;
            hdrScenario.textContent = s.name;
            applyScenarioDefaults();
            updateCounters();
            $('scenario-modal').classList.remove('open');
            btnPlayer.disabled = false;
            if (s.params?.cameraCheck) enableCamera();
        });
        list.appendChild(el);
    });
    $('scenario-modal').classList.add('open');
}

async function openHistory() {
    $('history-modal').classList.add('open');
    const body = $('history-body');
    body.textContent = 'Загрузка…';
    const { data, error } = await supabaseClient
        .from('test_results')
        .select('session_id,node_id,response_time_ms,is_correct,created_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(200);
    if (error) {
        body.innerHTML = `<div style="color:#dc2626">Ошибка: ${escapeHtml(error.message)}</div>`;
        return;
    }
    if (!data || !data.length) {
        body.innerHTML = '<div>Пока нет результатов.</div>';
        return;
    }
    const groups = {};
    data.forEach((r) => {
        const k = r.session_id || '—';
        if (!groups[k]) groups[k] = { total: 0, ok: 0, when: r.created_at };
        groups[k].total++;
        if (r.is_correct) groups[k].ok++;
    });
    const rows = Object.entries(groups)
        .slice(0, 30)
        .map(([sid, g]) => {
            const d = new Date(g.when);
            const when = d.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            const pct = Math.round((g.ok / g.total) * 100);
            return `<tr><td>${when}</td><td>${g.ok}/${g.total}</td><td>${pct}%</td><td style="color:#6b7280;font-size:11px">${escapeHtml(String(sid).slice(0, 14))}…</td></tr>`;
        })
        .join('');
    body.innerHTML = `<table class="res-table"><thead><tr><th>Когда</th><th>Верно</th><th>%</th><th>Сессия</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function applyScenarioDefaults() {
    const p = userScenario?.params || {};
    screenPPI = p.ppi || screenPPI || 96;
    currentAcuity = p.trainingType === 'reading' ? 1.0 : p.startAcuity || 0.5;
    currentStimColor = p.startStimColor ? { ...p.startStimColor } : { r: 0, g: 255, b: 0 };
    currentBgColor = p.startBgColor ? { ...p.startBgColor } : { r: 0, g: 0, b: 0 };
}

function updateCounters() {
    let p, acuityVal;
    if (graphActive && gCurrentNodeId) {
        const n = gGetNode(gCurrentNodeId);
        p = n || {};
        acuityVal = gNodeAcuityCurrent;
    } else {
        p = userScenario?.params || {};
        acuityVal = currentAcuity;
    }
    const total = p.seriesSize || 6;
    cntProgress.textContent = `${seriesStep}/${total}`;
    cntAcuity.textContent =
        p.nodeType === 'READING' || p.trainingType === 'reading' ? '—' : (acuityVal || 1).toFixed(1);
    cntCorrect.textContent = seriesCorrect;
    cntIncorrect.textContent = seriesIncorrect;
    cntNoAnswer.textContent = seriesNoAnswer;
}

function generateLetterE(size, r, g, b, angle = 0) {
    const t = size / 5;
    const path = `M 0 0 H ${size} V ${t} H ${t} V ${2 * t} H ${size - t} V ${3 * t} H ${t} V ${4 * t} H ${size} V ${size} H 0 Z`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><g transform="rotate(${angle}, ${size / 2}, ${size / 2})"><path d="${path}" fill="rgb(${r},${g},${b})"/></g></svg>`;
}
function generateLandoltRing(diameter, gapDir, r, g, b, bgR, bgG, bgB) {
    const sw = diameter * 0.2,
        gw = diameter * 0.2,
        gl = diameter * 0.23,
        sm = Math.max(1, sw * 0.1);
    const or_ = diameter / 2,
        cx = diameter / 2,
        cy = diameter / 2;
    let rx, ry, rw, rh;
    if (gapDir === 'вверх' || gapDir === 'вниз') {
        rw = gw;
        rh = gl + sm;
        rx = cx - rw / 2;
        ry = gapDir === 'вверх' ? cy - or_ - sm : cy + or_ - rh + sm;
    } else {
        rw = gl + sm;
        rh = gw;
        ry = cy - rh / 2;
        rx = gapDir === 'вправо' ? cx + or_ - rw + sm : cx - or_ - sm;
    }
    return `<svg width="${diameter}" height="${diameter}" viewBox="0 0 ${diameter} ${diameter}" xmlns="http://www.w3.org/2000/svg"><circle cx="${cx}" cy="${cy}" r="${or_ - sw / 2}" fill="none" stroke="rgb(${r},${g},${b})" stroke-width="${sw}"/><rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="rgb(${bgR},${bgG},${bgB})"/></svg>`;
}
function getCircleStimulusSVG(node, size) {
    const uid = 'cg_' + Math.random().toString(36).slice(2, 8);
    const cx = size / 2,
        cy = size / 2,
        r = size / 2;
    const iEn = node.circleInnerEnabled !== false,
        oEn = node.circleOuterEnabled !== false;
    const innerR = Math.max(5, Math.min(95, node.circleInnerRadiusPct ?? 40));
    const iA = node.circleInnerColor1 || { r: 255, g: 0, b: 0 },
        iB = node.circleInnerColor2 || { r: 0, g: 0, b: 255 };
    const iMid = node.circleInnerMidEnabled ? node.circleInnerColor3 || { r: 255, g: 255, b: 0 } : null;
    const innerStops = [];
    if (iMid) {
        innerStops.push(`<stop offset="0%" stop-color="rgb(${iA.r},${iA.g},${iA.b})"/>`);
        innerStops.push(`<stop offset="50%" stop-color="rgb(${iMid.r},${iMid.g},${iMid.b})"/>`);
        innerStops.push(`<stop offset="100%" stop-color="rgb(${iB.r},${iB.g},${iB.b})"/>`);
    } else {
        innerStops.push(`<stop offset="0%" stop-color="rgb(${iA.r},${iA.g},${iA.b})"/>`);
        innerStops.push(`<stop offset="100%" stop-color="rgb(${iB.r},${iB.g},${iB.b})"/>`);
    }
    const oA = node.circleOuterColor1 || { r: 0, g: 255, b: 0 },
        oB = node.circleOuterColor2 || { r: 0, g: 128, b: 255 };
    const oMid = node.circleOuterMidEnabled ? node.circleOuterColor3 || { r: 0, g: 255, b: 255 } : null;
    const outerStops = [];
    outerStops.push(`<stop offset="0%" stop-color="rgb(${oA.r},${oA.g},${oA.b})" stop-opacity="0"/>`);
    outerStops.push(`<stop offset="${innerR}%" stop-color="rgb(${oA.r},${oA.g},${oA.b})" stop-opacity="1"/>`);
    if (oMid)
        outerStops.push(
            `<stop offset="${(innerR + 100) / 2}%" stop-color="rgb(${oMid.r},${oMid.g},${oMid.b})"/>`
        );
    outerStops.push(`<stop offset="100%" stop-color="rgb(${oB.r},${oB.g},${oB.b})"/>`);
    const innerCircle = iEn
        ? `<circle cx="${cx}" cy="${cy}" r="${(r * innerR) / 100}" fill="url(#${uid}_i)"/>`
        : '';
    const outerCircle = oEn ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${uid}_o)"/>` : '';
    const html = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${uid}_o" cx="50%" cy="50%" r="50%">${outerStops.join('')}</radialGradient><radialGradient id="${uid}_i" cx="50%" cy="50%" r="50%">${innerStops.join('')}</radialGradient></defs>${outerCircle}${innerCircle}</svg>`;
    return { html, bgColor: `rgb(${node.bgR || 0},${node.bgG || 0},${node.bgB || 0})`, size };
}
function getStimulusSVG(node, size) {
    if (node.singleCircleEnabled) return getCircleStimulusSVG(node, size);
    const r = node.stimR || 255,
        g = node.stimG || 255,
        b = node.stimB || 255;
    let html;
    if (node.stimType === 'LANDOLT')
        html = generateLandoltRing(
            size,
            node.stimDirection || 'вверх',
            r,
            g,
            b,
            node.bgR || 0,
            node.bgG || 0,
            node.bgB || 0
        );
    else {
        const am = { вверх: 270, вправо: 0, вниз: 90, влево: 180 };
        html = generateLetterE(size, r, g, b, am[node.stimDirection] || 0);
    }
    return { html, bgColor: `rgb(${node.bgR || 0},${node.bgG || 0},${node.bgB || 0})`, size };
}
function setStimColorRGB(r, g, b) {
    const svg = stimDisplay.querySelector('svg');
    if (!svg) return;
    const c = `rgb(${r},${g},${b})`;
    const p = svg.querySelector('path');
    if (p) p.setAttribute('fill', c);
    const cc = svg.querySelector('circle');
    if (cc) cc.setAttribute('stroke', c);
}

function buildGenericDynamicPhases(c1, midEn, c3, c2, rev) {
    const A = c1 || { r: 255, g: 0, b: 0 },
        B = c2 || { r: 0, g: 0, b: 255 };
    let base =
        midEn && c3
            ? [
                  { from: A, to: c3 },
                  { from: c3, to: B }
              ]
            : [{ from: A, to: B }];
    if (rev === true)
        return base.concat(
            base
                .slice()
                .reverse()
                .map((ph) => ({ from: ph.to, to: ph.from }))
        );
    return base;
}
function startSingleStimAnimation(p) {
    stopSingleStimAnimation();
    const ph = buildGenericDynamicPhases(
        p.singleStimColor1,
        p.singleStimMidEnabled,
        p.singleStimColor3,
        p.singleStimColor2,
        p.singleStimReverse
    );
    const cnt = ph.length;
    if (!cnt) return;
    const total = Math.max(200, p.singleStimDuration || 10000);
    const cycMs = total;
    const loop = p.singleStimLoop === true;
    const first = ph[0].from;
    setStimColorRGB(first.r, first.g, first.b);
    singleStimAnimStart = null;
    function tick(now) {
        if (!playerRunning || isPaused) {
            singleStimAnimId = null;
            return;
        }
        if (singleStimAnimStart === null) singleStimAnimStart = now;
        let el = Math.max(0, now - singleStimAnimStart);
        let t = el / cycMs;
        if (t >= 1) {
            if (loop) {
                singleStimAnimStart += Math.floor(t) * cycMs;
                el = Math.max(0, now - singleStimAnimStart);
                t = el / cycMs;
            } else {
                const l = ph[cnt - 1].to;
                setStimColorRGB(l.r, l.g, l.b);
                singleStimAnimId = null;
                return;
            }
        }
        t = Math.max(0, t);
        const pi = Math.max(0, Math.min(cnt - 1, Math.floor(t * cnt)));
        const pp = Math.max(0, Math.min(1, t * cnt - pi));
        const P = ph[pi];
        if (!P) {
            singleStimAnimId = null;
            return;
        }
        const cur = lerpColor(P.from, P.to, pp);
        setStimColorRGB(cur.r, cur.g, cur.b);
        singleStimAnimId = requestAnimationFrame(tick);
    }
    singleStimAnimId = requestAnimationFrame(tick);
}
function stopSingleStimAnimation() {
    if (singleStimAnimId) {
        cancelAnimationFrame(singleStimAnimId);
        singleStimAnimId = null;
    }
}

function startSingleBgAnimation(p) {
    stopSingleBgAnimation();
    const ph = buildGenericDynamicPhases(
        p.singleBgColor1,
        p.singleBgMidEnabled,
        p.singleBgColor3,
        p.singleBgColor2,
        p.singleBgReverse
    );
    const cnt = ph.length;
    if (!cnt) return;
    const total = Math.max(200, p.singleBgDuration || 10000);
    const cycMs = total;
    const loop = p.singleBgLoop === true;
    const first = ph[0].from;
    stimArea.style.backgroundColor = `rgb(${first.r},${first.g},${first.b})`;
    singleBgAnimStart = null;
    function tick(now) {
        if (!playerRunning || isPaused) {
            singleBgAnimId = null;
            return;
        }
        if (singleBgAnimStart === null) singleBgAnimStart = now;
        let el = Math.max(0, now - singleBgAnimStart);
        let t = el / cycMs;
        if (t >= 1) {
            if (loop) {
                singleBgAnimStart += Math.floor(t) * cycMs;
                el = Math.max(0, now - singleBgAnimStart);
                t = el / cycMs;
            } else {
                const l = ph[cnt - 1].to;
                stimArea.style.backgroundColor = `rgb(${l.r},${l.g},${l.b})`;
                singleBgAnimId = null;
                return;
            }
        }
        t = Math.max(0, t);
        const pi = Math.max(0, Math.min(cnt - 1, Math.floor(t * cnt)));
        const pp = Math.max(0, Math.min(1, t * cnt - pi));
        const P = ph[pi];
        if (!P) {
            singleBgAnimId = null;
            return;
        }
        const cur = lerpColor(P.from, P.to, pp);
        stimArea.style.backgroundColor = `rgb(${cur.r},${cur.g},${cur.b})`;
        singleBgAnimId = requestAnimationFrame(tick);
    }
    singleBgAnimId = requestAnimationFrame(tick);
}
function stopSingleBgAnimation() {
    if (singleBgAnimId) {
        cancelAnimationFrame(singleBgAnimId);
        singleBgAnimId = null;
    }
}

// ==================== МОРГАНИЕ (анимация) ====================
function startBlinkAnimation(opts) {
    stopBlinkAnimation();
    if (!opts) return;
    const target = opts.target || 'stim';
    const A = opts.colorA || { r: 255, g: 0, b: 0 };
    const B = opts.colorB || { r: 0, g: 0, b: 255 };
    const intervalMs = Math.max(50, opts.intervalMs || 500);
    const duty = Math.max(0.05, Math.min(0.95, opts.duty ?? 0.5));
    const count = Math.max(0, opts.count || 0);

    _blinkLocalState = { tick: 0, current: 'A' };

    function apply(color) {
        if (target === 'stim' || target === 'both') setStimColorRGB(color.r, color.g, color.b);
        if (target === 'bg' || target === 'both')
            stimArea.style.backgroundColor = `rgb(${color.r},${color.g},${color.b})`;
    }

    function tick() {
        if (!playerRunning || isPaused) {
            _blinkTimerId = null;
            return;
        }
        const isA = _blinkLocalState.current === 'A';
        apply(isA ? A : B);
        _blinkLocalState.tick++;
        if (count > 0 && _blinkLocalState.tick >= count) {
            _blinkTimerId = null;
            return;
        }
        const nextIsA = !isA;
        const delay = nextIsA ? intervalMs * duty : intervalMs * (1 - duty);
        _blinkLocalState.current = nextIsA ? 'A' : 'B';
        _blinkTimerId = setTimeout(tick, Math.max(20, delay));
    }
    _blinkTimerId = setTimeout(tick, 0);
}

function stopBlinkAnimation() {
    if (_blinkTimerId) {
        clearTimeout(_blinkTimerId);
        _blinkTimerId = null;
    }
    _blinkLocalState = { tick: 0, current: 'A' };
}

function buildCirclePhases(A, midEn, M, B, rev) {
    let base =
        midEn && M
            ? [
                  { from: A, to: M },
                  { from: M, to: B }
              ]
            : [{ from: A, to: B }];
    if (rev === true)
        return base.concat(
            base
                .slice()
                .reverse()
                .map((ph) => ({ from: ph.to, to: ph.from }))
        );
    return base;
}
function startCircleAnimation(node) {
    stopCircleAnimation();
    const svg = stimDisplay.querySelector('svg');
    if (!svg) return;
    const grads = svg.querySelectorAll('radialGradient');
    if (grads.length < 2) return;
    const oG = grads[0],
        iG = grads[1];
    _circleInnerPhases = buildCirclePhases(
        node.circleInnerColor1,
        node.circleInnerMidEnabled,
        node.circleInnerColor3,
        node.circleInnerColor2,
        node.circleInnerReverse
    );
    _circleOuterPhases = buildCirclePhases(
        node.circleOuterColor1,
        node.circleOuterMidEnabled,
        node.circleOuterColor3,
        node.circleOuterColor2,
        node.circleOuterReverse
    );
    _circleInnerDurationMs = Math.max(200, node.circleInnerDuration || 10000);
    _circleOuterDurationMs = Math.max(200, node.circleOuterDuration || 10000);
    _circleInnerLoop = node.circleInnerLoop !== false;
    _circleOuterLoop = node.circleOuterLoop !== false;
    _circleAnimStart = null;
    function paint(g, phases, cyc, el) {
        if (!g) return;
        const cnt = phases.length;
        if (!cnt) return;
        let t = (el % cyc) / cyc;
        const pi = Math.max(0, Math.min(cnt - 1, Math.floor(t * cnt)));
        const pp = Math.max(0, Math.min(1, t * cnt - pi));
        const P = phases[pi];
        if (!P) return;
        const stops = g.querySelectorAll('stop');
        if (stops.length >= 2) {
            stops[0].setAttribute('stop-color', `rgb(${P.from.r},${P.from.g},${P.from.b})`);
            if (stops.length >= 3) {
                const m = lerpColor(P.from, P.to, 0.5);
                stops[1].setAttribute('stop-color', `rgb(${m.r},${m.g},${m.b})`);
                stops[stops.length - 1].setAttribute('stop-color', `rgb(${P.to.r},${P.to.g},${P.to.b})`);
            } else stops[stops.length - 1].setAttribute('stop-color', `rgb(${P.to.r},${P.to.g},${P.to.b})`);
        }
    }
    function tick(now) {
        if (!playerRunning || isPaused) {
            _circleAnimId = null;
            return;
        }
        if (_circleAnimStart === null) _circleAnimStart = now;
        const el = now - _circleAnimStart;
        const iD = !_circleInnerLoop && el > _circleInnerDurationMs;
        const oD = !_circleOuterLoop && el > _circleOuterDurationMs;
        if (iD && oD) {
            _circleAnimId = null;
            return;
        }
        if (!iD) paint(iG, _circleInnerPhases, _circleInnerDurationMs, el);
        if (!oD) paint(oG, _circleOuterPhases, _circleOuterDurationMs, el);
        _circleAnimId = requestAnimationFrame(tick);
    }
    _circleAnimId = requestAnimationFrame(tick);
}
function stopCircleAnimation() {
    if (_circleAnimId) {
        cancelAnimationFrame(_circleAnimId);
        _circleAnimId = null;
    }
    _circleInnerPhases = null;
    _circleOuterPhases = null;
}

function getPeripheralLayer() {
    let l = document.getElementById('peri-layer');
    if (!l) {
        l = document.createElement('div');
        l.id = 'peri-layer';
        l.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden;';
        if (getComputedStyle(stimArea).position === 'static') stimArea.style.position = 'relative';
        stimArea.appendChild(l);
    }
    return l;
}
function clearPeripheralLayer() {
    const l = document.getElementById('peri-layer');
    if (l) l.innerHTML = '';
}
function stopPeripheralAnimation() {
    if (_periAnimId) {
        cancelAnimationFrame(_periAnimId);
        _periAnimId = null;
    }
    _periAnimStart = null;
    clearPeripheralLayer();
}
function buildPeripheralDots(node) {
    clearPeripheralLayer();
    if (!node.periEnabled) return;
    const layer = getPeripheralLayer();
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    const count = Math.max(1, Math.min(12, node.periCount || 4));
    const pCalc = node.stimPPI || screenPPI || 96;
    const sizePx = acuityToSizePx(node.periAcuity || 0.3, node.stimDistance || 1, pCalc);
    const half = Math.min(aw, ah) / 2;
    const rMin = ((node.periRadiusMinPct ?? 60) / 100) * half;
    const rMax = ((node.periRadiusMaxPct ?? 90) / 100) * half;
    const color = node.periColor || { r: 0, g: 255, b: 100 };
    const cStr = `rgb(${color.r},${color.g},${color.b})`;
    const baseAngles = [];
    for (let i = 0; i < count; i++)
        baseAngles.push(node.periRandomAngles ? Math.random() * Math.PI * 2 : (i / count) * Math.PI * 2);
    const radii = baseAngles.map(() => rMin + Math.random() * (rMax - rMin));
    const cx = aw / 2,
        cy = ah / 2;
    function draw(t) {
        layer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            let ang = baseAngles[i],
                sc = 1;
            if (node.periMotion === 'rotate') {
                const sp = Math.max(0.02, Math.min(2, node.periSpeed || 0.3));
                ang += (t / 1000) * sp * Math.PI * 2;
            } else if (node.periMotion === 'pulse') {
                const sp = Math.max(0.5, Math.min(5, node.periSpeed || 1));
                sc = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(ang * 3 + (t / 1000) * sp * Math.PI * 2));
            }
            const x = cx + Math.cos(ang) * radii[i],
                y = cy + Math.sin(ang) * radii[i];
            const d = document.createElement('div');
            const s = Math.max(2, sizePx * sc);
            d.style.cssText = `position:absolute;left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;border-radius:50%;background:${cStr};box-shadow:0 0 6px rgba(0,0,0,0.4);`;
            layer.appendChild(d);
        }
    }
    draw(0);
    if (node.periMotion === 'static') return;
    _periAnimStart = null;
    function tick(now) {
        if (!playerRunning || isPaused) {
            _periAnimId = null;
            return;
        }
        if (_periAnimStart === null) _periAnimStart = now;
        draw(now - _periAnimStart);
        _periAnimId = requestAnimationFrame(tick);
    }
    _periAnimId = requestAnimationFrame(tick);
}

function buildDefocusFrame(node, stimHtml) {
    if (!node.dfEnabled) return null;
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return null;
    const pCalc = node.stimPPI || screenPPI || 96;
    const rMm = Math.max(5, node.dfCenterRadiusMm || 13);
    const rPx = Math.round((rMm * pCalc) / 25.4 / (window.devicePixelRatio || 1));
    const D = rPx * 2;
    const per = node.dfPeriBg || { r: 0, g: 71, b: 171 };
    const cb = node.dfCenterBg || { r: 204, g: 0, b: 0 };
    const sc = node.dfStimColor || { r: 0, g: 0, b: 0 };
    const blur = Math.max(0, Math.min(100, node.dfPeriBlur || 0));
    const periStyle =
        blur > 0
            ? `radial-gradient(circle at center, rgb(${per.r},${per.g},${per.b}) 0%, rgb(${per.r},${per.g},${per.b}) ${100 - blur}%, rgba(${per.r},${per.g},${per.b},0) 100%)`
            : `rgb(${per.r},${per.g},${per.b})`;
    const black = stimHtml
        .replace(/fill="rgb\(\d+,\d+,\d+\)"/g, `fill="rgb(${sc.r},${sc.g},${sc.b})"`)
        .replace(/stroke="rgb\(\d+,\d+,\d+\)"/g, `stroke="rgb(${sc.r},${sc.g},${sc.b})"`);
    const frame = document.createElement('div');
    frame.style.cssText = `position:absolute;inset:0;background:${periStyle};display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:1;`;
    const center = document.createElement('div');
    center.style.cssText = `width:${D}px;height:${D}px;border-radius:50%;background:rgb(${cb.r},${cb.g},${cb.b});display:flex;align-items:center;justify-content:center;`;
    center.innerHTML = black;
    frame.appendChild(center);
    return frame;
}

function removeSingleGridLines() {
    stimArea.querySelectorAll('.single-grid-overlay').forEach((el) => el.remove());
}
function drawSingleGridLines(gx, gy) {
    removeSingleGridLines();
    if (gx <= 1 && gy <= 1) return;
    const o = document.createElement('div');
    o.className = 'single-grid-overlay';
    o.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;';
    const imgs = [],
        sizes = [];
    if (gx > 1) {
        imgs.push('linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px)');
        sizes.push(`${100 / gx}% 100%`);
    }
    if (gy > 1) {
        imgs.push('linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)');
        sizes.push(`100% ${100 / gy}%`);
    }
    o.style.backgroundImage = imgs.join(', ');
    o.style.backgroundSize = sizes.join(', ');
    o.style.backgroundRepeat = 'repeat';
    if (getComputedStyle(stimArea).position === 'static') stimArea.style.position = 'relative';
    stimArea.appendChild(o);
}
function applySingleGridPosition(size, gx, gy, row, col, showLines) {
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    gx = Math.max(1, parseInt(gx) || 1);
    gy = Math.max(1, parseInt(gy) || 1);
    row = Math.max(0, Math.min(gy - 1, parseInt(row) || 0));
    col = Math.max(0, Math.min(gx - 1, parseInt(col) || 0));
    const cw = aw / gx,
        ch = ah / gy;
    const dx = (col + 0.5) * cw - aw / 2,
        dy = (row + 0.5) * ch - ah / 2;
    const svg = stimDisplay.querySelector('svg');
    if (svg) svg.style.transform = `translate(${dx}px, ${dy}px)`;
    if (showLines) drawSingleGridLines(gx, gy);
    else removeSingleGridLines();
}
function pickSingleGridCell(gx, gy, rand, avoid, fx, fy, cells) {
    gx = Math.max(1, parseInt(gx) || 1);
    gy = Math.max(1, parseInt(gy) || 1);
    let allowed = [];
    if (Array.isArray(cells) && cells.length > 0)
        allowed = cells.filter(
            (c) =>
                c &&
                typeof c.row === 'number' &&
                typeof c.col === 'number' &&
                c.row >= 0 &&
                c.row < gy &&
                c.col >= 0 &&
                c.col < gx
        );
    if (allowed.length === 0)
        for (let r = 0; r < gy; r++) for (let c = 0; c < gx; c++) allowed.push({ row: r, col: c });
    if (!rand) {
        const wr = Math.max(0, Math.min(gy - 1, parseInt(fx) || 0));
        const wc = Math.max(0, Math.min(gx - 1, parseInt(fy) || 0));
        return allowed.find((c) => c.row === wr && c.col === wc) || allowed[0];
    }
    if (allowed.length === 1) return allowed[0];
    let cell,
        att = 0;
    do {
        cell = allowed[Math.floor(Math.random() * allowed.length)];
        att++;
    } while (
        avoid &&
        att < 25 &&
        cell.row === currentSingleCell.row &&
        cell.col === currentSingleCell.col &&
        allowed.length > 1
    );
    return cell;
}
function applyRandomStimulusPosition(size) {
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    const p = 20;
    const dxM = Math.max(0, (aw - size) / 2 - p),
        dyM = Math.max(0, (ah - size) / 2 - p);
    if (dxM <= 0 && dyM <= 0) return;
    const dx = (Math.random() * 2 - 1) * dxM,
        dy = (Math.random() * 2 - 1) * dyM;
    const svg = stimDisplay.querySelector('svg');
    if (svg) svg.style.transform = `translate(${dx}px, ${dy}px)`;
}

function displayStimulus(html, bg) {
    stimDisplay.innerHTML = html;
    stimArea.style.backgroundColor = `rgb(${bg.r},${bg.g},${bg.b})`;
}
function hideStimulus() {
    stopSingleStimAnimation();
    stopSingleBgAnimation();
    stopCircleAnimation();
    stopPeripheralAnimation();
    stopBlinkAnimation();
    removeSingleGridLines();
    stimDisplay.innerHTML = '';
    stimDisplay.style.fontSize = '';
    stimDisplay.style.backgroundColor = '';
    stimArea.style.backgroundColor = '';
}

async function enableCamera() {
    if (camActive) return;
    try {
        camStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        const v = document.createElement('video');
        v.id = 'hidden-video';
        v.autoplay = true;
        v.muted = true;
        v.playsInline = true;
        v.style.cssText =
            'position:fixed;left:-9999px;top:0;width:320px;height:240px;opacity:0;pointer-events:none;';
        v.srcObject = camStream;
        document.body.appendChild(v);
        await v.play();
        camActive = true;
        await loadFaceApi();
        camIndicator.style.display = 'block';
        camIndicator.textContent = '📷 Лицо не найдено';
        if (camFrameId) cancelAnimationFrame(camFrameId);
        camFrameId = requestAnimationFrame(processCamFrame);
    } catch (e) {
        console.warn('[cam]', e);
    }
}
async function loadFaceApi() {
    const M = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
    await faceapi.nets.tinyFaceDetector.loadFromUri(M);
    await faceapi.nets.faceLandmark68Net.loadFromUri(M);
}
function computeEAR(e) {
    if (!e || e.length < 6) return 0.3;
    const [p1, p2, p3, p4, p5, p6] = e;
    const v1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
    const v2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
    const h = Math.hypot(p1.x - p4.x, p1.y - p4.y);
    if (h < 1) return 0.3;
    return (v1 + v2) / (2 * h);
}
async function processCamFrame() {
    if (!camActive) {
        camFrameId = null;
        return;
    }
    const v = document.getElementById('hidden-video');
    if (v && v.readyState >= 2 && v.videoWidth > 0 && !v.paused) {
        try {
            const det = await faceapi
                .detectSingleFace(v, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks();
            if (det && det.landmarks) {
                const le = det.landmarks.getLeftEye(),
                    re = det.landmarks.getRightEye();
                const lc = { x: (le[0].x + le[3].x) / 2, y: (le[0].y + le[3].y) / 2 };
                const rc = { x: (re[0].x + re[3].x) / 2, y: (re[0].y + re[3].y) / 2 };
                const ipd = Math.hypot(rc.x - lc.x, rc.y - lc.y);
                lastEyeDistPx = ipd;
                camIndicator.textContent = '✅ Лицо';
                const earL = computeEAR(le),
                    earR = computeEAR(re);
                processBlink(earL, earR);
                if (ipd > 0 && focalLengthPx) {
                    curDistanceM = (realIPD_MM * focalLengthPx) / ipd / 1000;
                    camIndicator.textContent = `📏 ${curDistanceM.toFixed(2)} м`;
                    evaluateDistance();
                }
            } else {
                camIndicator.textContent = '❌ Нет лица';
                _blinkIsClosed = false;
                _blinkClosedSince = 0;
            }
        } catch (e) {
            console.warn(e);
        }
    }
    if (camActive) camFrameId = requestAnimationFrame(processCamFrame);
    else camFrameId = null;
}
function processBlink(earL, earR) {
    const now = performance.now();
    const ear = (earL + earR) / 2;
    const closed = ear < BLINK_THRESHOLD;
    if (closed && !_blinkIsClosed) {
        _blinkIsClosed = true;
        _blinkClosedSince = now;
    } else if (!closed && _blinkIsClosed) {
        const dur = now - _blinkClosedSince;
        _blinkIsClosed = false;
        _blinkClosedSince = 0;
        if (dur > 800 && playerRunning && !isPaused) {
            pauseTraining();
        }
    }
}
function evaluateDistance() {
    if (!playerRunning || isPaused || curDistanceM == null) return;
    if (camBaseline == null) camBaseline = curDistanceM;
    const dev = ((curDistanceM - camBaseline) / camBaseline) * 100;
    const upTol = userScenario?.params?.distanceToleranceIncreasePct ?? 15;
    const dnTol = userScenario?.params?.distanceToleranceDecreasePct ?? 10;
    if (dev > upTol) {
        if (camWarnKind !== 'up') {
            camWarnKind = 'up';
            camIndicator.style.color = '#ff6666';
            camIndicator.textContent = '📏 Не отклоняйтесь';
        }
    } else if (dev < -dnTol) {
        if (camWarnKind !== 'down') {
            camWarnKind = 'down';
            camIndicator.style.color = '#f59e0b';
            camIndicator.textContent = '📏 Не приближайтесь';
        }
    } else {
        camWarnKind = null;
        camIndicator.style.color = '#fff';
        camIndicator.textContent = `📏 ${curDistanceM.toFixed(2)} м`;
    }
}
function disableCamera() {
    if (camFrameId) {
        cancelAnimationFrame(camFrameId);
        camFrameId = null;
    }
    if (camStream) {
        camStream.getTracks().forEach((t) => t.stop());
        camStream = null;
    }
    const v = document.getElementById('hidden-video');
    if (v) v.remove();
    camActive = false;
    camIndicator.style.display = 'none';
}
// ==================== user.js: Конец части 1 из 4 ====================
// ==================== user.js: Начало части 2 из 4 ====================

// ==================== ПЛЕЕР ГРАФА ====================
function gGetNode(id) {
    return gNodes.find((n) => n.id === id);
}

function buildGraphQueue() {
    gQueue = [];
    if (!gNodes.length) return;
    const startNode = gNodes.find((n) => n.isStart === true) || gNodes[0];
    const visited = new Set();
    function visit(nodeId, connection = null, fromNodeId = null) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        gQueue.push({ nodeId, connection, fromNodeId });
        gConnections
            .filter((c) => c.fromId === nodeId && c.isLoop && c.toId !== nodeId)
            .forEach((loop) => {
                const lim = loop.loopLimit || 1;
                for (let i = 0; i < lim; i++) {
                    gQueue.push({ nodeId: loop.toId, connection: loop, fromNodeId: nodeId });
                    gQueue.push({ nodeId: nodeId, connection: loop, fromNodeId: loop.toId });
                }
            });
        gConnections
            .filter((c) => c.fromId === nodeId && !c.isLoop && c.toId !== nodeId)
            .forEach((conn) => visit(conn.toId, conn, nodeId));
    }
    visit(startNode.id, null, null);
}

function startGraphPlay(nodes, connections, books) {
    graphActive = true;
    gNodes = nodes || [];
    gConnections = connections || [];
    if (books && typeof books === 'object') {
        window._books = window._books || {};
        Object.assign(window._books, books);
    }
    buildGraphQueue();
    if (!gQueue.length) {
        stopPlayer();
        return;
    }
    gIndex = 0;
    gCurrentNodeId = null;
    playNextGraphNode();
}

function playNextGraphNode() {
    if (!playerRunning || isPaused) return;
    if (gIndex >= gQueue.length) {
        stopPlayer();
        showStatus('Граф пройден', `Серий: ${completedSeries}`, 'Ещё раз', () => {
            hideStatus();
            startPlayer();
        });
        return;
    }
    const item = gQueue[gIndex];
    const node = gGetNode(item.nodeId);
    if (!node) {
        gIndex++;
        playNextGraphNode();
        return;
    }
    if (node.isActive === false && node.nodeType !== 'LOGIC_IF') {
        gIndex++;
        playNextGraphNode();
        return;
    }
    if (item.connection) {
        const c = item.connection;
        const fn = gGetNode(item.fromNodeId);
        if (fn) {
            if (c.inheritSize) {
                node.stimAcuity = fn.stimAcuity;
                node.endAcuity = fn.endAcuity;
                node.stimDistance = fn.stimDistance;
                node.stimPPI = fn.stimPPI;
            }
            if (c.inheritSpeed) node.duration = fn.duration;
        }
    }
    if (node.nodeType === 'READING') {
        playGraphReading(node);
        return;
    }
    if (node.nodeType === 'COMPARE') {
        playGraphCompare(node);
        return;
    }
    gCurrentNodeId = node.id;
    completedSeries = successfulSeries = failedSeries = 0;
    seriesCorrect = seriesIncorrect = seriesNoAnswer = 0;
    seriesStep = 0;
    noAnswerSeriesStreak = 0;
    lastDirection = null;
    currentSingleCell = { row: 0, col: 0 };
    gNodeAcuityCurrent = node.stimAcuity || 1.0;
    updateCounters();
    hideStimulus();
    responseButtons.style.display = 'none';
    phaseTimers.push(
        setTimeout(() => {
            if (playerRunning && !isPaused) playGraphStimulus(node);
        }, node.delay1 || 0)
    );
}

function playGraphStimulus(node) {
    if (!playerRunning || isPaused) return;
    if (completedSeries >= (node.seriesCount || 5)) {
        gIndex++;
        playNextGraphNode();
        return;
    }
    if (seriesStep >= (node.seriesSize || 6)) {
        finishGraphStimulusSeries(node);
        return;
    }
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    let dir;
    if (node.isActive) {
        const d = ['вверх', 'вниз', 'влево', 'вправо'];
        do {
            dir = d[Math.floor(Math.random() * d.length)];
        } while (dir === lastDirection);
    } else dir = node.stimDirectionFixed || 'вверх';
    lastDirection = dir;
    currentCorrectDirection = dir;
    const dCalc = node.stimDistance || 1;
    const pCalc = node.stimPPI || screenPPI || 96;
    const eff = acuityToSizePx(gNodeAcuityCurrent, dCalc, pCalc);
    currentSize = eff;
    let sc = { r: node.stimR || 255, g: node.stimG || 255, b: node.stimB || 255 };
    if (node.singleStimDynamicEnabled && node.singleStimColor1 && !node.singleCircleEnabled)
        sc = node.singleStimColor1;
    let svgData;
    if (node.singleCircleEnabled) svgData = getCircleStimulusSVG(node, eff);
    else
        svgData = getStimulusSVG(
            {
                stimType: node.stimType || 'LETTER_E',
                stimDirection: dir,
                stimR: sc.r,
                stimG: sc.g,
                stimB: sc.b,
                bgR: node.bgR || 0,
                bgG: node.bgG || 0,
                bgB: node.bgB || 0
            },
            eff
        );
    if (node.dfEnabled) {
        const frame = buildDefocusFrame(node, svgData.html);
        if (frame) {
            stimDisplay.innerHTML = '';
            stimDisplay.appendChild(frame);
            stimArea.style.backgroundColor = `rgb(${node.dfPeriBg.r},${node.dfPeriBg.g},${node.dfPeriBg.b})`;
        } else displayStimulus(svgData.html, { r: node.bgR || 0, g: node.bgG || 0, b: node.bgB || 0 });
    } else displayStimulus(svgData.html, { r: node.bgR || 0, g: node.bgG || 0, b: node.bgB || 0 });
    if (node.singleGridEnabled) {
        const gx = node.singleGridX || 1,
            gy = node.singleGridY || 1;
        const cell = pickSingleGridCell(
            gx,
            gy,
            node.singleGridRandomCell !== false,
            node.singleGridAvoidRepeat !== false,
            node.singleGridFixedRow || 0,
            node.singleGridFixedCol || 0,
            node.singleGridCells || []
        );
        currentSingleCell = cell;
        applySingleGridPosition(eff, gx, gy, cell.row, cell.col, node.singleGridShowLines === true);
    } else if (node.singleRandomPos) applyRandomStimulusPosition(eff);
    buildPeripheralDots(node);
    stopBlinkAnimation();
    if (node.singleCircleEnabled) {
        startCircleAnimation(node);
        stopSingleStimAnimation();
    } else {
        stopCircleAnimation();
        if (node.singleStimDynamicEnabled) startSingleStimAnimation(node);
        else stopSingleStimAnimation();
    }
    if (node.singleBgDynamicEnabled) startSingleBgAnimation(node);
    else stopSingleBgAnimation();
    if (node.blinkEnabled) {
        startBlinkAnimation({
            target: node.blinkTarget || 'stim',
            colorA: node.blinkColorA || { r: 255, g: 0, b: 0 },
            colorB: node.blinkColorB || { r: 0, g: 0, b: 255 },
            intervalMs: node.blinkIntervalMs || 500,
            duty: node.blinkDuty ?? 0.5,
            count: node.blinkCount || 0
        });
    }
    responsePhaseActive = true;
    responseStartTime = performance.now();
    document.querySelectorAll('.btn-resp[data-dir]').forEach((b) => (b.style.display = 'flex'));
    document.querySelectorAll('.btn-resp[data-answer]').forEach((b) => (b.style.display = 'none'));
    responseButtons.style.display = 'flex';
    if (window.Voice) window.Voice.sayKey('look', { cancel: true });
    let sd = node.duration || 1000;
    if (node.singleStimDynamicEnabled) sd = Math.max(sd, node.singleStimDuration || 0);
    if (node.singleBgDynamicEnabled) sd = Math.max(sd, node.singleBgDuration || 0);
    if (node.singleCircleEnabled) {
        const ci = node.circleInnerEnabled !== false ? node.circleInnerDuration || 0 : 0;
        const co = node.circleOuterEnabled !== false ? node.circleOuterDuration || 0 : 0;
        sd = Math.max(sd, ci, co);
    }
    scheduleVoiceCountdown(sd);
    currentShowTimer = setTimeout(() => {
        hideStimulus();
        responsePhaseActive = false;
        stopSingleStimAnimation();
        stopSingleBgAnimation();
        stopCircleAnimation();
        stopPeripheralAnimation();
        stopBlinkAnimation();
        if (lastResponse.answered) {
            if (lastResponse.isCorrect) seriesCorrect++;
            else seriesIncorrect++;
        } else {
            seriesNoAnswer++;
            saveResult(node.id, null, false);
        }
        seriesStep++;
        updateCounters();
        phaseTimers.push(
            setTimeout(() => {
                if (playerRunning && !isPaused) playGraphStimulus(node);
            }, node.delay2 || 1000)
        );
    }, sd);
    phaseTimers.push(currentShowTimer);
}

function finishGraphStimulusSeries(node) {
    const th = node.seriesThreshold || getThreshold(node.seriesSize || 6);
    const ok = seriesCorrect >= th;
    const allNo = seriesNoAnswer === (node.seriesSize || 6);
    if (allNo) noAnswerSeriesStreak++;
    else noAnswerSeriesStreak = 0;
    completedSeries++;
    if (ok) successfulSeries++;
    else failedSeries++;
    if (ok) {
        const eA = node.endAcuity != null ? node.endAcuity : node.stimAcuity || 1.0;
        if (gNodeAcuityCurrent < eA)
            gNodeAcuityCurrent = Math.min(
                eA,
                Math.round((gNodeAcuityCurrent + (node.acuityStep || 0.1)) * 10) / 10
            );
    } else {
        const sA = node.stimAcuity || 1.0;
        if (gNodeAcuityCurrent > sA)
            gNodeAcuityCurrent = Math.max(
                sA,
                Math.round((gNodeAcuityCurrent - (node.acuityStep || 0.1)) * 10) / 10
            );
    }
    seriesCorrect = seriesIncorrect = seriesNoAnswer = seriesStep = 0;
    lastDirection = null;
    updateCounters();
    if (noAnswerSeriesStreak >= 3) {
        pauseTraining();
        return;
    }
    if (completedSeries >= (node.seriesCount || 5)) {
        gIndex++;
        playNextGraphNode();
        return;
    }
    phaseTimers.push(
        setTimeout(() => {
            if (playerRunning && !isPaused) playGraphStimulus(node);
        }, node.delay2 || 500)
    );
}

function handleGraphDirectionAnswer(dir) {
    if (!responsePhaseActive) return;
    const ok = dir === currentCorrectDirection;
    lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: performance.now() - responseStartTime };
    responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(() => {
        document.body.style.background = '#0b0b0f';
    }, 200);
    saveResult(gCurrentNodeId || 'graph_single', lastResponse.reactionTimeMs, ok);
}

function playGraphCompare(node) {
    if (!playerRunning || isPaused) return;
    gCurrentCompareNode = node;
    gCurrentNodeId = node.id;
    completedSeries = successfulSeries = failedSeries = 0;
    seriesCorrect = seriesIncorrect = seriesNoAnswer = 0;
    seriesStep = 0;
    noAnswerSeriesStreak = 0;
    compareMode = node.compareMode || 'direction';
    gridX = Math.max(2, Math.min(6, parseInt(node.gridX) || 3));
    gridY = Math.max(1, Math.min(6, parseInt(node.gridY) || 3));
    activeCells = (node.activeCells || []).slice();
    cellParams = (node.cellParams || []).slice();
    if (activeCells.length < 2)
        activeCells = [
            { row: 0, col: 0 },
            { row: 0, col: 1 }
        ];
    while (cellParams.length < activeCells.length) cellParams.push(defaultCellParams());
    updateCounters();
    hideStimulus();
    responseButtons.style.display = 'none';
    phaseTimers.push(
        setTimeout(() => {
            if (playerRunning && !isPaused) playGraphCompareRound(node);
        }, node.delay1 || 0)
    );
}

function playGraphCompareRound(node) {
    if (!playerRunning || isPaused) return;
    if (seriesStep >= (node.seriesSize || 6)) {
        finishGraphCompareSeries(node);
        return;
    }
    removeSingleGridLines();
    stimDisplay.innerHTML = '';
    stimArea.style.background = '#000';
    responsePhaseActive = true;
    responseStartTime = performance.now();
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    if (compareMode === 'direction') showDirectionComparison();
    else if (compareMode === 'find_same') showFindSameComparison();
    const dur = cellParams[0]?.duration || node.duration || currentDuration;
    currentShowTimer = setTimeout(() => {
        if (responsePhaseActive) {
            lastResponse = { answered: false, isCorrect: false };
            processGraphCompareAnswer(false);
        }
    }, dur);
    phaseTimers.push(currentShowTimer);
}

function handleGraphCompareAnswer(answer) {
    if (!responsePhaseActive) return;
    const ok = answer === currentCompareAnswer;
    lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: performance.now() - responseStartTime };
    responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(() => {
        document.body.style.background = '#0b0b0f';
    }, 200);
    processGraphCompareAnswer(ok);
}

function processGraphCompareAnswer(isCorrect) {
    if (isCorrect) seriesCorrect++;
    else seriesIncorrect++;
    seriesStep++;
    updateCounters();
    saveResult(gCurrentNodeId || 'graph_compare', lastResponse.reactionTimeMs, isCorrect);
    const node = gGetNode(gCurrentNodeId);
    if (!node) {
        gIndex++;
        playNextGraphNode();
        return;
    }
    if (seriesStep >= (node.seriesSize || 6)) {
        finishGraphCompareSeries(node);
        return;
    }
    phaseTimers.push(
        setTimeout(() => {
            if (playerRunning && !isPaused) playGraphCompareRound(node);
        }, node.delay2 || 1000)
    );
}

function finishGraphCompareSeries(node) {
    if (!node) {
        gIndex++;
        playNextGraphNode();
        return;
    }
    const th = node.seriesThreshold || getThreshold(node.seriesSize || 6);
    const ok = seriesCorrect >= th;
    completedSeries++;
    if (ok) successfulSeries++;
    else failedSeries++;
    seriesCorrect = seriesIncorrect = seriesNoAnswer = seriesStep = 0;
    updateCounters();
    if (completedSeries >= (node.seriesCount || 5)) {
        gCurrentCompareNode = null;
        gIndex++;
        playNextGraphNode();
        return;
    }
    phaseTimers.push(
        setTimeout(() => {
            if (playerRunning && !isPaused) playGraphCompareRound(node);
        }, node.delay2 || 500)
    );
}

function playGraphReading(node) {
    if (!playerRunning || isPaused) return;
    gCurrentNodeId = node.id;
    let bid = node.bookId;
    if (!bid && window._books) {
        const keys = Object.keys(window._books);
        if (keys.length) bid = keys[0];
    }
    const bk = bid ? window._books?.[bid] : null;
    const text = bk ? bk.text : node.bookText || 'Текст не задан.';
    const pars = (text || '')
        .split(/\n+/)
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
    readingContentEl.innerHTML = pars.map((x) => `<p>${escapeHtml(x)}</p>`).join('');
    readingContentEl.style.color = node.readingTextColor
        ? rgbToHex(node.readingTextColor.r, node.readingTextColor.g, node.readingTextColor.b)
        : '#000';
    applyReadingBackground({
        bgMode: node.readingBgMode || 'solid',
        bgColor: node.readingBgColor || { r: 255, g: 255, b: 255 },
        splitLeftWidthPercent: node.readingSplitLeftWidthPercent,
        splitLeftColor: node.readingSplitLeftColor,
        splitRightColor: node.readingSplitRightColor,
        gradientMidEnabled: node.readingGradientMidEnabled,
        gradientLeftColor: node.readingGradientLeftColor,
        gradientMidColor: node.readingGradientMidColor,
        gradientMidPosition: node.readingGradientMidPosition,
        gradientRightColor: node.readingGradientRightColor,
        dynamicMode: node.readingDynamicMode || 'simple',
        dynamicReverse: node.readingDynamicReverse,
        dynamicMidEnabled: node.readingDynamicMidEnabled,
        dynamicStartColor: node.readingDynamicStartColor,
        dynamicMidColor: node.readingDynamicMidColor,
        dynamicEndColor: node.readingDynamicEndColor,
        dynamicDuration: node.readingDynamicDuration,
        dynamicLoop: node.readingDynamicLoop
    });
    stimDisplay.style.display = 'none';
    responseButtons.style.display = 'none';
    readingViewportEl.style.display = 'block';
    readingViewportEl.scrollLeft = 0;
    readingPaused = false;
    const pp = $('reading-play-pause');
    if (pp) pp.textContent = '⏸ Пауза';
    readingContentEl.style.opacity = '1';
    applyReadingFont({
        readingFontFamily: node.readingFontFamily || 'Segoe UI',
        readingFontWeight: node.readingFontWeight || 'normal'
    });
    setupReadingColumns();
    const dCalc = node.readingDistance || 1;
    readingContentEl.style.fontSize = acuityToFontSizePx(node.readingAcuity || 1.0, dCalc, screenPPI) + 'px';
    setTimeout(() => {
        readingTotalPages = calcReadingTotalPages();
        readingPage = 0;
        scrollReadingToPage(0);
    }, 80);
    readingToolbarEl.style.display = 'flex';
    const dur = node.duration || 60000;
    if (dur > 0) {
        phaseTimers.push(setTimeout(() => finishGraphReading(node), dur));
    }
}

function finishGraphReading(node) {
    readingToolbarEl.style.display = 'none';
    readingViewportEl.style.display = 'none';
    readingContentEl.innerHTML = '';
    stimDisplay.style.display = '';
    stopReadingDynamicBg();
    gIndex++;
    playNextGraphNode();
}

// ==================== ЗАПУСК ====================
function startPlayer() {
    if (!userScenario) {
        alert('Сценарий не назначен');
        return;
    }
    if (!validateScenario(userScenario)) {
        alert('Сценарий повреждён или содержит некорректные данные.');
        return;
    }
    sessionId = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const p = userScenario.params || {};
    playerRunning = true;
    isPaused = false;
    completedSeries = successfulSeries = failedSeries = 0;
    seriesCorrect = seriesIncorrect = seriesNoAnswer = 0;
    seriesStep = 0;
    noAnswerSeriesStreak = 0;
    lastDirection = null;
    currentSingleCell = { row: 0, col: 0 };
    screenPPI = p.ppi || screenPPI || 96;
    btnPlayer.disabled = true;
    btnPlayerStop.disabled = false;
    btnPlayerPause.disabled = false;
    if (window.Voice) window.Voice.sayKey('ready', { cancel: true });

    if (p.graph && Array.isArray(p.graph.nodes) && p.graph.nodes.length > 0) {
        updateCounters();
        startGraphPlay(p.graph.nodes, p.graph.connections || [], p.graph.books || {});
        return;
    }

    if (p.trainingType !== 'reading') currentAcuity = p.startAcuity || 0.5;
    else currentAcuity = 1.0;
    currentStimColor = p.startStimColor ? { ...p.startStimColor } : { r: 0, g: 255, b: 0 };
    currentBgColor = p.startBgColor ? { ...p.startBgColor } : { r: 0, g: 0, b: 0 };
    currentDuration = 2550;
    currentSize = acuityToSizePx(currentAcuity, p.distanceMeters || 1, screenPPI);
    updateCounters();
    const tt = p.trainingType || 'single';
    if (tt === 'reading') {
        btnPlayerPause.disabled = true;
        startReading();
    } else if (tt === 'compare') {
        compareMode = p.compareMode || 'direction';
        gridX = Math.max(2, Math.min(6, parseInt(p.gridX) || 3));
        gridY = Math.max(1, Math.min(6, parseInt(p.gridY) || 3));
        activeCells = (p.activeCells || []).slice();
        cellParams = (p.cellParams || []).slice();
        if (activeCells.length < 2)
            activeCells = [
                { row: 0, col: 0 },
                { row: 0, col: 1 }
            ];
        while (cellParams.length < activeCells.length) cellParams.push(defaultCellParams());
        showNextCompareRound();
    } else showNextStimulus();
}

function showNextStimulus() {
    if (!playerRunning || isPaused) return;
    const p = userScenario?.params || {};
    if (seriesStep >= (p.seriesSize || 6)) {
        finishSeries();
        return;
    }
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    let dir;
    if (p.isActive) {
        const d = ['вверх', 'вниз', 'влево', 'вправо'];
        do {
            dir = d[Math.floor(Math.random() * d.length)];
        } while (dir === lastDirection);
    } else dir = 'вверх';
    lastDirection = dir;
    currentCorrectDirection = dir;
    const dCalc = p.distanceMeters || 1;
    const eff = acuityToSizePx(currentAcuity, dCalc, screenPPI);
    currentSize = eff;
    let sc = currentStimColor;
    if (p.singleStimDynamicEnabled && p.singleStimColor1 && !p.singleCircleEnabled) sc = p.singleStimColor1;
    let svgData;
    if (p.singleCircleEnabled) svgData = getCircleStimulusSVG(p, eff);
    else
        svgData = getStimulusSVG(
            {
                stimType: p.type || 'LETTER_E',
                stimDirection: dir,
                stimR: sc.r,
                stimG: sc.g,
                stimB: sc.b,
                bgR: currentBgColor.r,
                bgG: currentBgColor.g,
                bgB: currentBgColor.b
            },
            eff
        );
    if (p.dfEnabled) {
        const frame = buildDefocusFrame(p, svgData.html);
        if (frame) {
            stimDisplay.innerHTML = '';
            stimDisplay.appendChild(frame);
            stimArea.style.backgroundColor = `rgb(${p.dfPeriBg.r},${p.dfPeriBg.g},${p.dfPeriBg.b})`;
        } else displayStimulus(svgData.html, currentBgColor);
    } else displayStimulus(svgData.html, currentBgColor);
    if (p.singleGridEnabled) {
        const gx = p.singleGridX || 1,
            gy = p.singleGridY || 1;
        const cell = pickSingleGridCell(
            gx,
            gy,
            p.singleGridRandomCell !== false,
            p.singleGridAvoidRepeat !== false,
            p.singleGridFixedRow || 0,
            p.singleGridFixedCol || 0,
            p.singleGridCells || []
        );
        currentSingleCell = cell;
        applySingleGridPosition(eff, gx, gy, cell.row, cell.col, p.singleGridShowLines === true);
    } else if (p.singleRandomPos) applyRandomStimulusPosition(eff);
    buildPeripheralDots(p);
    stopBlinkAnimation();
    if (p.singleCircleEnabled) {
        startCircleAnimation(p);
        stopSingleStimAnimation();
    } else {
        stopCircleAnimation();
        if (p.singleStimDynamicEnabled) startSingleStimAnimation(p);
        else stopSingleStimAnimation();
    }
    if (p.singleBgDynamicEnabled) startSingleBgAnimation(p);
    else stopSingleBgAnimation();
    if (p.blinkEnabled) {
        startBlinkAnimation({
            target: p.blinkTarget || 'stim',
            colorA: p.blinkColorA || { r: 255, g: 0, b: 0 },
            colorB: p.blinkColorB || { r: 0, g: 0, b: 255 },
            intervalMs: p.blinkIntervalMs || 500,
            duty: p.blinkDuty ?? 0.5,
            count: p.blinkCount || 0
        });
    }
    responsePhaseActive = true;
    responseStartTime = performance.now();
    document.querySelectorAll('.btn-resp[data-dir]').forEach((b) => (b.style.display = 'flex'));
    document.querySelectorAll('.btn-resp[data-answer]').forEach((b) => (b.style.display = 'none'));
    responseButtons.style.display = 'flex';
    if (window.Voice) window.Voice.sayKey('look', { cancel: true });
    let sd = currentDuration;
    if (p.singleStimDynamicEnabled) sd = Math.max(sd, p.singleStimDuration || 0);
    if (p.singleBgDynamicEnabled) sd = Math.max(sd, p.singleBgDuration || 0);
    if (p.singleCircleEnabled) {
        const ci = p.circleInnerEnabled !== false ? p.circleInnerDuration || 0 : 0;
        const co = p.circleOuterEnabled !== false ? p.circleOuterDuration || 0 : 0;
        sd = Math.max(sd, ci, co);
    }
    scheduleVoiceCountdown(sd);
    currentShowTimer = setTimeout(() => {
        hideStimulus();
        responsePhaseActive = false;
        stopSingleStimAnimation();
        stopSingleBgAnimation();
        stopCircleAnimation();
        stopPeripheralAnimation();
        stopBlinkAnimation();
        if (lastResponse.answered) {
            if (lastResponse.isCorrect) seriesCorrect++;
            else seriesIncorrect++;
        } else {
            seriesNoAnswer++;
            if (window.Voice) window.Voice.sayKey('timeout', { cancel: true });
            saveResult('user_single', null, false);
        }
        seriesStep++;
        updateCounters();
        phaseTimers.push(
            setTimeout(() => {
                if (playerRunning && !isPaused) showNextStimulus();
            }, p.delay2 || 1000)
        );
    }, sd);
    phaseTimers.push(currentShowTimer);
}

function finishSeries() {
    const p = userScenario?.params || {};
    const th = p.seriesThreshold || getThreshold(p.seriesSize || 6);
    const ok = seriesCorrect >= th;
    if (seriesNoAnswer === (p.seriesSize || 6)) noAnswerSeriesStreak++;
    else noAnswerSeriesStreak = 0;
    completedSeries++;
    if (ok) successfulSeries++;
    else failedSeries++;
    if (ok) {
        if (currentAcuity < (p.endAcuity || 2.0))
            currentAcuity = Math.min(
                p.endAcuity || 2.0,
                Math.round((currentAcuity + (p.acuityStep || 0.1)) * 10) / 10
            );
    } else {
        if (currentAcuity > (p.startAcuity || 0.5))
            currentAcuity = Math.max(
                p.startAcuity || 0.5,
                Math.round((currentAcuity - (p.acuityStep || 0.1)) * 10) / 10
            );
    }
    currentSize = acuityToSizePx(currentAcuity, p.distanceMeters || 1, screenPPI);
    seriesCorrect = seriesIncorrect = seriesNoAnswer = seriesStep = 0;
    lastDirection = null;
    updateCounters();
    if (completedSeries >= (p.seriesCount || 5)) {
        showFinishedReport();
        stopPlayer();
        return;
    }
    phaseTimers.push(
        setTimeout(() => {
            if (playerRunning && !isPaused) showNextStimulus();
        }, p.delay2 || 1000)
    );
}

function defaultCellParams() {
    const d = userScenario?.params?.distanceMeters || 1;
    const ppi = userScenario?.params?.ppi || screenPPI || 96;
    return {
        size: acuityToSizePx(1.0, d, ppi),
        stimR: 255,
        stimG: 255,
        stimB: 255,
        bgR: 0,
        bgG: 0,
        bgB: 0,
        duration: 2000
    };
}
function showNextCompareRound() {
    if (!playerRunning || isPaused) return;
    const p = userScenario?.params || {};
    if (seriesStep >= (p.seriesSize || 6)) {
        finishCompareSeries();
        return;
    }
    removeSingleGridLines();
    stimDisplay.innerHTML = '';
    stimArea.style.background = '#000';
    responsePhaseActive = true;
    responseStartTime = performance.now();
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    if (compareMode === 'direction') showDirectionComparison();
    else if (compareMode === 'find_same') showFindSameComparison();
    const dur = cellParams[0]?.duration || p.duration || currentDuration;
    currentShowTimer = setTimeout(() => {
        if (responsePhaseActive) {
            lastResponse = { answered: false, isCorrect: false };
            processCompareAnswer(false);
        }
    }, dur);
    phaseTimers.push(currentShowTimer);
}
function showDirectionComparison() {
    if (activeCells.length < 2) return;
    const sh = activeCells.slice().sort(() => Math.random() - 0.5);
    const cA = sh[0],
        cB = sh[1];
    const d1 = randomDirection(),
        d2 = randomDirection();
    currentCompareAnswer = d1 === d2;
    createCellElement(cA, cellParams[0] || defaultCellParams(), d1, 0);
    createCellElement(cB, cellParams[1] || defaultCellParams(), d2, 1);
    document.querySelectorAll('.btn-resp[data-dir]').forEach((b) => (b.style.display = 'none'));
    document.querySelectorAll('.btn-resp[data-answer]').forEach((b) => (b.style.display = 'flex'));
    responseButtons.style.display = 'flex';
}
function showFindSameComparison() {
    const p = userScenario?.params || {};
    const pc = Math.max(1, Math.min(20, parseInt(p.pairsCount || 2)));
    const need = pc * 2;
    const usePc = activeCells.length < need ? Math.floor(activeCells.length / 2) : pc;
    if (usePc < 1) {
        processCompareAnswer(false);
        return;
    }
    showFindSameComparisonInternal(usePc);
}
function showFindSameComparisonInternal(pc) {
    const need = pc * 2;
    const sh = activeCells.slice().sort(() => Math.random() - 0.5);
    const chosen = sh.slice(0, need);
    const pairs = [];
    for (let i = 0; i < pc; i++)
        pairs.push({ cells: [chosen[i * 2], chosen[i * 2 + 1]], direction: randomDirection(), found: false });
    _findSameState = { pairs, firstSelectedIdx: null, foundCells: new Set(), cells: chosen, pairsCount: pc };
    chosen.forEach((cell, idx) => {
        const pi = Math.floor(idx / 2);
        const dir = pairs[pi].direction;
        const params = cellParams[idx] || cellParams[cellParams.length - 1] || defaultCellParams();
        createCellElement(cell, params, dir, idx);
    });
    responseButtons.style.display = 'none';
    document.querySelectorAll('.grid-cell').forEach((el) => {
        el.onclick = () => handleFindSameClick(parseInt(el.dataset.index));
    });
}
function handleFindSameClick(idx) {
    if (!responsePhaseActive || !_findSameState || isNaN(idx)) return;
    const st = _findSameState;
    const cell = st.cells[idx];
    const key = `${cell.row},${cell.col}`;
    if (st.foundCells.has(key)) return;
    if (st.firstSelectedIdx === null) {
        st.firstSelectedIdx = idx;
        flashCell(idx, 'selected');
        return;
    }
    const fi = st.firstSelectedIdx;
    if (fi === idx) {
        st.firstSelectedIdx = null;
        flashCell(idx, 'unselect');
        return;
    }
    const fp = Math.floor(fi / 2),
        sp = Math.floor(idx / 2);
    if (fp === sp) {
        const a = st.cells[fi],
            b = st.cells[idx];
        st.foundCells.add(`${a.row},${a.col}`);
        st.foundCells.add(`${b.row},${b.col}`);
        st.pairs[fp].found = true;
        flashCell(fi, 'found');
        flashCell(idx, 'found');
        st.firstSelectedIdx = null;
        if (st.pairs.every((p) => p.found)) {
            lastResponse = {
                answered: true,
                isCorrect: true,
                reactionTimeMs: performance.now() - responseStartTime
            };
            responsePhaseActive = false;
            processCompareAnswer(true);
        }
    } else {
        flashCell(fi, 'unselect');
        flashCell(idx, 'wrong');
        st.firstSelectedIdx = null;
    }
}
function flashCell(idx, kind) {
    const el = document.querySelector(`.grid-cell[data-index="${idx}"]`);
    if (!el) return;
    const ob = el.style.border,
        os = el.style.boxShadow;
    if (kind === 'selected') {
        el.style.border = '3px solid #38bdf8';
        el.style.boxShadow = '0 0 12px #38bdf8';
    } else if (kind === 'found') {
        el.style.border = '4px solid #22c55e';
        el.style.boxShadow = '0 0 20px #22c55e';
    } else if (kind === 'wrong') {
        el.style.border = '4px solid #ef4444';
        el.style.boxShadow = '0 0 20px #ef4444';
        setTimeout(() => {
            el.style.border = ob;
            el.style.boxShadow = os;
        }, 400);
    } else if (kind === 'unselect') {
        el.style.border = ob;
        el.style.boxShadow = os;
    }
}
function createCellElement(cell, params, direction, idx) {
    const cw = stimDisplay.offsetWidth / gridX,
        ch = stimDisplay.offsetHeight / gridY;
    const el = document.createElement('div');
    el.className = 'grid-cell';
    el.style.cssText = `left:${cell.col * cw}px;top:${cell.row * ch}px;width:${cw}px;height:${ch}px;display:flex;align-items:center;justify-content:center;background:rgb(${params.bgR || 0},${params.bgG || 0},${params.bgB || 0});position:absolute;box-sizing:border-box;border:3px solid transparent;`;
    el.dataset.index = idx !== undefined ? idx : activeCells.indexOf(cell);
    const size = params.size || currentSize;
    const p = userScenario?.params || {};
    const svgData = getStimulusSVG(
        {
            stimType: p.type || 'LETTER_E',
            stimDirection: direction,
            stimR: params.stimR || 255,
            stimG: params.stimG || 255,
            stimB: params.stimB || 255,
            bgR: params.bgR || 0,
            bgG: params.bgG || 0,
            bgB: params.bgB || 0
        },
        size
    );
    el.innerHTML = svgData.html;
    stimDisplay.appendChild(el);
}
function processCompareAnswer(isCorrect) {
    if (!playerRunning || isPaused) return;
    if (currentShowTimer) {
        clearTimeout(currentShowTimer);
        currentShowTimer = null;
    }
    const p = userScenario?.params || {};
    if (isCorrect) seriesCorrect++;
    else seriesIncorrect++;
    seriesStep++;
    updateCounters();
    saveResult('user_compare', lastResponse.reactionTimeMs, isCorrect);
    if (seriesStep >= (p.seriesSize || 6)) {
        finishCompareSeries();
        return;
    }
    phaseTimers.push(
        setTimeout(() => {
            if (playerRunning && !isPaused) showNextCompareRound();
        }, p.delay2 || 1000)
    );
}
function finishCompareSeries() {
    const p = userScenario?.params || {};
    const th = p.seriesThreshold || getThreshold(p.seriesSize || 6);
    const ok = seriesCorrect >= th;
    completedSeries++;
    if (ok) successfulSeries++;
    else failedSeries++;
    seriesCorrect = seriesIncorrect = seriesNoAnswer = seriesStep = 0;
    updateCounters();
    if (completedSeries >= (p.seriesCount || 5)) {
        showFinishedReport();
        stopPlayer();
        return;
    }
    phaseTimers.push(
        setTimeout(() => {
            if (playerRunning && !isPaused) showNextCompareRound();
        }, p.delay2 || 1000)
    );
}

// ==================== user.js: Конец части 2 из 4 ====================
// ==================== user.js: Начало части 3 из 4 ====================

// ==================== ОТВЕТЫ (плоский режим) ====================
function handleDirectionAnswer(direction) {
    if (!responsePhaseActive) return;
    const ok = direction === currentCorrectDirection;
    lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: performance.now() - responseStartTime };
    responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(() => {
        document.body.style.background = '#0b0b0f';
    }, 200);
    saveResult('user_single', lastResponse.reactionTimeMs, ok);
}
function handleCompareAnswer(answer) {
    if (!responsePhaseActive) return;
    const ok = answer === currentCompareAnswer;
    lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: performance.now() - responseStartTime };
    responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(() => {
        document.body.style.background = '#0b0b0f';
    }, 200);
    processCompareAnswer(ok);
}
responseButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-resp');
    if (!btn || !responsePhaseActive) return;
    if (btn.dataset.dir) {
        if (graphActive) handleGraphDirectionAnswer(btn.dataset.dir);
        else handleDirectionAnswer(btn.dataset.dir);
    } else if (btn.dataset.answer === 'да' || btn.dataset.answer === 'нет') {
        const inCmp =
            compareMode === 'direction' && (userScenario?.params?.trainingType === 'compare' || graphActive);
        if (inCmp) {
            const val = btn.dataset.answer === 'да';
            if (graphActive) handleGraphCompareAnswer(val);
            else handleCompareAnswer(val);
        }
    }
});
document.addEventListener('keydown', (e) => {
    if (readingViewportEl.style.display === 'block') {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevReadingPage();
            return;
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextReadingPage();
            return;
        }
        if (e.key === ' ') {
            e.preventDefault();
            toggleReadingPause();
            return;
        }
    }
    if (!responsePhaseActive) return;
    const map = { ArrowUp: 'вверх', ArrowDown: 'вниз', ArrowLeft: 'влево', ArrowRight: 'вправо' };
    if (map[e.key]) {
        e.preventDefault();
        const inCmp =
            compareMode === 'direction' && (userScenario?.params?.trainingType === 'compare' || graphActive);
        if (inCmp) {
            if (e.key === 'ArrowLeft') {
                graphActive ? handleGraphCompareAnswer(true) : handleCompareAnswer(true);
            } else if (e.key === 'ArrowRight') {
                graphActive ? handleGraphCompareAnswer(false) : handleCompareAnswer(false);
            }
        } else {
            if (graphActive) handleGraphDirectionAnswer(map[e.key]);
            else handleDirectionAnswer(map[e.key]);
        }
    }
});

// ==================== ЧТЕНИЕ (плоский режим) ====================
function startReading() {
    const p = userScenario?.params || {};
    const text = p.text || '';
    const pars = text
        .split(/\n+/)
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
    readingContentEl.innerHTML = pars.map((x) => `<p>${escapeHtml(x)}</p>`).join('');
    readingContentEl.style.color = p.textColor
        ? `rgb(${p.textColor.r},${p.textColor.g},${p.textColor.b})`
        : '#000';
    applyReadingBackground(p);
    stimDisplay.style.display = 'none';
    responseButtons.style.display = 'none';
    readingViewportEl.style.display = 'block';
    readingViewportEl.scrollLeft = 0;
    readingPaused = false;
    const pp = $('reading-play-pause');
    if (pp) pp.textContent = '⏸ Пауза';
    readingContentEl.style.opacity = '1';
    applyReadingFont(p);
    setupReadingColumns();
    const dCalc = p.readingDistance || 1;
    readingContentEl.style.fontSize = acuityToFontSizePx(currentAcuity, dCalc, screenPPI) + 'px';
    setTimeout(() => {
        readingTotalPages = calcReadingTotalPages();
        readingPage = 0;
        scrollReadingToPage(0);
    }, 80);
    readingToolbarEl.style.display = 'flex';
}
function applyReadingFont(p) {
    const family = (p.readingFontFamily && p.readingFontFamily.trim()) || 'Segoe UI';
    const safe = family.replace(/['"]/g, '');
    readingContentEl.style.fontFamily =
        safe.toLowerCase() === 'sivtsev'
            ? `'Sivtsev', 'Segoe UI', sans-serif`
            : `'${safe}', 'Segoe UI', Tahoma, sans-serif`;
    readingContentEl.style.fontWeight = p.readingFontWeight || 'normal';
}
function setupReadingColumns() {
    const vw = readingViewportEl.clientWidth;
    if (vw <= 0) return;
    const sp = 80,
        tw = Math.max(200, vw - sp);
    readingContentEl.style.columnWidth = tw + 'px';
    readingContentEl.style.columnGap = sp + 'px';
}
function calcReadingTotalPages() {
    const W = readingViewportEl.clientWidth;
    if (W <= 0) return 1;
    return Math.max(1, Math.round(readingContentEl.scrollWidth / W));
}
function scrollReadingToPage(page) {
    readingTotalPages = calcReadingTotalPages();
    readingPage = Math.max(0, Math.min(page, readingTotalPages - 1));
    readingViewportEl.scrollLeft = readingPage * readingViewportEl.clientWidth;
    const info = $('reading-page-info');
    if (info) info.textContent = `Стр. ${readingPage + 1} / ${readingTotalPages}`;
}
function prevReadingPage() {
    if (readingPage > 0) scrollReadingToPage(readingPage - 1);
}
function nextReadingPage() {
    if (readingPage < readingTotalPages - 1) scrollReadingToPage(readingPage + 1);
}
function toggleReadingPause() {
    readingPaused = !readingPaused;
    const b = $('reading-play-pause');
    if (readingPaused) {
        readingContentEl.style.opacity = '0';
        if (b) b.textContent = '▶ Чтение';
    } else {
        readingContentEl.style.opacity = '1';
        if (b) b.textContent = '⏸ Пауза';
    }
}
function applyReadingBackground(p) {
    const m = p.bgMode || 'solid';
    stopReadingDynamicBg();
    if (m === 'split') {
        const lw = Math.max(0, Math.min(100, p.splitLeftWidthPercent ?? 50));
        const lc = p.splitLeftColor || { r: 0, g: 0, b: 0 },
            rc = p.splitRightColor || { r: 0, g: 0, b: 0 };
        readingViewportEl.style.background = `linear-gradient(to right, rgb(${lc.r},${lc.g},${lc.b}) 0%, rgb(${lc.r},${lc.g},${lc.b}) ${lw}%, rgb(${rc.r},${rc.g},${rc.b}) ${lw}%, rgb(${rc.r},${rc.g},${rc.b}) 100%)`;
        return;
    }
    if (m === 'gradient') {
        const lc = p.gradientLeftColor || { r: 255, g: 255, b: 255 },
            rc = p.gradientRightColor || { r: 0, g: 0, b: 0 };
        if (p.gradientMidEnabled !== false) {
            const mc = p.gradientMidColor || { r: 204, g: 204, b: 204 },
                mp = Math.max(0, Math.min(100, p.gradientMidPosition ?? 50));
            readingViewportEl.style.background = `linear-gradient(to right, rgb(${lc.r},${lc.g},${lc.b}) 0%, rgb(${mc.r},${mc.g},${mc.b}) ${mp}%, rgb(${rc.r},${rc.g},${rc.b}) 100%)`;
        } else
            readingViewportEl.style.background = `linear-gradient(to right, rgb(${lc.r},${lc.g},${lc.b}) 0%, rgb(${rc.r},${rc.g},${rc.b}) 100%)`;
        return;
    }
    if (m === 'dynamic') {
        startReadingDynamicBg(p);
        return;
    }
    const bg = p.bgColor || { r: 255, g: 255, b: 255 };
    readingViewportEl.style.background = `rgb(${bg.r},${bg.g},${bg.b})`;
}
function startReadingDynamicBg(p) {
    stopReadingDynamicBg();
    const mode = p.dynamicMode || 'simple';
    const rev = p.dynamicReverse === true;
    let base;
    if (mode === 'rgb') {
        base = [
            { from: { r: 255, g: 0, b: 0 }, to: { r: 255, g: 255, b: 0 } },
            { from: { r: 255, g: 255, b: 0 }, to: { r: 0, g: 255, b: 0 } },
            { from: { r: 0, g: 255, b: 0 }, to: { r: 0, g: 255, b: 255 } },
            { from: { r: 0, g: 255, b: 255 }, to: { r: 0, g: 0, b: 255 } }
        ];
    } else {
        const A = p.dynamicStartColor || { r: 255, g: 0, b: 0 };
        const B = p.dynamicEndColor || { r: 0, g: 0, b: 255 };
        base =
            p.dynamicMidEnabled && p.dynamicMidColor
                ? [
                      { from: A, to: p.dynamicMidColor },
                      { from: p.dynamicMidColor, to: B }
                  ]
                : [{ from: A, to: B }];
    }
    const phases = rev
        ? base.concat(
              base
                  .slice()
                  .reverse()
                  .map((ph) => ({ from: ph.to, to: ph.from }))
          )
        : base;
    const cnt = phases.length;
    const cycleMs = Math.max(100, p.dynamicDuration || 10000);
    const first = phases[0].from;
    readingViewportEl.style.background = `rgb(${first.r},${first.g},${first.b})`;
    readingBgAnimStart = null;
    readingBgAnimPausedAt = null;
    function tick(now) {
        if (readingPaused) {
            if (readingBgAnimPausedAt === null) readingBgAnimPausedAt = now;
            readingBgAnimId = requestAnimationFrame(tick);
            return;
        }
        if (readingBgAnimPausedAt !== null) {
            readingBgAnimStart += now - readingBgAnimPausedAt;
            readingBgAnimPausedAt = null;
        }
        if (readingBgAnimStart === null) readingBgAnimStart = now;
        let el = Math.max(0, now - readingBgAnimStart);
        let t = (el % cycleMs) / cycleMs;
        const pi = Math.max(0, Math.min(cnt - 1, Math.floor(t * cnt)));
        const pp = Math.max(0, Math.min(1, t * cnt - pi));
        const ph = phases[pi];
        if (!ph) {
            readingBgAnimId = null;
            return;
        }
        const c = lerpColor(ph.from, ph.to, pp);
        readingViewportEl.style.background = `rgb(${c.r},${c.g},${c.b})`;
        readingBgAnimId = requestAnimationFrame(tick);
    }
    readingBgAnimId = requestAnimationFrame(tick);
}
function stopReadingDynamicBg() {
    if (readingBgAnimId) {
        cancelAnimationFrame(readingBgAnimId);
        readingBgAnimId = null;
    }
    readingBgAnimPausedAt = null;
}
function finishReading() {
    completedSeries++;
    successfulSeries++;
    updateCounters();
    stopPlayer();
    showStatus('Чтение завершено', 'Тренировка окончена.', 'Ещё раз', () => {
        hideStatus();
        startPlayer();
    });
}

// ==================== ФИНАЛ / ПАУЗА ====================
function showFinishedReport() {
    const p = userScenario?.params || {};
    let txt = `Серий: ${completedSeries} · Успешных: ${successfulSeries} · Неуспешных: ${failedSeries}`;
    if (p.trainingType !== 'reading' && !graphActive) txt += ` · Итоговая V: ${currentAcuity.toFixed(1)}`;
    showStatus('Готово!', txt, 'Ещё раз', () => {
        hideStatus();
        startPlayer();
    });
}
function pauseTraining() {
    phaseTimers.forEach((t) => clearTimeout(t));
    phaseTimers = [];
    if (currentShowTimer) clearTimeout(currentShowTimer);
    stopSingleStimAnimation();
    stopSingleBgAnimation();
    stopCircleAnimation();
    stopPeripheralAnimation();
    stopBlinkAnimation();
    responsePhaseActive = false;
    hideStimulus();
    responseButtons.style.display = 'none';
    isPaused = true;
    btnPlayerPause.disabled = true;
    pauseModal.classList.add('open');
}
function resumeTraining() {
    pauseModal.classList.remove('open');
    isPaused = false;
    noAnswerSeriesStreak = 0;
    btnPlayerPause.disabled = false;
    if (graphActive) {
        const node = gGetNode(gCurrentNodeId);
        if (node) {
            if (node.nodeType === 'COMPARE') playGraphCompareRound(node);
            else if (node.nodeType === 'READING') {
            } else playGraphStimulus(node);
            return;
        }
        playNextGraphNode();
        return;
    }
    const p = userScenario?.params || {};
    if (p.trainingType === 'compare') showNextCompareRound();
    else if (p.trainingType === 'reading') {
    } else showNextStimulus();
}
function stopPlayer() {
    phaseTimers.forEach((t) => clearTimeout(t));
    phaseTimers = [];
    if (currentShowTimer) clearTimeout(currentShowTimer);
    stopSingleStimAnimation();
    stopSingleBgAnimation();
    stopCircleAnimation();
    stopPeripheralAnimation();
    stopBlinkAnimation();
    stopReadingDynamicBg();
    window.Voice?.stopReading();
    playerRunning = false;
    isPaused = false;
    responsePhaseActive = false;
    hideStimulus();
    responseButtons.style.display = 'none';
    readingToolbarEl.style.display = 'none';
    readingViewportEl.style.display = 'none';
    readingContentEl.innerHTML = '';
    stimDisplay.style.display = '';
    btnPlayer.disabled = false;
    btnPlayerStop.disabled = true;
    btnPlayerPause.disabled = true;
    document.body.style.background = '#0b0b0f';
    pauseModal.classList.remove('open');
    camBaseline = null;
    camWarnKind = null;
    sessionId = null;
    graphActive = false;
    gCurrentNodeId = null;
    gCurrentCompareNode = null;
    gQueue = [];
    gIndex = 0;
}
function togglePause() {
    if (!playerRunning) return;
    if (isPaused) {
        resumeTraining();
        return;
    }
    isPaused = true;
    phaseTimers.forEach((t) => clearTimeout(t));
    phaseTimers = [];
    if (currentShowTimer) clearTimeout(currentShowTimer);
    stopSingleStimAnimation();
    stopSingleBgAnimation();
    stopCircleAnimation();
    stopPeripheralAnimation();
    stopBlinkAnimation();
    hideStimulus();
    responseButtons.style.display = 'none';
    pauseModal.classList.add('open');
}

// ==================== SAVE RESULT ====================
async function saveResult(nodeId, reactionTimeMs, isCorrect) {
    if (!checkRateLimit()) return;
    if (!supabaseClient || !currentUser || !sessionId) return;
    try {
        await supabaseClient.from('test_results').insert({
            user_id: currentUser.id,
            session_id: sessionId,
            node_id: nodeId || 'user_training',
            response_time_ms: reactionTimeMs,
            is_correct: isCorrect,
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.warn('[user] save:', e);
    }
}
function scheduleVoiceCountdown(durationMs) {
    if (!window.Voice || !window.Voice.enabled) return;
    if (!durationMs || durationMs < 5000) return;
    const timers = [];
    if (durationMs - 5000 > 0)
        timers.push(
            setTimeout(() => {
                if (responsePhaseActive && !isPaused) window.Voice.sayKey('countdown5');
            }, durationMs - 5000)
        );
    [3, 2, 1].forEach((s) => {
        const at = durationMs - s * 1000;
        if (at > 0)
            timers.push(
                setTimeout(() => {
                    if (responsePhaseActive && !isPaused) window.Voice.sayKey('countdown' + s);
                }, at)
            );
    });
    const w = setInterval(() => {
        if (!responsePhaseActive) {
            timers.forEach((t) => clearTimeout(t));
            clearInterval(w);
        }
    }, 200);
}

// ==================== user.js: Конец части 3 из 4 ====================
// ==================== user.js: Начало части 4 из 4 ====================

// ==================== INIT ====================
function init() {
    $('auth-submit').addEventListener('click', doAuth);
    $('auth-toggle').addEventListener('click', () => {
        authMode = authMode === 'signin' ? 'signup' : 'signin';
        updateAuthModal();
    });
    $('auth-email').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doAuth();
    });
    $('auth-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doAuth();
    });
    btnLogout.addEventListener('click', async () => {
        try {
            stopPlayer();
        } catch (e) {}
        try {
            disableCamera();
        } catch (e) {}
        try {
            await supabaseClient.auth.signOut();
        } catch (e) {}
        currentUser = null;
        userScenario = null;
        userScenarios = [];
        hdrUser.textContent = '—';
        hdrScenario.textContent = '—';
        btnPlayer.disabled = true;
        promptLogin();
    });

    btnPlayer.addEventListener('click', startPlayer);
    btnPlayerPause.addEventListener('click', togglePause);
    btnPlayerStop.addEventListener('click', stopPlayer);
    $('pause-continue').addEventListener('click', resumeTraining);
    $('pause-exit').addEventListener('click', () => {
        pauseModal.classList.remove('open');
        stopPlayer();
    });

    hdrScenario.addEventListener('click', () => {
        if (userScenarios.length > 0) openScenarioPicker();
    });
    $('scenario-close').addEventListener('click', () => $('scenario-modal').classList.remove('open'));
    btnHistory.addEventListener('click', openHistory);
    $('history-close').addEventListener('click', () => $('history-modal').classList.remove('open'));

    $('reading-prev').addEventListener('click', prevReadingPage);
    $('reading-next').addEventListener('click', nextReadingPage);
    $('reading-play-pause').addEventListener('click', toggleReadingPause);
    $('reading-finish').addEventListener('click', () => {
        if (graphActive && gCurrentNodeId) {
            const n = gGetNode(gCurrentNodeId);
            finishGraphReading(n);
        } else finishReading();
    });
    $('reading-not-see').addEventListener('click', () => {
        currentAcuity = Math.max(0.1, Math.round((currentAcuity - 0.1) * 10) / 10);
        const d = userScenario?.params?.readingDistance || 1;
        readingContentEl.style.fontSize = acuityToFontSizePx(currentAcuity, d, screenPPI) + 'px';
        setTimeout(() => {
            readingTotalPages = calcReadingTotalPages();
            scrollReadingToPage(0);
        }, 60);
    });
    $('reading-see-well').addEventListener('click', () => {
        currentAcuity = Math.min(2.0, Math.round((currentAcuity + 0.1) * 10) / 10);
        const d = userScenario?.params?.readingDistance || 1;
        readingContentEl.style.fontSize = acuityToFontSizePx(currentAcuity, d, screenPPI) + 'px';
        setTimeout(() => {
            readingTotalPages = calcReadingTotalPages();
            scrollReadingToPage(0);
        }, 60);
    });

    let scrollTimer = null;
    readingViewportEl.addEventListener('scroll', () => {
        if (readingViewportEl.style.display === 'none' || scrollTimer) return;
        scrollTimer = setTimeout(() => {
            scrollTimer = null;
            const W = readingViewportEl.clientWidth;
            if (W <= 0) return;
            const np = Math.round(readingViewportEl.scrollLeft / W);
            if (np !== readingPage) {
                readingPage = Math.max(0, Math.min(np, readingTotalPages - 1));
                const info = $('reading-page-info');
                if (info) info.textContent = `Стр. ${readingPage + 1} / ${readingTotalPages}`;
            }
        }, 100);
    });

    loadSivtsevFont();
    initSupabase();
}
async function loadSivtsevFont() {
    const FONT_URL = 'https://cdn.jsdelivr.net/gh/shoorick/sivtsev-font@master/Sivtsev-Eye-Chart.otf';
    const KEY = 'sivtsevFontLoaded';
    if (localStorage.getItem(KEY) === 'true') return;
    let loaded = false;
    document.fonts.forEach((f) => {
        if (f.family === 'Sivtsev' && f.status === 'loaded') loaded = true;
    });
    if (loaded) {
        localStorage.setItem(KEY, 'true');
        return;
    }
    try {
        const font = new FontFace('Sivtsev', `url(${FONT_URL}) format('opentype')`, {
            style: 'normal',
            weight: 'normal'
        });
        await font.load();
        document.fonts.add(font);
        localStorage.setItem(KEY, 'true');
    } catch (e) {
        console.warn('Sivtsev:', e);
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
// ==================== user.js: Конец части 4 из 4 ====================
