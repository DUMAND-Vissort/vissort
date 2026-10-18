/* app-blink-camera.js — моргание + камера
 * §A2-v7 (Фаза 5). Экспорт: window.AppBlinkCamera
 * Зависимости: VLog, VissortDialog, faceapi, window.BLINK_* (через шим AppState)
 */
(function () {
  const VLog = window.VLog;


  // §A2-v7 fix: realIPD_MM (межзрачковое расстояние, мм) — потеряна при §A1
  const realIPD_MM = 63;
  const MAX_DISTANCE_LOG = 2000;
  let _blinkState = createEmptyBlinkState();
  let _blinkResponseBlockUntil = 0;
  let _blinkCalibration = null;
  let _waitingForOpenEyes = false;

  // === CREATE EMPTY BLINK STATE (было app.js 68–90) ===
function createEmptyBlinkState() {
    return {
        lastEAR: 0.3,
        lastEarL: 0.3,
        lastEarR: 0.3,
        isClosed: false,
        closeStartMs: 0,
        blinks: [],
        totalBlinks: 0,
        longBlinks: 0,
        asymBlinks: 0,
        lastBlinkMs: 0,
        warningShownAt: 0,
        sessionStartMs: 0,
        minRateObserved: null
    };
}

// Переменные диапазона 175..209 перенесены в app-state.js (2026-10-15).

window._pendingGeneratorMode = false;
window._books = window._books || {};
window._currentScenarioKey = window._currentScenarioKey || null;

  // === BLINK (было app.js 680–956) ===
function startBlinkAnimation(opts) {
    stopBlinkAnimation();
    if (!opts) return;
    const target = opts.target || 'stim';
    const A = opts.colorA || { r: 255, g: 0, b: 0 };
    const B = opts.colorB || { r: 0, g: 0, b: 255 };
    const intervalMs = Math.max(50, opts.intervalMs || 500);
    const duty = Math.max(0.05, Math.min(0.95, opts.duty ?? 0.5));
    const count = Math.max(0, opts.count || 0);
    _blinkStateLocal = { tick: 0, current: 'A' };
    function apply(color) {
        if (target === 'stim' || target === 'both') setStimColorRGB(color.r, color.g, color.b);
        if (target === 'bg' || target === 'both')
            stimArea.style.backgroundColor = `rgb(${color.r},${color.g},${color.b})`;
    }
    function tick() {
        if (!playerRunning || isPaused) {
            _blinkTimerId = null;
            return;
        }
        const isA = _blinkStateLocal.current === 'A';
        apply(isA ? A : B);
        _blinkStateLocal.tick++;
        if (count > 0 && _blinkStateLocal.tick >= count) {
            _blinkTimerId = null;
            return;
        }
        const nextIsA = !isA;
        const delay = nextIsA ? intervalMs * duty : intervalMs * (1 - duty);
        _blinkStateLocal.current = nextIsA ? 'A' : 'B';
        _blinkTimerId = setTimeout(tick, Math.max(20, delay));
    }
    _blinkTimerId = setTimeout(tick, 0);
}
function stopBlinkAnimation() {
    if (_blinkTimerId) {
        clearTimeout(_blinkTimerId);
        _blinkTimerId = null;
    }
    _blinkStateLocal = { tick: 0, current: 'A' };
}

// ==================== BLINK: EAR ====================
function computeEAR(eyePoints) {
    if (!Array.isArray(eyePoints) || eyePoints.length < 6) return 0.3;
    const [p1, p2, p3, p4, p5, p6] = eyePoints;
    const v1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
    const v2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
    const h = Math.hypot(p1.x - p4.x, p1.y - p4.y);
    if (h < 1) return 0.3;
    return (v1 + v2) / (2 * h);
}
function getBlinkWarningEl() {
    let el = document.getElementById('blink-warning');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'blink-warning';
    el.style.cssText =
        'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); padding: 12px 28px; background: rgba(14,165,233,0.92); color: #fff; font-size: 22px; font-weight: bold; border-radius: 10px; z-index: 99998; display: none; pointer-events: none; text-align: center; box-shadow: 0 6px 24px rgba(0,0,0,0.5); font-family: "Segoe UI",Tahoma,sans-serif;';
    el.textContent = 'Поморгайте';
    document.body.appendChild(el);
    return el;
}
function showBlinkWarning() {
    const el = getBlinkWarningEl();
    el.style.display = 'block';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
        el.style.display = 'none';
    }, 3500);
    if (window.Voice) window.Voice.sayKey('blink', { cancel: true });
}
function hideBlinkWarning() {
    const el = document.getElementById('blink-warning');
    if (el) el.style.display = 'none';
}
function resetBlinkState() {
    _blinkState = createEmptyBlinkState();
    _blinkState.sessionStartMs = performance.now();
    _blinkResponseBlockUntil = 0;
    _waitingForOpenEyes = false;
    hideBlinkWarning();
}
function processBlinkFrame(earL, earR) {
    if (!cameraActive) return;
    if (_blinkCalibration && _blinkCalibration.phase !== 'done') {
        const ear = (earL + earR) / 2;
        if (_blinkCalibration.phase === 'open') _blinkCalibration.openSamples.push(ear);
        else if (_blinkCalibration.phase === 'closed') _blinkCalibration.closedSamples.push(ear);
        return;
    }
    if (!blinkEnabled) return;
    const now = performance.now();
    const ear = (earL + earR) / 2;
    _blinkState.lastEAR = ear;
    _blinkState.lastEarL = earL;
    _blinkState.lastEarR = earR;
    const closedNow = ear < blinkThreshold;
    if (_waitingForOpenEyes && !closedNow) _waitingForOpenEyes = false;
    if (closedNow && !_blinkState.isClosed) {
        _blinkState.isClosed = true;
        _blinkState.closeStartMs = now;
    } else if (!closedNow && _blinkState.isClosed) {
        const duration = now - _blinkState.closeStartMs;
        const minL = Math.min(earL, _blinkState.lastEarL);
        const minR = Math.min(earR, _blinkState.lastEarR);
        _blinkState.isClosed = false;
        _blinkState.closeStartMs = 0;
        if (duration >= BLINK_SHORT_MS && duration <= BLINK_AUTOPAUSE_MS) {
            const maxEar = Math.max(minL, minR, 0.01);
            const minEar = Math.min(minL, minR);
            const asym = minEar / maxEar;
            const isAsym = asym < BLINK_ASYM_RATIO;
            const kind = duration > BLINK_LONG_MS ? 'long' : isAsym ? 'asym' : 'normal';
            _blinkState.blinks.push({ ts: now, durationMs: duration, earL: minL, earR: minR, asym, kind });
            _blinkState.totalBlinks++;
            if (kind === 'long') _blinkState.longBlinks++;
            if (kind === 'asym') _blinkState.asymBlinks++;
            _blinkState.lastBlinkMs = now;
            _blinkResponseBlockUntil = now + BLINK_BLOCK_MS;
        }
    }
    if (_blinkState.isClosed && _blinkState.closeStartMs > 0) {
        const closedDur = now - _blinkState.closeStartMs;
        if (closedDur > BLINK_AUTOPAUSE_MS && playerRunning && !isPaused) {
            _blinkState.isClosed = false;
            _blinkState.closeStartMs = 0;
            pauseTraining();
            return;
        }
    }
    const windowStart = now - blinkWindowSec * 1000;
    _blinkState.blinks = _blinkState.blinks.filter((b) => b.ts >= windowStart);
    if (playerRunning && !isPaused) {
        const elapsedInWindowSec = Math.min(blinkWindowSec, (now - _blinkState.sessionStartMs) / 1000);
        if (elapsedInWindowSec > blinkWindowSec / 2) {
            const expectedSoFar = blinkMinRate * (elapsedInWindowSec / 60);
            if (_blinkState.blinks.length < expectedSoFar) {
                if (now - _blinkState.warningShownAt > 12000) {
                    showBlinkWarning();
                    _blinkState.warningShownAt = now;
                }
            }
            const observedRate = (_blinkState.blinks.length / Math.max(1, elapsedInWindowSec)) * 60;
            if (_blinkState.minRateObserved == null || observedRate < _blinkState.minRateObserved)
                _blinkState.minRateObserved = observedRate;
        }
    }
}
function isBlinkResponseBlocked() {
    return performance.now() < _blinkResponseBlockUntil;
}
function areEyesClosedNow() {
    return blinkEnabled && _blinkState.isClosed === true;
}
function ensureBlinkCalibrationUI() {
    let btn = document.getElementById('btn-calibrate-blink');
    if (!btn) {
        const anchor = document.getElementById('btn-calibrate-camera');
        if (anchor && anchor.parentNode) {
            btn = document.createElement('button');
            btn.className = 'btn btn-warning btn-icon';
            btn.id = 'btn-calibrate-blink';
            btn.title = 'Калибровка моргания';
            btn.disabled = true;
            btn.textContent = '👁️';
            anchor.parentNode.insertBefore(btn, anchor.nextSibling);
            btn.addEventListener('click', startBlinkCalibration);
        }
    }
    if (!document.getElementById('blink-calibration-modal')) {
        const m = document.createElement('div');
        m.className = 'modal';
        m.id = 'blink-calibration-modal';
        m.innerHTML = `<div class="modal-content" style="width: 480px; text-align: center;">
            <h3>👁️ Калибровка моргания</h3>
            <p style="font-size: 13px; color: #ccc;">Смотрите прямо в камеру. Две фазы по 3 секунды.</p>
            <div id="blink-calib-phase" style="font-size: 20px; font-weight: bold; color: #38bdf8; margin: 16px 0;">Приготовьтесь…</div>
            <div id="blink-calib-countdown" style="font-size: 64px; font-weight: bold; color: #fff; margin: 16px 0;">—</div>
            <div id="blink-calib-result" style="font-size: 13px; color: #94a3b8; margin-top: 10px;">Текущий порог EAR: ${blinkThreshold.toFixed(3)}</div>
            <div class="modal-footer" style="justify-content: center;">
                <button class="btn btn-secondary" id="blink-calib-cancel">Отмена</button>
            </div></div>`;
        document.body.appendChild(m);
        document.getElementById('blink-calib-cancel').addEventListener('click', cancelBlinkCalibration);
    }
}
function startBlinkCalibration() {
    if (!cameraActive) {
        VissortDialog.alert('Включите камеру');
        return;
    }
    ensureBlinkCalibrationUI();
    _blinkCalibration = {
        phase: 'open',
        phaseStartMs: performance.now(),
        openSamples: [],
        closedSamples: []
    };
    document.getElementById('blink-calibration-modal').style.display = 'flex';
    document.getElementById('blink-calib-result').textContent = 'Собираем данные…';
    runBlinkCalibrationPhase('open');
}
function runBlinkCalibrationPhase(phase) {
    const phaseEl = document.getElementById('blink-calib-phase');
    const countEl = document.getElementById('blink-calib-countdown');
    const PHASE_MS = 3000;
    const startMs = performance.now();
    _blinkCalibration.phase = phase;
    if (phase === 'open') {
        phaseEl.textContent = 'Смотрите прямо, глаза ОТКРЫТЫ';
        phaseEl.style.color = '#22c55e';
    } else {
        phaseEl.textContent = 'Закройте глаза (как при моргании)';
        phaseEl.style.color = '#ef4444';
    }
    function tick() {
        if (!_blinkCalibration) return;
        const elapsed = performance.now() - startMs;
        countEl.textContent = Math.max(0, Math.ceil((PHASE_MS - elapsed) / 1000));
        if (elapsed >= PHASE_MS) {
            if (phase === 'open') runBlinkCalibrationPhase('closed');
            else finishBlinkCalibration();
            return;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}
function finishBlinkCalibration() {
    if (!_blinkCalibration) return;
    const { openSamples, closedSamples } = _blinkCalibration;
    if (openSamples.length < 5 || closedSamples.length < 5) {
        VissortDialog.alert('Недостаточно данных с камеры. Убедитесь, что лицо видно, и повторите.');
        cancelBlinkCalibration();
        return;
    }
    const meanOpen = openSamples.reduce((a, b) => a + b, 0) / openSamples.length;
    const meanClosed = closedSamples.reduce((a, b) => a + b, 0) / closedSamples.length;
    if (meanOpen <= meanClosed) {
        VissortDialog.alert('Значения нелогичны. Повторите калибровку.');
        cancelBlinkCalibration();
        return;
    }
    let th = (meanOpen + meanClosed) / 2;
    th = Math.max(0.12, Math.min(0.35, th));
    blinkThreshold = Math.round(th * 1000) / 1000;
    saveUserSettings();
    const r = document.getElementById('blink-calib-result');
    if (r)
        r.innerHTML = `Открытые: <b>${meanOpen.toFixed(3)}</b> · Закрытые: <b>${meanClosed.toFixed(3)}</b><br>Новый порог EAR: <b style="color:#22c55e;">${blinkThreshold.toFixed(3)}</b>`;
    _blinkCalibration = null;
    setTimeout(() => {
        document.getElementById('blink-calibration-modal').style.display = 'none';
    }, 1800);
}
function cancelBlinkCalibration() {
    _blinkCalibration = null;
    const m = document.getElementById('blink-calibration-modal');
    if (m) m.style.display = 'none';
}
function buildBlinkReport() {
    if (!blinkEnabled || !cameraActive) return '';
    const s = _blinkState;
    const durSec = Math.max(1, (performance.now() - s.sessionStartMs) / 1000);
    const avgRate = (s.totalBlinks / durSec) * 60;
    const avgDur = s.blinks.length > 0 ? s.blinks.reduce((a, b) => a + b.durationMs, 0) / s.blinks.length : 0;
    const lines = [
        `👁️ Моргания: всего ${s.totalBlinks}`,
        `Средняя частота: ${avgRate.toFixed(1)}/мин`,
        `Минимум: ${s.minRateObserved != null ? s.minRateObserved.toFixed(1) : '—'}/мин`
    ];
    if (s.longBlinks > 0) lines.push(`Долгих (>${BLINK_LONG_MS} мс): ${s.longBlinks}`);
    if (s.asymBlinks > 0) lines.push(`Асимметричных: ${s.asymBlinks}`);
    if (avgDur > 0) lines.push(`Средняя длительность: ${avgDur.toFixed(0)} мс`);
    return '\n\n' + lines.join('\n');
}

  // === CAMERA (было app.js 988–1221) ===
async function loadFaceApiModels() {
    if (faceapi.tf) {
        try {
            await faceapi.tf.setBackend('cpu');
            await faceapi.tf.ready();
        } catch (e) {}
    }
    const M = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
    await faceapi.nets.tinyFaceDetector.loadFromUri(M);
    await faceapi.nets.faceLandmark68Net.loadFromUri(M);
}
async function enableCamera() {
    if (cameraActive) return;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } }
        });
        const h = document.getElementById('hidden-video');
        h.srcObject = videoStream;
        await h.play();
        cameraActive = true;
        await loadFaceApiModels();
        document.getElementById('camera-status').textContent = 'Камера включена';
        btnCalibrate.disabled = false;
        const bc = document.getElementById('btn-calibrate-blink');
        if (bc) bc.disabled = false;
        btnEnableCamera.style.display = 'none';
        btnDisableCamera.style.display = 'inline-block';
        if (videoFrameId) cancelAnimationFrame(videoFrameId);
        videoFrameId = requestAnimationFrame(processVideoFrame);
    } catch (err) {
        VissortDialog.alert('Ошибка камеры: ' + err.message);
    }
}
async function disableCamera() {
    if (videoFrameId) {
        cancelAnimationFrame(videoFrameId);
        videoFrameId = null;
    }
    if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
        videoStream = null;
    }
    document.getElementById('hidden-video').srcObject = null;
    cameraActive = false;
    document.getElementById('camera-status').textContent = 'Камера выключена';
    const fs = document.getElementById('face-status');
    fs.textContent = '—';
    fs.className = 'face-missing';
    document.getElementById('distance-display').textContent = '—';
    btnCalibrate.disabled = true;
    const bc = document.getElementById('btn-calibrate-blink');
    if (bc) bc.disabled = true;
    btnEnableCamera.style.display = 'inline-block';
    btnDisableCamera.style.display = 'none';
    hideLiveDistanceIndicator();
    hideDistanceWarning();
    hideBlinkWarning();
}
function recalcSizesForNewDistance() {
    if (currentDistanceMeters == null || !isFinite(currentDistanceMeters)) return;
    _distanceBaseline = currentDistanceMeters;
    _distanceOutOfBoundsSince = 0;
    hideDistanceWarning();
    if (!playerRunning) return;
    if (currentPlayingNodeId) {
        const node = getNode(currentPlayingNodeId);
        if (node && node.nodeType === 'STIMULUS') {
            const ppi = node.stimPPI || screenPPI || 96;
            const ns = acuityToSizePx(nodeAcuityCurrent, currentDistanceMeters, ppi);
            currentSize = ns;
            const svg = stimDisplay.querySelector('svg');
            if (svg) {
                svg.setAttribute('width', ns);
                svg.setAttribute('height', ns);
                svg.setAttribute('viewBox', `0 0 ${ns} ${ns}`);
            }
        }
        return;
    }
    if (trainingNode?.params?.trainingType === 'single') {
        currentSize = acuityToSizePx(currentAcuity, currentDistanceMeters, screenPPI);
        const svg = stimDisplay.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', currentSize);
            svg.setAttribute('height', currentSize);
            svg.setAttribute('viewBox', `0 0 ${currentSize} ${currentSize}`);
        }
        return;
    }
    if (readingViewportEl && readingViewportEl.style.display === 'block' && readingContentEl) {
        const node = readingCurrentNode || getNode(window._currentReadingNodeId);
        const V = node?.readingAcuity || currentAcuity || 1.0;
        const ppi = node?.readingPPI || screenPPI || 96;
        readingContentEl.style.fontSize = acuityToFontSizePx(V, currentDistanceMeters, ppi) + 'px';
        setTimeout(() => {
            setupReadingColumns();
            readingTotalPages = calcReadingTotalPages();
            scrollReadingToPage(readingPage);
        }, 60);
    }
}
let _frameSkipCounter = 0;
async function processVideoFrame() {
    if (!cameraActive) {
        videoFrameId = null;
        return;
    }
    if ((_frameSkipCounter = (_frameSkipCounter + 1) % 2) !== 0) {
        videoFrameId = requestAnimationFrame(processVideoFrame);
        return;
    }
    const v = document.getElementById('hidden-video');
    if (v.readyState >= 2 && v.videoWidth > 0 && !v.paused) {
        try {
            const det = await faceapi
                .detectSingleFace(
                    v,
                    new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
                )
                .withFaceLandmarks();
            const faceStatus = document.getElementById('face-status');
            const calibInd = document.getElementById('calib-face-indicator');
            if (det && det.landmarks) {
                const le = det.landmarks.getLeftEye(),
                    re = det.landmarks.getRightEye();
                const lc = { x: (le[0].x + le[3].x) / 2, y: (le[0].y + le[3].y) / 2 };
                const rc = { x: (re[0].x + re[3].x) / 2, y: (re[0].y + re[3].y) / 2 };
                const ipd = Math.sqrt((rc.x - lc.x) ** 2 + (rc.y - lc.y) ** 2);
                lastEyeDistancePx = ipd;
                faceStatus.textContent = '✅ Лицо';
                faceStatus.className = 'face-detected';
                if (calibInd) {
                    calibInd.textContent = '✅ Лицо';
                    calibInd.className = 'calib-face-indicator detected';
                }
                const earL = computeEAR(le),
                    earR = computeEAR(re);
                processBlinkFrame(earL, earR);
                if (ipd > 0 && focalLengthPx) {
                    currentDistanceMeters = (realIPD_MM * focalLengthPx) / ipd / 1000;
                    document.getElementById('distance-display').textContent =
                        currentDistanceMeters.toFixed(2) + ' м';
                    if (distanceMin === null || currentDistanceMeters < distanceMin)
                        distanceMin = currentDistanceMeters;
                    if (distanceMax === null || currentDistanceMeters > distanceMax)
                        distanceMax = currentDistanceMeters;
                    distanceSum += currentDistanceMeters;
                    distanceCount++;
                    const now = performance.now();
                    if (now - distanceLastUpdate > 1000) {
                        distanceLog.push({ time: new Date().toISOString(), meters: currentDistanceMeters });
                        if (distanceLog.length > MAX_DISTANCE_LOG)
                            distanceLog.splice(0, distanceLog.length - MAX_DISTANCE_LOG);
                        distanceLastUpdate = now;
                    }
                    if (playerRunning) updateLiveDistanceIndicator();
                    if (playerRunning && !isPaused) {
                        setDistanceBaselineIfNeeded();
                        const state = evaluateDistanceDeviation();
                        if (state === 'ok') {
                            _distanceOutOfBoundsSince = 0;
                            if (_distanceWarningKind) hideDistanceWarning();
                            _distanceRecalcScheduled = false;
                        } else {
                            if (_distanceWarningKind !== state) {
                                showDistanceWarning(state);
                                _distanceWarningKind = state;
                                _distanceOutOfBoundsSince = performance.now();
                                _distanceRecalcScheduled = false;
                            }
                            const el = (performance.now() - _distanceOutOfBoundsSince) / 1000;
                            if (
                                distanceRestoreTimeoutSec > 0 &&
                                el >= distanceRestoreTimeoutSec &&
                                !_distanceRecalcScheduled
                            ) {
                                _distanceRecalcScheduled = true;
                                recalcSizesForNewDistance();
                            }
                        }
                    }
                } else {
                    document.getElementById('distance-display').textContent = focalLengthPx
                        ? '—'
                        : 'Требуется калибровка';
                }
            } else {
                faceStatus.textContent = '❌ Нет лица';
                faceStatus.className = 'face-missing';
                if (calibInd) {
                    calibInd.textContent = '❌ Нет лица';
                    calibInd.className = 'calib-face-indicator missing';
                }
                document.getElementById('distance-display').textContent = '—';
                _blinkState.isClosed = false;
                _blinkState.closeStartMs = 0;
            }
        } catch (e) {
            console.error(e);
        }
    }
    if (cameraActive) videoFrameId = requestAnimationFrame(processVideoFrame);
    else videoFrameId = null;
}
function openCalibrationModal() {
    if (!cameraActive) {
        VissortDialog.alert('Включите камеру');
        return;
    }
    document.getElementById('calibration-video').srcObject = videoStream;
    document.getElementById('calibration-modal').style.display = 'flex';
}
function calibrateFocalLength() {
    if (!cameraActive) {
        VissortDialog.alert('Камера не включена');
        return;
    }
    if (!lastEyeDistancePx) {
        VissortDialog.alert('Лицо не найдено');
        return;
    }
    const cm = parseFloat(document.getElementById('calib-distance').value);
    if (isNaN(cm) || cm <= 0) {
        VissortDialog.alert('Неверное расстояние');
        return;
    }
    focalLengthPx = (lastEyeDistancePx * cm * 10) / realIPD_MM;
    localStorage.setItem('focalLengthPx', focalLengthPx);
    VissortDialog.alert('Калибровка камеры завершена!');
    document.getElementById('calibration-modal').style.display = 'none';
}

// ==================== SVG-СТИМУЛЫ ====================

  window.AppBlinkCamera = {
    createEmptyBlinkState,
    startBlinkAnimation, stopBlinkAnimation, computeEAR,
    getBlinkWarningEl, showBlinkWarning, hideBlinkWarning,
    resetBlinkState, processBlinkFrame,
    isBlinkResponseBlocked, areEyesClosedNow,
    ensureBlinkCalibrationUI, startBlinkCalibration,
    runBlinkCalibrationPhase, finishBlinkCalibration,
    cancelBlinkCalibration, buildBlinkReport,
    loadFaceApiModels, enableCamera, disableCamera,
    recalcSizesForNewDistance, processVideoFrame,
    openCalibrationModal, calibrateFocalLength
  };

  VLog.log('[app-blink-camera] loaded, methods:', Object.keys(window.AppBlinkCamera).length);
})();
