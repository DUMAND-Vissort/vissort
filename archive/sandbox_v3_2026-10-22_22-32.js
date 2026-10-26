console.log('[sandbox] Финальная версия. OKLCH для выравнивания яркости.');

// УДАЛЯЕМ старые функции и оставляем только OKLCH
const stim = document.getElementById('stim');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const timeDisplay = document.getElementById('time-display');
const container = document.getElementById('nodes-container');
const nodesCountInput = document.getElementById('nodes-count');
const repeatsCountInput = document.getElementById('repeats-count');
const stepSelect = document.getElementById('step-size');
const modeSelect = document.getElementById('anim-mode');
const alignCheckbox = document.getElementById('align-luminance');
const alignSlider = document.getElementById('align-level');
const alignVal = document.getElementById('align-level-val');

let isPlaying = false;
let animId = null;
let startTime = 0;
let pausedTime = 0;
let isPaused = false;
let nodes = [];

// Таблица цветов (0.0 - 2.0 D) в RGB
const colorTable = [
    { r: 255, g: 0, b: 0 },     { r: 255, g: 50, b: 0 },    { r: 255, g: 100, b: 0 },   { r: 255, g: 150, b: 0 },   { r: 255, g: 200, b: 0 },
    { r: 255, g: 255, b: 0 },   { r: 200, g: 255, b: 0 },   { r: 150, g: 255, b: 0 },   { r: 100, g: 255, b: 0 },   { r: 50, g: 255, b: 0 },
    { r: 0, g: 255, b: 0 },     { r: 0, g: 255, b: 50 },    { r: 0, g: 255, b: 100 },   { r: 0, g: 255, b: 150 },   { r: 0, g: 255, b: 200 },
    { r: 0, g: 255, b: 255 },   { r: 0, g: 200, b: 255 },   { r: 0, g: 150, b: 255 },   { r: 0, g: 100, b: 255 },   { r: 0, g: 50, b: 255 },    { r: 0, g: 0, b: 255 }
];

