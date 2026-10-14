// player-overlay.js — status-overlay и pause-modal.
// Перенесено из player-runtime.js (§15.1.2 ч.2/7).
// Зависит: VLog (vissort-logger.js).
(function (global) {
    'use strict';

    function _el(id) { return document.getElementById(id); }

    // Показ статус-оверлея.
    // actionLabel / actionFn — опциональная кнопка (например, «Ещё раз»).
    function showStatus(title, text, actionLabel, actionFn) {
        var overlay = _el('status-overlay');
        if (!overlay) return;
        var titleEl = _el('status-title');
        var textEl = _el('status-text');
        var actionEl = _el('status-action');
        if (titleEl) titleEl.textContent = title;
        if (textEl) textEl.textContent = text || '';
        if (actionEl) {
            actionEl.classList.toggle('hidden', !actionLabel);
            actionEl.onclick = actionFn || null;
            if (actionLabel) actionEl.textContent = actionLabel;
        }
        overlay.classList.remove('hidden');
    }

    function hideStatus() {
        var overlay = _el('status-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    function showPause() {
        var el = _el('pause-modal');
        if (el) el.classList.add('open');
    }

    function hidePause() {
        var el = _el('pause-modal');
        if (el) el.classList.remove('open');
    }

    global.PlayerOverlay = {
        showStatus: showStatus,
        hideStatus: hideStatus,
        showPause: showPause,
        hidePause: hidePause
    };

    VLog.log('[player-overlay] module installed');
})(window);