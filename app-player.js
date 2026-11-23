// ============================================================
// app-player.js — Версия 10 (свои кнопки-стрелки)
// ============================================================
(function (global) {
    'use strict';

    // Направления — те же строки, что в vissort-core.js (DIR).
    // \u-escape: чтобы кириллица не «побилась» при пересохранении в другой кодировке.
    const DIR = (global.VissortCore && global.VissortCore.DIR) || {
        up: '\u0432\u0432\u0435\u0440\u0445',
        down: '\u0432\u043d\u0438\u0437',
        left: '\u0432\u043b\u0435\u0432\u043e',
        right: '\u0432\u043f\u0440\u0430\u0432\u043e'
    };

    function startPlayer() {
        const nodes = global.AppState?.nodes || [];
        const startNode = nodes.find(n => n.isStart && n.isActive);
        if (!startNode) {
            console.warn('[app-player] Нет стартового узла (isStart = true)');
            return;
        }

        const stimDisplay = document.getElementById('stim-display');
        const stim = document.getElementById('stim');
        const canvas = document.getElementById('canvas');
        const responseBtns = document.getElementById('response-buttons');

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

        // === СВОИ КНОПКИ-СТРЕЛКИ ===
        let myArrows = document.getElementById('my-response-arrows');
        if (myArrows) myArrows.remove();

        myArrows = document.createElement('div');
        myArrows.id = 'my-response-arrows';
        myArrows.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            display: flex; gap: 10px; z-index: 10005;
        `;

        [DIR.up, DIR.down, DIR.left, DIR.right].forEach(dir => {
            const btn = document.createElement('button');
            btn.textContent = dir === DIR.up ? '\u25B2' : dir === DIR.down ? '\u25BC' : dir === DIR.left ? '\u25C0' : '\u25B6';
            btn.dataset.dir = dir;
            btn.style.cssText = `
                width: 64px; height: 64px; border-radius: 12px;
                background: #1e1e28; border: 1px solid #3f3f46;
                color: #fff; font-size: 28px; cursor: pointer;
                pointer-events: auto; z-index: 10006;
            `;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('[my-arrow] Клик:', dir);
                if (window._currentHandleAnswer) {
                    window._currentHandleAnswer(dir);
                }
            });
            myArrows.appendChild(btn);
        });

        document.body.appendChild(myArrows);

        // === КНОПКА ВЫХОДА ===
        const oldExit = document.getElementById('btn-exit-player');
        if (oldExit) oldExit.remove();

        const exitBtn = document.createElement('button');
        exitBtn.id = 'btn-exit-player';
        exitBtn.textContent = '\u2715 Выйти в редактор';
        exitBtn.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10001;
            background: #dc2626; color: white; border: 2px solid white;
            border-radius: 6px; padding: 10px 20px; font-size: 16px;
            font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', sans-serif;
        `;
        exitBtn.addEventListener('click', () => {
            hideStimulus();
            if (stimDisplay) stimDisplay.style.display = 'none';
            if (canvas) canvas.style.display = 'block';
            if (myArrows) myArrows.style.display = 'none';
            exitBtn.remove();
            const btnPlay = document.getElementById('btn-player');
            if (btnPlay) btnPlay.disabled = false;
            console.log('[app-player] Выход в редактор');
        });
        document.body.appendChild(exitBtn);

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

            if (typeof node._step === 'undefined') node._step = 0;
            const seriesSize = node.seriesSize || 6;

            if (node.params?.stimulusDynamic?.active) {
                const frames = node.params.stimulusDynamic.frames || [];
                if (frames.length === 0) { console.warn('[app-player] Нет кадров в ЖС'); return; }
                
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
                                node._step = 0;
                                playNextNode(node, 'timeout');
                            } else {
                                playNode(node);
                            }
                        }
                    },
                    getStimDisplay: () => stimDisplay
                });
            } else {
                playSimpleStimulus(node);
            }
        }

        function playSimpleStimulus(node) {
            console.log('[app-player] Обычный стимул:', node.id);
            
            let dir;
            if (node.isActive) {
                const d = [DIR.up, DIR.down, DIR.left, DIR.right];
                dir = d[Math.floor(Math.random() * d.length)];
            } else {
                dir = node.stimDirectionFixed || DIR.up;
            }

            const dist = node.stimDistance || 1;
            const ppi = node.stimPPI || 96;
            const acuity = node.stimAcuity || 1.0;
            const eff = global.VissortCore.acuityToSizePx(acuity, dist, ppi);
            const sb = Math.max(0, Math.min(100, node.stimBrightness != null ? node.stimBrightness : 100));
            const bb = Math.max(0, Math.min(100, node.bgBrightness != null ? node.bgBrightness : 100));

            const svgData = global.VissortCore.getStimulusSVG({
                stimType: node.stimType || 'LETTER_E',
                stimDirection: dir,
                stimR: node.stimR || 255,
                stimG: node.stimG || 255,
                stimB: node.stimB || 255,
                bgR: node.bgR || 0, bgG: node.bgG || 0, bgB: node.bgB || 0, stimBrightness: sb, bgBrightness: bb
            }, eff);

            displayStimulus(svgData.html, { r: Math.round((node.bgR || 0) * bb / 100), g: Math.round((node.bgG || 0) * bb / 100), b: Math.round((node.bgB || 0) * bb / 100) });

            // === ЕСЛИ "ОЖИДАТЬ ОТВЕТЫ" СНЯТА — ТОЛЬКО ПОКАЗ ===
            if (node.isActive === false) {
                console.log('[app-player] Режим "Только показ" (без ожидания ответа)');
                setTimeout(() => {
                    hideStimulus();
                    playNextNode(node, null);
                }, (node.duration || 5) * 1000);
                return;
            }

            const stimEl = document.getElementById('stim');
            if (stimEl) {
                let blurPx = (node.dfEnabled && node.dfPeriBlur > 0) ? (node.dfPeriBlur / 100) * 20 : 0;
                stimEl.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
            }

            if (node.seriesSize === undefined) node.seriesSize = 6;

            let blinkInterval = null;
            if (node.blinkEnabled) {
                let blinkOn = true;
                const blinkColorA = node.blinkColorA || { r: 255, g: 0, b: 0 };
                const blinkColorB = node.blinkColorB || { r: 0, g: 0, b: 255 };
                blinkInterval = setInterval(() => {
                    if (!stimEl) return;
                    blinkOn = !blinkOn;
                    const color = blinkOn ? blinkColorA : blinkColorB;
                    const path = stimEl.querySelector('svg path');
                    if (path) path.setAttribute('fill', `rgb(${color.r},${color.g},${color.b})`);
                }, node.blinkIntervalMs || 500);
            }
            
            let answered = false;
            const duration = (node.duration || 5) * 1000;

            const handleAnswer = (userDir) => {
                if (answered) return;
                answered = true;
                if (blinkInterval) clearInterval(blinkInterval);
                const isCorrect = (userDir === dir);
                console.log(`[app-player] Ответ: ${userDir}, правильный: ${dir}, верно: ${isCorrect}`);
                hideStimulus();
                
                node._step = (node._step || 0) + 1;
                if (node._step >= node.seriesSize) {
                    node._step = 0;
                    playNextNode(node, isCorrect ? 'correct' : 'wrong');
                } else {
                    playNode(node);
                }
            };
            
            window._currentHandleAnswer = handleAnswer;

            const onKeyDown = (e) => {
                const keyMap = { 'ArrowUp': DIR.up, 'ArrowDown': DIR.down, 'ArrowLeft': DIR.left, 'ArrowRight': DIR.right };
                const userDir = keyMap[e.key];
                if (userDir) handleAnswer(userDir);
            };
            document.addEventListener('keydown', onKeyDown);

            setTimeout(() => {
                if (!answered) {
                    answered = true;
                    if (blinkInterval) clearInterval(blinkInterval);
                    document.removeEventListener('keydown', onKeyDown);
                    hideStimulus();
                    node._step = (node._step || 0) + 1;
                    if (node._step >= node.seriesSize) {
                        node._step = 0;
                        playNextNode(node, 'timeout');
                    } else {
                        playNode(node);
                    }
                }
            }, duration);
        }
		        function playNextNode(node, outcome = null) {
            const connections = global.AppState?.connections || [];
            console.log(`[app-player] Ищем следующий узел для ${node.id}. Исход: ${outcome}`);

            if (node.branching && node.branching.enabled && outcome) {
                let nextConn = connections.find(c => c.fromId === node.id && c.outcome === outcome);
                if (!nextConn && node.branching.outcomes && node.branching.outcomes[outcome]) {
                    const targetId = node.branching.outcomes[outcome];
                    if (targetId) nextConn = { toId: targetId };
                }
                if (nextConn) {
                    const nextNode = global.AppState.nodes.find(n => n.id === nextConn.toId);
                    if (nextNode) {
                        console.log(`[app-player] ✅ Переход по ветке "${outcome}" к узлу:`, nextNode.id);
                        playNode(nextNode);
                        return;
                    }
                }
                console.log(`[app-player] ⚠ Ветка "${outcome}" не найдена. Завершаем.`);
                return;
            }

            const nextConn = connections.find(c => c.fromId === node.id && !c.outcome);
            if (nextConn) {
                const nextNode = global.AppState.nodes.find(n => n.id === nextConn.toId);
                if (nextNode) {
                    console.log('[app-player] Переход к следующему узлу (обычная связь):', nextNode.id);
                    playNode(nextNode);
                    return;
                }
            }
            console.log('[app-player] Граф завершён');
        }

        playNode(startNode);
    }

    global.AppPlayer = { startPlayer };
    console.log('[AppPlayer] loaded (v10 — свои стрелки)');
})(window);
