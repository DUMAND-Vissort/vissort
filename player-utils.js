// ============================================================
// player-utils.js
// Утилиты плеера: rate-limit, валидация сценария, дистанция.
// ============================================================
(function (global) {
    'use strict';

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

    // ==================== DISTANCE HELPERS ====================
    // curDist передаётся параметром — модуль не зависит от глобальной curDistanceM
    function effectiveDistance(declared, curDist) {
        try {
            if (typeof curDist !== 'undefined' && curDist != null) {
                if (curDist > 0.2 && curDist < 10) {
                    return curDist;
                }
            }
        } catch (e) {}
        return declared || 1;
    }

    // EMA-фильтр — использует window._distEMA (уже в window)
    function smoothDistance(raw) {
        if (raw == null || !isFinite(raw)) return raw;
        if (window._distEMA === null || !isFinite(window._distEMA)) {
            window._distEMA = raw;
        } else {
            window._distEMA = window._distEMA * 0.5 + raw * 0.5;
        }
        return window._distEMA;
    }

    // ==================== EXPORT ====================
    global.PlayerUtils = {
        checkRateLimit,
        validateScenario,
        effectiveDistance,
        smoothDistance
    };

    console.log('[player-utils] module installed');
})(window);
