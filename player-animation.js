// ============================================================
// player-animation.js
// Анимации стимула: цвет, круг, моргание, периферия, дефокус, сетка.
// Зависит от PlayerState и VissortCore.
// ============================================================
(function (global) {
    'use strict';

    if (!global.PlayerState) {
        throw new Error('[player-animation] PlayerState not loaded.');
    }
    if (!global.VissortCore) {
        throw new Error('[player-animation] VissortCore not loaded.');
    }
    const PS = global.PlayerState;
    const {
        lerpColor,
        buildGenericDynamicPhases,
        buildCirclePhases,
        acuityToSizePx
    } = global.VissortCore;

    // Callbacks, регистрируются из player-runtime.js
    let _callbacks = {
        onSetStimColor: () => {}
    };
    function setCallbacks(cb) {
        _callbacks = Object.assign({}, _callbacks, cb || {});
    }

    // Замена внешнего setStimColorRGB на callback
    function setStimColorRGB(r, g, b) {
        _callbacks.onSetStimColor(r, g, b);
    }

function startSingleStimAnimation(p) {
    stopSingleStimAnimation();
    const ph = buildGenericDynamicPhases(
        p.singleStimColor1,
        p.singleStimMidEnabled,
        p.singleStimColor3,
        p.singleStimColor2,
        p.singleStimReverse
    );
    const cnt = ph.length;
    if (!cnt) return;
    const total = Math.max(200, p.singleStimDuration || 10000);
    const cycMs = total;
    const loop = p.singleStimLoop === true;
    const first = ph[0].from;
    setStimColorRGB(first.r, first.g, first.b);
    PlayerState.singleStimAnimStart = null;
    function tick(now) {
        if (!PlayerState.playerRunning || PlayerState.isPaused) {
            PlayerState.singleStimAnimId = null;
            return;
        }
        if (PlayerState.singleStimAnimStart === null) PlayerState.singleStimAnimStart = now;
        let el = Math.max(0, now - PlayerState.singleStimAnimStart);
        let t = el / cycMs;
        if (t >= 1) {
            if (loop) {
                PlayerState.singleStimAnimStart += Math.floor(t) * cycMs;
                el = Math.max(0, now - PlayerState.singleStimAnimStart);
                t = el / cycMs;
            } else {
                const l = ph[cnt - 1].to;
                setStimColorRGB(l.r, l.g, l.b);
                PlayerState.singleStimAnimId = null;
                return;
            }
        }
        t = Math.max(0, t);
        const pi = Math.max(0, Math.min(cnt - 1, Math.floor(t * cnt)));
        const pp = Math.max(0, Math.min(1, t * cnt - pi));
        const P = ph[pi];
        if (!P) {
            PlayerState.singleStimAnimId = null;
            return;
        }
        const cur = lerpColor(P.from, P.to, pp);
        setStimColorRGB(cur.r, cur.g, cur.b);
        PlayerState.singleStimAnimId = requestAnimationFrame(tick);
    }
    PlayerState.singleStimAnimId = requestAnimationFrame(tick);
}
function stopSingleStimAnimation() {
    if (PlayerState.singleStimAnimId) {
        cancelAnimationFrame(PlayerState.singleStimAnimId);
        PlayerState.singleStimAnimId = null;
    }
}

function startSingleBgAnimation(p) {
    stopSingleBgAnimation();
    const ph = buildGenericDynamicPhases(
        p.singleBgColor1,
        p.singleBgMidEnabled,
        p.singleBgColor3,
        p.singleBgColor2,
        p.singleBgReverse
    );
    const cnt = ph.length;
    if (!cnt) return;
    const total = Math.max(200, p.singleBgDuration || 10000);
    const cycMs = total;
    const loop = p.singleBgLoop === true;
    const first = ph[0].from;
    stimArea.style.backgroundColor = `rgb(${first.r},${first.g},${first.b})`;
    PlayerState.singleBgAnimStart = null;
    function tick(now) {
        if (!PlayerState.playerRunning || PlayerState.isPaused) {
            PlayerState.singleBgAnimId = null;
            return;
        }
        if (PlayerState.singleBgAnimStart === null) PlayerState.singleBgAnimStart = now;
        let el = Math.max(0, now - PlayerState.singleBgAnimStart);
        let t = el / cycMs;
        if (t >= 1) {
            if (loop) {
                PlayerState.singleBgAnimStart += Math.floor(t) * cycMs;
                el = Math.max(0, now - PlayerState.singleBgAnimStart);
                t = el / cycMs;
            } else {
                const l = ph[cnt - 1].to;
                stimArea.style.backgroundColor = `rgb(${l.r},${l.g},${l.b})`;
                PlayerState.singleBgAnimId = null;
                return;
            }
        }
        t = Math.max(0, t);
        const pi = Math.max(0, Math.min(cnt - 1, Math.floor(t * cnt)));
        const pp = Math.max(0, Math.min(1, t * cnt - pi));
        const P = ph[pi];
        if (!P) {
            PlayerState.singleBgAnimId = null;
            return;
        }
        const cur = lerpColor(P.from, P.to, pp);
        stimArea.style.backgroundColor = `rgb(${cur.r},${cur.g},${cur.b})`;
        PlayerState.singleBgAnimId = requestAnimationFrame(tick);
    }
    PlayerState.singleBgAnimId = requestAnimationFrame(tick);
}
function stopSingleBgAnimation() {
    if (PlayerState.singleBgAnimId) {
        cancelAnimationFrame(PlayerState.singleBgAnimId);
        PlayerState.singleBgAnimId = null;
    }
}

// ==================== МОРГАНИЕ (анимация) ====================
function startBlinkAnimation(opts) {
    stopBlinkAnimation();
    if (!opts) return;
    const target = opts.target || 'stim';
    const A = opts.colorA || { r: 255, g: 0, b: 0 };
    const B = opts.colorB || { r: 0, g: 0, b: 255 };
    const intervalMs = Math.max(50, opts.intervalMs || 500);
    const duty = Math.max(0.05, Math.min(0.95, opts.duty ?? 0.5));
    const count = Math.max(0, opts.count || 0);

    PlayerState._blinkLocalState = { tick: 0, current: 'A' };

    function apply(color) {
        if (target === 'stim' || target === 'both') setStimColorRGB(color.r, color.g, color.b);
        if (target === 'bg' || target === 'both')
            stimArea.style.backgroundColor = `rgb(${color.r},${color.g},${color.b})`;
    }

    function tick() {
        if (!PlayerState.playerRunning || PlayerState.isPaused) {
            PlayerState._blinkTimerId = null;
            return;
        }
        const isA = PlayerState._blinkLocalState.current === 'A';
        apply(isA ? A : B);
        PlayerState._blinkLocalState.tick++;
        if (count > 0 && PlayerState._blinkLocalState.tick >= count) {
            PlayerState._blinkTimerId = null;
            return;
        }
        const nextIsA = !isA;
        const delay = nextIsA ? intervalMs * duty : intervalMs * (1 - duty);
        PlayerState._blinkLocalState.current = nextIsA ? 'A' : 'B';
        PlayerState._blinkTimerId = setTimeout(tick, Math.max(20, delay));
    }
    PlayerState._blinkTimerId = setTimeout(tick, 0);
}

function stopBlinkAnimation() {
    if (PlayerState._blinkTimerId) {
        clearTimeout(PlayerState._blinkTimerId);
        PlayerState._blinkTimerId = null;
    }
    PlayerState._blinkLocalState = { tick: 0, current: 'A' };
}

// PATCH28_PHASE3: removed buildCirclePhases (now in VissortCore)
function startCircleAnimation(node) {
    stopCircleAnimation();
    const svg = stimDisplay.querySelector('svg');
    if (!svg) return;
    const grads = svg.querySelectorAll('radialGradient');
    if (grads.length < 2) return;
    const oG = grads[0],
        iG = grads[1];
    PlayerState._circleInnerPhases = buildCirclePhases(
        node.circleInnerColor1,
        node.circleInnerMidEnabled,
        node.circleInnerColor3,
        node.circleInnerColor2,
        node.circleInnerReverse
    );
    PlayerState._circleOuterPhases = buildCirclePhases(
        node.circleOuterColor1,
        node.circleOuterMidEnabled,
        node.circleOuterColor3,
        node.circleOuterColor2,
        node.circleOuterReverse
    );
    PlayerState._circleInnerDurationMs = Math.max(200, node.circleInnerDuration || 10000);
    PlayerState._circleOuterDurationMs = Math.max(200, node.circleOuterDuration || 10000);
    PlayerState._circleInnerLoop = node.circleInnerLoop !== false;
    PlayerState._circleOuterLoop = node.circleOuterLoop !== false;
    PlayerState._circleAnimStart = null;
    function paint(g, phases, cyc, el) {
        if (!g) return;
        const cnt = phases.length;
        if (!cnt) return;
        let t = (el % cyc) / cyc;
        const pi = Math.max(0, Math.min(cnt - 1, Math.floor(t * cnt)));
        const pp = Math.max(0, Math.min(1, t * cnt - pi));
        const P = phases[pi];
        if (!P) return;
        const stops = g.querySelectorAll('stop');
        if (stops.length >= 2) {
            stops[0].setAttribute('stop-color', `rgb(${P.from.r},${P.from.g},${P.from.b})`);
            if (stops.length >= 3) {
                const m = lerpColor(P.from, P.to, 0.5);
                stops[1].setAttribute('stop-color', `rgb(${m.r},${m.g},${m.b})`);
                stops[stops.length - 1].setAttribute('stop-color', `rgb(${P.to.r},${P.to.g},${P.to.b})`);
            } else stops[stops.length - 1].setAttribute('stop-color', `rgb(${P.to.r},${P.to.g},${P.to.b})`);
        }
    }
    function tick(now) {
        if (!PlayerState.playerRunning || PlayerState.isPaused) {
            PlayerState._circleAnimId = null;
            return;
        }
        if (PlayerState._circleAnimStart === null) PlayerState._circleAnimStart = now;
        const el = now - PlayerState._circleAnimStart;
        const iD = !PlayerState._circleInnerLoop && el > PlayerState._circleInnerDurationMs;
        const oD = !PlayerState._circleOuterLoop && el > PlayerState._circleOuterDurationMs;
        if (iD && oD) {
            PlayerState._circleAnimId = null;
            return;
        }
        if (!iD) paint(iG, PlayerState._circleInnerPhases, PlayerState._circleInnerDurationMs, el);
        if (!oD) paint(oG, PlayerState._circleOuterPhases, PlayerState._circleOuterDurationMs, el);
        PlayerState._circleAnimId = requestAnimationFrame(tick);
    }
    PlayerState._circleAnimId = requestAnimationFrame(tick);
}
function stopCircleAnimation() {
    if (PlayerState._circleAnimId) {
        cancelAnimationFrame(PlayerState._circleAnimId);
        PlayerState._circleAnimId = null;
    }
    PlayerState._circleInnerPhases = null;
    PlayerState._circleOuterPhases = null;
}

function getPeripheralLayer() {
    let l = document.getElementById('peri-layer');
    if (!l) {
        l = document.createElement('div');
        l.id = 'peri-layer';
        l.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden;';
        if (getComputedStyle(stimArea).position === 'static') stimArea.style.position = 'relative';
        stimArea.appendChild(l);
    }
    return l;
}
function clearPeripheralLayer() {
    const l = document.getElementById('peri-layer');
    if (l) l.innerHTML = '';
}
function stopPeripheralAnimation() {
    if (PlayerState._periAnimId) {
        cancelAnimationFrame(PlayerState._periAnimId);
        PlayerState._periAnimId = null;
    }
    PlayerState._periAnimStart = null;
    clearPeripheralLayer();
}
function buildPeripheralDots(node) {
    clearPeripheralLayer();
    if (!node.periEnabled) return;
    const layer = getPeripheralLayer();
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    const count = Math.max(1, Math.min(12, node.periCount || 4));
    const pCalc = node.stimPPI || PlayerState.screenPPI || 96;
    const sizePx = acuityToSizePx(node.periAcuity || 0.3, node.stimDistance || 1, pCalc);
    const half = Math.min(aw, ah) / 2;
    const rMin = ((node.periRadiusMinPct ?? 60) / 100) * half;
    const rMax = ((node.periRadiusMaxPct ?? 90) / 100) * half;
    const color = node.periColor || { r: 0, g: 255, b: 100 };
    const cStr = `rgb(${color.r},${color.g},${color.b})`;
    const baseAngles = [];
    for (let i = 0; i < count; i++)
        baseAngles.push(node.periRandomAngles ? Math.random() * Math.PI * 2 : (i / count) * Math.PI * 2);
    const radii = baseAngles.map(() => rMin + Math.random() * (rMax - rMin));
    const cx = aw / 2,
        cy = ah / 2;
    function draw(t) {
        layer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            let ang = baseAngles[i],
                sc = 1;
            if (node.periMotion === 'rotate') {
                const sp = Math.max(0.02, Math.min(2, node.periSpeed || 0.3));
                ang += (t / 1000) * sp * Math.PI * 2;
            } else if (node.periMotion === 'pulse') {
                const sp = Math.max(0.5, Math.min(5, node.periSpeed || 1));
                sc = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(ang * 3 + (t / 1000) * sp * Math.PI * 2));
            }
            const x = cx + Math.cos(ang) * radii[i],
                y = cy + Math.sin(ang) * radii[i];
            const d = document.createElement('div');
            const s = Math.max(2, sizePx * sc);
            d.style.cssText = `position:absolute;left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;border-radius:50%;background:${cStr};box-shadow:0 0 6px rgba(0,0,0,0.4);`;
            layer.appendChild(d);
        }
    }
    draw(0);
    if (node.periMotion === 'static') return;
    PlayerState._periAnimStart = null;
    function tick(now) {
        if (!PlayerState.playerRunning || PlayerState.isPaused) {
            PlayerState._periAnimId = null;
            return;
        }
        if (PlayerState._periAnimStart === null) PlayerState._periAnimStart = now;
        draw(now - PlayerState._periAnimStart);
        PlayerState._periAnimId = requestAnimationFrame(tick);
    }
    PlayerState._periAnimId = requestAnimationFrame(tick);
}

