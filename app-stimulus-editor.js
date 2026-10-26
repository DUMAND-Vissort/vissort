// ==================== APP-STIMULUS-EDITOR.JS ====================
// Редактор "Живого стимула" (несколько кадров, у каждого свои повторы/шаг/режим).
// ==================== ==================== ====================

(function () {
    'use strict';

    const VLog = window.VLog || { log() {}, warn() {}, error() {} };

    function rgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    function linearToRgb(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
    function rgbToOklch(r, g, b) {
        const lr = rgbToLinear(r), lg = rgbToLinear(g), lb = rgbToLinear(b);
        const L = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
        const M = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
        const S = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
        const l_ = Math.cbrt(L), m_ = Math.cbrt(M), s_ = Math.cbrt(S);
        const L_ok = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
        const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
        const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
        const C = Math.sqrt(a * a + b_ * b_);
        let H = Math.atan2(b_, a) * 180 / Math.PI;
        if (H < 0) H += 360;
        return { L: L_ok * 100, C, H };
    }
    function oklchToRgb(L, C, H) {
        const L_ok = L / 100;
        const a = C * Math.cos(H * Math.PI / 180);
        const b_ = C * Math.sin(H * Math.PI / 180);
        const l_ = L_ok + 0.3963377774 * a + 0.2158037573 * b_;
        const m_ = L_ok - 0.1055613458 * a - 0.0638541728 * b_;
        const s_ = L_ok - 0.0894841775 * a - 1.2914855480 * b_;
        const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
        const r_lin =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        const g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        const b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
        return {
            r: Math.round(Math.max(0, Math.min(255, linearToRgb(r_lin) * 255))),
            g: Math.round(Math.max(0, Math.min(255, linearToRgb(g_lin) * 255))),
            b: Math.round(Math.max(0, Math.min(255, linearToRgb(b_lin) * 255)))
        };
    }

    const colorTable = [
        { r: 255, g: 0, b: 0 },     { r: 255, g: 50, b: 0 },    { r: 255, g: 100, b: 0 },   { r: 255, g: 150, b: 0 },   { r: 255, g: 200, b: 0 },
        { r: 255, g: 255, b: 0 },   { r: 200, g: 255, b: 0 },   { r: 150, g: 255, b: 0 },   { r: 100, g: 255, b: 0 },   { r: 50, g: 255, b: 0 },
        { r: 0, g: 255, b: 0 },     { r: 0, g: 255, b: 50 },    { r: 0, g: 255, b: 100 },   { r: 0, g: 255, b: 150 },   { r: 0, g: 255, b: 200 },
        { r: 0, g: 255, b: 255 },   { r: 0, g: 200, b: 255 },   { r: 0, g: 150, b: 255 },   { r: 0, g: 100, b: 255 },   { r: 0, g: 50, b: 255 },    { r: 0, g: 0, b: 255 }
    ];

    function getColorName(idx) {
        if (idx <= 2) return 'Красный'; if (idx <= 4) return 'Оранжевый'; if (idx <= 6) return 'Желтый';
        if (idx <= 9) return 'Желто-зеленый'; if (idx === 10) return 'Зеленый'; if (idx <= 14) return 'Голубой';
        if (idx <= 19) return 'Синий'; return 'Чистый синий';
    }

    function render(node, container) {
        const dynEnabled = document.getElementById('inp-dyn-enabled')?.checked;
        if (!dynEnabled) {
            const oldBlocks = container.querySelectorAll('#dyn-stimulus-editor-root');
            oldBlocks.forEach(el => el.remove());
            return;
        }

        if (!node.params) node.params = {};
        const params = node.params;

        if (!params.stimulusDynamic || !params.stimulusDynamic.frames) {
            params.stimulusDynamic = {
                active: true,
                framesCount: 1,
                frames: [
                    {
                        lifecycle: { delay1: 0, duration: 10, responseTime: 0, delay2: 0 },
                        stim: { startD: 0, endD: 0, startBright: 100, endBright: 100, startSize: 100, endSize: 100, startBlur: 0, endBlur: 0, align: true, level: 70 },
                        bg: { startD: 1, endD: 1, startBright: 100, endBright: 100, align: true, level: 70 },
                        repeats: 1,
                        step: 0.1,
                        mode: 'smooth'
                    }
                ]
            };
        }

        const dyn = params.stimulusDynamic;
        const frames = dyn.frames;

        const makeOpts = (selD) => {
            let o = '';
            for (let i = 0; i <= 20; i++) {
                const D = (i / 10).toFixed(1);
                o += `<option value="${D}" ${Math.round(selD*10)===i?'selected':''}>${D} D (${getColorName(i)})</option>`;
            }
            return o;
        };

        const makeEndOpts = (frame, selD) => {
            let o = '';
            const sInt = Math.round(frame.stim.startD * 10);
            const stepInt = Math.round(parseFloat(frame.step) * 10) || 1;
            for (let i = sInt; i <= 20; i += stepInt) {
                const D = (i / 10).toFixed(1);
                o += `<option value="${D}" ${Math.round(selD*10)===i?'selected':''}>${D} D (${getColorName(i)})</option>`;
            }
            return o;
        };

        let html = `
            <div id="dyn-stimulus-editor-root" class="panel-section" style="background:#1a0a2a;border-color:#8b5cf6;">
                <h3 style="color:#a78bfa;border-color:#8b5cf6;">✨ Живой стимул</h3>
                
                <!-- ШАПКА (только количество кадров) -->
                <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; background: #0b0b12; padding: 6px; border-radius: 4px;">
                    <label style="font-size: 11px; color: #eee; display: flex; align-items: center; gap: 5px;">
                        Кадров:
                        <input type="number" id="dyn-frames-count" value="${dyn.framesCount || 1}" min="1" max="20" style="width: 50px; padding: 2px; background: #16161a; color: #fff; border: 1px solid #333; border-radius: 2px;">
                    </label>
                </div>

                <div id="dyn-frames-container">
        `;

        frames.forEach((frame, idx) => {
            html += `
                <div style="border:1px solid #333; border-radius:4px; margin-bottom:8px; background:#16161a; padding:6px;">
                    <div style="font-size:11px; color:#8b5cf6; font-weight:bold; margin-bottom:6px; border-bottom:1px solid #333; padding-bottom:3px;">Кадр ${idx + 1}</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <!-- ЛЕВАЯ КОЛОНКА: Жизненный цикл -->
                        <div>
                            <div style="background:#0b0b12; padding:5px; border-radius:4px;">
                                <div style="font-size:10px; color:#aaa; margin-bottom:3px;">Жизненный цикл (сек):</div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:60px;">Задержка 1:</label>
                                    <input type="number" class="dyn-delay1" data-idx="${idx}" value="${frame.lifecycle.delay1}" step="0.1" style="width:100%; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                </div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:60px;">Показ:</label>
                                    <input type="number" class="dyn-duration" data-idx="${idx}" value="${frame.lifecycle.duration}" step="0.1" style="width:100%; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                </div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:60px;">Ожидание:</label>
                                    <input type="number" class="dyn-response" data-idx="${idx}" value="${frame.lifecycle.responseTime}" step="0.1" style="width:100%; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                </div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:60px;">Задержка 2:</label>
                                    <input type="number" class="dyn-delay2" data-idx="${idx}" value="${frame.lifecycle.delay2}" step="0.1" style="width:100%; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                </div>
                            </div>
                            <div style="background:#0b0b12; padding:5px; border-radius:4px; margin-top:5px;">
                                <div style="font-size:10px; color:#aaa; margin-bottom:3px;">Параметры кадра:</div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:60px;">Повторов:</label>
                                    <input type="number" class="dyn-repeats" data-idx="${idx}" value="${frame.repeats || 1}" min="1" max="20" style="width:100%; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                </div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:60px;">Шаг (D):</label>
                                    <select class="dyn-step" data-idx="${idx}" style="width:100%; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px; font-size:10px;">
                                        ${[0.1,0.2,0.3,0.4,0.5,0.6,0.7,1.0].map(s => `<option value="${s}" ${frame.step==s?'selected':''}>${s}</option>`).join('')}
                                    </select>
                                </div>
                                <div style="display:flex; gap:3px; align-items:center;">
                                    <label style="font-size:10px; width:60px;">Режим:</label>
                                    <select class="dyn-mode" data-idx="${idx}" style="width:100%; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px; font-size:10px;">
                                        <option value="smooth" ${frame.mode==='smooth'?'selected':''}>Плавно</option>
                                        <option value="jump" ${frame.mode==='jump'?'selected':''}>Скачками</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <!-- ПРАВАЯ КОЛОНКА: Стимул и Фон -->
                        <div>
                            <div style="background:#0b0b12; padding:5px; border-radius:4px; margin-bottom:3px;">
                                <div style="font-size:10px; color:#8b5cf6; margin-bottom:3px;">Стимул:</div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:40px;">Нач. D:</label>
                                    <select class="dyn-stim-start" data-idx="${idx}" style="flex:1; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px; font-size:10px;">${makeOpts(frame.stim.startD)}</select>
                                </div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:40px;">Кон. D:</label>
                                    <select class="dyn-stim-end" data-idx="${idx}" style="flex:1; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px; font-size:10px;">${makeEndOpts(frame, frame.stim.endD)}</select>
                                </div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:40px;">Ярк %:</label>
                                    <input type="number" class="dyn-stim-bright-start" data-idx="${idx}" value="${frame.stim.startBright}" style="width:40px; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                    <input type="number" class="dyn-stim-bright-end" data-idx="${idx}" value="${frame.stim.endBright}" style="width:40px; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                </div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:40px;">Размер:</label>
                                    <input type="number" class="dyn-stim-size-start" data-idx="${idx}" value="${frame.stim.startSize}" style="width:40px; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                    <input type="number" class="dyn-stim-size-end" data-idx="${idx}" value="${frame.stim.endSize}" style="width:40px; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                </div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:40px;">Блюр:</label>
                                    <input type="number" class="dyn-stim-blur-start" data-idx="${idx}" value="${frame.stim.startBlur}" style="width:40px; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                    <input type="number" class="dyn-stim-blur-end" data-idx="${idx}" value="${frame.stim.endBlur}" style="width:40px; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                </div>
                                <div style="display:flex; gap:3px; align-items:center; margin-top:3px;">
                                    <input type="checkbox" class="dyn-stim-align" data-idx="${idx}" ${frame.stim.align?'checked':''} style="margin:0;">
                                    <label style="font-size:10px;">Выравнивать</label>
                                </div>
                                <input type="range" class="dyn-stim-level" data-idx="${idx}" min="0" max="100" value="${frame.stim.level}" style="width:100%; margin-top:3px; accent-color:#8b5cf6;">
                            </div>
                            <div style="background:#0b0b12; padding:5px; border-radius:4px;">
                                <div style="font-size:10px; color:#8b5cf6; margin-bottom:3px;">Фон:</div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:40px;">Нач. D:</label>
                                    <select class="dyn-bg-start" data-idx="${idx}" style="flex:1; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px; font-size:10px;">${makeOpts(frame.bg.startD)}</select>
                                </div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:40px;">Кон. D:</label>
                                    <select class="dyn-bg-end" data-idx="${idx}" style="flex:1; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px; font-size:10px;">${makeEndOpts(frame, frame.bg.endD)}</select>
                                </div>
                                <div style="display:flex; gap:3px; margin-bottom:3px; align-items:center;">
                                    <label style="font-size:10px; width:40px;">Ярк %:</label>
                                    <input type="number" class="dyn-bg-bright-start" data-idx="${idx}" value="${frame.bg.startBright}" style="width:40px; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                    <input type="number" class="dyn-bg-bright-end" data-idx="${idx}" value="${frame.bg.endBright}" style="width:40px; padding:2px; background:#16161a; color:#fff; border:1px solid #333; border-radius:2px;">
                                </div>
                                <div style="display:flex; gap:3px; align-items:center; margin-top:3px;">
                                    <input type="checkbox" class="dyn-bg-align" data-idx="${idx}" ${frame.bg.align?'checked':''} style="margin:0;">
                                    <label style="font-size:10px;">Выравнивать</label>
                                </div>
                                <input type="range" class="dyn-bg-level" data-idx="${idx}" min="0" max="100" value="${frame.bg.level}" style="width:100%; margin-top:3px; accent-color:#8b5cf6;">
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
                <div style="display:flex; gap:5px; margin-top:10px;">
                    <button id="dyn-calc" style="flex:1; padding:5px; background:#10b981; color:#fff; border:none; border-radius:3px; font-size:10px; cursor:pointer;">📊 Рассчитать</button>
                    <button id="dyn-calib-stim" style="flex:1; padding:5px; background:#f59e0b; color:#fff; border:none; border-radius:3px; font-size:10px; cursor:pointer;">🎯 Калибр. (Стимул)</button>
                    <button id="dyn-calib-bg" style="flex:1; padding:5px; background:#f59e0b; color:#fff; border:none; border-radius:3px; font-size:10px; cursor:pointer;">🎯 Калибр. (Фон)</button>
                </div>
            </div>
        `;

        // Fix: удалить старые блоки ЖС перед добавлением (идемпотентность)
        container.querySelectorAll('#dyn-stimulus-editor-root').forEach(function(el) { el.remove(); });
        container.insertAdjacentHTML('beforeend', html);

        const $ = (id) => document.getElementById(id);

        const updateParams = () => {
            dyn.framesCount = parseInt($('dyn-frames-count')?.value) || 1;

            frames.forEach((frame, idx) => {
                frame.lifecycle.delay1 = parseFloat(container.querySelector(`.dyn-delay1[data-idx="${idx}"]`)?.value) || 0;
                frame.lifecycle.duration = parseFloat(container.querySelector(`.dyn-duration[data-idx="${idx}"]`)?.value) || 10;
                frame.lifecycle.responseTime = parseFloat(container.querySelector(`.dyn-response[data-idx="${idx}"]`)?.value) || 0;
                frame.lifecycle.delay2 = parseFloat(container.querySelector(`.dyn-delay2[data-idx="${idx}"]`)?.value) || 0;
                
                frame.repeats = parseInt(container.querySelector(`.dyn-repeats[data-idx="${idx}"]`)?.value) || 1;
                frame.step = parseFloat(container.querySelector(`.dyn-step[data-idx="${idx}"]`)?.value) || 0.1;
                frame.mode = container.querySelector(`.dyn-mode[data-idx="${idx}"]`)?.value || 'smooth';
                
                frame.stim.startD = parseFloat(container.querySelector(`.dyn-stim-start[data-idx="${idx}"]`)?.value) || 0;
                frame.stim.endD = parseFloat(container.querySelector(`.dyn-stim-end[data-idx="${idx}"]`)?.value) || 0;
                frame.stim.startBright = parseFloat(container.querySelector(`.dyn-stim-bright-start[data-idx="${idx}"]`)?.value) || 100;
                frame.stim.endBright = parseFloat(container.querySelector(`.dyn-stim-bright-end[data-idx="${idx}"]`)?.value) || 100;
                frame.stim.startSize = parseFloat(container.querySelector(`.dyn-stim-size-start[data-idx="${idx}"]`)?.value) || 100;
                frame.stim.endSize = parseFloat(container.querySelector(`.dyn-stim-size-end[data-idx="${idx}"]`)?.value) || 100;
                frame.stim.startBlur = parseFloat(container.querySelector(`.dyn-stim-blur-start[data-idx="${idx}"]`)?.value) || 0;
                frame.stim.endBlur = parseFloat(container.querySelector(`.dyn-stim-blur-end[data-idx="${idx}"]`)?.value) || 0;
                frame.stim.align = container.querySelector(`.dyn-stim-align[data-idx="${idx}"]`)?.checked ?? true;
                frame.stim.level = parseFloat(container.querySelector(`.dyn-stim-level[data-idx="${idx}"]`)?.value) || 70;
                
                frame.bg.startD = parseFloat(container.querySelector(`.dyn-bg-start[data-idx="${idx}"]`)?.value) || 0;
                frame.bg.endD = parseFloat(container.querySelector(`.dyn-bg-end[data-idx="${idx}"]`)?.value) || 0;
                frame.bg.startBright = parseFloat(container.querySelector(`.dyn-bg-bright-start[data-idx="${idx}"]`)?.value) || 100;
                frame.bg.endBright = parseFloat(container.querySelector(`.dyn-bg-bright-end[data-idx="${idx}"]`)?.value) || 100;
                frame.bg.align = container.querySelector(`.dyn-bg-align[data-idx="${idx}"]`)?.checked ?? true;
                frame.bg.level = parseFloat(container.querySelector(`.dyn-bg-level[data-idx="${idx}"]`)?.value) || 70;
            });

            node.params.stimulusDynamic = dyn;
        };

        container.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('input', updateParams);
            el.addEventListener('change', updateParams);
        });

        $('dyn-frames-count')?.addEventListener('change', () => {
            const newCount = parseInt($('dyn-frames-count').value) || 1;
            const currentFrames = frames.length;
            
            if (newCount > currentFrames) {
                for (let i = currentFrames; i < newCount; i++) {
                    frames.push({
                        lifecycle: { delay1: 0, duration: 10, responseTime: 0, delay2: 0 },
                        stim: { startD: 0, endD: 0, startBright: 100, endBright: 100, startSize: 100, endSize: 100, startBlur: 0, endBlur: 0, align: true, level: 70 },
                        bg: { startD: 1, endD: 1, startBright: 100, endBright: 100, align: true, level: 70 },
                        repeats: 1,
                        step: 0.1,
                        mode: 'smooth'
                    });
                }
            } else if (newCount < currentFrames) {
                frames.splice(newCount);
            }
            dyn.framesCount = newCount;
            node.params.stimulusDynamic = dyn;
            
            const old = container.querySelector('#dyn-stimulus-editor-root');
            if (old) old.remove();
            render(node, container);
        });

        $('dyn-calc')?.addEventListener('click', () => {
            const step = parseFloat(container.querySelector('.dyn-step[data-idx="0"]')?.value) || 0.1;
            const stepInt = Math.round(step * 10);
            const start = Math.round(parseFloat(container.querySelector('.dyn-stim-start[data-idx="0"]').value) * 10);
            const ends = [];
            for (let i = start; i <= 20; i += stepInt) ends.push((i / 10).toFixed(1));
            alert(`Список конечных (стимул):\n${ends.join(', ')}`);
        });

        $('dyn-calib-stim')?.addEventListener('click', () => {
            const stepInt = Math.round(parseFloat(container.querySelector('.dyn-step[data-idx="0"]')?.value || 0.1) * 10) || 1;
            let minL = 100;
            const start = Math.round(parseFloat(container.querySelector('.dyn-stim-start[data-idx="0"]').value) * 10);
            const end = Math.round(parseFloat(container.querySelector('.dyn-stim-end[data-idx="0"]').value) * 10);
            for (let i = start; i <= end; i += stepInt) {
                const c = colorTable[i];
                if (!c) continue;
                const oklch = rgbToOklch(c.r, c.g, c.b);
                if (oklch.L < minL) minL = oklch.L;
            }
            if (minL === 100) minL = 50;
            frames[0].stim.weakCalibL = minL;
            updateParams();
            alert(`Калибровка стимула: L = ${minL.toFixed(1)}%`);
        });

        $('dyn-calib-bg')?.addEventListener('click', () => {
            const stepInt = Math.round(parseFloat(container.querySelector('.dyn-step[data-idx="0"]')?.value || 0.1) * 10) || 1;
            let minL = 100;
            const start = Math.round(parseFloat(container.querySelector('.dyn-bg-start[data-idx="0"]').value) * 10);
            const end = Math.round(parseFloat(container.querySelector('.dyn-bg-end[data-idx="0"]').value) * 10);
            for (let i = start; i <= end; i += stepInt) {
                const c = colorTable[i];
                if (!c) continue;
                const oklch = rgbToOklch(c.r, c.g, c.b);
                if (oklch.L < minL) minL = oklch.L;
            }
            if (minL === 100) minL = 50;
            frames[0].bg.weakCalibL = minL;
            updateParams();
            alert(`Калибровка фона: L = ${minL.toFixed(1)}%`);
        });
    }

    window.AppStimulusEditor = {
        render,
        rgbToOklch,
        oklchToRgb,
        colorTable
    };

    VLog.log('[app-stimulus-editor] AppStimulusEditor экспортирован');
})();