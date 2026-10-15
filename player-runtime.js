'use strict';

// ============================================================
// ============================================================
if (!window.VissortCore) {
    throw new Error(
        '[player] VissortCore not loaded. Include <script src="vissort-core.js"></script> BEFORE player-runtime.js.'
    );
}

// Единая модалка вместо alert (fallback на нативный alert при отсутствии VissortDialog)
function _alert(msg) {
    if (window.VissortDialog && window.VissortDialog.alert) {
        window.VissortDialog.alert(msg);
    } else {
        alert(msg);
    }
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


// Логирование каждого ответа
window._reactionLog = window._reactionLog || [];
window._logAnswer = function (entry) {
    window._reactionLog.push(entry);
    var tag = entry.valid ? '[answer]' : '[invalid]';
    var msg =
        tag + ' rt=' + (entry.rt != null ? Math.round(entry.rt) + 'ms' : 'n/a') + ' correct=' + entry.correct;
    if (entry.direction) msg += ' dir=' + entry.direction;
    if (entry.reason) msg += ' reason=' + entry.reason;
    VLog.log(msg);
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
    VLog.log('Total: ' + log.length + ' | Valid: ' + rts.length);
    if (rts.length)
        VLog.log(
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
window._abortCurrentStimulus = _abortCurrentStimulus;
window._resumeAfterStable = _resumeAfterStable;
window._showInvalidToast = _showInvalidToast;
window._isAnswerInvalid = _isAnswerInvalid;
window._markAnswerInvalid = _markAnswerInvalid;

// ==================== RATE LIMIT + SCENARIO VALIDATION ====================
const checkRateLimit = window.PlayerUtils.checkRateLimit;
const validateScenario = window.PlayerUtils.validateScenario;

const $ = (id) => document.getElementById(id);
// eslint-disable-next-line no-redeclare -- player-runtime.js — отдельный entry; коллизия имён с app.js иллюзорна
const stimDisplay = $('stim');
// eslint-disable-next-line no-redeclare -- player-runtime.js — отдельный entry; коллизия имён с app.js иллюзорна
const stimArea = $('stim-display');
// Экспорт в window для вынесенных модулей (player-animation.js и др.)
window.stimDisplay = stimDisplay;
window.stimArea = stimArea;
const responseButtons = $('response-buttons');
window.responseButtons = responseButtons;
const hdrScenario = $('hdr-scenario');
const hdrUser = $('hdr-user');
const authModal = $('auth-modal');
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
const camIndicator = $('cam-indicator');

function _effectiveDistance(declared) {
    return window.PlayerUtils.effectiveDistance(declared, PlayerState.curDistanceM);
}
window._distEMA = null;
function _smoothDistance(raw) {
    return window.PlayerUtils.smoothDistance(raw);
}

function showStatus(title, text, actionLabel, actionFn) {
    return window.PlayerOverlay.showStatus(title, text, actionLabel, actionFn);
}
function hideStatus() {
    return window.PlayerOverlay.hideStatus();
}

async function onLoggedIn() {
    authModal.classList.remove('open');
    hdrUser.textContent = PlayerState.currentUser.email || '—';
    showStatus('Загрузка сценария…', 'Читаем назначения.');

    // Общий блок: fingerprint + Onboarding + enableCamera (§15.1.2 ч.5/7 — устранение дублирования)
    async function _startOnboardingAndCamera() {
        if (typeof VissortDevice !== 'undefined' && typeof Onboarding !== 'undefined') {
            try {
                const fp = await VissortDevice.getFingerprint();
                VissortDevice.setCurrent(fp, PlayerState.currentUser ? PlayerState.currentUser.id : null);
                await Onboarding.start({
                    client: PlayerState.supabaseClient,
                    userId: PlayerState.currentUser ? PlayerState.currentUser.id : null,
                    onDone: (data) => {
                        if (!data || !data.skipped) enableCamera();
                        else VLog.log('[onboarding] пропущено — камера не запрашивается');
                    }
                });
            } catch (e) {
                VLog.warn('[user] onboarding:', e);
                enableCamera();
            }
        } else {
            enableCamera();
        }
    }
    // ==== Тестовый сценарий из админки (player.html?test=1) ====
    if (location.search.includes('test=1')) {
        try {
            const raw = localStorage.getItem('vissort_test_scenario');
            if (raw) {
                const testData = JSON.parse(raw);
                VLog.log('[test] loading test scenario from localStorage');
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
                        VLog.warn('[test] camera:', e);
                    }
                }
                VLog.log('[test] test scenario loaded, ready to play');
                return;
            } else {
                VLog.warn('[test] no scenario in localStorage');
            }
        } catch (e) {
            VLog.warn('[test] failed:', e);
        }
    }
    // ==== /Тестовый сценарий ====

    PlayerState.userScenarios = await loadUserScenarios();
    if (!PlayerState.userScenarios.length) {
        showStatus('Сценарий не назначен', 'Обратитесь к администратору.', 'Обновить', () => onLoggedIn());
        // Запустить камеру и онбординг даже без сценариев
        await _startOnboardingAndCamera();
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

    await _startOnboardingAndCamera();
}
async function loadUserScenarios() {
    return window.PlayerScenarios.loadUserScenarios(
        PlayerState.supabaseClient,
        PlayerState.currentUser && PlayerState.currentUser.id
    );
}

function openScenarioPicker() {
    window.PlayerScenarios.openPicker(PlayerState.userScenarios, function (s) {
        PlayerState.userScenario = s;
        hdrScenario.textContent = s.name;
        applyScenarioDefaults();
        updateCounters();
        $('scenario-modal').classList.remove('open');
        btnPlayer.disabled = false;
        if (s.params && s.params.cameraCheck) enableCamera();
    });
}

async function openHistory() {
    return window.PlayerScenarios.openHistory(
        PlayerState.supabaseClient,
        PlayerState.currentUser && PlayerState.currentUser.id
    );
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
window.updateCounters = updateCounters;

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
window.removeSingleGridLines = removeSingleGridLines;
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

function displayStimulus(html, bg) { return window.PlayerSingle.displayStimulus(html, bg); }
function hideStimulus() { return window.PlayerSingle.hideStimulus(); }

function _checkHardLimit() {
    return window.PlayerCamera._checkHardLimit();
}
async function enableCamera() {
    return window.PlayerCamera.enableCamera();
}
function disableCamera() {
    return window.PlayerCamera.disableCamera();
}

// ==================== ПЛЕЕР ГРАФА ====================
function gGetNode(id) {
    return window.PlayerGraph.gGetNode(id);
}

function buildGraphQueue() {
    return window.PlayerGraph.buildGraphQueue();
}

function startGraphPlay(nodes, connections, books) {
    return window.PlayerGraph.startGraphPlay(nodes, connections, books);
}

function playNextGraphNode() {
    return window.PlayerGraph.playNextGraphNode();
}

// Авто-пересчёт размера стимула под новую дистанцию.
// Вызывается из player-camera.js при distControlMode='auto'.

function playGraphStimulus(node) {
    return window.PlayerGraph.playGraphStimulus(node);
}

function finishGraphStimulusSeries(node) {
    return window.PlayerGraph.finishGraphStimulusSeries(node);
}

function handleGraphDirectionAnswer(dir) {
    return window.PlayerGraph.handleGraphDirectionAnswer(dir);
}

function playGraphCompare(node) {
    return window.PlayerGraph.playGraphCompare(node);
}

function playGraphCompareRound(node) {
    return window.PlayerGraph.playGraphCompareRound(node);
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
    return window.PlayerGraph.finishGraphCompareSeries(node);
}

function playGraphReading(node) {
    return window.PlayerGraph.playGraphReading(node);
}

function finishGraphReading(node) {
    return window.PlayerGraph.finishGraphReading(node);
}
// ==================== ЗАПУСК ====================
function startPlayer() {
    return window.PlayerSession.startPlayer();
}

function showNextStimulus() { return window.PlayerSingle.showNextStimulus(); }

function finishSeries() { return window.PlayerSingle.finishSeries(); }

function defaultCellParams() { return window.PlayerSingle.defaultCellParams(); }
function showNextCompareRound() { return window.PlayerSingle.showNextCompareRound(); }
function showDirectionComparison() { return window.PlayerSingle.showDirectionComparison(); }
function showFindSameComparison() { return window.PlayerSingle.showFindSameComparison(); }
function showFindSameComparisonInternal(pc) { return window.PlayerSingle.showFindSameComparisonInternal(pc); }
function handleFindSameClick(idx) { return window.PlayerSingle.handleFindSameClick(idx); }
// flashCell — в vissort-core.js
function createCellElement(cell, params, direction, idx) { return window.PlayerSingle.createCellElement(cell, params, direction, idx); }
function processCompareAnswer(isCorrect) { return window.PlayerSingle.processCompareAnswer(isCorrect); }
function finishCompareSeries() { return window.PlayerSingle.finishCompareSeries(); }

// ==================== ОТВЕТЫ (плоский режим) ====================
function handleDirectionAnswer(direction) { return window.PlayerSingle.handleDirectionAnswer(direction); }
function handleCompareAnswer(answer) { return window.PlayerSingle.handleCompareAnswer(answer); }
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

// ==================== ЧТЕНИЕ (обёртки над PlayerReadingMode) ====================
function applyReadingFont(p) { return window.PlayerReadingMode.applyReadingFont(p); }
function setupReadingColumns() { return window.PlayerReadingMode.setupReadingColumns(); }
function calcReadingTotalPages() { return window.PlayerReadingMode.calcReadingTotalPages(); }
function scrollReadingToPage(page) { return window.PlayerReadingMode.scrollReadingToPage(page); }
function prevReadingPage() { return window.PlayerReadingMode.prevReadingPage(); }
function nextReadingPage() { return window.PlayerReadingMode.nextReadingPage(); }
function toggleReadingPause() { return window.PlayerReadingMode.toggleReadingPause(); }
function applyReadingBackground(p) { return window.PlayerReadingMode.applyReadingBackground(p); }
function startReadingDynamicBg(p) { return window.PlayerReadingMode.startReadingDynamicBg(p); }
function stopReadingDynamicBg() { return window.PlayerReadingMode.stopReadingDynamicBg(); }

// ==================== ФИНАЛ / ПАУЗА ====================
function showFinishedReport() {
    return window.PlayerSession.showFinishedReport();
}
function pauseTraining() {
    return window.PlayerSession.pauseTraining();
}
function resumeTraining() {
    return window.PlayerSession.resumeTraining();
}
function stopPlayer() {
    return window.PlayerSession.stopPlayer();
}
function togglePause() {
    return window.PlayerSession.togglePause();
}
async function saveResult(nodeId, reactionTimeMs, isCorrect) {
    return window.PlayerSession.saveResult(nodeId, reactionTimeMs, isCorrect);
}
function scheduleVoiceCountdown(durationMs) {
    return window.PlayerSession.scheduleVoiceCountdown(durationMs);
}

// ==================== INIT ====================
function init() {
    // UI-установщики (камера-превью, HUD, пауза-при-потере-лица) — §15.1.2.
    if (window.PlayerInstallers && typeof window.PlayerInstallers.installAll === 'function') {
        window.PlayerInstallers.installAll();
    }
    // Регистрация callbacks для плеера-камеры
    if (window.PlayerCamera && typeof window.PlayerCamera.setCallbacks === 'function') {
        window.PlayerCamera.setCallbacks({
            onStimulusHide: hideStimulus,
            onAbortStimulus: (reason) => _abortCurrentStimulus(reason),
            onResume: () => _resumeAfterStable(),
            onRecalcSize: () => window.PlayerGraph.recalcStimulusSize()
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
                VLog.log('[player-runtime] PlayerInvalidDetection callbacks registered');
            }
            VLog.log('[player-runtime] PlayerAnimation callbacks registered');
        }
        VLog.log('[player-runtime] PlayerCamera callbacks registered');
    }
    btnLogout.addEventListener('click', async () => {
        try { stopPlayer(); } catch (e) {}
        try { disableCamera(); } catch (e) {}
        await window.PlayerAuth.signOut();
        window.PlayerAuth.promptLogin();
    });

    if (!btnPlayer.__playerBound) {
        btnPlayer.addEventListener('click', startPlayer);
        btnPlayer.__playerBound = true;
    }
    btnPlayerPause.addEventListener('click', togglePause);
    btnPlayerStop.addEventListener('click', stopPlayer);
    $('pause-continue').addEventListener('click', resumeTraining);
    $('pause-exit').addEventListener('click', () => {
        window.PlayerOverlay.hidePause();
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
                VLog.warn('[calibrate] Onboarding.restart недоступен');
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

    $('reading-finish').addEventListener('click', () => {
        if (PlayerState.graphActive && PlayerState.gCurrentNodeId) {
            const n = gGetNode(PlayerState.gCurrentNodeId);
            finishGraphReading(n);
        } else {
            window.PlayerReadingMode.finish();
            PlayerState.completedSeries++;
            PlayerState.successfulSeries++;
            updateCounters();
            stopPlayer();
            showStatus('Чтение завершено', 'Тренировка окончена.', 'Ещё раз', () => {
                hideStatus();
                startPlayer();
            });
        }
    });
    $('reading-not-see').addEventListener('click', () => {
        PlayerState.currentAcuity = Math.max(0.1, Math.round((PlayerState.currentAcuity - 0.1) * 10) / 10);
        const d = PlayerState.userScenario?.params?.readingDistance || 1;
        $('reading-content').style.fontSize =
            acuityToFontSizePx(PlayerState.currentAcuity, d, PlayerState.screenPPI) + 'px';
        setTimeout(() => {
            PlayerState.readingTotalPages = calcReadingTotalPages();
            scrollReadingToPage(0);
        }, 60);
    });
    $('reading-see-well').addEventListener('click', () => {
        PlayerState.currentAcuity = Math.min(2.0, Math.round((PlayerState.currentAcuity + 0.1) * 10) / 10);
        const d = PlayerState.userScenario?.params?.readingDistance || 1;
        $('reading-content').style.fontSize =
            acuityToFontSizePx(PlayerState.currentAcuity, d, PlayerState.screenPPI) + 'px';
        setTimeout(() => {
            PlayerState.readingTotalPages = calcReadingTotalPages();
            scrollReadingToPage(0);
        }, 60);
    });

    // Регистрация обработчиков режима чтения (§15.1.2 ч.3/7 X)
    if (window.PlayerReadingMode && typeof window.PlayerReadingMode.initEvents === 'function') {
        window.PlayerReadingMode.initEvents({});
    }

    // Граф — §15.1.2 ч.6/7
    if (window.PlayerGraph && typeof window.PlayerGraph.setCallbacks === 'function') {
        window.PlayerGraph.setCallbacks({
            stopPlayer: stopPlayer,
            startPlayer: startPlayer,
            showStatus: showStatus,
            hideStatus: hideStatus,
            updateCounters: updateCounters,
            hideStimulus: hideStimulus,
            playGraphStimulus: playGraphStimulus,
            playGraphCompare: playGraphCompare,
            playGraphReading: playGraphReading,
            pauseTraining: pauseTraining,
            defaultCellParams: defaultCellParams,
            removeSingleGridLines: removeSingleGridLines,
            showDirectionComparison: showDirectionComparison,
            showFindSameComparison: showFindSameComparison,
            finishGraphCompareSeries: finishGraphCompareSeries,
            saveResult: saveResult,
            stopSingleStimAnimation: stopSingleStimAnimation,
            stopSingleBgAnimation: stopSingleBgAnimation,
            stopCircleAnimation: stopCircleAnimation,
            stopPeripheralAnimation: stopPeripheralAnimation,
            stopBlinkAnimation: stopBlinkAnimation,
            _effectiveDistance: _effectiveDistance,
            displayStimulus: displayStimulus,
            buildDefocusFrame: buildDefocusFrame,
            pickSingleGridCell: pickSingleGridCell,
            applySingleGridPosition: applySingleGridPosition,
            applyRandomStimulusPosition: applyRandomStimulusPosition,
            buildPeripheralDots: buildPeripheralDots,
            startSingleStimAnimation: startSingleStimAnimation,
            startSingleBgAnimation: startSingleBgAnimation,
            startCircleAnimation: startCircleAnimation,
            startBlinkAnimation: startBlinkAnimation,
            scheduleVoiceCountdown: scheduleVoiceCountdown
        });
    }

    // Session — §15.1.2 ч.7/7
    if (window.PlayerSession && typeof window.PlayerSession.setCallbacks === 'function') {
        window.PlayerSession.setCallbacks({
            showStatus: showStatus,
            hideStatus: hideStatus,
            stopSingleStimAnimation: stopSingleStimAnimation,
            stopSingleBgAnimation: stopSingleBgAnimation,
            stopCircleAnimation: stopCircleAnimation,
            stopPeripheralAnimation: stopPeripheralAnimation,
            stopBlinkAnimation: stopBlinkAnimation,
            hideStimulus: hideStimulus,
            startPlayer: startPlayer,
            checkRateLimit: checkRateLimit,
            showNextCompareRound: showNextCompareRound,
            showNextStimulus: showNextStimulus,
            validateScenario: validateScenario,
            onError: function (msg) { _alert(msg); },
            updateCounters: updateCounters,
            defaultCellParams: defaultCellParams
        });
    }


    loadSivtsevFont();
    // Аутентификация — §15.1.2 ч.4/7 (PlayerAuth)
    if (window.PlayerAuth && typeof window.PlayerAuth.init === 'function') {
        window.PlayerAuth.init({
            onLoggedIn: onLoggedIn,
            onTestMode: function () { onLoggedIn(); },
            onSignOut: function () {
                var _hu = $('hdr-user');
                if (_hu) _hu.textContent = '—';
                var _hs = $('hdr-scenario');
                if (_hs) _hs.textContent = '—';
                var _bp = $('btn-player');
                if (_bp) _bp.disabled = true;
            },
            onError: function (msg) { _alert(msg); }
        });
    }
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
        VLog.warn('Sivtsev:', e);
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

