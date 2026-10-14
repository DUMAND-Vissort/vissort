// player-session.js — lifecycle плеера (§15.1.2 ч.7/7).
// Зависит: VLog, PlayerState, PlayerOverlay, PlayerReadingMode, PlayerGraph, Voice.
(function (global) {
    'use strict';

    function _el(id) { return document.getElementById(id); }
    function _PS() { return global.PlayerState; }

    var _callbacks = {
        showStatus: function () {},
        hideStatus: function () {},
        stopSingleStimAnimation: function () {},
        stopSingleBgAnimation: function () {},
        stopCircleAnimation: function () {},
        stopPeripheralAnimation: function () {},
        stopBlinkAnimation: function () {},
        hideStimulus: function () {},
        startPlayer: function () {},
        checkRateLimit: function () { return true; },
        showNextCompareRound: function () {},
        showNextStimulus: function () {},
        validateScenario: function () { return true; },
        onError: function (msg) { alert(msg); },
        updateCounters: function () {},
        defaultCellParams: function () { return { row: 0, col: 0, size: 1, duration: 1000 }; }
    };

    function setCallbacks(cb) {
        _callbacks = Object.assign({}, _callbacks, cb || {});
    }

    // ==================== Пауза / Возобновление ====================
    function pauseTraining() {
        var PS = _PS();
        PS.phaseTimers.forEach(function (t) { clearTimeout(t); });
        PS.phaseTimers = [];
        if (PS.currentShowTimer) clearTimeout(PS.currentShowTimer);
        _callbacks.stopSingleStimAnimation();
        _callbacks.stopSingleBgAnimation();
        _callbacks.stopCircleAnimation();
        _callbacks.stopPeripheralAnimation();
        _callbacks.stopBlinkAnimation();
        PS.responsePhaseActive = false;
        _callbacks.hideStimulus();
        var rb = _el('response-buttons');
        if (rb) rb.style.display = 'none';
        PS.isPaused = true;
        var bp = _el('btn-player-pause');
        if (bp) bp.disabled = true;
        if (global.PlayerOverlay && global.PlayerOverlay.showPause) global.PlayerOverlay.showPause();
    }

    function resumeTraining() {
        var PS = _PS();
        if (global.PlayerOverlay && global.PlayerOverlay.hidePause) global.PlayerOverlay.hidePause();
        PS.isPaused = false;
        PS.noAnswerSeriesStreak = 0;
        var bp = _el('btn-player-pause');
        if (bp) bp.disabled = false;
        if (PS.graphActive) {
            var node = global.PlayerGraph.gGetNode(PS.gCurrentNodeId);
            if (node) {
                if (node.nodeType === 'COMPARE') global.PlayerGraph.playGraphCompareRound(node);
                else if (node.nodeType === 'READING') { /* ничего */ }
                else global.PlayerGraph.playGraphStimulus(node);
                return;
            }
            global.PlayerGraph.playNextGraphNode();
            return;
        }
        var p = (PS.userScenario && PS.userScenario.params) || {};
        if (p.trainingType === 'compare') _callbacks.showNextCompareRound();
        else if (p.trainingType === 'reading') { /* ничего */ }
        else _callbacks.showNextStimulus();
    }

    function togglePause() {
        var PS = _PS();
        if (!PS.playerRunning) return;
        if (PS.isPaused) { resumeTraining(); return; }
        PS.isPaused = true;
        PS.phaseTimers.forEach(function (t) { clearTimeout(t); });
        PS.phaseTimers = [];
        if (PS.currentShowTimer) clearTimeout(PS.currentShowTimer);
        _callbacks.stopSingleStimAnimation();
        _callbacks.stopSingleBgAnimation();
        _callbacks.stopCircleAnimation();
        _callbacks.stopPeripheralAnimation();
        _callbacks.stopBlinkAnimation();
        _callbacks.hideStimulus();
        var rb = _el('response-buttons');
        if (rb) rb.style.display = 'none';
        if (global.PlayerOverlay && global.PlayerOverlay.showPause) global.PlayerOverlay.showPause();
    }

    // ==================== Stop ====================
    function stopPlayer() {
        var PS = _PS();
        PS.phaseTimers.forEach(function (t) { clearTimeout(t); });
        PS.phaseTimers = [];
        if (PS.currentShowTimer) clearTimeout(PS.currentShowTimer);
        _callbacks.stopSingleStimAnimation();
        _callbacks.stopSingleBgAnimation();
        _callbacks.stopCircleAnimation();
        _callbacks.stopPeripheralAnimation();
        _callbacks.stopBlinkAnimation();
        if (global.Voice && global.Voice.stopReading) global.Voice.stopReading();
        PS.playerRunning = false;
        PS.isPaused = false;
        PS.responsePhaseActive = false;
        _callbacks.hideStimulus();
        var rb = _el('response-buttons');
        if (rb) rb.style.display = 'none';
        if (global.PlayerReadingMode && global.PlayerReadingMode.hideDOM) global.PlayerReadingMode.hideDOM();
        var bplay = _el('btn-player');
        if (bplay) bplay.disabled = false;
        var counters = document.querySelector('.counters');
        if (counters) counters.style.setProperty('display', 'inline-flex');
        var bstop = _el('btn-player-stop');
        if (bstop) bstop.disabled = true;
        var bpause = _el('btn-player-pause');
        if (bpause) bpause.disabled = true;
        document.body.style.background = '#0b0b0f';
        if (global.PlayerOverlay && global.PlayerOverlay.hidePause) global.PlayerOverlay.hidePause();
        PS.camBaseline = null;
        PS._stimulusDistance = null;
        PS._waitingStable = false;
        PS._stableSince = 0;
        PS._stableBuf = [];
        PS._stimulusDistance = null;
        PS.camWarnKind = null;
        global._fastLeanAt = 0;
        global._deviationHistory = [];
        global._distEMA = null;
        global._reactionLog = [];
        global._baselineWaitStart = null;
        global._invalidAnswerCount = 0;
        PS.sessionId = null;
        PS._readingFinishGuard = false;
        if (PS._readingTimerId) {
            clearTimeout(PS._readingTimerId);
            PS._readingTimerId = null;
        }
        PS.graphActive = false;
        PS.gCurrentNodeId = null;
        PS.gCurrentCompareNode = null;
        PS.gQueue = [];
        PS.gIndex = 0;
    }

    // ==================== Отчёт ====================
    function showFinishedReport() {
        var PS = _PS();
        var p = (PS.userScenario && PS.userScenario.params) || {};
        var txt = 'Серий: ' + PS.completedSeries + ' · Успешных: ' + PS.successfulSeries + ' · Неуспешных: ' + PS.failedSeries;
        if (p.trainingType !== 'reading' && !PS.graphActive)
            txt += ' · Итоговая V: ' + PS.currentAcuity.toFixed(1);
        _callbacks.showStatus('Готово!', txt, 'Ещё раз', function () {
            _callbacks.hideStatus();
            _callbacks.startPlayer();
        });
    }

    // ==================== Save result ====================
    async function saveResult(nodeId, reactionTimeMs, isCorrect) {
        var PS = _PS();
        if (!_callbacks.checkRateLimit()) return;
        if (!PS.supabaseClient || !PS.currentUser || !PS.sessionId) return;
        try {
            await PS.supabaseClient.from('test_results').insert({
                user_id: PS.currentUser.id,
                session_id: PS.sessionId,
                node_id: nodeId || 'user_training',
                response_time_ms: reactionTimeMs != null ? Math.round(reactionTimeMs) : null,
                is_correct: isCorrect,
                distance_m: (typeof PS.curDistanceM !== 'undefined' && PS.curDistanceM != null) ? PS.curDistanceM : null,
                created_at: new Date().toISOString()
            });
        } catch (e) {
            VLog.warn('[user] save:', e);
        }
    }

    // ==================== Voice countdown ====================
    function scheduleVoiceCountdown(durationMs) {
        var PS = _PS();
        if (!global.Voice || !global.Voice.enabled) return;
        if (!durationMs || durationMs < 5000) return;
        var timers = [];
        if (durationMs - 5000 > 0)
            timers.push(setTimeout(function () {
                if (PS.responsePhaseActive && !PS.isPaused) global.Voice.sayKey('countdown5');
            }, durationMs - 5000));
        [3, 2, 1].forEach(function (s) {
            var at = durationMs - s * 1000;
            if (at > 0)
                timers.push(setTimeout(function () {
                    if (PS.responsePhaseActive && !PS.isPaused) global.Voice.sayKey('countdown' + s);
                }, at));
        });
        var w = setInterval(function () {
            if (!PS.responsePhaseActive) {
                timers.forEach(function (t) { clearTimeout(t); });
                clearInterval(w);
            }
        }, 200);
    }

    // ==================== Запуск ====================
    function startPlayer() {
        var PS = _PS();
        if (PS.playerRunning) {
            VLog.warn('[player] уже запущен');
            return;
        }
        if (global.PlayerOverlay && global.PlayerOverlay.hideStatus) global.PlayerOverlay.hideStatus();
        if (!PS.userScenario) {
            _callbacks.onError('Сценарий не назначен');
            return;
        }
        if (!_callbacks.validateScenario(PS.userScenario)) {
            _callbacks.onError('Сценарий повреждён или содержит некорректные данные.');
            return;
        }
        PS.sessionId =
            global.crypto && typeof global.crypto.randomUUID === 'function'
                ? global.crypto.randomUUID()
                : 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        var p = (PS.userScenario.params) || {};
        PS.playerRunning = true;
        global._fastLeanAt = 0;
        global._deviationHistory = [];
        global._distEMA = null;
        global._reactionLog = [];
        global._baselineWaitStart = null;
        if (!PS.focalLengthPx || PS.focalLengthPx <= 0) {
            var _lsF2 = parseFloat(localStorage.getItem('focalLengthPx') || '0');
            if (_lsF2 > 0) PS.focalLengthPx = _lsF2;
        }
        PS.graphActive = false;
        PS.gNodes = [];
        PS.gConnections = [];
        PS.gQueue = [];
        PS.gIndex = 0;
        PS.gCurrentNodeId = null;
        PS.gCurrentCompareNode = null;
        global._invalidAnswerCount = 0;
        if (global._reactionTimes) global._reactionTimes = [];
        VLog.log('[graph] state reset');
        PS.isPaused = false;
        PS.completedSeries = PS.successfulSeries = PS.failedSeries = 0;
        PS.seriesCorrect = PS.seriesIncorrect = PS.seriesNoAnswer = 0;
        PS.seriesStep = 0;
        PS.noAnswerSeriesStreak = 0;
        PS.lastDirection = null;
        PS.currentSingleCell = { row: 0, col: 0 };
        PS.screenPPI = p.ppi || PS.screenPPI || 96;
        if (p.minDetectPct && !isNaN(p.minDetectPct)) PS._minDetectPct = parseFloat(p.minDetectPct);
        var bplay = _el('btn-player');
        if (bplay) bplay.disabled = true;
        var counters = document.querySelector('.counters');
        if (counters) counters.style.setProperty('display', 'none');
        var bstop = _el('btn-player-stop');
        if (bstop) bstop.disabled = false;
        var bpause = _el('btn-player-pause');
        if (bpause) bpause.disabled = false;
        if (global.Voice) global.Voice.sayKey('ready', { cancel: true });

        if (p.graph && Array.isArray(p.graph.nodes) && p.graph.nodes.length > 0) {
            _callbacks.updateCounters();
            global.PlayerGraph.startGraphPlay(p.graph.nodes, p.graph.connections || [], p.graph.books || {});
            return;
        }

        if (p.trainingType !== 'reading')
            PS.currentAcuity = Math.max(0.1, Math.min(1.0, p.startAcuity || 0.5));
        else PS.currentAcuity = 1.0;
        PS.currentStimColor = p.startStimColor ? Object.assign({}, p.startStimColor) : { r: 0, g: 255, b: 0 };
        PS.currentBgColor = p.startBgColor ? Object.assign({}, p.startBgColor) : { r: 0, g: 0, b: 0 };
        PS.currentDuration = 2550;
        var acuityToSizePx = (global.VissortCore && global.VissortCore.acuityToSizePx) || function () { return 16; };
        PS.currentSize = acuityToSizePx(
            PS.currentAcuity,
            p.distanceMeters || 1,
            PS.screenPPI
        );
        _callbacks.updateCounters();
        var tt = p.trainingType || 'single';
        if (tt === 'reading') {
            if (bpause) bpause.disabled = true;
            global.PlayerReadingMode.start(Object.assign({}, p, {
                mode: 'flat',
                text: p.text || '',
                textColor: p.textColor,
                acuity: PS.currentAcuity,
                distance: p.readingDistance || 1
            }));
        } else if (tt === 'compare') {
            PS.compareMode = p.compareMode || 'direction';
            PS.gridX = Math.max(2, Math.min(6, parseInt(p.gridX) || 3));
            PS.gridY = Math.max(1, Math.min(6, parseInt(p.gridY) || 3));
            PS.activeCells = (p.activeCells || []).slice();
            PS.cellParams = (p.cellParams || []).slice();
            if (PS.activeCells.length < 2)
                PS.activeCells = [
                    { row: 0, col: 0 },
                    { row: 0, col: 1 }
                ];
            while (PS.cellParams.length < PS.activeCells.length)
                PS.cellParams.push(_callbacks.defaultCellParams());
            _callbacks.showNextCompareRound();
        } else _callbacks.showNextStimulus();
    }

    global.PlayerSession = {
        setCallbacks: setCallbacks,
        startPlayer: startPlayer,
        pauseTraining: pauseTraining,
        resumeTraining: resumeTraining,
        togglePause: togglePause,
        stopPlayer: stopPlayer,
        showFinishedReport: showFinishedReport,
        saveResult: saveResult,
        scheduleVoiceCountdown: scheduleVoiceCountdown
    };

    VLog.log('[player-session] module installed');
})(window);