function buildDefocusFrame(node, stimHtml) {
    if (!node.dfEnabled) return null;
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return null;
    const pCalc = node.stimPPI || PlayerState.screenPPI || 96;
    const rMm = Math.max(5, node.dfCenterRadiusMm || 13);
    const rPx = Math.round((rMm * pCalc) / 25.4 / (window.devicePixelRatio || 1));
    const D = rPx * 2;
    const per = node.dfPeriBg || { r: 0, g: 71, b: 171 };
    const cb = node.dfCenterBg || { r: 204, g: 0, b: 0 };
    const sc = node.dfStimColor || { r: 0, g: 0, b: 0 };
    const blur = Math.max(0, Math.min(100, node.dfPeriBlur || 0));
    const periStyle =
        blur > 0
            ? `radial-gradient(circle at center, rgb(${per.r},${per.g},${per.b}) 0%, rgb(${per.r},${per.g},${per.b}) ${100 - blur}%, rgba(${per.r},${per.g},${per.b},0) 100%)`
            : `rgb(${per.r},${per.g},${per.b})`;
    const black = stimHtml
        .replace(/fill="rgb\(\d+,\d+,\d+\)"/g, `fill="rgb(${sc.r},${sc.g},${sc.b})"`)
        .replace(/stroke="rgb\(\d+,\d+,\d+\)"/g, `stroke="rgb(${sc.r},${sc.g},${sc.b})"`);
    const frame = document.createElement('div');
    frame.style.cssText = `position:absolute;inset:0;background:${periStyle};display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:1;`;
    const center = document.createElement('div');
    center.style.cssText = `width:${D}px;height:${D}px;border-radius:50%;background:rgb(${cb.r},${cb.g},${cb.b});display:flex;align-items:center;justify-content:center;`;
    center.innerHTML = black;
    frame.appendChild(center);
    return frame;
}

