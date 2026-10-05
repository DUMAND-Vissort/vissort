// ==================== user.js: Начало части 1 из 4 ====================
'use strict';

// ============================================================
// PATCH28_PHASE3: shared helpers come from vissort-core.js
// ============================================================
if (!window.VissortCore) {
    throw new Error('[player] VissortCore not loaded. Include <script src="vissort-core.js"></script> BEFORE player-runtime.js.');
}
const {
    acuityToSizeMm, acuityToSizePx, acuityToFontSizePx,
    detectDeviceType, detectPPIHeuristic, loadPPI,
    hexToRgb, rgbToHex, lerpColor,
    buildGenericDynamicPhases, buildCirclePhases,
    generateLetterE, generateLandoltRing,
    getCircleStimulusSVG, getStimulusSVG,
    escapeHtml, getThreshold, randomDirection
} = window.VissortCore;

// ==================== PLAYER OPTIONS ====================
(function checkPlayerOptions() {
    const opts = window.VissortPlayerOptions || { requireDomain: false };
    if (opts.requireDomain) {
        const ALLOWED = ['vissort.com', 'www.vissort.com', 'localhost', '127.0.0.1'];
        if (!ALLOWED.includes(location.hostname)) {
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0b12;color:#e8e8f0;font-family:sans-serif;text-align:center;padding:20px"><div><h1 style="font-size:24px;margin-bottom:12px">Access denied</h1><p style="color:#9494a8">Player only works on vissort.com</p></div></div>';
            throw new Error('Domain not allowed');
        }
    }
})();

const SUPABASE_URL = 'https://hzvypwdpdhsjzaclxmbm.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6dnlwd2RwZGhzanphY2x4bWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjIyNTIsImV4cCI6MjEwNDE5ODI1Mn0.HK0VE9KdzS8c7WoMCIlvOUn02vSOQEN0ahGPgsYzKac';

(function installAuthObserver() {
    function bindForm() {
        const form = document.getElementById('auth-form');
        if (!form || form._authBound) return;
        form._authBound = true;
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof doAuth === 'function') doAuth();
        });
        console.log('[auth] форма привязана');
    }
    function focusFirstField() {
        const email = document.getElementById('auth-email');
        const pass = document.getElementById('auth-password');
        if (!email || !pass) return;
        try {
            if (email.value) { pass.focus(); pass.select(); }
            else { email.focus(); email.select(); }
        } catch (_) {}
    }
    function onModalOpen() {
        bindForm();
        setTimeout(focusFirstField, 150);
    }
    function attach() {
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        bindForm();
        const obs = new MutationObserver(function () {
            if (modal.classList.contains('open')) onModalOpen();
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
        if (modal.classList.contains('open')) onModalOpen();
        console.log('[auth] observer установлен');
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
})();
let supabaseClient = null;
let currentUser = null;
let userScenarios = [];
let userScenario = null;
let sessionId = null;
let authMode = 'signin';

// PATCH_PHASE1: moved to PlayerState

// PATCH50_LOG_FN: per-answer logging
window._reactionLog = window._reactionLog || [];
window._logAnswer = function(entry) {
    window._reactionLog.push(entry);
    var tag = entry.valid ? '[answer]' : '[invalid]';
    var msg = tag + ' rt=' + (entry.rt != null ? Math.round(entry.rt) + 'ms' : 'n/a')
            + ' correct=' + entry.correct;
    if (entry.direction) msg += ' dir=' + entry.direction;
    if (entry.reason) msg += ' reason=' + entry.reason;
    console.log(msg);
};
window._reactionReport = function() {
    var log = window._reactionLog || [];
    var rts = log.filter(function(e){return e.rt != null && e.valid;}).map(function(e){return e.rt;});
    console.log('Total: ' + log.length + ' | Valid: ' + rts.length);
    if (rts.length) console.log('RT raw: [' + rts.map(function(x){return Math.round(x);}).join(', ') + ']');
};
// PATCH_PHASE1: moved to PlayerState
// PATCH_PHASE1: moved to PlayerState
// PATCH_PHASE1: moved to PlayerState
// PATCH_PHASE1: moved to PlayerState
let responseStartTime = 0;
let lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
let _stimulusDistance = null; // PATCH_CLEAN
let currentCorrectDirection = null;
let lastDirection = null;

// PATCH_PHASE1: moved to PlayerState (group: series)
// PATCH_PHASE1: moved to PlayerState (group: series)
// PATCH_PHASE1: moved to PlayerState (group: series)
// PATCH_PHASE1: moved to PlayerState (group: stimulus)
// PATCH_PHASE1: moved to PlayerState (group: stimulus)
// PATCH_PHASE1: moved to PlayerState (group: stimulus)
// PATCH_PHASE1: moved to PlayerState (group: stimulus)
// PATCH_PHASE1: moved to PlayerState (group: stimulus)
// PATCH_PHASE1: moved to PlayerState (group: stimulus)
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

// ==================== PATCH22: device config ====================
const _camDevice = (function() {
    var ua = navigator.userAgent || '';
    var isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) && !/Mobile/i.test(ua);
    var isPhone = /Android|iPhone|iPod|Mobile|Opera Mini|IEMobile/i.test(ua) && !isTablet;
    return {
        isPhone: isPhone,
        isTablet: isTablet,
        isDesktop: !isPhone && !isTablet,
        label: isPhone ? 'phone' : (isTablet ? 'tablet' : 'desktop')
    };
})();

// PATCH22F: reduce inputSize for performance
const _camConfig = _camDevice.isPhone
    ? { inputSize: 320, intervalMs: 300, videoW: 320, videoH: 240, frameRate: 15 }
    : _camDevice.isTablet
    ? { inputSize: 320, intervalMs: 200, videoW: 480, videoH: 360, frameRate: 20 }
    : { inputSize: 320, intervalMs: 200, videoW: 480, videoH: 360, frameRate: 24 };

let _camLoopStarted = false;

window.camStats = {
    device: _camDevice.label,
    backend: 'unknown',
    inputSize: _camConfig.inputSize,
    intervalMs: _camConfig.intervalMs,
    videoW: _camConfig.videoW,
    videoH: _camConfig.videoH,
    frames: 0,
    detections: 0,
    fails: 0,
    totalDetectMs: 0,
    avgDetectMs: 0,
    fps: 0,
    fpsSamples: [],
    lastFpsUpdate: 0
};

window.camReport = function() {
    var s = window.camStats;
    console.log('=== CAMERA STATS (PATCH22) ===');
    console.log('Device      :', s.device);
    console.log('Backend     :', s.backend);
    console.log('Input size  :', s.inputSize + 'x' + s.inputSize);
    console.log('Interval    :', s.intervalMs + ' ms');
    console.log('Video       :', s.videoW + 'x' + s.videoH);
    console.log('Detections  :', s.detections);
    console.log('Fails       :', s.fails);
    console.log('Avg detect  :', s.avgDetectMs.toFixed(1) + ' ms');
    console.log('Last FPS    :', s.fps);
    console.log('FPS samples :', s.fpsSamples.join(', '));
    return s;
};

console.log('[cam] config:', JSON.stringify({
    device: _camDevice.label,
    inputSize: _camConfig.inputSize,
    intervalMs: _camConfig.intervalMs,
    video: _camConfig.videoW + 'x' + _camConfig.videoH
}));

// === ПЛЕЕР ГРАФА (объявления ДО первого использования в updateCounters) ===
let graphActive = false;
let gNodes = [];
let gConnections = [];
let gQueue = [];
let gIndex = 0;
let gCurrentNodeId = null;
let gNodeAcuityCurrent = 1.0;
let gCurrentCompareNode = null;
let _frameSkipCounter = 0;
// PATCH28b: declarations for PATCH91 stability detection
let _waitingStable = false;
let _stableSince = 0;
let _stableBuf = [];
let _answerBlocked = false; // PATCH31C2A_APPLIED

// ==================== PATCH30_ABORT: instant stimulus abort ====================
// Called when user's distance deviates >15%, face is lost, or face returns.
// Cancels current show, waits for stability, then reshows from scratch.
function _abortCurrentStimulus(reason) {
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    if (_waitingStable) return; // idempotent

    console.log('[abort] reason=' + reason + ' (dist=' + (curDistanceM != null ? curDistanceM.toFixed(2) : '?') + 'm)');

    // PATCH31C2A_APPLIED: stop timer, freeze animations, KEEP stimulus visible
    if (PlayerState.currentShowTimer) { clearTimeout(PlayerState.currentShowTimer); PlayerState.currentShowTimer = null; }

    // Freeze animations by cancelling RAFs — last frame stays on screen
    if (singleStimAnimId) { cancelAnimationFrame(singleStimAnimId); singleStimAnimId = null; }
    if (singleBgAnimId)   { cancelAnimationFrame(singleBgAnimId);   singleBgAnimId = null; }
    if (_circleAnimId)    { cancelAnimationFrame(_circleAnimId);    _circleAnimId = null; }
    if (_periAnimId)      { cancelAnimationFrame(_periAnimId);      _periAnimId = null; }
    if (_blinkTimerId)    { clearTimeout(_blinkTimerId);            _blinkTimerId = null; }
    // NOTE: do NOT call hideStimulus / stopSingleStimAnimation / etc. — stimulus stays frozen.

    PlayerState.responsePhaseActive = false;
    if (responseButtons) responseButtons.style.display = 'none';

    // PATCH31C2A_APPLIED: block answers
    _answerBlocked = true;

    // Discard answer (unless already counted in same ms)
    if (lastResponse && lastResponse.answered) {
        console.log('[abort] late answer discarded');
    }
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };

    // Enter waiting-stable state
    _waitingStable = true;
    _stableSince = 0;
    _stableBuf = [];
    // keep _stimulusDistance for reference; will be updated in _resumeAfterStable
}

// Called after distance is stable (5 frames within 3%).
// Resets abort state and shows the next stimulus (or current node, if graph).
function _resumeAfterStable() {
    _waitingStable = false;
    _answerBlocked = false; // PATCH31C2A_APPLIED
    _stableSince = 0;
    _stableBuf = [];
    _stimulusDistance = curDistanceM;
    console.log('[abort] stable at ' + curDistanceM.toFixed(2) + 'm -- resuming');

    // Prefer current graph node; fallback to flat autotraining
    var _n = null;
    try { _n = getNode(currentPlayingNodeId); } catch (e) { _n = null; }
    if (_n && gNodes && gNodes.indexOf(_n) !== -1) {
        if (_n.nodeType === 'COMPARE') playGraphCompareRound(_n);
        else playGraphStimulus(_n);
        return;
    }
    if (typeof showNextStimulus === 'function') {
        try { showNextStimulus(); } catch (e) { console.warn('[abort] resume flat failed:', e); }
    }
}
// ==================== PATCH27B: fast-lean detection ====================
window._deviationHistory = [];
window._fastLeanAt = 0;
window._invalidAnswerCount = 0;

// PATCH30_DAMPEN: raise threshold, require 3 consecutive frames (camera noise filter)
const _LEAN_DROP_PCT = 15; // PATCH50
const _LEAN_FAST_MS = 800;
const _LEAN_WINDOW_MS = 4000; // PATCH60
const _DEVIATION_HISTORY_MS = 2000;
const _LEAN_CONSECUTIVE_FRAMES = 3;

