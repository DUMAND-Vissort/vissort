// ============================================================
// app-player.js — Новый адаптер плеера для редактора (Фаза 3)
// Связывает AppState с PlayerCore (единый движок).
// ============================================================
(function (global) {
    'use strict';

    function startPlayer() {
        const nodes = global.AppState?.nodes || [];
        const startNode = nodes.find(n => n.isStart && n.isActive);
        if (!startNode) {
            console.warn('[app-player] Нет стартового узла (isStart = true)');
            return;
        }

        // --- ПРИНУДИТЕЛЬНЫЙ ПОКАЗ ЭКРАНА СТИМУЛА ---
        const stimDisplay = document.getElementById('stim-display');
        const stim = document.getElementById('stim');
        const canvas = document.getElementById('canvas');

        if (canvas) canvas.style.display = 'none';
        if (stimDisplay) {
            stimDisplay.style.display = 'flex';
            stimDisplay.style.position = 'fixed';
            stimDisplay.style.zIndex = '9999';
            stimDisplay.style.width = '100vw';
            stimDisplay.style.height = '100vh';
            stimDisplay.style.top = '0';
            stimDisplay.style.left = '0';
            stimDisplay.style.backgroundColor = '#000';
        }
        if (stim) {
            stim.style.display = 'flex';
            stim.style.alignItems = 'center';
            stim.style.justifyContent = 'center';
            stim.style.width = '100%';
            stim.style.height = '100%';
        }
        // ------------------------------------------

        function playSimpleStimulus(node) {
        console.log('[app-player] Обычный стимул:', node.id);
        
        // 1. Определяем направление
        let dir;
        if (node.isActive) {
            const d = ['вверх', 'вниз', 'влево', 'вправо'];
            dir = d[Math.floor(Math.random() * d.length)];
        } else {
            dir = node.stimDirectionFixed || 'вверх';
        }

        // 2. Вычисляем размер (острота зрения)
        const dist = node.stimDistance || 1;
        const ppi = node.stimPPI || 96;
        const acuity = node.stimAcuity || 1.0; // Пока берем стартовую
        const eff = global.VissortCore.acuityToSizePx(acuity, dist, ppi);

        // 3. Получаем SVG (Буква E или Ландольт)
        const svgData = global.VissortCore.getStimulusSVG({
            stimType: node.stimType || 'LETTER_E',
            stimDirection: dir,
            stimR: node.stimR || 255,
            stimG: node.stimG || 255,
            stimB: node.stimB || 255,
            bgR: 0, bgG: 0, bgB: 0 // Черный фон по умолчанию
        }, eff);

        // 4. Рисуем
        const stim = document.getElementById('stim');
        const stimDisplay = document.getElementById('stim-display');
        if (stim) stim.innerHTML = svgData.html;
        if (stimDisplay) stimDisplay.style.backgroundColor = `rgb(${svgData.bgColor})`;

        // 5. Таймер (показ)
        const duration = (node.duration || 5) * 1000;
        console.log('[app-player] Показ стимула', dir, 'на', duration, 'мс');
        
        setTimeout(() => {
            if (stim) stim.innerHTML = '';
            console.log('[app-player] Стимул скрыт');
        }, duration);
    }
    function displayStimulus(html, bg) {
            if (stim) stim.innerHTML = html;
            if (stimDisplay) stimDisplay.style.backgroundColor = `rgb(${bg.r},${bg.g},${bg.b})`;
        }

        function hideStimulus() {
            if (stim) stim.innerHTML = '';
        }

        if (startNode.params?.stimulusDynamic?.active) {
            console.log('[app-player] Запуск ЖС-узла:', startNode.id);
            global.PlayerCore.playDynamicStimulus(startNode, {
                state: { get playerRunning() { return true; }, get isPaused() { return false; } },
                callbacks: {
                    displayStimulus: displayStimulus,
                    hideStimulus: hideStimulus,
                    onFrameEnd: () => console.log('[app-player] ЖС завершен')
                },
                getStimDisplay: () => stimDisplay
            });
        } else {
            playSimpleStimulus(startNode);
        }
    }

    global.AppPlayer = { startPlayer };
    console.log('[AppPlayer] loaded (v2)');
})(window);