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

  window.PlayerSingle = {
    defaultCellParams: defaultCellParams,
    createCellElement: createCellElement
  };

  if (window.VLog) VLog.info('[PlayerSingle] loaded');
})();
