/* app-utils.js — утилиты: сценарий, дистанция, анимации
 * §A2-v8 (Фаза 5). Экспорт: window.AppUtils
 * Зависимости: VLog, VissortCore, window.Voice, AppState
 */
(function () {
  const VLog = window.VLog;

  // === SCENARIO TIME (было app.js 487–595) ===
function estimateScenarioDurationMs() {
    if (!nodes || nodes.length === 0) return 0;
    const visited = new Set();
    let total = 0;
    const startNode = nodes.find((n) => n.isStart === true) || nodes[0];
    if (!startNode) return 0;
    function nodeDuration(node) {
        const delay1 = node.delay1 || 0;
        const duration = node.duration || 1000;
        const delay2 = node.delay2 || 1000;
        const seriesCount = node.seriesCount || 1;
        const seriesSize = node.seriesSize || 1;
        if (node.nodeType === 'READING')
            return (node.duration || 60000) + (node.delay1 || 0) + (node.delay2 || 0);
        if (node.nodeType === 'COMPARE') return (delay1 + duration + delay2) * seriesCount * seriesSize;
        let perNode = (delay1 + duration + delay2) * seriesCount * seriesSize;
        if (node.singleStimDynamicEnabled)
            perNode = Math.max(
                perNode,
                (delay1 + (node.singleStimDuration || 10000) + delay2) * seriesCount * seriesSize
            );
        if (node.singleBgDynamicEnabled)
            perNode = Math.max(
                perNode,
                (delay1 + (node.singleBgDuration || 10000) + delay2) * seriesCount * seriesSize
            );
        return perNode;
    }
    function visit(nodeId) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        const node = getNode(nodeId);
        if (!node) return;
        if (node.isActive === false && node.nodeType !== 'LOGIC_IF') return;
        total += nodeDuration(node);
        connections.filter((c) => c.fromId === nodeId && !c.isLoop).forEach((c) => visit(c.toId));
        connections
            .filter((c) => c.fromId === nodeId && c.isLoop && c.toId !== nodeId)
            .forEach((c) => {
                const lim = Math.max(1, c.loopLimit || 1);
                const target = getNode(c.toId);
                const source = getNode(c.fromId);
                if (!target) return;
                total += nodeDuration(target) * lim;
                if (source && source.id !== target.id) total += nodeDuration(source) * lim;
            });
    }
    visit(startNode.id);
    return total;
}
function formatDurationMs(ms) {
    if (!ms || ms <= 0) return '0 с';
    const totalSec = Math.round(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h} ч ${m} мин ${s} с`;
    if (m > 0) return `${m} мин ${s} с`;
    return `${s} с`;
}
function showScenarioTimeReport() {
    const modalEl = document.getElementById('scenario-time-modal');
    const body = document.getElementById('scenario-time-body');
    if (!modalEl || !body) return;
    const totalMs = estimateScenarioDurationMs();
    const rows = nodes
        .filter((n) => n.isActive !== false)
        .map((n) => {
            const type = n.nodeType || 'STIMULUS';
            const d1 = n.delay1 || 0;
            const dur = n.duration || 1000;
            const d2 = n.delay2 || 1000;
            const sc = n.seriesCount || 1;
            const ss = n.seriesSize || 1;
            let oneRoundMs, totalNodeMs;
            if (type === 'READING') {
                oneRoundMs = (n.duration || 60000) + d1 + d2;
                totalNodeMs = oneRoundMs;
            } else {
                oneRoundMs = d1 + dur + d2;
                totalNodeMs = oneRoundMs * sc * ss;
            }
            return {
                name: (n.name || '').replace(/</g, '&lt;'),
                oneRoundMs,
                totalNodeMs,
                shows: type === 'READING' ? 1 : sc * ss
            };
        });
    let html = `<div style="margin-bottom:10px;">
        <div>Узлов: <b>${nodes.length}</b> · Связей: <b>${connections.length}</b></div>
        <div style="font-size:22px;color:#a5b4fc;font-weight:800;margin-top:6px;">${formatDurationMs(totalMs)}</div>
    </div><table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="border-bottom:1px solid #3f3f46;color:#94a3b8;">
        <th style="text-align:left;padding:6px 4px;">Узел</th>
        <th style="text-align:right;padding:6px 4px;">Показов</th>
        <th style="text-align:right;padding:6px 4px;">1 показ</th>
        <th style="text-align:right;padding:6px 4px;">Всего</th></tr></thead><tbody>`;
    rows.forEach((r) => {
        html += `<tr style="border-bottom:1px solid #1e1e24;"><td style="padding:6px 4px;">${r.name}</td>
        <td style="text-align:right;padding:6px 4px;">${r.shows}</td>
        <td style="text-align:right;padding:6px 4px;color:#94a3b8;">${formatDurationMs(r.oneRoundMs)}</td>
        <td style="text-align:right;padding:6px 4px;color:#a5b4fc;font-weight:600;">${formatDurationMs(r.totalNodeMs)}</td></tr>`;
    });
    html += `</tbody></table>`;
    body.innerHTML = html;
    modalEl.style.display = 'flex';
}


  // === DISTANCE WARNING (было app.js 597–651) ===
function updateLiveDistanceIndicator() {
    const indicator = document.getElementById('live-distance-indicator');
    if (!indicator) return;
    if (currentDistanceMeters == null || !isFinite(currentDistanceMeters)) {
        indicator.style.display = 'none';
        return;
    }
    indicator.textContent = `📏 ${currentDistanceMeters.toFixed(2)} м`;
    indicator.style.display = 'block';
}
function hideLiveDistanceIndicator() {
    const i = document.getElementById('live-distance-indicator');
    if (i) i.style.display = 'none';
}
function getDistanceWarningEl() {
    let el = document.getElementById('distance-warning');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'distance-warning';
    el.style.cssText =
        'position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); padding: 22px 40px; background: rgba(220,38,38,0.92); color: #fff; font-size: 44px; font-weight: bold; border-radius: 14px; z-index: 99999; display: none; pointer-events: none; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.6); font-family: "Segoe UI",Tahoma,sans-serif; letter-spacing: 1px;';
    document.body.appendChild(el);
    return el;
}
function showDistanceWarning(kind) {
    const el = getDistanceWarningEl();
    el.textContent = kind === 'up' ? 'Не отклоняйтесь' : 'Не приближайтесь';
    el.style.background = kind === 'up' ? 'rgba(220,38,38,0.92)' : 'rgba(234,88,12,0.92)';
    el.style.display = 'block';
    if (window.Voice) window.Voice.sayKey(kind === 'up' ? 'moveUp' : 'moveBack', { cancel: true });
}
function hideDistanceWarning() {
    const el = document.getElementById('distance-warning');
    if (el) el.style.display = 'none';
    _distanceWarningKind = null;
}
function resetDistanceTracking() {
    _distanceBaseline = null;
    _distanceOutOfBoundsSince = 0;
    _distanceWarningKind = null;
    _distanceRecalcScheduled = false;
    hideDistanceWarning();
}
function setDistanceBaselineIfNeeded() {
    if (_distanceBaseline == null && currentDistanceMeters != null && isFinite(currentDistanceMeters))
        _distanceBaseline = currentDistanceMeters;
}
function evaluateDistanceDeviation() {
    if (_distanceBaseline == null || currentDistanceMeters == null || !isFinite(currentDistanceMeters))
        return 'ok';
    const dev = ((currentDistanceMeters - _distanceBaseline) / _distanceBaseline) * 100;
    if (dev > distanceToleranceIncreasePct) return 'up';
    if (dev < -distanceToleranceDecreasePct) return 'down';
    return 'ok';
}

  // === SCHEDULE VOICE COUNTDOWN (было app.js 654–684) ===
function scheduleVoiceCountdown(durationMs, p) {
    if (!window.Voice || !window.Voice.enabled) return;
    if (!durationMs || durationMs < 5000) return;
    const timers = [];
    if (durationMs - 5000 > 0) {
        timers.push(
            setTimeout(() => {
                if (!responsePhaseActive || isPaused) return;
                window.Voice.sayKey('countdown5');
            }, durationMs - 5000)
        );
    }
    [3, 2, 1].forEach((s) => {
        const at = durationMs - s * 1000;
        if (at > 0)
            timers.push(
                setTimeout(() => {
                    if (!responsePhaseActive || isPaused) return;
                    window.Voice.sayKey('countdown' + s);
                }, at)
            );
    });
    const watcher = setInterval(() => {
        if (!responsePhaseActive) {
            timers.forEach((t) => clearTimeout(t));
            clearInterval(watcher);
        }
    }, 200);
}

// ==================== КАМЕРА ====================

  // === ANIMATIONS (было app.js 685–1117) ===
function setStimColorRGB(r, g, b) {
    if (!stimDisplay) return;
    const svg = stimDisplay.querySelector('svg');
    if (!svg) return;
    const color = `rgb(${r},${g},${b})`;
    const p = svg.querySelector('path');
    if (p) p.setAttribute('fill', color);
    const c = svg.querySelector('circle');
    if (c) c.setAttribute('stroke', color);
}
// ==================== АНИМАЦИЯ КРУГА ====================
let _circleAnimId = null,
    _circleAnimStart = null;
let _circleInnerPhases = null,
    _circleOuterPhases = null;
let _circleInnerDurationMs = 10000,
    _circleOuterDurationMs = 10000;
let _circleInnerLoop = true,
    _circleOuterLoop = true;

function startCircleAnimation(node) {
    stopCircleAnimation();
    if (!stimDisplay) return;
    const svg = stimDisplay.querySelector('svg');
    if (!svg) return;
    const grads = svg.querySelectorAll('radialGradient');
    if (grads.length < 2) return;
    const outerGrad = grads[0],
        innerGrad = grads[1];
    _circleInnerPhases = buildCirclePhases(
        node.circleInnerColor1,
        node.circleInnerMidEnabled,
        node.circleInnerColor3,
        node.circleInnerColor2,
        node.circleInnerReverse
    );
    _circleOuterPhases = buildCirclePhases(
        node.circleOuterColor1,
        node.circleOuterMidEnabled,
        node.circleOuterColor3,
        node.circleOuterColor2,
        node.circleOuterReverse
    );
    _circleInnerDurationMs = Math.max(200, node.circleInnerDuration || 10000);
    _circleOuterDurationMs = Math.max(200, node.circleOuterDuration || 10000);
    _circleInnerLoop = node.circleInnerLoop !== false;
    _circleOuterLoop = node.circleOuterLoop !== false;
    _circleAnimStart = null;
    function paintGradient(gradEl, phases, cycleMs, elapsed) {
        if (!gradEl) return;
        const count = phases.length;
        if (count === 0) return;
        let t = (elapsed % cycleMs) / cycleMs;
        const pi = Math.max(0, Math.min(count - 1, Math.floor(t * count)));
        const ph = phases[pi];
        if (!ph) return;
        const stops = gradEl.querySelectorAll('stop');
        if (stops.length >= 2) {
            stops[0].setAttribute('stop-color', `rgb(${ph.from.r},${ph.from.g},${ph.from.b})`);
            if (stops.length >= 3) {
                const midCur = lerpColor(ph.from, ph.to, 0.5);
                stops[1].setAttribute('stop-color', `rgb(${midCur.r},${midCur.g},${midCur.b})`);
                stops[stops.length - 1].setAttribute('stop-color', `rgb(${ph.to.r},${ph.to.g},${ph.to.b})`);
            } else {
                stops[stops.length - 1].setAttribute('stop-color', `rgb(${ph.to.r},${ph.to.g},${ph.to.b})`);
            }
        }
    }
    function tick(now) {
        if (!playerRunning || isPaused) {
            _circleAnimId = null;
            return;
        }
        if (_circleAnimStart === null) _circleAnimStart = now;
        const elapsed = now - _circleAnimStart;
        const innerDone = !_circleInnerLoop && elapsed > _circleInnerDurationMs;
        const outerDone = !_circleOuterLoop && elapsed > _circleOuterDurationMs;
        if (innerDone && outerDone) {
            _circleAnimId = null;
            return;
        }
        if (!innerDone) paintGradient(innerGrad, _circleInnerPhases, _circleInnerDurationMs, elapsed);
        if (!outerDone) paintGradient(outerGrad, _circleOuterPhases, _circleOuterDurationMs, elapsed);
        _circleAnimId = requestAnimationFrame(tick);
    }
    _circleAnimId = requestAnimationFrame(tick);
}
function stopCircleAnimation() {
    if (_circleAnimId) {
        cancelAnimationFrame(_circleAnimId);
        _circleAnimId = null;
    }
    _circleInnerPhases = null;
    _circleOuterPhases = null;
}

// ==================== ПЕРИФЕРИЯ ====================
function getPeripheralLayer() {
    let layer = document.getElementById('peri-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'peri-layer';
        layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden;';
        if (getComputedStyle(stimArea).position === 'static') stimArea.style.position = 'relative';
        stimArea.appendChild(layer);
    }
    return layer;
}
function clearPeripheralLayer() {
    const layer = document.getElementById('peri-layer');
    if (layer) layer.innerHTML = '';
}
function stopPeripheralAnimation() {
    if (_periAnimId) {
        cancelAnimationFrame(_periAnimId);
        _periAnimId = null;
    }
    _periAnimStart = null;
    clearPeripheralLayer();
}
function buildPeripheralDots(node, stimSize) {
    clearPeripheralLayer();
    if (!node.periEnabled) return;
    const layer = getPeripheralLayer();
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    const count = Math.max(1, Math.min(12, node.periCount || 4));
    const dCalc = currentDistanceMeters || node.stimDistance || 1;
    const pCalc = node.stimPPI || screenPPI || 96;
    const sizePx = acuityToSizePx(node.periAcuity || 0.3, dCalc, pCalc);
    const half = Math.min(aw, ah) / 2;
    const rMin = ((node.periRadiusMinPct ?? 60) / 100) * half;
    const rMax = ((node.periRadiusMaxPct ?? 90) / 100) * half;
    const color = node.periColor || { r: 0, g: 255, b: 100 };
    const colorStr = `rgb(${color.r},${color.g},${color.b})`;
    const baseAngles = [];
    for (let i = 0; i < count; i++)
        baseAngles.push(node.periRandomAngles ? Math.random() * Math.PI * 2 : (i / count) * Math.PI * 2);
    const radii = baseAngles.map(() => rMin + Math.random() * (rMax - rMin));
    const cx = aw / 2,
        cy = ah / 2;
    function drawAt(t) {
        layer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            let angle = baseAngles[i];
            let scale = 1;
            if (node.periMotion === 'rotate') {
                const speed = Math.max(0.02, Math.min(2, node.periSpeed || 0.3));
                angle += (t / 1000) * speed * Math.PI * 2;
            } else if (node.periMotion === 'pulse') {
                const speed = Math.max(0.5, Math.min(5, node.periSpeed || 1));
                scale = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(angle * 3 + (t / 1000) * speed * Math.PI * 2));
            }
            const x = cx + Math.cos(angle) * radii[i];
            const y = cy + Math.sin(angle) * radii[i];
            const d = document.createElement('div');
            const s = Math.max(2, sizePx * scale);
            d.style.cssText = `position:absolute;left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;border-radius:50%;background:${colorStr};box-shadow:0 0 6px rgba(0,0,0,0.4);`;
            layer.appendChild(d);
        }
    }
    drawAt(0);
    if (node.periMotion === 'static') return;
    _periAnimStart = null;
    function tick(now) {
        if (!playerRunning || isPaused) {
            _periAnimId = null;
            return;
        }
        if (_periAnimStart === null) _periAnimStart = now;
        drawAt(now - _periAnimStart);
        _periAnimId = requestAnimationFrame(tick);
    }
    _periAnimId = requestAnimationFrame(tick);
}

// ==================== ДЕФОКУС ====================
function buildDefocusFrame(node, stimSize, stimHtml, stimDirection) {
    if (!node.dfEnabled) return null;
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return null;
    const pCalc = node.stimPPI || screenPPI || 96;
    const rMm = Math.max(5, node.dfCenterRadiusMm || 13);
    const rPx = Math.round((rMm * pCalc) / 25.4 / (window.devicePixelRatio || 1));
    const diameter = rPx * 2;
    const per = node.dfPeriBg || { r: 0, g: 71, b: 171 };
    const cb = node.dfCenterBg || { r: 204, g: 0, b: 0 };
    const sc = node.dfStimColor || { r: 0, g: 0, b: 0 };
    const blur = Math.max(0, Math.min(100, node.dfPeriBlur || 0));
    const periStyle =
        blur > 0
            ? `radial-gradient(circle at center, rgb(${per.r},${per.g},${per.b}) 0%, rgb(${per.r},${per.g},${per.b}) ${100 - blur}%, rgba(${per.r},${per.g},${per.b},0) 100%)`
            : `rgb(${per.r},${per.g},${per.b})`;
    const blackHtml = stimHtml
        .replace(/fill="rgb\(\d+,\d+,\d+\)"/g, `fill="rgb(${sc.r},${sc.g},${sc.b})"`)
        .replace(/stroke="rgb\(\d+,\d+,\d+\)"/g, `stroke="rgb(${sc.r},${sc.g},${sc.b})"`);
    const frame = document.createElement('div');
    frame.id = 'defocus-frame';
    frame.style.cssText = `position:absolute;inset:0;background:${periStyle};display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:1;`;
    const center = document.createElement('div');
    center.style.cssText = `width:${diameter}px;height:${diameter}px;border-radius:50%;background:rgb(${cb.r},${cb.g},${cb.b});display:flex;align-items:center;justify-content:center;`;
    center.innerHTML = blackHtml;
    frame.appendChild(center);
    return { html: frame, diameter };
}

// ==================== СЕТКА ОДИНОЧНОГО СТИМУЛА ====================
function removeSingleGridLines() {
    if (!stimArea) return;
    stimArea.querySelectorAll('.single-grid-overlay').forEach((el) => el.remove());
}
function drawSingleGridLines(gx, gy) {
    if (!stimArea) return;
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
    if (!stimArea || !stimDisplay) return;
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    gx = Math.max(1, parseInt(gx) || 1);
    gy = Math.max(1, parseInt(gy) || 1);
    row = Math.max(0, Math.min(gy - 1, parseInt(row) || 0));
    col = Math.max(0, Math.min(gx - 1, parseInt(col) || 0));
    const cw = aw / gx,
        ch = ah / gy;
    const tx = (col + 0.5) * cw,
        ty = (row + 0.5) * ch;
    const dx = tx - aw / 2,
        dy = ty - ah / 2;
    const svg = stimDisplay.querySelector('svg');
    if (svg) svg.style.transform = `translate(${dx}px, ${dy}px)`;
    if (showLines) drawSingleGridLines(gx, gy);
    else removeSingleGridLines();
}
function pickSingleGridCell(gx, gy, randomCell, avoidRepeat, fixedRow, fixedCol, selectedCells) {
    gx = Math.max(1, parseInt(gx) || 1);
    gy = Math.max(1, parseInt(gy) || 1);
    let allowed = [];
    if (Array.isArray(selectedCells) && selectedCells.length > 0) {
        allowed = selectedCells.filter(
            (c) =>
                c &&
                typeof c.row === 'number' &&
                typeof c.col === 'number' &&
                c.row >= 0 &&
                c.row < gy &&
                c.col >= 0 &&
                c.col < gx
        );
    }
    if (allowed.length === 0) {
        for (let r = 0; r < gy; r++) for (let c = 0; c < gx; c++) allowed.push({ row: r, col: c });
    }
    if (!randomCell) {
        const wr = Math.max(0, Math.min(gy - 1, parseInt(fixedRow) || 0));
        const wc = Math.max(0, Math.min(gx - 1, parseInt(fixedCol) || 0));
        return allowed.find((c) => c.row === wr && c.col === wc) || allowed[0];
    }
    if (allowed.length === 1) return allowed[0];
    let cell,
        attempts = 0;
    do {
        cell = allowed[Math.floor(Math.random() * allowed.length)];
        attempts++;
    } while (
        avoidRepeat &&
        attempts < 25 &&
        cell.row === currentSingleCell.row &&
        cell.col === currentSingleCell.col &&
        allowed.length > 1
    );
    return cell;
}
function applyRandomStimulusPosition(size) {
    if (!stimArea || !stimDisplay) return;
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

// ==================== ДИНАМИКА ЦВЕТА ====================
function startSingleStimAnimation(params) {
    stopSingleStimAnimation();
    if (!stimDisplay) return;
    const phases = buildGenericDynamicPhases(
        params.singleStimColor1,
        params.singleStimMidEnabled,
        params.singleStimColor3,
        params.singleStimColor2,
        params.singleStimReverse
    );
    const phaseCount = phases.length;
    if (phaseCount === 0) return;
    const totalTime = Math.max(200, params.singleStimDuration || 10000);
    const phaseDuration = totalTime / phaseCount;
    const shouldLoop = params.singleStimLoop === true;
    const cycleDurationMs = phaseDuration * phaseCount;
    const first = phases[0].from;
    setStimColorRGB(first.r, first.g, first.b);
    singleStimAnimStart = null;
    function tick(now) {
        if (!playerRunning || isPaused) {
            singleStimAnimId = null;
            return;
        }
        if (singleStimAnimStart === null) singleStimAnimStart = now;
        let elapsed = Math.max(0, now - singleStimAnimStart);
        let cycleT = elapsed / cycleDurationMs;
        if (cycleT >= 1) {
            if (shouldLoop) {
                singleStimAnimStart += Math.floor(cycleT) * cycleDurationMs;
                elapsed = Math.max(0, now - singleStimAnimStart);
                cycleT = elapsed / cycleDurationMs;
            } else {
                const last = phases[phaseCount - 1].to;
                setStimColorRGB(last.r, last.g, last.b);
                singleStimAnimId = null;
                return;
            }
        }
        cycleT = Math.max(0, cycleT);
        const phaseIdx = Math.max(0, Math.min(phaseCount - 1, Math.floor(cycleT * phaseCount)));
        const phaseProgress = Math.max(0, Math.min(1, cycleT * phaseCount - phaseIdx));
        const phase = phases[phaseIdx];
        if (!phase) {
            singleStimAnimId = null;
            return;
        }
        const cur = lerpColor(phase.from, phase.to, phaseProgress);
        setStimColorRGB(cur.r, cur.g, cur.b);
        singleStimAnimId = requestAnimationFrame(tick);
    }
    singleStimAnimId = requestAnimationFrame(tick);
}
function stopSingleStimAnimation() {
    if (singleStimAnimId) {
        cancelAnimationFrame(singleStimAnimId);
        singleStimAnimId = null;
    }
}
function startSingleBgAnimation(params) {
    stopSingleBgAnimation();
    if (!stimArea) return;
    const phases = buildGenericDynamicPhases(
        params.singleBgColor1,
        params.singleBgMidEnabled,
        params.singleBgColor3,
        params.singleBgColor2,
        params.singleBgReverse
    );
    const phaseCount = phases.length;
    if (phaseCount === 0) return;
    const totalTime = Math.max(200, params.singleBgDuration || 10000);
    const phaseDuration = totalTime / phaseCount;
    const shouldLoop = params.singleBgLoop === true;
    const cycleDurationMs = phaseDuration * phaseCount;
    const first = phases[0].from;
    stimArea.style.backgroundColor = `rgb(${first.r},${first.g},${first.b})`;
    singleBgAnimStart = null;
    function tick(now) {
        if (!playerRunning || isPaused) {
            singleBgAnimId = null;
            return;
        }
        if (singleBgAnimStart === null) singleBgAnimStart = now;
        let elapsed = Math.max(0, now - singleBgAnimStart);
        let cycleT = elapsed / cycleDurationMs;
        if (cycleT >= 1) {
            if (shouldLoop) {
                singleBgAnimStart += Math.floor(cycleT) * cycleDurationMs;
                elapsed = Math.max(0, now - singleBgAnimStart);
                cycleT = elapsed / cycleDurationMs;
            } else {
                const last = phases[phaseCount - 1].to;
                stimArea.style.backgroundColor = `rgb(${last.r},${last.g},${last.b})`;
                singleBgAnimId = null;
                return;
            }
        }
        cycleT = Math.max(0, cycleT);
        const phaseIdx = Math.max(0, Math.min(phaseCount - 1, Math.floor(cycleT * phaseCount)));
        const phaseProgress = Math.max(0, Math.min(1, cycleT * phaseCount - phaseIdx));
        const phase = phases[phaseIdx];
        if (!phase) {
            singleBgAnimId = null;
            return;
        }
        const cur = lerpColor(phase.from, phase.to, phaseProgress);
        stimArea.style.backgroundColor = `rgb(${cur.r},${cur.g},${cur.b})`;
        singleBgAnimId = requestAnimationFrame(tick);
    }
    singleBgAnimId = requestAnimationFrame(tick);
}
function stopSingleBgAnimation() {
    if (singleBgAnimId) {
        cancelAnimationFrame(singleBgAnimId);
        singleBgAnimId = null;
    }
}



  window.AppUtils = {
    estimateScenarioDurationMs, formatDurationMs, showScenarioTimeReport,
    updateLiveDistanceIndicator, hideLiveDistanceIndicator,
    getDistanceWarningEl, showDistanceWarning, hideDistanceWarning,
    resetDistanceTracking, setDistanceBaselineIfNeeded, evaluateDistanceDeviation,
    scheduleVoiceCountdown,
    setStimColorRGB, startCircleAnimation, stopCircleAnimation,
    getPeripheralLayer, clearPeripheralLayer, stopPeripheralAnimation, buildPeripheralDots,
    buildDefocusFrame, removeSingleGridLines, drawSingleGridLines,
    applySingleGridPosition, pickSingleGridCell, applyRandomStimulusPosition,
    startSingleStimAnimation, stopSingleStimAnimation,
    startSingleBgAnimation, stopSingleBgAnimation
  };

  // === Мосты для app-player-preview.js ===
  window.startSingleStimAnimation = startSingleStimAnimation;
  window.stopSingleStimAnimation = stopSingleStimAnimation;
  window.startSingleBgAnimation = startSingleBgAnimation;
  window.stopSingleBgAnimation = stopSingleBgAnimation;
  window.startCircleAnimation = startCircleAnimation;
  window.stopCircleAnimation = stopCircleAnimation;
  window.buildPeripheralDots = buildPeripheralDots;
  window.buildDefocusFrame = buildDefocusFrame;
  window.resetDistanceTracking = resetDistanceTracking;
  window.hideLiveDistanceIndicator = hideLiveDistanceIndicator;

  // === Мосты для app-blink-camera.js ===
  window.hideDistanceWarning = hideDistanceWarning;
  window.updateLiveDistanceIndicator = updateLiveDistanceIndicator;
  window.setDistanceBaselineIfNeeded = setDistanceBaselineIfNeeded;
  window.evaluateDistanceDeviation = evaluateDistanceDeviation;
  window.showDistanceWarning = showDistanceWarning;

  // === Мосты на всякий случай ===
  window.showScenarioTimeReport = showScenarioTimeReport;
  window.getDistanceWarningEl = getDistanceWarningEl;
  window.setStimColorRGB = setStimColorRGB;

  VLog.log('[app-utils] loaded, methods:', Object.keys(window.AppUtils).length);
})();
