/* Vissort — AppState: единое состояние app.js (редактор сценариев).
 * Вынесено из app.js §A1 (Фаза 5, 2026-10-15).
 *
 * НЕ перенесены (остаются в app.js):
 *   - _blinkState, _blinkResponseBlockUntil, _blinkCalibration, _waitingForOpenEyes
 *     (зависит от функции createEmptyBlinkState из app.js)
 *   - createEmptyBlinkState() — функция, не переменная
 */
(function () {
  'use strict';

  window.AppState = {
    // --- Auth ---
    supabaseClient: null,
    currentUser: null,
    currentSessionId: null,
    authMode: 'signin',

    // --- Editor ---
    nodes: [],
    connections: [],
    activeNodeId: null,
    dragNodeId: null,
    offsetX: 0,
    offsetY: 0,
    resizeNodeId: null,
    startW: 0,
    startH: 0,
    startMouseX: 0,
    startMouseY: 0,
    currentMode: 'nodes',
    renderScheduled: false,
    nodeElements: new Map(),
    connectionElements: new Map(),
    tempLineElement: null,
    tempLineMoveHandler: null,
    currentConnectionForMenu: null,
    playQueue: [],
    playIndex: 0,

    // --- Single-stim animations ---
    singleStimAnimId: null,
    singleBgAnimId: null,
    singleStimAnimStart: null,
    singleBgAnimStart: null,
    currentSingleCell: { row: 0, col: 0 },

    // --- Player ---
    playerRunning: false,
    isPaused: false,
    phaseTimers: [],
    currentShowTimer: null,
    responsePhaseActive: false,
    responseStartTime: 0,
    lastResponse: { answered: false, isCorrect: false, reactionTimeMs: null },
    currentCorrectDirection: null,
    lastDirection: null,
    completedSeries: 0,
    successfulSeries: 0,
    failedSeries: 0,
    seriesCorrect: 0,
    seriesIncorrect: 0,
    seriesNoAnswer: 0,
    seriesStep: 0,
    noAnswerSeriesStreak: 0,
    currentSize: 27,
    currentDuration: 2550,
    currentStimColor: { r: 0, g: 255, b: 0 },
    currentBgColor: { r: 0, g: 0, b: 0 },
    compareMode: 'direction',
    gridX: 3,
    gridY: 3,
    activeCells: [],
    cellParams: [],
    currentCompareAnswer: null,
    selectedCells: [],
    singleGridX: 1,
    singleGridY: 1,
    currentCompareNode: null,
    _findSameState: null,

    // --- Distance ---
    readingDistance: 1,
    generalDistance: 1,
    distanceToleranceIncreasePct: 15,
    distanceToleranceDecreasePct: 10,
    distanceRestoreTimeoutSec: 3,
    _distanceBaseline: null,
    _distanceOutOfBoundsSince: 0,
    _distanceWarningKind: null,
    _distanceRecalcScheduled: false,

    // --- Periphery ---
    _periAnimId: null,
    _periAnimStart: null,

    // --- Blink (без 4 переменных, зависящих от createEmptyBlinkState) ---
    _blinkTimerId: null,
    _blinkStateLocal: { tick: 0, current: 'A' },
    blinkEnabled: true,
    blinkThreshold: 0.21,
    blinkMinRate: 8,
    blinkWindowSec: 30,
    blinkLockShow: true,

    // --- Camera ---
    videoStream: null,
    cameraActive: false,
    videoFrameId: null,
    focalLengthPx: localStorage.getItem('focalLengthPx') || null,
    currentDistanceMeters: null,
    lastEyeDistancePx: null,
    distanceLog: [],
    distanceMin: null,
    distanceMax: null,
    distanceSum: 0,
    distanceCount: 0,
    distanceLastUpdate: 0,
    currentAcuity: 1.0,
    screenPPI: 96,
    trainingDistance: 1,

    // --- Reading ---
    readingViewportEl: null,
    readingContentEl: null,
    readingToolbarEl: null,
    readingPage: 0,
    readingTotalPages: 1,
    readingPaused: false,
    readingFontFamily: 'Segoe UI',
    readingFontWeight: 'normal',
    readingCurrentNode: null,

    // --- Blocks / Folders ---
    trainingNode: null,
    blockList: [],
    selectedFolderHandle: null,
    templatesFolderHandle: null,
    currentPlayingNodeId: null,
    nodeAcuityCurrent: 1.0,

    // --- Misc ---
    _saveGraphInFlight: false
  };

  // --- Шим: window.xxx <-> AppState.xxx (90 имён) ---
  var aliases = [
    'supabaseClient','currentUser','currentSessionId','authMode',
    'nodes','connections','activeNodeId',
    'dragNodeId','offsetX','offsetY',
    'resizeNodeId','startW','startH','startMouseX','startMouseY',
    'currentMode','renderScheduled',
    'nodeElements','connectionElements',
    'tempLineElement','tempLineMoveHandler','currentConnectionForMenu',
    'playQueue','playIndex',
    'singleStimAnimId','singleBgAnimId','singleStimAnimStart','singleBgAnimStart',
    'currentSingleCell',
    'playerRunning','isPaused',
    'phaseTimers','currentShowTimer',
    'responsePhaseActive','responseStartTime',
    'lastResponse','currentCorrectDirection','lastDirection',
    'completedSeries','successfulSeries','failedSeries',
    'seriesCorrect','seriesIncorrect','seriesNoAnswer',
    'seriesStep','noAnswerSeriesStreak',
    'currentSize','currentDuration',
    'currentStimColor','currentBgColor',
    'compareMode','gridX','gridY',
    'activeCells','cellParams','currentCompareAnswer',
    'selectedCells','singleGridX','singleGridY',
    'currentCompareNode','_findSameState',
    'readingDistance','generalDistance',
    'distanceToleranceIncreasePct','distanceToleranceDecreasePct','distanceRestoreTimeoutSec',
    '_distanceBaseline','_distanceOutOfBoundsSince','_distanceWarningKind','_distanceRecalcScheduled',
    '_periAnimId','_periAnimStart',
    '_blinkTimerId','_blinkStateLocal',
    'blinkEnabled','blinkThreshold','blinkMinRate','blinkWindowSec','blinkLockShow',
    'videoStream','cameraActive','videoFrameId','focalLengthPx',
    'currentDistanceMeters','lastEyeDistancePx',
    'distanceLog','distanceMin','distanceMax',
    'distanceSum','distanceCount','distanceLastUpdate',
    'currentAcuity','screenPPI','trainingDistance',
    'readingViewportEl','readingContentEl','readingToolbarEl',
    'readingPage','readingTotalPages','readingPaused',
    'readingFontFamily','readingFontWeight','readingCurrentNode',
    'trainingNode','blockList','selectedFolderHandle','templatesFolderHandle',
    'currentPlayingNodeId','nodeAcuityCurrent',
    '_saveGraphInFlight'
  ];

  aliases.forEach(function (name) {
    Object.defineProperty(window, name, {
      get: function () { return window.AppState[name]; },
      set: function (v) { window.AppState[name] = v; },
      configurable: true
    });
  });

  if (window.VLog) VLog.info('[AppState] loaded, ' + aliases.length + ' aliases');
})();
