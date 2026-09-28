// ============================================================
// vissort-ai-generator.js
// Генератор сценариев через DeepSeek (Supabase Edge Function).
// Требует: app-editor-core.js (AppEditorCore)
// ============================================================
(function installAIGenerator() {
    'use strict';

    const SUPABASE_URL = 'https://hzvypwdpdhsjzaclxmbm.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6dnlwd2RwZGhzanphY2x4bWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjIyNTIsImV4cCI6MjEwNDE5ODI1Mn0.HK0VE9KdzS8c7WoMCIlvOUn02vSOQEN0ahGPgsYzKac';
    const FN_URL = SUPABASE_URL + '/functions/v1/generate-scenario';

    const $ = (id) => document.getElementById(id);

    function buildPrompt(p) {
        const parts = [];
        parts.push('Создай сценарий тренировки зрения в формате JSON.');
        parts.push('');
        parts.push('Параметры:');
        parts.push('- Цель: ' + (p.goal || 'общая тренировка'));
        parts.push('- Кому: ' + (p.target || 'взрослый'));
        if (p.duration) parts.push('- Общее время: ' + p.duration + ' минут');
        parts.push('- Острота V: от ' + p.startAcuity + ' до ' + p.endAcuity);
        parts.push('- Количество узлов: ' + p.nodeCount);
        parts.push('- Типы узлов: ' + p.types.join(', '));
        parts.push('');
        parts.push('Формат ответа — ТОЛЬКО JSON, без пояснений:');
        parts.push('{');
        parts.push('  "name": "короткое название сценария",');
        parts.push('  "description": "для кого и зачем",');
        parts.push('  "nodes": [');
        parts.push('    { "nodeType": "STIMULUS", "name": "...", "stimAcuity": 0.5, "endAcuity": 0.7, "stimType": "LETTER_E", "seriesCount": 5, "seriesSize": 6 },');
        parts.push('    { "nodeType": "READING", "name": "...", "readingAcuity": 0.8, "duration": 60000 },');
        parts.push('    { "nodeType": "COMPARE", "name": "...", "compareMode": "direction", "gridX": 3, "gridY": 3, "seriesCount": 5, "seriesSize": 6 }');
        parts.push('  ]');
        parts.push('}');
        parts.push('');
        parts.push('Правила:');
        parts.push('- V растёт от узла к узлу (от ' + p.startAcuity + ' до ' + p.endAcuity + ')');
        parts.push('- STIMULUS: stimType LETTER_E или LANDOLT, seriesCount 3-8, seriesSize 4-8');
        parts.push('- READING: duration 30000-120000 мс');
        parts.push('- COMPARE: compareMode direction или find_same, gridX 2-5, gridY 2-5');
        parts.push('- Всего ' + p.nodeCount + ' узлов');
        return parts.join('\n');
    }

    async function callGenerate(prompt) {
        const res = await fetch(FN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ prompt })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 200));
        }
        return await res.json();
    }

    function mapNodeType(t) {
        if (t === 'READING') return 'READING';
        if (t === 'COMPARE') return 'COMPARE';
        return 'STIMULUS';
    }

    function createNodesFromAI(data) {
        if (!data || !Array.isArray(data.nodes)) {
            throw new Error('Нет поля nodes в ответе');
        }
        const Editor = window.AppEditorCore;
        if (!Editor) throw new Error('AppEditorCore не загружен');

        const S = Editor.state;
        const startX = 100;
        const startY = 200;
        const stepX = 400;
        const created = [];

        data.nodes.forEach((n, i) => {
            const type = mapNodeType(n.nodeType || 'STIMULUS');
            const id = Editor.createNewNode(type, startX + i * stepX, startY);
            const node = Editor.getNode(id);

            node.name = n.name || (type === 'READING' ? 'Чтение' : type === 'COMPARE' ? 'Сравнение' : 'Стимул');

            if (type === 'STIMULUS') {
                node.stimAcuity = Number(n.stimAcuity) || 1.0;
                node.endAcuity = Number(n.endAcuity) || node.stimAcuity;
                node.stimType = n.stimType === 'LANDOLT' ? 'LANDOLT' : 'LETTER_E';
                node.seriesCount = Math.max(1, Math.min(50, parseInt(n.seriesCount) || 5));
                node.seriesSize = Math.max(1, Math.min(20, parseInt(n.seriesSize) || 6));
                node.seriesThreshold = Math.max(1, Math.min(20, parseInt(n.seriesThreshold) || 4));
                node.duration = 1000;
            } else if (type === 'READING') {
                node.readingAcuity = Number(n.readingAcuity) || 1.0;
                node.duration = Math.max(1000, Math.min(600000, parseInt(n.duration) || 60000));
            } else if (type === 'COMPARE') {
                node.compareMode = n.compareMode === 'find_same' ? 'find_same' : 'direction';
                node.gridX = Math.max(2, Math.min(6, parseInt(n.gridX) || 3));
                node.gridY = Math.max(1, Math.min(6, parseInt(n.gridY) || 3));
                node.seriesCount = Math.max(1, Math.min(50, parseInt(n.seriesCount) || 5));
                node.seriesSize = Math.max(1, Math.min(20, parseInt(n.seriesSize) || 6));
                node.seriesThreshold = Math.max(1, Math.min(20, parseInt(n.seriesThreshold) || 4));
                node.activeCells = [
                    { row: 0, col: 0 },
                    { row: 0, col: Math.min(1, node.gridX - 1) }
                ];
                node.cellParams = [
                    Editor.defaultCompareCellParams(),
                    Editor.defaultCompareCellParams()
                ];
            }

            created.push(id);
        });

        // Соединяем линейной цепочкой
        for (let i = 0; i < created.length - 1; i++) {
            S.connections.push({
                fromId: created[i],
                toId: created[i + 1],
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

        // Старт — первый узел
        if (created.length > 0) {
            const first = Editor.getNode(created[0]);
            if (first) first.isStart = true;
            S.activeNodeId = created[0];
        }

        Editor.requestRenderGraph();
        if (window.AppEditor && typeof window.AppEditor.updateInspector === 'function') {
            window.AppEditor.updateInspector();
        }

        return created.length;
    }

    // ============================================================
    // UI
    // ============================================================
    function openModal() {
        const m = $('ai-generator-modal');
        if (m) { m.style.display = 'flex'; return; }
        console.warn('[ai-gen] модалка не найдена');
    }

    async function generate() {
        const btn = $('ai-gen-submit');
        const status = $('ai-gen-status');

        const p = {
            goal: ($('ai-gen-goal')?.value || '').trim(),
            target: ($('ai-gen-target')?.value || '').trim(),
            duration: parseInt($('ai-gen-duration')?.value) || 10,
            startAcuity: parseFloat($('ai-gen-v-start')?.value) || 0.5,
            endAcuity: parseFloat($('ai-gen-v-end')?.value) || 2.0,
            nodeCount: Math.max(1, Math.min(15, parseInt($('ai-gen-count')?.value) || 5)),
            types: []
        };

        ['STIMULUS', 'READING', 'COMPARE'].forEach(t => {
            const cb = $('ai-gen-type-' + t.toLowerCase());
            if (cb && cb.checked) p.types.push(t);
        });
        if (p.types.length === 0) p.types.push('STIMULUS');

        const prompt = buildPrompt(p);

        btn.disabled = true;
        status.textContent = '⏳ Генерация…';
        status.style.color = '#f59e0b';

        try {
            const res = await callGenerate(prompt);
            if (!res.ok) {
                throw new Error(res.error + (res.details ? ' — ' + res.details : ''));
            }
            const count = createNodesFromAI(res.data);
            status.textContent = '✅ Создано ' + count + ' узлов';
            status.style.color = '#22c55e';

            setTimeout(() => {
                $('ai-generator-modal').style.display = 'none';
                status.textContent = '';
            }, 800);
        } catch (e) {
            console.error('[ai-gen]', e);
            status.textContent = '❌ ' + e.message;
            status.style.color = '#ef4444';
        } finally {
            btn.disabled = false;
        }
    }

    function bind() {
        const btnOpen = $('btn-ai-generator');
        if (btnOpen) btnOpen.addEventListener('click', openModal);
        const btnCancel = $('ai-gen-cancel');
        if (btnCancel) btnCancel.addEventListener('click', () => {
            $('ai-generator-modal').style.display = 'none';
        });
        const btnSubmit = $('ai-gen-submit');
        if (btnSubmit) btnSubmit.addEventListener('click', generate);
    }

    window.AIGenerator = { openModal, generate, buildPrompt, createNodesFromAI };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }

    console.log('[ai-gen] модуль установлен');
})();