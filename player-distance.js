// player-distance.js — единая система контроля дистанции.
// Сводит три подсистемы: редактор (app.js), плеер (player-camera.js),
// аннулирование ответов (player-invalid-detection.js).
// API: PlayerDistance.check(curM) → { status, deviationPct, tolNearPct, tolFarPct }
// Зависит: PlayerState, VLog.
(function (global) {
    'use strict';

    if (!global.PlayerState) {
        throw new Error('[player-distance] PlayerState not loaded.');
    }
    const PS = global.PlayerState;

    const HARD_LIMIT_M = 1.0;
    const MIN_BASELINE_M = 0.1;
    const DEFAULT_TOL_NEAR_CM = 10;
    const DEFAULT_TOL_FAR_CM = 15;
    const DEFAULT_TOL_INCREASE_PCT = 15;
    const DEFAULT_TOL_DECREASE_PCT = 10;

    let _callbacks = {
        onWarn: () => {},
        onHardLimit: () => {},
        onRecalcSize: () => {}
    };

    function setCallbacks(cb) {
        _callbacks = Object.assign({}, _callbacks, cb || {});
    }

    function getBaseline() {
        return PS.camBaseline;
    }

    function setBaseline(m) {
        PS.camBaseline = m;
    }

    function resetBaseline() {
        PS.camBaseline = null;
    }

    function _tolerancePct() {
        const baselineCm = PS.camBaseline ? PS.camBaseline * 100 : 100;
        const tolNearCm = PS._tolNearCm || DEFAULT_TOL_NEAR_CM;
        const tolFarCm = PS._tolFarCm || DEFAULT_TOL_FAR_CM;
        const tolNearPct = (tolNearCm * 100) / baselineCm;
        const tolFarPct = (tolFarCm * 100) / baselineCm;
        return { tolNearPct, tolFarPct };
    }

    // Основная проверка: возвращает статус и процент отклонения.
    // status: 'ok' | 'near' | 'far' | 'hard-limit' | 'no-baseline' | 'unknown'
    function check(curM) {
        if (PS.camBaseline == null || !isFinite(PS.camBaseline) || PS.camBaseline <= MIN_BASELINE_M) {
            return { status: 'no-baseline', deviationPct: 0, tolNearPct: 0, tolFarPct: 0 };
        }
        if (curM == null) {
            return { status: 'unknown', deviationPct: 0, tolNearPct: 0, tolFarPct: 0 };
        }

        const deviationPct = ((curM - PS.camBaseline) / PS.camBaseline) * 100;
        const { tolNearPct, tolFarPct } = _tolerancePct();

        if (curM > HARD_LIMIT_M) {
            return { status: 'hard-limit', deviationPct, tolNearPct, tolFarPct };
        }

        const tol = deviationPct < 0 ? tolNearPct : tolFarPct;
        if (Math.abs(deviationPct) > tol) {
            return {
                status: deviationPct < 0 ? 'near' : 'far',
                deviationPct,
                tolNearPct,
                tolFarPct
            };
        }

        return { status: 'ok', deviationPct, tolNearPct, tolFarPct };
    }

    // Эффективные пороги UI-warning (из userScenario.params).
    function effectiveTolerance() {
        const params = (PS.userScenario && PS.userScenario.params) || {};
        return {
            increasePct: params.distanceToleranceIncreasePct || DEFAULT_TOL_INCREASE_PCT,
            decreasePct: params.distanceToleranceDecreasePct || DEFAULT_TOL_DECREASE_PCT
        };
    }

    global.PlayerDistance = {
        setCallbacks,
        getBaseline,
        setBaseline,
        resetBaseline,
        check,
        effectiveTolerance,
        HARD_LIMIT_M,
        MIN_BASELINE_M
    };

    VLog.log('[player-distance] module installed');
})(window);