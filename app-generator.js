// ==================== APP-GENERATOR.JS ====================
// Генератор режимов: UI, params, физиологические фазы.
// Вынесено из app.js (§A2-v5, Фаза 5).
// Зависит: VLog, VissortDialog, AppState, VissortCore.
// Экспорт: window.AppGenerator
// ==================== ==================== ====================
(function () {
    'use strict';

    const VLog = window.VLog || { log() {}, warn() {}, error() {} };
    const VissortDialog = window.VissortDialog;
    const state = window.AppState;
    const createNewNode = (type, x, y) => window.AppEditor.createNewNode(type, x, y);
    const getNode = (id) => window.AppEditor.getNode(id);
    const getNodeComputedSize = (node) => window.AppEditor.getNodeComputedSize(node);
    const canAddConnection = (a, b, c) => window.AppEditor.canAddConnection(a, b, c);
    const requestRenderGraph = () => window.AppEditor.requestRenderGraph();
    const updateInspector = () => window.AppInspector.updateInspector();
    const { getThreshold, hexToRgb, unitToMs, acuityToSizeMm, acuityToSizePx, sha1 } = window.VissortCore;

    // Импорты из VissortCore (по мере надобности)

    VLog.log('[app-generator] init');


    // ==================== PHYSIOLOGICAL ====================
    const PHYSIOLOGICAL_PHASES = [
        { diopters: 0.0, wavelength_nm: 670, name: 'Глубокий карминно-красный', rgb: [180, 0, 0] },
        { diopters: 0.1, wavelength_nm: 648, name: 'Классический красный', rgb: [235, 0, 0] },
        { diopters: 0.2, wavelength_nm: 627, name: 'Алый / насыщенный красный', rgb: [255, 35, 0] },
        { diopters: 0.3, wavelength_nm: 610, name: 'Огненно-оранжевый', rgb: [255, 90, 0] },
        { diopters: 0.4, wavelength_nm: 593, name: 'Оранжево-жёлтый', rgb: [255, 145, 0] },
        { diopters: 0.5, wavelength_nm: 578, name: 'Янтарно-жёлтый', rgb: [215, 215, 0] },
        { diopters: 0.6, wavelength_nm: 564, name: 'Жёлто-зелёный (лайм)', rgb: [155, 245, 0] },
        { diopters: 0.7, wavelength_nm: 551, name: 'Салатовый', rgb: [90, 240, 0] },
        { diopters: 0.8, wavelength_nm: 538, name: 'Изумрудно-зелёный', rgb: [0, 230, 60] },
        { diopters: 0.9, wavelength_nm: 525, name: 'Ярко-зелёный (мятный)', rgb: [0, 235, 110] },
        { diopters: 1.0, wavelength_nm: 511, name: 'Мятно-бирюзовый', rgb: [0, 240, 160] },
        { diopters: 1.1, wavelength_nm: 498, name: 'Морская волна', rgb: [0, 210, 210] },
        { diopters: 1.2, wavelength_nm: 484, name: 'Яркий голубой', rgb: [0, 175, 255] },
        { diopters: 1.3, wavelength_nm: 469, name: 'Васильково-голубой', rgb: [0, 115, 255] },
        { diopters: 1.4, wavelength_nm: 454, name: 'Королевский синий', rgb: [0, 50, 255] },
        { diopters: 1.5, wavelength_nm: 438, name: 'Ультрамарин / тёмно-синий', rgb: [35, 0, 230] },
        { diopters: 1.6, wavelength_nm: 421, name: 'Фиолетово-синий', rgb: [90, 0, 190] }
    ];

    function buildPhysiologicalPhases(step) {
        const sd = Math.max(0.1, parseFloat(step) || 0.1);
        const sel = [];
        for (const p of PHYSIOLOGICAL_PHASES) {
            const r = p.diopters / sd;
            if (Math.abs(r - Math.round(r)) < 1e-6) sel.push(p);
        }
        const last = PHYSIOLOGICAL_PHASES[PHYSIOLOGICAL_PHASES.length - 1];
        if (sel.length === 0 || sel[sel.length - 1] !== last) sel.push(last);
        const ph = [];
        for (let i = 0; i < sel.length - 1; i++) {
            const a = sel[i],
                b = sel[i + 1];
            ph.push({
                from: { r: a.rgb[0], g: a.rgb[1], b: a.rgb[2] },
                to: { r: b.rgb[0], g: b.rgb[1], b: b.rgb[2] },
                metaFrom: a,
                metaTo: b
            });
        }
        return ph;
    }

    function buildDynamicPhases(p) {
        const m = p.dynamicMode || 'simple',
            rev = p.dynamicReverse === true;
        let base;
        if (m === 'physiological') base = buildPhysiologicalPhases(p.dynamicStep || 0.1);
        else if (m === 'rgb')
            base = [
                { from: { r: 255, g: 0, b: 0 }, to: { r: 255, g: 255, b: 0 } },
                { from: { r: 255, g: 255, b: 0 }, to: { r: 0, g: 255, b: 0 } },
                { from: { r: 0, g: 255, b: 0 }, to: { r: 0, g: 255, b: 255 } },
                { from: { r: 0, g: 255, b: 255 }, to: { r: 0, g: 0, b: 255 } }
            ];
        else {
            const A = p.dynamicStartColor || { r: 255, g: 0, b: 0 },
                B = p.dynamicEndColor || { r: 0, g: 0, b: 255 };
            base =
                p.dynamicMidEnabled && p.dynamicMidColor
                    ? [
                          { from: A, to: p.dynamicMidColor },
                          { from: p.dynamicMidColor, to: B }
                      ]
                    : [{ from: A, to: B }];
        }
        if (rev)
            return base.concat(
                base
                    .slice()
                    .reverse()
                    .map((ph) => ({ from: ph.to, to: ph.from, metaFrom: ph.metaTo, metaTo: ph.metaFrom }))
            );
        return base;
    }

    function ensureSingleGridGeneratorUI() {
        const container = document.getElementById('single-grid-settings');
        if (!container || document.getElementById('gen-single-grid-block')) return;
        const block = document.createElement('div');
        block.id = 'gen-single-grid-block';
        block.style.cssText =
            'margin-top:10px;padding:8px;background:#0a1a10;border:1px solid #22c55e;border-radius:4px;';
        block.innerHTML = `
            <label style="color:#4ade80;font-weight:bold;display:block;margin-bottom:4px;">🔲 Сетка положения стимула</label>
            <label><input type="checkbox" id="gen-single-grid-enabled"> Включить сетку</label>
            <div id="gen-single-grid-settings" style="display:none;margin-top:6px;">
                <label>Столбцов (X)</label><input type="number" id="gen-single-grid-x" value="3" min="1" max="10" step="1">
                <label>Строк (Y)</label><input type="number" id="gen-single-grid-y" value="3" min="1" max="10" step="1">
                <label><input type="checkbox" id="gen-single-grid-show-lines"> Показывать линии</label>
                <label><input type="checkbox" id="gen-single-grid-random" checked> Случайная клетка</label>
                <label><input type="checkbox" id="gen-single-grid-avoid-repeat" checked> Избегать повтора</label>
            </div>`;
        container.appendChild(block);
        const cb = document.getElementById('gen-single-grid-enabled');
        const set = document.getElementById('gen-single-grid-settings');
        cb.addEventListener('change', () => {
            set.style.display = cb.checked ? 'block' : 'none';
        });
    }
    function ensureDistanceGeneratorUI() {
        const typeSel = document.getElementById('gen-training-type');
        if (!typeSel || document.getElementById('gen-distance-block')) return;
        const firstCol = typeSel.closest('.modal-col');
        if (!firstCol) return;
        const block = document.createElement('div');
        block.id = 'gen-distance-block';
        block.style.cssText =
            'margin-top:12px;padding:8px;background:#0a1020;border:1px solid #0ea5e9;border-radius:4px;';
        block.innerHTML = `
            <label style="color:#38bdf8;font-weight:bold;display:block;margin-bottom:6px;">📏 Дистанции</label>
            <label>Общая (стимулы), м</label><input type="number" id="gen-general-distance" value="${state.generalDistance}" min="0.1" max="20" step="0.1">
            <label>Чтение, м</label><input type="number" id="gen-reading-distance" value="${state.readingDistance}" min="0.1" max="20" step="0.1">
            <div style="margin-top:8px;padding-top:6px;border-top:1px dashed #0ea5e9;">
                <label style="color:#38bdf8;font-weight:bold;display:block;margin-bottom:4px;">Допуски (камера)</label>
                <label>Увеличение, %</label><input type="number" id="gen-tol-inc" value="${state.distanceToleranceIncreasePct}" min="0" max="100" step="1">
                <label>Уменьшение, %</label><input type="number" id="gen-tol-dec" value="${state.distanceToleranceDecreasePct}" min="0" max="100" step="1">
                <label>Таймаут до пересчёта, с</label><input type="number" id="gen-tol-timeout" value="${state.distanceRestoreTimeoutSec}" min="0" max="60" step="0.5">
            </div>`;
        firstCol.appendChild(block);
    }
    function ensureBlinkGeneratorUI() {
        const typeSel = document.getElementById('gen-training-type');
        if (!typeSel || document.getElementById('gen-blink-block')) return;
        const firstCol = typeSel.closest('.modal-col');
        if (!firstCol) return;
        const block = document.createElement('div');
        block.id = 'gen-blink-block';
        block.style.cssText =
            'margin-top:12px;padding:8px;background:#0a1a1a;border:1px solid #14b8a6;border-radius:4px;';
        block.innerHTML = `
            <label style="color:#2dd4bf;font-weight:bold;display:block;margin-bottom:6px;">👁️ Blink-контроль</label>
            <label><input type="checkbox" id="gen-blink-enabled" ${state.blinkEnabled ? 'checked' : ''}> Включить</label>
            <label>Минимум морганий/мин</label><input type="number" id="gen-blink-min-rate" value="${state.blinkMinRate}" min="0" max="60" step="1">
            <label>Окно подсчёта, с</label><input type="number" id="gen-blink-window" value="${state.blinkWindowSec}" min="5" max="120" step="1">
            <label><input type="checkbox" id="gen-blink-lock-show" ${state.blinkLockShow ? 'checked' : ''}> Ждать открытых глаз</label>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Порог EAR: <b style="color:#22c55e;">${state.blinkThreshold.toFixed(3)}</b></div>`;
        firstCol.appendChild(block);
        document.getElementById('gen-blink-enabled').addEventListener('change', (e) => {
            state.blinkEnabled = e.target.checked;
            window.saveUserSettings();
        });
        document.getElementById('gen-blink-min-rate').addEventListener('change', (e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= 0 && v <= 60) {
                state.blinkMinRate = v;
                window.saveUserSettings();
            }
        });
        document.getElementById('gen-blink-window').addEventListener('change', (e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= 5 && v <= 120) {
                state.blinkWindowSec = v;
                window.saveUserSettings();
            }
        });
        document.getElementById('gen-blink-lock-show').addEventListener('change', (e) => {
            state.blinkLockShow = e.target.checked;
            window.saveUserSettings();
        });
    }
    function ensureCircleGeneratorUI() {
        const container = document.getElementById('single-grid-settings');
        if (!container || document.getElementById('gen-circle-block')) return;
        const block = document.createElement('div');
        block.id = 'gen-circle-block';
        block.style.cssText =
            'margin-top:10px;padding:8px;background:#1a0a15;border:1px solid #ec4899;border-radius:4px;';
        block.innerHTML = `
            <label style="color:#f472b6;font-weight:bold;display:block;margin-bottom:4px;">🎯 Динамика Круг</label>
            <label><input type="checkbox" id="gen-circle-enabled"> Включить режим кругов</label>
            <div id="gen-circle-settings" style="display:none;margin-top:8px;">
                <div style="border-top:1px dashed #ec4899;padding-top:6px;">
                    <label style="color:#f9a8d4;font-weight:bold;">Внутренний круг</label>
                    <label>Радиус (% от общего)</label><input type="number" id="gen-ci-radius" value="40" min="5" max="95" step="1">
                    <label>Цвет 1 (центр)</label><input type="color" id="gen-ci-c1" value="#ff0000">
                    <label><input type="checkbox" id="gen-ci-mid-enabled"> Использовать цвет 3</label>
                    <div id="gen-ci-mid-row" style="display:none;"><label>Цвет 3</label><input type="color" id="gen-ci-c3" value="#ffff00"></div>
                    <label>Цвет 2 (край)</label><input type="color" id="gen-ci-c2" value="#0000ff">
                    <label>Время (с)</label><input type="number" id="gen-ci-duration" value="10" min="0.1" step="0.1">
                    <label><input type="checkbox" id="gen-ci-loop" checked> Повторять</label>
                    <label><input type="checkbox" id="gen-ci-reverse"> Пинг-понг</label>
                </div>
                <div style="border-top:1px dashed #ec4899;margin-top:6px;padding-top:6px;">
                    <label style="color:#f9a8d4;font-weight:bold;">Внешнее кольцо</label>
                    <label>Цвет 1 (у диска)</label><input type="color" id="gen-co-c1" value="#00ff00">
                    <label><input type="checkbox" id="gen-co-mid-enabled"> Использовать цвет 3</label>
                    <div id="gen-co-mid-row" style="display:none;"><label>Цвет 3</label><input type="color" id="gen-co-c3" value="#00ffff"></div>
                    <label>Цвет 2 (край)</label><input type="color" id="gen-co-c2" value="#0080ff">
                    <label>Время (с)</label><input type="number" id="gen-co-duration" value="10" min="0.1" step="0.1">
                    <label><input type="checkbox" id="gen-co-loop" checked> Повторять</label>
                    <label><input type="checkbox" id="gen-co-reverse"> Пинг-понг</label>
                </div>
            </div>`;
        container.appendChild(block);
        const cb = document.getElementById('gen-circle-enabled'),
            set = document.getElementById('gen-circle-settings');
        cb.addEventListener('change', () => {
            set.style.display = cb.checked ? 'block' : 'none';
        });
        const ciM = document.getElementById('gen-ci-mid-enabled'),
            ciMR = document.getElementById('gen-ci-mid-row');
        ciM.addEventListener('change', () => {
            ciMR.style.display = ciM.checked ? 'block' : 'none';
        });
        const coM = document.getElementById('gen-co-mid-enabled'),
            coMR = document.getElementById('gen-co-mid-row');
        coM.addEventListener('change', () => {
            coMR.style.display = coM.checked ? 'block' : 'none';
        });
    }

    function ensurePeripheralGeneratorUI() {
        const container = document.getElementById('single-grid-settings');
        if (!container || document.getElementById('gen-peri-block')) return;
        const block = document.createElement('div');
        block.id = 'gen-peri-block';
        block.style.cssText =
            'margin-top:10px;padding:8px;background:#0a1a15;border:1px solid #10b981;border-radius:4px;';
        block.innerHTML = `
            <label style="color:#34d399;font-weight:bold;display:block;margin-bottom:4px;">🟢 Периферийные точки</label>
            <label><input type="checkbox" id="gen-peri-enabled"> Включить точки</label>
            <div id="gen-peri-settings" style="display:none;margin-top:6px;">
                <label>Количество (1–12)</label><input type="number" id="gen-peri-count" value="4" min="1" max="12">
                <label>V размера (острота)</label><input type="number" id="gen-peri-acuity" value="0.3" min="0.1" max="1.0" step="0.1">
                <label>Радиус min (%)</label><input type="number" id="gen-peri-rmin" value="60" min="20" max="100">
                <label>Радиус max (%)</label><input type="number" id="gen-peri-rmax" value="90" min="20" max="100">
                <label>Цвет точки</label><input type="color" id="gen-peri-color" value="#00ff64">
                <label>Движение</label>
                <select id="gen-peri-motion"><option value="static" selected>Статично</option><option value="rotate">Вращение</option><option value="pulse">Пульс</option></select>
                <label>Скорость (об/с или Гц)</label><input type="number" id="gen-peri-speed" value="0.3" min="0.02" max="5" step="0.05">
                <label><input type="checkbox" id="gen-peri-random" checked> Случайные углы</label>
            </div>`;
        container.appendChild(block);
        const cb = document.getElementById('gen-peri-enabled');
        const set = document.getElementById('gen-peri-settings');
        cb.addEventListener('change', () => {
            set.style.display = cb.checked ? 'block' : 'none';
        });
    }
    function ensureDefocusGeneratorUI() {
        const container = document.getElementById('single-grid-settings');
        if (!container || document.getElementById('gen-df-block')) return;
        const block = document.createElement('div');
        block.id = 'gen-df-block';
        block.style.cssText =
            'margin-top:10px;padding:8px;background:#1a0a0a;border:1px solid #dc2626;border-radius:4px;';
        block.innerHTML = `
            <label style="color:#f87171;font-weight:bold;display:block;margin-bottom:4px;">🔴 Цифровой дефокус</label>
            <label><input type="checkbox" id="gen-df-enabled"> Включить дефокус</label>
            <div id="gen-df-settings" style="display:none;margin-top:6px;">
                <label>Радиус центра (мм)</label><input type="number" id="gen-df-radius-mm" value="13" min="3" max="50" step="1">
                <label>Фон центра (красный)</label><input type="color" id="gen-df-center-bg" value="#cc0000">
                <label>Цвет стимула в центре (чёрный)</label><input type="color" id="gen-df-stim-color" value="#000000">
                <label>Фон периферии (синий)</label><input type="color" id="gen-df-peri-bg" value="#0047ab">
                <label>Размытие к краю (%)</label><input type="number" id="gen-df-blur" value="0" min="0" max="100" step="5">
            </div>`;
        container.appendChild(block);
        const cb = document.getElementById('gen-df-enabled');
        const set = document.getElementById('gen-df-settings');
        cb.addEventListener('change', () => {
            set.style.display = cb.checked ? 'block' : 'none';
        });
    }

    function ensureBlinkAnimationGeneratorUI() {
        const container = document.getElementById('single-grid-settings');
        if (!container || document.getElementById('gen-blink-anim-block')) return;
        const block = document.createElement('div');
        block.id = 'gen-blink-anim-block';
        block.style.cssText =
            'margin-top:10px;padding:8px;background:#1a0a05;border:1px solid #f97316;border-radius:4px;';
        block.innerHTML = `
            <label style="color:#fb923c;font-weight:bold;display:block;margin-bottom:4px;">🔦 Моргание</label>
            <label><input type="checkbox" id="gen-blink-anim-enabled"> Включить моргание</label>
            <div id="gen-blink-anim-settings" style="display:none;margin-top:6px;">
                <label>Цель</label>
                <select id="gen-blink-anim-target"><option value="stim" selected>Только стимул</option><option value="bg">Только фон</option><option value="both">Стимул + фон</option></select>
                <label>Цвет A</label><input type="color" id="gen-blink-anim-cA" value="#ff0000">
                <label>Цвет B</label><input type="color" id="gen-blink-anim-cB" value="#0000ff">
                <label>Период (мс)</label><input type="number" id="gen-blink-anim-interval" value="500" min="50" max="5000" step="50">
                <label>Доля A</label><input type="number" id="gen-blink-anim-duty" value="0.5" min="0.05" max="0.95" step="0.05">
                <label>Количество (0 = ∞)</label><input type="number" id="gen-blink-anim-count" value="0" min="0" max="9999">
            </div>`;
        container.appendChild(block);
        const cb = document.getElementById('gen-blink-anim-enabled');
        const set = document.getElementById('gen-blink-anim-settings');
        cb.addEventListener('change', () => {
            set.style.display = cb.checked ? 'block' : 'none';
        });
    }
    function modeParamsToNode(modeParams) {
        const prevId = state.activeNodeId;
        const id = createNewNode('STIMULUS');
        const node = getNode(id);
        node.name = modeParams.singleCircleEnabled ? 'Динамика Круг' : 'Стимул';
        node.stimType = modeParams.type || 'LETTER_E';
        node.stimAcuity = modeParams.startAcuity || 1.0;
        node.endAcuity = modeParams.endAcuity || modeParams.startAcuity || 1.0;
        node.acuityStep = modeParams.acuityStep || 0.1;
        node.stimDistance = modeParams.distanceMeters || state.generalDistance || 1;
        node.stimPPI = modeParams.ppi || state.screenPPI || 96;
        node.stimR = modeParams.startStimColor?.r ?? 255;
        node.stimG = modeParams.startStimColor?.g ?? 255;
        node.stimB = modeParams.startStimColor?.b ?? 255;
        node.bgR = modeParams.startBgColor?.r ?? 0;
        node.bgG = modeParams.startBgColor?.g ?? 0;
        node.bgB = modeParams.startBgColor?.b ?? 0;
        node.seriesCount = modeParams.seriesCount || 10;
        node.adaptiveAcuity = modeParams.adaptiveAcuity !== false;
        node.seriesSize = modeParams.seriesSize || 6;
        node.seriesThreshold = modeParams.seriesThreshold || 4;
        node.isActive = modeParams.isActive !== false;
        node.singleRandomPos = modeParams.singleRandomPos === true;
        node.singleGridEnabled = modeParams.singleGridEnabled === true;
        node.singleGridX = Math.max(1, Math.min(10, modeParams.singleGridX || 1));
        node.singleGridY = Math.max(1, Math.min(10, modeParams.singleGridY || 1));
        node.singleGridShowLines = modeParams.singleGridShowLines === true;
        node.singleGridRandomCell = modeParams.singleGridRandomCell !== false;
        node.singleGridAvoidRepeat = modeParams.singleGridAvoidRepeat !== false;
        node.singleGridFixedRow = modeParams.singleGridFixedRow || 0;
        node.singleGridFixedCol = modeParams.singleGridFixedCol || 0;
        node.singleGridCells = Array.isArray(modeParams.singleGridCells)
            ? modeParams.singleGridCells.slice()
            : [];
        node.singleStimDynamicEnabled = modeParams.singleStimDynamicEnabled === true;
        node.singleStimColor1 = modeParams.singleStimColor1 || { r: 255, g: 0, b: 0 };
        node.singleStimMidEnabled = modeParams.singleStimMidEnabled === true;
        node.singleStimColor3 = modeParams.singleStimColor3 || { r: 255, g: 255, b: 0 };
        node.singleStimColor2 = modeParams.singleStimColor2 || { r: 0, g: 0, b: 255 };
        node.singleStimDuration = modeParams.singleStimDuration || 10000;
        node.singleStimLoop = modeParams.singleStimLoop === true;
        node.singleStimReverse = modeParams.singleStimReverse === true;
        node.singleBgDynamicEnabled = modeParams.singleBgDynamicEnabled === true;
        node.singleBgColor1 = modeParams.singleBgColor1 || { r: 255, g: 0, b: 0 };
        node.singleBgMidEnabled = modeParams.singleBgMidEnabled === true;
        node.singleBgColor3 = modeParams.singleBgColor3 || { r: 255, g: 255, b: 0 };
        node.singleBgColor2 = modeParams.singleBgColor2 || { r: 0, g: 0, b: 255 };
        node.singleBgDuration = modeParams.singleBgDuration || 10000;
        node.singleBgLoop = modeParams.singleBgLoop === true;
        node.singleBgReverse = modeParams.singleBgReverse === true;
        node.singleCircleEnabled = modeParams.singleCircleEnabled === true;
        node.circleInnerEnabled = modeParams.circleInnerEnabled !== false;
        node.circleInnerRadiusPct = modeParams.circleInnerRadiusPct ?? 40;
        node.circleInnerColor1 = modeParams.circleInnerColor1 || { r: 255, g: 0, b: 0 };
        node.circleInnerMidEnabled = modeParams.circleInnerMidEnabled === true;
        node.circleInnerColor3 = modeParams.circleInnerColor3 || { r: 255, g: 255, b: 0 };
        node.circleInnerColor2 = modeParams.circleInnerColor2 || { r: 0, g: 0, b: 255 };
        node.circleInnerDuration = modeParams.circleInnerDuration || 10000;
        node.circleInnerLoop = modeParams.circleInnerLoop !== false;
        node.circleInnerReverse = modeParams.circleInnerReverse === true;
        node.circleOuterEnabled = modeParams.circleOuterEnabled !== false;
        node.circleOuterColor1 = modeParams.circleOuterColor1 || { r: 0, g: 255, b: 0 };
        node.circleOuterMidEnabled = modeParams.circleOuterMidEnabled === true;
        node.circleOuterColor3 = modeParams.circleOuterColor3 || { r: 0, g: 255, b: 255 };
        node.circleOuterColor2 = modeParams.circleOuterColor2 || { r: 0, g: 128, b: 255 };
        node.circleOuterDuration = modeParams.circleOuterDuration || 10000;
        node.circleOuterLoop = modeParams.circleOuterLoop !== false;
        node.circleOuterReverse = modeParams.circleOuterReverse === true;
        node.periEnabled = modeParams.periEnabled === true;
        node.periCount = modeParams.periCount || 4;
        node.periAcuity = modeParams.periAcuity ?? 0.3;
        node.periRadiusMinPct = modeParams.periRadiusMinPct ?? 60;
        node.periRadiusMaxPct = modeParams.periRadiusMaxPct ?? 90;
        node.periColor = modeParams.periColor || { r: 0, g: 255, b: 100 };
        node.periMotion = modeParams.periMotion || 'static';
        node.periSpeed = modeParams.periSpeed ?? 0.3;
        node.periRandomAngles = modeParams.periRandomAngles !== false;
        node.dfEnabled = modeParams.dfEnabled === true;
        node.dfCenterRadiusMm = modeParams.dfCenterRadiusMm ?? 13;
        node.dfCenterBg = modeParams.dfCenterBg || { r: 204, g: 0, b: 0 };
        node.dfStimColor = modeParams.dfStimColor || { r: 0, g: 0, b: 0 };
        node.dfPeriBg = modeParams.dfPeriBg || { r: 0, g: 71, b: 171 };
        node.dfPeriBlur = modeParams.dfPeriBlur || 0;
        node.blinkEnabled = modeParams.blinkEnabled === true;
        node.blinkTarget = modeParams.blinkTarget || 'stim';
        node.blinkColorA = modeParams.blinkColorA || { r: 255, g: 0, b: 0 };
        node.blinkColorB = modeParams.blinkColorB || { r: 0, g: 0, b: 255 };
        node.blinkIntervalMs = modeParams.blinkIntervalMs || 500;
        node.blinkDuty = modeParams.blinkDuty ?? 0.5;
        node.blinkCount = modeParams.blinkCount || 0;
        node.delay1 = modeParams.delay1 || 1000;
        node.duration = modeParams.startDuration || 1000;
        node.response = modeParams.response || 1000;
        node.delay2 = modeParams.delay2 || 1000;
        node.stimSize = getNodeComputedSize(node);
        const pn = prevId ? getNode(prevId) : null;
        if (pn && pn.id !== node.id) {
            node.x = pn.x + 340;
            node.y = pn.y;
            if (canAddConnection(pn.id, node.id, false))
                state.connections.push({
                    fromId: pn.id,
                    toId: node.id,
                    isLoop: false,
                    loopMode: 'TIME',
                    loopLimit: 1,
                    lifeTime: 0,
                    initiateByAnswer: true,
                    condition: 'none',
                    inheritSize: false,
                    inheritSpeed: false
                });
        }
        requestRenderGraph();
        updateInspector();
    }
    function modeParamsToReadingNode(modeParams) {
        const prevId = state.activeNodeId;
        const id = createNewNode('READING');
        const node = getNode(id);
        node.name = 'Чтение';
        node.readingFontFamily = 'Segoe UI';
        node.readingAcuity = modeParams.startAcuity || 1.0;
        node.readingDistance = modeParams.readingDistance || state.readingDistance || 1;
        node.readingPPI = state.screenPPI || 96;
        node.readingTextColor = modeParams.textColor || { r: 0, g: 0, b: 0 };
        node.readingBgMode = modeParams.bgMode || 'solid';
        node.readingBgColor = modeParams.bgColor || { r: 255, g: 255, b: 255 };
        node.readingSplitLeftWidthPercent = modeParams.splitLeftWidthPercent ?? 50;
        node.readingSplitLeftColor = modeParams.splitLeftColor;
        node.readingSplitRightColor = modeParams.splitRightColor;
        node.readingGradientMidEnabled = modeParams.gradientMidEnabled !== false;
        node.readingGradientLeftColor = modeParams.gradientLeftColor;
        node.readingGradientMidColor = modeParams.gradientMidColor;
        node.readingGradientMidPosition = modeParams.gradientMidPosition ?? 50;
        node.readingGradientRightColor = modeParams.gradientRightColor;
        node.readingDynamicMode = modeParams.dynamicMode || 'simple';
        node.readingDynamicReverse = modeParams.dynamicReverse === true;
        node.readingDynamicMidEnabled = modeParams.dynamicMidEnabled === true;
        node.readingDynamicStartColor = modeParams.dynamicStartColor;
        node.readingDynamicMidColor = modeParams.dynamicMidColor;
        node.readingDynamicEndColor = modeParams.dynamicEndColor;
        node.readingDynamicDuration = modeParams.dynamicDuration || 10000;
        node.readingDynamicLoop = modeParams.dynamicLoop === true;
        node.readingDynamicStep = modeParams.dynamicStep || 0.1;
        node.readingDynamicStepDuration = modeParams.dynamicStepDuration || 1000;
        node.readingDynamicShowLabel = modeParams.dynamicShowLabel !== false;
        node.duration = 60000;
        const text = (modeParams.text || '').trim();
        if (text)
            (async () => {
                const bid = await sha1(text);
                if (!window._books[bid]) window._books[bid] = { name: 'Текст из Режимов', text };
                node.bookId = bid;
                node.bookName = window._books[bid].name;
                window.setLastBookId(bid);
                requestRenderGraph();
                updateInspector();
            })();
        const pn = prevId ? getNode(prevId) : null;
        if (pn && pn.id !== node.id) {
            node.x = pn.x + 340;
            node.y = pn.y;
            if (canAddConnection(pn.id, node.id, false))
                state.connections.push({
                    fromId: pn.id,
                    toId: node.id,
                    isLoop: false,
                    loopMode: 'TIME',
                    loopLimit: 1,
                    lifeTime: 0,
                    initiateByAnswer: true,
                    condition: 'none',
                    inheritSize: false,
                    inheritSpeed: false
                });
        }
        requestRenderGraph();
        updateInspector();
    }
    function updateGeneratorVisibility() {
        const t = document.getElementById('gen-training-type').value;
        document.getElementById('single-grid-settings').style.display = t === 'single' ? 'block' : 'none';
        document.getElementById('compare-settings').style.display = t === 'compare' ? 'block' : 'none';
        document.getElementById('reading-settings').style.display = t === 'reading' ? 'block' : 'none';
    }
    function updateBgModeVisibility() {
        const m = document.getElementById('gen-reading-bg-mode')?.value || 'solid';
        const s = document.getElementById('reading-solid-settings'),
            sp = document.getElementById('reading-split-settings');
        const g = document.getElementById('reading-gradient-settings'),
            d = document.getElementById('reading-dynamic-settings');
        if (s) s.style.display = m === 'solid' ? 'block' : 'none';
        if (sp) sp.style.display = m === 'split' ? 'block' : 'none';
        if (g) g.style.display = m === 'gradient' ? 'block' : 'none';
        if (d) d.style.display = m === 'dynamic' ? 'block' : 'none';
    }
    function updateGradientMidVisibility() {
        const cb = document.getElementById('gen-reading-gradient-mid-enabled');
        const show = cb ? cb.checked : true;
        const r = document.getElementById('gradient-mid-row');
        const l = document.getElementById('gradient-mid-pos-label');
        const i = document.getElementById('gen-reading-gradient-mid-position');
        if (r) r.style.display = show ? 'flex' : 'none';
        if (l) l.style.display = show ? 'block' : 'none';
        if (i) i.style.display = show ? 'block' : 'none';
    }
    function updateDynamicMidVisibility() {
        const cb = document.getElementById('gen-reading-dynamic-mid-enabled');
        const s = cb ? cb.checked : false;
        const r = document.getElementById('dynamic-mid-row');
        if (r) r.style.display = s ? 'flex' : 'none';
    }
    function updateDynamicModeVisibility() {
        const m = document.getElementById('gen-reading-dynamic-mode')?.value || 'simple';
        const sc = document.getElementById('reading-dynamic-simple-colors');
        const ps = document.getElementById('reading-dynamic-physio-settings');
        const ds = document.getElementById('reading-dynamic-duration-settings');
        if (sc) sc.style.display = m === 'simple' ? 'block' : 'none';
        if (ps) ps.style.display = m === 'physiological' ? 'block' : 'none';
        if (ds) ds.style.display = m === 'physiological' ? 'none' : 'block';
        if (m === 'simple') updateDynamicMidVisibility();
        if (m === 'physiological') updatePhysioListHint();
    }
    function updatePhysioListHint() {
        const h = document.getElementById('physio-list-hint');
        const ss = document.getElementById('gen-reading-dynamic-step');
        const sd = ss ? Math.max(0.1, parseFloat(ss.value) || 0.1) : 0.1;
        const l = document.getElementById('gen-reading-dynamic-step-duration-label');
        if (l) l.textContent = `Длительность шага (${sd.toFixed(1)} дптр)`;
        if (!h) return;
        let c = 0;
        for (const p of PHYSIOLOGICAL_PHASES) {
            const r = p.diopters / sd;
            if (Math.abs(r - Math.round(r)) < 1e-6) c++;
        }
        const last = PHYSIOLOGICAL_PHASES[PHYSIOLOGICAL_PHASES.length - 1];
        const lr = last.diopters / sd;
        if (Math.abs(lr - Math.round(lr)) > 1e-6) c++;
        h.textContent = `0.0 → +1.6 дптр • ${c} точек • шаг ${sd.toFixed(1)} • Thibos et al.`;
    }
    function updateSingleStimDynamicVisibility() {
        const cb = document.getElementById('gen-single-stim-dynamic-enabled');
        const s = cb ? cb.checked : false;
        const p = document.getElementById('single-stim-dynamic-settings');
        if (p) p.style.display = s ? 'block' : 'none';
        if (s) updateSingleStimMidVisibility();
    }
    function updateSingleStimMidVisibility() {
        const cb = document.getElementById('gen-single-stim-mid-enabled');
        const s = cb ? cb.checked : false;
        const r = document.getElementById('single-stim-mid-row');
        if (r) r.style.display = s ? 'flex' : 'none';
    }
    function updateSingleBgDynamicVisibility() {
        const cb = document.getElementById('gen-single-bg-dynamic-enabled');
        const s = cb ? cb.checked : false;
        const p = document.getElementById('single-bg-dynamic-settings');
        if (p) p.style.display = s ? 'block' : 'none';
        if (s) updateSingleBgMidVisibility();
    }
    function updateSingleBgMidVisibility() {
        const cb = document.getElementById('gen-single-bg-mid-enabled');
        const s = cb ? cb.checked : false;
        const r = document.getElementById('single-bg-mid-row');
        if (r) r.style.display = s ? 'flex' : 'none';
    }
    // ==================== EXPORT ====================
    window.AppGenerator = {
        PHYSIOLOGICAL_PHASES,
        buildPhysiologicalPhases,
        buildDynamicPhases,
        ensureSingleGridGeneratorUI,
        ensureDistanceGeneratorUI,
        ensureBlinkGeneratorUI,
        ensureCircleGeneratorUI,
        ensurePeripheralGeneratorUI,
        ensureDefocusGeneratorUI,
        ensureBlinkAnimationGeneratorUI,
        renderGridPreview,
        generateCellParamsFields,
        collectCompareParams,
        buildModeParamsFromUI,
        modeParamsToNode,
        modeParamsToReadingNode,
        updateGeneratorVisibility,
        updateBgModeVisibility,
        updateGradientMidVisibility,
        updateDynamicMidVisibility,
        updateDynamicModeVisibility,
        updatePhysioListHint,
        updateSingleStimDynamicVisibility,
        updateSingleStimMidVisibility,
        updateSingleBgDynamicVisibility,
        updateSingleBgMidVisibility
    };
    VLog.log('[app-generator] AppGenerator экспортирован');
})();
    function renderGridPreview() {
        const state = window.AppState;
        const gX = parseInt(document.getElementById('gen-grid-x').value) || 3;
        const gY = parseInt(document.getElementById('gen-grid-y').value) || 3;
        const c = document.getElementById('grid-preview');
        c.style.gridTemplateColumns = `repeat(${gX}, 40px)`;
        c.innerHTML = '';
        if (state.selectedCells.length > gX * gY) state.selectedCells = state.selectedCells.slice(0, gX * gY);
        for (let row = 0; row < gY; row++)
            for (let col = 0; col < gX; col++) {
                const el = document.createElement('div');
                el.className = 'grid-cell';
                el.dataset.row = row;
                el.dataset.col = col;
                if (state.selectedCells.some((sc) => sc.row === row && sc.col === col)) el.style.background = '#8b5cf6';
                el.addEventListener('click', () => {
                    const i = state.selectedCells.findIndex((sc) => sc.row === row && sc.col === col);
                    if (i === -1) state.selectedCells.push({ row, col });
                    else state.selectedCells.splice(i, 1);
                    renderGridPreview();
                    generateCellParamsFields();
                });
                c.appendChild(el);
            }
    }

    function generateCellParamsFields() {
        const state = window.AppState;
        const acuityToSizeMm = window.VissortCore.acuityToSizeMm;
        const c = document.getElementById('cell-params-container');
        c.innerHTML = '';
        state.selectedCells.forEach((cell) => {
            const div = document.createElement('div');
            div.style.cssText = 'border:1px solid #444;padding:6px;margin-top:6px;';
            let opts = '';
            for (let i = 1; i <= 10; i++) {
                const v = i / 10;
                const mm = acuityToSizeMm(v, 1);
                opts += `<option value="${v.toFixed(1)}">${v.toFixed(1)} — ${mm.toFixed(2)} мм</option>`;
            }
            div.innerHTML = `
                <label><b>Клетка (${cell.row + 1}, ${cell.col + 1})</b></label>
                <label>V</label><select class="cell-acuity">${opts}</select>
                <label>Цвет стимула</label><input type="color" class="cell-stim-color" value="#ffffff">
                <label>Цвет фона</label><input type="color" class="cell-bg-color" value="#000000">
                <label>Время (мс)</label><input type="number" class="cell-duration" value="1000" min="100" max="5000">`;
            c.appendChild(div);
        });
    }

    function collectCompareParams() {
        const state = window.AppState;
        const acuityToSizePx = window.VissortCore.acuityToSizePx;
        const hexToRgb = window.VissortCore.hexToRgb;
        const gX = parseInt(document.getElementById('gen-grid-x').value) || 3;
        const gY = parseInt(document.getElementById('gen-grid-y').value) || 3;
        const cm = document.getElementById('gen-compare-mode').value;
        const d = parseFloat(document.getElementById('gen-distance').value) || state.generalDistance || 1;
        const ppi = parseInt(document.getElementById('gen-ppi').value) || state.screenPPI || 96;
        const cp = [];
        document.querySelectorAll('#cell-params-container > div').forEach((div) => {
            const V = parseFloat(div.querySelector('.cell-acuity').value) || 1.0;
            const sc = hexToRgb(div.querySelector('.cell-stim-color').value);
            const bc = hexToRgb(div.querySelector('.cell-bg-color').value);
            const dur = parseInt(div.querySelector('.cell-duration').value) || 1000;
            cp.push({
                size: acuityToSizePx(V, d, ppi),
                acuity: V,
                distance: d,
                ppi,
                stimR: sc.r,
                stimG: sc.g,
                stimB: sc.b,
                bgR: bc.r,
                bgG: bc.g,
                bgB: bc.b,
                duration: dur
            });
        });
        return { compareMode: cm, gridX: gX, gridY: gY, activeCells: state.selectedCells.slice(), cellParams: cp };
    }

    function buildModeParamsFromUI() {
        const state = window.AppState;
        const ss = parseInt(document.getElementById('gen-series-size').value) || 6;
        const tt = document.getElementById('gen-training-type').value;
        const gdEl = document.getElementById('gen-general-distance');
        if (gdEl) {
            const v = parseFloat(gdEl.value);
            if (!isNaN(v) && v > 0) {
                state.generalDistance = v;
                window.saveUserSettings();
            }
        }
        const rdEl = document.getElementById('gen-reading-distance');
        if (rdEl) {
            const v = parseFloat(rdEl.value);
            if (!isNaN(v) && v > 0) {
                state.readingDistance = v;
                window.saveUserSettings();
            }
        }
        const tiEl = document.getElementById('gen-tol-inc');
        if (tiEl) {
            const v = parseFloat(tiEl.value);
            if (!isNaN(v) && v >= 0 && v <= 100) {
                state.distanceToleranceIncreasePct = v;
                window.saveUserSettings();
            }
        }
        const tdEl = document.getElementById('gen-tol-dec');
        if (tdEl) {
            const v = parseFloat(tdEl.value);
            if (!isNaN(v) && v >= 0 && v <= 100) {
                state.distanceToleranceDecreasePct = v;
                window.saveUserSettings();
            }
        }
        const ttEl = document.getElementById('gen-tol-timeout');
        if (ttEl) {
            const v = parseFloat(ttEl.value);
            if (!isNaN(v) && v >= 0 && v <= 60) {
                state.distanceRestoreTimeoutSec = v;
                window.saveUserSettings();
            }
        }
        const p = {
            mode: window.safeVal('gen-mode', 'общая'),
            trainingType: tt,
            seriesCount: window.safeVal('gen-series', 10, parseInt),
            seriesSize: ss,
            seriesThreshold: window.safeVal('gen-threshold', getThreshold(ss), parseInt),
            type: window.safeVal('gen-type', 'LETTER_E'),
            startAcuity: window.safeVal('gen-start-acuity', 0.5, parseFloat),
            endAcuity: window.safeVal('gen-end-acuity', 2.0, parseFloat),
            acuityStep: window.safeVal('gen-acuity-step', 0.1, parseFloat),
            distanceMeters: state.generalDistance,
            readingDistance: state.readingDistance,
            distanceToleranceIncreasePct: state.distanceToleranceIncreasePct,
            distanceToleranceDecreasePct: state.distanceToleranceDecreasePct,
            distanceRestoreTimeoutSec: state.distanceRestoreTimeoutSec,
            ppi: window.safeVal('gen-ppi', state.screenPPI || 96, parseInt),
            minDetectPct: window.safeVal('min-detect-pct', 80, parseInt),
            startStimColor: hexToRgb(window.safeVal('gen-start-color', '#00ff00')),
            endStimColor: hexToRgb(window.safeVal('gen-end-color', '#ff0000')),
            startBgColor: hexToRgb(window.safeVal('gen-start-bg', '#00ff00')),
            endBgColor: hexToRgb(window.safeVal('gen-end-bg', '#000000')),
            duration: unitToMs(window.safeVal('gen-duration', 1, parseFloat), window.safeVal('gen-duration-unit', 's')),
            response: unitToMs(window.safeVal('gen-response', 0, parseFloat), window.safeVal('gen-response-unit', 's')),
            adaptiveAcuity: window.safeChecked('gen-adaptive', true),
            delay1: unitToMs(window.safeVal('gen-delay1', 1, parseFloat), window.safeVal('gen-delay1-unit', 's')),
            delay2: unitToMs(window.safeVal('gen-delay2', 1, parseFloat), window.safeVal('gen-delay2-unit', 's')),
            isActive: window.safeChecked('gen-active', false)
        };
        if (p.response == null) p.response = 1000;
        p.startDuration = p.delay2;
        if (tt === 'single') {
            p.singleRandomPos = window.safeChecked('gen-single-random-pos', false);
            p.singleGridEnabled = window.safeChecked('gen-single-grid-enabled', false);
            p.singleGridX = window.safeVal('gen-single-grid-x', 3, parseInt);
            p.singleGridY = window.safeVal('gen-single-grid-y', 3, parseInt);
            p.singleGridShowLines = window.safeChecked('gen-single-grid-show-lines', false);
            p.singleGridRandomCell = window.safeChecked('gen-single-grid-random', true);
            p.singleGridAvoidRepeat = window.safeChecked('gen-single-grid-avoid-repeat', true);
            p.singleGridFixedRow = 0;
            p.singleGridFixedCol = 0;
            p.singleGridCells = [];
            p.singleStimDynamicEnabled = window.safeChecked('gen-single-stim-dynamic-enabled', false);
            p.singleStimColor1 = hexToRgb(window.safeVal('gen-single-stim-color1', '#ff0000'));
            p.singleStimMidEnabled = window.safeChecked('gen-single-stim-mid-enabled', false);
            p.singleStimColor3 = hexToRgb(window.safeVal('gen-single-stim-color3', '#ffff00'));
            p.singleStimColor2 = hexToRgb(window.safeVal('gen-single-stim-color2', '#0000ff'));
            p.singleStimDuration = unitToMs(
                window.safeVal('gen-single-stim-duration', 10, parseFloat),
                window.safeVal('gen-single-stim-duration-unit', 's')
            );
            p.singleStimLoop = window.safeChecked('gen-single-stim-loop', false);
            p.singleStimReverse = window.safeChecked('gen-single-stim-reverse', false);
            p.singleBgDynamicEnabled = window.safeChecked('gen-single-bg-dynamic-enabled', false);
            p.singleBgColor1 = hexToRgb(window.safeVal('gen-single-bg-color1', '#ff0000'));
            p.singleBgMidEnabled = window.safeChecked('gen-single-bg-mid-enabled', false);
            p.singleBgColor3 = hexToRgb(window.safeVal('gen-single-bg-color3', '#ffff00'));
            p.singleBgColor2 = hexToRgb(window.safeVal('gen-single-bg-color2', '#0000ff'));
            p.singleBgDuration = unitToMs(
                window.safeVal('gen-single-bg-duration', 10, parseFloat),
                window.safeVal('gen-single-bg-duration-unit', 's')
            );
            p.singleBgLoop = window.safeChecked('gen-single-bg-loop', false);
            p.singleBgReverse = window.safeChecked('gen-single-bg-reverse', false);
            p.singleCircleEnabled = window.safeChecked('gen-circle-enabled', false);
            p.circleInnerEnabled = true;
            p.circleInnerRadiusPct = window.safeVal('gen-ci-radius', 40, parseInt);
            p.circleInnerColor1 = hexToRgb(window.safeVal('gen-ci-c1', '#ff0000'));
            p.circleInnerMidEnabled = window.safeChecked('gen-ci-mid-enabled', false);
            p.circleInnerColor3 = hexToRgb(window.safeVal('gen-ci-c3', '#ffff00'));
            p.circleInnerColor2 = hexToRgb(window.safeVal('gen-ci-c2', '#0000ff'));
            p.circleInnerDuration = unitToMs(window.safeVal('gen-ci-duration', 10, parseFloat), 's');
            p.circleInnerLoop = window.safeChecked('gen-ci-loop', true);
            p.circleInnerReverse = window.safeChecked('gen-ci-reverse', false);
            p.circleOuterEnabled = true;
            p.circleOuterColor1 = hexToRgb(window.safeVal('gen-co-c1', '#00ff00'));
            p.circleOuterMidEnabled = window.safeChecked('gen-co-mid-enabled', false);
            p.circleOuterColor3 = hexToRgb(window.safeVal('gen-co-c3', '#00ffff'));
            p.circleOuterColor2 = hexToRgb(window.safeVal('gen-co-c2', '#0080ff'));
            p.circleOuterDuration = unitToMs(window.safeVal('gen-co-duration', 10, parseFloat), 's');
            p.circleOuterLoop = window.safeChecked('gen-co-loop', true);
            p.circleOuterReverse = window.safeChecked('gen-co-reverse', false);
            p.periEnabled = window.safeChecked('gen-peri-enabled', false);
            p.periCount = window.safeVal('gen-peri-count', 4, parseInt);
            p.periAcuity = window.safeVal('gen-peri-acuity', 0.3, parseFloat);
            p.periRadiusMinPct = window.safeVal('gen-peri-rmin', 60, parseInt);
            p.periRadiusMaxPct = window.safeVal('gen-peri-rmax', 90, parseInt);
            p.periColor = hexToRgb(window.safeVal('gen-peri-color', '#00ff64'));
            p.periMotion = window.safeVal('gen-peri-motion', 'static');
            p.periSpeed = window.safeVal('gen-peri-speed', 0.3, parseFloat);
            p.periRandomAngles = window.safeChecked('gen-peri-random', true);
            p.dfEnabled = window.safeChecked('gen-df-enabled', false);
            p.dfCenterRadiusMm = window.safeVal('gen-df-radius-mm', 13, parseFloat);
            p.dfCenterBg = hexToRgb(window.safeVal('gen-df-center-bg', '#cc0000'));
            p.dfStimColor = hexToRgb(window.safeVal('gen-df-stim-color', '#000000'));
            p.dfPeriBg = hexToRgb(window.safeVal('gen-df-peri-bg', '#0047ab'));
            p.dfPeriBlur = window.safeVal('gen-df-blur', 0, parseInt);
            p.blinkEnabled = window.safeChecked('gen-blink-anim-enabled', false);
            p.blinkTarget = window.safeVal('gen-blink-anim-target', 'stim');
            p.blinkColorA = hexToRgb(window.safeVal('gen-blink-anim-cA', '#ff0000'));
            p.blinkColorB = hexToRgb(window.safeVal('gen-blink-anim-cB', '#0000ff'));
            p.blinkIntervalMs = window.safeVal('gen-blink-anim-interval', 500, parseInt);
            p.blinkDuty = window.safeVal('gen-blink-anim-duty', 0.5, parseFloat);
            p.blinkCount = window.safeVal('gen-blink-anim-count', 0, parseInt);
        }
        if (tt === 'compare') {
            Object.assign(p, collectCompareParams());
            p.pairsCount = 2;
        }
        if (tt === 'reading') {
            p.text = window.safeVal('gen-reading-text', 'Пример.');
            p.textColor = hexToRgb(window.safeVal('gen-reading-text-color', '#000000'));
            p.bgMode = window.safeVal('gen-reading-bg-mode', 'solid');
            p.bgColor = hexToRgb(window.safeVal('gen-reading-bg-color', '#ffffff'));
            p.splitLeftWidthPercent = window.safeVal('gen-reading-split-left-width', 50, parseInt);
            p.splitLeftColor = hexToRgb(window.safeVal('gen-reading-left-color', '#000000'));
            p.splitRightColor = hexToRgb(window.safeVal('gen-reading-right-color', '#ffffff'));
            p.gradientMidEnabled = window.safeChecked('gen-reading-gradient-mid-enabled', true);
            p.gradientLeftColor = hexToRgb(window.safeVal('gen-reading-gradient-left-color', '#ffffff'));
            p.gradientMidColor = hexToRgb(window.safeVal('gen-reading-gradient-mid-color', '#cccccc'));
            p.gradientMidPosition = window.safeVal('gen-reading-gradient-mid-position', 50, parseInt);
            p.gradientRightColor = hexToRgb(window.safeVal('gen-reading-gradient-right-color', '#000000'));
            p.dynamicMode = window.safeVal('gen-reading-dynamic-mode', 'simple');
            p.dynamicReverse = window.safeChecked('gen-reading-dynamic-reverse', false);
            p.dynamicMidEnabled = window.safeChecked('gen-reading-dynamic-mid-enabled', false);
            p.dynamicStartColor = hexToRgb(window.safeVal('gen-reading-dynamic-start-color', '#ff0000'));
            p.dynamicMidColor = hexToRgb(window.safeVal('gen-reading-dynamic-mid-color', '#ffff00'));
            p.dynamicEndColor = hexToRgb(window.safeVal('gen-reading-dynamic-end-color', '#0000ff'));
            p.dynamicDuration = unitToMs(
                window.safeVal('gen-reading-dynamic-duration', 10, parseFloat),
                window.safeVal('gen-reading-dynamic-duration-unit', 's')
            );
            p.dynamicLoop = window.safeChecked('gen-reading-dynamic-loop', false);
            p.dynamicStep = window.safeVal('gen-reading-dynamic-step', 0.1, parseFloat);
            p.dynamicStepDuration = unitToMs(
                window.safeVal('gen-reading-dynamic-step-duration', 1, parseFloat),
                window.safeVal('gen-reading-dynamic-step-duration-unit', 's')
            );
            p.dynamicShowLabel = window.safeChecked('gen-reading-dynamic-show-label', true);
        }
        return p;
    }
