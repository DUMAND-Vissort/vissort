// ============================================================
// player-core.js — Единый движок плеера (Фаза 3)
// Пока содержит только playDynamicStimulus (обёртка над VissortCore).
// В будущем сюда переедут playStimulusNodeSeries, playCompareNodeSeries, playReadingNode.
// ============================================================
(function (global) {
    'use strict';

    function playDynamicStimulus(node, opts) {
        return global.VissortCore.playDynamicStimulus(node, opts);
    }

    global.PlayerCore = {
        playDynamicStimulus: playDynamicStimulus
    };

    if (global.VLog && global.VLog.log) {
        global.VLog.log('[PlayerCore] loaded, functions: 1');
    }
})(window);