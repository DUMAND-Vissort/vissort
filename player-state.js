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