// PATCH30_DAMPEN_FUNC: requires 3 consecutive frames, only when training
// PATCH32_CORE: log only, decision in _isAnswerInvalid
// PATCH36: log deviations > 12% when training
window._recordDeviation = function(pct) {
    if (!PlayerState.playerRunning) return;
    if (PlayerState.isPaused) return;
    var now = performance.now();
    window._deviationHistory.push({ t: now, dev: pct });
    while (window._deviationHistory.length && now - window._deviationHistory[0].t > _DEVIATION_HISTORY_MS) {
        window._deviationHistory.shift();
    }
    // PATCH60: velocity check -- big jump between frames = lean
    var _lastH = window._deviationHistory[window._deviationHistory.length - 2];
    if (_lastH) {
        var _vel = Math.abs(pct - _lastH.dev);
        if (_vel > 8) {
            window._fastLeanAt = now;
            var _llog = window._lastLeanLogAt || 0;
            if (now - _llog > 2000) {
                console.warn('[lean] velocity', _vel.toFixed(1) + '%', '(from', _lastH.dev.toFixed(1) + ' to', pct.toFixed(1) + ')');
                window._lastLeanLogAt = now;
            }
        }
    }
    if (Math.abs(pct) > _LEAN_DROP_PCT) {
        window._fastLeanAt = now;
        var _lastLeanLogAt = window._lastLeanLogAt || 0;
        if (now - _lastLeanLogAt > 3000) {
            console.warn('[lean]', pct.toFixed(1) + '%');
            window._lastLeanLogAt = now;
        }
    }
};

// PATCH31: simpler logic -- only fast lean (fresh) + current off-distance
// PATCH32_CORE: check both current distance and recent lean
// PATCH33: average deviation over 1 sec + current distance
// PATCH34: velocity-based detection (delta over 600ms), plus current distance
// PATCH36: current distance OR recent lean in 2 sec
window._isAnswerInvalid = function() {
    if (!PlayerState.playerRunning) return null;
    if (PlayerState.isPaused) return null;
    var now = performance.now();
    // 1. Current distance
    try {
        if (typeof curDistanceM !== 'undefined' && curDistanceM != null && camBaseline != null) {
            var curDev = (curDistanceM - camBaseline) / camBaseline * 100;
            if (Math.abs(curDev) > _LEAN_DROP_PCT) {
                return curDev < 0 ? 'fast_lean' : 'off_distance';
            }
        }
    } catch (e) {}
    // 2. Recent lean in last 2 sec
    if (now - window._fastLeanAt < 2000) return 'fast_lean';
    return null;
};

window._markAnswerInvalid = function(reason) {
    window._invalidAnswerCount++;
    var cnt = document.getElementById('cnt-invalid');
    if (cnt) cnt.textContent = window._invalidAnswerCount;
    var msg = reason === 'fast_lean'
        ? '\u26A0\uFE0F \u041E\u0442\u0432\u0435\u0442 \u043D\u0435 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u043D \u2014 \u0440\u0435\u0437\u043A\u0438\u0439 \u043D\u0430\u043A\u043B\u043E\u043D'
        : '\u26A0\uFE0F \u041E\u0442\u0432\u0435\u0442 \u043D\u0435 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u043D \u2014 \u0432\u0435\u0440\u043D\u0438\u0442\u0435\u0441\u044C \u043D\u0430 \u0434\u0438\u0441\u0442\u0430\u043D\u0446\u0438\u044E';
    _showInvalidToast(msg);
    // PATCH31: no voice from invalid-marker (toast only)
};

// PATCH27C_DIM: dim stimulus only on fast lean, auto-restore after 1.5 sec
function _updateStimulusDim() {
    var now = performance.now();
    var leanAge = now - (window._fastLeanAt || 0);
    var stim = document.getElementById('stim');
    if (!stim) return;
    if (leanAge < 1500) {
        stim.style.opacity = '0.7';
    } else if (stim.style.opacity === '0.7') {
        stim.style.opacity = '';
    }
}
function _showInvalidToast(text) {
    var existing = document.getElementById('invalid-toast');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.id = 'invalid-toast';
    el.textContent = text;
    el.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(234,88,12,0.95);color:#fff;padding:14px 24px;border-radius:10px;font-size:16px;font-weight:bold;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.5);pointer-events:none;transition:opacity 0.3s;';
    document.body.appendChild(el);
    setTimeout(function() { el.style.opacity = '0'; }, 1800);
    setTimeout(function() { if (el.parentNode) el.remove(); }, 2200);
}
let _readingFinishGuard = false;
let _readingTimerId = null;

// ==================== RATE LIMIT + SCENARIO VALIDATION ====================
// PATCH_PHASE1: вынесено в player-utils.js
const checkRateLimit = window.PlayerUtils.checkRateLimit;
const validateScenario = window.PlayerUtils.validateScenario;

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

// PATCH28_PHASE3: removed escapeHtml (now in VissortCore)
// PATCH28_PHASE3: removed hexToRgb (now in VissortCore)
// PATCH28_PHASE3: removed rgbToHex (now in VissortCore)
// PATCH28_PHASE3: removed lerpColor (now in VissortCore)
// PATCH28_PHASE3: removed getThreshold (now in VissortCore)
// PATCH28_PHASE3: removed randomDirection (now in VissortCore)
// PATCH28_PHASE3: removed acuityToSizeMm (now in VissortCore)
// PATCH28_PHASE3: removed acuityToSizePx (now in VissortCore)

// PATCH_PHASE1: вынесено в player-utils.js
function _effectiveDistance(declared) {
    return window.PlayerUtils.effectiveDistance(declared, curDistanceM);
}
// PATCH_PHASE1: вынесено в player-utils.js
window._distEMA = null;
function _smoothDistance(raw) {
    return window.PlayerUtils.smoothDistance(raw);
}
// PATCH28_PHASE3: removed acuityToFontSizePx (now in VissortCore)
// PATCH28_PHASE3: removed detectDeviceType (now in VissortCore)
// PATCH28_PHASE3: removed detectPPIHeuristic (now in VissortCore)
// PATCH28_PHASE3: removed loadPPI (now in VissortCore)
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
	    // PATCH_TEST_NO_LOGIN: bypass auth for test mode
    if (location.search.indexOf('test=1') !== -1) {
        var _raw = null;
        try { _raw = localStorage.getItem('vissort_test_scenario'); } catch (e) {}
        if (_raw) {
            try {
                var _td = JSON.parse(_raw);
                supabaseClient = null;
                currentUser = null;
                sessionId = 'test_' + Date.now();
                userScenario = {
                    id: '__test__',
                    name: '🧪 Тестовый сценарий',
                    params: _td,
                    trainingType: _td.trainingType || 'single'
                };
                userScenarios = [userScenario];
                authModal.classList.remove('open');
                hdrUser.textContent = '🧪';
                hdrScenario.textContent = userScenario.name;
                applyScenarioDefaults();
                updateCounters();
                hideStatus();
                btnPlayer.disabled = false;
                console.log('[test] no-login mode');
                setTimeout(function () { try { enableCamera(); } catch (e) {} }, 100);
                return;
            } catch (e) {
                console.warn('[test] no-login failed:', e);
            }
        }
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    var _onLoggedInFired = false;
    function _safeOnLoggedIn() {
        if (_onLoggedInFired) return;
        _onLoggedInFired = true;
        onLoggedIn();
    }
    supabaseClient.auth.getSession().then(({ data }) => {
        currentUser = data?.session?.user || null;
        if (currentUser) _safeOnLoggedIn();
        else promptLogin();
    });
    // PATCH28_AUTH_FIX: handle SIGNED_IN + INITIAL_SESSION (v2 async init)
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        if (event === 'SIGNED_OUT') { _onLoggedInFired = false; promptLogin(); return; }
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && currentUser) {
            _safeOnLoggedIn();
        }
    });
    // PATCH28_AUTH_FIX: fallback -- if getSession was too early, retry in 1.5s
    setTimeout(async () => {
        if (_onLoggedInFired) return;
        try {
            const { data } = await supabaseClient.auth.getSession();
            if (data?.session?.user) {
                currentUser = data.session.user;
                console.log('[auth] PATCH28 fallback: session found, calling onLoggedIn');
                _safeOnLoggedIn();
            }
        } catch (e) {}
    }, 1500);
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
const LS_LAST_EMAIL = 'vissort_last_email';

function encodeCred(s) {
    try { return btoa(unescape(encodeURIComponent(s))); } catch (_) { return ''; }
}
function decodeCred(s) {
    try { return decodeURIComponent(escape(atob(s))); } catch (_) { return ''; }
}
function saveAuthCreds(email, password) {
    try {
        localStorage.setItem(LS_LAST_EMAIL, email);
        localStorage.setItem('vissort_last_pass', encodeCred(password));
    } catch (_) {}
}
function prefillAuthEmail() {
    try {
        const saved = localStorage.getItem(LS_LAST_EMAIL);
        const el = $('auth-email');
        if (saved && el && !el.value) el.value = saved;
        const savedPass = localStorage.getItem('vissort_last_pass');
        const pel = $('auth-password');
        if (savedPass && pel && !pel.value) pel.value = decodeCred(savedPass);
    } catch (_) {}
}

function focusAuthField() {
    const emailEl = $('auth-email');
    const passEl = $('auth-password');
    if (!emailEl || !passEl) return;
    setTimeout(() => {
        try {
            if (emailEl.value) {
                passEl.focus();
                passEl.select();
            } else {
                emailEl.focus();
                emailEl.select();
            }
        } catch (_) {}
    }, 150);
}

function bindAuthForm() {
    const form = $('auth-form');
    if (!form || form._authBound) return;
    form._authBound = true;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        doAuth();
    });
}

function showAuthModal(mode) {
    authMode = mode;
    const t = $('auth-title');
    const nl = $('auth-name-label');
    const ni = $('auth-name');
    const tb = $('auth-toggle');
    const sb = $('auth-submit');
    if (mode === 'signin') {
        t.textContent = 'Вход';
        nl.style.display = 'none';
        ni.style.display = 'none';
        tb.textContent = 'Нет аккаунта? Регистрация';
        sb.textContent = 'Войти';
    } else {
        t.textContent = 'Регистрация';
        nl.style.display = 'block';
        ni.style.display = 'block';
        tb.textContent = 'Уже есть аккаунт? Войти';
        sb.textContent = 'Зарегистрироваться';
    }
    authModal.classList.add('open');
    bindAuthForm();
    prefillAuthEmail();
    focusAuthField();
}

