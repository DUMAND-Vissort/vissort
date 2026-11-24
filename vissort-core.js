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
        const sb = Math.max(0, Math.min(100, node.stimBrightness != null ? node.stimBrightness : 100)) / 100;
        const bb = Math.max(0, Math.min(100, node.bgBrightness != null ? node.bgBrightness : 100)) / 100;
        const r = Math.round((node.stimR != null ? node.stimR : 255) * sb);
        const g = Math.round((node.stimG != null ? node.stimG : 255) * sb);
        const b = Math.round((node.stimB != null ? node.stimB : 255) * sb);
        const bgR = Math.round((node.bgR || 0) * bb);
        const bgG = Math.round((node.bgG || 0) * bb);
        const bgB = Math.round((node.bgB || 0) * bb);
        let html;
        if (node.stimType === 'LANDOLT') {
            html = generateLandoltRing(
                size,
                node.stimDirection || DIR.up,
                r,
                g,
                b,
                bgR,
                bgG,
                bgB
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
            bgColor: 'rgb(' + bgR + ',' + bgG + ',' + bgB + ')',
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
    // ==================== ФИЗИОЛОГИЧЕСКАЯ ШКАЛА ДИОПТРИЙ (LCA) ====================
    // D — это НЕ «яркость» и НЕ «контраст», а продольная хроматическая аберрация глаза
    // (longitudinal chromatic aberration, LCA): показатель преломления сред глаза падает
    // с ростом длины волны (нормальная дисперсия, Коши: n(λ) = n0 + B/λ²), поэтому короткие
    // волны преломляются сильнее и фокусируются ближе к хрусталику (относительная миопия).
    // Отсюда шкала D ↔ цвет:
    //     0.0 дптр → красный (≈670 нм, длинноволновой эталон)
    //     2.0 дптр → сине-фиолетовый (≈423 нм)
    //
    // Количественная основа (проверяемая по литературе):
    //   • n (589 нм): роговица 1.376, влага передней камеры 1.336, хрусталик 1.42→1.386,
    //     стекловидное тело 1.336; Δn на 400→700 нм ≈ 0.012…0.02 (нормальная дисперсия);
    //   • редуцированный глаз (Emsley): P = n/r, r = 5.55 мм → P ≈ 60 дптр, поэтому ΔP = Δn/r;
    //   • измеренная LCA глаза: ≈2.4 дптр на 400→700 нм (Bedford & Wyszecki, 1957;
    //     Thibos et al., 1992 — модель «chromatic eye»); на 420→670 нм ≈ 2.0 дптр.
    // Калибровка: CDR(670→400 нм) = 2.4 дптр ⇒ λ(2.0 дптр) ≈ 423 нм, λ(0 дптр) = 670 нм.
    var PHYSIO = {
        MAX_D: 2,             // верх шкалы ЖС, дптр
        REF_NM: 670,          // 0 дптр — длинноволновой красный
        CDR_670_400: 2.4,     // хроматическая разность рефракции 670→400 нм, дптр
        LAMBDA_MIN_NM: 380,   // границы видимого диапазона для λ→RGB
        LAMBDA_MAX_NM: 780
    };
    // Коэффициент Коши (дптр·мкм²): D(λ) = K·(1/λ² − 1/λ_ref²), λ в мкм
    PHYSIO.K = PHYSIO.CDR_670_400 / (1 / Math.pow(0.400, 2) - 1 / Math.pow(0.670, 2));

    // D (дптр) → длина волны (нм): обратная к D(λ) = K·(1/λ² − 1/λ_ref²)
    function defocusToWavelength(D) {
        var d = Math.max(0, Math.min(PHYSIO.MAX_D, isFinite(D) ? D : 0));
        var inv = d / PHYSIO.K + 1 / Math.pow(PHYSIO.REF_NM / 1000, 2);
        var nm = 1000 / Math.sqrt(inv);
        return Math.max(PHYSIO.LAMBDA_MIN_NM, Math.min(PHYSIO.LAMBDA_MAX_NM, nm));
    }

    // Длина волны → RGB: спектральное приближение (Bruton), максимум канала = 255.
    // Точная колориметрия тут не нужна: абсолютная яркость задаётся «Яркость %»/контрастом.
    // Спад видимости на краях сохранён, иначе 670 и 646 нм дают одинаковый «чистый красный»
    // и шаг 0.0 → 0.1 дптр визуально неразличим (V(λ) на 670 нм ≈ 0.06 от максимума).
    function wavelengthToRgb(nm) {
        var r = 0, g = 0, b = 0, f = 1;
        if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
        else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
        else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
        else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
        else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
        else { r = 1; }
        if (nm > 645) f = Math.max(0.25, 0.65 - 0.0114 * (nm - 670));
        else if (nm < 420) f = 0.3 + 0.7 * (nm - 380) / 40;
        var gamma = 0.8; // как в стандартном алгоритме Bruton
        return {
            r: Math.round(255 * Math.pow(Math.max(0, r) * f, gamma)),
            g: Math.round(255 * Math.pow(Math.max(0, g) * f, gamma)),
            b: Math.round(255 * Math.pow(Math.max(0, b) * f, gamma))
        };
    }

    // Название цвета по длине волны — для подписей D в панелях
    function colorNameByWavelength(nm) {
        if (nm >= 635) return 'Красный';
        if (nm >= 590) return 'Оранжевый';
        if (nm >= 560) return 'Жёлтый';
        if (nm >= 530) return 'Жёлто-зелёный';
        if (nm >= 490) return 'Зелёный';
        if (nm >= 470) return 'Бирюзовый';
        if (nm >= 440) return 'Голубой';
        if (nm >= 420) return 'Синий';
        return 'Фиолетово-синий';
    }

    // Единая шкала (шаг 0.1 дптр, 0.0…2.0 = 21 точка). ИСТОЧНИК ИСТИНЫ для всех панелей.
    var PHYSIO_SCALE = (function () {
        var out = [];
        for (var i = 0; i <= PHYSIO.MAX_D * 10; i++) {
            var d = i / 10;
            var nm = Math.round(defocusToWavelength(d));
            out.push({ diopters: d, wavelength_nm: nm, name: colorNameByWavelength(nm), rgb: wavelengthToRgb(nm) });
        }
        return out;
    })();

    // Совместимость со старыми панелями/сценами: colorTable[i] = цвет при D = i/10
    var colorTable = PHYSIO_SCALE.map(function (p) { return p.rgb; });

    // Цвет по D с линейной интерполяцией между шагами 0.1 дптр (brightness — % поверх цвета)
    function getColorByD(D, brightness) {
        var d = Math.max(0, Math.min(PHYSIO.MAX_D, isFinite(D) ? D : 0));
        var idxFloat = d * 10;
        var i1 = Math.floor(idxFloat);
        var i2 = Math.min(PHYSIO_SCALE.length - 1, Math.ceil(idxFloat));
        var t = idxFloat - i1;
        var c1 = PHYSIO_SCALE[i1].rgb, c2 = PHYSIO_SCALE[i2].rgb;
        var br = Math.max(0, Math.min(100, isFinite(brightness) ? brightness : 100)) / 100;
        return {
            r: Math.round((c1.r + (c2.r - c1.r) * t) * br),
            g: Math.round((c1.g + (c2.g - c1.g) * t) * br),
            b: Math.round((c1.b + (c2.b - c1.b) * t) * br)
        };
    }

    // ==================== playDynamicStimulus (общий для preview и графа) ====================
    function playDynamicStimulus(node, opts) {
        var state = opts.state || {};
        var callbacks = opts.callbacks || {};
        var getStimDisplay = opts.getStimDisplay || function () { return null; };

        if (!state.playerRunning || state.isPaused) return;

        var dyn = node.params.stimulusDynamic;
        var frames = (dyn && dyn.frames) ? dyn.frames : [];
        if (frames.length === 0) return;

        // Берем ТОЛЬКО ОДИН кадр по индексу (передается через opts.frameIndex)
        var frameIndex = opts.frameIndex || 0;
        if (frameIndex >= frames.length) frameIndex = 0; // Зацикливаем, если кадров меньше, чем серия
        var frame = frames[frameIndex];

        var stimDisplayEl = getStimDisplay();
        var eff = stimDisplayEl ? Math.min(stimDisplayEl.clientWidth, stimDisplayEl.clientHeight) * 0.8 : 200;
        var baseNode = JSON.parse(JSON.stringify(node));

        // ==================== ЦВЕТ = ХРОМАТИЧЕСКАЯ ШКАЛА (LCA) ====================
        // D (0…2 дптр) — продольная хроматическая аберрация глаза: 0 = красный (670 нм),
        // 2 = сине-фиолетовый (423 нм). Оттенок стимула и фона считается по единой шкале
        // PHYSIO_SCALE / getColorByD (физика — в разделе «ФИЗИОЛОГИЧЕСКАЯ ШКАЛА ДИОПТРИЙ»).
        // Из блока «🎨 Цвета и яркость» при активном ЖС берётся только ЯРКОСТЬ (контраст):
        //   • «Яркость %» кадра — множитель к базовой яркости узла (100 % = как задано);
        //   • базовые ЦВЕТА узла работают в статике (ЖС выключен).
        var baseStimBright = clampBright(node.stimBrightness != null ? node.stimBrightness : 100);
        var baseBgBright = clampBright(node.bgBrightness != null ? node.bgBrightness : 100);

        function num(v, def) {
            return typeof v === 'number' && isFinite(v) ? v : def;
        }
        function clampBright(v) {
            return Math.max(0, Math.min(100, isFinite(v) ? v : 100));
        }
        function lerpNum(a, b, t) {
            return a + (b - a) * t;
        }

        function renderFrame(frame, t) {
            var st = frame.stim || {};
            var bgs = frame.bg || {};

            // D → цвет по физиологической шкале (0 дптр = красный 670 нм … 2 дптр = 423 нм)
            var stimStart = num(st.startD, 0), stimEnd = num(st.endD, stimStart);
            var bgStart = num(bgs.startD, 0), bgEnd = num(bgs.endD, bgStart);
            var stimColor = getColorByD(lerpNum(stimStart, stimEnd, t));
            var bgColor = getColorByD(lerpNum(bgStart, bgEnd, t));

            // Яркость кадра — множитель к базовой яркости из «Цвета и яркость»
            var stimBright = (clampBright(lerpNum(num(st.startBright, 100), num(st.endBright, num(st.startBright, 100)), t)) * baseStimBright) / 100;
            var bgBright = (clampBright(lerpNum(num(bgs.startBright, 100), num(bgs.endBright, num(bgs.startBright, 100)), t)) * baseBgBright) / 100;

            baseNode.stimR = stimColor.r;
            baseNode.stimG = stimColor.g;
            baseNode.stimB = stimColor.b;
            baseNode.bgR = bgColor.r;
            baseNode.bgG = bgColor.g;
            baseNode.bgB = bgColor.b;
            baseNode.stimBrightness = stimBright;
            baseNode.bgBrightness = bgBright;

            var svgData = global.VissortCore.getStimulusSVG(baseNode, eff);
            callbacks.displayStimulus(svgData.html, {
                r: Math.round((bgColor.r * bgBright) / 100),
                g: Math.round((bgColor.g * bgBright) / 100),
                b: Math.round((bgColor.b * bgBright) / 100)
            });
        }

        var duration = (frame.lifecycle && frame.lifecycle.duration ? frame.lifecycle.duration : 10) * 1000;
        var startTime = performance.now();

        function animate() {
            if (!state.playerRunning || state.isPaused) return;
            var elapsed = performance.now() - startTime;
            var t = Math.min(1, elapsed / duration);

            renderFrame(frame, t);

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                // Кадр завершен, сообщаем плееру
                if (callbacks.onFrameEnd) callbacks.onFrameEnd(node);
            }
        }

        // Запускаем анимацию
        animate();
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
        // физиологическая шкала D ↔ λ ↔ RGB (единый источник цвета для ЖС/генератора/чтения)
        PHYSIO: PHYSIO,
        PHYSIO_SCALE: PHYSIO_SCALE,
        getColorByD: getColorByD,
        defocusToWavelength: defocusToWavelength,
        wavelengthToRgb: wavelengthToRgb,
        colorNameByWavelength: colorNameByWavelength,
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