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
    function acuityToSizeMm(acuity, distanceMeters) {
        const d = distanceMeters && distanceMeters > 0 ? distanceMeters : 1;
        const V = Math.max(0.01, acuity || 1.0);
        return (d * 1.454) / V;
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

    console.log('[VissortCore] installed. Functions:', Object.keys(global.VissortCore).length);
})(window);
