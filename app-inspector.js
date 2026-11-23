// ==================== APP-INSPECTOR.JS ====================
(function () {
    'use strict';

    const VLog = window.VLog || { log() {}, warn() {}, error() {} };
    const VissortDialog = window.VissortDialog;
    const state = window.AppState;
    const { acuityToSizeMm, acuityToSizePx, rgbToHex, hexToRgb, escapeHtml, detectUnit, msToUnit, unitToMs } = window.VissortCore;

    const inspectorEl = document.getElementById('inspector');

    const getNode = (id) => window.AppEditor.getNode(id);
    const getNodeComputedSizeMm = (node) => window.AppEditor.getNodeComputedSizeMm(node);
    const getNodeComputedSize = (node) => window.AppEditor.getNodeComputedSize(node);
    const requestRenderGraph = () => window.AppEditor.requestRenderGraph();

    // ==================== ГЛАВНЫЙ ВХОД ====================
    function updateInspector() {
        const node = getNode(state.activeNodeId);
        if (!node) {
            inspectorEl.innerHTML = '<h2>Инспектор</h2><p>Нет выбранного узла</p>';
            return;
        }
        if (node.nodeType === 'READING') { updateReadingInspector(node); return; }
        if (node.nodeType === 'LOGIC_IF') { updateLogicInspector(node); return; }
        if (node.nodeType === 'COMPARE') { updateCompareInspector(node); return; }
        updateStimulusInspector(node);
    }

    // ==================== GRID PREVIEW ====================
    function renderInspectorGridPreview() {
        const p = document.getElementById('insp-grid-preview');
        if (!p) return;
        const gx = Math.max(1, Math.min(10, parseInt(document.getElementById('inp-grid-x')?.value) || 3));
        const gy = Math.max(1, Math.min(10, parseInt(document.getElementById('inp-grid-y')?.value) || 3));
        let sel = [];
        try { sel = JSON.parse(p.dataset.selected || '[]'); } catch (_) { sel = []; }
        sel = sel.filter((c) => c && c.row >= 0 && c.row < gy && c.col >= 0 && c.col < gx);
        p.style.gridTemplateColumns = `repeat(${gx}, 30px)`;
        p.innerHTML = '';
        for (let r = 0; r < gy; r++)
            for (let c = 0; c < gx; c++) {
                const isSel = sel.some((x) => x.row === r && x.col === c);
                const cell = document.createElement('div');
                cell.style.cssText = `width:30px;height:30px;border:1px solid #444;border-radius:2px;cursor:pointer;transition:background 0.15s;background:${isSel ? '#22c55e' : '#1a1a1a'};`;
                cell.dataset.row = r; cell.dataset.col = c; cell.dataset.selected = isSel ? '1' : '0';
                cell.addEventListener('click', () => {
                    const was = cell.dataset.selected === '1';
                    cell.dataset.selected = was ? '0' : '1';
                    cell.style.background = was ? '#1a1a1a' : '#22c55e';
                    const list = [];
                    p.querySelectorAll('[data-selected="1"]').forEach((e2) => list.push({ row: parseInt(e2.dataset.row), col: parseInt(e2.dataset.col) }));
                    p.dataset.selected = JSON.stringify(list);
                    const h = document.getElementById('insp-grid-preview-hint');
                    if (h) h.textContent = list.length === 0 ? 'Пусто = все клетки.' : `Выбрано: ${list.length}`;
                });
                p.appendChild(cell);
            }
    }

    // ==================== СЕКЦИИ ====================
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
        </div></div>`;
    }
    function renderBlinkAnimationInspectorSection(node) {
        return `<div class="panel-section" style="background:#1a0a05;border-color:#f97316;">
        <h3 style="color:#fb923c;border-color:#f97316;">🔦 Моргание</h3>
        <label><input type="checkbox" id="inp-blink-enabled" ${node.blinkEnabled ? 'checked' : ''}> Включить моргание</label>
        <div id="insp-blink-settings" style="display:${node.blinkEnabled ? 'block' : 'none'};margin-top:6px;">
            <label>Цель</label><select id="inp-blink-target">
                <option value="stim" ${(node.blinkTarget || 'stim') === 'stim' ? 'selected' : ''}>Только стимул</option>
                <option value="bg" ${node.blinkTarget === 'bg' ? 'selected' : ''}>Только фон</option>
                <option value="both" ${node.blinkTarget === 'both' ? 'selected' : ''}>Стимул + фон</option></select>
            <label>Цвет A</label><input type="color" id="inp-blink-cA" value="${rgbToHex(node.blinkColorA?.r, node.blinkColorA?.g, node.blinkColorA?.b)}">
            <label>Цвет B</label><input type="color" id="inp-blink-cB" value="${rgbToHex(node.blinkColorB?.r, node.blinkColorB?.g, node.blinkColorB?.b)}">
            <label>Период (мс)</label><input type="number" id="inp-blink-interval" value="${node.blinkIntervalMs || 500}" min="50" max="5000" step="50">
            <label>Доля A</label><input type="number" id="inp-blink-duty" value="${node.blinkDuty ?? 0.5}" min="0.05" max="0.95" step="0.05">
            <label>Морганий (0 = ∞)</label><input type="number" id="inp-blink-count" value="${node.blinkCount || 0}" min="0" max="9999" step="1">
        </div></div>`;
    }

    // ==================== АНИМАЦИЯ (ЖС) В ИНСПЕКТОРЕ ====================
    function renderDynamicInspectorSection(node) {
        if (!node.params) node.params = {};
        const dyn = node.params.stimulusDynamic || {};
        if (!Array.isArray(dyn.frames) || dyn.frames.length === 0) {
            dyn.frames = [{ lifecycle: { delay1: 0, duration: 5, responseTime: 0, delay2: 0 }, stim: {}, bg: {}, repeats: 1, step: 0.1, mode: 'smooth' }];
        }
        const fr = dyn.frames[0] || {};
        const stim = fr.stim || {}, bg = fr.bg || {};
        const active = dyn.active !== false;
        const stepSel = [0.1, 0.2, 0.3, 0.4, 0.5, 1.0].map((s) => `<option value="${s}" ${Math.abs((fr.step || 0.1) - s) < 1e-9 ? 'selected' : ''}>${s}</option>`).join('');
        return `<div class="panel-section" style="background:#1a0a2a;border-color:#8b5cf6;">
        <h3 style="color:#a78bfa;border-color:#8b5cf6;">🎬 Анимация (Живой стимул)</h3>
        <label style="display:block;margin-bottom:6px;"><input type="checkbox" id="dyn-enabled" ${active ? 'checked' : ''}> Живой стимул активен</label>
        <div id="dyn-settings" style="display:${active ? 'block' : 'none'};margin-top:6px;">
            <label>Режим</label><select id="dyn-mode">
                <option value="smooth" ${fr.mode !== 'jump' ? 'selected' : ''}>Плавно</option>
                <option value="jump" ${fr.mode === 'jump' ? 'selected' : ''}>Скачками</option></select>
            <label>Шаг (D)</label><select id="dyn-step">${stepSel}</select>
            <label>Стимул: начальный D</label><input type="number" id="dyn-stim-start" value="${stim.startD ?? 0}" min="0" max="2" step="0.1">
            <label>Стимул: конечный D</label><input type="number" id="dyn-stim-end" value="${stim.endD ?? 0}" min="0" max="2" step="0.1">
            <label>Стимул: яркость (%)</label><div style="display:flex;gap:4px;"><input type="number" id="dyn-stim-bright-start" value="${stim.startBright ?? 100}" min="0" max="100"><input type="number" id="dyn-stim-bright-end" value="${stim.endBright ?? 100}" min="0" max="100"></div>
            <label>Фон: начальный D</label><input type="number" id="dyn-bg-start" value="${bg.startD ?? 0}" min="0" max="2" step="0.1">
            <label>Фон: конечный D</label><input type="number" id="dyn-bg-end" value="${bg.endD ?? 0}" min="0" max="2" step="0.1">
            <label>Фон: яркость (%)</label><div style="display:flex;gap:4px;"><input type="number" id="dyn-bg-bright-start" value="${bg.startBright ?? 100}" min="0" max="100"><input type="number" id="dyn-bg-bright-end" value="${bg.endBright ?? 100}" min="0" max="100"></div>
        </div></div>`;
    }

    // ==================== ИНСПЕКТОР: СТИМУЛ ====================
    function updateStimulusInspector(node) {
        const mm = getNodeComputedSizeMm(node), px = getNodeComputedSize(node);
        let html = '<h2>Инспектор</h2><div class="insp-cols">';
        
        // --- ИНФОРМАЦИЯ ---
        html += '<div class="panel-section"><h3>📋 Информация</h3>';
        html += `<label>Название узла</label><input type="text" id="inp-name" value="${escapeHtml(node.name)}">`;
        html += `<label style="display:block; margin-top:6px; margin-bottom:6px; font-weight:bold;"><input type="checkbox" id="inp-active" ${node.isActive !== false ? 'checked' : ''}> 👁️ Ожидать ответы</label>`;
        html += `<label>Тип стимула</label><select id="inp-type">
            <option value="LETTER_E" ${node.stimType === 'LETTER_E' ? 'selected' : ''}>Буква Е</option>
            <option value="LANDOLT" ${node.stimType === 'LANDOLT' ? 'selected' : ''}>Кольцо Ландольта</option></select>`;
        html += `</div>`;

        // --- ЦВЕТА ---
        html += '<div class="panel-section" style="background:#1a1a0a;border-color:#eab308;">';
        html += '<h3 style="color:#fde047;border-color:#eab308;">🎨 Цвета и яркость</h3>';
        html += `<label>Цвет стимула</label><input type="color" id="inp-color" value="${rgbToHex(node.stimR, node.stimG, node.stimB)}">`;
        html += `<label>Цвет фона</label><input type="color" id="inp-bg" value="${rgbToHex(node.bgR, node.bgG, node.bgB)}">`;
        html += `<label>Яркость стимула (%)</label><input type="number" id="inp-stim-brightness" value="${node.stimBrightness ?? 100}" min="0" max="100" step="1">`;
        html += `<label>Яркость фона (%)</label><input type="number" id="inp-bg-brightness" value="${node.bgBrightness ?? 100}" min="0" max="100" step="1">`;
        html += '</div>';

        // --- ОСТРОТА ---
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
        html += `<label>Шаг V</label><input type="number" id="inp-acuity-step" value="${node.acuityStep || 0.1}" min="0.05" max="1" step="0.05">`;
        html += `<label>Дистанция (м)</label><input type="number" id="inp-distance" value="${(node.stimDistance || 1).toFixed(1)}" min="0.1" max="20" step="0.1">`;
        html += `<input type="hidden" id="inp-ppi" value="${state.screenPPI || 96}">`;
        html += `<div style="margin-top:6px;padding:6px;background:#000;border-radius:3px;text-align:center;">
            <div style="color:#ffcc00;font-size:13px;font-weight:bold;" id="preview-mm">📐 ${mm.toFixed(2)} мм</div>
            <div style="color:#888;font-size:10px;" id="preview-px">≈ ${px}px @ ${node.stimPPI || state.screenPPI || 96} PPI</div></div>`;
        html += `<label><input type="checkbox" id="inp-adaptive-acuity" ${node.adaptiveAcuity !== false ? 'checked' : ''}> 👁️ Адаптивная острота</label></div>`;

        // --- СЕРИЯ ---
        html += '<div class="panel-section" style="background:#1a0a1a;border-color:#a855f7;">';
        html += '<h3 style="color:#c084fc;border-color:#a855f7;">📊 Серия</h3>';
        html += `<label>Циклов в серии</label><input type="number" id="inp-series-size" value="${node.seriesSize || 6}" min="1" max="20">`;
        html += `<label>Критерий правильности</label><input type="number" id="inp-series-threshold" value="${node.seriesThreshold || 4}" min="1" max="20"></div>`;

        // --- СЕТКА ---
        const cells = Array.isArray(node.singleGridCells) ? node.singleGridCells : [];
        html += '<div class="panel-section" style="background:#0a1a10;border-color:#22c55e;">';
        html += '<h3 style="color:#4ade80;border-color:#22c55e;">🔲 Сетка положения</h3>';
        html += `<label><input type="checkbox" id="inp-grid-enabled" ${node.singleGridEnabled ? 'checked' : ''}> Включить сетку</label>`;
        html += `<div id="insp-grid-settings" style="display:${node.singleGridEnabled ? 'block' : 'none'};margin-top:6px;">`;
        html += `<label>Столбцов (X)</label><input type="number" id="inp-grid-x" value="${node.singleGridX || 3}" min="1" max="10" step="1">`;
        html += `<label>Строк (Y)</label><input type="number" id="inp-grid-y" value="${node.singleGridY || 3}" min="1" max="10" step="1">`;
        html += `<label><input type="checkbox" id="inp-grid-random" ${node.singleGridRandomCell !== false ? 'checked' : ''}> Случайная клетка</label>`;
        html += `<label><input type="checkbox" id="inp-grid-avoid-repeat" ${node.singleGridAvoidRepeat !== false ? 'checked' : ''}> Избегать повтора</label>`;
        html += `<div style="margin-top:10px;padding-top:8px;border-top:1px dashed #22c55e;">`;
        html += `<label style="color:#4ade80;">Активные клетки</label>`;
        html += `<div style="font-size:10px;color:#94a3b8;margin-bottom:6px;" id="insp-grid-preview-hint">${cells.length === 0 ? 'Пусто = все клетки.' : `Выбрано: ${cells.length}`}</div>`;
        html += `<div id="insp-grid-preview" style="display:grid;gap:3px;"></div></div></div></div>`;

        // --- ПЕРИФЕРИЯ, ДЕФОКУС, МОРГАНИЕ ---
        html += renderPeriInspectorSection(node);
        html += renderDefocusInspectorSection(node);
        html += renderBlinkAnimationInspectorSection(node);

        // --- СЛУЧАЙНОСТЬ ---
        html += '<div class="panel-section" style="background:#0a1a20;border-color:#0ea5e9;">';
        html += '<h3 style="color:#38bdf8;border-color:#0ea5e9;">🎲 Случайность</h3>';
        html += `<label><input type="checkbox" id="inp-random-pos" ${node.singleRandomPos ? 'checked' : ''}> Случайное положение стимула</label>`;
        html += '</div>';

        // --- СЦЕНАРИЙ ---
        html += '<div class="panel-section" style="background:#0a1a10;border-color:#22c55e;">';
        html += '<h3 style="color:#4ade80;border-color:#22c55e;">📈 Сценарий</h3>';
        html += `<label>Серий всего</label><input type="number" id="inp-series-count" value="${node.seriesCount || 10}" min="1" max="50"></div>`;

        // --- АНИМАЦИЯ (ЖС) ---
        html += renderDynamicInspectorSection(node);

        html += '</div>'; // конец insp-cols

        // НИЖНЯЯ КНОПКА ПРИМЕНИТЬ
        html += '<button class="btn btn-success" id="inp-apply" style="width:100%;margin-top:6px; padding:8px;">💾 Применить</button>';

        inspectorEl.innerHTML = html;

        // === ПРИВЯЗКА АНИМАЦИИ (ЖС) ===
        setTimeout(() => {
            const dynCb = document.getElementById('dyn-enabled');
            const settings = document.getElementById('dyn-settings');
            const endSel = '#dyn-stim-end, #dyn-bg-end, #dyn-stim-bright-end, #dyn-bg-bright-end, #dyn-step, #dyn-mode';
            const updateLock = () => {
                const isActive = dynCb && dynCb.checked;
                if (settings) settings.style.display = isActive ? 'block' : 'none';
                inspectorEl.querySelectorAll(endSel).forEach((el) => {
                    el.disabled = !isActive;
                    el.style.opacity = isActive ? '1' : '0.5';
                    el.style.pointerEvents = isActive ? 'auto' : 'none';
                });
            };
            if (dynCb) dynCb.addEventListener('change', updateLock);
            updateLock();
        }, 100);
        // === КОНЕЦ ПРИВЯЗКИ АНИМАЦИИ ===
        // === БЛОКИРОВКА КОНЕЧНЫХ ПОЛЕЙ ЖС (ПРОСТОЙ ФИКС) ===
        setTimeout(() => {
            const dynCb = document.getElementById('dyn-enabled');
            if (!dynCb) return;

            const updateLock = () => {
                const isActive = dynCb.checked;

                // 1. Снимаем блокировку и серость со ВСЕХ полей ЖС
                inspectorEl.querySelectorAll('#dyn-stimulus-editor-root input, #dyn-stimulus-editor-root select').forEach(el => {
                    el.disabled = false;
                    el.style.opacity = '1';
                    el.style.pointerEvents = 'auto';
                    let p = el.parentElement;
                    while (p && p !== inspectorEl) {
                        p.style.opacity = '1';
                        p.style.pointerEvents = 'auto';
                        p = p.parentElement;
                    }
                });

                // 2. Если ЖС выключен — блокируем ТОЛЬКО конечные поля
                if (!isActive) {
                    const endFields = inspectorEl.querySelectorAll(
                        '.dyn-stim-end, .dyn-bg-end, ' +
                        '.dyn-stim-bright-end, .dyn-bg-bright-end, ' +
                        '.dyn-step, .dyn-mode'
                    );
                    endFields.forEach(el => {
                        el.disabled = true;
                        el.style.opacity = '0.5';
                        el.style.pointerEvents = 'none';
                        // Но НЕ трогаем родителя! (чтобы не затемнить начальные)
                    });
                }
            };

            updateLock();
            dynCb.addEventListener('change', updateLock);
        }, 100);
        // === КОНЕЦ БЛОКИРОВКИ ===

        // === ЗАЩИТА ГАЛОЧКИ "ОЖИДАТЬ ОТВЕТЫ" ===
        const forceShowActive = () => {
            const cb = document.getElementById('inp-active');
            if (cb) {
                cb.style.display = '';
                const lbl = cb.closest('label');
                if (lbl) lbl.style.setProperty('display', 'block', 'important');
            }
        };
        forceShowActive();
        setTimeout(forceShowActive, 50);
        setTimeout(forceShowActive, 200);

        // === ПРОЧИЕ ПРИВЯЗКИ ===
        const p = document.getElementById('insp-grid-preview');
        if (p) { p.dataset.selected = JSON.stringify(cells); renderInspectorGridPreview(); }
        const ai = document.getElementById('inp-acuity'), di = document.getElementById('inp-distance'), pp = document.getElementById('inp-ppi');
        const upd = () => {
            const v = parseFloat(ai?.value) || 1.0, d = parseFloat(di?.value) || 1, ppi = parseInt(pp?.value) || state.screenPPI || 96;
            const m = document.getElementById('preview-mm');
            if (m) m.textContent = `📐 ${acuityToSizeMm(v, d).toFixed(2)} мм`;
            const x = document.getElementById('preview-px');
            if (x) x.textContent = `≈ ${acuityToSizePx(v, d, ppi)}px @ ${ppi} PPI`;
        };
        if (ai) ai.addEventListener('change', upd);
        if (di) di.addEventListener('input', upd);
        if (pp) pp.addEventListener('input', upd);

        const bind = (id, target) => {
            const c = document.getElementById(id), t = document.getElementById(target);
            if (c && t) c.addEventListener('change', () => { t.style.display = c.checked ? 'block' : 'none'; });
        };
        bind('inp-grid-enabled', 'insp-grid-settings');
        bind('inp-peri-enabled', 'insp-peri-settings');
        bind('inp-df-enabled', 'insp-df-settings');
        bind('inp-blink-enabled', 'insp-blink-settings');
        
        const gxI = document.getElementById('inp-grid-x'), gyI = document.getElementById('inp-grid-y');
        if (gxI) gxI.addEventListener('input', renderInspectorGridPreview);
        if (gyI) gyI.addEventListener('input', renderInspectorGridPreview);
    }

    // ==================== ИНСПЕКТОР: ЛОГИКА ====================
    function updateLogicInspector(node) {
        let html = '<h2>Инспектор</h2><div class="panel-section"><h3>🧠 Логика</h3>';
        html += `<label>Название узла</label><input type="text" id="inp-name" value="${escapeHtml(node.name)}">`;
        html += '<div class="acuity-hint">Логика условных переходов появится позже.</div></div>';
        inspectorEl.innerHTML = html;
    }

    // ==================== ИНСПЕКТОР: СРАВНЕНИЕ ====================
    function updateCompareInspector(node) {
        let html = '<h2>Инспектор</h2><div class="insp-cols">';
        html += '<div class="panel-section"><h3>📋 Информация</h3>';
        html += `<label style="display:block; margin-bottom:6px; margin-top:6px; font-weight:bold; border-top:1px dashed #f59e0b; padding-top:6px;"><input type="checkbox" id="inp-active" ${node.isActive !== false ? 'checked' : ''}> 👁️ Ожидать ответы</label>`;
        html += `<label>Название узла</label><input type="text" id="inp-name" value="${escapeHtml(node.name)}">`;
        html += `</div>`;
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
        html += '<h3 style="color:#fde047;border-color:#eab308;">🎨 Параметры клеток</h3><div id="insp-cmp-cells"></div></div>';
        html += '<div class="panel-section" style="background:#1a1000;border-color:#f59e0b;">';
        html += '<h3 style="color:#fbbf24;border-color:#f59e0b;">🔄 Цикл показа</h3>';
        var _tfCmp = [
            { id: 'inp-cmp-d1', label: 'Задержка 1', value: node.delay1 || 0 },
            { id: 'inp-cmp-dur', label: 'Время показа', value: node.duration || 0 },
            { id: 'inp-cmp-resp', label: 'Ожидание ответа', value: node.response || 0 },
            { id: 'inp-cmp-d2', label: 'Задержка 2', value: node.delay2 || 0 }
        ];
        _tfCmp.forEach(function (f) {
            var u = detectUnit(f.value), dv = msToUnit(f.value, u);
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
        html += '</div>';
        html += '<button class="btn btn-success" id="inp-apply" style="width:100%;margin-top:6px; padding:8px;">💾 Применить</button>';
        inspectorEl.innerHTML = html;

        const previewEl = document.getElementById('insp-cmp-grid');
        previewEl.dataset.selected = JSON.stringify(node.activeCells || []);
        function renderGrid() {
            const gx = Math.max(2, Math.min(6, parseInt(document.getElementById('inp-cmp-gx')?.value) || 3));
            const gy = Math.max(1, Math.min(6, parseInt(document.getElementById('inp-cmp-gy')?.value) || 3));
            let sel = [];
            try { sel = JSON.parse(previewEl.dataset.selected || '[]'); } catch (_) { sel = []; }
            sel = sel.filter((c) => c && c.row < gy && c.col < gx);
            if (sel.length < 2) sel = [{ row: 0, col: 0 }, { row: 0, col: 1 }].filter((c) => c.row < gy && c.col < gx);
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
                        previewEl.querySelectorAll('[data-on="1"]').forEach((e2) => list.push({ row: parseInt(e2.dataset.row), col: parseInt(e2.dataset.col) }));
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
                    acuity: V, distance: dist, ppi, size: acuityToSizePx(V, dist, ppi),
                    stimR: sc.r, stimG: sc.g, stimB: sc.b,
                    bgR: bc.r, bgG: bc.g, bgB: bc.b, duration: d
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
            try { sel = JSON.parse(previewEl.dataset.selected || '[]'); } catch (_) { sel = []; }
            sel.forEach((cell, idx) => {
                const p = saved[idx] || saved[saved.length - 1] || { acuity: 1, stimR: 255, stimG: 255, stimB: 255, bgR: 0, bgG: 0, bgB: 0, duration: 2000 };
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
        if (hasOwn) bookHtml = `<span style="color:#7dd3fc;">${escapeHtml(node.bookName || '(без имени)')}</span>`;
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
            const v = i / 10, m = acuityToSizeMm(v, 1);
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
        const du = detectUnit(node.duration || 0), dv = node.duration > 0 ? msToUnit(node.duration, du) : 0;
        html += `<div class="time-group"><input type="number" id="inp-reading-duration" value="${dv}" step="any" min="0"><select id="inp-reading-duration-unit"><option value="ms" ${du === 'ms' ? 'selected' : ''}>мс</option><option value="s" ${du === 's' ? 'selected' : ''}>с</option><option value="min" ${du === 'min' ? 'selected' : ''}>мин</option></select></div>`;
        html += `<div class="acuity-hint" style="margin-top:4px;">0 = до кнопки</div>`;
        html += `<label><input type="checkbox" id="inp-reading-autosave" ${node.autoSaveBookmark !== false ? 'checked' : ''}> Автосохранение</label>`;
        html += `<label><input type="checkbox" id="inp-active" ${node.isActive !== false ? 'checked' : ''}> Активный узел</label></div></div>`;
        html += '<button class="btn btn-success" id="inp-apply" style="width:100%;margin-top:6px; padding:8px;">💾 Применить</button>';
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
        if (gmc) gmc.addEventListener('change', () => {
            document.getElementById('insp-rd-grad-mid-row').style.display = gmc.checked ? 'block' : 'none';
        });
    }

    // ==================== ПРИМЕНЕНИЕ ====================
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
        if (node.nodeType === 'STIMULUS') {
            applyStimulusInspectorChanges(node);
        }
        requestRenderGraph();
        updateInspector();
    }

    function applyStimulusInspectorChanges(node) {
        if (!node.params) node.params = {};
        if (!node.params.stimulusDynamic) node.params.stimulusDynamic = {};
        const dynCb = document.getElementById('dyn-enabled');
        if (dynCb) node.params.stimulusDynamic.active = dynCb.checked;

        const v = (id) => document.getElementById(id);
        if (v('inp-name')) {
            const newName = v('inp-name').value.trim();
            const isDuplicate = state.nodes.some(n => n.id !== node.id && n.name === newName);
            if (isDuplicate) {
                VissortDialog.alert('Имя "' + newName + '" уже занято. Выберите другое.');
                return;
            }
            node.name = newName || 'Без имени';
        }
        if (v('inp-type')) node.stimType = v('inp-type').value;
        if (v('inp-active')) node.isActive = v('inp-active').checked;
        if (v('inp-acuity')) node.stimAcuity = parseFloat(v('inp-acuity').value) || 1.0;
        if (v('inp-end-acuity')) node.endAcuity = parseFloat(v('inp-end-acuity').value) || node.stimAcuity;
        if (v('inp-acuity-step')) node.acuityStep = parseFloat(v('inp-acuity-step').value) || 0.1;
        if (v('inp-distance')) node.stimDistance = parseFloat(v('inp-distance').value) || 1;
        node.stimPPI = state.screenPPI || 96;
        if (v('inp-series-count')) node.seriesCount = Math.max(1, parseInt(v('inp-series-count').value) || 10);
        if (v('inp-adaptive-acuity')) node.adaptiveAcuity = v('inp-adaptive-acuity').checked;
        if (v('inp-series-size')) node.seriesSize = Math.max(1, parseInt(v('inp-series-size').value) || 6);
        if (v('inp-series-threshold')) node.seriesThreshold = Math.max(1, parseInt(v('inp-series-threshold').value) || 4);
        if (v('inp-color')) { const c = hexToRgb(v('inp-color').value); node.stimR = c.r; node.stimG = c.g; node.stimB = c.b; }
        if (v('inp-bg')) { const c = hexToRgb(v('inp-bg').value); node.bgR = c.r; node.bgG = c.g; node.bgB = c.b; }
        if (v('inp-stim-brightness')) node.stimBrightness = Math.max(0, Math.min(100, parseInt(v('inp-stim-brightness').value) || 100));
        if (v('inp-bg-brightness')) node.bgBrightness = Math.max(0, Math.min(100, parseInt(v('inp-bg-brightness').value) || 100));
        if (v('inp-random-pos')) node.singleRandomPos = v('inp-random-pos').checked;
        if (v('inp-grid-enabled')) node.singleGridEnabled = v('inp-grid-enabled').checked;
        if (v('inp-grid-x')) node.singleGridX = Math.max(1, Math.min(10, parseInt(v('inp-grid-x').value) || 3));
        if (v('inp-grid-y')) node.singleGridY = Math.max(1, Math.min(10, parseInt(v('inp-grid-y').value) || 3));
        if (v('inp-grid-random')) node.singleGridRandomCell = v('inp-grid-random').checked;
        if (v('inp-grid-avoid-repeat')) node.singleGridAvoidRepeat = v('inp-grid-avoid-repeat').checked;
        
        const prev = document.getElementById('insp-grid-preview');
        if (prev) {
            try {
                const cells = JSON.parse(prev.dataset.selected || '[]');
                const gx = node.singleGridX || 3, gy = node.singleGridY || 3;
                node.singleGridCells = cells.filter(c => c && typeof c.row === 'number' && typeof c.col === 'number' && c.row >= 0 && c.row < gy && c.col >= 0 && c.col < gx);
            } catch (_) { node.singleGridCells = []; }
        }

        const vp = (id) => document.getElementById(id);
        if (vp('inp-peri-enabled')) node.periEnabled = vp('inp-peri-enabled').checked;
        if (vp('inp-df-enabled')) node.dfEnabled = vp('inp-df-enabled').checked;
        if (vp('inp-blink-enabled')) node.blinkEnabled = vp('inp-blink-enabled').checked;

        // === АНИМАЦИЯ (ЖС) ===
        const dyn = node.params.stimulusDynamic;
        if (!Array.isArray(dyn.frames) || dyn.frames.length === 0) {
            dyn.frames = [{ lifecycle: { delay1: 0, duration: 5, responseTime: 0, delay2: 0 }, stim: {}, bg: {}, repeats: 1, step: 0.1, mode: 'smooth' }];
        }
        const fr = dyn.frames[0];
        if (!fr.stim) fr.stim = {};
        if (!fr.bg) fr.bg = {};
        if (v('dyn-mode')) fr.mode = v('dyn-mode').value;
        if (v('dyn-step')) fr.step = parseFloat(v('dyn-step').value) || 0.1;
        if (v('dyn-stim-start')) fr.stim.startD = Math.max(0, Math.min(2, parseFloat(v('dyn-stim-start').value) || 0));
        if (v('dyn-stim-end')) fr.stim.endD = Math.max(0, Math.min(2, parseFloat(v('dyn-stim-end').value) || 0));
        if (v('dyn-stim-bright-start')) fr.stim.startBright = Math.max(0, Math.min(100, parseFloat(v('dyn-stim-bright-start').value) || 100));
        if (v('dyn-stim-bright-end')) fr.stim.endBright = Math.max(0, Math.min(100, parseFloat(v('dyn-stim-bright-end').value) || 100));
        if (v('dyn-bg-start')) fr.bg.startD = Math.max(0, Math.min(2, parseFloat(v('dyn-bg-start').value) || 0));
        if (v('dyn-bg-end')) fr.bg.endD = Math.max(0, Math.min(2, parseFloat(v('dyn-bg-end').value) || 0));
        if (v('dyn-bg-bright-start')) fr.bg.startBright = Math.max(0, Math.min(100, parseFloat(v('dyn-bg-bright-start').value) || 100));
        if (v('dyn-bg-bright-end')) fr.bg.endBright = Math.max(0, Math.min(100, parseFloat(v('dyn-bg-bright-end').value) || 100));
        dyn.framesCount = dyn.frames.length;
    }

    window.AppInspector = {
        updateInspector, renderInspectorGridPreview,
        updateStimulusInspector, updateLogicInspector,
        updateCompareInspector, updateReadingInspector,
        initInspectorEvents, applyInspectorChanges, applyStimulusInspectorChanges
    };

    const observer = new MutationObserver(() => {
        const cb = document.getElementById('inp-active');
        if (cb) {
            const lbl = cb.closest('label');
            if (lbl && lbl.style.display === 'none') {
                lbl.style.setProperty('display', 'block', 'important');
            }
        }
    });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] }));
    } else {
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    }

    VLog.log('[app-inspector] AppInspector экспортирован (нижняя кнопка)');
})();