console.log('[sandbox] Финальная версия с выравниванием яркости');

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

function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function normalizeColorLuminance(color, targetL) {
    let l = getLuminance(color.r, color.g, color.b);
    if (l === 0) return color;
    const factor = targetL / l;
    return {
        r: Math.min(255, Math.round(color.r * factor)),
        g: Math.min(255, Math.round(color.g * factor)),
        b: Math.min(255, Math.round(color.b * factor))
    };
}

function getColorByD(D) {
    const safeD = Math.max(0, Math.min(2.0, D));
    const idxFloat = safeD * 10;
    const idx1 = Math.floor(idxFloat);
    const idx2 = Math.ceil(idxFloat);
    const t = idxFloat - idx1;

    const c1 = colorTable[idx1] || colorTable[0];
    const c2 = colorTable[idx2] || colorTable[colorTable.length - 1];

    return {
        r: Math.round(c1.r + (c2.r - c1.r) * t),
        g: Math.round(c1.g + (c2.g - c1.g) * t),
        b: Math.round(c1.b + (c2.b - c1.b) * t)
    };
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
                startBright: 100, endBright: 100, bgStartBright: 100, bgEndBright: 100
            });
            currentTime += 10.0;
        }
    }
    return newNodes;
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

function renderStimulus(params) {
    if (!params) { stim.innerHTML = ''; return; }
    const { size, blur, stimColor, bgColor, stimBright, bgBright } = params;
    const sBr = Math.max(0, Math.min(100, stimBright || 100)) / 100;
    const sColor = `rgb(${Math.round(stimColor.r*sBr)},${Math.round(stimColor.g*sBr)},${Math.round(stimColor.b*sBr)})`;
    const bBr = Math.max(0, Math.min(100, bgBright || 100)) / 100;
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

function getParamsAtTime(tSec) {
    if (nodes.length === 0) return null;
    let node = nodes[0];
    for (const n of nodes) { if (tSec >= n.timeStart && tSec <= n.timeEnd) { node = n; break; } }
    const dur = node.timeEnd - node.timeStart;
    let t = dur === 0 ? 0 : (tSec - node.timeStart) / dur;
    t = Math.max(0, Math.min(1, t));
    
    let stimColor = getColorByD(lerp(node.startD, node.endD, t));
    let bgColor = getColorByD(lerp(node.bgStartD, node.bgEndD, t));

    if (alignCheckbox.checked) {
        const level = parseInt(alignSlider.value) / 100;
        const targetL = getLuminance(0, 255, 0) * level;
        stimColor = normalizeColorLuminance(stimColor, targetL);
        bgColor = normalizeColorLuminance(bgColor, targetL * 0.5);
    }
    
    return {
        size: lerp(node.startSize, node.endSize, t),
        blur: lerp(node.startBlur, node.endBlur, t),
        stimColor, bgColor,
        stimBright: lerp(node.startBright, node.endBright, t),
        bgBright: lerp(node.bgStartBright, node.bgEndBright, t)
    };
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

alignSlider.addEventListener('input', (e) => {
    alignVal.textContent = e.target.value + '%';
    renderStimulus(getParamsAtTime(0));
});
alignCheckbox.addEventListener('change', () => renderStimulus(getParamsAtTime(0)));

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

nodes = generateNodes(1);
renderUI();
renderStimulus(getParamsAtTime(0));