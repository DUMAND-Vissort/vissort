console.log('[sandbox] Рабочая версия');

let nodes = [];
let isPlaying = false;
let animId = null;
let startTime = 0;
let pausedTime = 0;
let isPaused = false;

const colorTable = [
    { r: 255, g: 0, b: 0 },     { r: 255, g: 50, b: 0 },    { r: 255, g: 100, b: 0 },   { r: 255, g: 150, b: 0 },   { r: 255, g: 200, b: 0 },
    { r: 255, g: 255, b: 0 },   { r: 200, g: 255, b: 0 },   { r: 150, g: 255, b: 0 },   { r: 100, g: 255, b: 0 },   { r: 50, g: 255, b: 0 },
    { r: 0, g: 255, b: 0 },     { r: 0, g: 255, b: 50 },    { r: 0, g: 255, b: 100 },   { r: 0, g: 255, b: 150 },   { r: 0, g: 255, b: 200 },
    { r: 0, g: 255, b: 255 },   { r: 0, g: 200, b: 255 },   { r: 0, g: 150, b: 255 },   { r: 0, g: 100, b: 255 },   { r: 0, g: 50, b: 255 },    { r: 0, g: 0, b: 255 }
];

const stepSelect = document.getElementById('step-size');
const modeSelect = document.getElementById('anim-mode');
const nodesCountInput = document.getElementById('nodes-count');
const repeatsCountInput = document.getElementById('repeats-count');
const container = document.getElementById('nodes-container');

function lerp(a, b, t) { return a + (b - a) * t; }
function parseSafe(val, def) { const num = parseFloat(val); return isNaN(num) ? def : num; }

function getColorName(idx) {
    if (idx <= 2) return 'Красный'; if (idx <= 4) return 'Оранжевый'; if (idx <= 6) return 'Желтый';
    if (idx <= 9) return 'Желто-зеленый'; if (idx === 10) return 'Зеленый'; if (idx <= 14) return 'Голубой';
    if (idx <= 19) return 'Синий'; return 'Чистый синий';
}

function getColorByD(D) {
    const safeD = Math.max(0, Math.min(2.0, D));
    const idx = Math.round(safeD * 10);
    return colorTable[idx] || colorTable[0];
}

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
    if (!params) { document.getElementById('stim').innerHTML = ''; return; }
    const { size, blur, stimColor, bgColor, stimBright, bgBright } = params;
    const sBr = Math.max(0, Math.min(100, stimBright || 100)) / 100;
    const sColor = `rgb(${Math.round(stimColor.r*sBr)},${Math.round(stimColor.g*sBr)},${Math.round(stimColor.b*sBr)})`;
    const bBr = Math.max(0, Math.min(100, bgBright || 100)) / 100;
    const bColor = `rgb(${Math.round(bgColor.r*bBr)},${Math.round(bgColor.g*bBr)},${Math.round(bgColor.b*bBr)})`;

    let circleSvg = blur > 0.1 
        ? `<defs><filter id="stim-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="${blur / 2}" /></filter></defs><circle cx="500" cy="500" r="${size}" fill="${sColor}" filter="url(#stim-blur)" />`
        : `<circle cx="500" cy="500" r="${size}" fill="${sColor}" />`;

    document.getElementById('stim').innerHTML = `
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
    
    return {
        size: lerp(node.startSize, node.endSize, t),
        blur: lerp(node.startBlur, node.endBlur, t),
        stimColor: getColorByD(lerp(node.startD, node.endD, t)),
        bgColor: getColorByD(lerp(node.bgStartD, node.bgEndD, t)),
        stimBright: lerp(node.startBright, node.endBright, t),
        bgBright: lerp(node.bgStartBright, node.bgEndBright, t)
    };
}

function animate(ts) {
    if (!isPlaying || isPaused) return;
    if (!startTime) startTime = ts;
    const el = (ts - startTime) / 1000;
    const maxT = nodes[nodes.length - 1].timeEnd;
    document.getElementById('time-display').textContent = `${Math.floor(el/60).toString().padStart(2,'0')}:${(el%60).toFixed(1).padStart(4,'0')}`;
    if (el >= maxT) {
        isPlaying = false; document.getElementById('btn-play').textContent = '▶ Запустить'; document.getElementById('btn-play').style.background = '#8b5cf6';
        document.getElementById('btn-pause').disabled = true; renderStimulus(getParamsAtTime(maxT)); return;
    }
    renderStimulus(getParamsAtTime(el));
    animId = requestAnimationFrame(animate);
}

document.getElementById('btn-play').addEventListener('click', () => {
    if (isPlaying) {
        isPlaying = false; isPaused = false;
        document.getElementById('btn-play').textContent = '▶ Запустить'; document.getElementById('btn-play').style.background = '#8b5cf6';
        document.getElementById('btn-pause').textContent = '⏸ Пауза'; document.getElementById('btn-pause').style.background = '#eab308'; document.getElementById('btn-pause').disabled = true;
        cancelAnimationFrame(animId); startTime = 0; pausedTime = 0;
        document.getElementById('time-display').textContent = "00:00.0"; renderStimulus(getParamsAtTime(0));
    } else {
        isPlaying = true; isPaused = false;
        document.getElementById('btn-play').textContent = '⏹ Сброс'; document.getElementById('btn-play').style.background = '#ef4444';
        document.getElementById('btn-pause').disabled = false;
        startTime = pausedTime === 0 ? 0 : performance.now() - pausedTime * 1000;
        animate(performance.now());
    }
});

document.getElementById('btn-pause').addEventListener('click', () => {
    if (!isPlaying) return;
    isPaused = !isPaused;
    if (isPaused) {
        document.getElementById('btn-pause').textContent = '▶ Продолжить'; document.getElementById('btn-pause').style.background = '#10b981';
        cancelAnimationFrame(animId); pausedTime = (performance.now() - startTime) / 1000;
    } else {
        document.getElementById('btn-pause').textContent = '⏸ Пауза'; document.getElementById('btn-pause').style.background = '#eab308';
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