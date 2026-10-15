/* Vissort — AppPlayerPreview: плеер-превью в редакторе (admin.html).
 * Вынесено из app.js §A2-v2 (Фаза 5, 2026-10-15).
 * Отличается от прод-плеера (player-single.js): адаптивная острота, blinkLockShow, sessionId.
 * Зависит: AppState (window.xxx через шим), window.AppEditorCore, window.Data, window.Voice.
 */
(function () {
  'use strict';
// ==================== ПЛЕЕР: СЛУЖЕБНОЕ ====================
function displayStimulus(html, bgColor) {
    stimDisplay.innerHTML = html;
    stimArea.style.backgroundColor = `rgb(${bgColor.r},${bgColor.g},${bgColor.b})`;
}
function hideStimulus() {
    stopSingleStimAnimation();
    stopSingleBgAnimation();
    stopCircleAnimation();
    stopPeripheralAnimation();
    stopBlinkAnimation();
    removeSingleGridLines();
    stimDisplay.innerHTML = '';
    stimDisplay.style.fontSize = '';
    stimDisplay.style.color = '';
    stimDisplay.style.backgroundColor = '';
    stimDisplay.style.background = '';
    stimArea.style.backgroundColor = '';
}
function updateCounters() {
    cntCompleted.textContent = completedSeries;
    cntSuccess.textContent = successfulSeries;
    cntFailed.textContent = failedSeries;
    cntSeriesCorrect.textContent = seriesCorrect;
    cntSeriesIncorrect.textContent = seriesIncorrect;
    cntSeriesNoAnswer.textContent = seriesNoAnswer;
}
// ==================== ПЛЕЕР: ЗАПУСК ====================
function startPlayer() {
    if (window._pendingGeneratorMode && trainingNode && trainingNode.params) {
        startAutoTraining();
        return;
    }
    if (nodes.length > 0) {
        playNodesSequence();
        return;
    }
    if (trainingNode && trainingNode.params) {
        startAutoTraining();
        return;
    }
    VissortDialog.alert('Создайте узел или настройте Режим');
}
function startAutoTraining() {
    if (currentMode === 'nodes') switchMode('stimuli');
    playerRunning = true;
    isPaused = false;
    completedSeries = successfulSeries = failedSeries = 0;
    seriesCorrect = seriesIncorrect = seriesNoAnswer = 0;
    noAnswerSeriesStreak = seriesStep = 0;
    lastDirection = null;
    currentSingleCell = { row: 0, col: 0 };
    currentCompareNode = null;
    readingCurrentNode = null;
    window._currentReadingBookId = null;
    window._currentReadingPage = 0;
    window._currentReadingNodeId = null;
    resetDistanceTracking();
    resetBlinkState();
    screenPPI = trainingNode.params.ppi || screenPPI || 96;
    trainingDistance = trainingNode.params.distanceMeters || generalDistance || 1;
    const tt = trainingNode.params.trainingType || 'single';
    if (tt !== 'reading') currentAcuity = trainingNode.params.startAcuity || 0.5;
    currentSize = acuityToSizePx(currentAcuity, trainingDistance, screenPPI);
    distanceLog = [];
    distanceMin = distanceMax = null;
    distanceSum = distanceCount = 0;
    currentDuration = 2550;
    currentStimColor = trainingNode.params.startStimColor
        ? { ...trainingNode.params.startStimColor }
        : { r: 0, g: 255, b: 0 };
    currentBgColor = trainingNode.params.startBgColor
        ? { ...trainingNode.params.startBgColor }
        : { r: 0, g: 0, b: 0 };
    updateCounters();
    btnPlayer.disabled = true;
    btnPlayerStop.disabled = false;
    btnPlayerPause.disabled = false;
    btnPlayerPause.textContent = '⏸ Пауза';
    if (window.Voice) window.Voice.sayKey('ready', { cancel: true });
    if (tt === 'reading') {
        btnPlayerPause.disabled = true;
        startReadingModeAuto();
    } else if (tt === 'compare') {
        compareMode = trainingNode.params.compareMode || 'direction';
        gridX = trainingNode.params.gridX || 3;
        gridY = trainingNode.params.gridY || 3;
        activeCells = trainingNode.params.activeCells || [];
        cellParams = trainingNode.params.cellParams || [];
        if (activeCells.length === 0)
            activeCells = [
                { row: 0, col: 0 },
                { row: 0, col: 1 }
            ];
        if (cellParams.length < activeCells.length) cellParams = activeCells.map(() => defaultCellParams());
        showNextComparison();
    } else showNextStimulus();
}
function playNodesSequence() {
    window.AppEditorCore.buildPlayQueue();
    if (playQueue.length === 0) {
        stopPlayer();
        return;
    }
    if (currentMode === 'nodes') switchMode('stimuli');
    playerRunning = true;
    isPaused = false;
    completedSeries = successfulSeries = failedSeries = 0;
    seriesCorrect = seriesIncorrect = seriesNoAnswer = 0;
    noAnswerSeriesStreak = seriesStep = 0;
    currentSingleCell = { row: 0, col: 0 };
    currentCompareNode = null;
    readingCurrentNode = null;
    window._currentReadingBookId = null;
    window._currentReadingPage = 0;
    window._currentReadingNodeId = null;
    currentPlayingNodeId = null;
    resetDistanceTracking();
    resetBlinkState();
    btnPlayer.disabled = true;
    btnPlayerStop.disabled = false;
    btnPlayerPause.disabled = false;
    btnPlayerPause.textContent = '⏸ Пауза';
    if (window.Voice) window.Voice.sayKey('ready', { cancel: true });
    playIndex = 0;
    playNextQueuedNode();
}
function playNextQueuedNode() {
    if (!playerRunning || isPaused) return;
    if (playIndex >= playQueue.length) {
        stopPlayer();
        VissortDialog.alert('Проигрывание узлов завершено.');
        return;
    }
    const item = playQueue[playIndex];
    const node = window.AppEditorCore.getNode(item.nodeId);
    if (!node) {
        playIndex++;
        playNextQueuedNode();
        return;
    }
    if (node.isActive === false && node.nodeType !== 'LOGIC_IF') {
        playIndex++;
        playNextQueuedNode();
        return;
    }
    if (item.connection) {
        const c = item.connection,
            fn = window.AppEditorCore.getNode(item.fromNodeId);
        if (fn) {
            if (c.inheritSize) {
                node.stimAcuity = fn.stimAcuity;
                node.endAcuity = fn.endAcuity;
                node.stimDistance = fn.stimDistance;
                node.stimPPI = fn.stimPPI;
                node.stimSize = getNodeComputedSize(node);
            }
            if (c.inheritSpeed) node.duration = fn.duration;
        }
    }
    if (node.nodeType === 'READING') {
        playReadingNode(node);
        return;
    }
    if (node.nodeType === 'COMPARE') {
        playCompareNodeSeries(node);
        return;
    }
    currentPlayingNodeId = node.id;
    completedSeries = successfulSeries = failedSeries = 0;
    seriesCorrect = seriesIncorrect = seriesNoAnswer = 0;
    seriesStep = 0;
    noAnswerSeriesStreak = 0;
    lastDirection = null;
    currentSingleCell = { row: 0, col: 0 };
    nodeAcuityCurrent = node.stimAcuity || 1.0;
    updateCounters();
    hideStimulus();
    responseButtons.style.display = 'none';
    phaseTimers.push(
        setTimeout(() => {
            if (!playerRunning || isPaused) return;
            playStimulusNodeSeries(node);
        }, node.delay1 || 0)
    );
}

// ==================== ПЛЕЕР: СРАВНЕНИЕ (узел) ====================
function playCompareNodeSeries(node) {
    if (!playerRunning || isPaused) return;
    currentCompareNode = node;
    currentPlayingNodeId = node.id;
    completedSeries = successfulSeries = failedSeries = 0;
    seriesCorrect = seriesIncorrect = seriesNoAnswer = 0;
    seriesStep = 0;
    noAnswerSeriesStreak = 0;
    compareMode = node.compareMode || 'direction';
    gridX = Math.max(2, Math.min(6, parseInt(node.gridX) || 3));
    gridY = Math.max(1, Math.min(6, parseInt(node.gridY) || 3));
    activeCells = (node.activeCells || []).slice();
    cellParams = (node.cellParams || []).slice();
    if (activeCells.length < 2)
        activeCells = [
            { row: 0, col: 0 },
            { row: 0, col: 1 }
        ];
    while (cellParams.length < activeCells.length) cellParams.push(defaultCompareCellParams());
    updateCounters();
    hideStimulus();
    responseButtons.style.display = 'none';
    phaseTimers.push(
        setTimeout(() => {
            if (!playerRunning || isPaused) return;
            playNextCompareRound(node);
        }, node.delay1 || 0)
    );
}
function playNextCompareRound(node) {
    if (!playerRunning || isPaused) return;
    if (seriesStep >= (node.seriesSize || 6)) {
        finishCompareNodeSeries(node);
        return;
    }
    if (blinkLockShow && areEyesClosedNow()) {
        phaseTimers.push(
            setTimeout(() => {
                if (!playerRunning || isPaused) return;
                playNextCompareRound(node);
            }, 100)
        );
        return;
    }
    removeSingleGridLines();
    stimDisplay.innerHTML = '';
    stimArea.style.background = '#000';
    responsePhaseActive = true;
    responseStartTime = performance.now();
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    if (compareMode === 'direction') showDirectionComparison();
    else if (compareMode === 'find_same') showFindSameComparison();
    const dur = cellParams[0]?.duration || node.duration || currentDuration;
    currentShowTimer = setTimeout(() => {
        if (responsePhaseActive) {
            lastResponse = { answered: false, isCorrect: false };
            processComparisonAnswer(false);
        }
    }, dur);
    phaseTimers.push(currentShowTimer);
}
function finishCompareNodeSeries(node) {
    const th = node.seriesThreshold || getThreshold(node.seriesSize || 6);
    const ok = seriesCorrect >= th;
    if (seriesNoAnswer === (node.seriesSize || 6)) noAnswerSeriesStreak++;
    else noAnswerSeriesStreak = 0;
    completedSeries++;
    if (ok) successfulSeries++;
    else failedSeries++;
    seriesCorrect = seriesIncorrect = seriesNoAnswer = seriesStep = 0;
    updateCounters();
    if (noAnswerSeriesStreak >= 3) {
        pauseTraining();
        return;
    }
    if (completedSeries >= (node.seriesCount || 5)) {
        currentCompareNode = null;
        playIndex++;
        playNextQueuedNode();
        return;
    }
    phaseTimers.push(
        setTimeout(() => {
            if (!playerRunning || isPaused) return;
            playNextCompareRound(node);
        }, node.delay2 || 500)
    );
}

// ==================== ПЛЕЕР: СТИМУЛ (узел) ====================
function playStimulusNodeSeries(node) {
    if (!playerRunning || isPaused) return;
    if (completedSeries >= (node.seriesCount || 5)) {
        playIndex++;
        playNextQueuedNode();
        return;
    }
    if (seriesStep >= (node.seriesSize || 6)) {
        finishStimulusNodeSeries(node);
        return;
    }
    if (blinkLockShow && areEyesClosedNow()) {
        phaseTimers.push(
            setTimeout(() => {
                if (!playerRunning || isPaused) return;
                playStimulusNodeSeries(node);
            }, 100)
        );
        return;
    }
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    let dir;
    if (node.isActive) {
        const d = ['вверх', 'вниз', 'влево', 'вправо'];
        do {
            dir = d[Math.floor(Math.random() * d.length)];
        } while (dir === lastDirection);
    } else dir = node.stimDirectionFixed || 'вверх';
    lastDirection = dir;
    currentCorrectDirection = dir;
    const dCalc = currentDistanceMeters || node.stimDistance || 1;
    const pCalc = node.stimPPI || screenPPI || 96;
    const eff = acuityToSizePx(nodeAcuityCurrent, dCalc, pCalc);
    currentSize = eff;
    let sc = { r: node.stimR, g: node.stimG, b: node.stimB };
    if (node.singleStimDynamicEnabled && node.singleStimColor1 && !node.singleCircleEnabled)
        sc = node.singleStimColor1;
    let svgData;
    if (node.singleCircleEnabled) svgData = getCircleStimulusSVG(node, eff);
    else
        svgData = getStimulusSVG(
            {
                stimType: node.stimType || 'LETTER_E',
                stimDirection: dir,
                stimR: sc.r,
                stimG: sc.g,
                stimB: sc.b,
                bgR: node.bgR || 0,
                bgG: node.bgG || 0,
                bgB: node.bgB || 0
            },
            eff
        );
    if (node.dfEnabled) {
        const frame = buildDefocusFrame(node, eff, svgData.html, dir);
        if (frame) {
            stimDisplay.innerHTML = '';
            stimDisplay.appendChild(frame.html);
            stimArea.style.backgroundColor = `rgb(${node.dfPeriBg.r},${node.dfPeriBg.g},${node.dfPeriBg.b})`;
        } else displayStimulus(svgData.html, { r: node.bgR || 0, g: node.bgG || 0, b: node.bgB || 0 });
    } else displayStimulus(svgData.html, { r: node.bgR || 0, g: node.bgG || 0, b: node.bgB || 0 });
    if (node.singleGridEnabled) {
        const gx = node.singleGridX || 1,
            gy = node.singleGridY || 1;
        const cell = pickSingleGridCell(
            gx,
            gy,
            node.singleGridRandomCell !== false,
            node.singleGridAvoidRepeat !== false,
            node.singleGridFixedRow || 0,
            node.singleGridFixedCol || 0,
            node.singleGridCells || []
        );
        currentSingleCell = cell;
        applySingleGridPosition(eff, gx, gy, cell.row, cell.col, node.singleGridShowLines === true);
    } else if (node.singleRandomPos) applyRandomStimulusPosition(eff);
    buildPeripheralDots(node, eff);
    stopBlinkAnimation();
    if (node.singleCircleEnabled) {
        startCircleAnimation(node);
        stopSingleStimAnimation();
    } else {
        stopCircleAnimation();
        if (node.singleStimDynamicEnabled)
            startSingleStimAnimation({
                singleStimColor1: node.singleStimColor1,
                singleStimMidEnabled: node.singleStimMidEnabled,
                singleStimColor3: node.singleStimColor3,
                singleStimColor2: node.singleStimColor2,
                singleStimReverse: node.singleStimReverse,
                singleStimLoop: node.singleStimLoop,
                singleStimDuration: node.singleStimDuration
            });
        else stopSingleStimAnimation();
    }
    if (node.singleBgDynamicEnabled)
        startSingleBgAnimation({
            singleBgColor1: node.singleBgColor1,
            singleBgMidEnabled: node.singleBgMidEnabled,
            singleBgColor3: node.singleBgColor3,
            singleBgColor2: node.singleBgColor2,
            singleBgReverse: node.singleBgReverse,
            singleBgLoop: node.singleBgLoop,
            singleBgDuration: node.singleBgDuration
        });
    else stopSingleBgAnimation();
    if (node.blinkEnabled) {
        startBlinkAnimation({
            target: node.blinkTarget || 'stim',
            colorA: node.blinkColorA || { r: 255, g: 0, b: 0 },
            colorB: node.blinkColorB || { r: 0, g: 0, b: 255 },
            intervalMs: node.blinkIntervalMs || 500,
            duty: node.blinkDuty ?? 0.5,
            count: node.blinkCount || 0
        });
    }
    responsePhaseActive = true;
    responseStartTime = performance.now();
    document.querySelectorAll('.btn-resp[data-dir]').forEach((b) => (b.style.display = 'flex'));
    document.querySelectorAll('.btn-resp[data-answer]').forEach((b) => (b.style.display = 'none'));
    responseButtons.style.display = 'flex';
    if (window.Voice) window.Voice.sayKey('look', { cancel: true });
    let sd = node.duration || 1000;
    if (node.singleStimDynamicEnabled) sd = Math.max(sd, node.singleStimDuration || 0);
    if (node.singleBgDynamicEnabled) sd = Math.max(sd, node.singleBgDuration || 0);
    if (node.singleCircleEnabled) {
        const ci = node.circleInnerEnabled !== false ? node.circleInnerDuration || 0 : 0;
        const co = node.circleOuterEnabled !== false ? node.circleOuterDuration || 0 : 0;
        sd = Math.max(sd, ci, co);
    }
    scheduleVoiceCountdown(sd, node);
    currentShowTimer = setTimeout(() => {
        hideStimulus();
        responsePhaseActive = false;
        stopSingleStimAnimation();
        stopSingleBgAnimation();
        stopCircleAnimation();
        stopPeripheralAnimation();
        stopBlinkAnimation();
        if (lastResponse.answered) {
            if (lastResponse.isCorrect) seriesCorrect++;
            else seriesIncorrect++;
        } else {
            seriesNoAnswer++;
            if (window.Voice) window.Voice.sayKey('timeout', { cancel: true });
        }
        seriesStep++;
        updateCounters();
        const d2 = node.delay2 || 1000;
        phaseTimers.push(
            setTimeout(() => {
                if (!playerRunning || isPaused) return;
                playStimulusNodeSeries(node);
            }, d2)
        );
    }, sd);
    phaseTimers.push(currentShowTimer);
}
function finishStimulusNodeSeries(node) {
    const th = node.seriesThreshold || getThreshold(node.seriesSize || 6);
    const ok = seriesCorrect >= th;
    const allNo = seriesNoAnswer === (node.seriesSize || 6);
    if (allNo) noAnswerSeriesStreak++;
    else noAnswerSeriesStreak = 0;
    completedSeries++;
    if (ok) successfulSeries++;
    else failedSeries++;
    if (ok) {
        const eA = node.endAcuity != null ? node.endAcuity : node.stimAcuity || 1.0;
        if (nodeAcuityCurrent < eA)
            nodeAcuityCurrent = Math.min(
                eA,
                Math.round((nodeAcuityCurrent + (node.acuityStep || 0.1)) * 10) / 10
            );
    } else {
        const sA = node.stimAcuity || 1.0;
        if (nodeAcuityCurrent > sA)
            nodeAcuityCurrent = Math.max(
                sA,
                Math.round((nodeAcuityCurrent - (node.acuityStep || 0.1)) * 10) / 10
            );
    }
    seriesCorrect = seriesIncorrect = seriesNoAnswer = seriesStep = 0;
    lastDirection = null;
    updateCounters();
    if (noAnswerSeriesStreak >= 3) {
        pauseTraining();
        return;
    }
    if (completedSeries >= (node.seriesCount || 5)) {
        playIndex++;
        playNextQueuedNode();
        return;
    }
    phaseTimers.push(
        setTimeout(() => {
            if (!playerRunning || isPaused) return;
            playStimulusNodeSeries(node);
        }, node.delay2 || 500)
    );
}

// ==================== ПЛЕЕР: ЧТЕНИЕ (узел) ====================
function playReadingNode(node) {
    if (!readingViewportEl) readingViewportEl = document.getElementById('reading-viewport');
    if (!readingContentEl) readingContentEl = document.getElementById('reading-content');
    if (!readingViewportEl || !readingContentEl) {
        playIndex++;
        playNextQueuedNode();
        return;
    }
    readingCurrentNode = node;
    let bid = node.bookId,
        page = 0,
        inherit = false;
    if (!bid) {
        if (window._currentReadingBookId && window._books[window._currentReadingBookId]) {
            bid = window._currentReadingBookId;
            inherit = true;
        } else {
            const l = getLastBookId();
            if (l) {
                bid = l;
                inherit = true;
            }
        }
    }
    if (inherit && window._currentReadingBookId === bid) page = window._currentReadingPage || 0;
    else if (node.continueFromBookmark && bid) {
        const s = localStorage.getItem(bookmarkKeyFor(bid));
        if (s) {
            try {
                page = JSON.parse(s).page || 0;
            } catch (_) {}
        }
    }
    window._currentReadingNodeId = node.id;
    window._currentReadingBookId = bid || null;
    if (bid) setLastBookId(bid);
    const bk = bid ? window._books[bid] : null;
    if (!bk) {
        const ph =
            !node.bookId && !window._currentReadingBookId && !getLastBookId()
                ? `📖 ${escapeHtml(node.name)}\n\nКнига не задана.`
                : `📖 ${escapeHtml(node.name)}\n\nКнига не найдена.`;
        readingContentEl.innerHTML = ph
            .split('\n')
            .map((l) => `<p>${l}</p>`)
            .join('');
        readingContentEl.style.color = rgbToHex(
            node.readingTextColor?.r,
            node.readingTextColor?.g,
            node.readingTextColor?.b
        );
        readingContentEl.style.fontSize = '32px';
        const bg = node.readingBgColor || { r: 255, g: 255, b: 255 };
        readingViewportEl.style.background = `rgb(${bg.r},${bg.g},${bg.b})`;
    } else {
        const pars = (bk.text || '')
            .split(/\n+/)
            .map((x) => x.trim())
            .filter((x) => x.length > 0);
        readingContentEl.innerHTML = pars.map((x) => `<p>${escapeHtml(x)}</p>`).join('');
        readingContentEl.style.color = rgbToHex(
            node.readingTextColor?.r,
            node.readingTextColor?.g,
            node.readingTextColor?.b
        );
        applyReadingFontForNode(node);
        const dCalc = currentDistanceMeters || node.readingDistance || readingDistance || 1;
        readingContentEl.style.fontSize =
            acuityToFontSizePx(node.readingAcuity || 1.0, dCalc, screenPPI) + 'px';
        applyReadingBackground(window.AppEditorCore.nodeToReadingParams(node));
    }
    stimDisplay.style.display = 'none';
    responseButtons.style.display = 'none';
    readingViewportEl.style.display = 'block';
    readingContentEl.style.opacity = '1';
    readingPaused = false;
    const pp = document.getElementById('reading-play-pause');
    if (pp) pp.textContent = '⏸ Пауза';
    showReadingToolbar();
    setupReadingColumns();
    setTimeout(() => {
        readingTotalPages = calcReadingTotalPages();
        scrollReadingToPage(page);
    }, 100);
    if (node.duration > 0) {
        startReadingNodeTimer(Math.ceil(node.duration / 1000));
        currentShowTimer = setTimeout(() => finishReadingNodeAuto(), node.duration);
        phaseTimers.push(currentShowTimer);
    } else window._readingNodeWaiting = true;
}
function finishReadingNodeAuto() {
    window.Voice?.stopReading();
    saveCurrentReadingBookmarkSilently();
    hideReadingToolbar();
    stopReadingNodeTimer();
    if (readingContentEl) readingContentEl.innerHTML = '';
    window._readingNodeWaiting = false;
    readingCurrentNode = null;
    playIndex++;
    playNextQueuedNode();
}
function finishReadingNode() {
    window.Voice?.stopReading();
    saveCurrentReadingBookmarkSilently();
    window._readingNodeWaiting = false;
    hideReadingToolbar();
    stopReadingNodeTimer();
    if (readingContentEl) readingContentEl.innerHTML = '';
    readingCurrentNode = null;
    playIndex++;
    playNextQueuedNode();
}
let readingNodeTimerInterval = null;
function startReadingNodeTimer(sec) {
    stopReadingNodeTimer();
    const el = document.getElementById('reading-timer');
    if (!el) return;
    let s = sec;
    el.textContent = `⏱ ${s} с`;
    el.style.display = 'block';
    readingNodeTimerInterval = setInterval(() => {
        s--;
        if (s <= 0) {
            stopReadingNodeTimer();
            return;
        }
        el.textContent = `⏱ ${s} с`;
    }, 1000);
}
function stopReadingNodeTimer() {
    if (readingNodeTimerInterval) {
        clearInterval(readingNodeTimerInterval);
        readingNodeTimerInterval = null;
    }
    const el = document.getElementById('reading-timer');
    if (el) el.style.display = 'none';
}

// ==================== ПЛЕЕР: АВТОТРЕНИРОВКА ====================
function startReadingModeAuto() {
    if (!readingViewportEl) readingViewportEl = document.getElementById('reading-viewport');
    if (!readingContentEl) readingContentEl = document.getElementById('reading-content');
    if (!readingViewportEl || !readingContentEl) return;
    const p = trainingNode.params;
    const text = p.text || '';
    const pars = text
        .split(/\n+/)
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
    readingContentEl.innerHTML = pars.map((x) => `<p>${escapeHtml(x)}</p>`).join('');
    readingViewportEl.style.color = p.textColor
        ? `rgb(${p.textColor.r},${p.textColor.g},${p.textColor.b})`
        : '#000';
    const c = document.getElementById('counters');
    if (c) c.style.display = 'none';
    applyReadingBackground(p);
    stimDisplay.style.display = 'none';
    responseButtons.style.display = 'none';
    readingViewportEl.style.display = 'block';
    readingViewportEl.scrollLeft = 0;
    readingPaused = false;
    const pp = document.getElementById('reading-play-pause');
    if (pp) pp.textContent = '⏸ Пауза';
    readingContentEl.style.opacity = '1';
    applyReadingFontForNode({ readingFontFamily: 'Segoe UI', readingFontWeight: 'normal' });
    setupReadingColumns();
    const dCalc = currentDistanceMeters || readingDistance || p.readingDistance || 1;
    readingContentEl.style.fontSize = acuityToFontSizePx(currentAcuity, dCalc, screenPPI) + 'px';
    setTimeout(() => {
        readingTotalPages = calcReadingTotalPages();
        readingPage = 0;
        scrollReadingToPage(0);
    }, 80);
    showReadingToolbar();
    updateReadingFontIndicator();
}
function showNextStimulus() {
    if (!playerRunning || isPaused) return;
    if (seriesStep >= (trainingNode?.params?.seriesSize || 6)) {
        finishSeries();
        return;
    }
    if (blinkLockShow && areEyesClosedNow()) {
        phaseTimers.push(
            setTimeout(() => {
                if (!playerRunning || isPaused) return;
                showNextStimulus();
            }, 100)
        );
        return;
    }
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    const p = trainingNode?.params || {};
    let dir;
    if (p.isActive) {
        const d = ['вверх', 'вниз', 'влево', 'вправо'];
        do {
            dir = d[Math.floor(Math.random() * d.length)];
        } while (dir === lastDirection);
    } else dir = 'вверх';
    lastDirection = dir;
    currentCorrectDirection = dir;
    const dCalc = currentDistanceMeters || generalDistance || trainingDistance;
    const eff = acuityToSizePx(currentAcuity, dCalc, screenPPI);
    currentSize = eff;
    let sc = currentStimColor;
    if (p.singleStimDynamicEnabled && p.singleStimColor1 && !p.singleCircleEnabled) sc = p.singleStimColor1;
    let svgData;
    if (p.singleCircleEnabled) svgData = getCircleStimulusSVG(p, eff);
    else
        svgData = getStimulusSVG(
            {
                stimType: p.type || 'LETTER_E',
                stimDirection: dir,
                stimR: sc.r,
                stimG: sc.g,
                stimB: sc.b,
                bgR: currentBgColor.r,
                bgG: currentBgColor.g,
                bgB: currentBgColor.b
            },
            eff
        );
    if (p.dfEnabled) {
        const frame = buildDefocusFrame(p, eff, svgData.html, dir);
        if (frame) {
            stimDisplay.innerHTML = '';
            stimDisplay.appendChild(frame.html);
            stimArea.style.backgroundColor = `rgb(${p.dfPeriBg.r},${p.dfPeriBg.g},${p.dfPeriBg.b})`;
        } else displayStimulus(svgData.html, currentBgColor);
    } else displayStimulus(svgData.html, currentBgColor);
    if (p.singleGridEnabled) {
        const gx = p.singleGridX || 1,
            gy = p.singleGridY || 1;
        const cell = pickSingleGridCell(
            gx,
            gy,
            p.singleGridRandomCell !== false,
            p.singleGridAvoidRepeat !== false,
            p.singleGridFixedRow || 0,
            p.singleGridFixedCol || 0,
            p.singleGridCells || []
        );
        currentSingleCell = cell;
        applySingleGridPosition(eff, gx, gy, cell.row, cell.col, p.singleGridShowLines === true);
    } else if (p.singleRandomPos) applyRandomStimulusPosition(eff);
    buildPeripheralDots(p, eff);
    stopBlinkAnimation();
    if (p.singleCircleEnabled) {
        startCircleAnimation(p);
        stopSingleStimAnimation();
    } else {
        stopCircleAnimation();
        if (p.singleStimDynamicEnabled) startSingleStimAnimation(p);
        else stopSingleStimAnimation();
    }
    if (p.singleBgDynamicEnabled) startSingleBgAnimation(p);
    else stopSingleBgAnimation();
    if (p.blinkEnabled) {
        startBlinkAnimation({
            target: p.blinkTarget || 'stim',
            colorA: p.blinkColorA || { r: 255, g: 0, b: 0 },
            colorB: p.blinkColorB || { r: 0, g: 0, b: 255 },
            intervalMs: p.blinkIntervalMs || 500,
            duty: p.blinkDuty ?? 0.5,
            count: p.blinkCount || 0
        });
    }
    responsePhaseActive = true;
    responseStartTime = performance.now();
    document.querySelectorAll('.btn-resp[data-dir]').forEach((b) => (b.style.display = 'flex'));
    document.querySelectorAll('.btn-resp[data-answer]').forEach((b) => (b.style.display = 'none'));
    responseButtons.style.display = 'flex';
    if (window.Voice) window.Voice.sayKey('look', { cancel: true });
    let sd = currentDuration;
    if (p.singleStimDynamicEnabled) sd = Math.max(sd, p.singleStimDuration || 0);
    if (p.singleBgDynamicEnabled) sd = Math.max(sd, p.singleBgDuration || 0);
    if (p.singleCircleEnabled) {
        const ci = p.circleInnerEnabled !== false ? p.circleInnerDuration || 0 : 0;
        const co = p.circleOuterEnabled !== false ? p.circleOuterDuration || 0 : 0;
        sd = Math.max(sd, ci, co);
    }
    scheduleVoiceCountdown(sd, p);
    currentShowTimer = setTimeout(() => {
        hideStimulus();
        responsePhaseActive = false;
        stopSingleStimAnimation();
        stopSingleBgAnimation();
        stopCircleAnimation();
        stopPeripheralAnimation();
        stopBlinkAnimation();
        if (!lastResponse.answered) {
            lastResponse = { answered: false, isCorrect: false };
            if (window.Voice) window.Voice.sayKey('timeout', { cancel: true });
            if (window.Data && currentSessionId)
                window.Data.saveResult({
                    session_id: currentSessionId,
                    node_id: 'training_node',
                    response_time_ms: null,
                    is_correct: false
                });
        } else if (window.Data && currentSessionId) {
            window.Data.saveResult({
                session_id: currentSessionId,
                node_id: 'training_node',
                response_time_ms: lastResponse.reactionTimeMs,
                is_correct: lastResponse.isCorrect
            });
        }
        if (lastResponse.answered) {
            if (lastResponse.isCorrect) seriesCorrect++;
            else seriesIncorrect++;
        } else seriesNoAnswer++;
        seriesStep++;
        updateCounters();
        phaseTimers.push(setTimeout(() => showNextStimulus(), p.delay2 || 1000));
    }, sd);
    phaseTimers.push(currentShowTimer);
}
function finishSeries() {
    const th = trainingNode?.params?.seriesThreshold || getThreshold(trainingNode?.params?.seriesSize || 6);
    const ok = seriesCorrect >= th;
    if (seriesNoAnswer === (trainingNode?.params?.seriesSize || 6)) noAnswerSeriesStreak++;
    else noAnswerSeriesStreak = 0;
    completedSeries++;
    if (ok) successfulSeries++;
    else failedSeries++;
    if (ok) {
        if (currentAcuity < (trainingNode?.params?.endAcuity || 2.0))
            currentAcuity = Math.min(
                trainingNode?.params?.endAcuity || 2.0,
                Math.round((currentAcuity + (trainingNode?.params?.acuityStep || 0.1)) * 10) / 10
            );
    } else {
        if (currentAcuity > (trainingNode?.params?.startAcuity || 0.5))
            currentAcuity = Math.max(
                trainingNode?.params?.startAcuity || 0.5,
                Math.round((currentAcuity - (trainingNode?.params?.acuityStep || 0.1)) * 10) / 10
            );
    }
    const dCalc = currentDistanceMeters || generalDistance || trainingDistance;
    currentSize = acuityToSizePx(currentAcuity, dCalc, screenPPI);
    seriesCorrect = seriesIncorrect = seriesNoAnswer = seriesStep = 0;
    lastDirection = null;
    updateCounters();
    if (noAnswerSeriesStreak >= 3) {
        pauseTraining();
        return;
    }
    if (completedSeries >= (trainingNode?.params?.seriesCount || 5)) {
        trainingNode.params.finalAcuity = currentAcuity;
        let distRep = '';
        if (distanceCount > 0) {
            const avg = distanceSum / distanceCount;
            distRep = `\n\n📏 Дистанция: ср=${avg.toFixed(2)} м, мин=${distanceMin.toFixed(2)}, макс=${distanceMax.toFixed(2)}`;
        }
        const blinkRep = buildBlinkReport();
        VissortDialog.alert(
            `Тренировка завершена!\nУспешных: ${successfulSeries}\nНеуспешных: ${failedSeries}\nV = ${currentAcuity.toFixed(1)}${distRep}${blinkRep}`
        );
        stopPlayer();
    } else {
        const tt = trainingNode?.params?.trainingType || 'single';
        if (tt === 'compare') showNextComparison();
        else showNextStimulus();
    }
}

// ==================== ПЛЕЕР: СРАВНЕНИЕ (автотренировка) ====================
function showNextComparison() {
    if (!playerRunning || isPaused) return;
    if (seriesStep >= (trainingNode?.params?.seriesSize || 6)) {
        finishSeries();
        return;
    }
    removeSingleGridLines();
    stimDisplay.innerHTML = '';
    stimArea.style.background = '#000';
    responsePhaseActive = true;
    responseStartTime = performance.now();
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    if (compareMode === 'direction') showDirectionComparison();
    else if (compareMode === 'find_same') showFindSameComparison();
    const dur = cellParams[0]?.duration || currentDuration;
    currentShowTimer = setTimeout(() => {
        if (responsePhaseActive) {
            lastResponse = { answered: false, isCorrect: false };
            processComparisonAnswer(false);
        }
    }, dur);
    phaseTimers.push(currentShowTimer);
}
function showDirectionComparison() {
    if (activeCells.length < 2) return;
    const sh = activeCells.slice().sort(() => Math.random() - 0.5);
    const cA = sh[0],
        cB = sh[1];
    const d1 = randomDirection(),
        d2 = randomDirection();
    currentCompareAnswer = d1 === d2;
    createCellElement(cA, cellParams[0] || defaultCellParams(), d1, 0);
    createCellElement(cB, cellParams[1] || defaultCellParams(), d2, 1);
    document.querySelectorAll('.btn-resp[data-dir]').forEach((b) => (b.style.display = 'none'));
    document.querySelectorAll('.btn-resp[data-answer]').forEach((b) => (b.style.display = 'flex'));
    responseButtons.style.display = 'flex';
}
function showFindSameComparison() {
    const pc = Math.max(
        1,
        Math.min(20, parseInt(currentCompareNode?.pairsCount || trainingNode?.params?.pairsCount || 2))
    );
    const need = pc * 2;
    if (activeCells.length < need) {
        const maxP = Math.floor(activeCells.length / 2);
        if (maxP < 1) {
            processComparisonAnswer(false);
            return;
        }
        return showFindSameComparisonInternal(maxP);
    }
    showFindSameComparisonInternal(pc);
}
function showFindSameComparisonInternal(pc) {
    const need = pc * 2;
    const sh = activeCells.slice().sort(() => Math.random() - 0.5);
    const chosen = sh.slice(0, need);
    const pairs = [];
    for (let i = 0; i < pc; i++)
        pairs.push({ cells: [chosen[i * 2], chosen[i * 2 + 1]], direction: randomDirection(), found: false });
    _findSameState = { pairs, firstSelectedIdx: null, foundCells: new Set(), cells: chosen, pairsCount: pc };
    chosen.forEach((cell, idx) => {
        const pi = Math.floor(idx / 2);
        const dir = pairs[pi].direction;
        const params = cellParams[idx] || cellParams[cellParams.length - 1] || defaultCellParams();
        createCellElement(cell, params, dir, idx);
    });
    responseButtons.style.display = 'none';
    document.querySelectorAll('.grid-cell').forEach((el) => {
        el.onclick = () => handleFindSameClick(parseInt(el.dataset.index));
    });
}
function handleFindSameClick(idx) {
    if (!responsePhaseActive || !_findSameState || isNaN(idx)) return;
    const st = _findSameState;
    const cell = st.cells[idx];
    const key = `${cell.row},${cell.col}`;
    if (st.foundCells.has(key)) return;
    if (st.firstSelectedIdx === null) {
        st.firstSelectedIdx = idx;
        VissortCore.flashCell(idx, 'selected');
        return;
    }
    const fi = st.firstSelectedIdx;
    if (fi === idx) {
        st.firstSelectedIdx = null;
        VissortCore.flashCell(idx, 'unselect');
        return;
    }
    const fp = Math.floor(fi / 2),
        sp = Math.floor(idx / 2);
    if (fp === sp) {
        const a = st.cells[fi],
            b = st.cells[idx];
        st.foundCells.add(`${a.row},${a.col}`);
        st.foundCells.add(`${b.row},${b.col}`);
        st.pairs[fp].found = true;
        VissortCore.flashCell(fi, 'found');
        VissortCore.flashCell(idx, 'found');
        st.firstSelectedIdx = null;
        if (st.pairs.every((p) => p.found)) {
            lastResponse = {
                answered: true,
                isCorrect: true,
                reactionTimeMs: performance.now() - responseStartTime
            };
            responsePhaseActive = false;
            processComparisonAnswer(true);
        }
    } else {
        VissortCore.flashCell(fi, 'unselect');
        VissortCore.flashCell(idx, 'wrong');
        st.firstSelectedIdx = null;
    }
}
// flashCell — в vissort-core.js
function createCellElement(cell, params, direction, idx) {
    const cw = stimDisplay.offsetWidth / gridX,
        ch = stimDisplay.offsetHeight / gridY;
    const el = document.createElement('div');
    el.className = 'grid-cell';
    el.style.cssText = `left:${cell.col * cw}px;top:${cell.row * ch}px;width:${cw}px;height:${ch}px;display:flex;align-items:center;justify-content:center;background:rgb(${params.bgR || 0},${params.bgG || 0},${params.bgB || 0});position:absolute;box-sizing:border-box;border:3px solid transparent;`;
    el.dataset.index = idx !== undefined ? idx : -1;
    const size = params.size || currentSize;
    const svgData = getStimulusSVG(
        {
            stimType: trainingNode?.params?.type || 'LETTER_E',
            stimDirection: direction,
            stimR: params.stimR || 255,
            stimG: params.stimG || 255,
            stimB: params.stimB || 255,
            bgR: params.bgR || 0,
            bgG: params.bgG || 0,
            bgB: params.bgB || 0
        },
        size
    );
    el.innerHTML = svgData.html;
    stimDisplay.appendChild(el);
}
function defaultCellParams() {
    return {
        size: currentSize,
        stimR: currentStimColor.r,
        stimG: currentStimColor.g,
        stimB: currentStimColor.b,
        bgR: currentBgColor.r,
        bgG: currentBgColor.g,
        bgB: currentBgColor.b,
        duration: currentDuration
    };
}
function processComparisonAnswer(isCorrect) {
    if (!playerRunning || isPaused) return;
    if (currentShowTimer) {
        clearTimeout(currentShowTimer);
        currentShowTimer = null;
    }
    if (currentCompareNode) {
        if (isCorrect) seriesCorrect++;
        else seriesIncorrect++;
        seriesStep++;
        updateCounters();
        const n = currentCompareNode;
        phaseTimers.push(
            setTimeout(() => {
                if (playerRunning && !isPaused) playNextCompareRound(n);
            }, n.delay2 || 1000)
        );
        return;
    }
    if (isCorrect) seriesCorrect++;
    else seriesIncorrect++;
    seriesStep++;
    updateCounters();
    phaseTimers.push(
        setTimeout(() => {
            if (playerRunning && !isPaused) showNextComparison();
        }, trainingNode?.params?.delay2 || 1000)
    );
}

// ==================== ПЛЕЕР: ОТВЕТЫ ====================
function handleDirectionAnswer(direction) {
    if (!responsePhaseActive) return;
    if (isBlinkResponseBlocked()) return;
    const ok = direction === currentCorrectDirection;
    lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: performance.now() - responseStartTime };
    responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.backgroundColor = ok ? '#0a0' : '#a00';
    setTimeout(() => (document.body.style.backgroundColor = '#111'), 200);
}
function handleCompareDirectionAnswer(answer) {
    if (!responsePhaseActive) return;
    if (isBlinkResponseBlocked()) return;
    const ok = answer === currentCompareAnswer;
    lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: performance.now() - responseStartTime };
    responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.backgroundColor = ok ? '#0a0' : '#a00';
    setTimeout(() => (document.body.style.backgroundColor = '#111'), 200);
    processComparisonAnswer(ok);
}
responseButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-resp');
    if (!btn || !responsePhaseActive) return;
    if (btn.dataset.dir) handleDirectionAnswer(btn.dataset.dir);
    else if (btn.dataset.answer === 'да' || btn.dataset.answer === 'нет') {
        const inCmp =
            (currentCompareNode && currentCompareNode.compareMode === 'direction') ||
            (!currentCompareNode &&
                compareMode === 'direction' &&
                trainingNode?.params?.trainingType === 'compare');
        if (inCmp) handleCompareDirectionAnswer(btn.dataset.answer === 'да');
    }
});
document.addEventListener('keydown', (e) => {
    if (readingViewportEl && readingViewportEl.style.display === 'block') {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevReadingPage();
            return;
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextReadingPage();
            return;
        }
        if (e.key === ' ') {
            e.preventDefault();
            toggleReadingPause();
            return;
        }
        if (e.key === 'Escape' && window._readingNodeWaiting) {
            e.preventDefault();
            finishReadingNode();
            return;
        }
    }
    if (!responsePhaseActive) return;
    const map = { ArrowUp: 'вверх', ArrowDown: 'вниз', ArrowLeft: 'влево', ArrowRight: 'вправо' };
    if (map[e.key]) {
        e.preventDefault();
        const inCmp =
            (currentCompareNode && currentCompareNode.compareMode === 'direction') ||
            (!currentCompareNode &&
                compareMode === 'direction' &&
                trainingNode?.params?.trainingType === 'compare');
        if (inCmp) {
            if (e.key === 'ArrowLeft') handleCompareDirectionAnswer(true);
            else if (e.key === 'ArrowRight') handleCompareDirectionAnswer(false);
        } else handleDirectionAnswer(map[e.key]);
    }
});

