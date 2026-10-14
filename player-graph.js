// player-graph.js — граф-режим плеера (§15.1.2 ч.6/7).
// Зависит: VLog, PlayerState, PlayerReadingMode.
(function (global) {
    'use strict';

    function _PS() { return global.PlayerState; }
    function _el(id) { return document.getElementById(id); }

    var _callbacks = {
        stopPlayer: function () {},
        startPlayer: function () {},
        showStatus: function () {},
        hideStatus: function () {},
        updateCounters: function () {},
        hideStimulus: function () {},
        playGraphStimulus: function () {},
        playGraphCompare: function () {},
        playGraphReading: function () {},
        pauseTraining: function () {},
        defaultCellParams: function () { return { row: 0, col: 0, size: 1, duration: 1000 }; },
        removeSingleGridLines: function () {},
        showDirectionComparison: function () {},
        showFindSameComparison: function () {},
        finishGraphCompareSeries: function () {},
        saveResult: function () {},
        stopSingleStimAnimation: function () {},
        stopSingleBgAnimation: function () {},
        stopCircleAnimation: function () {},
        stopPeripheralAnimation: function () {},
        stopBlinkAnimation: function () {},
        _effectiveDistance: function (d) { return d; },
        displayStimulus: function () {},
        buildDefocusFrame: function () { return null; },
        pickSingleGridCell: function () { return { row: 0, col: 0 }; },
        applySingleGridPosition: function () {},
        applyRandomStimulusPosition: function () {},
        buildPeripheralDots: function () {},
        startSingleStimAnimation: function () {},
        startSingleBgAnimation: function () {},
        startCircleAnimation: function () {},
        startBlinkAnimation: function () {},
        scheduleVoiceCountdown: function () {}
    };

    function setCallbacks(cb) {
        _callbacks = Object.assign({}, _callbacks, cb || {});
    }

    // ==================== Узлы / очередь ====================
    function gGetNode(id) {
        var PS = _PS();
        return PS.gNodes.find(function (n) { return n.id === id; });
    }

    function buildGraphQueue() {
        var PS = _PS();
        PS.gQueue = [];
        if (!PS.gNodes.length) return;
        var startNode = PS.gNodes.find(function (n) { return n.isStart === true; }) || PS.gNodes[0];
        var visited = new Set();
        function visit(nodeId, connection, fromNodeId) {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            PS.gQueue.push({ nodeId: nodeId, connection: connection, fromNodeId: fromNodeId });
            PS.gConnections
                .filter(function (c) { return c.fromId === nodeId && c.isLoop && c.toId !== nodeId; })
                .forEach(function (loop) {
                    var lim = loop.loopLimit || 1;
                    for (var i = 0; i < lim; i++) {
                        PS.gQueue.push({ nodeId: loop.toId, connection: loop, fromNodeId: nodeId });
                        PS.gQueue.push({ nodeId: nodeId, connection: loop, fromNodeId: loop.toId });
                    }
                });
            PS.gConnections
                .filter(function (c) { return c.fromId === nodeId && !c.isLoop && c.toId !== nodeId; })
                .forEach(function (conn) { visit(conn.toId, conn, nodeId); });
        }
        visit(startNode.id, null, null);
    }

    function startGraphPlay(nodes, connections, books) {
        var PS = _PS();
        PS.graphActive = true;
        PS.gNodes = nodes || [];
        PS.gConnections = connections || [];
        if (books && typeof books === 'object') {
            global._books = global._books || {};
            Object.assign(global._books, books);
        }
        buildGraphQueue();
        if (!PS.gQueue.length) {
            _callbacks.stopPlayer();
            return;
        }
        PS.gIndex = 0;
        PS.gCurrentNodeId = null;
        playNextGraphNode();
    }

    function playNextGraphNode() {
        var PS = _PS();
        if (!PS.playerRunning || PS.isPaused) return;
        if (PS.gIndex >= PS.gQueue.length) {
            _callbacks.stopPlayer();
            _callbacks.showStatus('Граф пройден', 'Серий: ' + PS.completedSeries, 'Ещё раз', function () {
                _callbacks.hideStatus();
                _callbacks.startPlayer();
            });
            return;
        }
        var item = PS.gQueue[PS.gIndex];
        var node = gGetNode(item.nodeId);
        if (!node) {
            PS.gIndex++;
            playNextGraphNode();
            return;
        }
        if (node.isActive === false && node.nodeType !== 'LOGIC_IF') {
            PS.gIndex++;
            playNextGraphNode();
            return;
        }
        if (item.connection) {
            var c = item.connection;
            var fn = gGetNode(item.fromNodeId);
            if (fn) {
                if (c.inheritSize) {
                    node.stimAcuity = fn.stimAcuity;
                    node.endAcuity = fn.endAcuity;
                    node.stimDistance = fn.stimDistance;
                    node.stimPPI = fn.stimPPI;
                }
                if (c.inheritSpeed) node.duration = fn.duration;
            }
        }
        if (node.nodeType === 'READING') {
            _callbacks.playGraphReading(node);
            return;
        }
        if (node.nodeType === 'COMPARE') {
            _callbacks.playGraphCompare(node);
            return;
        }
        PS.gCurrentNodeId = node.id;
        PS.completedSeries = PS.successfulSeries = PS.failedSeries = 0;
        PS.seriesCorrect = PS.seriesIncorrect = PS.seriesNoAnswer = 0;
        PS.seriesStep = 0;
        PS.noAnswerSeriesStreak = 0;
        PS.lastDirection = null;
        PS.currentSingleCell = { row: 0, col: 0 };
        PS.gNodeAcuityCurrent = Math.max(0.1, Math.min(1.0, node.stimAcuity || 1.0));
        _callbacks.updateCounters();
        _callbacks.hideStimulus();
        var rb = _el('response-buttons');
        if (rb) rb.style.display = 'none';
        PS.phaseTimers.push(
            setTimeout(function () {
                if (PS.playerRunning && !PS.isPaused) _callbacks.playGraphStimulus(node);
            }, node.delay1 != null ? node.delay1 : 0)
        );
    }

    // ==================== Стимул (граф) ====================
    function playGraphStimulus(node) {
        var PS = _PS();
        if (!PS.playerRunning || PS.isPaused) return;
        if (global._faceLostPause) {
            setTimeout(function () { playGraphStimulus(node); }, 500);
            return;
        }
        if (PS._waitingStable) {
            setTimeout(function () { playGraphStimulus(node); }, 500);
            return;
        }
        PS._answerBlocked = false;
        if (node.minDetectPct != null) PS._minDetectPct = node.minDetectPct;
        if (node.tolNearCm != null) PS._tolNearCm = node.tolNearCm;
        if (node.tolFarCm != null) PS._tolFarCm = node.tolFarCm;
        if (node.distControlMode === 'auto') PS._distControlMode = 'auto';
        else PS._distControlMode = 'return';
        PS.responsePhaseActive = true;
        PS.responseStartTime = performance.now();
        PS.lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
        if (PS.completedSeries >= (node.seriesCount || 5)) {
            PS.gIndex++;
            playNextGraphNode();
            return;
        }
        if (PS.seriesStep >= (node.seriesSize || 6)) {
            finishGraphStimulusSeries(node);
            return;
        }
        var dir;
        if (node.isActive) {
            var d = ['вверх', 'вниз', 'влево', 'вправо'];
            do {
                dir = d[Math.floor(Math.random() * d.length)];
            } while (dir === PS.lastDirection);
        } else dir = node.stimDirectionFixed || 'вверх';
        PS.lastDirection = dir;
        PS.currentCorrectDirection = dir;
        var dCalc = _callbacks._effectiveDistance(node.stimDistance || 1);
        var pCalc = node.stimPPI || PS.screenPPI || 96;
        var acuityToSizePx = (global.VissortCore && global.VissortCore.acuityToSizePx) || function () { return 16; };
        var eff = acuityToSizePx(PS.gNodeAcuityCurrent, dCalc, pCalc);
        PS.currentSize = eff;
        var sc = { r: node.stimR || 255, g: node.stimG || 255, b: node.stimB || 255 };
        if (node.singleStimDynamicEnabled && node.singleStimColor1 && !node.singleCircleEnabled)
            sc = node.singleStimColor1;
        var svgData;
        var getCircleStimulusSVG = (global.VissortCore && global.VissortCore.getCircleStimulusSVG);
        var getStimulusSVG = (global.VissortCore && global.VissortCore.getStimulusSVG);
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
            var frame = _callbacks.buildDefocusFrame(node, svgData.html);
            if (frame) {
                var sd = _el('stim');
                if (sd) { sd.innerHTML = ''; sd.appendChild(frame); }
                var sa = _el('stim-area');
                if (sa) sa.style.backgroundColor = 'rgb(' + node.dfPeriBg.r + ',' + node.dfPeriBg.g + ',' + node.dfPeriBg.b + ')';
            } else _callbacks.displayStimulus(svgData.html, { r: node.bgR || 0, g: node.bgG || 0, b: node.bgB || 0 });
            PS.responseStartTime = performance.now();
        } else _callbacks.displayStimulus(svgData.html, { r: node.bgR || 0, g: node.bgG || 0, b: node.bgB || 0 });
        PS.responseStartTime = performance.now();
        if (node.singleGridEnabled) {
            var gx = node.singleGridX || 1, gy = node.singleGridY || 1;
            var cell = _callbacks.pickSingleGridCell(
                gx,
                gy,
                node.singleGridRandomCell !== false,
                node.singleGridAvoidRepeat !== false,
                node.singleGridFixedRow || 0,
                node.singleGridFixedCol || 0,
                node.singleGridCells || []
            );
            PS.currentSingleCell = cell;
            _callbacks.applySingleGridPosition(eff, gx, gy, cell.row, cell.col, node.singleGridShowLines === true);
        } else if (node.singleRandomPos) _callbacks.applyRandomStimulusPosition(eff);
        _callbacks.buildPeripheralDots(node);
        _callbacks.stopBlinkAnimation();
        if (node.singleCircleEnabled) {
            _callbacks.startCircleAnimation(node);
            _callbacks.stopSingleStimAnimation();
        } else {
            _callbacks.stopCircleAnimation();
            if (node.singleStimDynamicEnabled) _callbacks.startSingleStimAnimation(node);
            else _callbacks.stopSingleStimAnimation();
        }
        if (node.singleBgDynamicEnabled) _callbacks.startSingleBgAnimation(node);
        else _callbacks.stopSingleBgAnimation();
        if (node.blinkEnabled) {
            _callbacks.startBlinkAnimation({
                target: node.blinkTarget || 'stim',
                colorA: node.blinkColorA || { r: 255, g: 0, b: 0 },
                colorB: node.blinkColorB || { r: 0, g: 0, b: 255 },
                intervalMs: node.blinkIntervalMs || 500,
                duty: node.blinkDuty != null ? node.blinkDuty : 0.5,
                count: node.blinkCount || 0
            });
        }

        document.querySelectorAll('.btn-resp[data-dir]').forEach(function (b) { b.style.display = 'flex'; });
        document.querySelectorAll('.btn-resp[data-answer]').forEach(function (b) { b.style.display = 'none'; });
        var rb = _el('response-buttons');
        if (rb) rb.style.display = 'flex';
        if (global.Voice) global.Voice.sayKey('look', { cancel: true });
        var sd2 = (node.duration != null ? node.duration : 1000) + (node.response != null ? node.response : 0);
        if (node.singleStimDynamicEnabled) sd2 = Math.max(sd2, node.singleStimDuration || 0);
        if (node.singleBgDynamicEnabled) sd2 = Math.max(sd2, node.singleBgDuration || 0);
        if (node.singleCircleEnabled) {
            var ci = node.circleInnerEnabled !== false ? node.circleInnerDuration || 0 : 0;
            var co = node.circleOuterEnabled !== false ? node.circleOuterDuration || 0 : 0;
            sd2 = Math.max(sd2, ci, co);
        }
        _callbacks.scheduleVoiceCountdown(sd2);
        PS.currentShowTimer = setTimeout(function () {
            _callbacks.hideStimulus();
            PS.responsePhaseActive = false;
            _callbacks.stopSingleStimAnimation();
            _callbacks.stopSingleBgAnimation();
            _callbacks.stopCircleAnimation();
            _callbacks.stopPeripheralAnimation();
            _callbacks.stopBlinkAnimation();
            if (PS.lastResponse.answered) {
                if (PS.lastResponse.isCorrect) PS.seriesCorrect++;
                else PS.seriesIncorrect++;
                PS.seriesStep++;
            } else {
                PS.seriesNoAnswer++;
                _callbacks.saveResult(node.id, null, false);
                if (PS.seriesStep === 0 && PS.seriesNoAnswer >= (node.seriesSize || 6)) {
                    VLog.log('[pause] полная серия без ответов, пауза');
                    PS.seriesNoAnswer = 0;
                    _callbacks.pauseTraining();
                    return;
                }
            }
            _callbacks.updateCounters();
            PS.phaseTimers.push(
                setTimeout(function () {
                    if (PS.playerRunning && !PS.isPaused) playGraphStimulus(node);
                }, node.delay2 || 1000)
            );
        }, sd2);
        PS.phaseTimers.push(PS.currentShowTimer);
    }
    // Авто-пересчёт размера стимула под новую дистанцию (§15.1.2 ч.6/7-2a)
    function recalcStimulusSize() {
        var PS = _PS();
        if (!PS.curDistanceM) return;
        var node = gGetNode(PS.gCurrentNodeId);
        if (!node) return;
        var ppi = node.stimPPI || PS.screenPPI || 96;
        var acuityToSizePx = (global.VissortCore && global.VissortCore.acuityToSizePx) || function () { return 16; };
        var eff = acuityToSizePx(PS.gNodeAcuityCurrent || 1.0, PS.curDistanceM, ppi);
        PS.currentSize = eff;
        var svg = document.querySelector('#stim svg');
        if (svg) {
            svg.setAttribute('width', eff);
            svg.setAttribute('height', eff);
            svg.setAttribute('viewBox', '0 0 ' + eff + ' ' + eff);
        }
        PS._stimulusDistance = PS.curDistanceM;
        VLog.log('[auto-recalc] size updated to ' + eff + 'px at ' + PS.curDistanceM.toFixed(2) + 'm');
    }

    // ==================== Завершение серии стимулов ====================
    function finishGraphStimulusSeries(node) {
        var PS = _PS();
        var getThreshold = (global.VissortCore && global.VissortCore.getThreshold) || function () { return 5; };
        var th = node.seriesThreshold || getThreshold(node.seriesSize || 6);
        var ok = PS.seriesCorrect >= th;
        var allNo = PS.seriesNoAnswer === (node.seriesSize || 6);
        if (allNo) PS.noAnswerSeriesStreak++;
        else PS.noAnswerSeriesStreak = 0;
        PS.completedSeries++;
        if (ok) PS.successfulSeries++;
        else PS.failedSeries++;
        // Адаптивная острота зрения
        if (node.adaptiveAcuity !== false) {
            if (ok) {
                var eA = node.endAcuity != null ? node.endAcuity : node.stimAcuity || 1.0;
                if (PS.gNodeAcuityCurrent < eA)
                    PS.gNodeAcuityCurrent = Math.min(
                        eA,
                        Math.round((PS.gNodeAcuityCurrent + (node.acuityStep || 0.1)) * 10) / 10
                    );
            } else {
                var sA = node.stimAcuity || 1.0;
                if (PS.gNodeAcuityCurrent > sA)
                    PS.gNodeAcuityCurrent = Math.max(
                        sA,
                        Math.round((PS.gNodeAcuityCurrent - (node.acuityStep || 0.1)) * 10) / 10
                    );
            }
        }
        PS.seriesCorrect =
            PS.seriesIncorrect =
            PS.seriesNoAnswer =
            PS.seriesStep =
                0;
        PS.lastDirection = null;
        _callbacks.updateCounters();
        // Отчёт отключён, только лог ответов
        // Агрегат времени реакции
        try {
            if (!global._reactionTimes) global._reactionTimes = [];
            var _rt = PS.lastResponse && PS.lastResponse.reactionTimeMs;
            if (_rt != null) global._reactionTimes.push(_rt);
            var _recent = global._reactionTimes.slice(-20);
            var _avg = _recent.reduce(function (a, b) { return a + b; }, 0) / _recent.length;
            var _min = Math.min.apply(null, _recent);
            var _max = Math.max.apply(null, _recent);
        } catch (e) {}
        if (PS.noAnswerSeriesStreak >= 3) {
            _callbacks.pauseTraining();
            return;
        }
        if (PS.completedSeries >= (node.seriesCount || 5)) {
            PS.gIndex++;
            playNextGraphNode();
            return;
        }
        PS.phaseTimers.push(
            setTimeout(
                function () {
                    if (PS.playerRunning && !PS.isPaused) _callbacks.playGraphStimulus(node);
                },
                node.delay2 != null ? node.delay2 : 500
            )
        );
    }

    // ==================== Сравнение ====================
    function playGraphCompare(node) {
        var PS = _PS();
        if (!PS.playerRunning || PS.isPaused) return;
        PS.gCurrentCompareNode = node;
        PS.gCurrentNodeId = node.id;
        PS.completedSeries = PS.successfulSeries = PS.failedSeries = 0;
        PS.seriesCorrect = PS.seriesIncorrect = PS.seriesNoAnswer = 0;
        PS.seriesStep = 0;
        PS.noAnswerSeriesStreak = 0;
        PS.compareMode = node.compareMode || 'direction';
        PS.gridX = Math.max(2, Math.min(6, parseInt(node.gridX) || 3));
        PS.gridY = Math.max(1, Math.min(6, parseInt(node.gridY) || 3));
        PS.activeCells = (node.activeCells || []).slice();
        PS.cellParams = (node.cellParams || []).slice();
        if (PS.activeCells.length < 2)
            PS.activeCells = [
                { row: 0, col: 0 },
                { row: 0, col: 1 }
            ];
        while (PS.cellParams.length < PS.activeCells.length)
            PS.cellParams.push(_callbacks.defaultCellParams());
        _callbacks.updateCounters();
        _callbacks.hideStimulus();
        var rb = _el('response-buttons');
        if (rb) rb.style.display = 'none';
        PS.phaseTimers.push(
            setTimeout(
                function () {
                    if (PS.playerRunning && !PS.isPaused) playGraphCompareRound(node);
                },
                node.delay1 != null ? node.delay1 : 0
            )
        );
    }

    function playGraphCompareRound(node) {
        var PS = _PS();
        if (!PS.playerRunning || PS.isPaused) return;
        if (PS._waitingStable) {
            setTimeout(function () { playGraphCompareRound(node); }, 500);
            return;
        }
        if (PS.seriesStep >= (node.seriesSize || 6)) {
            _callbacks.finishGraphCompareSeries(node);
            return;
        }
        _callbacks.removeSingleGridLines();
        var sd = _el('stim');
        if (sd) sd.innerHTML = '';
        var sa = _el('stim-area');
        if (sa) sa.style.background = '#000';
        if (PS.compareMode === 'direction') _callbacks.showDirectionComparison();
        else if (PS.compareMode === 'find_same') _callbacks.showFindSameComparison();
        var dur = (PS.cellParams[0] && PS.cellParams[0].duration) || node.duration || PS.currentDuration;
        PS.currentShowTimer = setTimeout(function () {
            if (PS.responsePhaseActive) {
                PS.lastResponse = { answered: false, isCorrect: false };
                PS.seriesNoAnswer++;
                _callbacks.updateCounters();
                _callbacks.saveResult(PS.gCurrentNodeId || 'graph_compare', null, false);
                var _n31 = gGetNode(PS.gCurrentNodeId);
                if (_n31) {
                    if (PS.seriesStep >= (_n31.seriesSize || 6)) {
                        _callbacks.finishGraphCompareSeries(_n31);
                    } else {
                        PS.phaseTimers.push(
                            setTimeout(function () {
                                if (PS.playerRunning && !PS.isPaused)
                                    playGraphCompareRound(_n31);
                            }, _n31.delay2 || 1000)
                        );
                    }
                }
            }
        }, dur);
        PS.phaseTimers.push(PS.currentShowTimer);
    }

    // ==================== Завершение серии сравнения ====================
    function finishGraphCompareSeries(node) {
        var PS = _PS();
        if (!node) {
            PS.gIndex++;
            playNextGraphNode();
            return;
        }
        var getThreshold = (global.VissortCore && global.VissortCore.getThreshold) || function () { return 5; };
        var th = node.seriesThreshold || getThreshold(node.seriesSize || 6);
        var ok = PS.seriesCorrect >= th;
        PS.completedSeries++;
        if (ok) PS.successfulSeries++;
        else PS.failedSeries++;
        PS.seriesCorrect =
            PS.seriesIncorrect =
            PS.seriesNoAnswer =
            PS.seriesStep =
                0;
        _callbacks.updateCounters();
        if (PS.completedSeries >= (node.seriesCount || 5)) {
            PS.gCurrentCompareNode = null;
            PS.gIndex++;
            playNextGraphNode();
            return;
        }
        PS.phaseTimers.push(
            setTimeout(
                function () {
                    if (PS.playerRunning && !PS.isPaused) playGraphCompareRound(node);
                },
                node.delay2 != null ? node.delay2 : 500
            )
        );
    }

    // ==================== Ответ на сравнение ====================
    function handleGraphCompareAnswer(answer) {
        var PS = _PS();
        if (!PS.responsePhaseActive) return;
        if (PS._answerBlocked) return;
        var _inv32 = global._isAnswerInvalid ? global._isAnswerInvalid() : null;
        if (_inv32) {
            PS.lastResponse = {
                answered: true,
                isCorrect: false,
                reactionTimeMs: Math.max(0, performance.now() - (PS.responseStartTime || performance.now())),
                invalidReason: _inv32
            };
            if (global._logAnswer)
                global._logAnswer({
                    rt: PS.lastResponse.reactionTimeMs,
                    valid: false,
                    correct: false,
                    reason: PS.lastResponse.invalidReason || 'unknown'
                });
            PS.responsePhaseActive = false;
            if (global._markAnswerInvalid) global._markAnswerInvalid(_inv32);
            if (global.Voice) global.Voice.sayKey('wrong', { cancel: true });
            document.body.style.background = '#78350f';
            setTimeout(function () {
                document.body.style.background = '#0b0b0f';
            }, 300);
            return;
        }

        var ok = answer === PS.currentCompareAnswer;

        // Очистка таймера и DOM сразу после ответа
        if (PS.currentShowTimer) {
            clearTimeout(PS.currentShowTimer);
            PS.currentShowTimer = null;
        }
        if (PS.phaseTimers && PS.phaseTimers.length) {
            PS.phaseTimers.forEach(function (t) { clearTimeout(t); });
            PS.phaseTimers = [];
        }
        try {
            var _el34 = document.getElementById('stim');
            if (_el34) _el34.innerHTML = '';
        } catch (e) {}
        try {
            var _ar34 = document.getElementById('stim-display');
            if (_ar34) _ar34.style.backgroundColor = '';
        } catch (e) {}
        try { _callbacks.stopSingleStimAnimation(); } catch (e) {}
        try { _callbacks.stopSingleBgAnimation(); } catch (e) {}
        try { _callbacks.stopCircleAnimation(); } catch (e) {}
        try { _callbacks.stopPeripheralAnimation(); } catch (e) {}
        try { _callbacks.stopBlinkAnimation(); } catch (e) {}
        PS.lastResponse = {
            answered: true,
            isCorrect: ok,
            reactionTimeMs: Math.max(0, performance.now() - (PS.responseStartTime || performance.now()))
        };
        if (global._logAnswer)
            global._logAnswer({
                rt: PS.lastResponse.reactionTimeMs,
                valid: true,
                correct: ok,
                direction: typeof answer !== 'undefined' ? String(answer) : null
            });
        PS.responsePhaseActive = false;
        if (global.Voice) global.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
        document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
        setTimeout(function () {
            document.body.style.background = '#0b0b0f';
        }, 200);
        processGraphCompareAnswer(ok);
    }

    function processGraphCompareAnswer(isCorrect) {
        var PS = _PS();
        if (isCorrect) PS.seriesCorrect++;
        else PS.seriesIncorrect++;
        PS.seriesStep++;
        _callbacks.updateCounters();
        _callbacks.saveResult(PS.gCurrentNodeId || 'graph_compare', PS.lastResponse.reactionTimeMs, isCorrect);
        var node = gGetNode(PS.gCurrentNodeId);
        if (!node) {
            PS.gIndex++;
            playNextGraphNode();
            return;
        }
        if (PS.seriesStep >= (node.seriesSize || 6)) {
            finishGraphCompareSeries(node);
            return;
        }
        PS.phaseTimers.push(
            setTimeout(function () {
                if (PS.playerRunning && !PS.isPaused) playGraphCompareRound(node);
            }, node.delay2 || 1000)
        );
    }

    // ==================== Ответ на направление ====================
    function handleGraphDirectionAnswer(dir) {
        var PS = _PS();
        if (!PS.responsePhaseActive) return;
        if (PS._answerBlocked) return;
        var _inv32 = global._isAnswerInvalid ? global._isAnswerInvalid() : null;
        if (_inv32) {
            PS.lastResponse = {
                answered: true,
                isCorrect: false,
                reactionTimeMs: Math.max(0, performance.now() - (PS.responseStartTime || performance.now())),
                invalidReason: _inv32
            };
            if (global._logAnswer)
                global._logAnswer({
                    rt: PS.lastResponse.reactionTimeMs,
                    valid: false,
                    correct: false,
                    reason: PS.lastResponse.invalidReason || 'unknown'
                });
            PS.responsePhaseActive = false;
            if (global._markAnswerInvalid) global._markAnswerInvalid(_inv32);
            if (global.Voice) global.Voice.sayKey('wrong', { cancel: true });
            document.body.style.background = '#78350f';
            setTimeout(function () {
                document.body.style.background = '#0b0b0f';
            }, 300);
            return;
        }

        var ok = dir === PS.currentCorrectDirection;

        // Очистка таймера и DOM сразу после ответа
        if (PS.currentShowTimer) {
            clearTimeout(PS.currentShowTimer);
            PS.currentShowTimer = null;
        }
        if (PS.phaseTimers && PS.phaseTimers.length) {
            PS.phaseTimers.forEach(function (t) { clearTimeout(t); });
            PS.phaseTimers = [];
        }
        try {
            var _el34 = document.getElementById('stim');
            if (_el34) _el34.innerHTML = '';
        } catch (e) {}
        try {
            var _ar34 = document.getElementById('stim-display');
            if (_ar34) _ar34.style.backgroundColor = '';
        } catch (e) {}
        try { _callbacks.stopSingleStimAnimation(); } catch (e) {}
        try { _callbacks.stopSingleBgAnimation(); } catch (e) {}
        try { _callbacks.stopCircleAnimation(); } catch (e) {}
        try { _callbacks.stopPeripheralAnimation(); } catch (e) {}
        try { _callbacks.stopBlinkAnimation(); } catch (e) {}
        PS.lastResponse = {
            answered: true,
            isCorrect: ok,
            reactionTimeMs: Math.max(0, performance.now() - (PS.responseStartTime || performance.now()))
        };
        if (global._logAnswer)
            global._logAnswer({
                rt: PS.lastResponse.reactionTimeMs,
                valid: true,
                correct: ok,
                direction: typeof dir !== 'undefined' ? String(dir) : null
            });
        PS.responsePhaseActive = false;
        if (global.Voice) global.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
        document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
        setTimeout(function () {
            document.body.style.background = '#0b0b0f';
        }, 200);
        _callbacks.saveResult(PS.gCurrentNodeId || 'graph_single', PS.lastResponse.reactionTimeMs, ok);

        // Продвижение серии сразу
        if (ok) PS.seriesCorrect++;
        else PS.seriesIncorrect++;
        PS.seriesStep++;
        _callbacks.updateCounters();
        var _n35 = gGetNode(PS.gCurrentNodeId);
        if (_n35) {
            if (PS.seriesStep >= (_n35.seriesSize || 6)) {
                setTimeout(function () {
                    finishGraphStimulusSeries(_n35);
                }, 50);
            } else {
                setTimeout(
                    function () {
                        if (PS.playerRunning && !PS.isPaused) _callbacks.playGraphStimulus(_n35);
                    },
                    _n35.delay2 != null ? _n35.delay2 : 1000
                );
            }
        }
    }

    // ==================== Чтение в графе ====================
    function playGraphReading(node) {
        var PS = _PS();
        if (!PS.playerRunning || PS.isPaused) return;
        PS.gCurrentNodeId = node.id;

        var bid = node.bookId;
        if (!bid && global._books) {
            var keys = Object.keys(global._books);
            if (keys.length) bid = keys[0];
        }
        var bk = bid ? (global._books && global._books[bid]) : null;
        var text = bk ? bk.text : node.bookText || 'Текст не задан.';

        var dCalc = _callbacks._effectiveDistance(node.readingDistance || 1);

        global.PlayerReadingMode.start({
            mode: 'graph',
            text: text,
            textColor: node.readingTextColor,
            bgMode: node.readingBgMode || 'solid',
            bgColor: node.readingBgColor || { r: 255, g: 255, b: 255 },
            splitLeftWidthPercent: node.readingSplitLeftWidthPercent,
            splitLeftColor: node.readingSplitLeftColor,
            splitRightColor: node.readingSplitRightColor,
            gradientMidEnabled: node.readingGradientMidEnabled,
            gradientLeftColor: node.readingGradientLeftColor,
            gradientMidColor: node.readingGradientMidColor,
            gradientMidPosition: node.readingGradientMidPosition,
            gradientRightColor: node.readingGradientRightColor,
            dynamicMode: node.readingDynamicMode || 'simple',
            dynamicReverse: node.readingDynamicReverse,
            dynamicMidEnabled: node.readingDynamicMidEnabled,
            dynamicStartColor: node.readingDynamicStartColor,
            dynamicMidColor: node.readingDynamicMidColor,
            dynamicEndColor: node.readingDynamicEndColor,
            dynamicDuration: node.readingDynamicDuration,
            dynamicLoop: node.readingDynamicLoop,
            readingFontFamily: node.readingFontFamily || 'Segoe UI',
            readingFontWeight: node.readingFontWeight || 'normal',
            acuity: node.readingAcuity || 1.0,
            distance: dCalc,
            duration: node.duration || 60000,
            onFinish: function () { finishGraphReading(node); }
        });

        if (PS._readingTimerId) {
            PS.phaseTimers.push(PS._readingTimerId);
        }
    }

    function finishGraphReading(node) {
        var PS = _PS();
        if (PS._readingFinishGuard) return;
        PS._readingFinishGuard = true;

        if (PS._readingTimerId) {
            clearTimeout(PS._readingTimerId);
            PS._readingTimerId = null;
        }
        if (global.PlayerReadingMode && global.PlayerReadingMode.hideDOM) global.PlayerReadingMode.hideDOM();
        PS.gIndex++;
        playNextGraphNode();
    }

    global.PlayerGraph = {
        setCallbacks: setCallbacks,
        gGetNode: gGetNode,
        buildGraphQueue: buildGraphQueue,
        startGraphPlay: startGraphPlay,
        playNextGraphNode: playNextGraphNode,
        playGraphStimulus: playGraphStimulus,
        recalcStimulusSize: recalcStimulusSize,
        finishGraphStimulusSeries: finishGraphStimulusSeries,
        playGraphCompare: playGraphCompare,
        playGraphCompareRound: playGraphCompareRound,
        finishGraphCompareSeries: finishGraphCompareSeries,
        handleGraphCompareAnswer: handleGraphCompareAnswer,
        processGraphCompareAnswer: processGraphCompareAnswer,
        handleGraphDirectionAnswer: handleGraphDirectionAnswer,
        playGraphReading: playGraphReading,
        finishGraphReading: finishGraphReading
    };

    VLog.log('[player-graph] module installed');
})(window);
