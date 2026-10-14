// player-reading-mode.js — режим чтения (UI + логика страниц + события).
// Перенесено из player-runtime.js (§15.1.2 ч.3/7).
// Зависит: VLog (vissort-logger.js), PlayerState (player-state.js),
//          PlayerReading (player-reading.js), PlayerOverlay (player-overlay.js).
(function (global) {
    'use strict';

    function _el(id) { return document.getElementById(id); }
    function _vp() { return _el('reading-viewport'); }
    function _cnt() { return _el('reading-content'); }
    function _tb() { return _el('reading-toolbar'); }
    function _PS() { return global.PlayerState; }

    var _callbacks = {
        onFinish: function () {},
        onChangeAcuity: function (delta) {}
    };

    function setCallbacks(cb) {
        _callbacks = Object.assign({}, _callbacks, cb || {});
    }

    // ==================== UI ====================
    function applyReadingFont(p) {
        var cnt = _cnt();
        if (!cnt) return;
        var family = (p.readingFontFamily && p.readingFontFamily.trim()) || 'Segoe UI';
        var safe = family.replace(/['"]/g, '');
        cnt.style.fontFamily = safe.toLowerCase() === 'sivtsev'
            ? "'Sivtsev', 'Segoe UI', sans-serif"
            : "'" + safe + "', 'Segoe UI', Tahoma, sans-serif";
        cnt.style.fontWeight = p.readingFontWeight || 'normal';
    }

    function setupReadingColumns() {
        var vp = _vp(), cnt = _cnt();
        if (!vp || !cnt) return;
        var vw = vp.clientWidth;
        if (vw <= 0) return;
        var sp = 80;
        var tw = Math.max(200, vw - sp);
        cnt.style.columnWidth = tw + 'px';
        cnt.style.columnGap = sp + 'px';
    }

    function calcReadingTotalPages() {
        var vp = _vp(), cnt = _cnt();
        if (!vp || !cnt) return 1;
        var W = vp.clientWidth;
        if (W <= 0) return 1;
        return Math.max(1, Math.round(cnt.scrollWidth / W));
    }

    function scrollReadingToPage(page) {
        var vp = _vp(), cnt = _cnt();
        if (!vp || !cnt) return;
        var PS = _PS();
        PS.readingTotalPages = calcReadingTotalPages();
        PS.readingPage = Math.max(0, Math.min(page, PS.readingTotalPages - 1));
        vp.scrollLeft = PS.readingPage * vp.clientWidth;
        var info = _el('reading-page-info');
        if (info) info.textContent = 'Стр. ' + (PS.readingPage + 1) + ' / ' + PS.readingTotalPages;
    }

    function prevReadingPage() {
        var PS = _PS();
        if (PS.readingPage > 0) scrollReadingToPage(PS.readingPage - 1);
    }

    function nextReadingPage() {
        var PS = _PS();
        if (PS.readingPage < PS.readingTotalPages - 1) scrollReadingToPage(PS.readingPage + 1);
    }

    function toggleReadingPause() {
        var PS = _PS();
        var cnt = _cnt();
        PS.readingPaused = !PS.readingPaused;
        var b = _el('reading-play-pause');
        if (PS.readingPaused) {
            if (cnt) cnt.style.opacity = '0';
            if (b) b.textContent = '▶ Чтение';
        } else {
            if (cnt) cnt.style.opacity = '1';
            if (b) b.textContent = '⏸ Пауза';
        }
    }

    // ==================== Обёртки над PlayerReading ====================
    function applyReadingBackground(p) {
        var vp = _vp();
        if (vp && global.PlayerReading) global.PlayerReading.applyBackground(p, vp);
    }

    function startReadingDynamicBg(p) {
        var vp = _vp();
        if (vp && global.PlayerReading) {
            global.PlayerReading.startDynamicBg(p, vp, function () {
                var PS = _PS();
                return PS && PS.readingPaused;
            });
        }
    }

    function stopReadingDynamicBg() {
        if (global.PlayerReading) global.PlayerReading.stopDynamicBg();
    }

    // ==================== Старт / Финиш ====================
    // opts: { text, textColor, bgMode, ..., fontFamily, fontWeight, acuity, distance, duration, mode }
    function start(opts) {
        var PS = _PS();
        var p = opts || {};
        var text = p.text || '';
        var pars = text.split(/\n+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 0; });
        var cnt = _cnt();
        if (!cnt) return;

        var esc = (global.VissortCore && global.VissortCore.escapeHtml) || function (s) { return s; };
        cnt.innerHTML = pars.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('');
        cnt.style.color = p.textColor
            ? 'rgb(' + p.textColor.r + ',' + p.textColor.g + ',' + p.textColor.b + ')'
            : '#000';

        applyReadingBackground(p);

        var stimDisplay = _el('stim');
        var responseButtons = _el('response-buttons');
        if (stimDisplay) stimDisplay.style.display = 'none';
        if (responseButtons) responseButtons.style.display = 'none';

        var vp = _vp();
        if (vp) {
            vp.style.display = 'block';
            vp.scrollLeft = 0;
        }
        PS.readingPaused = false;
        var pp = _el('reading-play-pause');
        if (pp) pp.textContent = '⏸ Пауза';
        cnt.style.opacity = '1';

        applyReadingFont(p);
        setupReadingColumns();

        var dCalc = p.distance || 1;
        var acuity = (p.acuity != null) ? p.acuity : PS.currentAcuity;
        var acuityToFontSizePx = (global.VissortCore && global.VissortCore.acuityToFontSizePx) || function () { return 16; };
        cnt.style.fontSize = acuityToFontSizePx(acuity, dCalc, PS.screenPPI) + 'px';

        setTimeout(function () {
            PS.readingTotalPages = calcReadingTotalPages();
            PS.readingPage = 0;
            scrollReadingToPage(0);
        }, 80);

        var tb = _tb();
        if (tb) tb.style.display = 'flex';

        // Таймер на duration — только для графа
        if (p.duration > 0) {
            PS._readingFinishGuard = false;
            if (PS._readingTimerId) {
                clearTimeout(PS._readingTimerId);
                PS._readingTimerId = null;
            }
            PS._readingTimerId = setTimeout(function () {
                PS._readingTimerId = null;
                _callbacks.onFinish(p.mode || 'flat');
            }, p.duration);
        }
    }

    function hideDOM() {
        var tb = _tb(), vp = _vp(), cnt = _cnt();
        if (tb) tb.style.display = 'none';
        if (vp) vp.style.display = 'none';
        if (cnt) cnt.innerHTML = '';
        var stimDisplay = _el('stim');
        if (stimDisplay) stimDisplay.style.display = '';
        stopReadingDynamicBg();
    }

    function finish() {
        hideDOM();
    }

    // ==================== События ====================
    function initEvents(cb) {
        if (cb) setCallbacks(cb);

        var prev = _el('reading-prev');
        if (prev) prev.addEventListener('click', prevReadingPage);
        var next = _el('reading-next');
        if (next) next.addEventListener('click', nextReadingPage);
        var pp = _el('reading-play-pause');
        if (pp) pp.addEventListener('click', toggleReadingPause);

        // Scroll → определение страницы
        var vp = _vp();
        if (vp) {
            var scrollTimer = null;
            vp.addEventListener('scroll', function () {
                if (vp.style.display === 'none' || scrollTimer) return;
                scrollTimer = setTimeout(function () {
                    scrollTimer = null;
                    var W = vp.clientWidth;
                    if (W <= 0) return;
                    var np = Math.round(vp.scrollLeft / W);
                    var PS = _PS();
                    if (np !== PS.readingPage) {
                        PS.readingPage = Math.max(0, Math.min(np, PS.readingTotalPages - 1));
                        var info = _el('reading-page-info');
                        if (info) info.textContent = 'Стр. ' + (PS.readingPage + 1) + ' / ' + PS.readingTotalPages;
                    }
                }, 100);
            });
        }

        // Keyboard: стрелки + пробел — только когда viewport видим
        document.addEventListener('keydown', function (e) {
            var vp2 = _vp();
            if (!vp2 || vp2.style.display !== 'block') return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); prevReadingPage(); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); nextReadingPage(); return; }
            if (e.key === ' ') { e.preventDefault(); toggleReadingPause(); return; }
        });

        VLog.log('[player-reading-mode] events attached');
    }

    global.PlayerReadingMode = {
        setCallbacks: setCallbacks,
        start: start,
        finish: finish,
        hideDOM: hideDOM,
        initEvents: initEvents,
        prevReadingPage: prevReadingPage,
        nextReadingPage: nextReadingPage,
        toggleReadingPause: toggleReadingPause,
        scrollReadingToPage: scrollReadingToPage,
        calcReadingTotalPages: calcReadingTotalPages,
        applyReadingFont: applyReadingFont,
        setupReadingColumns: setupReadingColumns,
        applyReadingBackground: applyReadingBackground,
        startReadingDynamicBg: startReadingDynamicBg,
        stopReadingDynamicBg: stopReadingDynamicBg
    };

    VLog.log('[player-reading-mode] module installed');
})(window);
