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

        function playNode(node) {
            if (!node) return;
            console.log('[app-player] Запуск узла:', node.id);

            // Сброс шага при старте
            if (typeof node._step === 'undefined') node._step = 0;
            const seriesSize = node.seriesSize || 6;

            if (node.params?.stimulusDynamic?.active) {
                // --- ЖС (Живой стимул) ---
                const frames = node.params.stimulusDynamic.frames || [];
                if (frames.length === 0) {
                    console.warn('[app-player] Нет кадров в ЖС');
                    return;
                }
                
                const frameIndex = node._step % frames.length;

                global.PlayerCore.playDynamicStimulus(node, {
                    frameIndex: frameIndex,
                    state: { get playerRunning() { return true; }, get isPaused() { return false; } },
                    callbacks: {
                        displayStimulus: displayStimulus,
                        hideStimulus: hideStimulus,
                        onFrameEnd: () => {
                            hideStimulus();
                            node._step++;
                            if (node._step >= seriesSize) {
                                console.log('[app-player] Серия ЖС завершена (все', seriesSize, 'кадров)');
                                node._step = 0;
                                playNextNode(node);
                            } else {
                                console.log('[app-player] ЖС: следующий кадр (', node._step + 1, 'из', seriesSize, ')');
                                playNode(node); // Рекурсия
                            }
                        }
                    },
                    getStimDisplay: () => stimDisplay
                });
            } else {
                // --- Обычный стимул ---
                playSimpleStimulus(node);
            }
        }

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
            const acuity = node.stimAcuity || 1.0;
            const eff = global.VissortCore.acuityToSizePx(acuity, dist, ppi);

            // 3. Получаем SVG
            const svgData = global.VissortCore.getStimulusSVG({
                stimType: node.stimType || 'LETTER_E',
                stimDirection: dir,
                stimR: node.stimR || 255,
                stimG: node.stimG || 255,
                stimB: node.stimB || 255,
                bgR: 0, bgG: 0, bgB: 0
            }, eff);

            // 4. Рисуем
            displayStimulus(svgData.html, { r: 0, g: 0, b: 0 });
            if (node.seriesSize === undefined) node.seriesSize = 6;
            
            // 5. Обработка ответа
            let answered = false;
            const duration = (node.duration || 5) * 1000;

            const onKeyDown = (e) => {
                if (answered) return;
                const keyMap = { 'ArrowUp': 'вверх', 'ArrowDown': 'вниз', 'ArrowLeft': 'влево', 'ArrowRight': 'вправо' };
                const userDir = keyMap[e.key];
                if (!userDir) return;
                
                answered = true;
                const isCorrect = (userDir === dir);
                console.log(`[app-player] Ответ: ${userDir}, верно: ${isCorrect}`);
                document.removeEventListener('keydown', onKeyDown);
                hideStimulus();
                
                node._step = (node._step || 0) + 1;
                if (node._step >= node.seriesSize) {
                    console.log('[app-player] Серия завершена (все', node.seriesSize, 'стимулов)');
                    node._step = 0;
                    playNextNode(node);
                } else {
                    console.log('[app-player] Следующий стимул в серии (', node._step + 1, 'из', node.seriesSize, ')');
                    playNode(node);
                }
            };

            document.addEventListener('keydown', onKeyDown);

            setTimeout(() => {
                if (!answered) {
                    answered = true;
                    document.removeEventListener('keydown', onKeyDown);
                    hideStimulus();
                    console.log('[app-player] Таймаут');
                    node._step = (node._step || 0) + 1;
                    if (node._step >= node.seriesSize) {
                        console.log('[app-player] Серия завершена (таймаут)');
                        node._step = 0;
                        playNextNode(node);
                    } else {
                        playNode(node);
                    }
                }
            }, duration);
        }

        function playNextNode(node) {
            const connections = global.AppState?.connections || [];
            const nextConn = connections.find(c => c.fromId === node.id);
            if (nextConn) {
                const nextNode = global.AppState.nodes.find(n => n.id === nextConn.toId);
                if (nextNode) {
                    console.log('[app-player] Переход к следующему узлу:', nextNode.id);
                    playNode(nextNode);
                    return;
                }
            }
            console.log('[app-player] Граф завершен');
        }

        playNode(startNode);
    }

    global.AppPlayer = { startPlayer };
    console.log('[AppPlayer] loaded (v3)');
})(window);