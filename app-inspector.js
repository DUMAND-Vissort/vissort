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
        html += `<label>PPI</label><input type="number" id="inp-ppi" value="${node.stimPPI || state.screenPPI || 96}" min="20" max="1200" step="1">`;
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

        // --- СЦЕНАРИЙ ---
        html += '<div class="panel-section" style="background:#0a1a10;border-color:#22c55e;">';
        html += '<h3 style="color:#4ade80;border-color:#22c55e;">📈 Сценарий</h3>';
        html += `<label>Серий всего</label><input type="number" id="inp-series-count" value="${node.seriesCount || 10}" min="1" max="50"></div>`;

        html += '</div>'; // конец insp-cols

        // НИЖНЯЯ КНОПКА ПРИМЕНИТЬ
        html += '<button class="btn btn-success" id="inp-apply" style="width:100%;margin-top:6px; padding:8px;">💾 Применить</button>';

        inspectorEl.innerHTML = html;

        // === ВЫЗОВ РЕДАКТОРА ЖИВОГО СТИМУЛА ===
        if (window.AppStimulusEditor) {
            if (!node.params) node.params = {};
            if (!node.params.stimulusDynamic) {
                node.params.stimulusDynamic = { active: true, framesCount: 1, frames: [] };
            }
            window.AppStimulusEditor.render(node, inspectorEl);
        }

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
        html += `<label><input type="checkbox" id="inp-active" ${node.isActive !== false ? 'checked' : ''}> Активный узел</label></div>`;
        inspectorEl.innerHTML = html;
    }

    // ==================== ИНСПЕКТОР: ЧТЕНИЕ ====================
    function updateReadingInspector(node) {
        inspectorEl.innerHTML = '<h2>Инспектор</h2><p>Чтение (в разработке)</p>';
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
        if (v('inp-name')) node.name = v('inp-name').value;
        if (v('inp-type')) node.stimType = v('inp-type').value;
        if (v('inp-active')) node.isActive = v('inp-active').checked;
        if (v('inp-acuity')) node.stimAcuity = parseFloat(v('inp-acuity').value) || 1.0;
        if (v('inp-end-acuity')) node.endAcuity = parseFloat(v('inp-end-acuity').value) || node.stimAcuity;
        if (v('inp-acuity-step')) node.acuityStep = parseFloat(v('inp-acuity-step').value) || 0.1;
        if (v('inp-distance')) node.stimDistance = parseFloat(v('inp-distance').value) || 1;
        if (v('inp-ppi')) node.stimPPI = parseInt(v('inp-ppi').value) || state.screenPPI || 96;
        if (v('inp-series-count')) node.seriesCount = Math.max(1, parseInt(v('inp-series-count').value) || 10);
        if (v('inp-adaptive-acuity')) node.adaptiveAcuity = v('inp-adaptive-acuity').checked;
        if (v('inp-series-size')) node.seriesSize = Math.max(1, parseInt(v('inp-series-size').value) || 6);
        if (v('inp-series-threshold')) node.seriesThreshold = Math.max(1, parseInt(v('inp-series-threshold').value) || 4);
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