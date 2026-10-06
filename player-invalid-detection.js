// ============================================================
// player-invalid-detection.js
// Детекция наклона/отклонения: аннулирование ответов, инвалидация,
// приостановка показа при потере лица или отклонении дистанции.
// Зависит от PlayerState, PlayerDistWarning.
// Вызывает плеер через callbacks (onHideStimulus, onPlayGraphStimulus,
// onPlayGraphCompareRound, onShowNextStimulus, onGetNode).
// ============================================================
(function (global) {
    'use strict';

    if (!global.PlayerState) {
        throw new Error('[player-invalid-detection] PlayerState not loaded.');
    }
    const PS = global.PlayerState;

    // Callbacks
    let _callbacks = {
        onHideStimulus: () => {},
        onPlayGraphStimulus: () => {},
        onPlayGraphCompareRound: () => {},
        onShowNextStimulus: () => {},
        onGetNode: () => null
    };
    function setCallbacks(cb) {
        _callbacks = Object.assign({}, _callbacks, cb || {});
    }

    // ==================== Мгновенная отмена стимула ====================
    function _abortCurrentStimulus(reason) {
        if (!PS.playerRunning || PS.isPaused) return;
        if (PS._waitingStable) return;

        console.log('[abort] reason=' + reason + ' (dist=' + (PS.curDistanceM != null ? PS.curDistanceM.toFixed(2) : '?') + 'm)');

        if (PS.currentShowTimer) { clearTimeout(PS.currentShowTimer); PS.currentShowTimer = null; }

        // Freeze animations
        if (PS.singleStimAnimId) { cancelAnimationFrame(PS.singleStimAnimId); PS.singleStimAnimId = null; }
        if (PS.singleBgAnimId)   { cancelAnimationFrame(PS.singleBgAnimId);   PS.singleBgAnimId = null; }
        if (PS._circleAnimId)    { cancelAnimationFrame(PS._circleAnimId);    PS._circleAnimId = null; }
        if (PS._periAnimId)      { cancelAnimationFrame(PS._periAnimId);      PS._periAnimId = null; }
        if (PS._blinkTimerId)    { clearTimeout(PS._blinkTimerId);            PS._blinkTimerId = null; }

        PS.responsePhaseActive = false;
        const rb = document.getElementById('response-buttons');
        if (rb) rb.style.display = 'none';

        PS._answerBlocked = true;
        PS.lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
        PS._waitingStable = true;
        PS._stableSince = 0;
        PS._stableBuf = [];
    }

    // ==================== Детекция быстрого наклона ====================
    window._deviationHistory = window._deviationHistory || [];
    window._fastLeanAt = window._fastLeanAt || 0;
    window._invalidAnswerCount = window._invalidAnswerCount || 0;

    const _LEAN_DROP_PCT = 15;
    const _LEAN_FAST_MS = 800;
    const _LEAN_WINDOW_MS = 4000;
    const _DEVIATION_HISTORY_MS = 2000;
    const _LEAN_CONSECUTIVE_FRAMES = 3;

    function _recordDeviation(pct) {
        if (!PS.playerRunning) return;
        if (PS.isPaused) return;
        var now = performance.now();
        window._deviationHistory.push({ t: now, dev: pct });
        while (window._deviationHistory.length && now - window._deviationHistory[0].t > _DEVIATION_HISTORY_MS) {
            window._deviationHistory.shift();
        }
        var _lastH = window._deviationHistory[window._deviationHistory.length - 2];
        if (_lastH) {
            var _vel = Math.abs(pct - _lastH.dev);
            if (_vel > 8) {
                window._fastLeanAt = now;
                var _llog = window._lastLeanLogAt || 0;
                if (now - _llog > 2000) {
                    console.warn('[lean] velocity', _vel.toFixed(1) + '%');
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
    }

    function _isAnswerInvalid() {
        if (!PS.playerRunning) return null;
        if (PS.isPaused) return null;
        var now = performance.now();
        try {
            if (PS.curDistanceM != null && PS.camBaseline != null) {
                var curDev = (PS.curDistanceM - PS.camBaseline) / PS.camBaseline * 100;
                if (Math.abs(curDev) > _LEAN_DROP_PCT) {
                    return curDev < 0 ? 'fast_lean' : 'off_distance';
                }
            }
        } catch (e) {}
        if (now - window._fastLeanAt < 2000) return 'fast_lean';
        return null;
    }

    function _markAnswerInvalid(reason) {
        window._invalidAnswerCount++;
        var cnt = document.getElementById('cnt-invalid');
        if (cnt) cnt.textContent = window._invalidAnswerCount;
        var msg = reason === 'fast_lean'
            ? '⚠️ Ответ не засчитан — резкий наклон'
            : '⚠️ Ответ не засчитан — вернитесь на дистанцию';
        _showInvalidToast(msg);
    }

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
        setTimeout(function () { el.style.opacity = '0'; }, 1800);
        setTimeout(function () { if (el.parentNode) el.remove(); }, 2200);
    }

    // ==================== RESUME AFTER STABLE ====================
    function _resumeAfterStable() {
        PS._waitingStable = false;
        PS._answerBlocked = false;
        PS._stableSince = 0;
        PS._stableBuf = [];
        PS._stimulusDistance = PS.curDistanceM;
        console.log('[abort] stable at ' + (PS.curDistanceM != null ? PS.curDistanceM.toFixed(2) : '?') + 'm -- resuming');

        var _n = null;
        try { _n = _callbacks.onGetNode(PS.currentPlayingNodeId); } catch (e) { _n = null; }
        if (_n && PS.gNodes && PS.gNodes.indexOf(_n) !== -1) {
            if (_n.nodeType === 'COMPARE') _callbacks.onPlayGraphCompareRound(_n);
            else _callbacks.onPlayGraphStimulus(_n);
            return;
        }
        try { _callbacks.onShowNextStimulus(); } catch (e) { console.warn('[abort] resume flat failed:', e); }
    }

    // ==================== EXPORT ====================
    global.PlayerInvalidDetection = {
        setCallbacks,
        _abortCurrentStimulus,
        _resumeAfterStable,
        _recordDeviation,
        _isAnswerInvalid,
        _markAnswerInvalid,
        _updateStimulusDim,
        _showInvalidToast
    };

    console.log('[player-invalid-detection] module installed');
})(window);
