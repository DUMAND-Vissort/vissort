/* Vissort — PlayerSingle: одиночный и сравнительный режимы плеера.
 * Вынесено из player-runtime.js §15.1.2 ч.7/7.
 * Зависит: PlayerState, PlayerAnimation, PlayerCamera, PlayerGraph, PlayerSession, VLog.
 * Порядок загрузки: после player-session.js, до player-runtime.js.
 */
(function () {
  'use strict';

  var PS = null;
  function st() { return (PS = PS || window.PlayerState); }

  // ---- placeholder: defaultCellParams (перенос из runtime 777-790) ----
  function defaultCellParams() {
    return { row: 0, col: 0, size: 1, duration: 1000 };
  }

  window.PlayerSingle = {
    defaultCellParams: defaultCellParams
  };

  if (window.VLog) VLog.info('[PlayerSingle] loaded');
})();
