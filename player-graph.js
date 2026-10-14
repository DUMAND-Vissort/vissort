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
        playGraphReading: function () {}
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

    global.PlayerGraph = {
        setCallbacks: setCallbacks,
        gGetNode: gGetNode,
        buildGraphQueue: buildGraphQueue,
        startGraphPlay: startGraphPlay,
        playNextGraphNode: playNextGraphNode,
        recalcStimulusSize: recalcStimulusSize
    };

    VLog.log('[player-graph] module installed');
})(window);