async function doAuth() {
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;
    if (!email || !password) {
        alert('Введите email и пароль');
        return;
    }
    saveAuthCreds(email, password);
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
	    // ==================== PATCH32_TEST: test scenario from admin ====================
    if (location.search.includes('test=1')) {
        try {
            const raw = localStorage.getItem('vissort_test_scenario');
            if (raw) {
                const testData = JSON.parse(raw);
                console.log('[test] loading test scenario from localStorage');
                userScenarios = [{
                    id: '__test__',
                    name: '🧪 Тестовый сценарий',
                    params: testData,
                    trainingType: testData.trainingType || 'single'
                }];
                userScenario = userScenarios[0];
                hdrScenario.textContent = userScenario.name;
                applyScenarioDefaults();
                updateCounters();
                hideStatus();
                btnPlayer.disabled = false;
                if (typeof enableCamera === 'function') {
                    try { enableCamera(); } catch (e) { console.warn('[test] camera:', e); }
                }
                console.log('[test] test scenario loaded, ready to play');
                return;
            } else {
                console.warn('[test] no scenario in localStorage');
            }
        } catch (e) {
            console.warn('[test] failed:', e);
        }
    }
    // ==================== /PATCH32_TEST ====================

    userScenarios = await loadUserScenarios();
    userScenarios = await loadUserScenarios();
    if (!userScenarios.length) {
        showStatus('Сценарий не назначен', 'Обратитесь к администратору.', 'Обновить', () => onLoggedIn());
        // PATCH21: run camera/onboarding even without scenarios
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
    if (p.minDetectPct && !isNaN(p.minDetectPct)) _minDetectPct = parseFloat(p.minDetectPct);
    PlayerState.currentAcuity = p.trainingType === 'reading' ? 1.0 : p.startAcuity || 0.5;
    PlayerState.currentStimColor = p.startStimColor ? { ...p.startStimColor } : { r: 0, g: 255, b: 0 };
    PlayerState.currentBgColor = p.startBgColor ? { ...p.startBgColor } : { r: 0, g: 0, b: 0 };
}

function updateCounters() {
    let p, acuityVal;
    if (graphActive && gCurrentNodeId) {
        const n = gGetNode(gCurrentNodeId);
        p = n || {};
        acuityVal = gNodeAcuityCurrent;
    } else {
        p = userScenario?.params || {};
        acuityVal = PlayerState.currentAcuity;
    }
    const total = p.seriesSize || 6;
    cntProgress.textContent = `${PlayerState.seriesStep}/${total}`;
    cntAcuity.textContent =
        p.nodeType === 'READING' || p.trainingType === 'reading' ? '—' : (acuityVal || 1).toFixed(1);
    cntCorrect.textContent = PlayerState.seriesCorrect;
    cntIncorrect.textContent = PlayerState.seriesIncorrect;
    cntNoAnswer.textContent = PlayerState.seriesNoAnswer;
}

// PATCH28_PHASE3: removed generateLetterE (now in VissortCore)
// PATCH28_PHASE3: removed generateLandoltRing (now in VissortCore)
// PATCH28_PHASE3: removed getCircleStimulusSVG (now in VissortCore)
// PATCH28_PHASE3: removed getStimulusSVG (now in VissortCore)
function setStimColorRGB(r, g, b) {
    const svg = stimDisplay.querySelector('svg');
    if (!svg) return;
    const c = `rgb(${r},${g},${b})`;
    const p = svg.querySelector('path');
    if (p) p.setAttribute('fill', c);
    const cc = svg.querySelector('circle');
    if (cc) cc.setAttribute('stroke', c);
}

// PATCH28_PHASE3: removed buildGenericDynamicPhases (now in VissortCore)
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
        if (!PlayerState.playerRunning || PlayerState.isPaused) {
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
        if (!PlayerState.playerRunning || PlayerState.isPaused) {
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
        if (!PlayerState.playerRunning || PlayerState.isPaused) {
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

// PATCH28_PHASE3: removed buildCirclePhases (now in VissortCore)
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
        if (!PlayerState.playerRunning || PlayerState.isPaused) {
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
        if (!PlayerState.playerRunning || PlayerState.isPaused) {
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
        cell.row === PlayerState.currentSingleCell.row &&
        cell.col === PlayerState.currentSingleCell.col &&
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
    _stimulusDistance = curDistanceM; // PATCH23: РѕРґРЅРѕ РїСЂРёСЃРІР°РёРІР°РЅРёРµ
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

function startCamLoop() {
    if (_camLoopStarted) return;
    _camLoopStarted = true;
    if (camFrameId) clearInterval(camFrameId);
    camFrameId = setInterval(function() {
        if (camActive) processCamFrame();
    }, _camConfig.intervalMs);
    console.log('[cam] loop started @', _camConfig.intervalMs, 'ms');
}

async function enableCamera() {
    // PATCH58: restore focalLengthPx from localStorage if null
    if (!focalLengthPx || focalLengthPx <= 0) {
        var _lsFocal = parseFloat(localStorage.getItem('focalLengthPx') || '0');
        if (_lsFocal > 0) {
            focalLengthPx = _lsFocal;
            console.log('[PATCH58] focalLengthPx restored:', focalLengthPx);
        } else {
            console.warn('[PATCH58] focalLengthPx missing -- distance disabled');
        }
    }
    if (camActive) return;
    try {
        camStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: _camConfig.videoW, max: _camConfig.videoW },
                height: { ideal: _camConfig.videoH, max: _camConfig.videoH },
                frameRate: { ideal: _camConfig.frameRate, max: _camConfig.frameRate + 4 }
            }
        });
        const v = document.createElement('video');
        v.id = 'hidden-video';
        v.autoplay = true;
        v.muted = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        v.style.cssText =
            'position:fixed;left:-9999px;top:0;width:320px;height:240px;opacity:0;pointer-events:none;';
        v.srcObject = camStream;
        document.body.appendChild(v);
        await v.play();
        camActive = true;
        (function(){
            var pv = document.getElementById('stim-cam-preview');
            if (pv) {
                pv.srcObject = camStream;
                var p = pv.play();
                if (p && p.catch) p.catch(function(){});
            }
        })();
        await loadFaceApi();
        camIndicator.style.display = 'block';
        camIndicator.textContent = '📷 Лицо не найдено';
        startCamLoop();
    } catch (e) {
        console.warn('[cam]', e);
    }
}
async function loadFaceApi() {
    if (faceapi.tf) {
        // PATCH26_WASM: try wasm (SIMD) first, then cpu
        var _actual = 'none';
        try {
            if (faceapi.tf.wasm) {
                var _wasmDir = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@1.7.4/dist/';
                if (typeof faceapi.tf.wasm.setWasmPath === 'function') {
                    faceapi.tf.wasm.setWasmPath(_wasmDir);
                } else if (typeof faceapi.tf.wasm.setWasmPaths === 'function') {
                    faceapi.tf.wasm.setWasmPaths(_wasmDir);
                }
                await faceapi.tf.setBackend('wasm');
                await faceapi.tf.ready();
                _actual = (faceapi.tf.getBackend && faceapi.tf.getBackend()) || 'unknown';
                if (_actual !== 'wasm') _actual = 'none';
            }
        } catch (e) {
            console.warn('[cam] wasm backend failed:', e && e.message ? e.message : e);
        }
        if (_actual !== 'wasm') {
            try {
                await faceapi.tf.setBackend('cpu');
                await faceapi.tf.ready();
                _actual = 'cpu';
            } catch (e) {
                console.warn('[cam] cpu backend also failed:', e && e.message ? e.message : e);
            }
        }
        window.camStats.backend = _actual;
        console.log('[cam] backend =', _actual, '(patch26)');
    }
    const M = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
    await faceapi.nets.tinyFaceDetector.loadFromUri(M);
    await faceapi.nets.faceLandmark68Net.loadFromUri(M);
}
// PATCH25: computeEAR removed (landmarks disabled in PATCH25_BBOX)

// === Устойчивость распознавания лица ===
let _detWindow = [];
const _DET_WINDOW_SIZE = 30;
let _minDetectPct = parseFloat(localStorage.getItem('min_detect_pct') || '80') || 80;
let _lastDistWarnAt = 0;
let _distWarnArmed = true;
let _lastSeenDist = null;

function _faceEmoji(rate, hasFaceNow) {
    if (!hasFaceNow && rate < 40) return { icon: '❌', color: '#ef4444', label: 'нет лица / далеко' };
    if (rate < 40) return { icon: '❌', color: '#ef4444', label: 'далеко' };
    if (rate < 80) return { icon: '🙂', color: '#f59e0b', label: 'нестабильно' };
    return { icon: '😊', color: '#22c55e', label: 'устойчиво' };
}

function _pushDetection(found) {
    _detWindow.push(found ? 1 : 0);
    if (_detWindow.length > _DET_WINDOW_SIZE) _detWindow.shift();
    _updateDetectUI();
}

function _detectRatePct() {
    if (_detWindow.length === 0) return 100;
    var sum = 0;
    for (var i = 0; i < _detWindow.length; i++) sum += _detWindow[i];
    return Math.round(sum / _detWindow.length * 100);
}

function _updateDetectUI() {
    var el = document.getElementById('v-detect');
    var rate = _detectRatePct();
    var detCount = 0;
    for (var i = 0; i < _detWindow.length; i++) detCount += _detWindow[i];
    var hasFaceNow = _detWindow.length > 0 && _detWindow[_detWindow.length - 1] === 1;
    var em = _faceEmoji(rate, hasFaceNow);
    if (el) {
        el.textContent = em.icon + ' ' + rate + '% (' + detCount + '/' + _detWindow.length + ') · ' + em.label;
        el.style.color = em.color;
    }
    var _fs = document.getElementById('stim-face-status');
    if (_fs) {
        _fs.textContent = em.icon + ' ' + em.label;
        _fs.style.background = em.color === '#22c55e' ? 'rgba(16,185,129,0.9)' :
                                em.color === '#f59e0b' ? 'rgba(234,88,12,0.9)' :
                                                         'rgba(220,38,38,0.9)';
    }
    var _ci = document.getElementById('cam-indicator');
    if (_ci) {
        _ci.textContent = em.icon + ' ' + rate + '%';
        _ci.style.color = em.color;
    }
    if (!_distWarnArmed && rate >= _minDetectPct + 10) {
        _distWarnArmed = true;
    }
    if (_detWindow.length >= _DET_WINDOW_SIZE && _distWarnArmed && rate < _minDetectPct && detCount >= 3) {
        if (_lastSeenDist != null && _lastSeenDist < 0.85) return;
        var now = performance.now();
        if (now - _lastDistWarnAt > 8000) {
            _lastDistWarnAt = now;
            _distWarnArmed = false;
            _showDistWarning();
        }
    }
}

// PATCH_PHASE1: вынесено в player-dist-warning.js
function _showDistWarning() {
    window.PlayerDistWarning.showDistWarning();
}

// PATCH_PHASE1: вынесено в player-dist-warning.js
function _showDistHardBanner() {
    window.PlayerDistWarning.showDistHardBanner();
}

// PATCH_PHASE1: вынесено в player-dist-warning.js
function _hideDistHardBanner() {
    window.PlayerDistWarning.hideDistHardBanner();
}

function _checkHardLimit() {
    if (curDistanceM == null) return true;
    if (curDistanceM > 1.0) {
        _showDistHardBanner();
        return false;
    }
    _hideDistHardBanner();
    return true;
}

async function processCamFrame() {
    if (!camActive) {
        camFrameId = null;
        return;
    }
    // PATCH24_GUARD: skip frames while previous detection is in flight
    if (window._camDetecting) return;
    const v = document.getElementById('hidden-video');
    if (v && v.readyState >= 2 && v.videoWidth > 0 && !v.paused) {
        window._camDetecting = true;
        const tStart = performance.now();
        window.camStats.frames++;
        try {
            const det = await faceapi
                .detectSingleFace(v, new faceapi.TinyFaceDetectorOptions({ inputSize: _camConfig.inputSize, scoreThreshold: 0.25 }));
                // PATCH25_BBOX: landmarks disabled for performance
            const tDetect = performance.now() - tStart;
            window.camStats.detections++;
            window.camStats.totalDetectMs += tDetect;
            window.camStats.avgDetectMs = window.camStats.totalDetectMs / window.camStats.detections;
            const now = performance.now();
            if (now - window.camStats.lastFpsUpdate >= 1000) {
                window.camStats.fpsSamples.push(window.camStats.frames);
                if (window.camStats.fpsSamples.length > 10) window.camStats.fpsSamples.shift();
                window.camStats.fps = window.camStats.frames;
                window.camStats.frames = 0;
                window.camStats.lastFpsUpdate = now;
            }
            if (det && det.box) {
                // PATCH25_BBOX: estimate IPD from face box width (~0.45 * box width)
                const ipd = det.box.width * 0.45;
                lastEyeDistPx = ipd;
                window._faceLostSince = 0;
                camIndicator.textContent = '✅ Лицо';
                _pushDetection(true);
                if (curDistanceM != null) _lastSeenDist = curDistanceM;
                // PATCH25_BBOX: blink disabled (needs landmarks)
                if (ipd > 0 && focalLengthPx) {
                    curDistanceM = (realIPD_MM * focalLengthPx) / ipd / 1000;
                    if (curDistanceM > 0.3 && curDistanceM < 5) curDistanceM = _smoothDistance(curDistanceM);
                    // PATCH91: hide on deviation >15%, cancel timers, wait stable
                    if (_stimulusDistance && curDistanceM && camBaseline != null) {
                        var _dev = Math.abs((curDistanceM - _stimulusDistance) / _stimulusDistance * 100);
                        if (_dev > 15) {
                            if (PlayerState.responsePhaseActive || !_waitingStable) {
                                hideStimulus();
                                PlayerState.responsePhaseActive = false;
                                if (typeof responseButtons !== 'undefined' && responseButtons) responseButtons.style.display = 'none';
                                if (typeof PlayerState.currentShowTimer !== 'undefined' && PlayerState.currentShowTimer) { clearTimeout(PlayerState.currentShowTimer); PlayerState.currentShowTimer = null; }
                                if (typeof PlayerState.phaseTimers !== 'undefined' && PlayerState.phaseTimers) {
                                    for (var _i91 = 0; _i91 < PlayerState.phaseTimers.length; _i91++) clearTimeout(PlayerState.phaseTimers[_i91]);
                                    PlayerState.phaseTimers.length = 0;
                                }
                                _waitingStable = true;
                                _stableSince = 0;
                                _stableBuf = [];
                                console.log('[PATCH91] distance changed ' + _dev.toFixed(1) + '% -- waiting');
                            }
                        }
                    }
                    // PATCH91: watch for stability
                    if (_waitingStable && curDistanceM) {
                        _stableBuf.push(curDistanceM);
                        if (_stableBuf.length > 5) _stableBuf.shift();
                        if (_stableBuf.length === 5) {
                            var _mn = Math.min.apply(null, _stableBuf);
                            var _mx = Math.max.apply(null, _stableBuf);
                            if ((_mx - _mn) / _mn * 100 < 3) {
                                if (!_stableSince) _stableSince = performance.now();
                                if (performance.now() - _stableSince >= 1000) {
                                    _resumeAfterStable();
                                }
                            } else {
                                _stableSince = 0;
                            }
                        }
                    }
                    // PATCH23: redundant smoothing removed
                    camIndicator.textContent = `📏 ${curDistanceM.toFixed(2)} м`;
                    evaluateDistance();
                }
            } else {
                // PATCH53_FACE_LOST: face lost >400ms during training = big lean
                if (PlayerState.playerRunning && !PlayerState.isPaused && camBaseline != null) {
                    if (!window._faceLostSince) window._faceLostSince = performance.now();
                    var _flDur = performance.now() - window._faceLostSince;
                    if (_flDur > 1500) { // PATCH56: 1500ms for stable detection
                        window._fastLeanAt = performance.now();
                        window._recordDeviation(-40);
                        // PATCH30_ABORT: instant abort on face lost
                        if (!_waitingStable) _abortCurrentStimulus('face_lost');
                        var _lastLog = window._lastLeanLogAt || 0;
                        if (performance.now() - _lastLog > 2000) {
                            console.warn('[lean] face lost >1500ms -- treated as lean');
                            window._lastLeanLogAt = performance.now();
                        }
                    }
                }
                camIndicator.textContent = '❌ Нет лица';
                _pushDetection(false);
                _blinkIsClosed = false;
                _blinkClosedSince = 0;
            }
        } catch (e) {
            window.camStats.fails++;
            console.warn('[cam] detect error:', e && e.message ? e.message : e);
        }
        window._camDetecting = false;
    }
}
// PATCH25: processBlink removed (landmarks disabled in PATCH25_BBOX)

function evaluateDistance() {
    if (!PlayerState.playerRunning || PlayerState.isPaused || curDistanceM == null) return;
    // PATCH43_BASELINE: delay baseline 3s to skip noisy startup frames
    if (camBaseline == null) {
        if (!window._baselineWaitStart) window._baselineWaitStart = performance.now();
        var _bw = performance.now() - window._baselineWaitStart;
        if (_bw > 3000) {
            camBaseline = curDistanceM;
            window._fastLeanAt = 0;
            window._deviationHistory = [];
            console.log('[PATCH43] baseline set:', curDistanceM.toFixed(3));
        }
    }
    // PATCH44_GUARD: skip if baseline not set yet
    if (camBaseline == null || !isFinite(camBaseline) || camBaseline <= 0.1) return;
    const dev = ((curDistanceM - camBaseline) / camBaseline) * 100;
    // PATCH27B.2: record deviation for fast-lean detection
    // PATCH29_GUARD: only track deviations during active training
    if (PlayerState.playerRunning && !PlayerState.isPaused) {
        if (window._recordDeviation) window._recordDeviation(dev);
        if (window._updateStimulusDim) window._updateStimulusDim();
        // PATCH30c_ABORT: asymmetric thresholds
        // dev < 0 (approaching) -> 10% ; dev > 0 (receding) -> 15%
        // (upTol/dnTol declared below in this function -- TDZ prohibits using them here)
        var _tol = dev < 0 ? 10 : 15;
        if (Math.abs(dev) > _tol) {
            if (!_waitingStable) {
                _abortCurrentStimulus(dev < 0 ? 'deviation_near' : 'deviation_far');
            }
        }
    }
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
        clearInterval(camFrameId);
        camFrameId = null;
    }
    _camLoopStarted = false;
    if (camStream) {
        camStream.getTracks().forEach((t) => t.stop());
        camStream = null;
    }
    const v = document.getElementById('hidden-video');
    if (v) v.remove();
    camActive = false;
    if (camIndicator) camIndicator.style.display = 'none';

    curDistanceM = null;
    camBaseline = null;
    camWarnKind = null;
    lastEyeDistPx = null;
    _blinkIsClosed = false;
    _blinkClosedSince = 0;
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
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    if (gIndex >= gQueue.length) {
        stopPlayer();
        showStatus('Граф пройден', `Серий: ${PlayerState.completedSeries}`, 'Ещё раз', () => {
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
    PlayerState.completedSeries = PlayerState.successfulSeries = PlayerState.failedSeries = 0;
    PlayerState.seriesCorrect = PlayerState.seriesIncorrect = PlayerState.seriesNoAnswer = 0;
    PlayerState.seriesStep = 0;
    PlayerState.noAnswerSeriesStreak = 0;
    lastDirection = null;
    PlayerState.currentSingleCell = { row: 0, col: 0 };
    gNodeAcuityCurrent = Math.max(0.1, Math.min(1.0, node.stimAcuity || 1.0));
    updateCounters();
    hideStimulus();
    responseButtons.style.display = 'none';
    PlayerState.phaseTimers.push(
        setTimeout(() => {
            if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphStimulus(node);
        }, (node.delay1 != null ? node.delay1 : 0))
    );
}

function playGraphStimulus(node) {
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    if (window._faceLostPause) { setTimeout(function(){ playGraphStimulus(node); }, 500); return; } // PATCH61_GUARD
    if (_waitingStable) { setTimeout(function(){ playGraphStimulus(node); }, 500); return; } // PATCH30_ABORT
    _answerBlocked = false; // PATCH31C2A_APPLIED: safety reset before new cycle
    // PATCH38_EARLY_PHASE: enable response phase immediately -- user sees stimulus faster than JS
    PlayerState.responsePhaseActive = true;
    responseStartTime = performance.now();
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    if (PlayerState.completedSeries >= (node.seriesCount || 5)) {
        gIndex++;
        playNextGraphNode();
        return;
    }
    if (PlayerState.seriesStep >= (node.seriesSize || 6)) {
        finishGraphStimulusSeries(node);
        return;
    }
    let dir;
    if (node.isActive) {
        const d = ['вверх', 'вниз', 'влево', 'вправо'];
        do {
            dir = d[Math.floor(Math.random() * d.length)];
        } while (dir === lastDirection);
    } else dir = node.stimDirectionFixed || 'вверх';
    lastDirection = dir;
    currentCorrectDirection = dir;
    // PATCH34: enable phase BEFORE rendering
    const dCalc = _effectiveDistance(node.stimDistance || 1) // PATCH32_6_FIX;
    const pCalc = node.stimPPI || screenPPI || 96;
    const eff = acuityToSizePx(gNodeAcuityCurrent, dCalc, pCalc);
    PlayerState.currentSize = eff;
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
    responseStartTime = performance.now(); // PATCH65_RT: mark start after display (graph)
    } else displayStimulus(svgData.html, { r: node.bgR || 0, g: node.bgG || 0, b: node.bgB || 0 });
    responseStartTime = performance.now(); // PATCH65_RT: mark start after display (graph)
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
        PlayerState.currentSingleCell = cell;
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
    
    document.querySelectorAll('.btn-resp[data-dir]').forEach((b) => (b.style.display = 'flex'));
    document.querySelectorAll('.btn-resp[data-answer]').forEach((b) => (b.style.display = 'none'));
    responseButtons.style.display = 'flex';
    if (window.Voice) window.Voice.sayKey('look', { cancel: true });
    let sd = (node.duration != null ? node.duration : 1000) + (node.response != null ? node.response : 0); // PATCH31C2B_APPLIED
    if (node.singleStimDynamicEnabled) sd = Math.max(sd, node.singleStimDuration || 0);
    if (node.singleBgDynamicEnabled) sd = Math.max(sd, node.singleBgDuration || 0);
    if (node.singleCircleEnabled) {
        const ci = node.circleInnerEnabled !== false ? node.circleInnerDuration || 0 : 0;
        const co = node.circleOuterEnabled !== false ? node.circleOuterDuration || 0 : 0;
        sd = Math.max(sd, ci, co);
    }
    scheduleVoiceCountdown(sd);
    PlayerState.currentShowTimer = setTimeout(() => {
        hideStimulus();
        PlayerState.responsePhaseActive = false;
        stopSingleStimAnimation();
        stopSingleBgAnimation();
        stopCircleAnimation();
        stopPeripheralAnimation();
        stopBlinkAnimation();
        if (lastResponse.answered) {
            if (lastResponse.isCorrect) PlayerState.seriesCorrect++;
            else PlayerState.seriesIncorrect++;
            PlayerState.seriesStep++; // PATCH31C1_APPLIED: only answers count
        } else {
            PlayerState.seriesNoAnswer++;
            saveResult(node.id, null, false);
            // PATCH31C1_APPLIED: timeout does NOT increment PlayerState.seriesStep
            // PATCH31C2B_APPLIED: full timeout series → pause modal
            if (PlayerState.seriesStep === 0 && PlayerState.seriesNoAnswer >= (node.seriesSize || 6)) {
                console.log('[PATCH31C2B] full timeout series, pausing');
                PlayerState.seriesNoAnswer = 0;
                pauseTraining();
                return;
            }
        }
        updateCounters();
        PlayerState.phaseTimers.push(
            setTimeout(() => {
                if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphStimulus(node);
            }, node.delay2 || 1000)
        );
    }, sd);
    PlayerState.phaseTimers.push(PlayerState.currentShowTimer);
}

function finishGraphStimulusSeries(node) {
    const th = node.seriesThreshold || getThreshold(node.seriesSize || 6);
    const ok = PlayerState.seriesCorrect >= th;
    const allNo = PlayerState.seriesNoAnswer === (node.seriesSize || 6);
    if (allNo) PlayerState.noAnswerSeriesStreak++;
    else PlayerState.noAnswerSeriesStreak = 0;
    PlayerState.completedSeries++;
    if (ok) PlayerState.successfulSeries++;
    else PlayerState.failedSeries++;
    // PATCH31C2B_APPLIED: adaptiveAcuity
    if (node.adaptiveAcuity !== false) {
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
    }
    PlayerState.seriesCorrect = PlayerState.seriesIncorrect = PlayerState.seriesNoAnswer = PlayerState.seriesStep = 0;
    lastDirection = null;
    updateCounters();
    // PATCH48_NO_AVG: report disabled, per-answer log only
    // PATCH35: reaction time aggregate
    try {
        if (!window._reactionTimes) window._reactionTimes = [];
        var _rt = lastResponse && lastResponse.reactionTimeMs;
        if (_rt != null) window._reactionTimes.push(_rt);
        var _recent = window._reactionTimes.slice(-20);
        var _avg = _recent.reduce(function(a,b){return a+b;},0) / _recent.length;
        var _min = Math.min.apply(null, _recent);
        var _max = Math.max.apply(null, _recent);
        /* PATCH50: removed spam */ void 0;
    } catch (e) {}
    if (PlayerState.noAnswerSeriesStreak >= 3) {
        pauseTraining();
        return;
    }
    if (PlayerState.completedSeries >= (node.seriesCount || 5)) {
        gIndex++;
        playNextGraphNode();
        return;
    }
    PlayerState.phaseTimers.push(
        setTimeout(() => {
            if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphStimulus(node);
        }, (node.delay2 != null ? node.delay2 : 500))
    );
}

function handleGraphDirectionAnswer(dir) {
    if (!PlayerState.responsePhaseActive) return;
    if (_answerBlocked) return; // PATCH31C2A_APPLIED
    // PATCH32_INVALIDATE: check deviation before processing answer
    var _inv32 = window._isAnswerInvalid ? window._isAnswerInvalid() : null;
    if (_inv32) {
        lastResponse = { answered: true, isCorrect: false, reactionTimeMs: Math.max(0, performance.now() - (responseStartTime || performance.now())), invalidReason: _inv32 }; 
    if (window._logAnswer) window._logAnswer({ rt: lastResponse.reactionTimeMs, valid: false, correct: false, reason: (lastResponse.invalidReason || 'unknown') });
        PlayerState.responsePhaseActive = false;
        if (window._markAnswerInvalid) window._markAnswerInvalid(_inv32);
        if (window.Voice) window.Voice.sayKey('wrong', { cancel: true });
        document.body.style.background = '#78350f';
        setTimeout(function() { document.body.style.background = '#0b0b0f'; }, 300);
        return;
    }

    const ok = dir === currentCorrectDirection;

    // PATCH34_APPLIED: stop timer + clear stimulus DOM immediately
    if (PlayerState.currentShowTimer) { clearTimeout(PlayerState.currentShowTimer); PlayerState.currentShowTimer = null; }
    if (PlayerState.phaseTimers && PlayerState.phaseTimers.length) { PlayerState.phaseTimers.forEach(function(t){ clearTimeout(t); }); PlayerState.phaseTimers = []; }
    try { var _el34 = document.getElementById('stim'); if (_el34) _el34.innerHTML = ''; } catch(e) {}
    try { var _ar34 = document.getElementById('stim-display'); if (_ar34) _ar34.style.backgroundColor = ''; } catch(e) {}
    try { stopSingleStimAnimation(); } catch(e) {}
    try { stopSingleBgAnimation(); } catch(e) {}
    try { stopCircleAnimation(); } catch(e) {}
    try { stopPeripheralAnimation(); } catch(e) {}
    try { stopBlinkAnimation(); } catch(e) {}
    lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: Math.max(0, performance.now() - (responseStartTime || performance.now())) }; 
    if (window._logAnswer) window._logAnswer({ rt: lastResponse.reactionTimeMs, valid: true, correct: ok, direction: (typeof direction !== 'undefined' ? direction : (typeof dir !== 'undefined' ? dir : (typeof answer !== 'undefined' ? String(answer) : null))) });
    PlayerState.responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(() => {
        document.body.style.background = '#0b0b0f';
    }, 200);
    saveResult(gCurrentNodeId || 'graph_single', lastResponse.reactionTimeMs, ok);

    // PATCH35B_APPLIED: advance series immediately
    if (ok) PlayerState.seriesCorrect++; else PlayerState.seriesIncorrect++;
    PlayerState.seriesStep++;
    updateCounters();
    var _n35 = gGetNode(gCurrentNodeId);
    if (_n35) {
        if (PlayerState.seriesStep >= (_n35.seriesSize || 6)) {
            setTimeout(function () { finishGraphStimulusSeries(_n35); }, 50);
        } else {
            setTimeout(function () {
                if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphStimulus(_n35);
            }, (_n35.delay2 != null ? _n35.delay2 : 1000));
        }
    }
}

function playGraphCompare(node) {
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    gCurrentCompareNode = node;
    gCurrentNodeId = node.id;
    PlayerState.completedSeries = PlayerState.successfulSeries = PlayerState.failedSeries = 0;
    PlayerState.seriesCorrect = PlayerState.seriesIncorrect = PlayerState.seriesNoAnswer = 0;
    PlayerState.seriesStep = 0;
    PlayerState.noAnswerSeriesStreak = 0;
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
    PlayerState.phaseTimers.push(
        setTimeout(() => {
            if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphCompareRound(node);
        }, (node.delay1 != null ? node.delay1 : 0))
    );
}

function playGraphCompareRound(node) {
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    if (_waitingStable) { setTimeout(function(){ playGraphCompareRound(node); }, 500); return; } // PATCH30_ABORT
    if (PlayerState.seriesStep >= (node.seriesSize || 6)) {
        finishGraphCompareSeries(node);
        return;
    }
    removeSingleGridLines();
    stimDisplay.innerHTML = '';
    stimArea.style.background = '#000';
    if (compareMode === 'direction') showDirectionComparison();
    else if (compareMode === 'find_same') showFindSameComparison();
    const dur = cellParams[0]?.duration || node.duration || PlayerState.currentDuration;
    PlayerState.currentShowTimer = setTimeout(() => {
        if (PlayerState.responsePhaseActive) {
            lastResponse = { answered: false, isCorrect: false };
            // PATCH31C1_APPLIED: timeout -> PlayerState.seriesNoAnswer, NOT PlayerState.seriesIncorrect
            PlayerState.seriesNoAnswer++;
            updateCounters();
            saveResult(gCurrentNodeId || 'graph_compare', null, false);
            const _n31 = gGetNode(gCurrentNodeId);
            if (_n31) {
                if (PlayerState.seriesStep >= (_n31.seriesSize || 6)) {
                    finishGraphCompareSeries(_n31);
                } else {
                    PlayerState.phaseTimers.push(setTimeout(() => {
                        if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphCompareRound(_n31);
                    }, _n31.delay2 || 1000));
                }
            }
        }
    }, dur);
    PlayerState.phaseTimers.push(PlayerState.currentShowTimer);
}

function handleGraphCompareAnswer(answer) {
    if (!PlayerState.responsePhaseActive) return;
    if (_answerBlocked) return; // PATCH31C2A_APPLIED
    // PATCH32_INVALIDATE: check deviation before processing answer
    var _inv32 = window._isAnswerInvalid ? window._isAnswerInvalid() : null;
    if (_inv32) {
        lastResponse = { answered: true, isCorrect: false, reactionTimeMs: Math.max(0, performance.now() - (responseStartTime || performance.now())), invalidReason: _inv32 }; 
    if (window._logAnswer) window._logAnswer({ rt: lastResponse.reactionTimeMs, valid: false, correct: false, reason: (lastResponse.invalidReason || 'unknown') });
        PlayerState.responsePhaseActive = false;
        if (window._markAnswerInvalid) window._markAnswerInvalid(_inv32);
        if (window.Voice) window.Voice.sayKey('wrong', { cancel: true });
        document.body.style.background = '#78350f';
        setTimeout(function() { document.body.style.background = '#0b0b0f'; }, 300);
        return;
    }

    const ok = answer === currentCompareAnswer;

    // PATCH34_APPLIED: stop timer + clear stimulus DOM immediately
    if (PlayerState.currentShowTimer) { clearTimeout(PlayerState.currentShowTimer); PlayerState.currentShowTimer = null; }
    if (PlayerState.phaseTimers && PlayerState.phaseTimers.length) { PlayerState.phaseTimers.forEach(function(t){ clearTimeout(t); }); PlayerState.phaseTimers = []; }
    try { var _el34 = document.getElementById('stim'); if (_el34) _el34.innerHTML = ''; } catch(e) {}
    try { var _ar34 = document.getElementById('stim-display'); if (_ar34) _ar34.style.backgroundColor = ''; } catch(e) {}
    try { stopSingleStimAnimation(); } catch(e) {}
    try { stopSingleBgAnimation(); } catch(e) {}
    try { stopCircleAnimation(); } catch(e) {}
    try { stopPeripheralAnimation(); } catch(e) {}
    try { stopBlinkAnimation(); } catch(e) {}
    lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: Math.max(0, performance.now() - (responseStartTime || performance.now())) }; 
    if (window._logAnswer) window._logAnswer({ rt: lastResponse.reactionTimeMs, valid: true, correct: ok, direction: (typeof direction !== 'undefined' ? direction : (typeof dir !== 'undefined' ? dir : (typeof answer !== 'undefined' ? String(answer) : null))) });
    PlayerState.responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(() => {
        document.body.style.background = '#0b0b0f';
    }, 200);
    processGraphCompareAnswer(ok);
}

function processGraphCompareAnswer(isCorrect) {
    if (isCorrect) PlayerState.seriesCorrect++;
    else PlayerState.seriesIncorrect++;
    PlayerState.seriesStep++;
    updateCounters();
    saveResult(gCurrentNodeId || 'graph_compare', lastResponse.reactionTimeMs, isCorrect);
    const node = gGetNode(gCurrentNodeId);
    if (!node) {
        gIndex++;
        playNextGraphNode();
        return;
    }
    if (PlayerState.seriesStep >= (node.seriesSize || 6)) {
        finishGraphCompareSeries(node);
        return;
    }
    PlayerState.phaseTimers.push(
        setTimeout(() => {
            if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphCompareRound(node);
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
    const ok = PlayerState.seriesCorrect >= th;
    PlayerState.completedSeries++;
    if (ok) PlayerState.successfulSeries++;
    else PlayerState.failedSeries++;
    PlayerState.seriesCorrect = PlayerState.seriesIncorrect = PlayerState.seriesNoAnswer = PlayerState.seriesStep = 0;
    updateCounters();
    if (PlayerState.completedSeries >= (node.seriesCount || 5)) {
        gCurrentCompareNode = null;
        gIndex++;
        playNextGraphNode();
        return;
    }
    PlayerState.phaseTimers.push(
        setTimeout(() => {
            if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphCompareRound(node);
        }, (node.delay2 != null ? node.delay2 : 500))
    );
}

function playGraphReading(node) {
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
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
    const dCalc = _effectiveDistance(node.readingDistance || 1) // PATCH32_6_FIX;
    readingContentEl.style.fontSize = acuityToFontSizePx(node.readingAcuity || 1.0, dCalc, screenPPI) + 'px';
    setTimeout(() => {
        readingTotalPages = calcReadingTotalPages();
        readingPage = 0;
        scrollReadingToPage(0);
    }, 80);
    readingToolbarEl.style.display = 'flex';
    _readingFinishGuard = false;
    if (_readingTimerId) { clearTimeout(_readingTimerId); _readingTimerId = null; }

    const dur = node.duration || 60000;
    if (dur > 0) {
        _readingTimerId = setTimeout(() => {
            _readingTimerId = null;
            finishGraphReading(node);
        }, dur);
        PlayerState.phaseTimers.push(_readingTimerId);
    }
}

function finishGraphReading(node) {
    if (_readingFinishGuard) return;
    _readingFinishGuard = true;

    if (_readingTimerId) {
        clearTimeout(_readingTimerId);
        _readingTimerId = null;
    }
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
    if (PlayerState.playerRunning) { console.warn('[PATCH37] already running'); return; }
    // PATCH41_STATUS_CLOSE: close any open status overlay (e.g. "Граф пройден")
    var _so = document.getElementById('status-overlay');
    if (_so && !_so.classList.contains('hidden')) {
        console.log('[PATCH41] closing status-overlay');
        _so.classList.add('hidden');
    }
    if (!userScenario) {
        alert('Сценарий не назначен');
        return;
    }
    if (!validateScenario(userScenario)) {
        alert('Сценарий повреждён или содержит некорректные данные.');
        return;
    }
    sessionId = (window.crypto && typeof window.crypto.randomUUID === 'function')
        ? window.crypto.randomUUID()
        : 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    const p = userScenario.params || {};
    PlayerState.playerRunning = true;
    window._fastLeanAt = 0;
    window._deviationHistory = [];
    window._distEMA = null; // PATCH42_SMOOTH
    window._reactionLog = []; // PATCH46
    window._baselineWaitStart = null; // PATCH43
    // PATCH58: restore focalLengthPx if lost
    if (!focalLengthPx || focalLengthPx <= 0) {
        var _lsF2 = parseFloat(localStorage.getItem('focalLengthPx') || '0');
        if (_lsF2 > 0) focalLengthPx = _lsF2;
    }
    // PATCH35_GRAPH_RESET: hard reset graph state
    graphActive = false;
    gNodes = [];
    gConnections = [];
    gQueue = [];
    gIndex = 0;
    gCurrentNodeId = null;
    gCurrentCompareNode = null;
    window._invalidAnswerCount = 0;
    if (window._reactionTimes) window._reactionTimes = [];
    console.log('[PATCH35] graph state reset');
    PlayerState.isPaused = false;
    PlayerState.completedSeries = PlayerState.successfulSeries = PlayerState.failedSeries = 0;
    PlayerState.seriesCorrect = PlayerState.seriesIncorrect = PlayerState.seriesNoAnswer = 0;
    PlayerState.seriesStep = 0;
    PlayerState.noAnswerSeriesStreak = 0;
    lastDirection = null;
    PlayerState.currentSingleCell = { row: 0, col: 0 };
    screenPPI = p.ppi || screenPPI || 96;
    if (p.minDetectPct && !isNaN(p.minDetectPct)) _minDetectPct = parseFloat(p.minDetectPct);
    btnPlayer.disabled = true;
    document.querySelector('.counters')?.style.setProperty('display','none');
    btnPlayerStop.disabled = false;
    btnPlayerPause.disabled = false;
    if (window.Voice) window.Voice.sayKey('ready', { cancel: true });

    if (p.graph && Array.isArray(p.graph.nodes) && p.graph.nodes.length > 0) {
        updateCounters();
        startGraphPlay(p.graph.nodes, p.graph.connections || [], p.graph.books || {});
        return;
    }

    if (p.trainingType !== 'reading') PlayerState.currentAcuity = Math.max(0.1, Math.min(1.0, p.startAcuity || 0.5));
    else PlayerState.currentAcuity = 1.0;
    PlayerState.currentStimColor = p.startStimColor ? { ...p.startStimColor } : { r: 0, g: 255, b: 0 };
    PlayerState.currentBgColor = p.startBgColor ? { ...p.startBgColor } : { r: 0, g: 0, b: 0 };
    PlayerState.currentDuration = 2550;
    PlayerState.currentSize = acuityToSizePx(PlayerState.currentAcuity, p.distanceMeters || 1, screenPPI);
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
    if (!_checkHardLimit()) { setTimeout(showNextStimulus, 500); return; }
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    if (window._faceLostPause) { setTimeout(showNextStimulus, 500); return; } // PATCH61_GUARD
    if (_waitingStable) { setTimeout(showNextStimulus, 500); return; } // PATCH30_ABORT
    // PATCH38_EARLY_PHASE: enable response phase immediately
    PlayerState.responsePhaseActive = true;
    responseStartTime = performance.now();
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    const p = userScenario?.params || {};
    if (PlayerState.seriesStep >= (p.seriesSize || 6)) {
        finishSeries();
        return;
    }
    let dir;
    if (p.isActive) {
        const d = ['вверх', 'вниз', 'влево', 'вправо'];
        do {
            dir = d[Math.floor(Math.random() * d.length)];
        } while (dir === lastDirection);
    } else dir = 'вверх';
    lastDirection = dir;
    currentCorrectDirection = dir;
    // PATCH35: enable phase AND start timer BEFORE render
    const dCalc = _effectiveDistance(p.distanceMeters || 1) // PATCH32_6_FIX;
    const eff = acuityToSizePx(PlayerState.currentAcuity, dCalc, screenPPI);
    PlayerState.currentSize = eff;
    let sc = PlayerState.currentStimColor;
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
                bgR: PlayerState.currentBgColor.r,
                bgG: PlayerState.currentBgColor.g,
                bgB: PlayerState.currentBgColor.b
            },
            eff
        );
    if (p.dfEnabled) {
        const frame = buildDefocusFrame(p, svgData.html);
        if (frame) {
            stimDisplay.innerHTML = '';
            stimDisplay.appendChild(frame);
            stimArea.style.backgroundColor = `rgb(${p.dfPeriBg.r},${p.dfPeriBg.g},${p.dfPeriBg.b})`;
        } else displayStimulus(svgData.html, PlayerState.currentBgColor);
    responseStartTime = performance.now(); // PATCH65_RT: mark start after display (single)
    } else displayStimulus(svgData.html, PlayerState.currentBgColor);
    responseStartTime = performance.now(); // PATCH65_RT: mark start after display (single)
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
        PlayerState.currentSingleCell = cell;
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
    document.querySelectorAll('.btn-resp[data-dir]').forEach((b) => (b.style.display = 'flex'));
    document.querySelectorAll('.btn-resp[data-answer]').forEach((b) => (b.style.display = 'none'));
    responseButtons.style.display = 'flex';
    if (window.Voice) window.Voice.sayKey('look', { cancel: true });
    let sd = PlayerState.currentDuration + (p.response != null ? p.response : 0); // PATCH31C2B_APPLIED
    if (p.singleStimDynamicEnabled) sd = Math.max(sd, p.singleStimDuration || 0);
    if (p.singleBgDynamicEnabled) sd = Math.max(sd, p.singleBgDuration || 0);
    if (p.singleCircleEnabled) {
        const ci = p.circleInnerEnabled !== false ? p.circleInnerDuration || 0 : 0;
        const co = p.circleOuterEnabled !== false ? p.circleOuterDuration || 0 : 0;
        sd = Math.max(sd, ci, co);
    }
    scheduleVoiceCountdown(sd);
    PlayerState.currentShowTimer = setTimeout(() => {
        hideStimulus();
        PlayerState.responsePhaseActive = false;
        stopSingleStimAnimation();
        stopSingleBgAnimation();
        stopCircleAnimation();
        stopPeripheralAnimation();
        stopBlinkAnimation();
        if (lastResponse.answered) {
            if (lastResponse.isCorrect) PlayerState.seriesCorrect++;
            else PlayerState.seriesIncorrect++;
            PlayerState.seriesStep++; // PATCH31C1_APPLIED: only answers count
        } else {
            PlayerState.seriesNoAnswer++;
            if (window.Voice) window.Voice.sayKey('timeout', { cancel: true });
            saveResult('user_single', null, false);
            // PATCH31C1_APPLIED: timeout does NOT increment PlayerState.seriesStep
            // PATCH31C2B_APPLIED: full timeout series → pause modal
            if (PlayerState.seriesStep === 0 && PlayerState.seriesNoAnswer >= (p.seriesSize || 6)) {
                console.log('[PATCH31C2B] full timeout series, pausing');
                PlayerState.seriesNoAnswer = 0;
                pauseTraining();
                return;
            }
        }
        updateCounters();
        PlayerState.phaseTimers.push(
            setTimeout(() => {
                if (PlayerState.playerRunning && !PlayerState.isPaused) showNextStimulus();
            }, p.delay2 || 1000)
        );
    }, sd);
    PlayerState.phaseTimers.push(PlayerState.currentShowTimer);
}

function finishSeries() {
    const p = userScenario?.params || {};
    const th = p.seriesThreshold || getThreshold(p.seriesSize || 6);
    const ok = PlayerState.seriesCorrect >= th;
    if (PlayerState.seriesNoAnswer === (p.seriesSize || 6)) PlayerState.noAnswerSeriesStreak++;
    else PlayerState.noAnswerSeriesStreak = 0;
    PlayerState.completedSeries++;
    if (ok) PlayerState.successfulSeries++;
    else PlayerState.failedSeries++;
    // PATCH31C2B_APPLIED: adaptiveAcuity
    if (p.adaptiveAcuity !== false) {
        if (ok) {
            if (PlayerState.currentAcuity < (p.endAcuity || 2.0))
                PlayerState.currentAcuity = Math.min(
                    p.endAcuity || 2.0,
                    Math.round((PlayerState.currentAcuity + (p.acuityStep || 0.1)) * 10) / 10
                );
        } else {
            if (PlayerState.currentAcuity > (p.startAcuity || 0.5))
                PlayerState.currentAcuity = Math.max(
                    p.startAcuity || 0.5,
                    Math.round((PlayerState.currentAcuity - (p.acuityStep || 0.1)) * 10) / 10
                );
        }
    }
    PlayerState.currentSize = acuityToSizePx(PlayerState.currentAcuity, p.distanceMeters || 1, screenPPI);
    PlayerState.seriesCorrect = PlayerState.seriesIncorrect = PlayerState.seriesNoAnswer = PlayerState.seriesStep = 0;
    lastDirection = null;
    updateCounters();
    if (PlayerState.completedSeries >= (p.seriesCount || 5)) {
        showFinishedReport();
        stopPlayer();
        return;
    }
    PlayerState.phaseTimers.push(
        setTimeout(() => {
            if (PlayerState.playerRunning && !PlayerState.isPaused) showNextStimulus();
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
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    const p = userScenario?.params || {};
    if (PlayerState.seriesStep >= (p.seriesSize || 6)) {
        finishCompareSeries();
        return;
    }
    removeSingleGridLines();
    stimDisplay.innerHTML = '';
    stimArea.style.background = '#000';
    if (compareMode === 'direction') showDirectionComparison();
    else if (compareMode === 'find_same') showFindSameComparison();
    const dur = cellParams[0]?.duration || p.duration || PlayerState.currentDuration;
    PlayerState.currentShowTimer = setTimeout(() => {
        if (PlayerState.responsePhaseActive) {
            lastResponse = { answered: false, isCorrect: false };
            // PATCH31C1_APPLIED: timeout -> PlayerState.seriesNoAnswer, NOT PlayerState.seriesIncorrect
            PlayerState.seriesNoAnswer++;
            updateCounters();
            saveResult('user_compare', null, false);
            const _p31 = userScenario?.params || {};
            if (PlayerState.seriesStep >= (_p31.seriesSize || 6)) {
                finishCompareSeries();
            } else {
                PlayerState.phaseTimers.push(setTimeout(() => {
                    if (PlayerState.playerRunning && !PlayerState.isPaused) showNextCompareRound();
                }, _p31.delay2 || 1000));
            }
        }
    }, dur);
    PlayerState.phaseTimers.push(PlayerState.currentShowTimer);
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
    if (!PlayerState.responsePhaseActive || !_findSameState || isNaN(idx)) return;
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
                reactionTimeMs: Math.max(0, performance.now() - (responseStartTime || performance.now()))
            };
            PlayerState.responsePhaseActive = false;
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
    const size = params.size || PlayerState.currentSize;
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
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    if (PlayerState.currentShowTimer) {
        clearTimeout(PlayerState.currentShowTimer);
        PlayerState.currentShowTimer = null;
    }
    const p = userScenario?.params || {};
    if (isCorrect) PlayerState.seriesCorrect++;
    else PlayerState.seriesIncorrect++;
    PlayerState.seriesStep++;
    updateCounters();
    saveResult('user_compare', lastResponse.reactionTimeMs, isCorrect);
    if (PlayerState.seriesStep >= (p.seriesSize || 6)) {
        finishCompareSeries();
        return;
    }
    PlayerState.phaseTimers.push(
        setTimeout(() => {
            if (PlayerState.playerRunning && !PlayerState.isPaused) showNextCompareRound();
        }, p.delay2 || 1000)
    );
}
function finishCompareSeries() {
    const p = userScenario?.params || {};
    const th = p.seriesThreshold || getThreshold(p.seriesSize || 6);
    const ok = PlayerState.seriesCorrect >= th;
    PlayerState.completedSeries++;
    if (ok) PlayerState.successfulSeries++;
    else PlayerState.failedSeries++;
    PlayerState.seriesCorrect = PlayerState.seriesIncorrect = PlayerState.seriesNoAnswer = PlayerState.seriesStep = 0;
    updateCounters();
    if (PlayerState.completedSeries >= (p.seriesCount || 5)) {
        showFinishedReport();
        stopPlayer();
        return;
    }
    PlayerState.phaseTimers.push(
        setTimeout(() => {
            if (PlayerState.playerRunning && !PlayerState.isPaused) showNextCompareRound();
        }, p.delay2 || 1000)
    );
}

// ==================== user.js: Конец части 2 из 4 ====================
// ==================== user.js: Начало части 3 из 4 ====================

// ==================== ОТВЕТЫ (плоский режим) ====================
function handleDirectionAnswer(direction) {
    if (!PlayerState.responsePhaseActive) return;
    if (_answerBlocked) return; // PATCH31C2A_APPLIED
    // PATCH32_INVALIDATE: check deviation before processing answer
    var _inv32 = window._isAnswerInvalid ? window._isAnswerInvalid() : null;
    if (_inv32) {
        lastResponse = { answered: true, isCorrect: false, reactionTimeMs: Math.max(0, performance.now() - (responseStartTime || performance.now())), invalidReason: _inv32 }; 
    if (window._logAnswer) window._logAnswer({ rt: lastResponse.reactionTimeMs, valid: false, correct: false, reason: (lastResponse.invalidReason || 'unknown') });
        PlayerState.responsePhaseActive = false;
        if (window._markAnswerInvalid) window._markAnswerInvalid(_inv32);
        if (window.Voice) window.Voice.sayKey('wrong', { cancel: true });
        document.body.style.background = '#78350f';
        setTimeout(function() { document.body.style.background = '#0b0b0f'; }, 300);
        return;
    }

    const ok = direction === currentCorrectDirection;

    // PATCH34_APPLIED: stop timer + clear stimulus DOM immediately
    if (PlayerState.currentShowTimer) { clearTimeout(PlayerState.currentShowTimer); PlayerState.currentShowTimer = null; }
    if (PlayerState.phaseTimers && PlayerState.phaseTimers.length) { PlayerState.phaseTimers.forEach(function(t){ clearTimeout(t); }); PlayerState.phaseTimers = []; }
    try { var _el34 = document.getElementById('stim'); if (_el34) _el34.innerHTML = ''; } catch(e) {}
    try { var _ar34 = document.getElementById('stim-display'); if (_ar34) _ar34.style.backgroundColor = ''; } catch(e) {}
    try { stopSingleStimAnimation(); } catch(e) {}
    try { stopSingleBgAnimation(); } catch(e) {}
    try { stopCircleAnimation(); } catch(e) {}
    try { stopPeripheralAnimation(); } catch(e) {}
    try { stopBlinkAnimation(); } catch(e) {}
    lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: Math.max(0, performance.now() - (responseStartTime || performance.now())) }; 
    if (window._logAnswer) window._logAnswer({ rt: lastResponse.reactionTimeMs, valid: true, correct: ok, direction: (typeof direction !== 'undefined' ? direction : (typeof dir !== 'undefined' ? dir : (typeof answer !== 'undefined' ? String(answer) : null))) });
    PlayerState.responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(() => {
        document.body.style.background = '#0b0b0f';
    }, 200);
    saveResult('user_single', lastResponse.reactionTimeMs, ok);
}
function handleCompareAnswer(answer) {
    if (!PlayerState.responsePhaseActive) return;
    if (_answerBlocked) return; // PATCH31C2A_APPLIED
    // PATCH32_INVALIDATE: check deviation before processing answer
    var _inv32 = window._isAnswerInvalid ? window._isAnswerInvalid() : null;
    if (_inv32) {
        lastResponse = { answered: true, isCorrect: false, reactionTimeMs: Math.max(0, performance.now() - (responseStartTime || performance.now())), invalidReason: _inv32 }; 
    if (window._logAnswer) window._logAnswer({ rt: lastResponse.reactionTimeMs, valid: false, correct: false, reason: (lastResponse.invalidReason || 'unknown') });
        PlayerState.responsePhaseActive = false;
        if (window._markAnswerInvalid) window._markAnswerInvalid(_inv32);
        if (window.Voice) window.Voice.sayKey('wrong', { cancel: true });
        document.body.style.background = '#78350f';
        setTimeout(function() { document.body.style.background = '#0b0b0f'; }, 300);
        return;
    }

    const ok = answer === currentCompareAnswer;

    // PATCH34_APPLIED: stop timer + clear stimulus DOM immediately
    if (PlayerState.currentShowTimer) { clearTimeout(PlayerState.currentShowTimer); PlayerState.currentShowTimer = null; }
    if (PlayerState.phaseTimers && PlayerState.phaseTimers.length) { PlayerState.phaseTimers.forEach(function(t){ clearTimeout(t); }); PlayerState.phaseTimers = []; }
    try { var _el34 = document.getElementById('stim'); if (_el34) _el34.innerHTML = ''; } catch(e) {}
    try { var _ar34 = document.getElementById('stim-display'); if (_ar34) _ar34.style.backgroundColor = ''; } catch(e) {}
    try { stopSingleStimAnimation(); } catch(e) {}
    try { stopSingleBgAnimation(); } catch(e) {}
    try { stopCircleAnimation(); } catch(e) {}
    try { stopPeripheralAnimation(); } catch(e) {}
    try { stopBlinkAnimation(); } catch(e) {}
    lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: Math.max(0, performance.now() - (responseStartTime || performance.now())) }; 
    if (window._logAnswer) window._logAnswer({ rt: lastResponse.reactionTimeMs, valid: true, correct: ok, direction: (typeof direction !== 'undefined' ? direction : (typeof dir !== 'undefined' ? dir : (typeof answer !== 'undefined' ? String(answer) : null))) });
    PlayerState.responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(() => {
        document.body.style.background = '#0b0b0f';
    }, 200);
    processCompareAnswer(ok);
}
responseButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-resp');
    if (!btn || !PlayerState.responsePhaseActive) return;
    if (btn.dataset.dir) {
        if (graphActive) handleGraphDirectionAnswer(btn.dataset.dir);
        else handleDirectionAnswer(btn.dataset.dir);
    } else if (btn.dataset.answer === 'да' || btn.dataset.answer === 'нет') {
        // PATCH40_INCMP: check actual compare node, not graphActive
        const inCmp =
            compareMode === 'direction' && (
                (!graphActive && userScenario?.params?.trainingType === 'compare') ||
                (graphActive && gCurrentCompareNode != null && gCurrentCompareNode.compareMode === 'direction')
            );
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
    if (!PlayerState.responsePhaseActive) return;
    // [PATCH4C] compare-mode: ignore Up/Down (only Left/Right = Da/Net)
    if (((graphActive && gCurrentCompareNode) || (!graphActive && userScenario?.params?.trainingType === 'compare')) && compareMode === 'direction' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const map = { ArrowUp: 'вверх', ArrowDown: 'вниз', ArrowLeft: 'влево', ArrowRight: 'вправо' };
    if (map[e.key]) {
        e.preventDefault();
        // PATCH40_INCMP: check actual compare node, not graphActive
        const inCmp =
            compareMode === 'direction' && (
                (!graphActive && userScenario?.params?.trainingType === 'compare') ||
                (graphActive && gCurrentCompareNode != null && gCurrentCompareNode.compareMode === 'direction')
            );
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
    const dCalc = _effectiveDistance(p.readingDistance || 1) // PATCH32_6_FIX;
    readingContentEl.style.fontSize = acuityToFontSizePx(PlayerState.currentAcuity, dCalc, screenPPI) + 'px';
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
// PATCH_PHASE1: вынесено в player-reading.js
function applyReadingBackground(p) {
    window.PlayerReading.applyBackground(p, readingViewportEl);
}
// PATCH_PHASE1: вынесено в player-reading.js
function startReadingDynamicBg(p) {
    window.PlayerReading.startDynamicBg(p, readingViewportEl, () => readingPaused);
}
// PATCH_PHASE1: вынесено в player-reading.js
function stopReadingDynamicBg() {
    window.PlayerReading.stopDynamicBg();
}
function finishReading() {
    PlayerState.completedSeries++;
    PlayerState.successfulSeries++;
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
    let txt = `Серий: ${PlayerState.completedSeries} · Успешных: ${PlayerState.successfulSeries} · Неуспешных: ${PlayerState.failedSeries}`;
    if (p.trainingType !== 'reading' && !graphActive) txt += ` · Итоговая V: ${PlayerState.currentAcuity.toFixed(1)}`;
    showStatus('Готово!', txt, 'Ещё раз', () => {
        hideStatus();
        startPlayer();
    });
}
function pauseTraining() {
    PlayerState.phaseTimers.forEach((t) => clearTimeout(t));
    PlayerState.phaseTimers = [];
    if (PlayerState.currentShowTimer) clearTimeout(PlayerState.currentShowTimer);
    stopSingleStimAnimation();
    stopSingleBgAnimation();
    stopCircleAnimation();
    stopPeripheralAnimation();
    stopBlinkAnimation();
    PlayerState.responsePhaseActive = false;
    hideStimulus();
    responseButtons.style.display = 'none';
    PlayerState.isPaused = true;
    btnPlayerPause.disabled = true;
    pauseModal.classList.add('open');
}
function resumeTraining() {
    pauseModal.classList.remove('open');
    PlayerState.isPaused = false;
    PlayerState.noAnswerSeriesStreak = 0;
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
    PlayerState.phaseTimers.forEach((t) => clearTimeout(t));
    PlayerState.phaseTimers = [];
    if (PlayerState.currentShowTimer) clearTimeout(PlayerState.currentShowTimer);
    stopSingleStimAnimation();
    stopSingleBgAnimation();
    stopCircleAnimation();
    stopPeripheralAnimation();
    stopBlinkAnimation();
    stopReadingDynamicBg();
    window.Voice?.stopReading();
    PlayerState.playerRunning = false;
    PlayerState.isPaused = false;
    PlayerState.responsePhaseActive = false;
    hideStimulus();
    responseButtons.style.display = 'none';
    readingToolbarEl.style.display = 'none';
    readingViewportEl.style.display = 'none';
    readingContentEl.innerHTML = '';
    stimDisplay.style.display = '';
    btnPlayer.disabled = false;
    document.querySelector('.counters')?.style.setProperty('display','inline-flex');
    btnPlayerStop.disabled = true;
    btnPlayerPause.disabled = true;
    document.body.style.background = '#0b0b0f';
    pauseModal.classList.remove('open');
    camBaseline = null;
    _stimulusDistance = null;
    _waitingStable = false; // PATCH91
    _stableSince = 0;
    _stableBuf = [];
    _stimulusDistance = null; // PATCH_CLEAN
    camWarnKind = null;
    window._fastLeanAt = 0;
    window._deviationHistory = [];
    window._distEMA = null; // PATCH42_SMOOTH
    window._reactionLog = []; // PATCH46
    window._baselineWaitStart = null; // PATCH43
    window._invalidAnswerCount = 0;
    sessionId = null;
    _readingFinishGuard = false;
    if (_readingTimerId) { clearTimeout(_readingTimerId); _readingTimerId = null; }
    graphActive = false;
    gCurrentNodeId = null;
    gCurrentCompareNode = null;
    gQueue = [];
    gIndex = 0;
}
function togglePause() {
    if (!PlayerState.playerRunning) return;
    if (PlayerState.isPaused) {
        resumeTraining();
        return;
    }
    PlayerState.isPaused = true;
    PlayerState.phaseTimers.forEach((t) => clearTimeout(t));
    PlayerState.phaseTimers = [];
    if (PlayerState.currentShowTimer) clearTimeout(PlayerState.currentShowTimer);
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
            response_time_ms: reactionTimeMs != null ? Math.round(reactionTimeMs) : null,
            is_correct: isCorrect,
            distance_m: (typeof curDistanceM !== 'undefined' && curDistanceM != null) ? curDistanceM : null, // PATCH31C2B_APPLIED
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
                if (PlayerState.responsePhaseActive && !PlayerState.isPaused) window.Voice.sayKey('countdown5');
            }, durationMs - 5000)
        );
    [3, 2, 1].forEach((s) => {
        const at = durationMs - s * 1000;
        if (at > 0)
            timers.push(
                setTimeout(() => {
                    if (PlayerState.responsePhaseActive && !PlayerState.isPaused) window.Voice.sayKey('countdown' + s);
                }, at)
            );
    });
    const w = setInterval(() => {
        if (!PlayerState.responsePhaseActive) {
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

    if (!btnPlayer.__patch37bound) { btnPlayer.addEventListener('click', startPlayer); btnPlayer.__patch37bound = true; }
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
        PlayerState.currentAcuity = Math.max(0.1, Math.round((PlayerState.currentAcuity - 0.1) * 10) / 10);
        const d = userScenario?.params?.readingDistance || 1;
        readingContentEl.style.fontSize = acuityToFontSizePx(PlayerState.currentAcuity, d, screenPPI) + 'px';
        setTimeout(() => {
            readingTotalPages = calcReadingTotalPages();
            scrollReadingToPage(0);
        }, 60);
    });
    $('reading-see-well').addEventListener('click', () => {
        PlayerState.currentAcuity = Math.min(2.0, Math.round((PlayerState.currentAcuity + 0.1) * 10) / 10);
        const d = userScenario?.params?.readingDistance || 1;
        readingContentEl.style.fontSize = acuityToFontSizePx(PlayerState.currentAcuity, d, screenPPI) + 'px';
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

// PATCH54_PIP: camera preview toggle in corner
(function installCamPreview() {
    if (document.getElementById('btn-cam-preview')) return;
    var style = document.createElement('style');
    style.textContent = '#hidden-video.pip-visible{position:fixed !important;right:12px !important;bottom:12px !important;left:auto !important;top:auto !important;width:240px !important;height:180px !important;opacity:1 !important;pointer-events:none !important;border:2px solid #0ea5e9;border-radius:8px;z-index:9998;transform:scaleX(-1);box-shadow:0 6px 20px rgba(0,0,0,0.6);background:#000;}';
    document.head.appendChild(style);

    // Кнопка в шапке рядом с logout
    var anchor = document.getElementById('btn-logout');
    if (!anchor || !anchor.parentNode) return;
    var btn = document.createElement('button');
    btn.id = 'btn-cam-preview';
    btn.className = 'btn btn-ghost btn-icon';
    btn.type = 'button';
    btn.title = 'Показать/скрыть экран камеры (P)';
    btn.textContent = '📹';
    btn.style.cssText = 'margin-right:6px;';
    anchor.parentNode.insertBefore(btn, anchor);

    var KEY = 'vissort_cam_preview';
    function apply() {
        var v = document.getElementById('hidden-video');
        if (!v) return;
        var on = localStorage.getItem(KEY) === '1';
        v.classList.toggle('pip-visible', on);
        btn.style.background = on ? '#0ea5e9' : '';
        btn.style.color = on ? '#fff' : '';
    }
    btn.addEventListener('click', function() {
        var on = localStorage.getItem(KEY) === '1';
        localStorage.setItem(KEY, on ? '0' : '1');
        apply();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З') {
            if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
            var on = localStorage.getItem(KEY) === '1';
            localStorage.setItem(KEY, on ? '0' : '1');
            apply();
        }
    });
    // Периодически проверяем -- видео создаётся динамически
    setInterval(apply, 1000);
    setTimeout(apply, 500);
    console.log('[pip] camera preview installed');
})();

// PATCH55_CAM_HUD: overlay on camera preview with state (border + text)
(function installCamHud() {
    function ensure() {
        var v = document.getElementById('hidden-video');
        if (!v) return null;
        var el = document.getElementById('cam-hud');
        if (!el) {
            el = document.createElement('div');
            el.id = 'cam-hud';
            el.style.cssText = 'position:fixed;right:12px;bottom:196px;width:240px;padding:6px 8px;background:rgba(0,0,0,0.7);color:#fff;font-family:monospace;font-size:12px;border-radius:6px;z-index:9999;text-align:center;pointer-events:none;line-height:1.4;';
            document.body.appendChild(el);
        }
        return el;
    }
    setInterval(function() {
        var v = document.getElementById('hidden-video');
        var el = ensure();
        if (!v || !el) return;
        // PiP выключен -- скрываем HUD
        if (!v.classList.contains('pip-visible')) {
            el.style.display = 'none';
            return;
        }
        el.style.display = 'block';

        var face = document.getElementById('cam-indicator');
        var faceText = face ? face.textContent : '';
        // PATCH55_FIX: player uses 📏 when face is OK; ❌ or 📷 means lost
        var hasFace = faceText.indexOf('📏') !== -1 || faceText.indexOf('✅') !== -1; // PATCH58: ✅ or 📏
        var dev = (typeof camBaseline !== 'undefined' && camBaseline && typeof curDistanceM !== 'undefined' && curDistanceM)
            ? ((curDistanceM - camBaseline) / camBaseline * 100)
            : null;
        var dist = (typeof curDistanceM !== 'undefined' && curDistanceM) ? curDistanceM.toFixed(2) : '—';
        var base = (typeof camBaseline !== 'undefined' && camBaseline) ? camBaseline.toFixed(2) : '—';

        var status, border;
        var faceLostMs = (typeof window._faceLostSince !== 'undefined' && window._faceLostSince)
            ? (performance.now() - window._faceLostSince)
            : 0;
        if (!hasFace) {
            // PATCH59_HUD: yellow for short loss (<1.5s), red for long
            if (faceLostMs < 1500) {
                status = '\u26A0\uFE0F \u041B\u0418\u0426\u041E? ' + (dev != null ? dev.toFixed(1) + '%' : '');
                border = '#eab308';
                v.style.animation = '';
            } else {
                status = '\u274C \u041D\u0415\u0422 \u041B\u0418\u0426\u0410' + (dev != null ? ' ' + dev.toFixed(1) + '%' : '');
                border = '#dc2626';
                v.style.animation = 'camBlink 0.6s infinite alternate';
            }
        } else if (dev != null && Math.abs(dev) > 15) {
            status = (dev < 0 ? '\u26A0\uFE0F \u0411\u041B\u0418\u0417\u041A\u041E ' : '\u26A0\uFE0F \u0414\u0410\u041B\u0415\u041A\u041E ') + dev.toFixed(1) + '%';
            border = '#eab308';
            v.style.borderColor = border;
            v.style.animation = '';
        } else {
            status = '\u2705 OK ' + (dev != null ? dev.toFixed(1) + '%' : '');
            border = '#10b981';
            v.style.borderColor = border;
            v.style.animation = '';
        }
        el.innerHTML = status + '<br>dist: ' + dist + '  base: ' + base;
        v.style.borderColor = border;
        v.style.borderWidth = '3px';
        v.style.borderStyle = 'solid';
    }, 250);

    // Анимация мигания
    var st = document.createElement('style');
    st.textContent = '@keyframes camBlink{from{border-color:#dc2626;}to{border-color:#7f1d1d;}}';
    document.head.appendChild(st);

    console.log('[cam-hud] installed');
})();

// PATCH61_FACE_PAUSE: overlay + voice when face lost >2s
(function installFaceLostPause() {
    function ensureOverlay() {
        var el = document.getElementById('face-lost-overlay');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'face-lost-overlay';
        el.style.cssText = 'position:fixed;inset:0;background:rgba(11,11,18,0.94);display:none;align-items:center;justify-content:center;z-index:99997;font-family:"Segoe UI",Tahoma,sans-serif;color:#fff;text-align:center;padding:20px;';
        el.innerHTML = '<div><div style="font-size:72px;margin-bottom:24px;">&#128100;</div><h2 style="font-size:28px;margin:0 0 12px;font-weight:700;">Вернитесь в кадр</h2><p style="color:#94a3b8;font-size:15px;">Тренировка возобновится автоматически</p></div>';
        document.body.appendChild(el);
        return el;
    }
    setInterval(function() {
        var overlay = ensureOverlay();
        var face = document.getElementById('cam-indicator');
        var faceText = face ? face.textContent : '';
        var hasFace = faceText.indexOf('\uD83D\uDCCF') !== -1 || faceText.indexOf('\u2705') !== -1;
        var training = PlayerState.playerRunning && !PlayerState.isPaused;
        var longLoss = false;
        if (!hasFace && window._faceLostSince) {
            if (performance.now() - window._faceLostSince > 2000) longLoss = true;
        }
        if (training && longLoss) {
            if (overlay.style.display !== 'flex') {
                overlay.style.display = 'flex';
                console.warn('[PATCH61] face lost >2s -- paused');
                if (window.Voice && window.Voice.sayKey) window.Voice.sayKey('returnToFrame', { cancel: true });
            }
            window._faceLostPause = true;
        } else {
            if (overlay.style.display === 'flex') {
                overlay.style.display = 'none';
                console.log('[PATCH61] face back -- resuming');
                if (window.Voice && window.Voice.sayKey) window.Voice.sayKey('faceFound', { cancel: true });
                // PATCH30_ABORT: after long face loss, enter waiting-stable (like deviation)
                if (typeof _abortCurrentStimulus === 'function') {
                    try { _abortCurrentStimulus('face_back_after_long_loss'); } catch (e) {}
                }
            }
            window._faceLostPause = false;
        }
    }, 300);
})();


