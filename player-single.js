/* Vissort — PlayerSingle: одиночный и сравнительный режимы плеера.
 * Вынесено из player-runtime.js §15.1.2 ч.7/7.
 * Зависит: PlayerState, PlayerAnimation, PlayerCamera, PlayerGraph, PlayerSession, VissortCore, VLog.
 * Порядок загрузки: после player-session.js, до player-runtime.js.
 */
(function () {
  'use strict';

  function st() { return window.PlayerState; }
  function core() { return window.VissortCore || {}; }
  function stim() { return window.stimDisplay; }

  var _findSameState = null;

  // ---- defaultCellParams ----
  function defaultCellParams() {
    var PS = st();
    var d = (PS.userScenario && PS.userScenario.params && PS.userScenario.params.distanceMeters) || 1;
    var ppi = (PS.userScenario && PS.userScenario.params && PS.userScenario.params.ppi) || PS.screenPPI || 96;
    var acuityToSizePx = core().acuityToSizePx || function () { return 16; };
    return {
      size: acuityToSizePx(1.0, d, ppi),
      stimR: 255, stimG: 255, stimB: 255,
      bgR: 0, bgG: 0, bgB: 0,
      duration: 2000
    };
  }

  // ---- createCellElement ----
  function createCellElement(cell, params, direction, idx) {
    var PS = st();
    var sd = stim();
    var cw = sd.offsetWidth / PS.gridX;
    var ch = sd.offsetHeight / PS.gridY;
    var el = document.createElement('div');
    el.className = 'grid-cell';
    el.style.cssText = 'left:' + (cell.col * cw) + 'px;top:' + (cell.row * ch) + 'px;width:' + cw + 'px;height:' + ch + 'px;display:flex;align-items:center;justify-content:center;background:rgb(' + (params.bgR || 0) + ',' + (params.bgG || 0) + ',' + (params.bgB || 0) + ');position:absolute;box-sizing:border-box;border:3px solid transparent;';
    el.dataset.index = idx !== undefined ? idx : -1;
    var size = params.size || PS.currentSize;
    var p = (PS.userScenario && PS.userScenario.params) || {};
    var getStimulusSVG = core().getStimulusSVG;
    var svgData = getStimulusSVG(
      {
        stimType: p.type || 'LETTER_E',
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
    sd.appendChild(el);
  }

  // ---- showFindSameComparisonInternal ----
  function showFindSameComparisonInternal(pc) {
    var PS = st();
    var need = pc * 2;
    var sh = PS.activeCells.slice().sort(function () { return Math.random() - 0.5; });
    var chosen = sh.slice(0, need);
    var pairs = [];
    for (var i = 0; i < pc; i++)
      pairs.push({ cells: [chosen[i * 2], chosen[i * 2 + 1]], direction: core().randomDirection(), found: false });
    _findSameState = { pairs: pairs, firstSelectedIdx: null, foundCells: new Set(), cells: chosen, pairsCount: pc };
    chosen.forEach(function (cell, idx) {
      var pi = Math.floor(idx / 2);
      var dir = pairs[pi].direction;
      var params =
        PS.cellParams[idx] ||
        PS.cellParams[PS.cellParams.length - 1] ||
        defaultCellParams();
      createCellElement(cell, params, dir, idx);
    });
    window.responseButtons.style.display = 'none';
    document.querySelectorAll('.grid-cell').forEach(function (el) {
      el.onclick = function () { handleFindSameClick(parseInt(el.dataset.index)); };
    });
  }

  // ---- handleFindSameClick ----
  function handleFindSameClick(idx) {
    var PS = st();
    if (!PS.responsePhaseActive || !_findSameState || isNaN(idx)) return;
    var st_ = _findSameState;
    var cell = st_.cells[idx];
    var key = cell.row + ',' + cell.col;
    if (st_.foundCells.has(key)) return;
    if (st_.firstSelectedIdx === null) {
      st_.firstSelectedIdx = idx;
      core().flashCell(idx, 'selected');
      return;
    }
    var fi = st_.firstSelectedIdx;
    if (fi === idx) {
      st_.firstSelectedIdx = null;
      core().flashCell(idx, 'unselect');
      return;
    }
    var fp = Math.floor(fi / 2),
        sp = Math.floor(idx / 2);
    if (fp === sp) {
      var a = st_.cells[fi],
          b = st_.cells[idx];
      st_.foundCells.add(a.row + ',' + a.col);
      st_.foundCells.add(b.row + ',' + b.col);
      st_.pairs[fp].found = true;
      core().flashCell(fi, 'found');
      core().flashCell(idx, 'found');
      st_.firstSelectedIdx = null;
      if (st_.pairs.every(function (p) { return p.found; })) {
        PS.lastResponse = {
          answered: true,
          isCorrect: true,
          reactionTimeMs: Math.max(0, performance.now() - (PS.responseStartTime || performance.now()))
        };
        PS.responsePhaseActive = false;
        processCompareAnswer(true);
      }
    } else {
      core().flashCell(fi, 'unselect');
      core().flashCell(idx, 'wrong');
      st_.firstSelectedIdx = null;
    }
  }

  // ---- showFindSameComparison ----
  function showFindSameComparison() {
    var PS = st();
    var p = (PS.userScenario && PS.userScenario.params) || {};
    var pc = Math.max(1, Math.min(20, parseInt(p.pairsCount || 2)));
    var need = pc * 2;
    var usePc = PS.activeCells.length < need ? Math.floor(PS.activeCells.length / 2) : pc;
    if (usePc < 1) {
      processCompareAnswer(false);
      return;
    }
    showFindSameComparisonInternal(usePc);
  }

  // ---- showDirectionComparison ----
  function showDirectionComparison() {
    var PS = st();
    if (PS.activeCells.length < 2) return;
    var sh = PS.activeCells.slice().sort(function () { return Math.random() - 0.5; });
    var cA = sh[0],
        cB = sh[1];
    var d1 = core().randomDirection(),
        d2 = core().randomDirection();
    PS.currentCompareAnswer = d1 === d2;
    createCellElement(cA, PS.cellParams[0] || defaultCellParams(), d1, 0);
    createCellElement(cB, PS.cellParams[1] || defaultCellParams(), d2, 1);
    document.querySelectorAll('.btn-resp[data-dir]').forEach(function (b) { b.style.display = 'none'; });
    document.querySelectorAll('.btn-resp[data-answer]').forEach(function (b) { b.style.display = 'flex'; });
    window.responseButtons.style.display = 'flex';
  }

  // ---- showNextCompareRound ----
  function showNextCompareRound() {
    var PS = st();
    if (!PS.playerRunning || PS.isPaused) return;
    var p = (PS.userScenario && PS.userScenario.params) || {};
    if (PS.seriesStep >= (p.seriesSize || 6)) {
      finishCompareSeries();
      return;
    }
    window.removeSingleGridLines();
    window.stimDisplay.innerHTML = '';
    window.stimArea.style.background = '#000';
    if (PS.compareMode === 'direction') showDirectionComparison();
    else if (PS.compareMode === 'find_same') showFindSameComparison();
    var dur = (PS.cellParams[0] && PS.cellParams[0].duration) || p.duration || PS.currentDuration;
    PS.currentShowTimer = setTimeout(function () {
      if (PS.responsePhaseActive) {
        PS.lastResponse = { answered: false, isCorrect: false };
        PS.seriesNoAnswer++;
        window.updateCounters();
        window.PlayerSession.saveResult('user_compare', null, false);
        var _p31 = (PS.userScenario && PS.userScenario.params) || {};
        if (PS.seriesStep >= (_p31.seriesSize || 6)) {
          finishCompareSeries();
        } else {
          PS.phaseTimers.push(
            setTimeout(function () {
              if (PS.playerRunning && !PS.isPaused) showNextCompareRound();
            }, _p31.delay2 || 1000)
          );
        }
      }
    }, dur);
    PS.phaseTimers.push(PS.currentShowTimer);
  }

  // ---- processCompareAnswer ----
  function processCompareAnswer(isCorrect) {
    var PS = st();
    if (!PS.playerRunning || PS.isPaused) return;
    if (PS.currentShowTimer) {
      clearTimeout(PS.currentShowTimer);
      PS.currentShowTimer = null;
    }
    var p = (PS.userScenario && PS.userScenario.params) || {};
    if (isCorrect) PS.seriesCorrect++;
    else PS.seriesIncorrect++;
    PS.seriesStep++;
    window.updateCounters();
    window.PlayerSession.saveResult('user_compare', PS.lastResponse.reactionTimeMs, isCorrect);
    if (PS.seriesStep >= (p.seriesSize || 6)) {
      finishCompareSeries();
      return;
    }
    PS.phaseTimers.push(
      setTimeout(function () {
        if (PS.playerRunning && !PS.isPaused) showNextCompareRound();
      }, p.delay2 || 1000)
    );
  }

  // ---- finishCompareSeries ----
  function finishCompareSeries() {
    var PS = st();
    var p = (PS.userScenario && PS.userScenario.params) || {};
    var th = p.seriesThreshold || core().getThreshold(p.seriesSize || 6);
    var ok = PS.seriesCorrect >= th;
    PS.completedSeries++;
    if (ok) PS.successfulSeries++;
    else PS.failedSeries++;
    PS.seriesCorrect = PS.seriesIncorrect = PS.seriesNoAnswer = PS.seriesStep = 0;
    window.updateCounters();
    if (PS.completedSeries >= (p.seriesCount || 5)) {
      window.PlayerSession.showFinishedReport();
      window.PlayerSession.stopPlayer();
      return;
    }
    PS.phaseTimers.push(
      setTimeout(function () {
        if (PS.playerRunning && !PS.isPaused) showNextCompareRound();
      }, p.delay2 || 1000)
    );
  }

  window.PlayerSingle = {
    defaultCellParams: defaultCellParams,
    createCellElement: createCellElement,
    showFindSameComparisonInternal: showFindSameComparisonInternal,
    handleFindSameClick: handleFindSameClick,
    showFindSameComparison: showFindSameComparison,
    showDirectionComparison: showDirectionComparison,
    showNextCompareRound: showNextCompareRound,
    processCompareAnswer: processCompareAnswer,
    finishCompareSeries: finishCompareSeries
  };

  if (window.VLog) VLog.info('[PlayerSingle] loaded');
})();
