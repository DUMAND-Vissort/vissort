// ============================================================
// vissort-core.js
// Shared utilities for Vissort Studio (admin + player).
// All functions are exposed via window.VissortCore.
// Извлечено из app.js и player-runtime.js.
// Load BEFORE app.js / player-runtime.js.
// ============================================================
(function (global) {
    'use strict';

    // ==================== CONSTANTS ====================
    const TIME_UNITS = { ms: 1, s: 1000, min: 60000 };

    // Cyrillic direction strings (escaped for encoding safety)
    const DIR = {
        up: '\u0432\u0432\u0435\u0440\u0445', // vverh
        down: '\u0432\u043d\u0438\u0437', // vniz
        left: '\u0432\u043b\u0435\u0432\u043e', // vlevo
        right: '\u0432\u043f\u0440\u0430\u0432\u043e' // vpravo
    };

    // ==================== ACUITY / MATH ====================
    // Коэффициент перевода: 1 угловая минута на 1 м ≈ 0.2909 мм (визуальный угол),
    // но для офтальмологической формулы Сивцева используется 1.454 (табличный коэффициент).
    const ACUITY_MM_COEFF = 1.454;

    function acuityToSizeMm(acuity, distanceMeters) {
        const d = distanceMeters && distanceMeters > 0 ? distanceMeters : 1;
        const V = Math.max(0.01, acuity || 1.0);
        return (d * ACUITY_MM_COEFF) / V;
    }
    function acuityToSizePx(acuity, distanceMeters, ppi) {
        const sizeMm = acuityToSizeMm(acuity, distanceMeters);
        const dpr = window.devicePixelRatio || 1;
        const physicalPx = (sizeMm * (ppi || 96)) / 25.4;
        return Math.round(Math.max(1, Math.min(3000, physicalPx / dpr)));
    }
    function acuityToFontSizePx(acuity, distanceMeters, ppi) {
        const xHeightMm = acuityToSizeMm(acuity, distanceMeters);
        const fontSizeMm = xHeightMm / 0.5;
        const dpr = window.devicePixelRatio || 1;
        const physicalPx = (fontSizeMm * (ppi || 96)) / 25.4;
        return Math.round(Math.max(8, Math.min(2000, physicalPx / dpr)));
    }
    function detectDeviceType() {
        const ua = navigator.userAgent || '';
        if (/iPad|Tablet|PlayBook|Silk/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';
        if (/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua)) return 'mobile';
        return 'desktop';
    }
    function detectPPIHeuristic() {
        const type = detectDeviceType();
        const dpr = window.devicePixelRatio || 1;
        if (type === 'mobile') {
            if (dpr >= 3.5) return 500;
            if (dpr >= 3) return 460;
            if (dpr >= 2.75) return 400;
            if (dpr >= 2) return 320;
            return 220;
        }
        if (type === 'tablet') return dpr >= 2 ? 264 : 160;
        return Math.round(96 * dpr);
    }
    function loadPPI() {
        const s = localStorage.getItem('screenPPI');
        return s && !isNaN(parseInt(s)) ? parseInt(s) : detectPPIHeuristic();
    }

    // ==================== TIME ====================
    function msToUnit(ms, unit) {
        return ms / TIME_UNITS[unit];
    }
    function unitToMs(v, unit) {
        return v * TIME_UNITS[unit];
    }
    function detectUnit(ms) {
        if (ms >= 60000 && ms % 60000 === 0) return 'min';
        if (ms >= 1000 && ms % 1000 === 0) return 's';
        if (ms === 0) return 's';
        return 'ms';
    }

    // ==================== COLORS ====================
    function hexToRgb(hex) {
        const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return r
            ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) }
            : { r: 0, g: 0, b: 0 };
    }
    function rgbToHex(r, g, b) {
        const s = (c) => Math.min(255, Math.max(0, c || 0));
        return '#' + [s(r), s(g), s(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
    }
    function lerpColor(from, to, t) {
        return {
            r: Math.round(from.r + (to.r - from.r) * t),
            g: Math.round(from.g + (to.g - from.g) * t),
            b: Math.round(from.b + (to.b - from.b) * t)
        };
    }

    // ==================== DYNAMIC PHASES ====================
    function buildGenericDynamicPhases(color1, midEnabled, color3, color2, reverse) {
        const A = color1 || { r: 255, g: 0, b: 0 };
        const B = color2 || { r: 0, g: 0, b: 255 };
        let base;
        if (midEnabled && color3) {
            base = [
                { from: A, to: color3 },
                { from: color3, to: B }
            ];
        } else {
            base = [{ from: A, to: B }];
        }
        if (reverse === true) {
            return base.concat(
                base
                    .slice()
                    .reverse()
                    .map((ph) => ({ from: ph.to, to: ph.from }))
            );
        }
        return base;
    }
    function buildCirclePhases(colorA, midEnabled, colorMid, colorB, reverse) {
        let base;
        if (midEnabled && colorMid) {
            base = [
                { from: colorA, to: colorMid },
                { from: colorMid, to: colorB }
            ];
        } else {
            base = [{ from: colorA, to: colorB }];
        }
        if (reverse === true) {
            return base.concat(
                base
                    .slice()
                    .reverse()
                    .map((ph) => ({ from: ph.to, to: ph.from }))
            );
        }
        return base;
    }

    // ==================== SVG STIMULI ====================
    function generateLetterE(size, r, g, b, angle) {
        const a = angle == null ? 0 : angle;
        const t = size / 5;
        const path =
            'M 0 0 H ' +
            size +
            ' V ' +
            t +
            ' H ' +
            t +
            ' V ' +
            2 * t +
            ' H ' +
            (size - t) +
            ' V ' +
            3 * t +
            ' H ' +
            t +
            ' V ' +
            4 * t +
            ' H ' +
            size +
            ' V ' +
            size +
            ' H 0 Z';
        return (
            '<svg width="' +
            size +
            '" height="' +
            size +
            '" viewBox="0 0 ' +
            size +
            ' ' +
            size +
            '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">' +
            '<g transform="rotate(' +
            a +
            ', ' +
            size / 2 +
            ', ' +
            size / 2 +
            ')">' +
            '<path d="' +
            path +
            '" fill="rgb(' +
            r +
            ',' +
            g +
            ',' +
            b +
            ')"/></g></svg>'
        );
    }
    function generateLandoltRing(diameter, gapDirection, r, g, b, bgR, bgG, bgB) {
        const sw = diameter * 0.2;
        const gw = diameter * 0.2;
        const gl = diameter * 0.23;
        const sm = Math.max(1, sw * 0.1);
        const or_ = diameter / 2;
        const cx = diameter / 2;
        const cy = diameter / 2;
        let rx, ry, rw, rh;
        if (gapDirection === DIR.up || gapDirection === DIR.down) {
            rw = gw;
            rh = gl + sm;
            rx = cx - rw / 2;
            ry = gapDirection === DIR.up ? cy - or_ - sm : cy + or_ - rh + sm;
        } else {
            rw = gl + sm;
            rh = gw;
            ry = cy - rh / 2;
            rx = gapDirection === DIR.right ? cx + or_ - rw + sm : cx - or_ - sm;
        }
        return (
            '<svg width="' +
            diameter +
            '" height="' +
            diameter +
            '" viewBox="0 0 ' +
            diameter +
            ' ' +
            diameter +
            '" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="' +
            cx +
            '" cy="' +
            cy +
            '" r="' +
            (or_ - sw / 2) +
            '" fill="none" ' +
            'stroke="rgb(' +
            r +
            ',' +
            g +
            ',' +
            b +
            ')" stroke-width="' +
            sw +
            '"/>' +
            '<rect x="' +
            rx +
            '" y="' +
            ry +
            '" width="' +
            rw +
            '" height="' +
            rh +
            '" fill="rgb(' +
            bgR +
            ',' +
            bgG +
            ',' +
            bgB +
            ')"/></svg>'
        );
    }
    function getCircleStimulusSVG(node, size) {
        const uid = 'cg_' + Math.random().toString(36).slice(2, 8);
        const cx = size / 2;
        const cy = size / 2;
        const r = size / 2;
        const innerEnabled = node.circleInnerEnabled !== false;
        const outerEnabled = node.circleOuterEnabled !== false;
        const innerR = Math.max(
            5,
            Math.min(95, node.circleInnerRadiusPct != null ? node.circleInnerRadiusPct : 40)
        );
        const innerFr = innerR / 100;
        const iA = node.circleInnerColor1 || { r: 255, g: 0, b: 0 };
        const iB = node.circleInnerColor2 || { r: 0, g: 0, b: 255 };
        const iMid = node.circleInnerMidEnabled ? node.circleInnerColor3 || { r: 255, g: 255, b: 0 } : null;
        const innerStops = [];
        if (iMid) {
            innerStops.push('<stop offset="0%" stop-color="rgb(' + iA.r + ',' + iA.g + ',' + iA.b + ')"/>');
            innerStops.push(
                '<stop offset="50%" stop-color="rgb(' + iMid.r + ',' + iMid.g + ',' + iMid.b + ')"/>'
            );
            innerStops.push('<stop offset="100%" stop-color="rgb(' + iB.r + ',' + iB.g + ',' + iB.b + ')"/>');
        } else {
            innerStops.push('<stop offset="0%" stop-color="rgb(' + iA.r + ',' + iA.g + ',' + iA.b + ')"/>');
            innerStops.push('<stop offset="100%" stop-color="rgb(' + iB.r + ',' + iB.g + ',' + iB.b + ')"/>');
        }
        const oA = node.circleOuterColor1 || { r: 0, g: 255, b: 0 };
        const oB = node.circleOuterColor2 || { r: 0, g: 128, b: 255 };
        const oMid = node.circleOuterMidEnabled ? node.circleOuterColor3 || { r: 0, g: 255, b: 255 } : null;
        const outerStops = [];
        outerStops.push(
            '<stop offset="0%" stop-color="rgb(' + oA.r + ',' + oA.g + ',' + oA.b + ')" stop-opacity="0"/>'
        );
        outerStops.push(
            '<stop offset="' +
                innerR +
                '%" stop-color="rgb(' +
                oA.r +
                ',' +
                oA.g +
                ',' +
                oA.b +
                ')" stop-opacity="1"/>'
        );
        if (oMid) {
            outerStops.push(
                '<stop offset="' +
                    (innerR + 100) / 2 +
                    '%" stop-color="rgb(' +
                    oMid.r +
                    ',' +
                    oMid.g +
                    ',' +
                    oMid.b +
                    ')"/>'
            );
        }
        outerStops.push('<stop offset="100%" stop-color="rgb(' + oB.r + ',' + oB.g + ',' + oB.b + ')"/>');
        const innerCircle = innerEnabled
            ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + r * innerFr + '" fill="url(#' + uid + '_i)"/>'
            : '';
        const outerCircle = outerEnabled
            ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#' + uid + '_o)"/>'
            : '';
        const html =
            '<svg width="' +
            size +
            '" height="' +
            size +
            '" viewBox="0 0 ' +
            size +
            ' ' +
            size +
            '" xmlns="http://www.w3.org/2000/svg"><defs>' +
            '<radialGradient id="' +
            uid +
            '_o" cx="50%" cy="50%" r="50%">' +
            outerStops.join('') +
            '</radialGradient>' +
            '<radialGradient id="' +
            uid +
            '_i" cx="50%" cy="50%" r="50%">' +
            innerStops.join('') +
            '</radialGradient>' +
            '</defs>' +
            outerCircle +
            innerCircle +
            '</svg>';
        return {
            html: html,
            bgColor: 'rgb(' + (node.bgR || 0) + ',' + (node.bgG || 0) + ',' + (node.bgB || 0) + ')',
            size: size,
            uid: uid,
            innerR: innerR,
            outerEnabled: outerEnabled,
            innerEnabled: innerEnabled
        };
    }
    function getStimulusSVG(node, size) {
        if (node.singleCircleEnabled) return getCircleStimulusSVG(node, size);
        const r = node.stimR || 255;
        const g = node.stimG || 255;
        const b = node.stimB || 255;
        let html;
        if (node.stimType === 'LANDOLT') {
            html = generateLandoltRing(
                size,
                node.stimDirection || DIR.up,
                r,
                g,
                b,
                node.bgR || 0,
                node.bgG || 0,
                node.bgB || 0
            );
        } else {
            const am = {};
            am[DIR.up] = 270;
            am[DIR.right] = 0;
            am[DIR.down] = 90;
            am[DIR.left] = 180;
            html = generateLetterE(size, r, g, b, am[node.stimDirection] || 0);
        }
        return {
            html: html,
            bgColor: 'rgb(' + (node.bgR || 0) + ',' + (node.bgG || 0) + ',' + (node.bgB || 0) + ')',
            size: size
        };
    }

    // ==================== UTILS ====================
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
    function getThreshold(size) {
        switch (size) {
            case 4:
                return 3;
            case 5:
                return 4;
            case 6:
                return 4;
            case 7:
                return 5;
            case 8:
                return 6;
            default:
                return Math.ceil(size / 2);
        }
    }
    function randomDirection() {
        const d = [DIR.up, DIR.down, DIR.left, DIR.right];
        return d[Math.floor(Math.random() * d.length)];
    }
    function hashCode(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (h << 5) - h + str.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h).toString(36);
    }
    async function sha1(str) {
        if (!window.crypto || !window.crypto.subtle) return 'weak-' + hashCode(str);
        const buf = new TextEncoder().encode(str);
        const hb = await window.crypto.subtle.digest('SHA-1', buf);
        return Array.from(new Uint8Array(hb))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // ==================== FLASH CELL ====================
    // Подсветка клетки в compare-режиме «найти одинаковые».
    // Принимает индекс клетки (data-index), а не DOM-элемент.
    function flashCell(idx, kind) {
        const el = document.querySelector('.grid-cell[data-index="' + idx + '"]');
        if (!el) return;
        const ob = el.style.border,
            os = el.style.boxShadow;
        if (kind === 'selected') {
            el.style.border = '3px solid #38bdf8';
            el.style.boxShadow = '0 0 12px #38bdf8';
        } else if (kind === 'found') {
            el.style.border = '4px solid #22c55e';
            el.style.boxShadow = '0 0 20px #22c55e';
        } else if (kind === 'wrong') {
            el.style.border = '4px solid #ef4444';
            el.style.boxShadow = '0 0 20px #ef4444';
            setTimeout(() => {
                el.style.border = ob;
                el.style.boxShadow = os;
            }, 400);
        } else if (kind === 'unselect') {
            el.style.border = ob;
            el.style.boxShadow = os;
        }
    }

    // ==================== OKLCH + colorTable ====================
    function rgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    function linearToRgb(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
    function rgbToOklch(r, g, b) {
        const lr = rgbToLinear(r), lg = rgbToLinear(g), lb = rgbToLinear(b);
        const L = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
        const M = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
        const S = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
        const l_ = Math.cbrt(L), m_ = Math.cbrt(M), s_ = Math.cbrt(S);
        const L_ok = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
        const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
        const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
        const C = Math.sqrt(a * a + b_ * b_);
        let H = Math.atan2(b_, a) * 180 / Math.PI;
        if (H < 0) H += 360;
        return { L: L_ok * 100, C, H };
    }
    function oklchToRgb(L, C, H) {
        const L_ok = L / 100;
        const a = C * Math.cos(H * Math.PI / 180);
        const b_ = C * Math.sin(H * Math.PI / 180);
        const l_ = L_ok + 0.3963377774 * a + 0.2158037573 * b_;
        const m_ = L_ok - 0.1055613458 * a - 0.0638541728 * b_;
        const s_ = L_ok - 0.0894841775 * a - 1.2914855480 * b_;
        const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
        const r_lin =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        const g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        const b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
        return {
            r: Math.round(Math.max(0, Math.min(255, linearToRgb(r_lin) * 255))),
            g: Math.round(Math.max(0, Math.min(255, linearToRgb(g_lin) * 255))),
            b: Math.round(Math.max(0, Math.min(255, linearToRgb(b_lin) * 255)))
        };
    }
    const colorTable = [
        { r: 255, g: 0, b: 0 },     { r: 255, g: 50, b: 0 },    { r: 255, g: 100, b: 0 },   { r: 255, g: 150, b: 0 },   { r: 255, g: 200, b: 0 },
        { r: 255, g: 255, b: 0 },   { r: 200, g: 255, b: 0 },   { r: 150, g: 255, b: 0 },   { r: 100, g: 255, b: 0 },   { r: 50, g: 255, b: 0 },
        { r: 0, g: 255, b: 0 },     { r: 0, g: 255, b: 50 },    { r: 0, g: 255, b: 100 },   { r: 0, g: 255, b: 150 },   { r: 0, g: 255, b: 200 },
        { r: 0, g: 255, b: 255 },   { r: 0, g: 200, b: 255 },   { r: 0, g: 150, b: 255 },   { r: 0, g: 100, b: 255 },   { r: 0, g: 50, b: 255 },    { r: 0, g: 0, b: 255 }
    ];

    // ==================== playDynamicStimulus (общий для preview и графа) ====================
    function playDynamicStimulus(node, opts) {
        var state = opts.state || {};
        var callbacks = opts.callbacks || {};
        var getStimDisplay = opts.getStimDisplay || function () { return null; };
        var Voice = opts.Voice || (typeof window !== 'undefined' ? window.Voice : null);

        if (!state.playerRunning || state.isPaused) return;

        var dyn = node.params.stimulusDynamic;
        var frame = dyn.frames[0];

        var stimDisplayEl = getStimDisplay();
        var eff = stimDisplayEl ? Math.min(stimDisplayEl.clientWidth, stimDisplayEl.clientHeight) * 0.8 : 200;

        var startD = (frame.stim && frame.stim.startD != null) ? frame.stim.startD : 0;
        var endD = (frame.stim && frame.stim.endD != null) ? frame.stim.endD : startD;
        var duration = (frame.lifecycle.duration || 10) * 1000;
        var startTime = performance.now();
        var repeats = frame.repeats || 1;
        var mode = frame.mode || 'smooth';
        var currentRepeat = 0;

        var getCircleStimulusSVG = global.VissortCore && global.VissortCore.getCircleStimulusSVG;

        function animateColor() {
            if (!state.playerRunning || state.isPaused) return;
            var elapsed = performance.now() - startTime;
            var t = Math.min(1, elapsed / duration);

            var d = startD + (endD - startD) * t;
            var sc;
            if (colorTable) {
                var pos = Math.max(0, Math.min(20, d * 10));
                var i0 = Math.floor(pos);
                var i1 = Math.min(20, i0 + 1);
                var frac = pos - i0;
                var c0 = colorTable[i0] || { r: 255, g: 0, b: 0 };
                var c1 = colorTable[i1] || c0;
                sc = {
                    r: Math.round(c0.r + (c1.r - c0.r) * frac),
                    g: Math.round(c0.g + (c1.g - c0.g) * frac),
                    b: Math.round(c0.b + (c1.b - c0.b) * frac)
                };
            } else {
                sc = {
                    r: Math.round(255 * (1 - d / 2)),
                    g: Math.round(255 * (d / 2)),
                    b: 0
                };
            }

            var tempNode = JSON.parse(JSON.stringify(node));
            tempNode.circleInnerColor1 = sc;
            tempNode.circleOuterColor1 = sc;
            tempNode.circleInnerColor2 = sc;
            tempNode.circleOuterColor2 = sc;
            tempNode.circleInnerMidEnabled = false;
            tempNode.circleOuterMidEnabled = false;
            tempNode.circleInnerEnabled = true;
            tempNode.circleOuterEnabled = true;
            tempNode.circleInnerRadiusPct = 40;

            var svgData = getCircleStimulusSVG(tempNode, eff);
            callbacks.displayStimulus(svgData.html, { r: 0, g: 0, b: 0 });

            if (t < 1) {
                requestAnimationFrame(animateColor);
            } else {
                if (currentRepeat < repeats - 1) {
                    currentRepeat++;
                    startTime = performance.now();
                    requestAnimationFrame(animateColor);
                    return;
                }
                setTimeout(function () {
                    if (state.playerRunning && !state.isPaused) {
                        callbacks.hideStimulus();
                        if (callbacks.onFrameEnd) callbacks.onFrameEnd(node);
                    }
                }, 0);
            }
        }

        function startWhenVoiceDone() {
            var started = false;
            function go() {
                if (started) return;
                started = true;
                clearInterval(iv);
                clearTimeout(guard);
                if (state.playerRunning && !state.isPaused) {
                    animateColor();
                }
            }
            if (!Voice || !Voice._speaking) {
                go();
                return;
            }
            var iv = setInterval(function () {
                if (!Voice || !Voice._speaking) go();
            }, 100);
            var guard = setTimeout(go, 3000);
        }
        startWhenVoiceDone();
    }

    // ==================== EXPORT ====================
    global.VissortCore = {
        // constants
        TIME_UNITS: TIME_UNITS,
        DIR: DIR,
        // acuity
        acuityToSizeMm: acuityToSizeMm,
        acuityToSizePx: acuityToSizePx,
        acuityToFontSizePx: acuityToFontSizePx,
        detectDeviceType: detectDeviceType,
        detectPPIHeuristic: detectPPIHeuristic,
        loadPPI: loadPPI,
        // time
        msToUnit: msToUnit,
        unitToMs: unitToMs,
        detectUnit: detectUnit,
        // colors
        hexToRgb: hexToRgb,
        rgbToHex: rgbToHex,
        lerpColor: lerpColor,
        playDynamicStimulus: playDynamicStimulus,
        colorTable: colorTable,
        rgbToOklch: rgbToOklch,
        oklchToRgb: oklchToRgb,
        // phases
        buildGenericDynamicPhases: buildGenericDynamicPhases,
        buildCirclePhases: buildCirclePhases,
        // svg
        generateLetterE: generateLetterE,
        generateLandoltRing: generateLandoltRing,
        getCircleStimulusSVG: getCircleStimulusSVG,
        getStimulusSVG: getStimulusSVG,
        // utils
        escapeHtml: escapeHtml,
        getThreshold: getThreshold,
        randomDirection: randomDirection,
        hashCode: hashCode,
        sha1: sha1,
        flashCell: flashCell
    };

    VLog.log('[VissortCore] installed. Functions:', Object.keys(global.VissortCore).length);
})(window);