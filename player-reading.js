// ============================================================
// player-reading.js
// Логика фона чтения: сплошной, split, градиент, динамический.
// Viewport передаётся параметром. Состояние анимации — внутри модуля.
// ============================================================
(function (global) {
    'use strict';

    const { lerpColor } = global.VissortCore;

    // Состояние анимации динамического фона
    const _state = {
        animId: null,
        animStart: null,
        animPausedAt: null
    };

    // ==================== APPLY BACKGROUND ====================
    function applyBackground(p, viewportEl) {
        if (!viewportEl) return;
        const m = p.bgMode || 'solid';
        stopDynamicBg();

        if (m === 'split') {
            const lw = Math.max(0, Math.min(100, p.splitLeftWidthPercent ?? 50));
            const lc = p.splitLeftColor || { r: 0, g: 0, b: 0 };
            const rc = p.splitRightColor || { r: 0, g: 0, b: 0 };
            viewportEl.style.background =
                'linear-gradient(to right, rgb(' +
                lc.r +
                ',' +
                lc.g +
                ',' +
                lc.b +
                ') 0%, rgb(' +
                lc.r +
                ',' +
                lc.g +
                ',' +
                lc.b +
                ') ' +
                lw +
                '%, rgb(' +
                rc.r +
                ',' +
                rc.g +
                ',' +
                rc.b +
                ') ' +
                lw +
                '%, rgb(' +
                rc.r +
                ',' +
                rc.g +
                ',' +
                rc.b +
                ') 100%)';
            return;
        }

        if (m === 'gradient') {
            const lc = p.gradientLeftColor || { r: 255, g: 255, b: 255 };
            const rc = p.gradientRightColor || { r: 0, g: 0, b: 0 };
            if (p.gradientMidEnabled !== false) {
                const mc = p.gradientMidColor || { r: 204, g: 204, b: 204 };
                const mp = Math.max(0, Math.min(100, p.gradientMidPosition ?? 50));
                viewportEl.style.background =
                    'linear-gradient(to right, rgb(' +
                    lc.r +
                    ',' +
                    lc.g +
                    ',' +
                    lc.b +
                    ') 0%, rgb(' +
                    mc.r +
                    ',' +
                    mc.g +
                    ',' +
                    mc.b +
                    ') ' +
                    mp +
                    '%, rgb(' +
                    rc.r +
                    ',' +
                    rc.g +
                    ',' +
                    rc.b +
                    ') 100%)';
            } else {
                viewportEl.style.background =
                    'linear-gradient(to right, rgb(' +
                    lc.r +
                    ',' +
                    lc.g +
                    ',' +
                    lc.b +
                    ') 0%, rgb(' +
                    rc.r +
                    ',' +
                    rc.g +
                    ',' +
                    rc.b +
                    ') 100%)';
            }
            return;
        }

        if (m === 'dynamic') {
            startDynamicBg(p, viewportEl, () => false);
            return;
        }

        const bg = p.bgColor || { r: 255, g: 255, b: 255 };
        viewportEl.style.background = 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')';
    }

    // ==================== DYNAMIC BACKGROUND ====================
    // isPausedGetter: функция, возвращающая true/false — вызывается в каждом кадре
    function startDynamicBg(p, viewportEl, isPausedGetter) {
        if (!viewportEl) return;
        stopDynamicBg();

        const mode = p.dynamicMode || 'simple';
        const rev = p.dynamicReverse === true;
        let base;

        if (mode === 'rgb') {
            base = [
                { from: { r: 255, g: 0, b: 0 }, to: { r: 255, g: 255, b: 0 } },
                { from: { r: 255, g: 255, b: 0 }, to: { r: 0, g: 255, b: 0 } },
                { from: { r: 0, g: 255, b: 0 }, to: { r: 0, g: 255, b: 255 } },
                { from: { r: 0, g: 255, b: 255 }, to: { r: 0, g: 0, b: 255 } }
            ];
        } else {
            const A = p.dynamicStartColor || { r: 255, g: 0, b: 0 };
            const B = p.dynamicEndColor || { r: 0, g: 0, b: 255 };
            base =
                p.dynamicMidEnabled && p.dynamicMidColor
                    ? [
                          { from: A, to: p.dynamicMidColor },
                          { from: p.dynamicMidColor, to: B }
                      ]
                    : [{ from: A, to: B }];
        }

        const phases = rev
            ? base.concat(
                  base
                      .slice()
                      .reverse()
                      .map((ph) => ({ from: ph.to, to: ph.from }))
              )
            : base;
        const cnt = phases.length;
        const cycleMs = Math.max(100, p.dynamicDuration || 10000);
        const first = phases[0].from;
        viewportEl.style.background = 'rgb(' + first.r + ',' + first.g + ',' + first.b + ')';

        _state.animStart = null;
        _state.animPausedAt = null;

        function tick(now) {
            const paused = isPausedGetter ? isPausedGetter() : false;
            if (paused) {
                if (_state.animPausedAt === null) _state.animPausedAt = now;
                _state.animId = requestAnimationFrame(tick);
                return;
            }
            if (_state.animPausedAt !== null) {
                _state.animStart += now - _state.animPausedAt;
                _state.animPausedAt = null;
            }
            if (_state.animStart === null) _state.animStart = now;
            const el = Math.max(0, now - _state.animStart);
            const t = (el % cycleMs) / cycleMs;
            const pi = Math.max(0, Math.min(cnt - 1, Math.floor(t * cnt)));
            const pp = Math.max(0, Math.min(1, t * cnt - pi));
            const ph = phases[pi];
            if (!ph) {
                _state.animId = null;
                return;
            }
            const c = lerpColor(ph.from, ph.to, pp);
            viewportEl.style.background = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
            _state.animId = requestAnimationFrame(tick);
        }
        _state.animId = requestAnimationFrame(tick);
    }

    function stopDynamicBg() {
        if (_state.animId) {
            cancelAnimationFrame(_state.animId);
            _state.animId = null;
        }
        _state.animPausedAt = null;
    }

    // ==================== EXPORT ====================
    global.PlayerReading = {
        applyBackground,
        startDynamicBg,
        stopDynamicBg
    };

    console.log('[player-reading] module installed');
})(window);