// ==== OKLCH КОНВЕРТАЦИЯ ====
// (Это упрощенная версия, достаточная для выравнивания яркости)
function rgbToLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToRgb(c) {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
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
// ===========================

function getColorName(idx) {
    if (idx <= 2) return 'Красный'; if (idx <= 4) return 'Оранжевый'; if (idx <= 6) return 'Желтый';
    if (idx <= 9) return 'Желто-зеленый'; if (idx === 10) return 'Зеленый'; if (idx <= 14) return 'Голубой';
    if (idx <= 19) return 'Синий'; return 'Чистый синий';
}

// НОВАЯ функция интерполяции с выравниванием через OKLCH
function getColorByD(D) {
    const safeD = Math.max(0, Math.min(2.0, D));
    const idxFloat = safeD * 10;
    const idx1 = Math.floor(idxFloat);
    const idx2 = Math.ceil(idxFloat);
    const t = idxFloat - idx1;

    const c1 = colorTable[idx1] || colorTable[0];
    const c2 = colorTable[idx2] || colorTable[colorTable.length - 1];

    // Переводим оба цвета в OKLCH
    const o1 = rgbToOklch(c1.r, c1.g, c1.b);
    const o2 = rgbToOklch(c2.r, c2.g, c2.b);

    // Интерполируем Hue (по кратчайшему пути)
    let h1 = o1.H, h2 = o2.H;
    if (Math.abs(h2 - h1) > 180) {
        if (h2 > h1) h1 += 360;
        else h2 += 360;
    }
    let H = h1 + (h2 - h1) * t;
    H = (H + 360) % 360;

    const C = o1.C + (o2.C - o1.C) * t;
    
    // Светлота (L) берется из ползунка (если галочка стоит)
    let L = 80; // Базовый уровень (80% - достаточно ярко, но не слепит)
    if (alignCheckbox && alignCheckbox.checked) {
        L = parseInt(alignSlider.value) || 70;
    }

    return oklchToRgb(L, C, H);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function parseSafe(val, def) { const num = parseFloat(val); return isNaN(num) ? def : num; }

function generateNodes(count) {
    const newNodes = [];
    let currentTime = 0;
    const repeats = parseInt(repeatsCountInput.value) || 1;
    for (let i = 0; i < count; i++) {
        for (let r = 0; r < repeats; r++) {
            newNodes.push({
                timeStart: currentTime, timeEnd: currentTime + 10.0,
                startD: 0.0, endD: 0.0, bgStartD: 0.0, bgEndD: 0.0,
                startSize: 100, endSize: 100, startBlur: 0, endBlur: 0,
                startBright: 100, endBright: 100, bgStartBright: 100, bgEndBright: 100, luminanceAdjustment: 1.0
            });
            currentTime += 10.0;
        }
    }
    return newNodes;
}

function getParamsAtTime(tSec) {
    if (nodes.length === 0) return null;
    let node = nodes[0];
    for (const n of nodes) { if (tSec >= n.timeStart && tSec <= n.timeEnd) { node = n; break; } }
    const dur = node.timeEnd - node.timeStart;
    let t = dur === 0 ? 0 : (tSec - node.timeStart) / dur;
    t = Math.max(0, Math.min(1, t));
    
    return {
        size: lerp(node.startSize, node.endSize, t),
        blur: lerp(node.startBlur, node.endBlur, t),
        stimColor: getColorByD(lerp(node.startD, node.endD, t)),
        bgColor: getColorByD(lerp(node.bgStartD, node.bgEndD, t)),
        stimBright: lerp(node.startBright, node.endBright, t),
        bgBright: lerp(node.bgStartBright, node.bgEndBright, t)
    };
}

function renderStimulus(params) {
    if (!params) { stim.innerHTML = ''; return; }
    const { size, blur, stimColor, bgColor, stimBright, bgBright } = params;
    
    const sBr = Math.max(0, Math.min(100, stimBright ?? 100)) / 100;
    const bBr = Math.max(0, Math.min(100, bgBright ?? 100)) / 100;
    
    const sColor = `rgb(${Math.round(stimColor.r*sBr)},${Math.round(stimColor.g*sBr)},${Math.round(stimColor.b*sBr)})`;
    const bColor = `rgb(${Math.round(bgColor.r*bBr)},${Math.round(bgColor.g*bBr)},${Math.round(bgColor.b*bBr)})`;

    let circleSvg = blur > 0.1 
        ? `<defs><filter id="stim-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="${blur / 2}" /></filter></defs><circle cx="500" cy="500" r="${size}" fill="${sColor}" filter="url(#stim-blur)" />`
        : `<circle cx="500" cy="500" r="${size}" fill="${sColor}" />`;

    stim.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
            <rect width="1000" height="1000" fill="${bColor}" />
            ${circleSvg}
        </svg>
    `;
}

function animate(ts) {
    if (!isPlaying || isPaused) return;
    if (!startTime) startTime = ts;
    const el = (ts - startTime) / 1000;
    const maxT = nodes[nodes.length - 1].timeEnd;
    timeDisplay.textContent = `${Math.floor(el/60).toString().padStart(2,'0')}:${(el%60).toFixed(1).padStart(4,'0')}`;
    if (el >= maxT) {
        isPlaying = false; btnPlay.textContent = '▶ Запустить'; btnPlay.style.background = '#8b5cf6';
        btnPause.disabled = true; renderStimulus(getParamsAtTime(maxT)); return;
    }
    renderStimulus(getParamsAtTime(el));
    animId = requestAnimationFrame(animate);
}

function renderUI() {
    container.innerHTML = '';
    const step = parseFloat(stepSelect.value) || 0.1;
    const stepInt = Math.round(step * 10);

    nodes.forEach((node, index) => {
        const div = document.createElement('div');
        div.className = 'node-block';

        const makeStartOpts = (selD) => {
            let o = '';
            for (let i = 0; i <= 20; i++) {
                const D = (i / 10).toFixed(1);
                o += `<option value="${D}" ${Math.round(selD*10)===i?'selected':''}>${D} D (${getColorName(i)})</option>`;
            }
            return o;
        };

        const makeEndOpts = (sD, selD) => {
            let o = '';
            const sInt = Math.round(sD * 10);
            for (let i = sInt; i <= 20; i += stepInt) {
                const D = (i / 10).toFixed(1);
                o += `<option value="${D}" ${Math.round(selD*10)===i?'selected':''}>${D} D (${getColorName(i)})</option>`;
            }
            return o;
        };

        div.innerHTML = `
            <h4>Узел ${index + 1}</h4>
            <div style="font-size:11px; color:#8b5cf6; margin-top:5px;">Стимул:</div>
            <div class="row"><label>Нач. D:</label><select data-node="${index}" data-pos="startD" class="sel-start">${makeStartOpts(node.startD)}</select></div>
            <div class="row"><label>Кон. D:</label><select data-node="${index}" data-pos="endD" class="sel-end">${makeEndOpts(node.startD, node.endD)}</select></div>
            <div class="row"><label>Ярк %:</label><input type="number" value="${node.startBright}" data-node="${index}" data-pos="startBright"><input type="number" value="${node.endBright}" data-node="${index}" data-pos="endBright"></div>
            <div class="row"><label>Размер:</label><input type="number" value="${node.startSize}" data-node="${index}" data-pos="startSize"><input type="number" value="${node.endSize}" data-node="${index}" data-pos="endSize"></div>
            <div class="row"><label>Блюр:</label><input type="number" value="${node.startBlur}" data-node="${index}" data-pos="startBlur"><input type="number" value="${node.endBlur}" data-node="${index}" data-pos="endBlur"></div>
            <div style="font-size:11px; color:#8b5cf6; margin-top:5px;">Фон:</div>
            <div class="row"><label>Нач. D:</label><select data-node="${index}" data-pos="bgStartD" class="sel-bg-start">${makeStartOpts(node.bgStartD)}</select></div>
            <div class="row"><label>Кон. D:</label><select data-node="${index}" data-pos="bgEndD" class="sel-bg-end">${makeEndOpts(node.bgStartD, node.bgEndD)}</select></div>
            <div class="row"><label>Ярк %:</label><input type="number" value="${node.bgStartBright}" data-node="${index}" data-pos="bgStartBright"><input type="number" value="${node.bgEndBright}" data-node="${index}" data-pos="bgEndBright"></div>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.node);
            const pos = e.target.dataset.pos;
            const val = parseSafe(e.target.value, 0);
            nodes[idx][pos] = val;
            
            if (pos === 'startD') {
                nodes[idx].endD = val;
                const endSel = container.querySelector(`.sel-end[data-node="${idx}"]`);
                endSel.innerHTML = makeEndOpts(val, val);
                endSel.value = val.toFixed(1);
            }
            if (pos === 'bgStartD') {
                nodes[idx].bgEndD = val;
                const endSel = container.querySelector(`.sel-bg-end[data-node="${idx}"]`);
                endSel.innerHTML = makeEndOpts(val, val);
                endSel.value = val.toFixed(1);
            }
            renderStimulus(getParamsAtTime(0));
        });
    });
}

