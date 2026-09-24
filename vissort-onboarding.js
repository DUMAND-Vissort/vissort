// ============================================================
// vissort-onboarding.js
// Мастер первичной настройки: калибровка экрана и камеры.
// Показывается один раз на устройство.
// Требует: vissort-device.js, face-api (уже на странице)
// ============================================================
(function installOnboarding(global) {
    'use strict';

    const Device = global.VissortDevice;

    let client = null;
    let userId = null;
    let onDone = null;
    let modal = null;
    let step = 1;
    let ppiValue = null;
    let focalValue = null;
    let videoStream = null;
    let faceCheckInterval = null;

    function createModal() {
        const m = document.createElement('div');
        m.id = 'vissort-onboarding';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(11,11,18,0.96);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Segoe UI",Tahoma,sans-serif;color:#e8e8f0;';
        m.innerHTML = '<div style="max-width:560px;width:100%;background:#1e1e24;border-radius:14px;border:1px solid #3f3f46;padding:32px;"><div id="ob-progress" style="font-size:12px;color:#94a3b8;margin-bottom:8px;"></div><div id="ob-content"></div></div>';
        document.body.appendChild(m);
        return m;
    }

    function renderStep() {
        const content = document.getElementById('ob-content');
        const progress = document.getElementById('ob-progress');
        if (!content) return;

        if (step === 1) {
            progress.textContent = 'Шаг 1 из 2 — калибровка экрана';
            content.innerHTML = [
                '<h2 style="font-size:20px;margin:0 0 8px;">📐 Калибровка экрана</h2>',
                '<p style="color:#94a3b8;font-size:14px;margin:0 0 20px;">Измерьте длину красной полосы линейкой в миллиметрах.</p>',
                '<div style="margin:20px 0;padding:15px 0;background:#0b0b0d;border-radius:6px;text-align:center;">',
                '<div style="width:400px;height:30px;background:#ff0000;margin:0 auto;max-width:100%;"></div>',
                '<div style="color:#888;font-size:11px;margin-top:6px;">← 400 пикселей →</div>',
                '</div>',
                '<label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;">Длина в мм</label>',
                '<input type="number" id="ob-mm" value="106" min="5" max="500" step="0.5" style="width:100%;padding:10px;background:#0b0b0f;border:1px solid #2a2a35;border-radius:6px;color:#fff;font-size:16px;box-sizing:border-box;">',
                '<div style="margin-top:10px;font-size:12px;color:#22c55e;">PPI: <b id="ob-ppi">—</b></div>',
                '<div style="margin-top:24px;display:flex;justify-content:flex-end;">',
                '<button id="ob-next" style="padding:10px 24px;background:#0ea5e9;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Далее →</button>',
                '</div>'
            ].join('');

            const mmInput = document.getElementById('ob-mm');
            const ppiEl = document.getElementById('ob-ppi');
            const recalc = () => {
                const mm = parseFloat(mmInput.value) || 0;
                if (mm <= 0) { ppiEl.textContent = '—'; return; }
                ppiEl.textContent = Math.round(400 * (window.devicePixelRatio || 1) * 25.4 / mm);
            };
            mmInput.addEventListener('input', recalc);
            recalc();

            document.getElementById('ob-next').addEventListener('click', () => {
                const mm = parseFloat(mmInput.value) || 0;
                if (mm < 5 || mm > 500) { alert('Введите длину 5–500 мм'); return; }
                ppiValue = Math.round(400 * (window.devicePixelRatio || 1) * 25.4 / mm);
                step = 2;
                renderStep();
            });
        } else if (step === 2) {
            progress.textContent = 'Шаг 2 из 2 — калибровка камеры';
            content.innerHTML = [
                '<h2 style="font-size:20px;margin:0 0 8px;">🎥 Калибровка камеры</h2>',
                '<p style="color:#94a3b8;font-size:14px;margin:0 0 16px;">Сядьте примерно на <b>1 метр</b> от экрана. Смотрите прямо в камеру.</p>',
                '<div style="position:relative;width:100%;max-width:400px;margin:0 auto;">',
                '<video id="ob-video" autoplay muted playsinline style="width:100%;border-radius:8px;background:#000;display:block;"></video>',
                '<div id="ob-face" style="position:absolute;top:8px;left:8px;padding:4px 10px;background:rgba(0,0,0,0.7);border-radius:4px;font-size:12px;">Проверка…</div>',
                '</div>',
                '<div style="margin-top:16px;font-size:12px;color:#94a3b8;text-align:center;">Расстояние до камеры: <b style="color:#fff;">1.00 м</b></div>',
                '<div style="margin-top:24px;display:flex;justify-content:space-between;gap:10px;">',
                '<button id="ob-back" style="padding:10px 20px;background:transparent;color:#94a3b8;border:1px solid #3f3f46;border-radius:8px;font-size:14px;cursor:pointer;">← Назад</button>',
                '<button id="ob-done" disabled style="padding:10px 24px;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;opacity:0.5;">Готово</button>',
                '</div>'
            ].join('');

            startCameraForOnboarding();

            document.getElementById('ob-back').addEventListener('click', () => {
                stopCamera();
                step = 1;
                renderStep();
            });
            document.getElementById('ob-done').addEventListener('click', finishOnboarding);
        }
    }

    async function startCameraForOnboarding() {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } }
            });
            const v = document.getElementById('ob-video');
            v.srcObject = videoStream;
            await v.play();
            await waitForFaceApi();

            const faceEl = document.getElementById('ob-face');
            const doneBtn = document.getElementById('ob-done');

            faceCheckInterval = setInterval(async () => {
                if (!v.videoWidth) return;
                try {
                    const det = await faceapi
                        .detectSingleFace(v, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
                        .withFaceLandmarks();
                    if (det && det.landmarks) {
                        const le = det.landmarks.getLeftEye();
                        const re = det.landmarks.getRightEye();
                        const lc = { x: (le[0].x + le[3].x) / 2, y: (le[0].y + le[3].y) / 2 };
                        const rc = { x: (re[0].x + re[3].x) / 2, y: (re[0].y + re[3].y) / 2 };
                        const ipd = Math.hypot(rc.x - lc.x, rc.y - lc.y);
                        if (ipd > 10) {
                            faceEl.textContent = '✅ Лицо найдено';
                            faceEl.style.color = '#22c55e';
                            focalValue = (ipd * 1000) / 63;
                            doneBtn.disabled = false;
                            doneBtn.style.opacity = '1';
                        }
                    } else {
                        faceEl.textContent = '❌ Нет лица';
                        faceEl.style.color = '#ef4444';
                        doneBtn.disabled = true;
                        doneBtn.style.opacity = '0.5';
                    }
                } catch (_) {}
            }, 500);
        } catch (e) {
            alert('Не удалось включить камеру: ' + e.message);
        }
    }

    async function waitForFaceApi() {
        let tries = 0;
        while ((typeof faceapi === 'undefined' || !faceapi.nets) && tries < 40) {
            await new Promise(r => setTimeout(r, 250));
            tries++;
        }
        if (typeof faceapi === 'undefined') return;
        try {
            if (faceapi.tf) { await faceapi.tf.setBackend('cpu'); await faceapi.tf.ready(); }
            const M = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
            await faceapi.nets.tinyFaceDetector.loadFromUri(M);
            await faceapi.nets.faceLandmark68Net.loadFromUri(M);
        } catch (e) {
            console.warn('[onboarding] face-api:', e);
        }
    }

    function stopCamera() {
        if (faceCheckInterval) { clearInterval(faceCheckInterval); faceCheckInterval = null; }
        if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; }
    }

    async function finishOnboarding() {
        if (!ppiValue || !focalValue) return;
        stopCamera();

        const fp = sessionStorage.getItem('vissort_fp');
        const data = { ppi: ppiValue, focalLengthPx: focalValue };

        if (fp) Device.saveLocal(fp, data);
        Device.apply(data);

        if (client && userId && fp) {
            await Device.saveCloud(client, userId, fp, data);
        }

        if (modal) modal.remove();
        modal = null;

        if (typeof onDone === 'function') onDone(data);
    }

    function askAboutDevice(cloudData, fp) {
        const m = document.createElement('div');
        m.style.cssText = 'position:fixed;inset:0;background:rgba(11,11,18,0.96);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Segoe UI",Tahoma,sans-serif;color:#e8e8f0;';
        const d = new Date(cloudData.calibrated_at).toLocaleDateString('ru-RU');
        m.innerHTML = [
            '<div style="max-width:480px;width:100%;background:#1e1e24;border-radius:14px;border:1px solid #3f3f46;padding:32px;text-align:center;">',
            '<h2 style="font-size:20px;margin:0 0 12px;">📱 Это то же устройство?</h2>',
            '<p style="color:#94a3b8;font-size:14px;margin:0 0 8px;">Ранее вы калибровали:</p>',
            '<p style="color:#fff;font-size:14px;margin:0 0 20px;">',
            (cloudData.device_label || '—'),
            '<br><span style="color:#64748b;font-size:12px;">' + d + '</span></p>',
            '<div style="display:flex;gap:10px;justify-content:center;">',
            '<button id="ob-same" style="padding:10px 20px;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Да, это оно</button>',
            '<button id="ob-new" style="padding:10px 20px;background:transparent;color:#94a3b8;border:1px solid #3f3f46;border-radius:8px;font-size:14px;cursor:pointer;">Новое устройство</button>',
            '</div></div>'
        ].join('');
        document.body.appendChild(m);

        document.getElementById('ob-same').addEventListener('click', () => {
            const data = { ppi: cloudData.ppi, focalLengthPx: cloudData.focal_length_px };
            if (fp) Device.saveLocal(fp, data);
            Device.apply(data);
            m.remove();
            if (typeof onDone === 'function') onDone(data);
        });

        document.getElementById('ob-new').addEventListener('click', () => {
            m.remove();
            step = 1;
            modal = createModal();
            renderStep();
        });
    }

    async function start(opts) {
        client = opts.client;
        userId = opts.userId;
        onDone = opts.onDone;

        if (Device.hasCalibrationForCurrent()) {
            if (typeof onDone === 'function') onDone();
            return;
        }

        const fp = sessionStorage.getItem('vissort_fp');

        if (client && userId) {
            const cloudData = await Device.loadCloudByFingerprint(client, userId, fp);
            if (cloudData) {
                Device.apply({ ppi: cloudData.ppi, focalLengthPx: cloudData.focal_length_px });
                if (fp) Device.saveLocal(fp, { ppi: cloudData.ppi, focalLengthPx: cloudData.focal_length_px });
                if (typeof onDone === 'function') onDone();
                return;
            }

            const list = await Device.listCloud(client, userId);
            if (list.length > 0) {
                askAboutDevice(list[0], fp);
                return;
            }
        }

        step = 1;
        modal = createModal();
        renderStep();
    }

    global.Onboarding = { start };
    console.log('[onboarding] модуль установлен');
})(window);