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
            console.warn('[app-player] Обычные стимулы пока не поддерживаются (только ЖС)');
        }
    }

    global.AppPlayer = { startPlayer };
    console.log('[AppPlayer] loaded (v2)');
})(window);