// ==================== APP-INSPECTOR.JS ====================
// Инспектор узлов: чтение, логика, сравнение, стимул.
// Вынесено из app.js (§A2-v4, Фаза 5).
// Зависит: VLog, VissortDialog, AppState, VissortCore, AppEditor.
// Экспорт: window.AppInspector
// ==================== ==================== ====================
(function () {
    'use strict';

    const VLog = window.VLog || { log() {}, warn() {}, error() {} };
    const VissortDialog = window.VissortDialog;
    const state = window.AppState;
    const { acuityToSizeMm, acuityToSizePx, getStimulusSVG, rgbToHex, hexToRgb, escapeHtml, detectUnit, msToUnit, unitToMs } = window.VissortCore;

    // DOM-элемент (тот же id, что в app.js)
    const inspectorEl = document.getElementById('inspector');

    // Хелперы из AppEditor
    const getNode = (id) => window.AppEditor.getNode(id);
    const getNodeComputedSizeMm = (node) => window.AppEditor.getNodeComputedSizeMm(node);
    const getNodeComputedSize = (node) => window.AppEditor.getNodeComputedSize(node);
    const requestRenderGraph = () => window.AppEditor.requestRenderGraph();
    const defaultCompareCellParams = () => window.AppEditor.defaultCompareCellParams();

    // ==================== ГЛАВНЫЙ ВХОД ====================
    function updateInspector() {
        const node = getNode(state.activeNodeId);
        if (!node) {
            inspectorEl.innerHTML = '<h2>Инспектор</h2><p>Нет выбранного узла</p>';
            return;
        }
        if (node.nodeType === 'READING') {
            updateReadingInspector(node);
            return;
        }
        if (node.nodeType === 'LOGIC_IF') {
            updateLogicInspector(node);
            return;
        }
        if (node.nodeType === 'COMPARE') {
            updateCompareInspector(node);
            return;
        }
        updateStimulusInspector(node);
    }

    // ==================== GRID PREVIEW ====================
    function renderInspectorGridPreview() {
        const p = document.getElementById('insp-grid-preview');
        if (!p) return;
        const gx = Math.max(1, Math.min(10, parseInt(document.getElementById('inp-grid-x')?.value) || 3));
        const gy = Math.max(1, Math.min(10, parseInt(document.getElementById('inp-grid-y')?.value) || 3));
        let sel = [];
        try {
            sel = JSON.parse(p.dataset.selected || '[]');
        } catch (_) {
            sel = [];
        }
        sel = sel.filter((c) => c && c.row >= 0 && c.row < gy && c.col >= 0 && c.col < gx);
        p.style.gridTemplateColumns = `repeat(${gx}, 30px)`;
        p.innerHTML = '';
        for (let r = 0; r < gy; r++)
            for (let c = 0; c < gx; c++) {
                const isSel = sel.some((x) => x.row === r && x.col === c);
                const cell = document.createElement('div');
                cell.style.cssText = `width:30px;height:30px;border:1px solid #444;border-radius:2px;cursor:pointer;transition:background 0.15s;background:${isSel ? '#22c55e' : '#1a1a1a'};`;
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.dataset.selected = isSel ? '1' : '0';
                cell.addEventListener('click', () => {
                    const was = cell.dataset.selected === '1';
                    cell.dataset.selected = was ? '0' : '1';
                    cell.style.background = was ? '#1a1a1a' : '#22c55e';
                    const list = [];
                    p.querySelectorAll('[data-selected="1"]').forEach((e2) =>
                        list.push({ row: parseInt(e2.dataset.row), col: parseInt(e2.dataset.col) })
                    );
                    p.dataset.selected = JSON.stringify(list);
                    const h = document.getElementById('insp-grid-preview-hint');
                    if (h) h.textContent = list.length === 0 ? 'Пусто = все клетки.' : `Выбрано: ${list.length}`;
                });
                p.appendChild(cell);
            }
    }

    // ==================== СЕКЦИИ ИНСПЕКТОРА ====================
    function renderPeriInspectorSection(node) {
        return `<div class="panel-section" style="background:#0a1a15;border-color:#10b981;">
        <h3 style="color:#34d399;border-color:#10b981;">🟢 Периферийные точки</h3>
        <label><input type="checkbox" id="inp-peri-enabled" ${node.periEnabled ? 'checked' : ''}> Включить точки</label>
        <div id="insp-peri-settings" style="display:${node.periEnabled ? 'block' : 'none'};margin-top:6px;">
            <label>Количество (1–12)</label><input type="number" id="inp-peri-count" value="${node.periCount || 4}" min="1" max="12">
            <label>V размера</label><input type="number" id="inp-peri-acuity" value="${node.periAcuity ?? 0.3}" min="0.1" max="1.0" step="0.1">
            <label>Радиус min (%)</label><input type="number" id="inp-peri-rmin" value="${node.periRadiusMinPct ?? 60}" min="20" max="100">
            <label>Радиус max (%)</label><input type="number" id="inp-peri-rmax" value="${node.periRadiusMaxPct ?? 90}" min="20" max="100">
            <label>Цвет точки</label><input type="color" id="inp-peri-color" value="${rgbToHex(node.periColor?.r, node.periColor?.g, node.periColor?.b)}">
            <label>Движение</label><select id="inp-peri-motion">
                <option value="static" ${(node.periMotion || 'static') === 'static' ? 'selected' : ''}>Статично</option>
                <option value="rotate" ${node.periMotion === 'rotate' ? 'selected' : ''}>Вращение</option>
                <option value="pulse" ${node.periMotion === 'pulse' ? 'selected' : ''}>Пульс</option></select>
            <label>Скорость</label><input type="number" id="inp-peri-speed" value="${node.periSpeed ?? 0.3}" min="0.02" max="5" step="0.05">
            <label><input type="checkbox" id="inp-peri-random" ${node.periRandomAngles !== false ? 'checked' : ''}> Случайные углы</label>
        </div></div>`;
    }
    function renderDefocusInspectorSection(node) {
        return `<div class="panel-section" style="background:#1a0a0a;border-color:#dc2626;">
        <h3 style="color:#f87171;border-color:#dc2626;">🔴 Цифровой дефокус</h3>
        <label><input type="checkbox" id="inp-df-enabled" ${node.dfEnabled ? 'checked' : ''}> Включить дефокус</label>
        <div id="insp-df-settings" style="display:${node.dfEnabled ? 'block' : 'none'};margin-top:6px;">
            <label>Радиус центра (мм)</label><input type="number" id="inp-df-radius-mm" value="${node.dfCenterRadiusMm || 13}" min="3" max="50" step="1">
            <label>Фон центра</label><input type="color" id="inp-df-center-bg" value="${rgbToHex(node.dfCenterBg?.r, node.dfCenterBg?.g, node.dfCenterBg?.b)}">
            <label>Цвет стимула</label><input type="color" id="inp-df-stim-color" value="${rgbToHex(node.dfStimColor?.r, node.dfStimColor?.g, node.dfStimColor?.b)}">
            <label>Фон периферии</label><input type="color" id="inp-df-peri-bg" value="${rgbToHex(node.dfPeriBg?.r, node.dfPeriBg?.g, node.dfPeriBg?.b)}">
            <label>Размытие к краю (%)</label><input type="number" id="inp-df-blur" value="${node.dfPeriBlur || 0}" min="0" max="100" step="5">
            <div class="acuity-hint">Центр — красный диск с чёрным стимулом; периферия — синяя заливка.</div>
        </div></div>`;
    }
    function renderBlinkAnimationInspectorSection(node) {
        return `<div class="panel-section" style="background:#1a0a05;border-color:#f97316;">
        <h3 style="color:#fb923c;border-color:#f97316;">🔦 Моргание</h3>
        <div class="acuity-hint">Резкая смена цвета без плавного перехода. Отличается от «Динамики».</div>
        <label><input type="checkbox" id="inp-blink-enabled" ${node.blinkEnabled ? 'checked' : ''}> Включить моргание</label>
        <div id="insp-blink-settings" style="display:${node.blinkEnabled ? 'block' : 'none'};margin-top:6px;">
            <label>Цель</label><select id="inp-blink-target">
                <option value="stim" ${(node.blinkTarget || 'stim') === 'stim' ? 'selected' : ''}>Только стимул</option>
                <option value="bg" ${node.blinkTarget === 'bg' ? 'selected' : ''}>Только фон</option>
                <option value="both" ${node.blinkTarget === 'both' ? 'selected' : ''}>Стимул + фон</option></select>
            <label>Цвет A</label><input type="color" id="inp-blink-cA" value="${rgbToHex(node.blinkColorA?.r, node.blinkColorA?.g, node.blinkColorA?.b)}">
            <label>Цвет B</label><input type="color" id="inp-blink-cB" value="${rgbToHex(node.blinkColorB?.r, node.blinkColorB?.g, node.blinkColorB?.b)}">
            <label>Период (мс)</label><input type="number" id="inp-blink-interval" value="${node.blinkIntervalMs || 500}" min="50" max="5000" step="50">
            <label>Доля A (0.05–0.95)</label><input type="number" id="inp-blink-duty" value="${node.blinkDuty ?? 0.5}" min="0.05" max="0.95" step="0.05">
            <label>Количество морганий (0 = ∞)</label><input type="number" id="inp-blink-count" value="${node.blinkCount || 0}" min="0" max="9999" step="1">
        </div></div>`;
    }
    // ==================== ИНСПЕКТОР: СТИМУЛ ====================
    function updateStimulusInspector(node) {
        const mm = getNodeComputedSizeMm(node),
            px = getNodeComputedSize(node);
        const cir = !!node.singleCircleEnabled;
        let html = '<h2>Инспектор</h2><div class="insp-cols">';
        html += '<div class="panel-section"><h3>📋 Информация</h3>';
        html += `<label>Название узла</label><input type="text" id="inp-name" value="${escapeHtml(node.name)}">`;
        html += `<label>Тип стимула</label><select id="inp-type">
            <option value="LETTER_E" ${node.stimType === 'LETTER_E' ? 'selected' : ''}>Буква Е</option>
            <option value="LANDOLT" ${node.stimType === 'LANDOLT' ? 'selected' : ''}>Кольцо Ландольта</option></select>`;
        html += `<label><input type="checkbox" id="inp-circle-enabled" ${cir ? 'checked' : ''}> 🎯 Режим «Динамика Круг»</label>`;
        html += `<label><input type="checkbox" id="inp-active" ${node.isActive ? 'checked' : ''}> Активная тренировка</label></div>`;
        let acOpts = '';
        for (let i = 1; i <= 10; i++) {
            const v = i / 10;
            const m = acuityToSizeMm(v, 1);
            acOpts += `<option value="${v.toFixed(1)}">${v.toFixed(1)} — ${m.toFixed(2)} мм</option>`;
        }
        const sV = (node.stimAcuity || 1.0).toFixed(1);
        const eV = (node.endAcuity != null ? node.endAcuity : node.stimAcuity || 1.0).toFixed(1);
        html += '<div class="panel-section" style="background:#101a10;border-color:#00aa55;">';
        html += '<h3 style="color:#00ff88;border-color:#00aa55;">👁️ Острота зрения</h3>';
        html += `<label>V старт</label><select id="inp-acuity">${acOpts.replace(`value="${sV}"`, `value="${sV}" selected`)}</select>`;
        html += `<label>V цель</label><select id="inp-end-acuity">${acOpts.replace(`value="${eV}"`, `value="${eV}" selected`)}</select>`;
        html += `<label>Шаг V за успешную серию</label><input type="number" id="inp-acuity-step" value="${node.acuityStep || 0.1}" min="0.05" max="1" step="0.05">`;
        html += `<label>Дистанция (м)</label><input type="number" id="inp-distance" value="${(node.stimDistance || 1).toFixed(1)}" min="0.1" max="20" step="0.1">`;
        html += `<label>PPI экрана (авто: ${state.screenPPI})</label><input type="number" id="inp-ppi" value="${node.stimPPI || state.screenPPI || 96}" min="20" max="1200" step="1">
    <label>Мин. устойчивость распознавания (%)</label><input type="number" id="inp-min-detect" value="${node.minDetectPct ?? ''}" min="30" max="100" step="5" placeholder="80">
    <label>Порог приближения (см)</label><input type="number" id="inp-tol-near" value="${node.tolNearCm ?? ''}" min="2" max="50" step="1" placeholder="10">
    <label>Порог отклонения (см)</label><input type="number" id="inp-tol-far" value="${node.tolFarCm ?? ''}" min="2" max="50" step="1" placeholder="15">
    <label>Контроль дистанции</label><select id="inp-dist-mode">
    <option value="return" ${(node.distControlMode ?? 'return') === 'return' ? 'selected' : ''}>Возврат (стоп при отклонении)</option>
    <option value="auto" ${node.distControlMode === 'auto' ? 'selected' : ''}>Авто-пересчёт (продолжать)</option>
    </select>
    <label>Порог приближения (см)</label><input type="number" id="inp-tol-near" value="${node.tolNearCm ?? ''}" min="2" max="50" step="1" placeholder="10">
    <label>Порог отклонения (см)</label><input type="number" id="inp-tol-far" value="${node.tolFarCm ?? ''}" min="2" max="50" step="1" placeholder="15">`;
        html += `<div style="margin-top:6px;padding:6px;background:#000;border-radius:3px;text-align:center;">
            <div style="color:#ffcc00;font-size:13px;font-weight:bold;" id="preview-mm">📐 ${mm.toFixed(2)} мм</div>
            <div style="color:#888;font-size:10px;" id="preview-px">≈ ${px}px @ ${node.stimPPI || state.screenPPI || 96} PPI</div>
        <div id="insp-v-warn" style="margin-top:4px;color:#f59e0b;font-size:10px;display:none;">⚠️ V > 0.8: стимул < 5 px. Нужна дистанция 1.5+ м.</div></div></div>`;
        html += '<div class="panel-section" style="background:#1a0a1a;border-color:#a855f7;">';
        html += '<h3 style="color:#c084fc;border-color:#a855f7;">📊 Серия</h3>';
        html += `<label>Циклов в серии</label><input type="number" id="inp-series-size" value="${node.seriesSize || 6}" min="1" max="20">`;
        html += `<label>Критерий правильности серии</label><input type="number" id="inp-series-threshold" value="${node.seriesThreshold || 4}" min="1" max="20">`;
        html += `<label><input type="checkbox" id="inp-adaptive-acuity" ${node.adaptiveAcuity !== false ? 'checked' : ''}> 👁️ Адаптивная острота зрения</label>`;
        html += '</div>';
        html += '<div class="panel-section" style="background:#1a1a0a;border-color:#eab308;">';
        html += '<h3 style="color:#fde047;border-color:#eab308;">🎨 Цвета</h3>';
        html += `<label>Цвет стимула (для буквы)</label><input type="color" id="inp-color" value="${rgbToHex(node.stimR, node.stimG, node.stimB)}">`;
        html += `<label>Цвет фона</label><input type="color" id="inp-bg" value="${rgbToHex(node.bgR, node.bgG, node.bgB)}"></div>`;
        html += '<div class="panel-section" style="background:#0a1a20;border-color:#0ea5e9;">';
        html += '<h3 style="color:#38bdf8;border-color:#0ea5e9;">🎲 Случайность</h3>';
        html += `<label><input type="checkbox" id="inp-random-pos" ${node.singleRandomPos ? 'checked' : ''}> Случайное положение</label></div>`;
        html += '<div class="panel-section" style="background:#0a1a10;border-color:#22c55e;">';
        html += '<h3 style="color:#4ade80;border-color:#22c55e;">🔲 Сетка положения</h3>';
        html += `<label><input type="checkbox" id="inp-grid-enabled" ${node.singleGridEnabled ? 'checked' : ''}> Включить сетку</label>`;
        html += `<div id="insp-grid-settings" style="display:${node.singleGridEnabled ? 'block' : 'none'};margin-top:6px;">`;
        html += `<label>Столбцов (X)</label><input type="number" id="inp-grid-x" value="${node.singleGridX || 3}" min="1" max="10" step="1">`;
        html += `<label>Строк (Y)</label><input type="number" id="inp-grid-y" value="${node.singleGridY || 3}" min="1" max="10" step="1">`;
        html += `<label><input type="checkbox" id="inp-grid-show-lines" ${node.singleGridShowLines ? 'checked' : ''}> Показывать линии</label>`;
        html += `<label><input type="checkbox" id="inp-grid-random" ${node.singleGridRandomCell !== false ? 'checked' : ''}> Случайная клетка</label>`;
        html += `<label><input type="checkbox" id="inp-grid-avoid-repeat" ${node.singleGridAvoidRepeat !== false ? 'checked' : ''}> Избегать повтора</label>`;
        const cells = Array.isArray(node.singleGridCells) ? node.singleGridCells : [];
        html += `<div style="margin-top:10px;padding-top:8px;border-top:1px dashed #22c55e;">`;
        html += `<label style="color:#4ade80;">Активные клетки</label>`;
        html += `<div style="font-size:10px;color:#94a3b8;margin-bottom:6px;" id="insp-grid-preview-hint">${cells.length === 0 ? 'Пусто = все клетки.' : `Выбрано: ${cells.length}`}</div>`;
        html += `<div id="insp-grid-preview" style="display:grid;gap:3px;"></div></div></div></div>`;
        html += '<div class="panel-section" style="background:#1a0a15;border-color:#ec4899;">';
        html += '<h3 style="color:#f472b6;border-color:#ec4899;">🎯 Динамика Круг</h3>';
        html += `<div id="insp-circle-settings" style="display:${cir ? 'block' : 'none'};margin-top:6px;">`;
        html +=
            '<div style="border-top:1px dashed #ec4899;padding-top:6px;"><label style="color:#f9a8d4;font-weight:bold;">Внутренний круг</label>';
        html += `<label><input type="checkbox" id="inp-ci-enabled" ${node.circleInnerEnabled !== false ? 'checked' : ''}> Показывать</label>`;
        html += `<label>Радиус (% от общего)</label><input type="number" id="inp-ci-radius" value="${node.circleInnerRadiusPct ?? 40}" min="5" max="95" step="1">`;
        html += `<label>Цвет 1 (центр)</label><input type="color" id="inp-ci-c1" value="${rgbToHex(node.circleInnerColor1?.r, node.circleInnerColor1?.g, node.circleInnerColor1?.b)}">`;
        html += `<label><input type="checkbox" id="inp-ci-mid-enabled" ${node.circleInnerMidEnabled ? 'checked' : ''}> Цвет 3</label>`;
        html += `<div id="insp-ci-mid-row" style="display:${node.circleInnerMidEnabled ? 'block' : 'none'};"><label>Цвет 3</label><input type="color" id="inp-ci-c3" value="${rgbToHex(node.circleInnerColor3?.r, node.circleInnerColor3?.g, node.circleInnerColor3?.b)}"></div>`;
        html += `<label>Цвет 2 (край)</label><input type="color" id="inp-ci-c2" value="${rgbToHex(node.circleInnerColor2?.r, node.circleInnerColor2?.g, node.circleInnerColor2?.b)}">`;
        html += `<label>Время (с)</label><input type="number" id="inp-ci-duration" value="${(node.circleInnerDuration || 10000) / 1000}" min="0.1" step="0.1">`;
        html += `<label><input type="checkbox" id="inp-ci-loop" ${node.circleInnerLoop !== false ? 'checked' : ''}> Повторять</label>`;
        html += `<label><input type="checkbox" id="inp-ci-reverse" ${node.circleInnerReverse ? 'checked' : ''}> Пинг-понг</label></div>`;
        html +=
            '<div style="border-top:1px dashed #ec4899;margin-top:8px;padding-top:8px;"><label style="color:#f9a8d4;font-weight:bold;">Внешнее кольцо</label>';
        html += `<label><input type="checkbox" id="inp-co-enabled" ${node.circleOuterEnabled !== false ? 'checked' : ''}> Показывать</label>`;
        html += `<label>Цвет 1 (у диска)</label><input type="color" id="inp-co-c1" value="${rgbToHex(node.circleOuterColor1?.r, node.circleOuterColor1?.g, node.circleOuterColor1?.b)}">`;
        html += `<label><input type="checkbox" id="inp-co-mid-enabled" ${node.circleOuterMidEnabled ? 'checked' : ''}> Цвет 3</label>`;
        html += `<div id="insp-co-mid-row" style="display:${node.circleOuterMidEnabled ? 'block' : 'none'};"><label>Цвет 3</label><input type="color" id="inp-co-c3" value="${rgbToHex(node.circleOuterColor3?.r, node.circleOuterColor3?.g, node.circleOuterColor3?.b)}"></div>`;
        html += `<label>Цвет 2 (край)</label><input type="color" id="inp-co-c2" value="${rgbToHex(node.circleOuterColor2?.r, node.circleOuterColor2?.g, node.circleOuterColor2?.b)}">`;
        html += `<label>Время (с)</label><input type="number" id="inp-co-duration" value="${(node.circleOuterDuration || 10000) / 1000}" min="0.1" step="0.1">`;
        html += `<label><input type="checkbox" id="inp-co-loop" ${node.circleOuterLoop !== false ? 'checked' : ''}> Повторять</label>`;
        html += `<label><input type="checkbox" id="inp-co-reverse" ${node.circleOuterReverse ? 'checked' : ''}> Пинг-понг</label></div></div></div>`;
        html += renderPeriInspectorSection(node);
        html += renderDefocusInspectorSection(node);
        html += renderBlinkAnimationInspectorSection(node);
        const tf = [
            { id: 'delay1', label: 'Задержка 1', value: node.delay1 || 0 },
            { id: 'duration', label: 'Время показа', value: node.duration || 0 },
            { id: 'response', label: 'Ожидание ответа', value: node.response || 0 },
            { id: 'delay2', label: 'Задержка 2', value: node.delay2 || 0 }
        ];
        html += '<div class="panel-section" style="background:#1a1000;border-color:#f59e0b;">';
        html += '<h3 style="color:#fbbf24;border-color:#f59e0b;">🔄 Цикл показа</h3>';
        tf.forEach((f) => {
            const u = detectUnit(f.value),            dv = msToUnit(f.value, u);
        html += `<label>${f.label}</label><div class="time-group">
            <input type="number" id="inp-${f.id}" value="${dv}" step="any" min="0">
            <select id="inp-${f.id}-unit"><option value="ms" ${u === 'ms' ? 'selected' : ''}>мс</option><option value="s" ${u === 's' ? 'selected' : ''}>с</option><option value="min" ${u === 'min' ? 'selected' : ''}>мин</option></select></div>`;
    });
    html += '</div>';
    html += '<div class="panel-section" style="background:#100a1a;border-color:#8b5cf6;">';
    html += '<h3 style="color:#a78bfa;border-color:#8b5cf6;">🎨 Динамика буквы</h3>';
    html += `<label><input type="checkbox" id="inp-stim-dyn-enabled" ${node.singleStimDynamicEnabled ? 'checked' : ''}> Включить</label>`;
    html += `<div id="insp-sti-dyn-settings" style="display:${node.singleStimDynamicEnabled ? 'block' : 'none'};margin-top:6px;">`;
    html += `<label>Цвет 1</label><input type="color" id="inp-sti-color1" value="${rgbToHex(node.singleStimColor1?.r, node.singleStimColor1?.g, node.singleStimColor1?.b)}">`;
    html += `<label><input type="checkbox" id="inp-sti-mid-enabled" ${node.singleStimMidEnabled ? 'checked' : ''}> Цвет 3</label>`;
    html += `<div id="insp-sti-mid-row" style="display:${node.singleStimMidEnabled ? 'block' : 'none'};"><label>Цвет 3</label><input type="color" id="inp-sti-color3" value="${rgbToHex(node.singleStimColor3?.r, node.singleStimColor3?.g, node.singleStimColor3?.b)}"></div>`;
    html += `<label>Цвет 2</label><input type="color" id="inp-sti-color2" value="${rgbToHex(node.singleStimColor2?.r, node.singleStimColor2?.g, node.singleStimColor2?.b)}">`;
    html += `<label>Время (с)</label><input type="number" id="inp-sti-duration" value="${(node.singleStimDuration || 10000) / 1000}" min="0.1" step="0.1">`;
    html += `<label><input type="checkbox" id="inp-sti-loop" ${node.singleStimLoop ? 'checked' : ''}> Повторять</label>`;
    html += `<label><input type="checkbox" id="inp-sti-reverse" ${node.singleStimReverse ? 'checked' : ''}> Пинг-понг</label></div></div>`;
    html += '<div class="panel-section" style="background:#1a0a10;border-color:#ec4899;">';
    html += '<h3 style="color:#f472b6;border-color:#ec4899;">🖼️ Динамика фона</h3>';
    html += `<label><input type="checkbox" id="inp-bg-dyn-enabled" ${node.singleBgDynamicEnabled ? 'checked' : ''}> Включить</label>`;
    html += `<div id="insp-bg-dyn-settings" style="display:${node.singleBgDynamicEnabled ? 'block' : 'none'};margin-top:6px;">`;
    html += `<label>Цвет 1</label><input type="color" id="inp-bg-color1" value="${rgbToHex(node.singleBgColor1?.r, node.singleBgColor1?.g, node.singleBgColor1?.b)}">`;
    html += `<label><input type="checkbox" id="inp-bg-mid-enabled" ${node.singleBgMidEnabled ? 'checked' : ''}> Цвет 3</label>`;
    html += `<div id="insp-bg-mid-row" style="display:${node.singleBgMidEnabled ? 'block' : 'none'};"><label>Цвет 3</label><input type="color" id="inp-bg-color3" value="${rgbToHex(node.singleBgColor3?.r, node.singleBgColor3?.g, node.singleBgColor3?.b)}"></div>`;
    html += `<label>Цвет 2</label><input type="color" id="inp-bg-color2" value="${rgbToHex(node.singleBgColor2?.r, node.singleBgColor2?.g, node.singleBgColor2?.b)}">`;
    html += `<label>Время (с)</label><input type="number" id="inp-bg-duration" value="${(node.singleBgDuration || 10000) / 1000}" min="0.1" step="0.1">`;
    html += `<label><input type="checkbox" id="inp-bg-loop" ${node.singleBgLoop ? 'checked' : ''}> Повторять</label>`;
    html += `<label><input type="checkbox" id="inp-bg-reverse" ${node.singleBgReverse ? 'checked' : ''}> Пинг-понг</label></div></div>`;
    html += '</div>';
    html += '<div class="panel-section" style="background:#0a1a10;border-color:#22c55e;">';
    html += '<h3 style="color:#4ade80;border-color:#22c55e;">📈 Сценарий</h3>';
    html += `<label>Серий всего</label><input type="number" id="inp-series-count" value="${node.seriesCount || 10}" min="1" max="50">`;
    html += '</div>';
    html += '</div>';
    html +=
        '<button class="btn btn-success" id="inp-apply" style="width:100%;margin-top:6px;">💾 Применить</button>';
    inspectorEl.innerHTML = html;
    const p = document.getElementById('insp-grid-preview');
    if (p) {
        p.dataset.selected = JSON.stringify(cells);
        renderInspectorGridPreview();
    }
    const ai = document.getElementById('inp-acuity'),
        di = document.getElementById('inp-distance'),
        pp = document.getElementById('inp-ppi');
    const upd = () => {
        var _w = document.getElementById('insp-v-warn');
        if (_w) _w.style.display = v > 0.8 ? 'block' : 'none';
        const v = parseFloat(ai?.value) || 1.0,
            d = parseFloat(di?.value) || 1,
            ppi = parseInt(pp?.value) || state.screenPPI || 96;
        const m = document.getElementById('preview-mm');
        if (m) m.textContent = `📐 ${acuityToSizeMm(v, d).toFixed(2)} мм`;
        const x = document.getElementById('preview-px');
        if (x) x.textContent = `≈ ${acuityToSizePx(v, d, ppi)}px @ ${ppi} PPI`;
    };
    if (ai) ai.addEventListener('change', upd);
    if (di) di.addEventListener('input', upd);
    if (pp) pp.addEventListener('input', upd);
    const bind = (id, target) => {
        const c = document.getElementById(id),
            t = document.getElementById(target);
        if (c && t)
            c.addEventListener('change', () => {
                t.style.display = c.checked ? 'block' : 'none';
            });
    };
    bind('inp-stim-dyn-enabled', 'insp-sti-dyn-settings');
    bind('inp-bg-dyn-enabled', 'insp-bg-dyn-settings');
    bind('inp-grid-enabled', 'insp-grid-settings');
    bind('inp-circle-enabled', 'insp-circle-settings');
    bind('inp-ci-mid-enabled', 'insp-ci-mid-row');
    bind('inp-co-mid-enabled', 'insp-co-mid-row');
    bind('inp-peri-enabled', 'insp-peri-settings');
    bind('inp-df-enabled', 'insp-df-settings');
    bind('inp-blink-enabled', 'insp-blink-settings');
    const sM = document.getElementById('inp-sti-mid-enabled'),
        sMR = document.getElementById('insp-sti-mid-row');
    if (sM && sMR)
        sM.addEventListener('change', () => {
            sMR.style.display = sM.checked ? 'block' : 'none';
        });
    const bM = document.getElementById('inp-bg-mid-enabled'),
        bMR = document.getElementById('insp-bg-mid-row');
    if (bM && bMR)
        bM.addEventListener('change', () => {
            bMR.style.display = bM.checked ? 'block' : 'none';
        });
    const gxI = document.getElementById('inp-grid-x'),
        gyI = document.getElementById('inp-grid-y');
    if (gxI) gxI.addEventListener('input', renderInspectorGridPreview);
    if (gyI) gyI.addEventListener('input', renderInspectorGridPreview);
}
    // ==================== ИНСПЕКТОР: ЛОГИКА ====================
    function updateLogicInspector(node) {
        let html = '<h2>Инспектор</h2><div class="panel-section"><h3>🧠 Логика</h3>';
        html += `<label>Название узла</label><input type="text" id="inp-name" value="${escapeHtml(node.name)}">`;
        html += '<div class="acuity-hint">Логика условных переходов появится позже.</div></div>';
        html += '<button class="btn btn-success" id="inp-apply" style="width:100%;">💾 Применить</button>';
        inspectorEl.innerHTML = html;
    }

    // ==================== ИНСПЕКТОР: СРАВНЕНИЕ ====================
    function updateCompareInspector(node) {
        let html = '<h2>Инспектор</h2><div class="insp-cols">';
        html += '<div class="panel-section"><h3>📋 Информация</h3>';
        html += `<label>Название узла</label><input type="text" id="inp-name" value="${escapeHtml(node.name)}">`;
        html += `<label><input type="checkbox" id="inp-active" ${node.isActive !== false ? 'checked' : ''}> Активный узел</label></div>`;
        html += '<div class="panel-section" style="background:#1a0a1a;border-color:#a855f7;">';
        html += '<h3 style="color:#c084fc;border-color:#a855f7;">⚖️ Режим</h3>';
        html += `<label>Тип</label><select id="inp-cmp-mode">
            <option value="direction" ${(node.compareMode || 'direction') === 'direction' ? 'selected' : ''}>Сравнить направления (Да/Нет)</option>
            <option value="find_same" ${node.compareMode === 'find_same' ? 'selected' : ''}>Найти одинаковые (клик по парам)</option></select>`;
        html += `<div id="insp-cmp-pairs-block" style="display:${node.compareMode === 'find_same' ? 'block' : 'none'};margin-top:6px;">`;
        html += `<label>Количество пар</label><input type="number" id="inp-cmp-pairs" value="${node.pairsCount || 2}" min="1" max="20"></div></div>`;
        html += '<div class="panel-section" style="background:#0a1a10;border-color:#22c55e;">';
        html += '<h3 style="color:#4ade80;border-color:#22c55e;">🔲 Сетка</h3>';
        html += `<label>Столбцов (X)</label><input type="number" id="inp-cmp-gx" value="${node.gridX || 3}" min="2" max="6">`;
        html += `<label>Строк (Y)</label><input type="number" id="inp-cmp-gy" value="${node.gridY || 3}" min="1" max="6">`;
        html += '<div id="insp-cmp-grid" class="cmp-grid-preview"></div></div>';
        html += '<div class="panel-section" style="background:#1a1a0a;border-color:#eab308;">';
        html +=
            '<h3 style="color:#fde047;border-color:#eab308;">🎨 Параметры клеток</h3><div id="insp-cmp-cells"></div></div>';
        html += '<div class="panel-section" style="background:#1a1000;border-color:#f59e0b;">';
        html += '<h3 style="color:#fbbf24;border-color:#f59e0b;">🔄 Цикл показа</h3>';
        var _tfCmp = [
            { id: 'inp-cmp-d1', label: 'Задержка 1', value: node.delay1 || 0 },
            { id: 'inp-cmp-dur', label: 'Время показа', value: node.duration || 0 },
            { id: 'inp-cmp-resp', label: 'Ожидание ответа', value: node.response || 0 },
            { id: 'inp-cmp-d2', label: 'Задержка 2', value: node.delay2 || 0 }
        ];
        _tfCmp.forEach(function (f) {
            var u = detectUnit(f.value),
                dv = msToUnit(f.value, u);
            html += `<label>${f.label}</label><div class="time-group">
                <input type="number" id="${f.id}" value="${dv}" step="any" min="0">
                <select id="${f.id}-unit"><option value="ms" ${u === 'ms' ? 'selected' : ''}>мс</option><option value="s" ${u === 's' ? 'selected' : ''}>с</option><option value="min" ${u === 'min' ? 'selected' : ''}>мин</option></select>
            </div>`;
        });
        html += '</div>';
        html += '<div class="panel-section" style="background:#1a0a1a;border-color:#a855f7;">';
        html += '<h3 style="color:#c084fc;border-color:#a855f7;">📊 Серия</h3>';
        html += `<label>Циклов в серии</label><input type="number" id="inp-cmp-ss" value="${node.seriesSize || 6}" min="1" max="20">`;
        html += `<label>Критерий правильности серии</label><input type="number" id="inp-cmp-st" value="${node.seriesThreshold || 4}" min="1" max="20">`;
        html += `<label><input type="checkbox" id="inp-cmp-adaptive" ${node.adaptiveAcuity !== false ? 'checked' : ''}> 👁️ Адаптивная острота зрения</label>`;
        html += '</div>';
        html += '<div class="panel-section" style="background:#0a1a10;border-color:#22c55e;">';
        html += '<h3 style="color:#4ade80;border-color:#22c55e;">📈 Сценарий</h3>';
        html += `<label>Серий всего</label><input type="number" id="inp-cmp-sc" value="${node.seriesCount || 10}" min="1" max="50">`;
        html += '</div>';
        html +=
            '</div><button class="btn btn-success" id="inp-apply" style="width:100%;margin-top:6px;">💾 Применить</button>';
        inspectorEl.innerHTML = html;
        const previewEl = document.getElementById('insp-cmp-grid');
        previewEl.dataset.selected = JSON.stringify(node.activeCells || []);
        function renderGrid() {
            const gx = Math.max(2, Math.min(6, parseInt(document.getElementById('inp-cmp-gx')?.value) || 3));
            const gy = Math.max(1, Math.min(6, parseInt(document.getElementById('inp-cmp-gy')?.value) || 3));
            let sel = [];
            try {
                sel = JSON.parse(previewEl.dataset.selected || '[]');
            } catch (_) {
                sel = [];
            }
            sel = sel.filter((c) => c && c.row < gy && c.col < gx);
            if (sel.length < 2)
                sel = [
                    { row: 0, col: 0 },
                    { row: 0, col: 1 }
                ].filter((c) => c.row < gy && c.col < gx);
            previewEl.dataset.selected = JSON.stringify(sel);
            previewEl.style.gridTemplateColumns = `repeat(${gx}, 42px)`;
            previewEl.innerHTML = '';
            for (let r = 0; r < gy; r++)
                for (let c = 0; c < gx; c++) {
                    const on = sel.some((x) => x.row === r && x.col === c);
                    const cEl = document.createElement('div');
                    cEl.className = 'cmp-grid-cell' + (on ? ' active' : '');
                    cEl.textContent = `${r + 1},${c + 1}`;
                    cEl.dataset.row = r;
                    cEl.dataset.col = c;
                    cEl.dataset.on = on ? '1' : '0';
                    cEl.addEventListener('click', () => {
                        const cur = JSON.parse(previewEl.dataset.selected || '[]');
                        const was = cEl.dataset.on === '1';
                        if (was && cur.length <= 2) {
                            VissortDialog.alert('Нужно минимум 2 активные клетки');
                            return;
                        }
                        cEl.dataset.on = was ? '0' : '1';
                        cEl.classList.toggle('active', !was);
                        const list = [];
                        previewEl
                            .querySelectorAll('[data-on="1"]')
                            .forEach((e2) =>
                                list.push({ row: parseInt(e2.dataset.row), col: parseInt(e2.dataset.col) })
                            );
                        previewEl.dataset.selected = JSON.stringify(list);
                        renderCells();
                    });
                    previewEl.appendChild(cEl);
                }
            renderCells();
        }
        function readCells() {
            const c = document.getElementById('insp-cmp-cells');
            if (!c) return [];
            const res = [];
            c.querySelectorAll('.cmp-cell-block').forEach((div) => {
                const V = parseFloat(div.querySelector('.cmp-a').value) || 1.0;
                const sc = hexToRgb(div.querySelector('.cmp-sc').value);
                const bc = hexToRgb(div.querySelector('.cmp-bg').value);
                const d = parseInt(div.querySelector('.cmp-d').value) || 2000;
                const dist = node.stimDistance || state.trainingNode?.params?.distanceMeters || state.generalDistance || 1;
                const ppi = node.stimPPI || state.screenPPI || 96;
                res.push({
                    acuity: V,
                    distance: dist,
                    ppi,
                    size: acuityToSizePx(V, dist, ppi),
                    stimR: sc.r,
                    stimG: sc.g,
                    stimB: sc.b,
                    bgR: bc.r,
                    bgG: bc.g,
                    bgB: bc.b,
                    duration: d
                });
            });
            return res;
        }
        function renderCells() {
            const c = document.getElementById('insp-cmp-cells');
            if (!c) return;
            const saved = readCells();
            c.innerHTML = '';
            let sel = [];
            try {
                sel = JSON.parse(previewEl.dataset.selected || '[]');
            } catch (_) {
                sel = [];
            }
            sel.forEach((cell, idx) => {
                const p = saved[idx] || saved[saved.length - 1] || defaultCompareCellParams();
                const div = document.createElement('div');
                div.className = 'cmp-cell-block';
                let opts = '';
                for (let i = 1; i <= 10; i++) {
                    const v = i / 10;
                    opts += `<option value="${v.toFixed(1)}" ${Math.abs((p.acuity || 1) - v) < 0.001 ? 'selected' : ''}>${v.toFixed(1)}</option>`;
                }
                div.innerHTML = `<label><b>Клетка (${cell.row + 1}, ${cell.col + 1})</b></label>
                    <label>V</label><select class="cmp-a">${opts}</select>
                    <label>Цвет стимула</label><input type="color" class="cmp-sc" value="${rgbToHex(p.stimR, p.stimG, p.stimB)}">
                    <label>Цвет фона</label><input type="color" class="cmp-bg" value="${rgbToHex(p.bgR, p.bgG, p.bgB)}">
                    <label>Время (мс)</label><input type="number" class="cmp-d" value="${p.duration || 2000}" min="200" max="5000">`;
                c.appendChild(div);
            });
        }
        inspectorEl._cmpReadCells = readCells;
        inspectorEl._cmpReadGrid = () => JSON.parse(previewEl.dataset.selected || '[]');
        renderGrid();
        document.getElementById('inp-cmp-gx')?.addEventListener('input', renderGrid);
        document.getElementById('inp-cmp-gy')?.addEventListener('input', renderGrid);
        document.getElementById('inp-cmp-mode')?.addEventListener('change', (e) => {
            const b = document.getElementById('insp-cmp-pairs-block');
            if (b) b.style.display = e.target.value === 'find_same' ? 'block' : 'none';
        });
    }
    // ==================== ИНСПЕКТОР: ЧТЕНИЕ ====================
    function updateReadingInspector(node) {
        const hasOwn = !!(node.bookId && window._books[node.bookId]);
        let bookHtml;
        if (hasOwn)
            bookHtml = `<span style="color:#7dd3fc;">${escapeHtml(node.bookName || '(без имени)')}</span>`;
        else if (node.bookName) bookHtml = `<span style="color:#f59e0b;">${escapeHtml(node.bookName)} ⚠</span>`;
        else bookHtml = `<span style="color:#94a3b8;">Книга из сессии</span>`;
        let html = '<h2>Инспектор</h2><div class="insp-cols">';
        html += '<div class="panel-section"><h3>📖 Чтение</h3>';
        html += `<label>Название узла</label><input type="text" id="inp-name" value="${escapeHtml(node.name)}">`;
        html += `<label>Книга</label><div style="padding:6px 8px;background:#0b0b14;border-radius:3px;font-size:11px;margin-bottom:4px;">${bookHtml}</div>`;
        html += `<button class="btn btn-reading" id="inp-reading-choose-book" style="width:100%;margin-bottom:4px;">📚 ${hasOwn ? 'Сменить книгу' : 'Задать книгу'}</button></div>`;
        html += '<div class="panel-section" style="background:#0a1020;border-color:#0ea5e9;">';
        html += '<h3 style="color:#38bdf8;border-color:#0ea5e9;">Отображение</h3>';
        html += `<label>Шрифт</label><input type="text" id="inp-reading-font" value="${escapeHtml(node.readingFontFamily || 'Segoe UI')}">`;
        html += `<label><input type="checkbox" id="inp-reading-bold" ${node.readingFontWeight === 'bold' ? 'checked' : ''}> Жирный</label>`;
        let acOpts = '';
        for (let i = 1; i <= 10; i++) {
            const v = i / 10,
                m = acuityToSizeMm(v, 1);
            acOpts += `<option value="${v.toFixed(1)}" ${Math.abs((node.readingAcuity || 1.0) - v) < 0.001 ? 'selected' : ''}>${v.toFixed(1)} — ${m.toFixed(2)} мм</option>`;
        }
        html += `<label>Острота зрения V</label><select id="inp-reading-acuity">${acOpts}</select>`;
        html += `<label>Дистанция чтения (м)</label><input type="number" id="inp-reading-distance" value="${(node.readingDistance || state.readingDistance || 1).toFixed(1)}" min="0.1" max="20" step="0.1">`;
        html += `<label>Цвет текста</label><input type="color" id="inp-reading-text-color" value="${rgbToHex(node.readingTextColor?.r, node.readingTextColor?.g, node.readingTextColor?.b)}"></div>`;
        html += '<div class="panel-section" style="background:#0a1a1a;border-color:#14b8a6;">';
        html += '<h3 style="color:#2dd4bf;border-color:#14b8a6;">Фон</h3>';
        html += `<label>Тип фона</label><select id="inp-reading-bg-mode">
            <option value="solid" ${(node.readingBgMode || 'solid') === 'solid' ? 'selected' : ''}>Сплошной</option>
            <option value="split" ${node.readingBgMode === 'split' ? 'selected' : ''}>Две половины</option>
            <option value="gradient" ${node.readingBgMode === 'gradient' ? 'selected' : ''}>Градиент</option>
            <option value="dynamic" ${node.readingBgMode === 'dynamic' ? 'selected' : ''}>Динамический</option></select>`;
        html += `<div id="insp-rd-solid" style="display:${(node.readingBgMode || 'solid') === 'solid' ? 'block' : 'none'};margin-top:6px;"><label>Цвет фона</label><input type="color" id="inp-rd-bg-color" value="${rgbToHex(node.readingBgColor?.r, node.readingBgColor?.g, node.readingBgColor?.b)}"></div>`;
        html += `<div id="insp-rd-split" style="display:${node.readingBgMode === 'split' ? 'block' : 'none'};margin-top:6px;"><label>Ширина левой (%)</label><input type="number" id="inp-rd-split-left-width" value="${node.readingSplitLeftWidthPercent ?? 50}" min="0" max="100"><label>Цвет левой</label><input type="color" id="inp-rd-split-left-color" value="${rgbToHex(node.readingSplitLeftColor?.r, node.readingSplitLeftColor?.g, node.readingSplitLeftColor?.b)}"><label>Цвет правой</label><input type="color" id="inp-rd-split-right-color" value="${rgbToHex(node.readingSplitRightColor?.r, node.readingSplitRightColor?.g, node.readingSplitRightColor?.b)}"></div>`;
        html += `<div id="insp-rd-gradient" style="display:${node.readingBgMode === 'gradient' ? 'block' : 'none'};margin-top:6px;"><label><input type="checkbox" id="inp-rd-grad-mid-enabled" ${node.readingGradientMidEnabled !== false ? 'checked' : ''}> Цвет 3</label><label>Цвет 1</label><input type="color" id="inp-rd-grad-left-color" value="${rgbToHex(node.readingGradientLeftColor?.r, node.readingGradientLeftColor?.g, node.readingGradientLeftColor?.b)}"><div id="insp-rd-grad-mid-row" style="display:${node.readingGradientMidEnabled !== false ? 'block' : 'none'};"><label>Цвет 3</label><input type="color" id="inp-rd-grad-mid-color" value="${rgbToHex(node.readingGradientMidColor?.r, node.readingGradientMidColor?.g, node.readingGradientMidColor?.b)}"><label>Позиция (%)</label><input type="number" id="inp-rd-grad-mid-pos" value="${node.readingGradientMidPosition ?? 50}" min="0" max="100"></div><label>Цвет 2</label><input type="color" id="inp-rd-grad-right-color" value="${rgbToHex(node.readingGradientRightColor?.r, node.readingGradientRightColor?.g, node.readingGradientRightColor?.b)}"></div>`;
        html += `<div id="insp-rd-dynamic" style="display:${node.readingBgMode === 'dynamic' ? 'block' : 'none'};margin-top:6px;"><label>Режим динамики</label><select id="inp-rd-dyn-mode"><option value="simple" ${(node.readingDynamicMode || 'simple') === 'simple' ? 'selected' : ''}>A→B</option><option value="rgb" ${node.readingDynamicMode === 'rgb' ? 'selected' : ''}>RGB</option><option value="physiological" ${node.readingDynamicMode === 'physiological' ? 'selected' : ''}>Физиологический</option></select><label>Цвет A</label><input type="color" id="inp-rd-dyn-start" value="${rgbToHex(node.readingDynamicStartColor?.r, node.readingDynamicStartColor?.g, node.readingDynamicStartColor?.b)}"><label>Цвет B</label><input type="color" id="inp-rd-dyn-end" value="${rgbToHex(node.readingDynamicEndColor?.r, node.readingDynamicEndColor?.g, node.readingDynamicEndColor?.b)}"><label>Время цикла (с)</label><input type="number" id="inp-rd-dyn-duration" value="${(node.readingDynamicDuration || 10000) / 1000}" min="0.1" step="0.1"><label><input type="checkbox" id="inp-rd-dyn-loop" ${node.readingDynamicLoop ? 'checked' : ''}> Повторять</label><label><input type="checkbox" id="inp-rd-dyn-reverse" ${node.readingDynamicReverse ? 'checked' : ''}> Пинг-понг</label></div></div>`;
        html += '<div class="panel-section" style="background:#0a1a0a;border-color:#10b981;">';
        html += '<h3 style="color:#34d399;border-color:#10b981;">⏱ Время показа</h3>';
        const du = detectUnit(node.duration || 0),
            dv = node.duration > 0 ? msToUnit(node.duration, du) : 0;
        html += `<div class="time-group"><input type="number" id="inp-reading-duration" value="${dv}" step="any" min="0"><select id="inp-reading-duration-unit"><option value="ms" ${du === 'ms' ? 'selected' : ''}>мс</option><option value="s" ${du === 's' ? 'selected' : ''}>с</option><option value="min" ${du === 'min' ? 'selected' : ''}>мин</option></select></div>`;
        html += `<div class="acuity-hint" style="margin-top:4px;">0 = до кнопки</div>`;
        html += `<label><input type="checkbox" id="inp-reading-autosave" ${node.autoSaveBookmark !== false ? 'checked' : ''}> Автосохранение</label>`;
        html += `<label><input type="checkbox" id="inp-active" ${node.isActive !== false ? 'checked' : ''}> Активный узел</label></div></div>`;
        html +=
            '<button class="btn btn-success" id="inp-apply" style="width:100%;margin-top:6px;">💾 Применить</button>';
        inspectorEl.innerHTML = html;
        const bgModeSel = document.getElementById('inp-reading-bg-mode');
        if (bgModeSel)
            bgModeSel.addEventListener('change', () => {
                const m = bgModeSel.value;
                document.getElementById('insp-rd-solid').style.display = m === 'solid' ? 'block' : 'none';
                document.getElementById('insp-rd-split').style.display = m === 'split' ? 'block' : 'none';
                document.getElementById('insp-rd-gradient').style.display = m === 'gradient' ? 'block' : 'none';
                document.getElementById('insp-rd-dynamic').style.display = m === 'dynamic' ? 'block' : 'none';
            });
        const gmc = document.getElementById('inp-rd-grad-mid-enabled');
        if (gmc)
            gmc.addEventListener('change', () => {
                document.getElementById('insp-rd-grad-mid-row').style.display = gmc.checked ? 'block' : 'none';
            });
    }
    // ==================== ПРИМЕНЕНИЕ ИЗМЕНЕНИЙ ИНСПЕКТОРА ====================
    function initInspectorEvents() {
        inspectorEl.addEventListener('click', (e) => {
            if (e.target.id === 'inp-apply') applyInspectorChanges();
            else if (e.target.id === 'inp-reading-choose-book') window.openBookPicker();
        });
    }

    function applyInspectorChanges() {
        if (!state.activeNodeId) return;
        const node = getNode(state.activeNodeId);
        if (!node) return;
        if (node.nodeType === 'READING') {
            applyReadingInspectorChanges(node);
            requestRenderGraph();
            updateInspector();
            return;
        }
        if (node.nodeType === 'LOGIC_IF') {
            const n = document.getElementById('inp-name');
            if (n) node.name = n.value;
            requestRenderGraph();
            updateInspector();
            return;
        }
        if (node.nodeType === 'COMPARE') {
            applyCompareInspectorChanges(node);
            requestRenderGraph();
            updateInspector();
            return;
        }
        applyStimulusInspectorChanges(node);
        requestRenderGraph();
        updateInspector();
    }

    function applyPeriInspectorChanges(node) {
        const v = (id) => document.getElementById(id);
        if (v('inp-peri-enabled')) node.periEnabled = v('inp-peri-enabled').checked;
        if (v('inp-peri-count'))
            node.periCount = Math.max(1, Math.min(12, parseInt(v('inp-peri-count').value) || 4));
        if (v('inp-peri-acuity'))
            node.periAcuity = Math.max(0.1, Math.min(1.0, parseFloat(v('inp-peri-acuity').value) || 0.3));
        if (v('inp-peri-rmin'))
            node.periRadiusMinPct = Math.max(20, Math.min(100, parseInt(v('inp-peri-rmin').value) || 60));
        if (v('inp-peri-rmax'))
            node.periRadiusMaxPct = Math.max(20, Math.min(100, parseInt(v('inp-peri-rmax').value) || 90));
        if (v('inp-peri-color')) node.periColor = hexToRgb(v('inp-peri-color').value);
        if (v('inp-peri-motion')) node.periMotion = v('inp-peri-motion').value;
        if (v('inp-peri-speed'))
            node.periSpeed = Math.max(0.02, Math.min(5, parseFloat(v('inp-peri-speed').value) || 0.3));
        if (v('inp-peri-random')) node.periRandomAngles = v('inp-peri-random').checked;
    }

    function applyDefocusInspectorChanges(node) {
        const v = (id) => document.getElementById(id);
        if (v('inp-df-enabled')) node.dfEnabled = v('inp-df-enabled').checked;
        if (v('inp-df-radius-mm'))
            node.dfCenterRadiusMm = Math.max(3, Math.min(50, parseFloat(v('inp-df-radius-mm').value) || 13));
        if (v('inp-df-center-bg')) node.dfCenterBg = hexToRgb(v('inp-df-center-bg').value);
        if (v('inp-df-stim-color')) node.dfStimColor = hexToRgb(v('inp-df-stim-color').value);
        if (v('inp-df-peri-bg')) node.dfPeriBg = hexToRgb(v('inp-df-peri-bg').value);
        if (v('inp-df-blur')) node.dfPeriBlur = Math.max(0, Math.min(100, parseInt(v('inp-df-blur').value) || 0));
    }

    function applyBlinkAnimationInspectorChanges(node) {
        const v = (id) => document.getElementById(id);
        const el = v('inp-blink-enabled');
        if (el) node.blinkEnabled = el.checked;
        const t = v('inp-blink-target');
        if (t) node.blinkTarget = t.value;
        const cA = v('inp-blink-cA');
        if (cA) node.blinkColorA = hexToRgb(cA.value);
        const cB = v('inp-blink-cB');
        if (cB) node.blinkColorB = hexToRgb(cB.value);
        const iv = v('inp-blink-interval');
        if (iv) node.blinkIntervalMs = Math.max(50, Math.min(5000, parseInt(iv.value) || 500));
        const dt = v('inp-blink-duty');
        if (dt) node.blinkDuty = Math.max(0.05, Math.min(0.95, parseFloat(dt.value) || 0.5));
        const cn = v('inp-blink-count');
        if (cn) node.blinkCount = Math.max(0, parseInt(cn.value) || 0);
    }
    function applyStimulusInspectorChanges(node) {
        const v = (id) => document.getElementById(id);
        if (v('inp-name')) node.name = v('inp-name').value;
        if (v('inp-type')) node.stimType = v('inp-type').value;
        if (v('inp-active')) node.isActive = v('inp-active').checked;
        if (v('inp-acuity')) node.stimAcuity = parseFloat(v('inp-acuity').value) || 1.0;
        if (v('inp-end-acuity')) node.endAcuity = parseFloat(v('inp-end-acuity').value) || node.stimAcuity;
        if (v('inp-acuity-step')) node.acuityStep = parseFloat(v('inp-acuity-step').value) || 0.1;
        if (v('inp-distance')) node.stimDistance = parseFloat(v('inp-distance').value) || 1;
        if (v('inp-ppi')) node.stimPPI = parseInt(v('inp-ppi').value) || state.screenPPI || 96;
        if (v('inp-min-detect')) {
            const raw = v('inp-min-detect').value;
            if (raw === '' || raw == null) {
                delete node.minDetectPct;
            } else {
                const val = parseInt(raw);
                if (!isNaN(val) && val >= 30 && val <= 100) node.minDetectPct = val;
            }
        }

        if (v('inp-tol-near')) {
            const raw = v('inp-tol-near').value;
            if (raw === '' || raw == null) {
                delete node.tolNearCm;
            } else {
                const val = parseInt(raw);
                if (!isNaN(val) && val >= 2 && val <= 50) node.tolNearCm = val;
            }
        }
        if (v('inp-tol-far')) {
            const raw = v('inp-tol-far').value;
            if (raw === '' || raw == null) {
                delete node.tolFarCm;
            } else {
                const val = parseInt(raw);
                if (!isNaN(val) && val >= 2 && val <= 50) node.tolFarCm = val;
            }
        }

        if (v('inp-dist-mode')) {
            const mode = v('inp-dist-mode').value;
            if (mode === 'auto') node.distControlMode = 'auto';
            else delete node.distControlMode;
        }

        if (v('inp-tol-near')) {
            const raw = v('inp-tol-near').value;
            if (raw === '' || raw == null) {
                delete node.tolNearCm;
            } else {
                const val = parseInt(raw);
                if (!isNaN(val) && val >= 2 && val <= 50) node.tolNearCm = val;
            }
        }
        if (v('inp-tol-far')) {
            const raw = v('inp-tol-far').value;
            if (raw === '' || raw == null) {
                delete node.tolFarCm;
            } else {
                const val = parseInt(raw);
                if (!isNaN(val) && val >= 2 && val <= 50) node.tolFarCm = val;
            }
        }
        node.stimSize = getNodeComputedSize(node);
        if (v('inp-color')) {
            const c = hexToRgb(v('inp-color').value);
            node.stimR = c.r;
            node.stimG = c.g;
            node.stimB = c.b;
        }
        if (v('inp-bg')) {
            const c = hexToRgb(v('inp-bg').value);
            node.bgR = c.r;
            node.bgG = c.g;
            node.bgB = c.b;
        }
        if (v('inp-series-count')) node.seriesCount = Math.max(1, parseInt(v('inp-series-count').value) || 10);
        if (v('inp-adaptive-acuity')) node.adaptiveAcuity = v('inp-adaptive-acuity').checked;
        if (v('inp-series-size')) node.seriesSize = Math.max(1, parseInt(v('inp-series-size').value) || 6);
        if (v('inp-series-threshold'))
            node.seriesThreshold = Math.max(1, parseInt(v('inp-series-threshold').value) || 4);
        if (v('inp-random-pos')) node.singleRandomPos = v('inp-random-pos').checked;
        if (v('inp-grid-enabled')) node.singleGridEnabled = v('inp-grid-enabled').checked;
        if (v('inp-grid-x')) node.singleGridX = Math.max(1, Math.min(10, parseInt(v('inp-grid-x').value) || 3));
        if (v('inp-grid-y')) node.singleGridY = Math.max(1, Math.min(10, parseInt(v('inp-grid-y').value) || 3));
        if (v('inp-grid-show-lines')) node.singleGridShowLines = v('inp-grid-show-lines').checked;
        if (v('inp-grid-random')) node.singleGridRandomCell = v('inp-grid-random').checked;
        if (v('inp-grid-avoid-repeat')) node.singleGridAvoidRepeat = v('inp-grid-avoid-repeat').checked;
        const prev = document.getElementById('insp-grid-preview');
        if (prev) {
            try {
                const cells = JSON.parse(prev.dataset.selected || '[]');
                const gx = node.singleGridX || 3,
                    gy = node.singleGridY || 3;
                node.singleGridCells = cells.filter(
                    (c) =>
                        c &&
                        typeof c.row === 'number' &&
                        typeof c.col === 'number' &&
                        c.row >= 0 &&
                        c.row < gy &&
                        c.col >= 0 &&
                        c.col < gx
                );
            } catch (_) {
                node.singleGridCells = [];
            }
        }        if (v('inp-stim-dyn-enabled')) node.singleStimDynamicEnabled = v('inp-stim-dyn-enabled').checked;
        if (v('inp-sti-mid-enabled')) node.singleStimMidEnabled = v('inp-sti-mid-enabled').checked;
        if (v('inp-sti-color1')) node.singleStimColor1 = hexToRgb(v('inp-sti-color1').value);
        if (v('inp-sti-color3')) node.singleStimColor3 = hexToRgb(v('inp-sti-color3').value);
        if (v('inp-sti-color2')) node.singleStimColor2 = hexToRgb(v('inp-sti-color2').value);
        if (v('inp-sti-duration'))
            node.singleStimDuration = Math.max(200, (parseFloat(v('inp-sti-duration').value) || 10) * 1000);
        if (v('inp-sti-loop')) node.singleStimLoop = v('inp-sti-loop').checked;
        if (v('inp-sti-reverse')) node.singleStimReverse = v('inp-sti-reverse').checked;
        if (v('inp-bg-dyn-enabled')) node.singleBgDynamicEnabled = v('inp-bg-dyn-enabled').checked;
        if (v('inp-bg-mid-enabled')) node.singleBgMidEnabled = v('inp-bg-mid-enabled').checked;
        if (v('inp-bg-color1')) node.singleBgColor1 = hexToRgb(v('inp-bg-color1').value);
        if (v('inp-bg-color3')) node.singleBgColor3 = hexToRgb(v('inp-bg-color3').value);
        if (v('inp-bg-color2')) node.singleBgColor2 = hexToRgb(v('inp-bg-color2').value);
        if (v('inp-bg-duration'))
            node.singleBgDuration = Math.max(200, (parseFloat(v('inp-bg-duration').value) || 10) * 1000);
        if (v('inp-bg-loop')) node.singleBgLoop = v('inp-bg-loop').checked;
        if (v('inp-bg-reverse')) node.singleBgReverse = v('inp-bg-reverse').checked;
        if (v('inp-circle-enabled')) node.singleCircleEnabled = v('inp-circle-enabled').checked;
        if (v('inp-ci-enabled')) node.circleInnerEnabled = v('inp-ci-enabled').checked;
        if (v('inp-ci-radius'))
            node.circleInnerRadiusPct = Math.max(5, Math.min(95, parseInt(v('inp-ci-radius').value) || 40));
        if (v('inp-ci-c1')) node.circleInnerColor1 = hexToRgb(v('inp-ci-c1').value);
        if (v('inp-ci-mid-enabled')) node.circleInnerMidEnabled = v('inp-ci-mid-enabled').checked;
        if (v('inp-ci-c3')) node.circleInnerColor3 = hexToRgb(v('inp-ci-c3').value);
        if (v('inp-ci-c2')) node.circleInnerColor2 = hexToRgb(v('inp-ci-c2').value);
        if (v('inp-ci-duration'))
            node.circleInnerDuration = Math.max(200, (parseFloat(v('inp-ci-duration').value) || 10) * 1000);
        if (v('inp-ci-loop')) node.circleInnerLoop = v('inp-ci-loop').checked;
        if (v('inp-ci-reverse')) node.circleInnerReverse = v('inp-ci-reverse').checked;
        if (v('inp-co-enabled')) node.circleOuterEnabled = v('inp-co-enabled').checked;
        if (v('inp-co-c1')) node.circleOuterColor1 = hexToRgb(v('inp-co-c1').value);
        if (v('inp-co-mid-enabled')) node.circleOuterMidEnabled = v('inp-co-mid-enabled').checked;
        if (v('inp-co-c3')) node.circleOuterColor3 = hexToRgb(v('inp-co-c3').value);
        if (v('inp-co-c2')) node.circleOuterColor2 = hexToRgb(v('inp-co-c2').value);
        if (v('inp-co-duration'))
            node.circleOuterDuration = Math.max(200, (parseFloat(v('inp-co-duration').value) || 10) * 1000);
        if (v('inp-co-loop')) node.circleOuterLoop = v('inp-co-loop').checked;
        if (v('inp-co-reverse')) node.circleOuterReverse = v('inp-co-reverse').checked;
        applyPeriInspectorChanges(node);
        applyDefocusInspectorChanges(node);
        applyBlinkAnimationInspectorChanges(node);
        ['delay1', 'duration', 'response', 'delay2'].forEach((f) => {
            const ni = document.getElementById('inp-' + f),
                us = document.getElementById('inp-' + f + '-unit');
            if (ni && us) node[f] = unitToMs(parseFloat(ni.value) || 0, us.value);
        });
    }

    function applyCompareInspectorChanges(node) {
        const v = (id) => document.getElementById(id);
        if (v('inp-name')) node.name = v('inp-name').value;
        if (v('inp-active')) node.isActive = v('inp-active').checked;
        if (v('inp-cmp-mode')) node.compareMode = v('inp-cmp-mode').value;
        if (v('inp-cmp-pairs'))
            node.pairsCount = Math.max(1, Math.min(20, parseInt(v('inp-cmp-pairs').value) || 2));
        if (v('inp-cmp-gx')) node.gridX = Math.max(2, Math.min(6, parseInt(v('inp-cmp-gx').value) || 3));
        if (v('inp-cmp-gy')) node.gridY = Math.max(1, Math.min(6, parseInt(v('inp-cmp-gy').value) || 3));
        if (typeof inspectorEl._cmpReadGrid === 'function') {
            const cells = inspectorEl._cmpReadGrid();
            if (Array.isArray(cells) && cells.length >= 2) node.activeCells = cells;
        }
        if (typeof inspectorEl._cmpReadCells === 'function') {
            const params = inspectorEl._cmpReadCells();
            if (Array.isArray(params) && params.length > 0) {
                while (params.length < (node.activeCells || []).length) params.push(params[params.length - 1]);
                node.cellParams = params.slice(0, node.activeCells.length);
            }
        }
        if (v('inp-cmp-sc')) node.seriesCount = Math.max(1, parseInt(v('inp-cmp-sc').value) || 10);
        if (v('inp-cmp-adaptive')) node.adaptiveAcuity = v('inp-cmp-adaptive').checked;
        var _reEl = document.getElementById('inp-cmp-resp');
        var _reUn = document.getElementById('inp-cmp-resp-unit');
        if (_reEl) {
            var _reVal = parseFloat(_reEl.value) || 0;
            var _reUnit = _reUn ? _reUn.value : 'ms';
            node.response = unitToMs(_reVal, _reUnit);
        }
        if (v('inp-cmp-ss')) node.seriesSize = Math.max(1, parseInt(v('inp-cmp-ss').value) || 6);
        if (v('inp-cmp-st')) node.seriesThreshold = Math.max(1, parseInt(v('inp-cmp-st').value) || 4);
        ['inp-cmp-d1', 'inp-cmp-dur', 'inp-cmp-d2'].forEach(function (id) {
            var el = document.getElementById(id);
            var un = document.getElementById(id + '-unit');
            if (!el) return;
            var val = parseFloat(el.value) || 0;
            var unit = un ? un.value : 'ms';
            var ms = unitToMs(val, unit);
            if (id === 'inp-cmp-d1') node.delay1 = ms;
            if (id === 'inp-cmp-dur') node.duration = ms;
            if (id === 'inp-cmp-d2') node.delay2 = ms;
        });
    }
    function applyReadingInspectorChanges(node) {
        const v = (id) => document.getElementById(id);
        if (v('inp-name')) node.name = v('inp-name').value;
        if (v('inp-reading-font')) node.readingFontFamily = v('inp-reading-font').value || 'Segoe UI';
        if (v('inp-reading-bold')) node.readingFontWeight = v('inp-reading-bold').checked ? 'bold' : 'normal';
        if (v('inp-reading-acuity')) node.readingAcuity = parseFloat(v('inp-reading-acuity').value) || 1.0;
        const rdEl = v('inp-reading-distance');
        if (rdEl) {
            const n = parseFloat(rdEl.value);
            if (!isNaN(n) && n > 0) {
                node.readingDistance = n;
                state.readingDistance = n;
                window.saveUserSettings();
            }
        }
        if (v('inp-reading-text-color')) node.readingTextColor = hexToRgb(v('inp-reading-text-color').value);
        if (v('inp-reading-bg-mode')) node.readingBgMode = v('inp-reading-bg-mode').value;
        if (v('inp-rd-bg-color')) node.readingBgColor = hexToRgb(v('inp-rd-bg-color').value);
        if (v('inp-rd-split-left-width'))
            node.readingSplitLeftWidthPercent = parseInt(v('inp-rd-split-left-width').value) || 50;
        if (v('inp-rd-split-left-color'))
            node.readingSplitLeftColor = hexToRgb(v('inp-rd-split-left-color').value);
        if (v('inp-rd-split-right-color'))
            node.readingSplitRightColor = hexToRgb(v('inp-rd-split-right-color').value);
        if (v('inp-rd-grad-mid-enabled')) node.readingGradientMidEnabled = v('inp-rd-grad-mid-enabled').checked;
        if (v('inp-rd-grad-left-color'))
            node.readingGradientLeftColor = hexToRgb(v('inp-rd-grad-left-color').value);
        if (v('inp-rd-grad-mid-color')) node.readingGradientMidColor = hexToRgb(v('inp-rd-grad-mid-color').value);
        if (v('inp-rd-grad-mid-pos'))
            node.readingGradientMidPosition = parseInt(v('inp-rd-grad-mid-pos').value) || 50;
        if (v('inp-rd-grad-right-color'))
            node.readingGradientRightColor = hexToRgb(v('inp-rd-grad-right-color').value);
        if (v('inp-rd-dyn-mode')) node.readingDynamicMode = v('inp-rd-dyn-mode').value;
        if (v('inp-rd-dyn-start')) node.readingDynamicStartColor = hexToRgb(v('inp-rd-dyn-start').value);
        if (v('inp-rd-dyn-end')) node.readingDynamicEndColor = hexToRgb(v('inp-rd-dyn-end').value);
        if (v('inp-rd-dyn-duration'))
            node.readingDynamicDuration = Math.max(
                200,
                (parseFloat(v('inp-rd-dyn-duration').value) || 10) * 1000
            );
        if (v('inp-rd-dyn-loop')) node.readingDynamicLoop = v('inp-rd-dyn-loop').checked;
        if (v('inp-rd-dyn-reverse')) node.readingDynamicReverse = v('inp-rd-dyn-reverse').checked;
        const durEl = v('inp-reading-duration'),
            durU = v('inp-reading-duration-unit');
        if (durEl && durU) {
            const val = parseFloat(durEl.value) || 0;
            node.duration = val > 0 ? unitToMs(val, durU.value) : 0;
        }
        if (v('inp-reading-autosave')) node.autoSaveBookmark = v('inp-reading-autosave').checked;
        if (v('inp-active')) node.isActive = v('inp-active').checked;
    }

    // ==================== EXPORT ====================
    window.AppInspector = {
        updateInspector,
        renderInspectorGridPreview,
        renderPeriInspectorSection,
        renderDefocusInspectorSection,
        renderBlinkAnimationInspectorSection,
        updateStimulusInspector,
        updateLogicInspector,
        updateCompareInspector,
        updateReadingInspector,
        initInspectorEvents,
        applyInspectorChanges,
        applyPeriInspectorChanges,
        applyDefocusInspectorChanges,
        applyBlinkAnimationInspectorChanges,
        applyStimulusInspectorChanges,
        applyCompareInspectorChanges,
        applyReadingInspectorChanges
    };

    VLog.log('[app-inspector] AppInspector экспортирован');
})();