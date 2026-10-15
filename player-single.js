/* Vissort — PlayerSingle: одиночный и сравнительный режимы плеера.
 * Вынесено из player-runtime.js §15.1.2 ч.7/7.
 * Зависит: PlayerState, PlayerAnimation, PlayerCamera, PlayerGraph, PlayerSession, PlayerUtils, PlayerInvalidDetection, VissortCore, Voice, VLog.
 * Порядок загрузки: после player-session.js, до player-runtime.js.
 */
(function () {
  'use strict';

  function st() { return window.PlayerState; }
  function core() { return window.VissortCore || {}; }
  function anim() { return window.PlayerAnimation || {}; }
  function cam() { return window.PlayerCamera || {}; }
  function putil() { return window.PlayerUtils || {}; }
  function stim() { return window.stimDisplay; }
  function area() { return window.stimArea; }
  function rbtns() { return window.responseButtons; }

  var _findSameState = null;

  // ---- displayStimulus / hideStimulus ----
  function displayStimulus(html, bg) {
    var PS = st();
    stim().innerHTML = html;
    area().style.backgroundColor = 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')';
    PS._stimulusDistance = PS.curDistanceM;
  }

  function hideStimulus() {
    anim().stopSingleStimAnimation && anim().stopSingleStimAnimation();
    anim().stopSingleBgAnimation && anim().stopSingleBgAnimation();
    anim().stopCircleAnimation && anim().stopCircleAnimation();
    anim().stopPeripheralAnimation && anim().stopPeripheralAnimation();
    anim().stopBlinkAnimation && anim().stopBlinkAnimation();
    if (typeof window.removeSingleGridLines === 'function') window.removeSingleGridLines();
    var sd = stim();
    sd.innerHTML = '';
    sd.style.fontSize = '';
    sd.style.backgroundColor = '';
    area().style.backgroundColor = '';
  }

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

  // ---- showNextStimulus ----
  function showNextStimulus() {
    var PS = st();
    var A = anim();
    var C = core();
    var checkHardLimit = cam()._checkHardLimit || function () { return true; };

    if (!checkHardLimit()) {
      setTimeout(showNextStimulus, 500);
      return;
    }
    if (!PS.playerRunning || PS.isPaused) return;
    if (window._faceLostPause) {
      setTimeout(showNextStimulus, 500);
      return;
    }
    if (PS._waitingStable) {
      setTimeout(showNextStimulus, 500);
      return;
    }
    PS.responsePhaseActive = true;
    PS.responseStartTime = performance.now();
    PS.lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    var p = (PS.userScenario && PS.userScenario.params) || {};
    if (PS.seriesStep >= (p.seriesSize || 6)) {
      finishSeries();
      return;
    }
    var dir;
    if (p.isActive) {
      var d = ['вверх', 'вниз', 'влево', 'вправо'];
      do {
        dir = d[Math.floor(Math.random() * d.length)];
      } while (dir === PS.lastDirection);
    } else dir = 'вверх';
    PS.lastDirection = dir;
    PS.currentCorrectDirection = dir;
    var dCalc = putil().effectiveDistance ? putil().effectiveDistance(p.distanceMeters || 1, PS.curDistanceM) : (p.distanceMeters || 1);
    var eff = C.acuityToSizePx(PS.currentAcuity, dCalc, PS.screenPPI);
    PS.currentSize = eff;
    var sc = PS.currentStimColor;
    if (p.singleStimDynamicEnabled && p.singleStimColor1 && !p.singleCircleEnabled) sc = p.singleStimColor1;
    var svgData;
    if (p.singleCircleEnabled) svgData = C.getCircleStimulusSVG(p, eff);
    else
      svgData = C.getStimulusSVG(
        {
          stimType: p.type || 'LETTER_E',
          stimDirection: dir,
          stimR: sc.r,
          stimG: sc.g,
          stimB: sc.b,
          bgR: PS.currentBgColor.r,
          bgG: PS.currentBgColor.g,
          bgB: PS.currentBgColor.b
        },
        eff
      );
    if (p.dfEnabled) {
      var frame = A.buildDefocusFrame(p, svgData.html);
      if (frame) {
        stim().innerHTML = '';
        stim().appendChild(frame);
        area().style.backgroundColor = 'rgb(' + p.dfPeriBg.r + ',' + p.dfPeriBg.g + ',' + p.dfPeriBg.b + ')';
      } else displayStimulus(svgData.html, PS.currentBgColor);
      PS.responseStartTime = performance.now();
    } else displayStimulus(svgData.html, PS.currentBgColor);
    PS.responseStartTime = performance.now();
    if (p.singleGridEnabled) {
      var gx = p.singleGridX || 1,
          gy = p.singleGridY || 1;
      var cell = A.pickSingleGridCell(
        gx,
        gy,
        p.singleGridRandomCell !== false,
        p.singleGridAvoidRepeat !== false,
        p.singleGridFixedRow || 0,
        p.singleGridFixedCol || 0,
        p.singleGridCells || []
      );
      PS.currentSingleCell = cell;
      A.applySingleGridPosition(eff, gx, gy, cell.row, cell.col, p.singleGridShowLines === true);
    } else if (p.singleRandomPos) A.applyRandomStimulusPosition(eff);
    A.buildPeripheralDots(p);
    A.stopBlinkAnimation();
    if (p.singleCircleEnabled) {
      A.startCircleAnimation(p);
      A.stopSingleStimAnimation();
    } else {
      A.stopCircleAnimation();
      if (p.singleStimDynamicEnabled) A.startSingleStimAnimation(p);
      else A.stopSingleStimAnimation();
    }
    if (p.singleBgDynamicEnabled) A.startSingleBgAnimation(p);
    else A.stopSingleBgAnimation();
    if (p.blinkEnabled) {
      A.startBlinkAnimation({
        target: p.blinkTarget || 'stim',
        colorA: p.blinkColorA || { r: 255, g: 0, b: 0 },
        colorB: p.blinkColorB || { r: 0, g: 0, b: 255 },
        intervalMs: p.blinkIntervalMs || 500,
        duty: p.blinkDuty != null ? p.blinkDuty : 0.5,
        count: p.blinkCount || 0
      });
    }
    document.querySelectorAll('.btn-resp[data-dir]').forEach(function (b) { b.style.display = 'flex'; });
    document.querySelectorAll('.btn-resp[data-answer]').forEach(function (b) { b.style.display = 'none'; });
    rbtns().style.display = 'flex';
    if (window.Voice) window.Voice.sayKey('look', { cancel: true });
    var sd = PS.currentDuration + (p.response != null ? p.response : 0);
    if (p.singleStimDynamicEnabled) sd = Math.max(sd, p.singleStimDuration || 0);
    if (p.singleBgDynamicEnabled) sd = Math.max(sd, p.singleBgDuration || 0);
    if (p.singleCircleEnabled) {
      var ci = p.circleInnerEnabled !== false ? p.circleInnerDuration || 0 : 0;
      var co = p.circleOuterEnabled !== false ? p.circleOuterDuration || 0 : 0;
      sd = Math.max(sd, ci, co);
    }
    window.PlayerSession.scheduleVoiceCountdown(sd);
    PS.currentShowTimer = setTimeout(function () {
      hideStimulus();
      PS.responsePhaseActive = false;
      A.stopSingleStimAnimation();
      A.stopSingleBgAnimation();
      A.stopCircleAnimation();
      A.stopPeripheralAnimation();
      A.stopBlinkAnimation();
      if (PS.lastResponse.answered) {
        if (PS.lastResponse.isCorrect) PS.seriesCorrect++;
        else PS.seriesIncorrect++;
        PS.seriesStep++;
      } else {
        PS.seriesNoAnswer++;
        if (window.Voice) window.Voice.sayKey('timeout', { cancel: true });
        window.PlayerSession.saveResult('user_single', null, false);
        if (PS.seriesStep === 0 && PS.seriesNoAnswer >= (p.seriesSize || 6)) {
          if (window.VLog) VLog.log('[pause] полная серия без ответов, пауза');
          PS.seriesNoAnswer = 0;
          window.PlayerSession.pauseTraining();
          return;
        }
      }
      if (typeof window.updateCounters === 'function') window.updateCounters();
      PS.phaseTimers.push(
        setTimeout(function () {
          if (PS.playerRunning && !PS.isPaused) showNextStimulus();
        }, p.delay2 || 1000)
      );
    }, sd);
    PS.phaseTimers.push(PS.currentShowTimer);
  }

  // ---- finishSeries ----
  function finishSeries() {
    var PS = st();
    var p = (PS.userScenario && PS.userScenario.params) || {};
    var th = p.seriesThreshold || (core().getThreshold ? core().getThreshold(p.seriesSize || 6) : 5);
    var ok = PS.seriesCorrect >= th;
    PS.completedSeries++;
    if (ok) PS.successfulSeries++;
    else PS.failedSeries++;
    PS.seriesCorrect = PS.seriesIncorrect = PS.seriesNoAnswer = PS.seriesStep = 0;
    if (typeof window.updateCounters === 'function') window.updateCounters();
    if (PS.completedSeries >= (p.seriesCount || 5)) {
      window.PlayerSession.showFinishedReport();
      window.PlayerSession.stopPlayer();
      return;
    }
    PS.phaseTimers.push(
      setTimeout(function () {
        if (PS.playerRunning && !PS.isPaused) showNextStimulus();
      }, p.delay2 || 1000)
    );
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
    rbtns().style.display = 'none';
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
    rbtns().style.display = 'flex';
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
    if (typeof window.removeSingleGridLines === 'function') window.removeSingleGridLines();
    stim().innerHTML = '';
    area().style.background = '#000';
    if (PS.compareMode === 'direction') showDirectionComparison();
    else if (PS.compareMode === 'find_same') showFindSameComparison();
    var dur = (PS.cellParams[0] && PS.cellParams[0].duration) || p.duration || PS.currentDuration;
    PS.currentShowTimer = setTimeout(function () {
      if (PS.responsePhaseActive) {
        PS.lastResponse = { answered: false, isCorrect: false };
        PS.seriesNoAnswer++;
        if (typeof window.updateCounters === 'function') window.updateCounters();
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
    if (typeof window.updateCounters === 'function') window.updateCounters();
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
    var th = p.seriesThreshold || (core().getThreshold ? core().getThreshold(p.seriesSize || 6) : 5);
    var ok = PS.seriesCorrect >= th;
    PS.completedSeries++;
    if (ok) PS.successfulSeries++;
    else PS.failedSeries++;
    PS.seriesCorrect = PS.seriesIncorrect = PS.seriesNoAnswer = PS.seriesStep = 0;
    if (typeof window.updateCounters === 'function') window.updateCounters();
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

  // ---- handleDirectionAnswer ----
  function handleDirectionAnswer(direction) {
    var PS = st();
    if (!PS.responsePhaseActive) return;
    if (PS._answerBlocked) return;
    var _inv32 = window._isAnswerInvalid ? window._isAnswerInvalid() : null;
    if (_inv32) {
      PS.lastResponse = {
        answered: true,
        isCorrect: false,
        reactionTimeMs: Math.max(0, performance.now() - (PS.responseStartTime || performance.now())),
        invalidReason: _inv32
      };
      if (window._logAnswer)
        window._logAnswer({
          rt: PS.lastResponse.reactionTimeMs,
          valid: false,
          correct: false,
          reason: PS.lastResponse.invalidReason || 'unknown'
        });
      PS.responsePhaseActive = false;
      if (window._markAnswerInvalid) window._markAnswerInvalid(_inv32);
      if (window.Voice) window.Voice.sayKey('wrong', { cancel: true });
      document.body.style.background = '#78350f';
      setTimeout(function () { document.body.style.background = '#0b0b0f'; }, 300);
      return;
    }

    var ok = direction === PS.currentCorrectDirection;
    if (PS.currentShowTimer) {
      clearTimeout(PS.currentShowTimer);
      PS.currentShowTimer = null;
    }
    if (PS.phaseTimers && PS.phaseTimers.length) {
      PS.phaseTimers.forEach(function (t) { clearTimeout(t); });
      PS.phaseTimers = [];
    }
    try { var _el34 = document.getElementById('stim'); if (_el34) _el34.innerHTML = ''; } catch (e) {}
    try { var _ar34 = document.getElementById('stim-display'); if (_ar34) _ar34.style.backgroundColor = ''; } catch (e) {}
    try { anim().stopSingleStimAnimation(); } catch (e) {}
    try { anim().stopSingleBgAnimation(); } catch (e) {}
    try { anim().stopCircleAnimation(); } catch (e) {}
    try { anim().stopPeripheralAnimation(); } catch (e) {}
    try { anim().stopBlinkAnimation(); } catch (e) {}
    PS.lastResponse = {
      answered: true,
      isCorrect: ok,
      reactionTimeMs: Math.max(0, performance.now() - (PS.responseStartTime || performance.now()))
    };
    if (window._logAnswer)
      window._logAnswer({
        rt: PS.lastResponse.reactionTimeMs,
        valid: true,
        correct: ok,
        direction: typeof direction !== 'undefined' ? direction : null
      });
    PS.responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(function () { document.body.style.background = '#0b0b0f'; }, 200);
    window.PlayerSession.saveResult('user_single', PS.lastResponse.reactionTimeMs, ok);
    if (ok) PS.seriesCorrect++;
    else PS.seriesIncorrect++;
    PS.seriesStep++;
    if (typeof window.updateCounters === 'function') window.updateCounters();
    var _p = (PS.userScenario && PS.userScenario.params) || {};
    if (PS.seriesStep >= (_p.seriesSize || 6)) {
      setTimeout(function () {
        if (PS.playerRunning && !PS.isPaused) finishSeries();
      }, 50);
    } else {
      setTimeout(
        function () {
          if (PS.playerRunning && !PS.isPaused) showNextStimulus();
        },
        _p.delay2 != null ? _p.delay2 : 1000
      );
    }
  }

  // ---- handleCompareAnswer ----
  function handleCompareAnswer(answer) {
    var PS = st();
    if (!PS.responsePhaseActive) return;
    if (PS._answerBlocked) return;
    var _inv32 = window._isAnswerInvalid ? window._isAnswerInvalid() : null;
    if (_inv32) {
      PS.lastResponse = {
        answered: true,
        isCorrect: false,
        reactionTimeMs: Math.max(0, performance.now() - (PS.responseStartTime || performance.now())),
        invalidReason: _inv32
      };
      if (window._logAnswer)
        window._logAnswer({
          rt: PS.lastResponse.reactionTimeMs,
          valid: false,
          correct: false,
          reason: PS.lastResponse.invalidReason || 'unknown'
        });
      PS.responsePhaseActive = false;
      if (window._markAnswerInvalid) window._markAnswerInvalid(_inv32);
      if (window.Voice) window.Voice.sayKey('wrong', { cancel: true });
      document.body.style.background = '#78350f';
      setTimeout(function () { document.body.style.background = '#0b0b0f'; }, 300);
      return;
    }

    var ok = answer === PS.currentCompareAnswer;
    if (PS.currentShowTimer) {
      clearTimeout(PS.currentShowTimer);
      PS.currentShowTimer = null;
    }
    if (PS.phaseTimers && PS.phaseTimers.length) {
      PS.phaseTimers.forEach(function (t) { clearTimeout(t); });
      PS.phaseTimers = [];
    }
    try { var _el34 = document.getElementById('stim'); if (_el34) _el34.innerHTML = ''; } catch (e) {}
    try { var _ar34 = document.getElementById('stim-display'); if (_ar34) _ar34.style.backgroundColor = ''; } catch (e) {}
    try { anim().stopSingleStimAnimation(); } catch (e) {}
    try { anim().stopSingleBgAnimation(); } catch (e) {}
    try { anim().stopCircleAnimation(); } catch (e) {}
    try { anim().stopPeripheralAnimation(); } catch (e) {}
    try { anim().stopBlinkAnimation(); } catch (e) {}
    PS.lastResponse = {
      answered: true,
      isCorrect: ok,
      reactionTimeMs: Math.max(0, performance.now() - (PS.responseStartTime || performance.now()))
    };
    if (window._logAnswer)
      window._logAnswer({
        rt: PS.lastResponse.reactionTimeMs,
        valid: true,
        correct: ok,
        direction: typeof answer !== 'undefined' ? String(answer) : null
      });
    PS.responsePhaseActive = false;
    if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true });
    document.body.style.background = ok ? '#0a3d1a' : '#3d0a0a';
    setTimeout(function () { document.body.style.background = '#0b0b0f'; }, 200);
    processCompareAnswer(ok);
  }

  window.PlayerSingle = {
    displayStimulus: displayStimulus,
    hideStimulus: hideStimulus,
    defaultCellParams: defaultCellParams,
    createCellElement: createCellElement,
    showNextStimulus: showNextStimulus,
    finishSeries: finishSeries,
    showFindSameComparisonInternal: showFindSameComparisonInternal,
    handleFindSameClick: handleFindSameClick,
    showFindSameComparison: showFindSameComparison,
    showDirectionComparison: showDirectionComparison,
    showNextCompareRound: showNextCompareRound,
    processCompareAnswer: processCompareAnswer,
    finishCompareSeries: finishCompareSeries,
    handleDirectionAnswer: handleDirectionAnswer,
    handleCompareAnswer: handleCompareAnswer
  };

  if (window.VLog) VLog.info('[PlayerSingle] loaded');
})();
