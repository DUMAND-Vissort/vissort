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
        stopBlinkAnimation: function () {}
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

    global.PlayerGraph = {
        setCallbacks: setCallbacks,
        gGetNode: gGetNode,
        buildGraphQueue: buildGraphQueue,
        startGraphPlay: startGraphPlay,
        playNextGraphNode: playNextGraphNode,
        recalcStimulusSize: recalcStimulusSize,
        finishGraphStimulusSeries: finishGraphStimulusSeries,
        playGraphCompare: playGraphCompare,
        playGraphCompareRound: playGraphCompareRound,
        finishGraphCompareSeries: finishGraphCompareSeries,
        handleGraphCompareAnswer: handleGraphCompareAnswer,
        processGraphCompareAnswer: processGraphCompareAnswer
    };

    VLog.log('[player-graph] module installed');
})(window);