alignSlider.addEventListener('input', (e) => {
    alignVal.textContent = e.target.value + '%';
    renderStimulus(getParamsAtTime(0));
});
alignCheckbox.addEventListener('change', () => renderStimulus(getParamsAtTime(0)));

btnPlay.addEventListener('click', () => {
    if (isPlaying) {
        isPlaying = false; isPaused = false;
        btnPlay.textContent = '▶ Запустить'; btnPlay.style.background = '#8b5cf6';
        btnPause.textContent = '⏸ Пауза'; btnPause.style.background = '#eab308'; btnPause.disabled = true;
        cancelAnimationFrame(animId); startTime = 0; pausedTime = 0;
        timeDisplay.textContent = "00:00.0"; renderStimulus(getParamsAtTime(0));
    } else {
        isPlaying = true; isPaused = false;
        btnPlay.textContent = '⏹ Сброс'; btnPlay.style.background = '#ef4444';
        btnPause.disabled = false;
        startTime = pausedTime === 0 ? 0 : performance.now() - pausedTime * 1000;
        animate(performance.now());
    }
});

btnPause.addEventListener('click', () => {
    if (!isPlaying) return;
    isPaused = !isPaused;
    if (isPaused) {
        btnPause.textContent = '▶ Продолжить'; btnPause.style.background = '#10b981';
        cancelAnimationFrame(animId); pausedTime = (performance.now() - startTime) / 1000;
    } else {
        btnPause.textContent = '⏸ Пауза'; btnPause.style.background = '#eab308';
        startTime = performance.now() - pausedTime * 1000; animate(performance.now());
    }
});

