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
        responsePhaseActive: false
    };

    console.log('[player-state] module installed');
})(window);
