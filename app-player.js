// ============================================================
// app-player.js вЂ” Р’РµСЂСЃРёСЏ 10 (СЃРІРѕРё РєРЅРѕРїРєРё-СЃС‚СЂРµР»РєРё)
// ============================================================
(function (global) {
    'use strict';

    function startPlayer() {
        const nodes = global.AppState?.nodes || [];
        const startNode = nodes.find(n => n.isStart && n.isActive);
        if (!startNode) {
            console.warn('[app-player] РќРµС‚ СЃС‚Р°СЂС‚РѕРІРѕРіРѕ СѓР·Р»Р° (isStart = true)');
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

        // === РЎР’РћР РљРќРћРџРљР-РЎРўР Р•Р›РљР ===
        let myArrows = document.getElementById('my-response-arrows');
        if (myArrows) myArrows.remove();

        myArrows = document.createElement('div');
        myArrows.id = 'my-response-arrows';
        myArrows.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            display: flex; gap: 10px; z-index: 10005;
        `;

        ['РІРІРµСЂС…', 'РІРЅРёР·', 'РІР»РµРІРѕ', 'РІРїСЂР°РІРѕ'].forEach(dir => {
            const btn = document.createElement('button');
            btn.textContent = dir === 'РІРІРµСЂС…' ? 'в–І' : dir === 'РІРЅРёР·' ? 'в–ј' : dir === 'РІР»РµРІРѕ' ? 'в—Ђ' : 'в–¶';
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
                console.log('[my-arrow] РљР»РёРє:', dir);
                if (window._currentHandleAnswer) {
                    window._currentHandleAnswer(dir);
                }
            });
            myArrows.appendChild(btn);
        });

        document.body.appendChild(myArrows);

        // === РљРќРћРџРљРђ Р’Р«РҐРћР”Рђ ===
        const oldExit = document.getElementById('btn-exit-player');
        if (oldExit) oldExit.remove();

        const exitBtn = document.createElement('button');
        exitBtn.id = 'btn-exit-player';
        exitBtn.textContent = 'вњ• Р’С‹Р№С‚Рё РІ СЂРµРґР°РєС‚РѕСЂ';
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
            console.log('[app-player] Р’С‹С…РѕРґ РІ СЂРµРґР°РєС‚РѕСЂ');
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
            console.log('[app-player] Р—Р°РїСѓСЃРє СѓР·Р»Р°:', node.id);

            if (typeof node._step === 'undefined') node._step = 0;
            const seriesSize = node.seriesSize || 6;

            if (node.params?.stimulusDynamic?.active) {
                const frames = node.params.stimulusDynamic.frames || [];
                if (frames.length === 0) { console.warn('[app-player] РќРµС‚ РєР°РґСЂРѕРІ РІ Р–РЎ'); return; }
                
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
            console.log('[app-player] РћР±С‹С‡РЅС‹Р№ СЃС‚РёРјСѓР»:', node.id);
            
            let dir;
            if (node.isActive) {
                const d = ['РІРІРµСЂС…', 'РІРЅРёР·', 'РІР»РµРІРѕ', 'РІРїСЂР°РІРѕ'];
                dir = d[Math.floor(Math.random() * d.length)];
            } else {
                dir = node.stimDirectionFixed || 'РІРІРµСЂС…';
            }

            const dist = node.stimDistance || 1;
            const ppi = node.stimPPI || 96;
            const acuity = node.stimAcuity || 1.0;
            const eff = global.VissortCore.acuityToSizePx(acuity, dist, ppi);

            const svgData = global.VissortCore.getStimulusSVG({
                stimType: node.stimType || 'LETTER_E',
                stimDirection: dir,
                stimR: node.stimR || 255,
                stimG: node.stimG || 255,
                stimB: node.stimB || 255,
                bgR: node.bgR || 0, bgG: node.bgG || 0, bgB: node.bgB || 0
            }, eff);

            displayStimulus(svgData.html, { r: node.bgR || 0, g: node.bgG || 0, b: node.bgB || 0 });

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
                console.log(`[app-player] РћС‚РІРµС‚: ${userDir}, РїСЂР°РІРёР»СЊРЅС‹Р№: ${dir}, РІРµСЂРЅРѕ: ${isCorrect}`);
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
                const keyMap = { 'ArrowUp': 'РІРІРµСЂС…', 'ArrowDown': 'РІРЅРёР·', 'ArrowLeft': 'РІР»РµРІРѕ', 'ArrowRight': 'РІРїСЂР°РІРѕ' };
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
            console.log(`[app-player] РС‰РµРј СЃР»РµРґСѓСЋС‰РёР№ СѓР·РµР» РґР»СЏ ${node.id}. РСЃС…РѕРґ: ${outcome}`);

            if (node.branching && node.branching.enabled && outcome) {
                let nextConn = connections.find(c => c.fromId === node.id && c.outcome === outcome);
                if (!nextConn && node.branching.outcomes && node.branching.outcomes[outcome]) {
                    const targetId = node.branching.outcomes[outcome];
                    if (targetId) nextConn = { toId: targetId };
                }
                if (nextConn) {
                    const nextNode = global.AppState.nodes.find(n => n.id === nextConn.toId);
                    if (nextNode) {
                        console.log(`[app-player] вњ… РџРµСЂРµС…РѕРґ РїРѕ РІРµС‚РєРµ "${outcome}" Рє СѓР·Р»Сѓ:`, nextNode.id);
                        playNode(nextNode);
                        return;
                    }
                }
                console.log(`[app-player] вљ пёЏ Р’РµС‚РєР° "${outcome}" РЅРµ РЅР°Р№РґРµРЅР°. Р—Р°РІРµСЂС€Р°РµРј.`);
                return;
            }

            const nextConn = connections.find(c => c.fromId === node.id && !c.outcome);
            if (nextConn) {
                const nextNode = global.AppState.nodes.find(n => n.id === nextConn.toId);
                if (nextNode) {
                    console.log('[app-player] РџРµСЂРµС…РѕРґ Рє СЃР»РµРґСѓСЋС‰РµРјСѓ СѓР·Р»Сѓ (РѕР±С‹С‡РЅР°СЏ СЃРІСЏР·СЊ):', nextNode.id);
                    playNode(nextNode);
                    return;
                }
            }
            console.log('[app-player] Р“СЂР°С„ Р·Р°РІРµСЂС€РµРЅ');
        }

        playNode(startNode);
    }

    global.AppPlayer = { startPlayer };
    console.log('[AppPlayer] loaded (v10 вЂ” СЃРІРѕРё СЃС‚СЂРµР»РєРё)');
})(window);