document.getElementById('btn-calc')?.addEventListener('click', () => {
    const node = nodes[0];
    const step = parseFloat(stepSelect.value);
    const stimEnds = [];
    const bgEnds = [];
    const startInt = Math.round(node.startD * 10);
    const stepInt = Math.round(step * 10);
    for (let i = startInt; i <= 20; i += stepInt) stimEnds.push((i / 10).toFixed(1));
    const bgStartInt = Math.round(node.bgStartD * 10);
    for (let i = bgStartInt; i <= 20; i += stepInt) bgEnds.push((i / 10).toFixed(1));
    alert(`Начальный стимул: ${node.startD.toFixed(1)} D\nШаг: ${step} D\n\nСписок конечных (стимул):\n${stimEnds.join(', ')}\n\nСписок конечных (фон):\n${bgEnds.join(', ')}`);
});

nodesCountInput.addEventListener('change', (e) => {
    nodes = generateNodes(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)));
    renderUI(); renderStimulus(getParamsAtTime(0));
});

repeatsCountInput.addEventListener('change', (e) => {
    nodes = generateNodes(Math.max(1, parseInt(nodesCountInput.value) || 1));
    renderUI(); renderStimulus(getParamsAtTime(0));
});

stepSelect.addEventListener('change', () => {
    nodes.forEach(n => { n.endD = n.startD; n.bgEndD = n.bgStartD; });
    renderUI(); renderStimulus(getParamsAtTime(0));
});

nodes = generateNodes(1);
renderUI();
renderStimulus(getParamsAtTime(0));

// --- КАЛИБРОВКА ПО СЛАБОМУ ЦВЕТУ ---
document.getElementById('btn-weak-calib')?.addEventListener('click', () => {
    const node = nodes[0];
    if (!node) return;

    const startD = node.startD;
    const endD = node.endD;
    const stepInt = Math.round(parseFloat(stepSelect.value) * 10);
    
    // Находим минимальную светлоту (L) в OKLCH для всех цветов в диапазоне
    let minL = 100;
    
    // Проходим по всем целым индексам от startD до endD
    const startInt = Math.round(startD * 10);
    const endInt = Math.round(endD * 10);
    
    for (let i = startInt; i <= endInt; i += (stepInt || 1)) {
        const c = colorTable[i];
        if (!c) continue;
        const oklch = rgbToOklch(c.r, c.g, c.b);
        if (oklch.L < minL) minL = oklch.L;
    }
    
    // Если диапазон пустой, ставим minL = 50
    if (minL === 100) minL = 50;
    
    // Применяем поправку: все цвета будут иметь L не выше minL
    // (мы будем использовать это значение в getColorByD)
    window.WEAK_CALIBRATION_L = minL;
    
    // Принудительно перерисовываем
    renderStimulus(getParamsAtTime(0));
    
    alert(`Калибровка выполнена.\nСамый слабый цвет имеет L = ${minL.toFixed(1)}%.\nВсе цвета будут подогнаны под эту светлоту.`);
});

// Переопределяем getColorByD с учетом калибровки по слабому
const originalGetColorByD = getColorByD;
getColorByD = function(D) {
    // Получаем цвет стандартным способом
    let color = originalGetColorByD(D);
    
    // Если калибровка включена (есть глобальная переменная)
    if (window.WEAK_CALIBRATION_L && alignCheckbox.checked) {
        // Переводим цвет в OKLCH
        const oklch = rgbToOklch(color.r, color.g, color.b);
        // Подгоняем L под эталон (minL)
        const newL = Math.min(oklch.L, window.WEAK_CALIBRATION_L);
        // Возвращаем цвет обратно в RGB с новой светлотой
        return oklchToRgb(newL, oklch.C, oklch.H);
    }
    
    return color;
};