function removeSingleGridLines() {
    stimArea.querySelectorAll('.single-grid-overlay').forEach((el) => el.remove());
}
function drawSingleGridLines(gx, gy) {
    removeSingleGridLines();
    if (gx <= 1 && gy <= 1) return;
    const o = document.createElement('div');
    o.className = 'single-grid-overlay';
    o.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;';
    const imgs = [],
        sizes = [];
    if (gx > 1) {
        imgs.push('linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px)');
        sizes.push(`${100 / gx}% 100%`);
    }
    if (gy > 1) {
        imgs.push('linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)');
        sizes.push(`100% ${100 / gy}%`);
    }
    o.style.backgroundImage = imgs.join(', ');
    o.style.backgroundSize = sizes.join(', ');
    o.style.backgroundRepeat = 'repeat';
    if (getComputedStyle(stimArea).position === 'static') stimArea.style.position = 'relative';
    stimArea.appendChild(o);
}
function applySingleGridPosition(size, gx, gy, row, col, showLines) {
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    gx = Math.max(1, parseInt(gx) || 1);
    gy = Math.max(1, parseInt(gy) || 1);
    row = Math.max(0, Math.min(gy - 1, parseInt(row) || 0));
    col = Math.max(0, Math.min(gx - 1, parseInt(col) || 0));
    const cw = aw / gx,
        ch = ah / gy;
    const dx = (col + 0.5) * cw - aw / 2,
        dy = (row + 0.5) * ch - ah / 2;
    const svg = stimDisplay.querySelector('svg');
    if (svg) svg.style.transform = `translate(${dx}px, ${dy}px)`;
    if (showLines) drawSingleGridLines(gx, gy);
    else removeSingleGridLines();
}
function pickSingleGridCell(gx, gy, rand, avoid, fx, fy, cells) {
    gx = Math.max(1, parseInt(gx) || 1);
    gy = Math.max(1, parseInt(gy) || 1);
    let allowed = [];
    if (Array.isArray(cells) && cells.length > 0)
        allowed = cells.filter(
            (c) =>
                c &&
                typeof c.row === 'number' &&
                typeof c.col === 'number' &&
                c.row >= 0 &&
                c.row < gy &&
                c.col >= 0 &&
                c.col < gx
        );
    if (allowed.length === 0)
        for (let r = 0; r < gy; r++) for (let c = 0; c < gx; c++) allowed.push({ row: r, col: c });
    if (!rand) {
        const wr = Math.max(0, Math.min(gy - 1, parseInt(fx) || 0));
        const wc = Math.max(0, Math.min(gx - 1, parseInt(fy) || 0));
        return allowed.find((c) => c.row === wr && c.col === wc) || allowed[0];
    }
    if (allowed.length === 1) return allowed[0];
    let cell,
        att = 0;
    do {
        cell = allowed[Math.floor(Math.random() * allowed.length)];
        att++;
    } while (
        avoid &&
        att < 25 &&
        cell.row === PlayerState.currentSingleCell.row &&
        cell.col === PlayerState.currentSingleCell.col &&
        allowed.length > 1
    );
    return cell;
}
function applyRandomStimulusPosition(size) {
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    const p = 20;
    const dxM = Math.max(0, (aw - size) / 2 - p),
        dyM = Math.max(0, (ah - size) / 2 - p);
    if (dxM <= 0 && dyM <= 0) return;
    const dx = (Math.random() * 2 - 1) * dxM,
        dy = (Math.random() * 2 - 1) * dyM;
    const svg = stimDisplay.querySelector('svg');
    if (svg) svg.style.transform = `translate(${dx}px, ${dy}px)`;
}


    // ==================== EXPORT ====================
    global.PlayerAnimation = {
        setCallbacks,
        startSingleStimAnimation,
        stopSingleStimAnimation,
        startSingleBgAnimation,
        stopSingleBgAnimation,
        startBlinkAnimation,
        stopBlinkAnimation,
        startCircleAnimation,
        stopCircleAnimation,
        stopPeripheralAnimation,
        buildPeripheralDots,
        buildDefocusFrame,
        removeSingleGridLines,
        drawSingleGridLines,
        applySingleGridPosition,
        pickSingleGridCell,
        applyRandomStimulusPosition
    };

    console.log('[player-animation] module installed');
})(window);
