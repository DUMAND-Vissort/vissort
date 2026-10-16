// ==================== APP-EDITOR.JS ====================
// Редактор графа: узлы, связи, рендер, drag/resize, меню связи.
// Вынесено из app.js (§A2-v3, Фаза 5).
// Зависит: VLog, VissortDialog, AppState, VissortCore, window.__vissort_zoom.
// Экспорт: window.AppEditor
// ==================== ==================== ====================
(function () {
    'use strict';

    const VLog = window.VLog || { log() {}, warn() {}, error() {} };
    const VissortDialog = window.VissortDialog;
    const state = window.AppState;
    const { acuityToSizeMm, acuityToSizePx, getStimulusSVG } = window.VissortCore;

    // DOM-элементы (те же id, что в app.js)
    const canvas = document.getElementById('canvas');
    const inspectorEl = document.getElementById('inspector');

    // ==================== SIZE HELPERS ====================
    function getNodeComputedSizeMm(node) {
        return acuityToSizeMm(
            node.stimAcuity || 1.0,
            node.stimDistance || state.trainingNode?.params?.distanceMeters || 1
        );
    }
    function getNodeComputedSize(node) {
        return acuityToSizePx(
            node.stimAcuity || 1.0,
            node.stimDistance || state.trainingNode?.params?.distanceMeters || 1,
            node.stimPPI || state.trainingNode?.params?.ppi || state.screenPPI || 96
        );
    }

    // ==================== УТИЛИТЫ ====================
    function generateId() {
        return 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    }
    function getNode(id) {
        return state.nodes.find((n) => n.id === id);
    }
    function canAddConnection(fromId, toId, isLoop) {
        if (fromId === toId) return isLoop;
        if (isLoop)
            return !state.connections.some(
                (c) =>
                    ((c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId)) &&
                    (c.isLoop || false) === true
            );
        return !state.connections.some(
            (c) => c.fromId === fromId && c.toId === toId && (c.isLoop || false) === false
        );
    }
    function buildPlayQueue() {
        state.playQueue = [];
        if (state.nodes.length === 0) return;
        const startNode = state.nodes.find((n) => n.isStart === true) || state.nodes[0];
        const visited = new Set();
        function visit(nodeId, connection = null, fromNodeId = null) {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            state.playQueue.push({ nodeId, connection, fromNodeId });
            state.connections
                .filter((c) => c.fromId === nodeId && c.isLoop && c.toId !== nodeId)
                .forEach((loop) => {
                    const lim = loop.loopLimit || 1;
                    for (let i = 0; i < lim; i++) {
                        state.playQueue.push({ nodeId: loop.toId, connection: loop, fromNodeId: nodeId });
                        state.playQueue.push({ nodeId: nodeId, connection: loop, fromNodeId: loop.toId });
                    }
                });
            state.connections
                .filter((c) => c.fromId === nodeId && !c.isLoop && c.toId !== nodeId)
                .forEach((conn) => visit(conn.toId, conn, nodeId));
        }
        visit(startNode.id, null, null);
    }
    // ==================== КНИГИ / ЧТЕНИЕ ====================
    function nodeToReadingParams(node) {
        return {
            bgMode: node.readingBgMode || 'solid',
            bgColor: node.readingBgColor || { r: 255, g: 255, b: 255 },
            splitLeftWidthPercent: node.readingSplitLeftWidthPercent ?? 50,
            splitLeftColor: node.readingSplitLeftColor || { r: 0, g: 0, b: 0 },
            splitRightColor: node.readingSplitRightColor || { r: 255, g: 255, b: 255 },
            gradientMidEnabled: node.readingGradientMidEnabled !== false,
            gradientLeftColor: node.readingGradientLeftColor || { r: 255, g: 255, b: 255 },
            gradientMidColor: node.readingGradientMidColor || { r: 204, g: 204, b: 204 },
            gradientMidPosition: node.readingGradientMidPosition ?? 50,
            gradientRightColor: node.readingGradientRightColor || { r: 0, g: 0, b: 0 },
            dynamicMode: node.readingDynamicMode || 'simple',
            dynamicReverse: node.readingDynamicReverse === true,
            dynamicMidEnabled: node.readingDynamicMidEnabled === true,
            dynamicStartColor: node.readingDynamicStartColor || { r: 255, g: 0, b: 0 },
            dynamicMidColor: node.readingDynamicMidColor || { r: 255, g: 255, b: 0 },
            dynamicEndColor: node.readingDynamicEndColor || { r: 0, g: 0, b: 255 },
            dynamicDuration: node.readingDynamicDuration || 10000,
            dynamicLoop: node.readingDynamicLoop === true,
            dynamicStep: node.readingDynamicStep || 0.1,
            dynamicStepDuration: node.readingDynamicStepDuration || 1000,
            dynamicShowLabel: node.readingDynamicShowLabel !== false
        };
    }

    // ==================== СОЗДАНИЕ УЗЛА ====================
    function defaultCompareCellParams() {
        const d = state.trainingNode?.params?.distanceMeters || state.generalDistance || 1;
        const ppi = state.trainingNode?.params?.ppi || state.screenPPI || 96;
        return {
            size: acuityToSizePx(1.0, d, ppi),
            acuity: 1.0,
            distance: d,
            ppi,
            stimR: 255,
            stimG: 255,
            stimB: 255,
            bgR: 0,
            bgG: 0,
            bgB: 0,
            duration: 2000
        };
    }
    function createNewNode(type, x, y) {
        const id = generateId();
        const dd = state.trainingNode?.params?.distanceMeters || state.generalDistance || 1;
        const dp = state.trainingNode?.params?.ppi || state.screenPPI || 96;
        let node;
        if (type === 'READING') {
            node = {
                id,
                nodeType: 'READING',
                x: x || 100 + Math.random() * 300,
                y: y || 100 + Math.random() * 200,
                width: 200,
                height: 180,
                name: 'Чтение',
                bookId: null,
                bookName: '',
                continueFromBookmark: true,
                autoSaveBookmark: true,
                readingFontFamily: 'Segoe UI',
                readingFontWeight: 'normal',
                readingAcuity: 1.0,
                readingDistance: state.readingDistance || 1,
                readingPPI: state.screenPPI || 96,
                readingTextColor: { r: 0, g: 0, b: 0 },
                readingBgMode: 'solid',
                readingBgColor: { r: 255, g: 255, b: 255 },
                readingSplitLeftWidthPercent: 50,
                readingSplitLeftColor: { r: 0, g: 0, b: 0 },
                readingSplitRightColor: { r: 255, g: 255, b: 255 },
                readingGradientMidEnabled: true,
                readingGradientLeftColor: { r: 255, g: 255, b: 255 },
                readingGradientMidColor: { r: 204, g: 204, b: 204 },
                readingGradientMidPosition: 50,
                readingGradientRightColor: { r: 0, g: 0, b: 0 },
                readingDynamicMode: 'simple',
                readingDynamicReverse: false,
                readingDynamicMidEnabled: false,
                readingDynamicStartColor: { r: 255, g: 0, b: 0 },
                readingDynamicMidColor: { r: 255, g: 255, b: 0 },
                readingDynamicEndColor: { r: 0, g: 0, b: 255 },
                readingDynamicDuration: 10000,
                readingDynamicLoop: false,
                readingDynamicStep: 0.1,
                readingDynamicStepDuration: 1000,
                readingDynamicShowLabel: true,
                duration: 60000,
                isActive: true,
                isStart: false
            };
        } else if (type === 'COMPARE') {
            node = {
                id,
                nodeType: 'COMPARE',
                x: x || 100 + Math.random() * 300,
                y: y || 100 + Math.random() * 200,
                width: 200,
                height: 180,
                name: 'Сравнение',
                compareMode: 'direction',
                pairsCount: 2,
                gridX: 3,
                gridY: 3,
                activeCells: [
                    { row: 0, col: 0 },
                    { row: 0, col: 1 }
                ],
                cellParams: [defaultCompareCellParams(), defaultCompareCellParams()],
                seriesCount: 10,
                seriesSize: 6,
                seriesThreshold: 4,
                adaptiveAcuity: true,
                delay1: 1000,
                duration: 2000,
                delay2: 1000,
                isActive: true,
                isStart: false
            };
        } else {
            node = {
                id,
                nodeType: type,
                x: x || 100 + Math.random() * 300,
                y: y || 100 + Math.random() * 200,
                width: 200,
                height: 180,
                name: type === 'STIMULUS' ? 'Стимул' : type === 'LOGIC_IF' ? 'Логика' : 'Динамика',
                stimType: 'LETTER_E',
                stimDirection: 'вверх',
                stimR: 255,
                stimG: 255,
                stimB: 255,
                bgR: 11,
                bgG: 11,
                bgB: 13,
                stimAcuity: 0.5,
                endAcuity: 1.0,
                acuityStep: 0.1,
                stimDistance: dd,
                stimPPI: dp,
                stimSize: 40,
                stimDirectionFixed: 'вверх',
                seriesCount: 10,
                seriesSize: 6,
                seriesThreshold: 4,
                adaptiveAcuity: true,
                isActive: true,
                singleRandomPos: false,
                singleGridEnabled: false,
                singleGridX: 3,
                singleGridY: 3,
                singleGridShowLines: false,
                singleGridRandomCell: true,
                singleGridAvoidRepeat: true,
                singleGridFixedRow: 0,
                singleGridFixedCol: 0,
                singleGridCells: [],
                singleStimDynamicEnabled: false,
                singleStimColor1: { r: 255, g: 0, b: 0 },
                singleStimMidEnabled: false,
                singleStimColor3: { r: 255, g: 255, b: 0 },
                singleStimColor2: { r: 0, g: 0, b: 255 },
                singleStimDuration: 10000,
                singleStimLoop: false,
                singleStimReverse: false,
                singleBgDynamicEnabled: false,
                singleBgColor1: { r: 255, g: 0, b: 0 },
                singleBgMidEnabled: false,
                singleBgColor3: { r: 255, g: 255, b: 0 },
                singleBgColor2: { r: 0, g: 0, b: 255 },
                singleBgDuration: 10000,
                singleBgLoop: false,
                singleBgReverse: false,
                singleCircleEnabled: false,
                circleInnerEnabled: true,
                circleInnerRadiusPct: 40,
                circleInnerColor1: { r: 255, g: 0, b: 0 },
                circleInnerMidEnabled: false,
                circleInnerColor3: { r: 255, g: 255, b: 0 },
                circleInnerColor2: { r: 0, g: 0, b: 255 },
                circleInnerDuration: 10000,
                circleInnerLoop: true,
                circleInnerReverse: false,
                circleOuterEnabled: true,
                circleOuterColor1: { r: 0, g: 255, b: 0 },
                circleOuterMidEnabled: false,
                circleOuterColor3: { r: 0, g: 255, b: 255 },
                circleOuterColor2: { r: 0, g: 128, b: 255 },
                circleOuterDuration: 10000,
                circleOuterLoop: true,
                circleOuterReverse: false,
                periEnabled: false,
                periCount: 4,
                periAcuity: 0.3,
                periRadiusMinPct: 60,
                periRadiusMaxPct: 90,
                periColor: { r: 0, g: 255, b: 100 },
                periMotion: 'static',
                periSpeed: 0.3,
                periRandomAngles: true,
                dfEnabled: false,
                dfCenterRadiusMm: 13,
                dfCenterBg: { r: 204, g: 0, b: 0 },
                dfStimColor: { r: 0, g: 0, b: 0 },
                dfPeriBg: { r: 0, g: 71, b: 171 },
                dfPeriBlur: 0,
                blinkEnabled: false,
                blinkColorA: { r: 255, g: 0, b: 0 },
                blinkColorB: { r: 0, g: 0, b: 255 },
                blinkIntervalMs: 500,
                blinkDuty: 0.5,
                blinkCount: 0,
                blinkTarget: 'stim',
                delay1: 1000,
                duration: 1000,
                response: 1000,
                delay2: 1000,
                isStart: false
            };
            node.stimSize = getNodeComputedSize(node);
        }
        state.nodes.push(node);
        state.activeNodeId = id;
        window._pendingGeneratorMode = false;
        requestRenderGraph();
        window.updateInspector();
        inspectorEl.style.display = 'block';
        return id;
    }
    // ==================== УДАЛЕНИЕ / ВЫБОР ====================
    function deleteNode(id) {
        state.nodes = state.nodes.filter((n) => n.id !== id);
        state.connections = state.connections.filter((c) => c.fromId !== id && c.toId !== id);
        if (state.activeNodeId === id) {
            state.activeNodeId = null;
            inspectorEl.style.display = 'none';
            window.updateInspector();
        }
        if (state.nodeElements.has(id)) {
            state.nodeElements.get(id).remove();
            state.nodeElements.delete(id);
        }
        for (const [k, els] of state.connectionElements)
            if (k.startsWith(id + '_') || k.endsWith('_' + id) || k === id + '_' + id) {
                els.line.remove();
                els.arrow.remove();
                state.connectionElements.delete(k);
            }
        if (window._pendingConnectionHandler) {
            canvas.removeEventListener('click', window._pendingConnectionHandler);
            window._pendingConnectionHandler = null;
            clearTempLine();
        }
        requestRenderGraph();
    }
    function selectNode(id) {
        state.activeNodeId = id;
        window._pendingGeneratorMode = false;
        inspectorEl.style.display = 'block';
        requestRenderGraph();
        window.updateInspector();
    }

    // ==================== РЕНДЕР ГРАФА ====================
    function requestRenderGraph() {
        if (state.renderScheduled) return;
        state.renderScheduled = true;
        requestAnimationFrame(() => {
            state.renderScheduled = false;
            renderGraph();
        });
    }
    function renderGraph() {
        if (state.currentMode === 'stimuli') return;
        state.nodes.forEach((node) => {
            let el = state.nodeElements.get(node.id);
            if (!el) {
                el = createNodeElement(node);
                state.nodeElements.set(node.id, el);
                canvas.appendChild(el);
            } else updateNodeElement(el, node);
        });
        const ids = new Set(state.nodes.map((n) => n.id));
        for (const [id, el] of state.nodeElements)
            if (!ids.has(id)) {
                el.remove();
                state.nodeElements.delete(id);
            }
        const cm = new Map();
        state.connections.forEach((c) => cm.set(c.fromId + '_' + c.toId, c));
        for (const [k, els] of state.connectionElements)
            if (!cm.has(k)) {
                els.line.remove();
                els.arrow.remove();
                state.connectionElements.delete(k);
            }
        state.connections.forEach((c) => {
            const k = c.fromId + '_' + c.toId;
            if (!state.connectionElements.has(k)) {
                const { line, arrow } = createConnectionElements(c);
                if (line && arrow) {
                    state.connectionElements.set(k, { line, arrow });
                    canvas.appendChild(line);
                    canvas.appendChild(arrow);
                }
            } else updateConnectionElements(state.connectionElements.get(k), c);
        });
    }
    function clearTempLine() {
        if (state.tempLineElement) {
            state.tempLineElement.remove();
            state.tempLineElement = null;
        }
        if (state.tempLineMoveHandler) {
            canvas.removeEventListener('mousemove', state.tempLineMoveHandler);
            state.tempLineMoveHandler = null;
        }
    }
    // ==================== РЕНДЕР УЗЛА ====================
    function createNodeElement(node) {
        const el = document.createElement('div');
        el.className = 'scenario-node';
        if (node.nodeType === 'READING') el.classList.add('reading-node');
        if (node.nodeType === 'COMPARE') el.classList.add('compare-node');
        el.dataset.nodeId = node.id;
        el.style.cssText = `left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;`;
        if (node.id === state.activeNodeId) el.classList.add('active');
        const header = document.createElement('div');
        header.className = 'node-header';
        if (node.nodeType === 'READING') header.classList.add('reading-header');
        if (node.nodeType === 'COMPARE') header.classList.add('compare-header');
        const title = document.createElement('span');
        title.textContent = node.name;
        const startCb = document.createElement('input');
        startCb.type = 'checkbox';
        startCb.className = 'start-checkbox';
        startCb.checked = node.isStart === true;
        startCb.addEventListener('change', (e) => {
            e.stopPropagation();
            if (startCb.checked) {
                state.nodes.forEach((n) => {
                    if (n.id !== node.id) n.isStart = false;
                });
                node.isStart = true;
            } else node.isStart = false;
            requestRenderGraph();
            window.updateInspector();
        });
        header.appendChild(title);
        header.appendChild(startCb);
        el.appendChild(header);
        const content = document.createElement('div');
        content.className = 'node-content';
        if (node.nodeType === 'READING') {
            const p = document.createElement('div');
            p.className = 'node-preview-area';
            p.style.background = '#0b0b14';
            p.innerHTML = '<div style="text-align:center;"><div class="node-reading-icon">📖</div></div>';
            content.appendChild(p);
            const info = document.createElement('div');
            info.className = 'node-info';
            const b = document.createElement('div');
            b.className = 'node-reading-book';
            info.appendChild(b);
            const d = document.createElement('div');
            d.className = 'node-reading-sub';
            info.appendChild(d);
            const v = document.createElement('div');
            v.className = 'node-reading-sub';
            info.appendChild(v);
            const f = document.createElement('div');
            f.className = 'node-reading-sub';
            info.appendChild(f);
            content.appendChild(info);
            fillReadingNodeInfo(b, d, v, f, node);
        } else if (node.nodeType === 'COMPARE') {
            const p = document.createElement('div');
            p.className = 'node-preview-area';
            p.style.background = '#1a0a02';
            p.innerHTML = '<div class="node-compare-icon">⚖️</div>';
            content.appendChild(p);
            const info = document.createElement('div');
            info.className = 'node-info';
            const m = document.createElement('div');
            m.className = 'node-compare-sub';
            info.appendChild(m);
            const g = document.createElement('div');
            g.className = 'node-compare-sub';
            info.appendChild(g);
            const s = document.createElement('div');
            s.className = 'node-compare-sub';
            info.appendChild(s);
            const t = document.createElement('div');
            t.className = 'node-compare-sub';
            info.appendChild(t);
            content.appendChild(info);
            fillCompareNodeInfo(m, g, s, t, node);
        } else {
            const p = document.createElement('div');
            p.className = 'node-preview-area';
            const cs = Math.min(120, getNodeComputedSize(node));
            const { html, bgColor } = getStimulusSVG(node, cs);
            p.style.background = bgColor;
            const c = document.createElement('div');
            c.style.cssText = `width:${cs}px;height:${cs}px;margin:0 auto;`;
            c.innerHTML = html;
            p.appendChild(c);
            content.appendChild(p);
            const info = document.createElement('div');
            info.className = 'node-info';
            const a = document.createElement('div');
            a.className = 'node-acuity';
            info.appendChild(a);
            const mm = document.createElement('div');
            mm.className = 'node-size-mm';
            info.appendChild(mm);
            const px = document.createElement('div');
            px.className = 'node-size-px';
            info.appendChild(px);
            const dst = document.createElement('div');
            dst.className = 'node-distance';
            info.appendChild(dst);
            const srs = document.createElement('div');
            srs.className = 'node-inherit';
            srs.style.color = '#a855f7';
            info.appendChild(srs);
            const dyn = document.createElement('div');
            dyn.className = 'node-inherit';
            dyn.style.color = '#f59e0b';
            info.appendChild(dyn);
            content.appendChild(info);
            fillStimulusNodeInfo(a, mm, px, dst, srs, dyn, node);
        }
        el.appendChild(content);
        const body = document.createElement('div');
        body.className = 'node-body';
        const cb = document.createElement('button');
        cb.className = 'node-btn btn-node-connect';
        cb.textContent = '🔗 Связать';
        cb.addEventListener('click', (e) => {
            e.stopPropagation();
            startConnection(node.id, false);
        });
        const lb = document.createElement('button');
        lb.className = 'node-btn btn-node-loop';
        lb.textContent = '🔄 Петля';
        lb.addEventListener('click', (e) => {
            e.stopPropagation();
            startConnection(node.id, true);
        });
        const tb = document.createElement('button');
        tb.className = 'node-btn';
        tb.style.background = '#0ea5e9';
        tb.textContent = '💾 В заготовки';
        tb.title = 'Сохранить этот узел как заготовку';
        tb.addEventListener('click', (e) => {
            e.stopPropagation();
            window.saveNodeAsTemplate(node.id);
        });
        const db = document.createElement('button');
        db.className = 'node-btn btn-node-del';
        db.textContent = '✕ Удалить';
        db.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNode(node.id);
        });
        body.appendChild(cb);
        body.appendChild(lb);
        body.appendChild(tb);
        body.appendChild(db);
        el.appendChild(body);
        const resize = document.createElement('div');
        resize.className = 'node-resize-handle';
        el.appendChild(resize);
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || window._pendingConnectionHandler) return;
            if (
                e.target.closest('.node-btn') ||
                e.target.closest('.start-checkbox') ||
                e.target.closest('.node-resize-handle')
            )
                return;
            state.dragNodeId = node.id;
            const r = canvas.getBoundingClientRect();
            const _zoomA = window.__vissort_zoom || 1;
            state.offsetX = (e.clientX - r.left) / _zoomA - node.x;
            state.offsetY = (e.clientY - r.top) / _zoomA - node.y;
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
            document.addEventListener('mousemove', onDragMove);
            document.addEventListener('mouseup', onDragEnd);
        });
        resize.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            state.resizeNodeId = node.id;
            state.startW = node.width;
            state.startH = node.height;
            state.startMouseX = e.clientX;
            state.startMouseY = e.clientY;
            document.removeEventListener('mousemove', onResizeMove);
            document.removeEventListener('mouseup', onResizeEnd);
            document.addEventListener('mousemove', onResizeMove);
            document.addEventListener('mouseup', onResizeEnd);
        });
        el.addEventListener('click', (e) => {
            if (window._pendingConnectionHandler) return;
            if (
                e.target.closest('.node-btn') ||
                e.target.closest('.start-checkbox') ||
                e.target.closest('.node-resize-handle')
            )
                return;
            state.activeNodeId = node.id;
            window._pendingGeneratorMode = false;
            requestRenderGraph();
            if (inspectorEl.style.display === 'block') window.updateInspector();
        });
        el.addEventListener('dblclick', (e) => {
            if (window._pendingConnectionHandler) return;
            if (
                e.target.closest('.node-btn') ||
                e.target.closest('.start-checkbox') ||
                e.target.closest('.node-resize-handle')
            )
                return;
            selectNode(node.id);
        });
        return el;
    }
    // ==================== ИНФО О УЗЛЕ ====================
    function fillReadingNodeInfo(b, d, v, f, node) {
        if (b) {
            if (node.bookId && window._books[node.bookId]) {
                b.textContent = `📖 ${node.bookName || '(без имени)'}`;
                b.style.color = '#7dd3fc';
            } else if (node.bookName) {
                b.textContent = `📖 ${node.bookName} ⚠`;
                b.style.color = '#f59e0b';
            } else {
                b.textContent = '📖 книга из сессии';
                b.style.color = '#94a3b8';
            }
        }
        if (d) {
            d.textContent = node.duration > 0 ? `⏱ ${(node.duration / 1000).toFixed(0)} с` : '⏱ до кнопки';
            d.style.color = '#64748b';
        }
        if (v) {
            v.textContent = `V = ${(node.readingAcuity || 1.0).toFixed(1)}`;
            v.style.color = '#64748b';
        }
        if (f) {
            f.textContent = node.readingFontFamily || 'Segoe UI';
            f.style.color = '#64748b';
        }
    }
    function fillStimulusNodeInfo(a, mm, px, dst, srs, dyn, node) {
        if (a) {
            a.textContent = `V = ${(node.stimAcuity || 1.0).toFixed(1)}`;
            if (node.endAcuity != null && Math.abs(node.endAcuity - node.stimAcuity) > 0.001)
                a.textContent += `→${node.endAcuity.toFixed(1)}`;
        }
        if (mm) mm.textContent = `${getNodeComputedSizeMm(node).toFixed(2)} мм`;
        if (px)
            px.textContent = `≈ ${getNodeComputedSize(node)}px @ ${node.stimPPI || state.screenPPI || 96} PPI`;
        if (dst) dst.textContent = `📏 ${(node.stimDistance || 1).toFixed(2)} м`;
        if (srs) srs.textContent = `📊 ${node.seriesCount || 5}×${node.seriesSize || 6}`;
        if (dyn) {
            const parts = [];
            if (node.singleCircleEnabled) parts.push('🎯 Круги');
            if (node.periEnabled) parts.push('🟢 Точки');
            if (node.dfEnabled) parts.push('🔴 Дефокус');
            if (node.blinkEnabled) parts.push('🔦 Моргание');
            if (node.singleGridEnabled && !node.singleCircleEnabled) {
                const cnt =
                    Array.isArray(node.singleGridCells) && node.singleGridCells.length > 0
                        ? node.singleGridCells.length
                        : (node.singleGridX || 1) * (node.singleGridY || 1);
                parts.push(`🔲${node.singleGridX || 1}×${node.singleGridY || 1}(${cnt})`);
            }
            if (node.singleStimDynamicEnabled && !node.singleCircleEnabled) parts.push('🎨');
            if (node.singleBgDynamicEnabled) parts.push('🖼️');
            if (node.singleRandomPos && !node.singleGridEnabled && !node.singleCircleEnabled)
                parts.push('🎲');
            dyn.textContent = parts.join(' ');
        }
    }
    function fillCompareNodeInfo(m, g, s, t, node) {
        if (m) {
            m.textContent =
                node.compareMode === 'find_same'
                    ? `🔍 Найти пары ×${node.pairsCount || 2}`
                    : '↔️ Сравнить направления';
            m.style.color = '#f97316';
            m.style.fontWeight = 'bold';
        }
        if (g) {
            const n = (node.activeCells || []).length;
            g.textContent = `🔲 ${node.gridX || 3}×${node.gridY || 3} (${n} кл.)`;
        }
        if (s) s.textContent = `📊 ${node.seriesCount || 5}×${node.seriesSize || 6}`;
        if (t) t.textContent = `⏱ ${((node.duration || 0) / 1000).toFixed(1)} с`;
    }
    function updateNodeElement(el, node) {
        el.style.cssText = `left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;`;
        el.querySelector('.node-header span').textContent = node.name;
        el.classList.toggle('active', node.id === state.activeNodeId);
        el.classList.toggle('reading-node', node.nodeType === 'READING');
        el.classList.toggle('compare-node', node.nodeType === 'COMPARE');
        const sc = el.querySelector('.start-checkbox');
        if (sc) sc.checked = node.isStart === true;
        if (node.nodeType === 'READING') {
            const p = el.querySelector('.node-preview-area');
            if (p) p.style.background = '#0b0b14';
            const b = el.querySelector('.node-reading-book');
            const subs = el.querySelectorAll('.node-reading-sub');
            fillReadingNodeInfo(b, subs[0], subs[1], subs[2], node);
            return;
        }
        if (node.nodeType === 'COMPARE') {
            const subs = el.querySelectorAll('.node-compare-sub');
            fillCompareNodeInfo(subs[0], subs[1], subs[2], subs[3], node);
            return;
        }
        const cs = Math.min(120, getNodeComputedSize(node));
        const p = el.querySelector('.node-preview-area');
        if (p) {
            const { html, bgColor } = getStimulusSVG(node, cs);
            p.style.background = bgColor;
            p.innerHTML = '';
            const c = document.createElement('div');
            c.style.cssText = `width:${cs}px;height:${cs}px;margin:0 auto;`;
            c.innerHTML = html;
            p.appendChild(c);
        }
        const a = el.querySelector('.node-acuity'),
            mm = el.querySelector('.node-size-mm'),
            px = el.querySelector('.node-size-px');
        const dst = el.querySelector('.node-distance');
        const inh = el.querySelectorAll('.node-inherit');
        fillStimulusNodeInfo(a, mm, px, dst, inh[0], inh[1], node);
    }
    // ==================== СОЗДАНИЕ СВЯЗИ ====================
    function startConnection(sourceId, isLoop) {
        if (window._pendingConnectionHandler) {
            canvas.removeEventListener('click', window._pendingConnectionHandler);
            clearTempLine();
            state.nodeElements.forEach((el) => el.classList.remove('connection-source'));
        }
        const handler = (ev) => {
            if (ev.target.closest('.node-btn')) return;
            const tel = ev.target.closest('.scenario-node');
            if (!tel) {
                cancelConnection();
                return;
            }
            const tid = tel.dataset.nodeId;
            if (tid === sourceId) {
                cancelConnection();
                return;
            }
            if (canAddConnection(sourceId, tid, isLoop)) {
                state.connections.push({
                    fromId: sourceId,
                    toId: tid,
                    isLoop,
                    loopMode: 'TIME',
                    loopLimit: 1,
                    lifeTime: 0,
                    initiateByAnswer: true,
                    condition: 'none',
                    inheritSize: false,
                    inheritSpeed: false
                });
                const nc = state.connections[state.connections.length - 1];
                cancelConnection();
                setTimeout(
                    () =>
                        showConnectionMenu(
                            {
                                clientX: ev.clientX,
                                clientY: ev.clientY,
                                preventDefault: () => {},
                                stopPropagation: () => {}
                            },
                            nc
                        ),
                    100
                );
            } else {
                VissortDialog.alert('Такая связь уже существует или превышен лимит.');
                cancelConnection();
            }
        };
        window._pendingConnectionHandler = handler;
        canvas.addEventListener('click', handler);
        state.nodeElements.forEach((el) => el.classList.remove('connection-source'));
        state.nodeElements.get(sourceId)?.classList.add('connection-source');
        clearTempLine();
        state.tempLineElement = document.createElement('div');
        state.tempLineElement.id = 'temp-line';
        state.tempLineElement.style.cssText =
            'position:absolute;transform-origin:top left;z-index:4;pointer-events:none;height:0;border-top:3px dashed #f59e0b;';
        canvas.appendChild(state.tempLineElement);
        state.tempLineMoveHandler = (ev) => {
            const r = canvas.getBoundingClientRect();
            const mx = ev.clientX - r.left,
                my = ev.clientY - r.top;
            const sn = getNode(sourceId);
            if (!sn) return;
            const fx = sn.x + sn.width / 2,
                fy = sn.y + sn.height / 2;
            const dx = mx - fx,
                dy = my - fy;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ang = Math.atan2(dy, dx) * (180 / Math.PI);
            state.tempLineElement.style.width = len + 'px';
            state.tempLineElement.style.left = fx + 'px';
            state.tempLineElement.style.top = fy + 'px';
            state.tempLineElement.style.transform = `rotate(${ang}deg)`;
        };
        canvas.addEventListener('mousemove', state.tempLineMoveHandler);
        requestRenderGraph();
    }
    function cancelConnection() {
        if (window._pendingConnectionHandler) {
            canvas.removeEventListener('click', window._pendingConnectionHandler);
            window._pendingConnectionHandler = null;
        }
        clearTempLine();
        state.nodeElements.forEach((el) => el.classList.remove('connection-source'));
        requestRenderGraph();
    }
    // ==================== РЕНДЕР СВЯЗЕЙ ====================
    function getNodeEdgePoint(node, tx, ty) {
        const cx = node.x + node.width / 2,
            cy = node.y + node.height / 2;
        const dx = tx - cx,
            dy = ty - cy;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy };
        const s = Math.min(node.width / 2 / Math.abs(dx), node.height / 2 / Math.abs(dy));
        return { x: cx + dx * s, y: cy + dy * s };
    }
    function createConnectionElements(conn) {
        const fn = getNode(conn.fromId),
            tn = getNode(conn.toId);
        if (!fn || !tn) return { line: null, arrow: null };
        if (conn.fromId === conn.toId) {
            const cx = fn.x + fn.width / 2,
                cy = fn.y + fn.height / 2,
                ls = 30;
            const div = document.createElement('div');
            div.className = 'html-graph-line line-dashed';
            div.style.cssText = `left:${cx - ls / 2}px;top:${cy - ls / 2}px;width:${ls}px;height:${ls}px;border:3px dashed #a855f7;border-radius:50%;position:absolute;z-index:5;pointer-events:auto;cursor:pointer;`;
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showConnectionMenu(e, conn);
            });
            const arrow = document.createElement('div');
            arrow.className = 'line-arrow loop-arrow';
            arrow.textContent = '↻';
            arrow.style.cssText = `left:${cx + ls / 2 - 5}px;top:${cy + ls / 2 - 10}px;color:#a855f7;z-index:1000;cursor:pointer;`;
            arrow.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showConnectionMenu(e, conn);
            });
            return { line: div, arrow };
        }
        const fp = getNodeEdgePoint(fn, tn.x + tn.width / 2, tn.y + tn.height / 2);
        const tp = getNodeEdgePoint(tn, fn.x + fn.width / 2, fn.y + fn.height / 2);
        const dx = tp.x - fp.x,
            dy = tp.y - fp.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 2) return { line: null, arrow: null };
        const ang = Math.atan2(dy, dx) * (180 / Math.PI);
        const isLoop = conn.isLoop || false;
        const color = isLoop ? '#a855f7' : '#10b981';
        const line = document.createElement('div');
        line.className = 'html-graph-line ' + (isLoop ? 'line-dashed' : 'line-solid');
        if (!isLoop) line.style.background = color;
        else line.style.borderTopColor = color;
        line.style.cssText = `width:${len}px;left:${fp.x}px;top:${fp.y}px;transform:rotate(${ang}deg);pointer-events:auto;cursor:pointer;`;
        line.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showConnectionMenu(e, conn);
        });
        const ax = fp.x + (dx / len) * 35 - 10,
            ay = fp.y + (dy / len) * 35 - 10;
        const arrow = document.createElement('div');
        arrow.className = 'line-arrow' + (isLoop ? ' loop-arrow' : '');
        arrow.textContent = '▶';
        arrow.style.cssText = `left:${ax}px;top:${ay}px;color:${color};transform:rotate(${ang}deg);position:absolute;display:flex;align-items:center;justify-content:center;width:20px;height:20px;font-size:16px;z-index:1000;cursor:pointer;pointer-events:auto;`;
        arrow.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showConnectionMenu(e, conn);
        });
        return { line, arrow };
    }
    function updateConnectionElements(els, conn) {
        const fn = getNode(conn.fromId),
            tn = getNode(conn.toId);
        if (!fn || !tn) return;
        if (conn.fromId === conn.toId) {
            const cx = fn.x + fn.width / 2,
                cy = fn.y + fn.height / 2,
                ls = 30;
            els.line.style.left = cx - ls / 2 + 'px';
            els.line.style.top = cy - ls / 2 + 'px';
            els.arrow.style.left = cx + ls / 2 - 5 + 'px';
            els.arrow.style.top = cy + ls / 2 - 10 + 'px';
            return;
        }
        const fp = getNodeEdgePoint(fn, tn.x + tn.width / 2, tn.y + tn.height / 2);
        const tp = getNodeEdgePoint(tn, fn.x + fn.width / 2, fn.y + fn.height / 2);
        const dx = tp.x - fp.x,
            dy = tp.y - fp.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 2) return;
        const ang = Math.atan2(dy, dx) * (180 / Math.PI);
        const isLoop = conn.isLoop || false;
        const color = isLoop ? '#a855f7' : '#10b981';
        els.line.style.width = len + 'px';
        els.line.style.left = fp.x + 'px';
        els.line.style.top = fp.y + 'px';
        els.line.style.transform = `rotate(${ang}deg)`;
        els.arrow.style.left = fp.x + (dx / len) * 35 - 10 + 'px';
        els.arrow.style.top = fp.y + (dy / len) * 35 - 10 + 'px';
        els.arrow.style.transform = `rotate(${ang}deg)`;
        els.arrow.style.color = color;
    }
    // ==================== DRAG / RESIZE ====================
    function onDragMove(e) {
        if (!state.dragNodeId) return;
        if (e.buttons === 0) {
            onDragEnd();
            return;
        }
        const node = getNode(state.dragNodeId);
        if (node) {
            const r = canvas.getBoundingClientRect();
            const _zoomB = window.__vissort_zoom || 1;
            node.x = (e.clientX - r.left) / _zoomB - state.offsetX;
            node.y = (e.clientY - r.top) / _zoomB - state.offsetY;
            updateNodeElement(state.nodeElements.get(node.id), node);
            state.connections.forEach((c) => {
                if (c.fromId === node.id || c.toId === node.id)
                    updateConnectionElements(state.connectionElements.get(c.fromId + '_' + c.toId), c);
            });
        }
    }
    function onDragEnd() {
        state.dragNodeId = null;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
    }
    function onResizeMove(e) {
        if (!state.resizeNodeId) return;
        if (e.buttons === 0) {
            onResizeEnd();
            return;
        }
        const node = getNode(state.resizeNodeId);
        if (node) {
            const _zoomC = window.__vissort_zoom || 1;
            node.width = Math.max(200, state.startW + (e.clientX - state.startMouseX) / _zoomC);
            node.height = Math.max(180, state.startH + (e.clientY - state.startMouseY) / _zoomC);
            updateNodeElement(state.nodeElements.get(node.id), node);
            state.connections.forEach((c) => {
                if (c.fromId === node.id || c.toId === node.id)
                    updateConnectionElements(state.connectionElements.get(c.fromId + '_' + c.toId), c);
            });
        }
    }
    function onResizeEnd() {
        state.resizeNodeId = null;
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeEnd);
    }

    // ==================== МЕНЮ СВЯЗИ ====================
    function showConnectionMenu(e, conn) {
        e.preventDefault();
        e.stopPropagation();
        state.currentConnectionForMenu = conn;
        const menu = document.getElementById('connection-menu');
        menu.style.display = 'block';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.innerHTML = '';
        const title = document.createElement('div');
        title.textContent = 'Наследование';
        title.style.cssText = 'font-weight:bold;margin-bottom:4px;';
        menu.appendChild(title);
        const sL = document.createElement('label');
        sL.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:4px;';
        const sC = document.createElement('input');
        sC.type = 'checkbox';
        sC.checked = conn.inheritSize === true;
        sC.addEventListener('change', (ev) => {
            conn.inheritSize = ev.target.checked;
            requestRenderGraph();
        });
        sL.appendChild(sC);
        sL.appendChild(document.createTextNode('Острота зрения (размер)'));
        menu.appendChild(sL);
        const spL = document.createElement('label');
        spL.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:4px;';
        const spC = document.createElement('input');
        spC.type = 'checkbox';
        spC.checked = conn.inheritSpeed === true;
        spC.addEventListener('change', (ev) => {
            conn.inheritSpeed = ev.target.checked;
            requestRenderGraph();
        });
        spL.appendChild(spC);
        spL.appendChild(document.createTextNode('Скорость'));
        menu.appendChild(spL);
        const hint = document.createElement('div');
        hint.style.cssText =
            'font-size:10px;color:#94a3b8;margin-top:6px;padding-top:6px;border-top:1px solid #3f3f46;line-height:1.3;';
        hint.textContent = 'Книга в узлах чтения наследуется автоматически.';
        menu.appendChild(hint);
        if (conn.isLoop) {
            const sep = document.createElement('hr');
            sep.style.margin = '4px 0';
            menu.appendChild(sep);
            const lt = document.createElement('div');
            lt.textContent = 'Параметры петли';
            lt.style.cssText = 'font-weight:bold;margin-bottom:4px;';
            menu.appendChild(lt);
            const lcl = document.createElement('label');
            lcl.style.cssText = 'display:block;margin-bottom:4px;';
            lcl.textContent = 'Кол-во циклов';
            const lci = document.createElement('input');
            lci.type = 'number';
            lci.min = '1';
            lci.value = conn.loopLimit || 1;
            lci.style.width = '100%';
            lci.addEventListener('change', (ev) => {
                conn.loopLimit = parseInt(ev.target.value) || 1;
                requestRenderGraph();
            });
            lcl.appendChild(lci);
            menu.appendChild(lcl);
        }
        const sep2 = document.createElement('hr');
        sep2.style.margin = '4px 0';
        menu.appendChild(sep2);
        const db = document.createElement('button');
        db.className = 'btn btn-danger';
        db.style.width = '100%';
        db.textContent = '✕ Удалить связь';
        db.addEventListener('click', () => {
            state.connections = state.connections.filter((c) => c !== conn);
            hideConnectionMenu();
            requestRenderGraph();
        });
        menu.appendChild(db);
    }
    function hideConnectionMenu() {
        document.getElementById('connection-menu').style.display = 'none';
        state.currentConnectionForMenu = null;
    }
    // ==================== EXPORT ====================
    window.AppEditor = {
        generateId,
        getNode,
        getNodeComputedSize,
        getNodeComputedSizeMm,
        canAddConnection,
        buildPlayQueue,
        nodeToReadingParams,
        defaultCompareCellParams,
        createNewNode,
        deleteNode,
        selectNode,
        requestRenderGraph,
        renderGraph,
        clearTempLine,
        createNodeElement,
        updateNodeElement,
        fillReadingNodeInfo,
        fillStimulusNodeInfo,
        fillCompareNodeInfo,
        startConnection,
        cancelConnection,
        getNodeEdgePoint,
        createConnectionElements,
        updateConnectionElements,
        onDragMove,
        onDragEnd,
        onResizeMove,
        onResizeEnd,
        showConnectionMenu,
        hideConnectionMenu,
        state: {
            get nodes() {
                return state.nodes;
            },
            get connections() {
                return state.connections;
            },
            get activeNodeId() {
                return state.activeNodeId;
            }
        }
    };

    // Алиас для AI-генератора (совместимость с app.js:6309)
    window.AppEditorCore = window.AppEditor;

    VLog.log('[app-editor] AppEditor + AppEditorCore экспортированы');
})();
