// vissort-logger.js — единый логгер с флагом DEBUG.
// В проде (vissort.com) — только error.
// На localhost / 127.0.0.1 / ?debug=1 — все уровни.
(function (global) {
    'use strict';

    var isDev =
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1' ||
        location.hostname === '' ||
        location.search.indexOf('debug=1') !== -1;

    var VLog = {
        debug: isDev ? console.log.bind(console) : function () {},
        log: isDev ? console.log.bind(console) : function () {},
        info: isDev ? console.info.bind(console) : function () {},
        warn: isDev ? console.warn.bind(console) : function () {},
        error: console.error.bind(console)
    };

    global.VLog = VLog;
    if (isDev) console.log('[VLog] installed (dev)');
})(window);
