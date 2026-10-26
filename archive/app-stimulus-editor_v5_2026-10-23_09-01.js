// ==================== APP-STIMULUS-EDITOR.JS ====================
// Редактор "Живого стимула" для инспектора.
// Экспорт: window.AppStimulusEditor
// ==================== ==================== ====================

(function () {
    'use strict';

    const VLog = window.VLog || { log() {}, warn() {}, error() {} };
    const VissortCore = window.VissortCore;

    // === OKLCH КОНВЕРТАЦИЯ ===
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

    // === ЦВЕТОВАЯ ТАБЛИЦА (21 шаг) ===
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

    // === ФУНКЦИЯ ЦВЕТА С УЧЕТОМ ЯРКОСТИ И ВЫРАВНИВАНИЯ ===
    function getColorByD(D, isStimulus, brightness, alignCb, levelSlider, weakCalibL) {
        const safeD = Math.max(0, Math.min(2.0, D));
        const idxFloat = safeD * 10;
        const idx1 = Math.floor(idxFloat);
        const idx2 = Math.ceil(idxFloat);
        const t = idxFloat - idx1;

        const c1 = colorTable[idx1] || colorTable[0];
        const c2 = colorTable[idx2] || colorTable[colorTable.length - 1];

        const br = Math.max(0, Math.min(100, brightness ?? 100)) / 100;

        if (!alignCb || !alignCb.checked) {
            return {
                r: Math.round((c1.r + (c2.r - c1.r) * t) * br),
                g: Math.round((c1.g + (c2.g - c1.g) * t) * br),
                b: Math.round((c1.b + (c2.b - c1.b) * t) * br)
            };
        }

        const o1 = rgbToOklch(c1.r, c1.g, c1.b);
        const o2 = rgbToOklch(c2.r, c2.g, c2.b);

        let h1 = o1.H, h2 = o2.H;
        if (Math.abs(h2 - h1) > 180) {
            if (h2 > h1) h1 += 360;
            else h2 += 360;
        }
        let H = h1 + (h2 - h1) * t;
        H = (H + 360) % 360;

        const C = o1.C + (o2.C - o1.C) * t;
        let L = levelSlider ? parseInt(levelSlider.value) : 70;
        if (weakCalibL) L = Math.min(L, weakCalibL);
        
        L = L * br;
        return oklchToRgb(L, C, H);
    }

    // === РЕНДЕР ИНТЕРФЕЙСА ===
    function render(node, container) {
        const params = node.params || {};
        
        // Инициализация по умолчанию, если пусто
        if (!params.stimulusDynamic) {
            params.stimulusDynamic = {
                lifecycle: { delay1: 0, duration: 10, responseTime: 0, delay2: 0 },
                stim: { startD: 0, endD: 0, startBright: 100, endBright: 100, align: true, level: 70 },
                bg: { startD: 1, endD: 1, startBright: 100, endBright: 100, align: true, level: 70 },
                step: 0.1,
                mode: 'smooth',
                repeats: 1
            };
        }
        
        const dyn = params.stimulusDynamic;
        const stepInt = Math.round(dyn.step * 10);

        const makeOpts = (selD) => {
            let o = '';
            for (let i = 0; i <= 20; i++) {
                const D = (i / 10).toFixed(1);
                o += `<option value="${D}" ${Math.round(selD*10)===i?'selected':''}>${D} D (${getColorName(i)})</option>`;
            }
            return o;
        };

        const makeEndOpts = (startD, selD) => {
            let o = '';
            const sInt = Math.round(startD * 10);
            for (let i = sInt; i <= 20; i += stepInt) {
                const D = (i / 10).toFixed(1);
                o += `<option value="${D}" ${Math.round(selD*10)===i?'selected':''}>${D} D (${getColorName(i)})</option>`;
            }
            return o;
        };

        // Генерируем HTML-блок
        const html = `
            <div class="panel-section" style="background:#1a0a2a;border-color:#8b5cf6;">
                <h3 style="color:#a78bfa;border-color:#8b5cf6;">✨ Живой стимул</h3>
                
                <div style="font-size:11px; color:#aaa; margin-bottom:5px;">Жизненный цикл (сек):</div>
                <div class="row"><label>Задержка 1:</label><input type="number" id="dyn-delay1" value="${dyn.lifecycle.delay1}" step="0.1" style="width:60px;"></div>
                <div class="row"><label>Показ:</label><input type="number" id="dyn-duration" value="${dyn.lifecycle.duration}" step="0.1" style="width:60px;"></div>
                <div class="row"><label>Ожидание:</label><input type="number" id="dyn-response" value="${dyn.lifecycle.responseTime}" step="0.1" style="width:60px;"></div>
                <div class="row"><label>Задержка 2:</label><input type="number" id="dyn-delay2" value="${dyn.lifecycle.delay2}" step="0.1" style="width:60px;"></div>

                <div style="font-size:11px; color:#aaa; margin-top:5px;">Параметры:</div>
                <div class="row"><label>Шаг (D):</label><select id="dyn-step">${[0.1,0.2,0.3,0.4,0.5,0.6,0.7,1.0].map(s => `<option value="${s}" ${dyn.step==s?'selected':''}>${s} D</option>`).join('')}</select></div>
                <div class="row"><label>Режим:</label><select id="dyn-mode"><option value="smooth" ${dyn.mode==='smooth'?'selected':''}>Плавно</option><option value="jump" ${dyn.mode==='jump'?'selected':''}>Скачками</option></select></div>
                <div class="row"><label>Повторы:</label><input type="number" id="dyn-repeats" value="${dyn.repeats}" min="1" max="20" style="width:60px;"></div>

                <div style="font-size:11px; color:#8b5cf6; margin-top:5px;">Стимул:</div>
                <div class="row"><label>Нач. D:</label><select id="dyn-stim-start">${makeOpts(dyn.stim.startD)}</select></div>
                <div class="row"><label>Кон. D:</label><select id="dyn-stim-end">${makeEndOpts(dyn.stim.startD, dyn.stim.endD)}</select></div>
                <div class="row"><label>Ярк %:</label><input type="number" id="dyn-stim-bright-start" value="${dyn.stim.startBright}" style="width:60px;"><input type="number" id="dyn-stim-bright-end" value="${dyn.stim.endBright}" style="width:60px;"></div>
                <div class="row"><label><input type="checkbox" id="dyn-stim-align" ${dyn.stim.align?'checked':''}> Выравнивать</label><input type="range" id="dyn-stim-level" min="0" max="100" value="${dyn.stim.level}" style="flex:1;"></div>

                <div style="font-size:11px; color:#8b5cf6; margin-top:5px;">Фон:</div>
                <div class="row"><label>Нач. D:</label><select id="dyn-bg-start">${makeOpts(dyn.bg.startD)}</select></div>
                <div class="row"><label>Кон. D:</label><select id="dyn-bg-end">${makeEndOpts(dyn.bg.startD, dyn.bg.endD)}</select></div>
                <div class="row"><label>Ярк %:</label><input type="number" id="dyn-bg-bright-start" value="${dyn.bg.startBright}" style="width:60px;"><input type="number" id="dyn-bg-bright-end" value="${dyn.bg.endBright}" style="width:60px;"></div>
                <div class="row"><label><input type="checkbox" id="dyn-bg-align" ${dyn.bg.align?'checked':''}> Выравнивать</label><input type="range" id="dyn-bg-level" min="0" max="100" value="${dyn.bg.level}" style="flex:1;"></div>

                <button id="dyn-calc" style="width:100%; padding:6px; background:#10b981; margin-top:5px;">📊 Рассчитать список</button>
                <button id="dyn-calib-stim" style="width:100%; padding:6px; background:#f59e0b; margin-top:5px;">🎯 Калибровать по слабому (Стимул)</button>
                <button id="dyn-calib-bg" style="width:100%; padding:6px; background:#f59e0b; margin-top:5px;">🎯 Калибровать по слабому (Фон)</button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', html);

        // === ОБРАБОТЧИКИ ===
        const $ = (id) => document.getElementById(id);
        const updateParams = () => {
            // Жизненный цикл
            dyn.lifecycle.delay1 = parseFloat($('dyn-delay1').value) || 0;
            dyn.lifecycle.duration = parseFloat($('dyn-duration').value) || 10;
            dyn.lifecycle.responseTime = parseFloat($('dyn-response').value) || 0;
            dyn.lifecycle.delay2 = parseFloat($('dyn-delay2').value) || 0;
            
            // Общие
            dyn.step = parseFloat($('dyn-step').value) || 0.1;
            dyn.mode = $('dyn-mode').value;
            dyn.repeats = parseInt($('dyn-repeats').value) || 1;
            
            // Стимул
            dyn.stim.startD = parseFloat($('dyn-stim-start').value) || 0;
            dyn.stim.endD = parseFloat($('dyn-stim-end').value) || 0;
            dyn.stim.startBright = parseFloat($('dyn-stim-bright-start').value) || 100;
            dyn.stim.endBright = parseFloat($('dyn-stim-bright-end').value) || 100;
            dyn.stim.align = $('dyn-stim-align').checked;
            dyn.stim.level = parseFloat($('dyn-stim-level').value) || 70;
            
            // Фон
            dyn.bg.startD = parseFloat($('dyn-bg-start').value) || 0;
            dyn.bg.endD = parseFloat($('dyn-bg-end').value) || 0;
            dyn.bg.startBright = parseFloat($('dyn-bg-bright-start').value) || 100;
            dyn.bg.endBright = parseFloat($('dyn-bg-bright-end').value) || 100;
            dyn.bg.align = $('dyn-bg-align').checked;
            dyn.bg.level = parseFloat($('dyn-bg-level').value) || 70;
            
            // Сохраняем в узел
            node.params.stimulusDynamic = dyn;
        };

        // Привязка событий
        ['dyn-delay1', 'dyn-duration', 'dyn-response', 'dyn-delay2', 'dyn-step', 'dyn-mode', 'dyn-repeats',
         'dyn-stim-bright-start', 'dyn-stim-bright-end', 'dyn-stim-level',
         'dyn-bg-bright-start', 'dyn-bg-bright-end', 'dyn-bg-level'].forEach(id => {
            $(id)?.addEventListener('input', updateParams);
            $(id)?.addEventListener('change', updateParams);
        });

        $('dyn-stim-align')?.addEventListener('change', updateParams);
        $('dyn-bg-align')?.addEventListener('change', updateParams);

        // Пересчет конечных значений при смене начального
        $('dyn-stim-start')?.addEventListener('change', () => {
            const s = parseFloat($('dyn-stim-start').value);
            $('dyn-stim-end').innerHTML = makeEndOpts(s, s);
            $('dyn-stim-end').value = s.toFixed(1);
            updateParams();
        });
        $('dyn-bg-start')?.addEventListener('change', () => {
            const s = parseFloat($('dyn-bg-start').value);
            $('dyn-bg-end').innerHTML = makeEndOpts(s, s);
            $('dyn-bg-end').value = s.toFixed(1);
            updateParams();
        });

        // Кнопка "Рассчитать"
        $('dyn-calc')?.addEventListener('click', () => {
            const step = parseFloat($('dyn-step').value);
            const stepInt = Math.round(step * 10);
            const start = Math.round(parseFloat($('dyn-stim-start').value) * 10);
            const ends = [];
            for (let i = start; i <= 20; i += stepInt) ends.push((i / 10).toFixed(1));
            alert(`Список конечных (стимул):\n${ends.join(', ')}`);
        });

        // Калибровка по слабому (стимул)
        $('dyn-calib-stim')?.addEventListener('click', () => {
            const stepInt = Math.round(parseFloat($('dyn-step').value) * 10) || 1;
            let minL = 100;
            const start = Math.round(parseFloat($('dyn-stim-start').value) * 10);
            const end = Math.round(parseFloat($('dyn-stim-end').value) * 10);
            for (let i = start; i <= end; i += stepInt) {
                const c = colorTable[i];
                if (!c) continue;
                const oklch = rgbToOklch(c.r, c.g, c.b);
                if (oklch.L < minL) minL = oklch.L;
            }
            if (minL === 100) minL = 50;
            dyn.stim.weakCalibL = minL;
            updateParams();
            alert(`Калибровка стимула: L = ${minL.toFixed(1)}%`);
        });

        // Калибровка по слабому (фон)
        $('dyn-calib-bg')?.addEventListener('click', () => {
            const stepInt = Math.round(parseFloat($('dyn-step').value) * 10) || 1;
            let minL = 100;
            const start = Math.round(parseFloat($('dyn-bg-start').value) * 10);
            const end = Math.round(parseFloat($('dyn-bg-end').value) * 10);
            for (let i = start; i <= end; i += stepInt) {
                const c = colorTable[i];
                if (!c) continue;
                const oklch = rgbToOklch(c.r, c.g, c.b);
                if (oklch.L < minL) minL = oklch.L;
            }
            if (minL === 100) minL = 50;
            dyn.bg.weakCalibL = minL;
            updateParams();
            alert(`Калибровка фона: L = ${minL.toFixed(1)}%`);
        });
    }

    // === ЭКСПОРТ ===
    window.AppStimulusEditor = {
        render,
        getColorByD,
        rgbToOklch,
        oklchToRgb,
        colorTable
    };

    VLog.log('[app-stimulus-editor] AppStimulusEditor экспортирован');
})();