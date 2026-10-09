// ============================================================
// player-camera.js
// Логика камеры: детекция лица, дистанция, устойчивость.
// Зависит от PlayerState (глобальное состояние).
// Вызывает плеер через callbacks (регистрируются в player-runtime.js).
// ============================================================
(function (global) {
    'use strict';

    if (!global.PlayerState) {
        throw new Error('[player-camera] PlayerState not loaded. Include <script src="player-state.js"></script> BEFORE player-camera.js.');
    }
    const PS = global.PlayerState;

    // Callbacks, регистрируются из player-runtime.js
    let _callbacks = {
        onStimulusHide: () => {},
        onAbortStimulus: () => {},
        onResume: () => {},
        onRecalcSize: () => {}
    };

    function setCallbacks(cb) {
        _callbacks = Object.assign({}, _callbacks, cb || {});
    }

    // ==================== DEVICE CONFIG ====================
    const _camDevice = (function () {
        var ua = navigator.userAgent || '';
        var isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) && !/Mobile/i.test(ua);
        var isPhone = /Android|iPhone|iPod|Mobile|Opera Mini|IEMobile/i.test(ua) && !isTablet;
        return {
            isPhone: isPhone,
            isTablet: isTablet,
            isDesktop: !isPhone && !isTablet,
            label: isPhone ? 'phone' : (isTablet ? 'tablet' : 'desktop')
        };
    })();

    const _camConfig = _camDevice.isPhone
        ? { inputSize: 320, intervalMs: 300, videoW: 320, videoH: 240, frameRate: 15 }
        : _camDevice.isTablet
        ? { inputSize: 320, intervalMs: 200, videoW: 480, videoH: 360, frameRate: 20 }
        : { inputSize: 320, intervalMs: 200, videoW: 480, videoH: 360, frameRate: 24 };

    let _camLoopStarted = false;

    window.camStats = {
        device: _camDevice.label,
        backend: 'unknown',
        inputSize: _camConfig.inputSize,
        intervalMs: _camConfig.intervalMs,
        videoW: _camConfig.videoW,
        videoH: _camConfig.videoH,
        frames: 0,
        detections: 0,
        fails: 0,
        totalDetectMs: 0,
        avgDetectMs: 0,
        fps: 0,
        fpsSamples: [],
        lastFpsUpdate: 0
    };

    window.camReport = function () {
        var s = window.camStats;
        console.log('=== CAMERA STATS ===');
        console.log('Device      :', s.device);
        console.log('Backend     :', s.backend);
        console.log('Input size  :', s.inputSize + 'x' + s.inputSize);
        console.log('Interval    :', s.intervalMs + ' ms');
        console.log('Video       :', s.videoW + 'x' + s.videoH);
        console.log('Detections  :', s.detections);
        console.log('Fails       :', s.fails);
        console.log('Avg detect  :', s.avgDetectMs.toFixed(1) + ' ms');
        console.log('Last FPS    :', s.fps);
        return s;
    };

    console.log('[cam] config:', JSON.stringify({
        device: _camDevice.label,
        inputSize: _camConfig.inputSize,
        intervalMs: _camConfig.intervalMs,
        video: _camConfig.videoW + 'x' + _camConfig.videoH
    }));

    // ==================== FACE DETECTION UI ====================
    function _faceEmoji(rate, hasFaceNow) {
        if (!hasFaceNow && rate < 40) return { icon: '❌', color: '#ef4444', label: 'нет лица / далеко' };
        if (rate < 40) return { icon: '❌', color: '#ef4444', label: 'далеко' };
        if (rate < 80) return { icon: '🙂', color: '#f59e0b', label: 'нестабильно' };
        return { icon: '😊', color: '#22c55e', label: 'устойчиво' };
    }

    function _pushDetection(found) {
        PS._detWindow.push(found ? 1 : 0);
        if (PS._detWindow.length > PS._DET_WINDOW_SIZE) PS._detWindow.shift();
        _updateDetectUI();
    }

    function _detectRatePct() {
        if (PS._detWindow.length === 0) return 100;
        var sum = 0;
        for (var i = 0; i < PS._detWindow.length; i++) sum += PS._detWindow[i];
        return Math.round(sum / PS._detWindow.length * 100);
    }

    function _updateDetectUI() {
        var el = document.getElementById('v-detect');
        var rate = _detectRatePct();
        var detCount = 0;
        for (var i = 0; i < PS._detWindow.length; i++) detCount += PS._detWindow[i];
        var hasFaceNow = PS._detWindow.length > 0 && PS._detWindow[PS._detWindow.length - 1] === 1;
        var em = _faceEmoji(rate, hasFaceNow);
        if (el) {
            el.textContent = em.icon + ' ' + rate + '% (' + detCount + '/' + PS._detWindow.length + ') · ' + em.label;
            el.style.color = em.color;
        }
        var _fs = document.getElementById('stim-face-status');
        if (_fs) {
            _fs.textContent = em.icon + ' ' + em.label;
            _fs.style.background = em.color === '#22c55e' ? 'rgba(16,185,129,0.9)' :
                                    em.color === '#f59e0b' ? 'rgba(234,88,12,0.9)' :
                                                             'rgba(220,38,38,0.9)';
        }
        var _ci = document.getElementById('cam-indicator');
        if (_ci) {
            _ci.textContent = em.icon + ' ' + rate + '%';
            _ci.style.color = em.color;
        }
        if (!PS._distWarnArmed && rate >= PS._minDetectPct + 10) {
            PS._distWarnArmed = true;
        }
        if (PS._detWindow.length >= PS._DET_WINDOW_SIZE && PS._distWarnArmed && rate < PS._minDetectPct && detCount >= 3) {
            if (PS._lastSeenDist != null && PS._lastSeenDist < 0.85) return;
            var now = performance.now();
            if (now - PS._lastDistWarnAt > 8000) {
                PS._lastDistWarnAt = now;
                PS._distWarnArmed = false;
                if (global.PlayerDistWarning) global.PlayerDistWarning.showDistWarning();
            }
        }
    }

    function _checkHardLimit() {
        if (PS.curDistanceM == null) return true;
        if (PS.curDistanceM > 1.0) {
            if (global.PlayerDistWarning) global.PlayerDistWarning.showDistHardBanner();
            return false;
        }
        if (global.PlayerDistWarning) global.PlayerDistWarning.hideDistHardBanner();
        return true;
    }

    // ==================== CAMERA LIFECYCLE ====================
    const _camIndicator = () => document.getElementById('cam-indicator');

    async function loadFaceApi() {
        if (faceapi.tf) {
            var _actual = 'none';
            try {
                if (faceapi.tf.wasm) {
                    var _wasmDir = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@1.7.4/dist/';
                    if (typeof faceapi.tf.wasm.setWasmPath === 'function') faceapi.tf.wasm.setWasmPath(_wasmDir);
                    else if (typeof faceapi.tf.wasm.setWasmPaths === 'function') faceapi.tf.wasm.setWasmPaths(_wasmDir);
                    await faceapi.tf.setBackend('wasm');
                    await faceapi.tf.ready();
                    _actual = (faceapi.tf.getBackend && faceapi.tf.getBackend()) || 'unknown';
                    if (_actual !== 'wasm') _actual = 'none';
                }
            } catch (e) {
                console.warn('[cam] wasm backend failed:', e && e.message ? e.message : e);
            }
            if (_actual !== 'wasm') {
                try {
                    await faceapi.tf.setBackend('cpu');
                    await faceapi.tf.ready();
                    _actual = 'cpu';
                } catch (e) {
                    console.warn('[cam] cpu backend also failed:', e && e.message ? e.message : e);
                }
            }
            window.camStats.backend = _actual;
            console.log('[cam] backend =', _actual);
        }
        const M = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
        await faceapi.nets.tinyFaceDetector.loadFromUri(M);
        await faceapi.nets.faceLandmark68Net.loadFromUri(M);
    }

    function startCamLoop() {
        if (_camLoopStarted) return;
        _camLoopStarted = true;
        if (PS.camFrameId) clearInterval(PS.camFrameId);
        PS.camFrameId = setInterval(function () {
            if (PS.camActive) processCamFrame();
        }, _camConfig.intervalMs);
        console.log('[cam] loop started @', _camConfig.intervalMs, 'ms');
    }

    async function enableCamera() {
        if (!PS.focalLengthPx || PS.focalLengthPx <= 0) {
            var _lsFocal = parseFloat(localStorage.getItem('focalLengthPx') || '0');
            if (_lsFocal > 0) {
                PS.focalLengthPx = _lsFocal;
            } else {
                console.warn('[cam] focalLengthPx missing -- distance disabled');
            }
        }
        if (PS.camActive) return;
        try {
            PS.camStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: _camConfig.videoW, max: _camConfig.videoW },
                    height: { ideal: _camConfig.videoH, max: _camConfig.videoH },
                    frameRate: { ideal: _camConfig.frameRate, max: _camConfig.frameRate + 4 }
                }
            });
            const v = document.createElement('video');
            v.id = 'hidden-video';
            v.autoplay = true;
            v.muted = true;
            v.playsInline = true;
            v.setAttribute('playsinline', '');
            v.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;height:240px;opacity:0;pointer-events:none;';
            v.srcObject = PS.camStream;
            document.body.appendChild(v);
            await v.play();
            PS.camActive = true;
            await loadFaceApi();
            const ci = _camIndicator();
            if (ci) {
                ci.style.display = 'block';
                ci.textContent = '📷 Лицо не найдено';
            }
            startCamLoop();
        } catch (e) {
            console.warn('[cam]', e);
        }
    }

    async function processCamFrame() {
        if (!PS.camActive) {
            PS.camFrameId = null;
            return;
        }
        if (window._camDetecting) return;
        const v = document.getElementById('hidden-video');
        if (v && v.readyState >= 2 && v.videoWidth > 0 && !v.paused) {
            window._camDetecting = true;
            const tStart = performance.now();
            window.camStats.frames++;
            try {
                const det = await faceapi.detectSingleFace(v, new faceapi.TinyFaceDetectorOptions({ inputSize: _camConfig.inputSize, scoreThreshold: 0.25 }));
                const tDetect = performance.now() - tStart;
                window.camStats.detections++;
                window.camStats.totalDetectMs += tDetect;
                window.camStats.avgDetectMs = window.camStats.totalDetectMs / window.camStats.detections;
                const now = performance.now();
                if (now - window.camStats.lastFpsUpdate >= 1000) {
                    window.camStats.fpsSamples.push(window.camStats.frames);
                    if (window.camStats.fpsSamples.length > 10) window.camStats.fpsSamples.shift();
                    window.camStats.fps = window.camStats.frames;
                    window.camStats.frames = 0;
                    window.camStats.lastFpsUpdate = now;
                }
                if (det && det.box) {
                    const ipd = det.box.width * 0.45;
                    PS.lastEyeDistPx = ipd;
                    window._faceLostSince = 0;
                    const ci = _camIndicator();
                    if (ci) ci.textContent = '✅ Лицо';
                    _pushDetection(true);
                    if (PS.curDistanceM != null) PS._lastSeenDist = PS.curDistanceM;
                    if (ipd > 0 && PS.focalLengthPx) {
                        PS.curDistanceM = (63 * PS.focalLengthPx) / ipd / 1000;
                        if (PS.curDistanceM > 0.3 && PS.curDistanceM < 5) PS.curDistanceM = global.PlayerUtils.smoothDistance(PS.curDistanceM);
                        if (PS._stimulusDistance && PS.curDistanceM && PS.camBaseline != null) {
                            var _dev = Math.abs((PS.curDistanceM - PS._stimulusDistance) / PS._stimulusDistance * 100);
                            if (_dev > 15) {
                                if (PS.responsePhaseActive || !PS._waitingStable) {
                                    _callbacks.onStimulusHide();
                                    PS.responsePhaseActive = false;
                                    const rb = document.getElementById('response-buttons');
                                    if (rb) rb.style.display = 'none';
                                    if (PS.currentShowTimer) { clearTimeout(PS.currentShowTimer); PS.currentShowTimer = null; }
                                    if (PS.phaseTimers && PS.phaseTimers.length) {
                                        for (var _i = 0; _i < PS.phaseTimers.length; _i++) clearTimeout(PS.phaseTimers[_i]);
                                        PS.phaseTimers.length = 0;
                                    }
                                    PS._waitingStable = true;
                                    PS._stableSince = 0;
                                    PS._stableBuf = [];
                                }
                            }
                        }
                        if (PS._waitingStable && PS.curDistanceM) {
                            PS._stableBuf.push(PS.curDistanceM);
                            if (PS._stableBuf.length > 5) PS._stableBuf.shift();
                            if (PS._stableBuf.length === 5) {
                                var _mn = Math.min.apply(null, PS._stableBuf);
                                var _mx = Math.max.apply(null, PS._stableBuf);
                                if ((_mx - _mn) / _mn * 100 < 3) {
                                    if (!PS._stableSince) PS._stableSince = performance.now();
                                    if (performance.now() - PS._stableSince >= 1000) {
                                        _callbacks.onResume();
                                    }
                                } else {
                                    PS._stableSince = 0;
                                }
                            }
                        }
                        if (ci) ci.textContent = '📏 ' + PS.curDistanceM.toFixed(2) + ' м';
                        evaluateDistance();
                    }
                } else {
                    if (PS.playerRunning && !PS.isPaused && PS.camBaseline != null) {
                        if (!window._faceLostSince) window._faceLostSince = performance.now();
                        var _flDur = performance.now() - window._faceLostSince;
                        if (_flDur > 1500) {
                            window._fastLeanAt = performance.now();
                            if (window._recordDeviation) window._recordDeviation(-40);
                            if (!PS._waitingStable) _callbacks.onAbortStimulus('face_lost');
                        }
                    }
                    const ci = _camIndicator();
                    if (ci) ci.textContent = '❌ Нет лица';
                    _pushDetection(false);
                }
            } catch (e) {
                window.camStats.fails++;
                console.warn('[cam] detect error:', e && e.message ? e.message : e);
            }
            window._camDetecting = false;
        }
    }

    function evaluateDistance() {
        if (!PS.playerRunning || PS.isPaused || PS.curDistanceM == null) return;
        if (PS.camBaseline == null) {
            if (!window._baselineWaitStart) window._baselineWaitStart = performance.now();
            var _bw = performance.now() - window._baselineWaitStart;
            if (_bw > 3000) {
                PS.camBaseline = PS.curDistanceM;
                window._fastLeanAt = 0;
                window._deviationHistory = [];
            }
        }
        if (PS.camBaseline == null || !isFinite(PS.camBaseline) || PS.camBaseline <= 0.1) return;
        const dev = ((PS.curDistanceM - PS.camBaseline) / PS.camBaseline) * 100;
        if (PS.playerRunning && !PS.isPaused) {
            if (window._recordDeviation) window._recordDeviation(dev);
            if (window._updateStimulusDim) window._updateStimulusDim();
            // Порог в см → процент от baseline.
            var _baselineCm = PS.camBaseline ? PS.camBaseline * 100 : 100;
            var _tolNearPct = ((PS._tolNearCm || 10) * 100) / _baselineCm;
            var _tolFarPct = ((PS._tolFarCm || 15) * 100) / _baselineCm;
            var _tol = dev < 0 ? _tolNearPct : _tolFarPct;

            if (Math.abs(dev) > _tol) {
                // Hard limit: если дистанция > 1.0 м — всегда отменяем (C1)
                if (PS.curDistanceM > 1.0) {
                    if (!PS._waitingStable) _callbacks.onAbortStimulus(dev < 0 ? 'deviation_near' : 'deviation_far');
                } else if (PS._distControlMode === 'auto') {
                    // Авто-пересчёт: не отменять, а пересчитать размер
                    if (typeof _callbacks.onRecalcSize === 'function') _callbacks.onRecalcSize();
                } else {
                    // Возврат (по умолчанию): отменить показ
                    if (!PS._waitingStable) _callbacks.onAbortStimulus(dev < 0 ? 'deviation_near' : 'deviation_far');
                }
            }
        }
        const upTol = (PS.userScenario && PS.userScenario.params && PS.userScenario.params.distanceToleranceIncreasePct) || 15;
        const dnTol = (PS.userScenario && PS.userScenario.params && PS.userScenario.params.distanceToleranceDecreasePct) || 10;
        const ci = _camIndicator();
        if (!ci) return;
        if (dev > upTol) {
            if (PS.camWarnKind !== 'up') {
                PS.camWarnKind = 'up';
                ci.style.color = '#ff6666';
                ci.textContent = '📏 Не отклоняйтесь';
            }
        } else if (dev < -dnTol) {
            if (PS.camWarnKind !== 'down') {
                PS.camWarnKind = 'down';
                ci.style.color = '#f59e0b';
                ci.textContent = '📏 Не приближайтесь';
            }
        } else {
            PS.camWarnKind = null;
            ci.style.color = '#fff';
            ci.textContent = '📏 ' + PS.curDistanceM.toFixed(2) + ' м';
        }
    }

    function disableCamera() {
        if (PS.camFrameId) {
            clearInterval(PS.camFrameId);
            PS.camFrameId = null;
        }
        _camLoopStarted = false;
        if (PS.camStream) {
            PS.camStream.getTracks().forEach((t) => t.stop());
            PS.camStream = null;
        }
        const v = document.getElementById('hidden-video');
        if (v) v.remove();
        PS.camActive = false;
        const ci = _camIndicator();
        if (ci) ci.style.display = 'none';
        PS.curDistanceM = null;
        PS.camBaseline = null;
        PS.camWarnKind = null;
        PS.lastEyeDistPx = null;
    }

    // ==================== EXPORT ====================
    global.PlayerCamera = {
        setCallbacks,
        enableCamera,
        disableCamera,
        startCamLoop,
        processCamFrame,
        evaluateDistance,
        _checkHardLimit,
        _faceEmoji,
        _pushDetection,
        _updateDetectUI,
        _detectRatePct
    };

    console.log('[player-camera] module installed');
})(window);
