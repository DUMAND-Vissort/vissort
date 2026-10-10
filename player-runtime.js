// ==================== user.js: Начало части 1 из 4 ====================
'use strict';

// ============================================================
// ============================================================
if (!window.VissortCore) {
    throw new Error(
        '[player] VissortCore not loaded. Include <script src="vissort-core.js"></script> BEFORE player-runtime.js.'
    );
}
const {
    acuityToSizeMm,
    acuityToSizePx,
    acuityToFontSizePx,
    detectDeviceType,
    detectPPIHeuristic,
    loadPPI,
    hexToRgb,
    rgbToHex,
    lerpColor,
    buildGenericDynamicPhases,
    buildCirclePhases,
    generateLetterE,
    generateLandoltRing,
    getCircleStimulusSVG,
    getStimulusSVG,
    escapeHtml,
    getThreshold,
    randomDirection
} = window.VissortCore;

// ==================== PLAYER OPTIONS ====================
(function checkPlayerOptions() {
    const opts = window.VissortPlayerOptions || { requireDomain: false };
    if (opts.requireDomain) {
        const ALLOWED = ['vissort.com', 'www.vissort.com', 'localhost', '127.0.0.1'];
        if (!ALLOWED.includes(location.hostname)) {
            document.body.innerHTML =
                '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0b12;color:#e8e8f0;font-family:sans-serif;text-align:center;padding:20px"><div><h1 style="font-size:24px;margin-bottom:12px">Access denied</h1><p style="color:#9494a8">Player only works on vissort.com</p></div></div>';
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
            if (email.value) {
                pass.focus();
                pass.select();
            } else {
                email.focus();
                email.select();
            }
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

// Логирование каждого ответа
window._reactionLog = window._reactionLog || [];
window._logAnswer = function (entry) {
    window._reactionLog.push(entry);
    var tag = entry.valid ? '[answer]' : '[invalid]';
    var msg =
        tag + ' rt=' + (entry.rt != null ? Math.round(entry.rt) + 'ms' : 'n/a') + ' correct=' + entry.correct;
    if (entry.direction) msg += ' dir=' + entry.direction;
    if (entry.reason) msg += ' reason=' + entry.reason;
    console.log(msg);
};
window._reactionReport = function () {
    var log = window._reactionLog || [];
    var rts = log
        .filter(function (e) {
            return e.rt != null && e.valid;
        })
        .map(function (e) {
            return e.rt;
        });
    console.log('Total: ' + log.length + ' | Valid: ' + rts.length);
    if (rts.length)
        console.log(
            'RT raw: [' +
                rts
                    .map(function (x) {
                        return Math.round(x);
                    })
                    .join(', ') +
                ']'
        );
};

let _findSameState = null;

// --- МОРГАНИЕ ---
// Логика вынесена в player-camera.js (_isBlinkFromLandmarks, _calcEAR).
// Состояние — в PlayerState (_blinkIsClosed, _blinkClosedSince, _lastEarValue).

// === ПЛЕЕР ГРАФА (объявления ДО первого использования в updateCounters) ===
let _frameSkipCounter = 0;

// Принудительная отмена стимула при отклонении
// Called when user's distance deviates >15%, face is lost, or face returns.
// Cancels current show, waits for stability, then reshows from scratch.

function _abortCurrentStimulus(reason) {
    return window.PlayerInvalidDetection._abortCurrentStimulus(reason);
}
function _resumeAfterStable() {
    return window.PlayerInvalidDetection._resumeAfterStable();
}
function _updateStimulusDim() {
    return window.PlayerInvalidDetection._updateStimulusDim();
}
window._updateStimulusDim = _updateStimulusDim;
function _showInvalidToast(text) {
    return window.PlayerInvalidDetection._showInvalidToast(text);
}
function _recordDeviation(pct) {
    return window.PlayerInvalidDetection._recordDeviation(pct);
}
window._recordDeviation = _recordDeviation;
function _isAnswerInvalid() {
    return window.PlayerInvalidDetection._isAnswerInvalid();
}
function _markAnswerInvalid(reason) {
    return window.PlayerInvalidDetection._markAnswerInvalid(reason);
}

// ==================== RATE LIMIT + SCENARIO VALIDATION ====================
const checkRateLimit = window.PlayerUtils.checkRateLimit;
const validateScenario = window.PlayerUtils.validateScenario;

const $ = (id) => document.getElementById(id);
// eslint-disable-next-line no-redeclare -- TODO(phase3): синхронизировать с window.stimDisplay
const stimDisplay = $('stim');
// eslint-disable-next-line no-redeclare -- TODO(phase3): синхронизировать с window.stimArea
const stimArea = $('stim-display');
// Экспорт в window для вынесенных модулей (player-animation.js и др.)
window.stimDisplay = stimDisplay;
window.stimArea = stimArea;
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

function _effectiveDistance(declared) {
    return window.PlayerUtils.effectiveDistance(declared, PlayerState.curDistanceM);
}
window._distEMA = null;
function _smoothDistance(raw) {
    return window.PlayerUtils.smoothDistance(raw);
}

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
        try {
            _raw = localStorage.getItem('vissort_test_scenario');
        } catch (e) {}
        if (_raw) {
            try {
                var _td = JSON.parse(_raw);
                PlayerState.supabaseClient = null;
                PlayerState.currentUser = null;
                PlayerState.sessionId = 'test_' + Date.now();
                PlayerState.userScenario = {
                    id: '__test__',
                    name: '🧪 Тестовый сценарий',
                    params: _td,
                    trainingType: _td.trainingType || 'single'
                };
                PlayerState.userScenarios = [PlayerState.userScenario];
                authModal.classList.remove('open');
                hdrUser.textContent = '🧪';
                hdrScenario.textContent = PlayerState.userScenario.name;
                applyScenarioDefaults();
                updateCounters();
                hideStatus();
                btnPlayer.disabled = false;
                console.log('[test] no-login mode');
                setTimeout(function () {
                    try {
                        enableCamera();
                    } catch (e) {}
                }, 100);
                return;
            } catch (e) {
                console.warn('[test] no-login failed:', e);
            }
        }
    }
    PlayerState.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    var _onLoggedInFired = false;
    function _safeOnLoggedIn() {
        if (_onLoggedInFired) return;
        _onLoggedInFired = true;
        onLoggedIn();
    }
    PlayerState.supabaseClient.auth.getSession().then(({ data }) => {
        PlayerState.currentUser = data?.session?.user || null;
        if (PlayerState.currentUser) _safeOnLoggedIn();
        else promptLogin();
    });
    // Обработка SIGNED_IN и INITIAL_SESSION
    PlayerState.supabaseClient.auth.onAuthStateChange((event, session) => {
        PlayerState.currentUser = session?.user || null;
        if (event === 'SIGNED_OUT') {
            _onLoggedInFired = false;
            promptLogin();
            return;
        }
        if (
            (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') &&
            PlayerState.currentUser
        ) {
            _safeOnLoggedIn();
        }
    });
    // Fallback: если getSession сработал слишком рано, повторить через 1.5с
    setTimeout(async () => {
        if (_onLoggedInFired) return;
        try {
            const { data } = await PlayerState.supabaseClient.auth.getSession();
            if (data?.session?.user) {
                PlayerState.currentUser = data.session.user;
                console.log('[auth] fallback: сессия найдена, вызов onLoggedIn');
                _safeOnLoggedIn();
            }
        } catch (e) {}
    }, 1500);
}
function promptLogin() {
    hideStatus();
    PlayerState.authMode = 'signin';
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
    if (PlayerState.authMode === 'signin') {
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
    try {
        return btoa(unescape(encodeURIComponent(s)));
    } catch (_) {
        return '';
    }
}
function decodeCred(s) {
    try {
        return decodeURIComponent(escape(atob(s)));
    } catch (_) {
        return '';
    }
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
    PlayerState.authMode = mode;
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
    if (PlayerState.authMode === 'signin') {
        const { error } = await PlayerState.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            alert('Ошибка: ' + error.message);
            return;
        }
    } else {
        const { error } = await PlayerState.supabaseClient.auth.signUp({ email, password });
        if (error) {
            alert('Ошибка: ' + error.message);
            return;
        }
    }
    authModal.classList.remove('open');
}
async function onLoggedIn() {
    authModal.classList.remove('open');
    hdrUser.textContent = PlayerState.currentUser.email || '—';
    showStatus('Загрузка сценария…', 'Читаем назначения.');
    // ==== Тестовый сценарий из админки (player.html?test=1) ====
    if (location.search.includes('test=1')) {
        try {
            const raw = localStorage.getItem('vissort_test_scenario');
            if (raw) {
                const testData = JSON.parse(raw);
                console.log('[test] loading test scenario from localStorage');
                PlayerState.userScenarios = [
                    {
                        id: '__test__',
                        name: '🧪 Тестовый сценарий',
                        params: testData,
                        trainingType: testData.trainingType || 'single'
                    }
                ];
                PlayerState.userScenario = PlayerState.userScenarios[0];
                hdrScenario.textContent = PlayerState.userScenario.name;
                applyScenarioDefaults();
                updateCounters();
                hideStatus();
                btnPlayer.disabled = false;
                if (typeof enableCamera === 'function') {
                    try {
                        enableCamera();
                    } catch (e) {
                        console.warn('[test] camera:', e);
                    }
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
    // ==== /Тестовый сценарий ====

    PlayerState.userScenarios = await loadUserScenarios();
    if (!PlayerState.userScenarios.length) {
        showStatus('Сценарий не назначен', 'Обратитесь к администратору.', 'Обновить', () => onLoggedIn());
        // Запустить камеру и онбординг даже без сценариев
        if (typeof VissortDevice !== 'undefined' && typeof Onboarding !== 'undefined') {
            try {
                const fp = await VissortDevice.getFingerprint();
                VissortDevice.setCurrent(fp, PlayerState.currentUser ? PlayerState.currentUser.id : null);
                await Onboarding.start({
                    client: PlayerState.supabaseClient,
                    userId: PlayerState.currentUser ? PlayerState.currentUser.id : null,
                    onDone: (data) => { if (!data || !data.skipped) enableCamera(); else console.log('[onboarding] пропущено — камера не запрашивается'); }
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
    if (PlayerState.userScenarios.length === 1) {
        PlayerState.userScenario = PlayerState.userScenarios[0];
        hdrScenario.textContent = PlayerState.userScenario.name || 'Сценарий';
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
            VissortDevice.setCurrent(fp, PlayerState.currentUser ? PlayerState.currentUser.id : null);
            await Onboarding.start({
                client: PlayerState.supabaseClient,
                userId: PlayerState.currentUser ? PlayerState.currentUser.id : null,
                onDone: (data) => { if (!data || !data.skipped) enableCamera(); else console.log('[onboarding] пропущено — камера не запрашивается'); }
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
    const { data: assigns, error: e1 } = await PlayerState.supabaseClient
        .from('user_scenarios')
        .select('scenario_id')
        .eq('user_id', PlayerState.currentUser.id);
    if (e1) {
        console.error('[user] user_scenarios:', e1);
        return [];
    }
    if (!assigns || !assigns.length) return [];
    const ids = assigns.map((a) => a.scenario_id);
    const { data: list, error: e2 } = await PlayerState.supabaseClient
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
    PlayerState.userScenarios.forEach((s) => {
        const el = document.createElement('div');
        el.className =
            'scenario-item' +
            (PlayerState.userScenario && PlayerState.userScenario.id === s.id ? ' active' : '');
        el.innerHTML = `<div><div style="font-weight:600">${escapeHtml(s.name)}</div><div style="font-size:11px;color:#9ca3af">${escapeHtml(s.trainingType || 'single')}</div></div><div>▶</div>`;
        el.addEventListener('click', () => {
            PlayerState.userScenario = s;
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
    const { data, error } = await PlayerState.supabaseClient
        .from('test_results')
        .select('session_id,node_id,response_time_ms,is_correct,created_at')
        .eq('user_id', PlayerState.currentUser.id)
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
    const p = PlayerState.userScenario?.params || {};
    PlayerState.screenPPI = p.ppi || PlayerState.screenPPI || 96;
    if (p.minDetectPct && !isNaN(p.minDetectPct)) PlayerState._minDetectPct = parseFloat(p.minDetectPct);
    PlayerState.currentAcuity = p.trainingType === 'reading' ? 1.0 : p.startAcuity || 0.5;
    PlayerState.currentStimColor = p.startStimColor ? { ...p.startStimColor } : { r: 0, g: 255, b: 0 };
    PlayerState.currentBgColor = p.startBgColor ? { ...p.startBgColor } : { r: 0, g: 0, b: 0 };
}

function updateCounters() {
    let p, acuityVal;
    if (PlayerState.graphActive && PlayerState.gCurrentNodeId) {
        const n = gGetNode(PlayerState.gCurrentNodeId);
        p = n || {};
        acuityVal = PlayerState.gNodeAcuityCurrent;
    } else {
        p = PlayerState.userScenario?.params || {};
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

function setStimColorRGB(r, g, b) {
    const svg = stimDisplay.querySelector('svg');
    if (!svg) return;
    const c = `rgb(${r},${g},${b})`;
    const p = svg.querySelector('path');
    if (p) p.setAttribute('fill', c);
    const cc = svg.querySelector('circle');
    if (cc) cc.setAttribute('stroke', c);
}

function startSingleStimAnimation(p) {
    return window.PlayerAnimation.startSingleStimAnimation(p);
}
function stopSingleStimAnimation() {
    return window.PlayerAnimation.stopSingleStimAnimation();
}
function startSingleBgAnimation(p) {
    return window.PlayerAnimation.startSingleBgAnimation(p);
}
function stopSingleBgAnimation() {
    return window.PlayerAnimation.stopSingleBgAnimation();
}
function startBlinkAnimation(opts) {
    return window.PlayerAnimation.startBlinkAnimation(opts);
}
function stopBlinkAnimation() {
    return window.PlayerAnimation.stopBlinkAnimation();
}
function startCircleAnimation(node) {
    return window.PlayerAnimation.startCircleAnimation(node);
}
function stopCircleAnimation() {
    return window.PlayerAnimation.stopCircleAnimation();
}
function stopPeripheralAnimation() {
    return window.PlayerAnimation.stopPeripheralAnimation();
}
function buildPeripheralDots(node) {
    return window.PlayerAnimation.buildPeripheralDots(node);
}
function buildDefocusFrame(node, stimHtml) {
    return window.PlayerAnimation.buildDefocusFrame(node, stimHtml);
}
function removeSingleGridLines() {
    return window.PlayerAnimation.removeSingleGridLines();
}
function drawSingleGridLines(gx, gy) {
    return window.PlayerAnimation.drawSingleGridLines(gx, gy);
}
function applySingleGridPosition(size, gx, gy, row, col, showLines) {
    return window.PlayerAnimation.applySingleGridPosition(size, gx, gy, row, col, showLines);
}
function pickSingleGridCell(gx, gy, rand, avoid, fx, fy, cells) {
    return window.PlayerAnimation.pickSingleGridCell(gx, gy, rand, avoid, fx, fy, cells);
}
function applyRandomStimulusPosition(size) {
    return window.PlayerAnimation.applyRandomStimulusPosition(size);
}

function displayStimulus(html, bg) {
    stimDisplay.innerHTML = html;
    stimArea.style.backgroundColor = `rgb(${bg.r},${bg.g},${bg.b})`;
    PlayerState._stimulusDistance = PlayerState.curDistanceM;
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

function _faceEmoji(rate, hasFaceNow) {
    return window.PlayerCamera._faceEmoji(rate, hasFaceNow);
}
function _pushDetection(found) {
    return window.PlayerCamera._pushDetection(found);
}
function _detectRatePct() {
    return window.PlayerCamera._detectRatePct();
}
function _updateDetectUI() {
    return window.PlayerCamera._updateDetectUI();
}
function _checkHardLimit() {
    return window.PlayerCamera._checkHardLimit();
}
function startCamLoop() {
    return window.PlayerCamera.startCamLoop();
}
async function enableCamera() {
    return window.PlayerCamera.enableCamera();
}
async function loadFaceApi() {
    /* internal to player-camera.js */
}
async function processCamFrame() {
    return window.PlayerCamera.processCamFrame();
}
function evaluateDistance() {
    return window.PlayerCamera.evaluateDistance();
}
function disableCamera() {
    return window.PlayerCamera.disableCamera();
}

// ==================== user.js: Конец части 1 из 4 ====================
// ==================== user.js: Начало части 2 из 4 ====================

// ==================== ПЛЕЕР ГРАФА ====================
function gGetNode(id) {
    return PlayerState.gNodes.find((n) => n.id === id);
}

function buildGraphQueue() {
    PlayerState.gQueue = [];
    if (!PlayerState.gNodes.length) return;
    const startNode = PlayerState.gNodes.find((n) => n.isStart === true) || PlayerState.gNodes[0];
    const visited = new Set();
    function visit(nodeId, connection = null, fromNodeId = null) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        PlayerState.gQueue.push({ nodeId, connection, fromNodeId });
        PlayerState.gConnections
            .filter((c) => c.fromId === nodeId && c.isLoop && c.toId !== nodeId)
            .forEach((loop) => {
                const lim = loop.loopLimit || 1;
                for (let i = 0; i < lim; i++) {
                    PlayerState.gQueue.push({ nodeId: loop.toId, connection: loop, fromNodeId: nodeId });
                    PlayerState.gQueue.push({ nodeId: nodeId, connection: loop, fromNodeId: loop.toId });
                }
            });
        PlayerState.gConnections
            .filter((c) => c.fromId === nodeId && !c.isLoop && c.toId !== nodeId)
            .forEach((conn) => visit(conn.toId, conn, nodeId));
    }
    visit(startNode.id, null, null);
}

function startGraphPlay(nodes, connections, books) {
    PlayerState.graphActive = true;
    PlayerState.gNodes = nodes || [];
    PlayerState.gConnections = connections || [];
    if (books && typeof books === 'object') {
        window._books = window._books || {};
        Object.assign(window._books, books);
    }
    buildGraphQueue();
    if (!PlayerState.gQueue.length) {
        stopPlayer();
        return;
    }
    PlayerState.gIndex = 0;
    PlayerState.gCurrentNodeId = null;
    playNextGraphNode();
}

function playNextGraphNode() {
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    if (PlayerState.gIndex >= PlayerState.gQueue.length) {
        stopPlayer();
        showStatus('Граф пройден', `Серий: ${PlayerState.completedSeries}`, 'Ещё раз', () => {
            hideStatus();
            startPlayer();
        });
        return;
    }
    const item = PlayerState.gQueue[PlayerState.gIndex];
    const node = gGetNode(item.nodeId);
    if (!node) {
        PlayerState.gIndex++;
        playNextGraphNode();
        return;
    }
    if (node.isActive === false && node.nodeType !== 'LOGIC_IF') {
        PlayerState.gIndex++;
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
    PlayerState.gCurrentNodeId = node.id;
    PlayerState.completedSeries = PlayerState.successfulSeries = PlayerState.failedSeries = 0;
    PlayerState.seriesCorrect = PlayerState.seriesIncorrect = PlayerState.seriesNoAnswer = 0;
    PlayerState.seriesStep = 0;
    PlayerState.noAnswerSeriesStreak = 0;
    PlayerState.lastDirection = null;
    PlayerState.currentSingleCell = { row: 0, col: 0 };
    PlayerState.gNodeAcuityCurrent = Math.max(0.1, Math.min(1.0, node.stimAcuity || 1.0));
    updateCounters();
    hideStimulus();
    responseButtons.style.display = 'none';
    PlayerState.phaseTimers.push(
        setTimeout(
            () => {
                if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphStimulus(node);
            },
            node.delay1 != null ? node.delay1 : 0
        )
    );
}

// PATCH: авто-пересчёт размера стимула под новую дистанцию.
// Вызывается из player-camera.js при distControlMode='auto'.
function _recalcStimulusSize() {
    if (!PlayerState.curDistanceM) return;
    const node = gGetNode(PlayerState.gCurrentNodeId);
    if (!node) return;
    const ppi = node.stimPPI || PlayerState.screenPPI || 96;
    const eff = acuityToSizePx(PlayerState.gNodeAcuityCurrent || 1.0, PlayerState.curDistanceM, ppi);
    PlayerState.currentSize = eff;
    // Обновить SVG на экране
    const svg = document.querySelector('#stim svg');
    if (svg) {
        svg.setAttribute('width', eff);
        svg.setAttribute('height', eff);
        svg.setAttribute('viewBox', '0 0 ' + eff + ' ' + eff);
    }
    // Обновить _stimulusDistance — теперь baseline для дальнейших проверок
    PlayerState._stimulusDistance = PlayerState.curDistanceM;
    console.log('[auto-recalc] size updated to ' + eff + 'px at ' + PlayerState.curDistanceM.toFixed(2) + 'm');
}

function playGraphStimulus(node) {
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    if (window._faceLostPause) {
        setTimeout(function () {
            playGraphStimulus(node);
        }, 500);
        return;
    } // пауза при потере лица
    if (PlayerState._waitingStable) {
        setTimeout(function () {
            playGraphStimulus(node);
        }, 500);
        return;
    } // отмена при отклонении
    PlayerState._answerBlocked = false; // Сброс блокировки перед новым циклом
    if (node.minDetectPct != null) PlayerState._minDetectPct = node.minDetectPct;
    if (node.tolNearCm != null) PlayerState._tolNearCm = node.tolNearCm;
    if (node.tolFarCm != null) PlayerState._tolFarCm = node.tolFarCm;
    if (node.distControlMode === 'auto') PlayerState._distControlMode = 'auto';
    else PlayerState._distControlMode = 'return'; // порог узла
    // Ранняя активация фазы ответа
    PlayerState.responsePhaseActive = true;
    PlayerState.responseStartTime = performance.now();
    PlayerState.lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    if (PlayerState.completedSeries >= (node.seriesCount || 5)) {
        PlayerState.gIndex++;
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
        } while (dir === PlayerState.lastDirection);
    } else dir = node.stimDirectionFixed || 'вверх';
    PlayerState.lastDirection = dir;
    PlayerState.currentCorrectDirection = dir;
    // Включить фазу ответа до рендера
    const dCalc = _effectiveDistance(node.stimDistance || 1); // Приоритет измеренной дистанции;
    const pCalc = node.stimPPI || PlayerState.screenPPI || 96;
    const eff = acuityToSizePx(PlayerState.gNodeAcuityCurrent, dCalc, pCalc);
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
        PlayerState.responseStartTime = performance.now(); // метка начала после рендера (граф)
    } else displayStimulus(svgData.html, { r: node.bgR || 0, g: node.bgG || 0, b: node.bgB || 0 });
    PlayerState.responseStartTime = performance.now(); // метка начала после рендера (граф)
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
    let sd = (node.duration != null ? node.duration : 1000) + (node.response != null ? node.response : 0); // Полная серия без ответов → пауза
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
        if (PlayerState.lastResponse.answered) {
            if (PlayerState.lastResponse.isCorrect) PlayerState.seriesCorrect++;
            else PlayerState.seriesIncorrect++;
            PlayerState.seriesStep++; // Только ответы считаются
        } else {
            PlayerState.seriesNoAnswer++;
            saveResult(node.id, null, false);
            // Таймаут не увеличивает seriesStep
            // Полная серия без ответов → пауза
            if (PlayerState.seriesStep === 0 && PlayerState.seriesNoAnswer >= (node.seriesSize || 6)) {
                console.log('[pause] полная серия без ответов, пауза');
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
    // Адаптивная острота зрения
    if (node.adaptiveAcuity !== false) {
        if (ok) {
            const eA = node.endAcuity != null ? node.endAcuity : node.stimAcuity || 1.0;
            if (PlayerState.gNodeAcuityCurrent < eA)
                PlayerState.gNodeAcuityCurrent = Math.min(
                    eA,
                    Math.round((PlayerState.gNodeAcuityCurrent + (node.acuityStep || 0.1)) * 10) / 10
                );
        } else {
            const sA = node.stimAcuity || 1.0;
            if (PlayerState.gNodeAcuityCurrent > sA)
                PlayerState.gNodeAcuityCurrent = Math.max(
                    sA,
                    Math.round((PlayerState.gNodeAcuityCurrent - (node.acuityStep || 0.1)) * 10) / 10
                );
        }
    }
    PlayerState.seriesCorrect =
        PlayerState.seriesIncorrect =
        PlayerState.seriesNoAnswer =
        PlayerState.seriesStep =
            0;
    PlayerState.lastDirection = null;
    updateCounters();
    // Отчёт отключён, только лог ответов
    // Агрегат времени реакции
    try {
        if (!window._reactionTimes) window._reactionTimes = [];
        var _rt = PlayerState.lastResponse && PlayerState.lastResponse.reactionTimeMs;
        if (_rt != null) window._reactionTimes.push(_rt);
        var _recent = window._reactionTimes.slice(-20);
        var _avg =
            _recent.reduce(function (a, b) {
                return a + b;
            }, 0) / _recent.length;
        var _min = Math.min.apply(null, _recent);
        var _max = Math.max.apply(null, _recent);
    } catch (e) {}
    if (PlayerState.noAnswerSeriesStreak >= 3) {
        pauseTraining();
        return;
    }
    if (PlayerState.completedSeries >= (node.seriesCount || 5)) {
        PlayerState.gIndex++;
        playNextGraphNode();
        return;
    }
    PlayerState.phaseTimers.push(
        setTimeout(
            () => {
                if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphStimulus(node);
            },
            node.delay2 != null ? node.delay2 : 500
        )
    );
}

function handleGraphDirectionAnswer(dir) {
    if (!PlayerState.responsePhaseActive) return;
    if (PlayerState._answerBlocked) return; // Блокировка ответов при заморозке
    // Проверка отклонения перед ответом
    var _inv32 = window._isAnswerInvalid ? window._isAnswerInvalid() : null;
    if (_inv32) {
        PlayerState.lastResponse = {
            answered: true,
            isCorrect: false,
            reactionTimeMs: Math.max(
                0,
                performance.now() - (PlayerState.responseStartTime || performance.now())
            ),
            invalidReason: _inv32
        };
        if (window._logAnswer)
            window._logAnswer({
                rt: PlayerState.lastResponse.reactionTimeMs,
                valid: false,
                correct: false,
                reason: PlayerState.lastResponse.invalidReason || 'unknown'
            });
        PlayerState.responsePhaseActive = false;
        if (window._markAnswerInvalid) window._markAnswerInvalid(_inv32);
        if (window.Voice) window.Voice.sayKey('wrong', { cancel: true });
        document.body.style.background = '#78350f';
        setTimeout(function () {
            document.body.style.background = '#0b0b0f';
        }, 300);
        return;
    }

    const ok = dir === PlayerState.currentCorrectDirection;

    // Очистка таймера и DOM сразу после ответа
    if (PlayerState.currentShowTimer) {
        clearTimeout(PlayerState.currentShowTimer);
        PlayerState.currentShowTimer = null;
    }
    if (PlayerState.phaseTimers && PlayerState.phaseTimers.length) {
        PlayerState.phaseTimers.forEach(function (t) {
            clearTimeout(t);
        });
        PlayerState.phaseTimers = [];
    }
    try {
        var _el34 = document.getElementById('stim');
        if (_el34) _el34.innerHTML = '';
    } catch (e) {}
    try {
        var _ar34 = document.getElementById('stim-display');
        if (_ar34) _ar34.style.backgroundColor = '';
    } catch (e) {}
    try {
        stopSingleStimAnimation();
    } catch (e) {}
    try {
        stopSingleBgAnimation();
    } catch (e) {}
    try {
        stopCircleAnimation();
    } catch (e) {}
    try {
        stopPeripheralAnimation();
    } catch (e) {}
    try {
        stopBlinkAnimation();
    } catch (e) {}
    PlayerState.lastResponse = {
        answered: true,
        isCorrect: ok,
        reactionTimeMs: Math.max(0, performance.now() - (PlayerState.responseStartTime || performance.now()))
    };
    if (window._logAnswer)
        window._logAnswer({
            rt: PlayerState.lastResponse.reactionTimeMs,
            valid: true,
            correct: ok,
            direction:
                typeof direction !== 'undefined'
                    ? direction
                    : typeof dir !== 'undefined'
                      ? dir
                      : typeof answer !== 'undefined'
                        ? String(answer)
                        : null
        });
    PlayerState.responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(() => {
        document.body.style.background = '#0b0b0f';
    }, 200);
    saveResult(PlayerState.gCurrentNodeId || 'graph_single', PlayerState.lastResponse.reactionTimeMs, ok);

    // Продвижение серии сразу
    if (ok) PlayerState.seriesCorrect++;
    else PlayerState.seriesIncorrect++;
    PlayerState.seriesStep++;
    updateCounters();
    var _n35 = gGetNode(PlayerState.gCurrentNodeId);
    if (_n35) {
        if (PlayerState.seriesStep >= (_n35.seriesSize || 6)) {
            setTimeout(function () {
                finishGraphStimulusSeries(_n35);
            }, 50);
        } else {
            setTimeout(
                function () {
                    if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphStimulus(_n35);
                },
                _n35.delay2 != null ? _n35.delay2 : 1000
            );
        }
    }
}

function playGraphCompare(node) {
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    PlayerState.gCurrentCompareNode = node;
    PlayerState.gCurrentNodeId = node.id;
    PlayerState.completedSeries = PlayerState.successfulSeries = PlayerState.failedSeries = 0;
    PlayerState.seriesCorrect = PlayerState.seriesIncorrect = PlayerState.seriesNoAnswer = 0;
    PlayerState.seriesStep = 0;
    PlayerState.noAnswerSeriesStreak = 0;
    PlayerState.compareMode = node.compareMode || 'direction';
    PlayerState.gridX = Math.max(2, Math.min(6, parseInt(node.gridX) || 3));
    PlayerState.gridY = Math.max(1, Math.min(6, parseInt(node.gridY) || 3));
    PlayerState.activeCells = (node.activeCells || []).slice();
    PlayerState.cellParams = (node.cellParams || []).slice();
    if (PlayerState.activeCells.length < 2)
        PlayerState.activeCells = [
            { row: 0, col: 0 },
            { row: 0, col: 1 }
        ];
    while (PlayerState.cellParams.length < PlayerState.activeCells.length)
        PlayerState.cellParams.push(defaultCellParams());
    updateCounters();
    hideStimulus();
    responseButtons.style.display = 'none';
    PlayerState.phaseTimers.push(
        setTimeout(
            () => {
                if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphCompareRound(node);
            },
            node.delay1 != null ? node.delay1 : 0
        )
    );
}

function playGraphCompareRound(node) {
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    if (PlayerState._waitingStable) {
        setTimeout(function () {
            playGraphCompareRound(node);
        }, 500);
        return;
    } // отмена при отклонении
    if (PlayerState.seriesStep >= (node.seriesSize || 6)) {
        finishGraphCompareSeries(node);
        return;
    }
    removeSingleGridLines();
    stimDisplay.innerHTML = '';
    stimArea.style.background = '#000';
    if (PlayerState.compareMode === 'direction') showDirectionComparison();
    else if (PlayerState.compareMode === 'find_same') showFindSameComparison();
    const dur = PlayerState.cellParams[0]?.duration || node.duration || PlayerState.currentDuration;
    PlayerState.currentShowTimer = setTimeout(() => {
        if (PlayerState.responsePhaseActive) {
            PlayerState.lastResponse = { answered: false, isCorrect: false };
            // Таймаут → seriesNoAnswer, не seriesIncorrect
            PlayerState.seriesNoAnswer++;
            updateCounters();
            saveResult(PlayerState.gCurrentNodeId || 'graph_compare', null, false);
            const _n31 = gGetNode(PlayerState.gCurrentNodeId);
            if (_n31) {
                if (PlayerState.seriesStep >= (_n31.seriesSize || 6)) {
                    finishGraphCompareSeries(_n31);
                } else {
                    PlayerState.phaseTimers.push(
                        setTimeout(() => {
                            if (PlayerState.playerRunning && !PlayerState.isPaused)
                                playGraphCompareRound(_n31);
                        }, _n31.delay2 || 1000)
                    );
                }
            }
        }
    }, dur);
    PlayerState.phaseTimers.push(PlayerState.currentShowTimer);
}

function handleGraphCompareAnswer(answer) {
    if (!PlayerState.responsePhaseActive) return;
    if (PlayerState._answerBlocked) return; // Блокировка ответов при заморозке
    // Проверка отклонения перед ответом
    var _inv32 = window._isAnswerInvalid ? window._isAnswerInvalid() : null;
    if (_inv32) {
        PlayerState.lastResponse = {
            answered: true,
            isCorrect: false,
            reactionTimeMs: Math.max(
                0,
                performance.now() - (PlayerState.responseStartTime || performance.now())
            ),
            invalidReason: _inv32
        };
        if (window._logAnswer)
            window._logAnswer({
                rt: PlayerState.lastResponse.reactionTimeMs,
                valid: false,
                correct: false,
                reason: PlayerState.lastResponse.invalidReason || 'unknown'
            });
        PlayerState.responsePhaseActive = false;
        if (window._markAnswerInvalid) window._markAnswerInvalid(_inv32);
        if (window.Voice) window.Voice.sayKey('wrong', { cancel: true });
        document.body.style.background = '#78350f';
        setTimeout(function () {
            document.body.style.background = '#0b0b0f';
        }, 300);
        return;
    }

    const ok = answer === PlayerState.currentCompareAnswer;

    // Очистка таймера и DOM сразу после ответа
    if (PlayerState.currentShowTimer) {
        clearTimeout(PlayerState.currentShowTimer);
        PlayerState.currentShowTimer = null;
    }
    if (PlayerState.phaseTimers && PlayerState.phaseTimers.length) {
        PlayerState.phaseTimers.forEach(function (t) {
            clearTimeout(t);
        });
        PlayerState.phaseTimers = [];
    }
    try {
        var _el34 = document.getElementById('stim');
        if (_el34) _el34.innerHTML = '';
    } catch (e) {}
    try {
        var _ar34 = document.getElementById('stim-display');
        if (_ar34) _ar34.style.backgroundColor = '';
    } catch (e) {}
    try {
        stopSingleStimAnimation();
    } catch (e) {}
    try {
        stopSingleBgAnimation();
    } catch (e) {}
    try {
        stopCircleAnimation();
    } catch (e) {}
    try {
        stopPeripheralAnimation();
    } catch (e) {}
    try {
        stopBlinkAnimation();
    } catch (e) {}
    PlayerState.lastResponse = {
        answered: true,
        isCorrect: ok,
        reactionTimeMs: Math.max(0, performance.now() - (PlayerState.responseStartTime || performance.now()))
    };
    if (window._logAnswer)
        window._logAnswer({
            rt: PlayerState.lastResponse.reactionTimeMs,
            valid: true,
            correct: ok,
            direction:
                typeof direction !== 'undefined'
                    ? direction
                    : typeof dir !== 'undefined'
                      ? dir
                      : typeof answer !== 'undefined'
                        ? String(answer)
                        : null
        });
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
    saveResult(
        PlayerState.gCurrentNodeId || 'graph_compare',
        PlayerState.lastResponse.reactionTimeMs,
        isCorrect
    );
    const node = gGetNode(PlayerState.gCurrentNodeId);
    if (!node) {
        PlayerState.gIndex++;
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
        PlayerState.gIndex++;
        playNextGraphNode();
        return;
    }
    const th = node.seriesThreshold || getThreshold(node.seriesSize || 6);
    const ok = PlayerState.seriesCorrect >= th;
    PlayerState.completedSeries++;
    if (ok) PlayerState.successfulSeries++;
    else PlayerState.failedSeries++;
    PlayerState.seriesCorrect =
        PlayerState.seriesIncorrect =
        PlayerState.seriesNoAnswer =
        PlayerState.seriesStep =
            0;
    updateCounters();
    if (PlayerState.completedSeries >= (node.seriesCount || 5)) {
        PlayerState.gCurrentCompareNode = null;
        PlayerState.gIndex++;
        playNextGraphNode();
        return;
    }
    PlayerState.phaseTimers.push(
        setTimeout(
            () => {
                if (PlayerState.playerRunning && !PlayerState.isPaused) playGraphCompareRound(node);
            },
            node.delay2 != null ? node.delay2 : 500
        )
    );
}

function playGraphReading(node) {
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    PlayerState.gCurrentNodeId = node.id;
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
    PlayerState.readingPaused = false;
    const pp = $('reading-play-pause');
    if (pp) pp.textContent = '⏸ Пауза';
    readingContentEl.style.opacity = '1';
    applyReadingFont({
        readingFontFamily: node.readingFontFamily || 'Segoe UI',
        readingFontWeight: node.readingFontWeight || 'normal'
    });
    setupReadingColumns();
    const dCalc = _effectiveDistance(node.readingDistance || 1); // Приоритет измеренной дистанции;
    readingContentEl.style.fontSize =
        acuityToFontSizePx(node.readingAcuity || 1.0, dCalc, PlayerState.screenPPI) + 'px';
    setTimeout(() => {
        PlayerState.readingTotalPages = calcReadingTotalPages();
        PlayerState.readingPage = 0;
        scrollReadingToPage(0);
    }, 80);
    readingToolbarEl.style.display = 'flex';
    PlayerState._readingFinishGuard = false;
    if (PlayerState._readingTimerId) {
        clearTimeout(PlayerState._readingTimerId);
        PlayerState._readingTimerId = null;
    }

    const dur = node.duration || 60000;
    if (dur > 0) {
        PlayerState._readingTimerId = setTimeout(() => {
            PlayerState._readingTimerId = null;
            finishGraphReading(node);
        }, dur);
        PlayerState.phaseTimers.push(PlayerState._readingTimerId);
    }
}

function finishGraphReading(node) {
    if (PlayerState._readingFinishGuard) return;
    PlayerState._readingFinishGuard = true;

    if (PlayerState._readingTimerId) {
        clearTimeout(PlayerState._readingTimerId);
        PlayerState._readingTimerId = null;
    }
    readingToolbarEl.style.display = 'none';
    readingViewportEl.style.display = 'none';
    readingContentEl.innerHTML = '';
    stimDisplay.style.display = '';
    stopReadingDynamicBg();
    PlayerState.gIndex++;
    playNextGraphNode();
}

// ==================== ЗАПУСК ====================
function startPlayer() {
    if (PlayerState.playerRunning) {
        console.warn('[player] уже запущен');
        return;
    }
    // Закрыть status-overlay если открыт
    var _so = document.getElementById('status-overlay');
    if (_so && !_so.classList.contains('hidden')) {
        console.log('[player] закрываю status-overlay');
        _so.classList.add('hidden');
    }
    if (!PlayerState.userScenario) {
        alert('Сценарий не назначен');
        return;
    }
    if (!validateScenario(PlayerState.userScenario)) {
        alert('Сценарий повреждён или содержит некорректные данные.');
        return;
    }
    PlayerState.sessionId =
        window.crypto && typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    const p = PlayerState.userScenario.params || {};
    PlayerState.playerRunning = true;
    window._fastLeanAt = 0;
    window._deviationHistory = [];
    window._distEMA = null; // EMA-фильтр дистанции
    window._reactionLog = []; // Логирование реакций
    window._baselineWaitStart = null; // baseline
    // Восстановить PlayerState.focalLengthPx если потерян
    if (!PlayerState.focalLengthPx || PlayerState.focalLengthPx <= 0) {
        var _lsF2 = parseFloat(localStorage.getItem('PlayerState.focalLengthPx') || '0');
        if (_lsF2 > 0) PlayerState.focalLengthPx = _lsF2;
    }
    // Жёсткий сброс состояния графа
    PlayerState.graphActive = false;
    PlayerState.gNodes = [];
    PlayerState.gConnections = [];
    PlayerState.gQueue = [];
    PlayerState.gIndex = 0;
    PlayerState.gCurrentNodeId = null;
    PlayerState.gCurrentCompareNode = null;
    window._invalidAnswerCount = 0;
    if (window._reactionTimes) window._reactionTimes = [];
    console.log('[graph] state reset');
    PlayerState.isPaused = false;
    PlayerState.completedSeries = PlayerState.successfulSeries = PlayerState.failedSeries = 0;
    PlayerState.seriesCorrect = PlayerState.seriesIncorrect = PlayerState.seriesNoAnswer = 0;
    PlayerState.seriesStep = 0;
    PlayerState.noAnswerSeriesStreak = 0;
    PlayerState.lastDirection = null;
    PlayerState.currentSingleCell = { row: 0, col: 0 };
    PlayerState.screenPPI = p.ppi || PlayerState.screenPPI || 96;
    if (p.minDetectPct && !isNaN(p.minDetectPct)) PlayerState._minDetectPct = parseFloat(p.minDetectPct);
    btnPlayer.disabled = true;
    document.querySelector('.counters')?.style.setProperty('display', 'none');
    btnPlayerStop.disabled = false;
    btnPlayerPause.disabled = false;
    if (window.Voice) window.Voice.sayKey('ready', { cancel: true });

    if (p.graph && Array.isArray(p.graph.nodes) && p.graph.nodes.length > 0) {
        updateCounters();
        startGraphPlay(p.graph.nodes, p.graph.connections || [], p.graph.books || {});
        return;
    }

    if (p.trainingType !== 'reading')
        PlayerState.currentAcuity = Math.max(0.1, Math.min(1.0, p.startAcuity || 0.5));
    else PlayerState.currentAcuity = 1.0;
    PlayerState.currentStimColor = p.startStimColor ? { ...p.startStimColor } : { r: 0, g: 255, b: 0 };
    PlayerState.currentBgColor = p.startBgColor ? { ...p.startBgColor } : { r: 0, g: 0, b: 0 };
    PlayerState.currentDuration = 2550;
    PlayerState.currentSize = acuityToSizePx(
        PlayerState.currentAcuity,
        p.distanceMeters || 1,
        PlayerState.screenPPI
    );
    updateCounters();
    const tt = p.trainingType || 'single';
    if (tt === 'reading') {
        btnPlayerPause.disabled = true;
        startReading();
    } else if (tt === 'compare') {
        PlayerState.compareMode = p.compareMode || 'direction';
        PlayerState.gridX = Math.max(2, Math.min(6, parseInt(p.gridX) || 3));
        PlayerState.gridY = Math.max(1, Math.min(6, parseInt(p.gridY) || 3));
        PlayerState.activeCells = (p.activeCells || []).slice();
        PlayerState.cellParams = (p.cellParams || []).slice();
        if (PlayerState.activeCells.length < 2)
            PlayerState.activeCells = [
                { row: 0, col: 0 },
                { row: 0, col: 1 }
            ];
        while (PlayerState.cellParams.length < PlayerState.activeCells.length)
            PlayerState.cellParams.push(defaultCellParams());
        showNextCompareRound();
    } else showNextStimulus();
}

function showNextStimulus() {
    if (!_checkHardLimit()) {
        setTimeout(showNextStimulus, 500);
        return;
    }
    if (!PlayerState.playerRunning || PlayerState.isPaused) return;
    if (window._faceLostPause) {
        setTimeout(showNextStimulus, 500);
        return;
    } // пауза при потере лица
    if (PlayerState._waitingStable) {
        setTimeout(showNextStimulus, 500);
        return;
    } // отмена при отклонении
    // Ранняя активация фазы ответа
    PlayerState.responsePhaseActive = true;
    PlayerState.responseStartTime = performance.now();
    PlayerState.lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    const p = PlayerState.userScenario?.params || {};
    if (PlayerState.seriesStep >= (p.seriesSize || 6)) {
        finishSeries();
        return;
    }
    let dir;
    if (p.isActive) {
        const d = ['вверх', 'вниз', 'влево', 'вправо'];
        do {
            dir = d[Math.floor(Math.random() * d.length)];
        } while (dir === PlayerState.lastDirection);
    } else dir = 'вверх';
    PlayerState.lastDirection = dir;
    PlayerState.currentCorrectDirection = dir;
    // Включить фазу и таймер до рендера
    const dCalc = _effectiveDistance(p.distanceMeters || 1); // Приоритет измеренной дистанции;
    const eff = acuityToSizePx(PlayerState.currentAcuity, dCalc, PlayerState.screenPPI);
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
        PlayerState.responseStartTime = performance.now(); // метка начала после рендера (single)
    } else displayStimulus(svgData.html, PlayerState.currentBgColor);
    PlayerState.responseStartTime = performance.now(); // метка начала после рендера (single)
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
    let sd = PlayerState.currentDuration + (p.response != null ? p.response : 0); // Полная серия без ответов → пауза
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
        if (PlayerState.lastResponse.answered) {
            if (PlayerState.lastResponse.isCorrect) PlayerState.seriesCorrect++;
            else PlayerState.seriesIncorrect++;
            PlayerState.seriesStep++; // Только ответы считаются
        } else {
            PlayerState.seriesNoAnswer++;
            if (window.Voice) window.Voice.sayKey('timeout', { cancel: true });
            saveResult('user_single', null, false);
            // Таймаут не увеличивает seriesStep
            // Полная серия без ответов → пауза
            if (PlayerState.seriesStep === 0 && PlayerState.seriesNoAnswer >= (p.seriesSize || 6)) {
                console.log('[pause] полная серия без ответов, пауза');
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
    const p = PlayerState.userScenario?.params || {};
    const th = p.seriesThreshold || getThreshold(p.seriesSize || 6);
    const ok = PlayerState.seriesCorrect >= th;
    if (PlayerState.seriesNoAnswer === (p.seriesSize || 6)) PlayerState.noAnswerSeriesStreak++;
    else PlayerState.noAnswerSeriesStreak = 0;
    PlayerState.completedSeries++;
    if (ok) PlayerState.successfulSeries++;
    else PlayerState.failedSeries++;
    // Адаптивная острота зрения
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
    PlayerState.currentSize = acuityToSizePx(
        PlayerState.currentAcuity,
        p.distanceMeters || 1,
        PlayerState.screenPPI
    );
    PlayerState.seriesCorrect =
        PlayerState.seriesIncorrect =
        PlayerState.seriesNoAnswer =
        PlayerState.seriesStep =
            0;
    PlayerState.lastDirection = null;
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
    const d = PlayerState.userScenario?.params?.distanceMeters || 1;
    const ppi = PlayerState.userScenario?.params?.ppi || PlayerState.screenPPI || 96;
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
    const p = PlayerState.userScenario?.params || {};
    if (PlayerState.seriesStep >= (p.seriesSize || 6)) {
        finishCompareSeries();
        return;
    }
    removeSingleGridLines();
    stimDisplay.innerHTML = '';
    stimArea.style.background = '#000';
    if (PlayerState.compareMode === 'direction') showDirectionComparison();
    else if (PlayerState.compareMode === 'find_same') showFindSameComparison();
    const dur = PlayerState.cellParams[0]?.duration || p.duration || PlayerState.currentDuration;
    PlayerState.currentShowTimer = setTimeout(() => {
        if (PlayerState.responsePhaseActive) {
            PlayerState.lastResponse = { answered: false, isCorrect: false };
            // Таймаут → seriesNoAnswer, не seriesIncorrect
            PlayerState.seriesNoAnswer++;
            updateCounters();
            saveResult('user_compare', null, false);
            const _p31 = PlayerState.userScenario?.params || {};
            if (PlayerState.seriesStep >= (_p31.seriesSize || 6)) {
                finishCompareSeries();
            } else {
                PlayerState.phaseTimers.push(
                    setTimeout(() => {
                        if (PlayerState.playerRunning && !PlayerState.isPaused) showNextCompareRound();
                    }, _p31.delay2 || 1000)
                );
            }
        }
    }, dur);
    PlayerState.phaseTimers.push(PlayerState.currentShowTimer);
}
function showDirectionComparison() {
    if (PlayerState.activeCells.length < 2) return;
    const sh = PlayerState.activeCells.slice().sort(() => Math.random() - 0.5);
    const cA = sh[0],
        cB = sh[1];
    const d1 = randomDirection(),
        d2 = randomDirection();
    PlayerState.currentCompareAnswer = d1 === d2;
    createCellElement(cA, PlayerState.cellParams[0] || defaultCellParams(), d1, 0);
    createCellElement(cB, PlayerState.cellParams[1] || defaultCellParams(), d2, 1);
    document.querySelectorAll('.btn-resp[data-dir]').forEach((b) => (b.style.display = 'none'));
    document.querySelectorAll('.btn-resp[data-answer]').forEach((b) => (b.style.display = 'flex'));
    responseButtons.style.display = 'flex';
}
function showFindSameComparison() {
    const p = PlayerState.userScenario?.params || {};
    const pc = Math.max(1, Math.min(20, parseInt(p.pairsCount || 2)));
    const need = pc * 2;
    const usePc = PlayerState.activeCells.length < need ? Math.floor(PlayerState.activeCells.length / 2) : pc;
    if (usePc < 1) {
        processCompareAnswer(false);
        return;
    }
    showFindSameComparisonInternal(usePc);
}
function showFindSameComparisonInternal(pc) {
    const need = pc * 2;
    const sh = PlayerState.activeCells.slice().sort(() => Math.random() - 0.5);
    const chosen = sh.slice(0, need);
    const pairs = [];
    for (let i = 0; i < pc; i++)
        pairs.push({ cells: [chosen[i * 2], chosen[i * 2 + 1]], direction: randomDirection(), found: false });
    _findSameState = { pairs, firstSelectedIdx: null, foundCells: new Set(), cells: chosen, pairsCount: pc };
    chosen.forEach((cell, idx) => {
        const pi = Math.floor(idx / 2);
        const dir = pairs[pi].direction;
        const params =
            PlayerState.cellParams[idx] ||
            PlayerState.cellParams[PlayerState.cellParams.length - 1] ||
            defaultCellParams();
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
        VissortCore.flashCell(idx, 'selected');
        return;
    }
    const fi = st.firstSelectedIdx;
    if (fi === idx) {
        st.firstSelectedIdx = null;
        VissortCore.flashCell(idx, 'unselect');
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
        VissortCore.flashCell(fi, 'found');
        VissortCore.flashCell(idx, 'found');
        st.firstSelectedIdx = null;
        if (st.pairs.every((p) => p.found)) {
            PlayerState.lastResponse = {
                answered: true,
                isCorrect: true,
                reactionTimeMs: Math.max(
                    0,
                    performance.now() - (PlayerState.responseStartTime || performance.now())
                )
            };
            PlayerState.responsePhaseActive = false;
            processCompareAnswer(true);
        }
    } else {
        VissortCore.flashCell(fi, 'unselect');
        VissortCore.flashCell(idx, 'wrong');
        st.firstSelectedIdx = null;
    }
}
// flashCell — в vissort-core.js
function createCellElement(cell, params, direction, idx) {
    const cw = stimDisplay.offsetWidth / PlayerState.gridX,
        ch = stimDisplay.offsetHeight / PlayerState.gridY;
    const el = document.createElement('div');
    el.className = 'grid-cell';
    el.style.cssText = `left:${cell.col * cw}px;top:${cell.row * ch}px;width:${cw}px;height:${ch}px;display:flex;align-items:center;justify-content:center;background:rgb(${params.bgR || 0},${params.bgG || 0},${params.bgB || 0});position:absolute;box-sizing:border-box;border:3px solid transparent;`;
    el.dataset.index = idx !== undefined ? idx : PlayerState.activeCells.indexOf(cell);
    const size = params.size || PlayerState.currentSize;
    const p = PlayerState.userScenario?.params || {};
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
    const p = PlayerState.userScenario?.params || {};
    if (isCorrect) PlayerState.seriesCorrect++;
    else PlayerState.seriesIncorrect++;
    PlayerState.seriesStep++;
    updateCounters();
    saveResult('user_compare', PlayerState.lastResponse.reactionTimeMs, isCorrect);
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
    const p = PlayerState.userScenario?.params || {};
    const th = p.seriesThreshold || getThreshold(p.seriesSize || 6);
    const ok = PlayerState.seriesCorrect >= th;
    PlayerState.completedSeries++;
    if (ok) PlayerState.successfulSeries++;
    else PlayerState.failedSeries++;
    PlayerState.seriesCorrect =
        PlayerState.seriesIncorrect =
        PlayerState.seriesNoAnswer =
        PlayerState.seriesStep =
            0;
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
    if (PlayerState._answerBlocked) return; // Блокировка ответов при заморозке
    // Проверка отклонения перед ответом
    var _inv32 = window._isAnswerInvalid ? window._isAnswerInvalid() : null;
    if (_inv32) {
        PlayerState.lastResponse = {
            answered: true,
            isCorrect: false,
            reactionTimeMs: Math.max(
                0,
                performance.now() - (PlayerState.responseStartTime || performance.now())
            ),
            invalidReason: _inv32
        };
        if (window._logAnswer)
            window._logAnswer({
                rt: PlayerState.lastResponse.reactionTimeMs,
                valid: false,
                correct: false,
                reason: PlayerState.lastResponse.invalidReason || 'unknown'
            });
        PlayerState.responsePhaseActive = false;
        if (window._markAnswerInvalid) window._markAnswerInvalid(_inv32);
        if (window.Voice) window.Voice.sayKey('wrong', { cancel: true });
        document.body.style.background = '#78350f';
        setTimeout(function () {
            document.body.style.background = '#0b0b0f';
        }, 300);
        return;
    }

    const ok = direction === PlayerState.currentCorrectDirection;

    // Очистка таймера и DOM сразу после ответа
    if (PlayerState.currentShowTimer) {
        clearTimeout(PlayerState.currentShowTimer);
        PlayerState.currentShowTimer = null;
    }
    if (PlayerState.phaseTimers && PlayerState.phaseTimers.length) {
        PlayerState.phaseTimers.forEach(function (t) {
            clearTimeout(t);
        });
        PlayerState.phaseTimers = [];
    }
    try {
        var _el34 = document.getElementById('stim');
        if (_el34) _el34.innerHTML = '';
    } catch (e) {}
    try {
        var _ar34 = document.getElementById('stim-display');
        if (_ar34) _ar34.style.backgroundColor = '';
    } catch (e) {}
    try {
        stopSingleStimAnimation();
    } catch (e) {}
    try {
        stopSingleBgAnimation();
    } catch (e) {}
    try {
        stopCircleAnimation();
    } catch (e) {}
    try {
        stopPeripheralAnimation();
    } catch (e) {}
    try {
        stopBlinkAnimation();
    } catch (e) {}
    PlayerState.lastResponse = {
        answered: true,
        isCorrect: ok,
        reactionTimeMs: Math.max(0, performance.now() - (PlayerState.responseStartTime || performance.now()))
    };
    if (window._logAnswer)
        window._logAnswer({
            rt: PlayerState.lastResponse.reactionTimeMs,
            valid: true,
            correct: ok,
            direction:
                typeof direction !== 'undefined'
                    ? direction
                    : typeof dir !== 'undefined'
                      ? dir
                      : typeof answer !== 'undefined'
                        ? String(answer)
                        : null
        });
    PlayerState.responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(() => {
        document.body.style.background = '#0b0b0f';
    }, 200);
    saveResult('user_single', PlayerState.lastResponse.reactionTimeMs, ok);
}
function handleCompareAnswer(answer) {
    if (!PlayerState.responsePhaseActive) return;
    if (PlayerState._answerBlocked) return; // Блокировка ответов при заморозке
    // Проверка отклонения перед ответом
    var _inv32 = window._isAnswerInvalid ? window._isAnswerInvalid() : null;
    if (_inv32) {
        PlayerState.lastResponse = {
            answered: true,
            isCorrect: false,
            reactionTimeMs: Math.max(
                0,
                performance.now() - (PlayerState.responseStartTime || performance.now())
            ),
            invalidReason: _inv32
        };
        if (window._logAnswer)
            window._logAnswer({
                rt: PlayerState.lastResponse.reactionTimeMs,
                valid: false,
                correct: false,
                reason: PlayerState.lastResponse.invalidReason || 'unknown'
            });
        PlayerState.responsePhaseActive = false;
        if (window._markAnswerInvalid) window._markAnswerInvalid(_inv32);
        if (window.Voice) window.Voice.sayKey('wrong', { cancel: true });
        document.body.style.background = '#78350f';
        setTimeout(function () {
            document.body.style.background = '#0b0b0f';
        }, 300);
        return;
    }

    const ok = answer === PlayerState.currentCompareAnswer;

    // Очистка таймера и DOM сразу после ответа
    if (PlayerState.currentShowTimer) {
        clearTimeout(PlayerState.currentShowTimer);
        PlayerState.currentShowTimer = null;
    }
    if (PlayerState.phaseTimers && PlayerState.phaseTimers.length) {
        PlayerState.phaseTimers.forEach(function (t) {
            clearTimeout(t);
        });
        PlayerState.phaseTimers = [];
    }
    try {
        var _el34 = document.getElementById('stim');
        if (_el34) _el34.innerHTML = '';
    } catch (e) {}
    try {
        var _ar34 = document.getElementById('stim-display');
        if (_ar34) _ar34.style.backgroundColor = '';
    } catch (e) {}
    try {
        stopSingleStimAnimation();
    } catch (e) {}
    try {
        stopSingleBgAnimation();
    } catch (e) {}
    try {
        stopCircleAnimation();
    } catch (e) {}
    try {
        stopPeripheralAnimation();
    } catch (e) {}
    try {
        stopBlinkAnimation();
    } catch (e) {}
    PlayerState.lastResponse = {
        answered: true,
        isCorrect: ok,
        reactionTimeMs: Math.max(0, performance.now() - (PlayerState.responseStartTime || performance.now()))
    };
    if (window._logAnswer)
        window._logAnswer({
            rt: PlayerState.lastResponse.reactionTimeMs,
            valid: true,
            correct: ok,
            direction:
                typeof direction !== 'undefined'
                    ? direction
                    : typeof dir !== 'undefined'
                      ? dir
                      : typeof answer !== 'undefined'
                        ? String(answer)
                        : null
        });
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
        if (PlayerState.graphActive) handleGraphDirectionAnswer(btn.dataset.dir);
        else handleDirectionAnswer(btn.dataset.dir);
    } else if (btn.dataset.answer === 'да' || btn.dataset.answer === 'нет') {
        // Проверка узла сравнения, а не graphActive
        const inCmp =
            PlayerState.compareMode === 'direction' &&
            ((!PlayerState.graphActive && PlayerState.userScenario?.params?.trainingType === 'compare') ||
                (PlayerState.graphActive &&
                    PlayerState.gCurrentCompareNode != null &&
                    PlayerState.gCurrentCompareNode.compareMode === 'direction'));
        if (inCmp) {
            const val = btn.dataset.answer === 'да';
            if (PlayerState.graphActive) handleGraphCompareAnswer(val);
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
    // В режиме сравнения игнорировать Up/Down, только Left/Right = Да/Нет
    if (
        ((PlayerState.graphActive && PlayerState.gCurrentCompareNode) ||
            (!PlayerState.graphActive && PlayerState.userScenario?.params?.trainingType === 'compare')) &&
        PlayerState.compareMode === 'direction' &&
        e.key !== 'ArrowLeft' &&
        e.key !== 'ArrowRight'
    )
        return;
    const map = { ArrowUp: 'вверх', ArrowDown: 'вниз', ArrowLeft: 'влево', ArrowRight: 'вправо' };
    if (map[e.key]) {
        e.preventDefault();
        // Проверка узла сравнения, а не graphActive
        const inCmp =
            PlayerState.compareMode === 'direction' &&
            ((!PlayerState.graphActive && PlayerState.userScenario?.params?.trainingType === 'compare') ||
                (PlayerState.graphActive &&
                    PlayerState.gCurrentCompareNode != null &&
                    PlayerState.gCurrentCompareNode.compareMode === 'direction'));
        if (inCmp) {
            if (e.key === 'ArrowLeft') {
                PlayerState.graphActive ? handleGraphCompareAnswer(true) : handleCompareAnswer(true);
            } else if (e.key === 'ArrowRight') {
                PlayerState.graphActive ? handleGraphCompareAnswer(false) : handleCompareAnswer(false);
            }
        } else {
            if (PlayerState.graphActive) handleGraphDirectionAnswer(map[e.key]);
            else handleDirectionAnswer(map[e.key]);
        }
    }
});

// ==================== ЧТЕНИЕ (плоский режим) ====================
function startReading() {
    const p = PlayerState.userScenario?.params || {};
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
    PlayerState.readingPaused = false;
    const pp = $('reading-play-pause');
    if (pp) pp.textContent = '⏸ Пауза';
    readingContentEl.style.opacity = '1';
    applyReadingFont(p);
    setupReadingColumns();
    const dCalc = _effectiveDistance(p.readingDistance || 1); // Приоритет измеренной дистанции;
    readingContentEl.style.fontSize =
        acuityToFontSizePx(PlayerState.currentAcuity, dCalc, PlayerState.screenPPI) + 'px';
    setTimeout(() => {
        PlayerState.readingTotalPages = calcReadingTotalPages();
        PlayerState.readingPage = 0;
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
    PlayerState.readingTotalPages = calcReadingTotalPages();
    PlayerState.readingPage = Math.max(0, Math.min(page, PlayerState.readingTotalPages - 1));
    readingViewportEl.scrollLeft = PlayerState.readingPage * readingViewportEl.clientWidth;
    const info = $('reading-page-info');
    if (info) info.textContent = `Стр. ${PlayerState.readingPage + 1} / ${PlayerState.readingTotalPages}`;
}
function prevReadingPage() {
    if (PlayerState.readingPage > 0) scrollReadingToPage(PlayerState.readingPage - 1);
}
function nextReadingPage() {
    if (PlayerState.readingPage < PlayerState.readingTotalPages - 1)
        scrollReadingToPage(PlayerState.readingPage + 1);
}
function toggleReadingPause() {
    PlayerState.readingPaused = !PlayerState.readingPaused;
    const b = $('reading-play-pause');
    if (PlayerState.readingPaused) {
        readingContentEl.style.opacity = '0';
        if (b) b.textContent = '▶ Чтение';
    } else {
        readingContentEl.style.opacity = '1';
        if (b) b.textContent = '⏸ Пауза';
    }
}
function applyReadingBackground(p) {
    window.PlayerReading.applyBackground(p, readingViewportEl);
}
function startReadingDynamicBg(p) {
    window.PlayerReading.startDynamicBg(p, readingViewportEl, () => PlayerState.readingPaused);
}
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
    const p = PlayerState.userScenario?.params || {};
    let txt = `Серий: ${PlayerState.completedSeries} · Успешных: ${PlayerState.successfulSeries} · Неуспешных: ${PlayerState.failedSeries}`;
    if (p.trainingType !== 'reading' && !PlayerState.graphActive)
        txt += ` · Итоговая V: ${PlayerState.currentAcuity.toFixed(1)}`;
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
    if (PlayerState.graphActive) {
        const node = gGetNode(PlayerState.gCurrentNodeId);
        if (node) {
            if (node.nodeType === 'COMPARE') playGraphCompareRound(node);
            else if (node.nodeType === 'READING') {
            } else playGraphStimulus(node);
            return;
        }
        playNextGraphNode();
        return;
    }
    const p = PlayerState.userScenario?.params || {};
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
    document.querySelector('.counters')?.style.setProperty('display', 'inline-flex');
    btnPlayerStop.disabled = true;
    btnPlayerPause.disabled = true;
    document.body.style.background = '#0b0b0f';
    pauseModal.classList.remove('open');
    PlayerState.camBaseline = null;
    PlayerState._stimulusDistance = null;
    PlayerState._waitingStable = false; // ожидание стабилизации
    PlayerState._stableSince = 0;
    PlayerState._stableBuf = [];
    PlayerState._stimulusDistance = null; // PATCH_CLEAN
    PlayerState.camWarnKind = null;
    window._fastLeanAt = 0;
    window._deviationHistory = [];
    window._distEMA = null; // EMA-фильтр дистанции
    window._reactionLog = []; // Логирование реакций
    window._baselineWaitStart = null; // baseline
    window._invalidAnswerCount = 0;
    PlayerState.sessionId = null;
    PlayerState._readingFinishGuard = false;
    if (PlayerState._readingTimerId) {
        clearTimeout(PlayerState._readingTimerId);
        PlayerState._readingTimerId = null;
    }
    PlayerState.graphActive = false;
    PlayerState.gCurrentNodeId = null;
    PlayerState.gCurrentCompareNode = null;
    PlayerState.gQueue = [];
    PlayerState.gIndex = 0;
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
    if (!PlayerState.supabaseClient || !PlayerState.currentUser || !PlayerState.sessionId) return;
    try {
        await PlayerState.supabaseClient.from('test_results').insert({
            user_id: PlayerState.currentUser.id,
            session_id: PlayerState.sessionId,
            node_id: nodeId || 'user_training',
            response_time_ms: reactionTimeMs != null ? Math.round(reactionTimeMs) : null,
            is_correct: isCorrect,
            distance_m:
                typeof PlayerState.curDistanceM !== 'undefined' && PlayerState.curDistanceM != null
                    ? PlayerState.curDistanceM
                    : null, // Полная серия без ответов → пауза
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
                if (PlayerState.responsePhaseActive && !PlayerState.isPaused)
                    window.Voice.sayKey('countdown5');
            }, durationMs - 5000)
        );
    [3, 2, 1].forEach((s) => {
        const at = durationMs - s * 1000;
        if (at > 0)
            timers.push(
                setTimeout(() => {
                    if (PlayerState.responsePhaseActive && !PlayerState.isPaused)
                        window.Voice.sayKey('countdown' + s);
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
    // Регистрация callbacks для плеера-камеры
    if (window.PlayerCamera && typeof window.PlayerCamera.setCallbacks === 'function') {
        window.PlayerCamera.setCallbacks({
            onStimulusHide: hideStimulus,
            onAbortStimulus: (reason) => _abortCurrentStimulus(reason),
            onResume: () => _resumeAfterStable(),
            onRecalcSize: () => _recalcStimulusSize()
        });
        if (window.PlayerAnimation && typeof window.PlayerAnimation.setCallbacks === 'function') {
            window.PlayerAnimation.setCallbacks({
                onSetStimColor: setStimColorRGB
            });
            if (
                window.PlayerInvalidDetection &&
                typeof window.PlayerInvalidDetection.setCallbacks === 'function'
            ) {
                window.PlayerInvalidDetection.setCallbacks({
                    onHideStimulus: hideStimulus,
                    onPlayGraphStimulus: (node) => playGraphStimulus(node),
                    onPlayGraphCompareRound: (node) => playGraphCompareRound(node),
                    onShowNextStimulus: () => showNextStimulus(),
                    onGetNode: (id) => gGetNode(id)
                });
                console.log('[player-runtime] PlayerInvalidDetection callbacks registered');
            }
            console.log('[player-runtime] PlayerAnimation callbacks registered');
        }
        console.log('[player-runtime] PlayerCamera callbacks registered');
    }
    $('auth-submit').addEventListener('click', doAuth);
    $('auth-toggle').addEventListener('click', () => {
        PlayerState.authMode = PlayerState.authMode === 'signin' ? 'signup' : 'signin';
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
            await PlayerState.supabaseClient.auth.signOut();
        } catch (e) {}
        PlayerState.currentUser = null;
        PlayerState.userScenario = null;
        PlayerState.userScenarios = [];
        hdrUser.textContent = '—';
        hdrScenario.textContent = '—';
        btnPlayer.disabled = true;
        promptLogin();
    });

    if (!btnPlayer.__playerBound) {
        btnPlayer.addEventListener('click', startPlayer);
        btnPlayer.__playerBound = true;
    }
    btnPlayerPause.addEventListener('click', togglePause);
    btnPlayerStop.addEventListener('click', stopPlayer);
    $('pause-continue').addEventListener('click', resumeTraining);
    $('pause-exit').addEventListener('click', () => {
        pauseModal.classList.remove('open');
        stopPlayer();
    });

    hdrScenario.addEventListener('click', () => {
        if (PlayerState.userScenarios.length > 0) openScenarioPicker();
    });
    $('scenario-close').addEventListener('click', () => $('scenario-modal').classList.remove('open'));
    btnHistory.addEventListener('click', openHistory);
    const btnCalibrate = document.getElementById('btn-calibrate');
    if (btnCalibrate) {
        btnCalibrate.addEventListener('click', async () => {
            if (typeof Onboarding === 'undefined' || typeof Onboarding.restart !== 'function') {
                console.warn('[calibrate] Onboarding.restart недоступен');
                return;
            }
            try {
                await Onboarding.restart();
            } catch (e) {
                console.error('[calibrate] restart failed:', e);
            }
        });
    }
    $('history-close').addEventListener('click', () => $('history-modal').classList.remove('open'));

    $('reading-prev').addEventListener('click', prevReadingPage);
    $('reading-next').addEventListener('click', nextReadingPage);
    $('reading-play-pause').addEventListener('click', toggleReadingPause);
    $('reading-finish').addEventListener('click', () => {
        if (PlayerState.graphActive && PlayerState.gCurrentNodeId) {
            const n = gGetNode(PlayerState.gCurrentNodeId);
            finishGraphReading(n);
        } else finishReading();
    });
    $('reading-not-see').addEventListener('click', () => {
        PlayerState.currentAcuity = Math.max(0.1, Math.round((PlayerState.currentAcuity - 0.1) * 10) / 10);
        const d = PlayerState.userScenario?.params?.readingDistance || 1;
        readingContentEl.style.fontSize =
            acuityToFontSizePx(PlayerState.currentAcuity, d, PlayerState.screenPPI) + 'px';
        setTimeout(() => {
            PlayerState.readingTotalPages = calcReadingTotalPages();
            scrollReadingToPage(0);
        }, 60);
    });
    $('reading-see-well').addEventListener('click', () => {
        PlayerState.currentAcuity = Math.min(2.0, Math.round((PlayerState.currentAcuity + 0.1) * 10) / 10);
        const d = PlayerState.userScenario?.params?.readingDistance || 1;
        readingContentEl.style.fontSize =
            acuityToFontSizePx(PlayerState.currentAcuity, d, PlayerState.screenPPI) + 'px';
        setTimeout(() => {
            PlayerState.readingTotalPages = calcReadingTotalPages();
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
            if (np !== PlayerState.readingPage) {
                PlayerState.readingPage = Math.max(0, Math.min(np, PlayerState.readingTotalPages - 1));
                const info = $('reading-page-info');
                if (info)
                    info.textContent = `Стр. ${PlayerState.readingPage + 1} / ${PlayerState.readingTotalPages}`;
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

// Переключатель превью камеры в углу (P)
(function installCamPreview() {
    if (document.getElementById('btn-cam-preview')) return;
    var style = document.createElement('style');
    style.textContent =
        '#hidden-video.pip-visible{position:fixed !important;right:12px !important;bottom:12px !important;left:auto !important;top:auto !important;width:240px !important;height:180px !important;opacity:1 !important;pointer-events:none !important;border:2px solid #0ea5e9;border-radius:8px;z-index:9998;transform:scaleX(-1);box-shadow:0 6px 20px rgba(0,0,0,0.6);background:#000;}';
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
    btn.addEventListener('click', function () {
        var on = localStorage.getItem(KEY) === '1';
        localStorage.setItem(KEY, on ? '0' : '1');
        apply();
    });
    document.addEventListener('keydown', function (e) {
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

// HUD-оверлей на превью камеры (цвет + текст)
(function installCamHud() {
    function ensure() {
        var v = document.getElementById('hidden-video');
        if (!v) return null;
        var el = document.getElementById('cam-hud');
        if (!el) {
            el = document.createElement('div');
            el.id = 'cam-hud';
            el.style.cssText =
                'position:fixed;right:12px;bottom:196px;width:240px;padding:6px 8px;background:rgba(0,0,0,0.7);color:#fff;font-family:monospace;font-size:12px;border-radius:6px;z-index:9999;text-align:center;pointer-events:none;line-height:1.4;';
            document.body.appendChild(el);
        }
        return el;
    }
    setInterval(function () {
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
        // Определение лица по иконке в cam-indicator
        var hasFace = faceText.indexOf('📏') !== -1 || faceText.indexOf('✅') !== -1; // ✅ или 📏 означают, что лицо найдено
        var dev =
            typeof PlayerState.camBaseline !== 'undefined' &&
            PlayerState.camBaseline &&
            typeof PlayerState.curDistanceM !== 'undefined' &&
            PlayerState.curDistanceM
                ? ((PlayerState.curDistanceM - PlayerState.camBaseline) / PlayerState.camBaseline) * 100
                : null;
        var dist =
            typeof PlayerState.curDistanceM !== 'undefined' && PlayerState.curDistanceM
                ? PlayerState.curDistanceM.toFixed(2)
                : '—';
        var base =
            typeof PlayerState.camBaseline !== 'undefined' && PlayerState.camBaseline
                ? PlayerState.camBaseline.toFixed(2)
                : '—';

        var status, border;
        var faceLostMs =
            typeof window._faceLostSince !== 'undefined' && window._faceLostSince
                ? performance.now() - window._faceLostSince
                : 0;
        if (!hasFace) {
            // HUD: жёлтый при короткой потере (<1.5с), красный при долгой
            if (faceLostMs < 1500) {
                status =
                    '\u26A0\uFE0F \u041B\u0418\u0426\u041E? ' + (dev != null ? dev.toFixed(1) + '%' : '');
                border = '#eab308';
                v.style.animation = '';
            } else {
                status =
                    '\u274C \u041D\u0415\u0422 \u041B\u0418\u0426\u0410' +
                    (dev != null ? ' ' + dev.toFixed(1) + '%' : '');
                border = '#dc2626';
                v.style.animation = 'camBlink 0.6s infinite alternate';
            }
        } else if (dev != null && Math.abs(dev) > 15) {
            status =
                (dev < 0
                    ? '\u26A0\uFE0F \u0411\u041B\u0418\u0417\u041A\u041E '
                    : '\u26A0\uFE0F \u0414\u0410\u041B\u0415\u041A\u041E ') +
                dev.toFixed(1) +
                '%';
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

// Пауза и голос при потере лица >2с
(function installFaceLostPause() {
    function ensureOverlay() {
        var el = document.getElementById('face-lost-overlay');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'face-lost-overlay';
        el.style.cssText =
            'position:fixed;inset:0;background:rgba(11,11,18,0.94);display:none;align-items:center;justify-content:center;z-index:99997;font-family:"Segoe UI",Tahoma,sans-serif;color:#fff;text-align:center;padding:20px;';
        el.innerHTML =
            '<div><div style="font-size:72px;margin-bottom:24px;">&#128100;</div><h2 style="font-size:28px;margin:0 0 12px;font-weight:700;">Вернитесь в кадр</h2><p style="color:#94a3b8;font-size:15px;">Тренировка возобновится автоматически</p></div>';
        document.body.appendChild(el);
        return el;
    }
    setInterval(function () {
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
                console.warn('[face] потеряно >2с — пауза');
                if (window.Voice && window.Voice.sayKey)
                    window.Voice.sayKey('returnToFrame', { cancel: true });
            }
            window._faceLostPause = true;
        } else {
            if (overlay.style.display === 'flex') {
                overlay.style.display = 'none';
                console.log('[face] лицо вернулось — продолжаем');
                if (window.Voice && window.Voice.sayKey) window.Voice.sayKey('faceFound', { cancel: true });
                // После долгой потери лица — ожидание стабилизации (like deviation)
                if (typeof _abortCurrentStimulus === 'function') {
                    try {
                        _abortCurrentStimulus('face_back_after_long_loss');
                    } catch (e) {}
                }
            }
            window._faceLostPause = false;
        }
    }, 300);
})();
