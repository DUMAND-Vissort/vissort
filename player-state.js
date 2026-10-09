// ============================================================
// player-state.js
// Единое состояние плеера. Все переменные, к которым обращаются
// и player-runtime.js, и вынесенные модули.
// ============================================================
(function (global) {
    'use strict';

    global.PlayerState = {
        // Прочее (b) — чтение
        readingFontFamily: 'Segoe UI',
        readingFontWeight: 'normal',
        _readingFinishGuard: false,
        _readingTimerId: null,
        _currentReadingNodeId: null,
        _currentReadingBookId: null,
        _currentReadingPage: 0,
        _readingNodeWaiting: false,

        // Прочее (a)
        screenPPI: 96,
        _tolNearCm: 10,
        _tolFarCm: 15,
        // Auth / сессия
        supabaseClient: null,
        currentUser: null,
        userScenarios: [],
        userScenario: null,
        sessionId: null,
        authMode: 'signin',

        // Управление плеером
        playerRunning: false,
        isPaused: false,
        phaseTimers: [],
        currentShowTimer: null,

        // Фаза ответа
        responsePhaseActive: false,

        // Ответы
        responseStartTime: 0,
        lastResponse: { answered: false, isCorrect: false, reactionTimeMs: null },
        currentCorrectDirection: null,
        lastDirection: null,
        _stimulusDistance: null,

        // Face detection
        _detWindow: [],
        _DET_WINDOW_SIZE: 30,
        _minDetectPct: 80,
        _lastDistWarnAt: 0,
        _distWarnArmed: true,
        _lastSeenDist: null,

        // Стабилизация (детекция наклона)
        _waitingStable: false,
        _stableSince: 0,
        _stableBuf: [],
        _answerBlocked: false,

        // Граф
        graphActive: false,
        gNodes: [],
        gConnections: [],
        gQueue: [],
        gIndex: 0,
        gCurrentNodeId: null,
        gNodeAcuityCurrent: 1.0,
        gCurrentCompareNode: null,

        // Камера
        camStream: null,
        camActive: false,
        camFrameId: null,
        focalLengthPx: null,
        lastEyeDistPx: null,
        curDistanceM: null,
        camBaseline: null,
        camWarnKind: null,

        // Чтение
        readingPage: 0,
        readingTotalPages: 1,
        readingPaused: false,
        readingBgAnimId: null,
        readingBgAnimStart: null,
        readingBgAnimPausedAt: null,

        // Анимации стимула
        singleStimAnimId: null,
        singleStimAnimStart: null,
        singleBgAnimId: null,
        singleBgAnimStart: null,

        // Анимации круга
        _circleAnimId: null,
        _circleAnimStart: null,
        _circleInnerPhases: null,
        _circleOuterPhases: null,
        _circleInnerDurationMs: 10000,
        _circleOuterDurationMs: 10000,
        _circleInnerLoop: true,
        _circleOuterLoop: true,

        // Анимации периферии
        _periAnimId: null,
        _periAnimStart: null,

        // Анимации моргания
        _blinkTimerId: null,
        _blinkLocalState: { tick: 0, current: 'A' },

        // Сравнение
        compareMode: 'direction',
        gridX: 3,
        gridY: 3,
        activeCells: [],
        cellParams: [],
        currentCompareAnswer: null,

        // Стимул
        currentAcuity: 1.0,
        currentStimColor: { r: 0, g: 255, b: 0 },
        currentBgColor: { r: 0, g: 0, b: 0 },
        currentSize: 27,
        currentDuration: 2550,
        currentSingleCell: { row: 0, col: 0 },

        // Серия
        completedSeries: 0,
        successfulSeries: 0,
        failedSeries: 0,
        seriesCorrect: 0,
        seriesIncorrect: 0,
        seriesNoAnswer: 0,
        seriesStep: 0,
        noAnswerSeriesStreak: 0
    };

    // Инициализация screenPPI
    (function _loadScreenPPI() {
        try {
            if (global.VissortCore && typeof global.VissortCore.loadPPI === 'function') {
                global.PlayerState.screenPPI = global.VissortCore.loadPPI();
            }
        } catch (_) {}
    })();

    // Инициализация _minDetectPct из localStorage
    (function _loadMinDetectPct() {
        try {
            const v = parseFloat(localStorage.getItem('min_detect_pct') || '80');
            if (!isNaN(v) && v >= 30 && v <= 100) {
                global.PlayerState._minDetectPct = v;
            }
        } catch (_) {}
    })();

    // Инициализация focalLengthPx из localStorage (как было в оригинале)
    (function _loadFocalLength() {
        try {
            const stored = parseFloat(localStorage.getItem('focalLengthPx') || '0');
            if (stored > 0) {
                global.PlayerState.focalLengthPx = stored;
            }
        } catch (_) {}
    })();

    console.log('[player-state] module installed');
})(window);