// ==================== ПЛЕЕР: ПАУЗА / СТОП ====================
function stopPlayer() {
    phaseTimers.forEach((t) => clearTimeout(t));
    phaseTimers = [];
    if (currentShowTimer) clearTimeout(currentShowTimer);
    stopSingleStimAnimation();
    stopSingleBgAnimation();
    stopCircleAnimation();
    stopPeripheralAnimation();
    stopBlinkAnimation();
    stopReadingNodeTimer();
    window.Voice?.stopReading();
    saveCurrentReadingBookmarkSilently();
    resetDistanceTracking();
    hideBlinkWarning();
    window._readingNodeWaiting = false;
    window._currentReadingNodeId = null;
    window._currentReadingBookId = null;
    window._currentReadingPage = 0;
    currentPlayingNodeId = null;
    currentCompareNode = null;
    readingCurrentNode = null;
    _findSameState = null;
    playerRunning = false;
    isPaused = false;
    responsePhaseActive = false;
    hideStimulus();
    responseButtons.style.display = 'none';
    document.querySelectorAll('.btn-resp').forEach((b) => (b.style.display = 'none'));
    btnPlayer.disabled = false;
    btnPlayerStop.disabled = true;
    btnPlayerPause.disabled = true;
    document.body.style.backgroundColor = '#111';
    pauseModal.style.display = 'none';
    hideReadingToolbar();
    if (readingContentEl) {
        readingContentEl.style.opacity = '1';
        readingContentEl.innerHTML = '';
    }
    stimDisplay.style.display = '';
    hideLiveDistanceIndicator();
    currentSessionId = null;
    if (currentMode === 'stimuli') switchMode('nodes');
    currentCorrectDirection = null;
    playQueue = [];
    playIndex = 0;
}
function togglePause() {
    if (!playerRunning) return;
    isPaused = !isPaused;
    if (isPaused) {
        btnPlayerPause.textContent = '▶ Продолжить';
        phaseTimers.forEach((t) => clearTimeout(t));
        phaseTimers = [];
        if (currentShowTimer) clearTimeout(currentShowTimer);
        stopSingleStimAnimation();
        stopSingleBgAnimation();
        stopCircleAnimation();
        stopPeripheralAnimation();
        stopBlinkAnimation();
        stopReadingNodeTimer();
        hideStimulus();
        responseButtons.style.display = 'none';
    } else {
        btnPlayerPause.textContent = '⏸ Пауза';
        if (currentCompareNode) {
            playNextCompareRound(currentCompareNode);
            return;
        }
        if (currentPlayingNodeId) {
            const node = window.AppEditorCore.getNode(currentPlayingNodeId);
            if (node) {
                playStimulusNodeSeries(node);
                return;
            }
        }
        if (trainingNode?.params?.trainingType === 'compare') showNextComparison();
        else if (trainingNode?.params) showNextStimulus();
        else if (playIndex < playQueue.length) playNextQueuedNode();
        else stopPlayer();
    }
}
function pauseTraining() {
    phaseTimers.forEach((t) => clearTimeout(t));
    phaseTimers = [];
    if (currentShowTimer) clearTimeout(currentShowTimer);
    stopSingleStimAnimation();
    stopSingleBgAnimation();
    stopCircleAnimation();
    stopPeripheralAnimation();
    stopBlinkAnimation();
    stopReadingNodeTimer();
    responsePhaseActive = false;
    hideStimulus();
    responseButtons.style.display = 'none';
    isPaused = true;
    btnPlayerPause.disabled = true;
    pauseModal.style.display = 'flex';
}
function resumeTraining() {
    pauseModal.style.display = 'none';
    isPaused = false;
    noAnswerSeriesStreak = 0;
    btnPlayerPause.disabled = false;
    if (currentCompareNode) {
        playNextCompareRound(currentCompareNode);
        return;
    }
    if (currentPlayingNodeId) {
        const node = window.AppEditorCore.getNode(currentPlayingNodeId);
        if (node) {
            playStimulusNodeSeries(node);
            return;
        }
    }
    if (trainingNode?.params?.trainingType === 'compare') showNextComparison();
    else if (trainingNode?.params) showNextStimulus();
}
function exitTrainingFromPause() {
    pauseModal.style.display = 'none';
    stopPlayer();
}


  window.AppPlayerPreview = {
    displayStimulus,
    hideStimulus,
    updateCounters,
    startPlayer,
    startAutoTraining,
    playNodesSequence,
    playNextQueuedNode,
    playCompareNodeSeries,
    playNextCompareRound,
    finishCompareNodeSeries,
    playStimulusNodeSeries,
    finishStimulusNodeSeries,
    playReadingNode,
    finishReadingNodeAuto,
    finishReadingNode,
    startReadingNodeTimer,
    stopReadingNodeTimer,
    startReadingModeAuto,
    showNextStimulus,
    finishSeries,
    showNextComparison,
    showDirectionComparison,
    showFindSameComparison,
    showFindSameComparisonInternal,
    handleFindSameClick,
    createCellElement,
    defaultCellParams,
    processComparisonAnswer,
    handleDirectionAnswer,
    handleCompareDirectionAnswer,
    stopPlayer,
    togglePause,
    pauseTraining,
    resumeTraining,
    exitTrainingFromPause
  };

  if (window.VLog) VLog.info('[AppPlayerPreview] loaded, 35 functions');
})();
