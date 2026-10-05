// ============================================================
// player-state.js
// Единое состояние плеера. Все переменные, к которым обращаются
// и player-runtime.js, и вынесенные модули.
// ============================================================
(function (global) {
    'use strict';

    global.PlayerState = {
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

    console.log('[player-state] module installed');
})(window);
