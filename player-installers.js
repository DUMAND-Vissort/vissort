// player-installers.js — установщики UI плеера.
// Перенесено из player-runtime.js (§15.1.2).
// Зависит: VLog (vissort-logger.js), PlayerState (player-state.js),
//          Voice (voice.js), window._abortCurrentStimulus (player-runtime.js).
(function (global) {
    'use strict';

    // ==================== CAM PREVIEW (PIP) ====================
    function installCamPreview() {
        if (document.getElementById('btn-cam-preview')) return;
        var style = document.createElement('style');
        style.textContent =
            '#hidden-video.pip-visible{position:fixed !important;right:12px !important;bottom:12px !important;left:auto !important;top:auto !important;width:240px !important;height:180px !important;opacity:1 !important;pointer-events:none !important;border:2px solid #0ea5e9;border-radius:8px;z-index:9998;transform:scaleX(-1);box-shadow:0 6px 20px rgba(0,0,0,0.6);background:#000;}';
        document.head.appendChild(style);

        var anchor = document.getElementById('btn-logout');
        if (!anchor || !anchor.parentNode) return;
        var btn = document.createElement('button');
        btn.id = 'btn-cam-preview';
        btn.className = 'btn btn-ghost btn-icon';
        btn.type = 'button';
        btn.title = 'Показать/скрыть экран камеры (P)';
        btn.textContent = '📹';
        btn.style.cssText = 'margin-right:6px;';
        anchor.parentNode.insertBefore(btn, anchor);

        var KEY = 'vissort_cam_preview';
        function apply() {
            var v = document.getElementById('hidden-video');
            if (!v) return;
            var on = localStorage.getItem(KEY) === '1';
            v.classList.toggle('pip-visible', on);
            btn.style.background = on ? '#0ea5e9' : '';
            btn.style.color = on ? '#fff' : '';
        }
        btn.addEventListener('click', function () {
            var on = localStorage.getItem(KEY) === '1';
            localStorage.setItem(KEY, on ? '0' : '1');
            apply();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З') {
                if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
                var on = localStorage.getItem(KEY) === '1';
                localStorage.setItem(KEY, on ? '0' : '1');
                apply();
            }
        });
        new MutationObserver(function () {
            if (document.getElementById('hidden-video')) apply();
        }).observe(document.body, { childList: true, subtree: true });
        apply();
        VLog.log('[pip] camera preview installed');
    }

    // ==================== CAM HUD ====================
    function installCamHud() {
        function ensure() {
            var v = document.getElementById('hidden-video');
            if (!v) return null;
            var el = document.getElementById('cam-hud');
            if (!el) {
                el = document.createElement('div');
                el.id = 'cam-hud';
                el.style.cssText =
                    'position:fixed;right:12px;bottom:196px;width:240px;padding:6px 8px;background:rgba(0,0,0,0.7);color:#fff;font-family:monospace;font-size:12px;border-radius:6px;z-index:9999;text-align:center;pointer-events:none;line-height:1.4;';
                document.body.appendChild(el);
            }
            return el;
        }
        function _hudTick() {
            var v = document.getElementById('hidden-video');
            var el = ensure();
            if (!v || !el) return;
            if (!v.classList.contains('pip-visible')) {
                el.style.display = 'none';
                return;
            }
            el.style.display = 'block';
            var face = document.getElementById('cam-indicator');
            var faceText = face ? face.textContent : '';
            var hasFace = faceText.indexOf('📏') !== -1 || faceText.indexOf('✅') !== -1;
            var PS = global.PlayerState;
            var dev = (typeof PS.camBaseline !== 'undefined' && PS.camBaseline && typeof PS.curDistanceM !== 'undefined' && PS.curDistanceM)
                ? ((PS.curDistanceM - PS.camBaseline) / PS.camBaseline) * 100
                : null;
            var dist = (typeof PS.curDistanceM !== 'undefined' && PS.curDistanceM)
                ? PS.curDistanceM.toFixed(2)
                : '—';
            var base = (typeof PS.camBaseline !== 'undefined' && PS.camBaseline)
                ? PS.camBaseline.toFixed(2)
                : '—';
            var status, border;
            var faceLostMs = (typeof window._faceLostSince !== 'undefined' && window._faceLostSince)
                ? performance.now() - window._faceLostSince
                : 0;
            if (!hasFace) {
                if (faceLostMs < 1500) {
                    status = '\u26A0\uFE0F \u041B\u0418\u0426\u041E? ' + (dev != null ? dev.toFixed(1) + '%' : '');
                    border = '#eab308';
                    v.style.animation = '';
                } else {
                    status = '\u274C \u041D\u0415\u0422 \u041B\u0418\u0426\u0410' + (dev != null ? ' ' + dev.toFixed(1) + '%' : '');
                    border = '#dc2626';
                    v.style.animation = 'camBlink 0.6s infinite alternate';
                }
            } else if (dev != null && Math.abs(dev) > 15) {
                status = (dev < 0 ? '\u26A0\uFE0F \u0411\u041B\u0418\u0417\u041A\u041E ' : '\u26A0\uFE0F \u0414\u0410\u041B\u0415\u041A\u041E ') + dev.toFixed(1) + '%';
                border = '#eab308';
                v.style.borderColor = border;
                v.style.animation = '';
            } else {
                status = '\u2705 OK ' + (dev != null ? dev.toFixed(1) + '%' : '');
                border = '#10b981';
                v.style.borderColor = border;
                v.style.animation = '';
            }
            el.innerHTML = status + '<br>dist: ' + dist + '  base: ' + base;
            v.style.borderColor = border;
            v.style.borderWidth = '3px';
            v.style.borderStyle = 'solid';
        }
        var _hudIntervalId = null;
        function _hudStart() {
            if (_hudIntervalId) return;
            _hudTick();
            _hudIntervalId = setInterval(_hudTick, 250);
        }
        function _hudStop() {
            if (_hudIntervalId) {
                clearInterval(_hudIntervalId);
                _hudIntervalId = null;
            }
            var _el = document.getElementById('cam-hud');
            if (_el) _el.style.display = 'none';
        }
        function _hudSync() {
            var _v = document.getElementById('hidden-video');
            if (_v && _v.classList.contains('pip-visible')) _hudStart();
            else _hudStop();
        }
        new MutationObserver(_hudSync).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
        _hudSync();
        var st = document.createElement('style');
        st.textContent = '@keyframes camBlink{from{border-color:#dc2626;}to{border-color:#7f1d1d;}}';
        document.head.appendChild(st);
        VLog.log('[cam-hud] installed');
    }

    // ==================== FACE LOST PAUSE ====================
    function installFaceLostPause() {
        function ensureOverlay() {
            var el = document.getElementById('face-lost-overlay');
            if (el) return el;
            el = document.createElement('div');
            el.id = 'face-lost-overlay';
            el.style.cssText =
                'position:fixed;inset:0;background:rgba(11,11,18,0.94);display:none;align-items:center;justify-content:center;z-index:99997;font-family:"Segoe UI",Tahoma,sans-serif;color:#fff;text-align:center;padding:20px;';
            el.innerHTML =
                '<div><div style="font-size:72px;margin-bottom:24px;">&#128100;</div><h2 style="font-size:28px;margin:0 0 12px;font-weight:700;">Вернитесь в кадр</h2><p style="color:#94a3b8;font-size:15px;">Тренировка возобновится автоматически</p></div>';
            document.body.appendChild(el);
            return el;
        }
        setInterval(function () {
            var PS = global.PlayerState;
            if (!PS.playerRunning || PS.isPaused) {
                if (window._faceLostPause) {
                    window._faceLostPause = false;
                    var _o = document.getElementById('face-lost-overlay');
                    if (_o && _o.style.display === 'flex') _o.style.display = 'none';
                }
                return;
            }
            var overlay = ensureOverlay();
            var face = document.getElementById('cam-indicator');
            var faceText = face ? face.textContent : '';
            var hasFace = faceText.indexOf('\uD83D\uDCCF') !== -1 || faceText.indexOf('\u2705') !== -1;
            var training = PS.playerRunning && !PS.isPaused;
            var longLoss = false;
            if (!hasFace && window._faceLostSince) {
                if (performance.now() - window._faceLostSince > 2000) longLoss = true;
            }
            if (training && longLoss) {
                if (overlay.style.display !== 'flex') {
                    overlay.style.display = 'flex';
                    VLog.warn('[face] потеряно >2с — пауза');
                    if (window.Voice && window.Voice.sayKey)
                        window.Voice.sayKey('returnToFrame', { cancel: true });
                }
                window._faceLostPause = true;
            } else {
                if (overlay.style.display === 'flex') {
                    overlay.style.display = 'none';
                    VLog.log('[face] лицо вернулось — продолжаем');
                    if (window.Voice && window.Voice.sayKey) window.Voice.sayKey('faceFound', { cancel: true });
                    if (typeof window._abortCurrentStimulus === 'function') {
                        try {
                            window._abortCurrentStimulus('face_back_after_long_loss');
                        } catch (e) {}
                    }
                }
                window._faceLostPause = false;
            }
        }, 300);
    }

    // ==================== PUBLIC API ====================
    global.PlayerInstallers = {
        installCamPreview: installCamPreview,
        installCamHud: installCamHud,
        installFaceLostPause: installFaceLostPause,
        installAll: function () {
            installCamPreview();
            installCamHud();
            installFaceLostPause();
        }
    };

    VLog.log('[player-installers] module installed');
})(window);