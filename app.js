// ==================== app.js ====================
// Vissort Studio — редактор сценариев для админа
// Data layer (IndexedDB + Supabase REST + syncQueue)
// ====================

// ==================== НАСТРОЙКИ ====================
// ============================================================
// ============================================================
if (!window.VissortCore) {
    throw new Error(
        '[app] VissortCore not loaded. Include <script src="vissort-core.js"></script> BEFORE app.js.'
    );
}
const {
    TIME_UNITS,
    acuityToSizeMm,
    acuityToSizePx,
    acuityToFontSizePx,
    detectDeviceType,
    detectPPIHeuristic,
    loadPPI,
    msToUnit,
    unitToMs,
    detectUnit,
    hexToRgb,
    rgbToHex,
    lerpColor,
    buildGenericDynamicPhases,
    buildCirclePhases,
    generateLetterE,
    generateLandoltRing,
    getCircleStimulusSVG,
    getStimulusSVG,
    escapeHtml,
    getThreshold,
    randomDirection,
    hashCode,
    sha1
} = window.VissortCore;

const ADMIN_EMAILS = ['dumand@gmail.com'];
const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const LS_KEYS = {
    readingFontFamily: 'vissort_readingFontFamily',
    readingFontWeight: 'vissort_readingFontWeight',
    readingAcuity: 'vissort_readingAcuity',
    readingDistance: 'vissort_readingDistance',
    generalDistance: 'vissort_generalDistance',
    distIncTol: 'vissort_distIncTol',
    distDecTol: 'vissort_distDecTol',
    distTimeout: 'vissort_distTimeout',
    blinkEnabled: 'vissort_blinkEnabled',
    blinkThreshold: 'vissort_blinkThreshold',
    blinkMinRate: 'vissort_blinkMinRate',
    blinkWindow: 'vissort_blinkWindow',
    blinkLockShow: 'vissort_blinkLockShow'
};
const MAX_DISTANCE_LOG = 2000;

// ==================== ГЛОБАЛЬНОЕ СОСТОЯНИЕ ====================
// Переменные диапазона 62..150 перенесены в app-state.js (2026-10-15).

let _blinkState = window.AppBlinkCamera.createEmptyBlinkState();

window._currentScenarioFileName = window._currentScenarioFileName || null;
window._currentScenarioId = window._currentScenarioId || null;

// ==================== DOM-ССЫЛКИ ====================
const canvas = document.getElementById('canvas');
// eslint-disable-next-line no-redeclare -- app.js — отдельный entry (admin.html); коллизия имён с player-runtime.js иллюзорна
const stimDisplay = document.getElementById('stim');
// eslint-disable-next-line no-redeclare -- app.js — отдельный entry (admin.html); коллизия имён с player-runtime.js иллюзорна
const stimArea = document.getElementById('stim-display');
const responseButtons = document.getElementById('response-buttons');
const inspectorEl = document.getElementById('inspector');
const modal = document.getElementById('generator-modal');
const cntCompleted = document.getElementById('cnt-completed');
const cntSuccess = document.getElementById('cnt-success');
const cntFailed = document.getElementById('cnt-failed');
const cntSeriesCorrect = document.getElementById('cnt-series-correct');
const cntSeriesIncorrect = document.getElementById('cnt-series-incorrect');
const cntSeriesNoAnswer = document.getElementById('cnt-series-noanswer');
const pauseModal = document.getElementById('pause-modal');
const btnPlayer = document.getElementById('btn-player');
const btnPlayerStop = document.getElementById('btn-player-stop');
const btnPlayerPause = document.getElementById('btn-player-pause');
const btnModeToggle = document.getElementById('btn-mode-toggle');
const btnAddStim = document.getElementById('btn-add-stim');
const btnAddLogic = document.getElementById('btn-add-logic');
const btnAddDynamic = document.getElementById('btn-add-dynamic');
const btnAddReading = document.getElementById('btn-add-reading');
const btnAddCompare = document.getElementById('btn-add-compare');
const btnGenerator = document.getElementById('btn-generator');
const btnEnableCamera = document.getElementById('btn-enable-camera');
const btnDisableCamera = document.getElementById('btn-disable-camera');
const btnCalibrate = document.getElementById('btn-calibrate-camera');
const btnCalibrateScreen = document.getElementById('btn-calibrate-screen');
const btnScenarioTime = document.getElementById('btn-scenario-time');
const btnInspector = document.getElementById('btn-inspector');
const btnSave = document.getElementById('btn-save');
const btnOpen = document.getElementById('btn-open');
const fileInput = document.getElementById('file-input');
const folderInput = document.getElementById('folder-input');
const templatesFolderInput = document.getElementById('templates-folder-input');
const btnAddBlock = document.getElementById('btn-add-block');
const btnClearBlocks = document.getElementById('btn-clear-blocks');
const btnGenerateSequence = document.getElementById('btn-generate-sequence');
const blockNameInput = document.getElementById('block-name-input');
const blockSelect = document.getElementById('block-select');
const blockCountSpan = document.getElementById('block-count');
const blockListDiv = document.getElementById('block-list');
const btnAuth = document.getElementById('btn-auth');
const userEmailSpan = document.getElementById('user-email');
const btnLibrary = document.getElementById('btn-library');
const btnUsers = document.getElementById('btn-users');
const btnSelectFolder = document.getElementById('btn-select-folder');
const btnSelectTemplatesFolder = document.getElementById('btn-select-templates-folder');
const folderStatus = document.getElementById('folder-status');
const templatesFolderStatus = document.getElementById('templates-folder-status');
const readingFileInput = document.getElementById('reading-file-input');
const readingFileName = document.getElementById('reading-file-name');

// ==================== ФОРМУЛЫ ОСТРОТЫ (обёртки §A2-v3) ====================
function getNodeComputedSizeMm(node) { return window.AppEditor.getNodeComputedSizeMm(node); }
function getNodeComputedSize(node) { return window.AppEditor.getNodeComputedSize(node); }

// ==================== УТИЛИТЫ ====================
function safeVal(id, defVal, parser) {
    const el = document.getElementById(id);
    if (!el) return defVal;
    const v = parser ? parser(el.value) : el.value;
    return v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v)) ? defVal : v;
}
function safeChecked(id, defVal) {
    const el = document.getElementById(id);
    return el ? el.checked === true : defVal;
}

// ==================== SCENARIO KEY / BOOKMARKS ====================
function generateScenarioKey() {
    return 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
function bookmarkKeyFor(bookId) {
    return 'vissort_bookmark_' + (window._currentScenarioKey || 'default') + '_' + bookId;
}
function getLastBookId() {
    try {
        const k = 'vissort_lastBookId_' + (window._currentScenarioKey || 'default');
        const id = localStorage.getItem(k);
        if (id && window._books && window._books[id]) return id;
    } catch (_) {}
    return null;
}
function setLastBookId(id) {
    try {
        const k = 'vissort_lastBookId_' + (window._currentScenarioKey || 'default');
        if (id) localStorage.setItem(k, id);
        else localStorage.removeItem(k);
    } catch (_) {}
}

// ==================== ПОЛЬЗОВАТЕЛЬСКИЕ НАСТРОЙКИ ====================
function loadUserSettings() {
    let ff = localStorage.getItem(LS_KEYS.readingFontFamily);
    if (ff && (ff.includes(',') || ff.includes('"'))) ff = ff.split(',')[0].trim().replace(/['"]/g, '');
    if (ff) readingFontFamily = ff;
    const fw = localStorage.getItem(LS_KEYS.readingFontWeight);
    if (fw === 'normal' || fw === 'bold') readingFontWeight = fw;
    const ac = parseFloat(localStorage.getItem(LS_KEYS.readingAcuity));
    if (!isNaN(ac) && ac >= 0.1 && ac <= 2.0) currentAcuity = ac;
    const rd = parseFloat(localStorage.getItem(LS_KEYS.readingDistance));
    if (!isNaN(rd) && rd > 0) readingDistance = rd;
    const gd = parseFloat(localStorage.getItem(LS_KEYS.generalDistance));
    if (!isNaN(gd) && gd > 0) generalDistance = gd;
    const it = parseFloat(localStorage.getItem(LS_KEYS.distIncTol));
    if (!isNaN(it) && it >= 0 && it <= 100) distanceToleranceIncreasePct = it;
    const dt = parseFloat(localStorage.getItem(LS_KEYS.distDecTol));
    if (!isNaN(dt) && dt >= 0 && dt <= 100) distanceToleranceDecreasePct = dt;
    const to = parseFloat(localStorage.getItem(LS_KEYS.distTimeout));
    if (!isNaN(to) && to >= 0 && to <= 60) distanceRestoreTimeoutSec = to;
    const be = localStorage.getItem(LS_KEYS.blinkEnabled);
    if (be !== null) blinkEnabled = be === 'true';
    const bt = parseFloat(localStorage.getItem(LS_KEYS.blinkThreshold));
    if (!isNaN(bt) && bt > 0.05 && bt < 0.5) blinkThreshold = bt;
    const bm = parseFloat(localStorage.getItem(LS_KEYS.blinkMinRate));
    if (!isNaN(bm) && bm >= 0 && bm <= 60) blinkMinRate = bm;
    const bw = parseFloat(localStorage.getItem(LS_KEYS.blinkWindow));
    if (!isNaN(bw) && bw >= 5 && bw <= 120) blinkWindowSec = bw;
    const bls = localStorage.getItem(LS_KEYS.blinkLockShow);
    if (bls !== null) blinkLockShow = bls === 'true';
}
function saveUserSettings() {
    try {
        localStorage.setItem(LS_KEYS.readingFontFamily, readingFontFamily);
        localStorage.setItem(LS_KEYS.readingFontWeight, readingFontWeight);
        localStorage.setItem(LS_KEYS.readingAcuity, String(currentAcuity));
        localStorage.setItem(LS_KEYS.readingDistance, String(readingDistance));
        localStorage.setItem(LS_KEYS.generalDistance, String(generalDistance));
        localStorage.setItem(LS_KEYS.distIncTol, String(distanceToleranceIncreasePct));
        localStorage.setItem(LS_KEYS.distDecTol, String(distanceToleranceDecreasePct));
        localStorage.setItem(LS_KEYS.distTimeout, String(distanceRestoreTimeoutSec));
        localStorage.setItem(LS_KEYS.blinkEnabled, String(blinkEnabled));
        localStorage.setItem(LS_KEYS.blinkThreshold, String(blinkThreshold));
        localStorage.setItem(LS_KEYS.blinkMinRate, String(blinkMinRate));
        localStorage.setItem(LS_KEYS.blinkWindow, String(blinkWindowSec));
        localStorage.setItem(LS_KEYS.blinkLockShow, String(blinkLockShow));
    } catch (e) {
        VLog.warn('save settings:', e);
    }
}

// ==================== КОДИРОВКИ / ШРИФТ / ПАРСИНГ ====================
function decodeTextBuffer(buf) {
    const b = new Uint8Array(buf);
    if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf)
        return new TextDecoder('utf-8').decode(b);
    if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b);
    if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b);
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(b);
    } catch (e) {
        try {
            return new TextDecoder('windows-1251').decode(b);
        } catch (e2) {
            return new TextDecoder('utf-8').decode(b);
        }
    }
}
async function decodeTextFile(file) {
    return decodeTextBuffer(await file.arrayBuffer());
}
async function loadSivtsevFont() {
    const FONT_URL = 'https://cdn.jsdelivr.net/gh/shoorick/sivtsev-font@master/Sivtsev-Eye-Chart.otf';
    const KEY = 'sivtsevFontLoaded';
    if (localStorage.getItem(KEY) === 'true') return;
    let loaded = false;
    if (document.fonts && document.fonts.forEach) {
        document.fonts.forEach((f) => {
            if (f.family === 'Sivtsev' && f.status === 'loaded') loaded = true;
        });
    }
    if (loaded) {
        localStorage.setItem(KEY, 'true');
        return;
    }
    try {
        const font = new FontFace('Sivtsev', `url(${FONT_URL}) format('opentype')`, {
            style: 'normal',
            weight: 'normal'
        });
        await font.load();
        document.fonts.add(font);
        localStorage.setItem(KEY, 'true');
    } catch (err) {
        console.error('Sivtsev:', err);
    }
}
async function parseReadingFile(file) {
    const n = (file.name || '').toLowerCase();
    if (n.endsWith('.txt')) return await decodeTextFile(file);
    if (n.endsWith('.fb2')) return await parseFb2File(file);
    if (n.endsWith('.epub')) return await parseEpubFile(file);
    return await decodeTextFile(file);
}
async function parseFb2File(file) {
    let xmlText = await decodeTextFile(file);
    if (xmlText.charCodeAt(0) === 0xfeff) xmlText = xmlText.slice(1);
    xmlText = xmlText
        .replace(/<!DOCTYPE[^>\[]*(\[[\s\S]*?\])?[^>]*>/gi, '')
        .replace(/<\?xml[^?]*\?>/i, '<?xml version="1.0" encoding="UTF-8"?>');
    xmlText = xmlText
        .replace(/&nbsp;/g, '\u00A0')
        .replace(/&mdash;/g, '\u2014')
        .replace(/&ndash;/g, '\u2013')
        .replace(/&hellip;/g, '\u2026')
        .replace(/&laquo;/g, '\u00AB')
        .replace(/&raquo;/g, '\u00BB')
        .replace(/&ldquo;/g, '\u201C')
        .replace(/&rdquo;/g, '\u201D')
        .replace(/&lsquo;/g, '\u2018')
        .replace(/&rsquo;/g, '\u2019')
        .replace(/&copy;/g, '\u00A9')
        .replace(/&reg;/g, '\u00AE')
        .replace(/&trade;/g, '\u2122');
    const parser = new DOMParser();
    let doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) doc = parser.parseFromString(xmlText, 'text/html');
    const bodies = doc.querySelectorAll('body');
    if (bodies.length === 0) return extractFb2TextByRegex(xmlText);
    const result = [];
    bodies.forEach((body) => {
        const bn = (body.getAttribute?.('name') || '').toLowerCase();
        if (bn === 'notes' || bn === 'comments') return;
        body.querySelectorAll('title, subtitle, p, v, text-author, empty-line, poem, epigraph, cite').forEach(
            (node) => {
                if (node.tagName.toLowerCase() === 'empty-line') {
                    result.push('');
                    return;
                }
                const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
                if (t) result.push(t);
            }
        );
    });
    return result.length === 0 ? '' : result.join('\n');
}
function extractFb2TextByRegex(xmlText) {
    let t = xmlText
        .replace(/<[!?][^>]*>/g, ' ')
        .replace(/<binary[\s\S]*?<\/binary>/gi, ' ')
        .replace(/<empty-line\s*\/?>/gi, '\n')
        .replace(/<\/(p|title|subtitle|v|text-author|section|poem|epigraph|cite)>/gi, '\n')
        .replace(/<[^>]+>/g, '');
    t = t
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    return t
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n\s*\n+/g, '\n\n')
        .trim();
}
async function parseEpubFile(file) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip не загружен');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    let opfPath = null;
    const cf = zip.file('META-INF/container.xml');
    if (cf) {
        const xml = await cf.async('string');
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const rf = doc.querySelector('rootfile');
        if (rf) opfPath = rf.getAttribute('full-path');
    }
    if (!opfPath)
        zip.forEach((p) => {
            if (!opfPath && /\.opf$/i.test(p)) opfPath = p;
        });
    if (!opfPath) return await extractAllHtmlFromZip(zip);
    const opfFile = zip.file(opfPath);
    if (!opfFile) return await extractAllHtmlFromZip(zip);
    const opfDoc = new DOMParser().parseFromString(await opfFile.async('string'), 'application/xml');
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
    const manifest = {};
    opfDoc.querySelectorAll('manifest > item').forEach((item) => {
        const id = item.getAttribute('id'),
            href = item.getAttribute('href'),
            mt = item.getAttribute('media-type') || '';
        if (id && href) manifest[id] = { href, mediaType: mt };
    });
    const spine = [];
    opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
        const idref = ref.getAttribute('idref');
        if (idref && manifest[idref]) spine.push(manifest[idref].href);
    });
    if (spine.length === 0)
        Object.values(manifest).forEach((m) => {
            if (/html|xhtml/i.test(m.mediaType) || /\.x?html?$/i.test(m.href)) spine.push(m.href);
        });
    const result = [];
    for (const href of spine) {
        const clean = decodeURIComponent(href.split('#')[0]);
        const entry = zip.file(normalizeZipPath(opfDir + clean));
        if (!entry) continue;
        const text = extractTextFromHtml(await entry.async('string'));
        if (text) result.push(text);
    }
    return result.join('\n\n');
}
function normalizeZipPath(path) {
    const stack = [];
    for (const part of path.split('/')) {
        if (part === '' || part === '.') continue;
        if (part === '..') stack.pop();
        else stack.push(part);
    }
    return stack.join('/');
}
function extractTextFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc.body) return '';
    doc.body.querySelectorAll('script, style, nav').forEach((el) => el.remove());
    const blocks = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, li');
    const texts = [];
    if (blocks.length > 0)
        blocks.forEach((el) => {
            const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (t) texts.push(t);
        });
    else {
        const t = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) texts.push(t);
    }
    return texts.join('\n');
}
async function extractAllHtmlFromZip(zip) {
    const files = [];
    zip.forEach((p, e) => {
        if (!e.dir && /\.(x?html?|htm)$/i.test(p)) files.push({ p, e });
    });
    files.sort((a, b) => a.p.localeCompare(b.p));
    const result = [];
    for (const { e } of files) {
        const t = extractTextFromHtml(await e.async('string'));
        if (t) result.push(t);
    }
    return result.join('\n\n');
}

// ==================== КАЛИБРОВКА ЭКРАНА ====================
const CALIB_BAR_PX = 400;
function ppiFromMeasuredMm(mm) {
    if (!mm || mm <= 0) return null;
    return Math.round((CALIB_BAR_PX * (window.devicePixelRatio || 1) * 25.4) / mm);
}
function savePPI(ppi) {
    localStorage.setItem('screenPPI', String(ppi));
    localStorage.setItem('screenPPICalibrated', 'true');
}
function initScreenCalibration() {
    screenPPI = loadPPI();
}
function openScreenCalibModal() {
    const modalEl = document.getElementById('screen-calib-modal');
    if (!modalEl) return;
    const bar = document.getElementById('screen-calib-bar');
    if (bar) bar.style.width = CALIB_BAR_PX + 'px';
    const initialPPI = loadPPI(),
        dpr = window.devicePixelRatio || 1;
    const mmInput = document.getElementById('screen-calib-mm');
    if (!mmInput) return;
    mmInput.value = Math.round(((CALIB_BAR_PX * dpr) / initialPPI) * 25.4 * 2) / 2;
    const resultEl = document.getElementById('screen-calib-result');
    const detailEl = document.getElementById('screen-calib-detail');
    const autoEl = document.getElementById('screen-calib-auto');
    const update = () => {
        const ppi = ppiFromMeasuredMm(parseFloat(mmInput.value) || 0);
        if (resultEl) resultEl.textContent = ppi ? ppi : '—';
        if (detailEl)
            detailEl.textContent = ppi
                ? `${CALIB_BAR_PX * dpr} физ. px = ${(((CALIB_BAR_PX * dpr) / ppi) * 25.4).toFixed(1)} мм`
                : '';
    };
    mmInput.oninput = update;
    update();
    if (autoEl) {
        const info = { w: Math.round(window.screen.width * dpr), h: Math.round(window.screen.height * dpr) };
        autoEl.textContent = `${detectDeviceType()}, DPR: ${dpr}, ${info.w}×${info.h}, эвристика: ${detectPPIHeuristic()} PPI`;
    }
    modalEl.style.display = 'flex';
}
function applyScreenCalib() {
    const mmInput = document.getElementById('screen-calib-mm');
    const modalEl = document.getElementById('screen-calib-modal');
    if (!mmInput || !modalEl) return;
    const mm = parseFloat(mmInput.value);
    if (!mm || mm < 5 || mm > 500) {
        VissortDialog.alert('Введите длину в мм (5..500)');
        return;
    }
    const ppi = ppiFromMeasuredMm(mm);
    if (!ppi || ppi < 20 || ppi > 2000) {
        VissortDialog.alert('PPI вне разумных пределов');
        return;
    }
    savePPI(ppi);
    screenPPI = ppi;
    if (activeNodeId) {
        const node = getNode(activeNodeId);
        if (node && (node.nodeType === 'STIMULUS' || node.nodeType === 'DYNAMIC')) {
            node.stimPPI = ppi;
            requestRenderGraph();
            updateInspector();
        } else if (node && node.nodeType === 'READING') {
            node.readingPPI = ppi;
            requestRenderGraph();
            updateInspector();
        }
    }
    VissortDialog.alert(`✅ PPI сохранён: ${ppi}`);
    modalEl.style.display = 'none';
}

// ==================== ОЦЕНКА ВРЕМЕНИ СЦЕНАРИЯ ====================
function estimateScenarioDurationMs() {
    if (!nodes || nodes.length === 0) return 0;
    const visited = new Set();
    let total = 0;
    const startNode = nodes.find((n) => n.isStart === true) || nodes[0];
    if (!startNode) return 0;
    function nodeDuration(node) {
        const delay1 = node.delay1 || 0;
        const duration = node.duration || 1000;
        const delay2 = node.delay2 || 1000;
        const seriesCount = node.seriesCount || 1;
        const seriesSize = node.seriesSize || 1;
        if (node.nodeType === 'READING')
            return (node.duration || 60000) + (node.delay1 || 0) + (node.delay2 || 0);
        if (node.nodeType === 'COMPARE') return (delay1 + duration + delay2) * seriesCount * seriesSize;
        let perNode = (delay1 + duration + delay2) * seriesCount * seriesSize;
        if (node.singleStimDynamicEnabled)
            perNode = Math.max(
                perNode,
                (delay1 + (node.singleStimDuration || 10000) + delay2) * seriesCount * seriesSize
            );
        if (node.singleBgDynamicEnabled)
            perNode = Math.max(
                perNode,
                (delay1 + (node.singleBgDuration || 10000) + delay2) * seriesCount * seriesSize
            );
        return perNode;
    }
    function visit(nodeId) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        const node = getNode(nodeId);
        if (!node) return;
        if (node.isActive === false && node.nodeType !== 'LOGIC_IF') return;
        total += nodeDuration(node);
        connections.filter((c) => c.fromId === nodeId && !c.isLoop).forEach((c) => visit(c.toId));
        connections
            .filter((c) => c.fromId === nodeId && c.isLoop && c.toId !== nodeId)
            .forEach((c) => {
                const lim = Math.max(1, c.loopLimit || 1);
                const target = getNode(c.toId);
                const source = getNode(c.fromId);
                if (!target) return;
                total += nodeDuration(target) * lim;
                if (source && source.id !== target.id) total += nodeDuration(source) * lim;
            });
    }
    visit(startNode.id);
    return total;
}
function formatDurationMs(ms) {
    if (!ms || ms <= 0) return '0 с';
    const totalSec = Math.round(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h} ч ${m} мин ${s} с`;
    if (m > 0) return `${m} мин ${s} с`;
    return `${s} с`;
}
function showScenarioTimeReport() {
    const modalEl = document.getElementById('scenario-time-modal');
    const body = document.getElementById('scenario-time-body');
    if (!modalEl || !body) return;
    const totalMs = estimateScenarioDurationMs();
    const rows = nodes
        .filter((n) => n.isActive !== false)
        .map((n) => {
            const type = n.nodeType || 'STIMULUS';
            const d1 = n.delay1 || 0;
            const dur = n.duration || 1000;
            const d2 = n.delay2 || 1000;
            const sc = n.seriesCount || 1;
            const ss = n.seriesSize || 1;
            let oneRoundMs, totalNodeMs;
            if (type === 'READING') {
                oneRoundMs = (n.duration || 60000) + d1 + d2;
                totalNodeMs = oneRoundMs;
            } else {
                oneRoundMs = d1 + dur + d2;
                totalNodeMs = oneRoundMs * sc * ss;
            }
            return {
                name: (n.name || '').replace(/</g, '&lt;'),
                oneRoundMs,
                totalNodeMs,
                shows: type === 'READING' ? 1 : sc * ss
            };
        });
    let html = `<div style="margin-bottom:10px;">
        <div>Узлов: <b>${nodes.length}</b> · Связей: <b>${connections.length}</b></div>
        <div style="font-size:22px;color:#a5b4fc;font-weight:800;margin-top:6px;">${formatDurationMs(totalMs)}</div>
    </div><table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="border-bottom:1px solid #3f3f46;color:#94a3b8;">
        <th style="text-align:left;padding:6px 4px;">Узел</th>
        <th style="text-align:right;padding:6px 4px;">Показов</th>
        <th style="text-align:right;padding:6px 4px;">1 показ</th>
        <th style="text-align:right;padding:6px 4px;">Всего</th></tr></thead><tbody>`;
    rows.forEach((r) => {
        html += `<tr style="border-bottom:1px solid #1e1e24;"><td style="padding:6px 4px;">${r.name}</td>
        <td style="text-align:right;padding:6px 4px;">${r.shows}</td>
        <td style="text-align:right;padding:6px 4px;color:#94a3b8;">${formatDurationMs(r.oneRoundMs)}</td>
        <td style="text-align:right;padding:6px 4px;color:#a5b4fc;font-weight:600;">${formatDurationMs(r.totalNodeMs)}</td></tr>`;
    });
    html += `</tbody></table>`;
    body.innerHTML = html;
    modalEl.style.display = 'flex';
}

// ==================== ИНДИКАТОРЫ / ПРЕДУПРЕЖДЕНИЯ ====================
function updateLiveDistanceIndicator() {
    const indicator = document.getElementById('live-distance-indicator');
    if (!indicator) return;
    if (currentDistanceMeters == null || !isFinite(currentDistanceMeters)) {
        indicator.style.display = 'none';
        return;
    }
    indicator.textContent = `📏 ${currentDistanceMeters.toFixed(2)} м`;
    indicator.style.display = 'block';
}
function hideLiveDistanceIndicator() {
    const i = document.getElementById('live-distance-indicator');
    if (i) i.style.display = 'none';
}
function getDistanceWarningEl() {
    let el = document.getElementById('distance-warning');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'distance-warning';
    el.style.cssText =
        'position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); padding: 22px 40px; background: rgba(220,38,38,0.92); color: #fff; font-size: 44px; font-weight: bold; border-radius: 14px; z-index: 99999; display: none; pointer-events: none; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.6); font-family: "Segoe UI",Tahoma,sans-serif; letter-spacing: 1px;';
    document.body.appendChild(el);
    return el;
}
function showDistanceWarning(kind) {
    const el = getDistanceWarningEl();
    el.textContent = kind === 'up' ? 'Не отклоняйтесь' : 'Не приближайтесь';
    el.style.background = kind === 'up' ? 'rgba(220,38,38,0.92)' : 'rgba(234,88,12,0.92)';
    el.style.display = 'block';
    if (window.Voice) window.Voice.sayKey(kind === 'up' ? 'moveUp' : 'moveBack', { cancel: true });
}
function hideDistanceWarning() {
    const el = document.getElementById('distance-warning');
    if (el) el.style.display = 'none';
    _distanceWarningKind = null;
}
function resetDistanceTracking() {
    _distanceBaseline = null;
    _distanceOutOfBoundsSince = 0;
    _distanceWarningKind = null;
    _distanceRecalcScheduled = false;
    hideDistanceWarning();
}
function setDistanceBaselineIfNeeded() {
    if (_distanceBaseline == null && currentDistanceMeters != null && isFinite(currentDistanceMeters))
        _distanceBaseline = currentDistanceMeters;
}
function evaluateDistanceDeviation() {
    if (_distanceBaseline == null || currentDistanceMeters == null || !isFinite(currentDistanceMeters))
        return 'ok';
    const dev = ((currentDistanceMeters - _distanceBaseline) / _distanceBaseline) * 100;
    if (dev > distanceToleranceIncreasePct) return 'up';
    if (dev < -distanceToleranceDecreasePct) return 'down';
    return 'ok';
}

// ==================== МОРГАНИЕ (анимация) ====================
function scheduleVoiceCountdown(durationMs, p) {
    if (!window.Voice || !window.Voice.enabled) return;
    if (!durationMs || durationMs < 5000) return;
    const timers = [];
    if (durationMs - 5000 > 0) {
        timers.push(
            setTimeout(() => {
                if (!responsePhaseActive || isPaused) return;
                window.Voice.sayKey('countdown5');
            }, durationMs - 5000)
        );
    }
    [3, 2, 1].forEach((s) => {
        const at = durationMs - s * 1000;
        if (at > 0)
            timers.push(
                setTimeout(() => {
                    if (!responsePhaseActive || isPaused) return;
                    window.Voice.sayKey('countdown' + s);
                }, at)
            );
    });
    const watcher = setInterval(() => {
        if (!responsePhaseActive) {
            timers.forEach((t) => clearTimeout(t));
            clearInterval(watcher);
        }
    }, 200);
}

// ==================== КАМЕРА ====================
function setStimColorRGB(r, g, b) {
    if (!stimDisplay) return;
    const svg = stimDisplay.querySelector('svg');
    if (!svg) return;
    const color = `rgb(${r},${g},${b})`;
    const p = svg.querySelector('path');
    if (p) p.setAttribute('fill', color);
    const c = svg.querySelector('circle');
    if (c) c.setAttribute('stroke', color);
}
// ==================== АНИМАЦИЯ КРУГА ====================
let _circleAnimId = null,
    _circleAnimStart = null;
let _circleInnerPhases = null,
    _circleOuterPhases = null;
let _circleInnerDurationMs = 10000,
    _circleOuterDurationMs = 10000;
let _circleInnerLoop = true,
    _circleOuterLoop = true;

function startCircleAnimation(node) {
    stopCircleAnimation();
    if (!stimDisplay) return;
    const svg = stimDisplay.querySelector('svg');
    if (!svg) return;
    const grads = svg.querySelectorAll('radialGradient');
    if (grads.length < 2) return;
    const outerGrad = grads[0],
        innerGrad = grads[1];
    _circleInnerPhases = buildCirclePhases(
        node.circleInnerColor1,
        node.circleInnerMidEnabled,
        node.circleInnerColor3,
        node.circleInnerColor2,
        node.circleInnerReverse
    );
    _circleOuterPhases = buildCirclePhases(
        node.circleOuterColor1,
        node.circleOuterMidEnabled,
        node.circleOuterColor3,
        node.circleOuterColor2,
        node.circleOuterReverse
    );
    _circleInnerDurationMs = Math.max(200, node.circleInnerDuration || 10000);
    _circleOuterDurationMs = Math.max(200, node.circleOuterDuration || 10000);
    _circleInnerLoop = node.circleInnerLoop !== false;
    _circleOuterLoop = node.circleOuterLoop !== false;
    _circleAnimStart = null;
    function paintGradient(gradEl, phases, cycleMs, elapsed) {
        if (!gradEl) return;
        const count = phases.length;
        if (count === 0) return;
        let t = (elapsed % cycleMs) / cycleMs;
        const pi = Math.max(0, Math.min(count - 1, Math.floor(t * count)));
        const ph = phases[pi];
        if (!ph) return;
        const stops = gradEl.querySelectorAll('stop');
        if (stops.length >= 2) {
            stops[0].setAttribute('stop-color', `rgb(${ph.from.r},${ph.from.g},${ph.from.b})`);
            if (stops.length >= 3) {
                const midCur = lerpColor(ph.from, ph.to, 0.5);
                stops[1].setAttribute('stop-color', `rgb(${midCur.r},${midCur.g},${midCur.b})`);
                stops[stops.length - 1].setAttribute('stop-color', `rgb(${ph.to.r},${ph.to.g},${ph.to.b})`);
            } else {
                stops[stops.length - 1].setAttribute('stop-color', `rgb(${ph.to.r},${ph.to.g},${ph.to.b})`);
            }
        }
    }
    function tick(now) {
        if (!playerRunning || isPaused) {
            _circleAnimId = null;
            return;
        }
        if (_circleAnimStart === null) _circleAnimStart = now;
        const elapsed = now - _circleAnimStart;
        const innerDone = !_circleInnerLoop && elapsed > _circleInnerDurationMs;
        const outerDone = !_circleOuterLoop && elapsed > _circleOuterDurationMs;
        if (innerDone && outerDone) {
            _circleAnimId = null;
            return;
        }
        if (!innerDone) paintGradient(innerGrad, _circleInnerPhases, _circleInnerDurationMs, elapsed);
        if (!outerDone) paintGradient(outerGrad, _circleOuterPhases, _circleOuterDurationMs, elapsed);
        _circleAnimId = requestAnimationFrame(tick);
    }
    _circleAnimId = requestAnimationFrame(tick);
}
function stopCircleAnimation() {
    if (_circleAnimId) {
        cancelAnimationFrame(_circleAnimId);
        _circleAnimId = null;
    }
    _circleInnerPhases = null;
    _circleOuterPhases = null;
}

// ==================== ПЕРИФЕРИЯ ====================
function getPeripheralLayer() {
    let layer = document.getElementById('peri-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'peri-layer';
        layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden;';
        if (getComputedStyle(stimArea).position === 'static') stimArea.style.position = 'relative';
        stimArea.appendChild(layer);
    }
    return layer;
}
function clearPeripheralLayer() {
    const layer = document.getElementById('peri-layer');
    if (layer) layer.innerHTML = '';
}
function stopPeripheralAnimation() {
    if (_periAnimId) {
        cancelAnimationFrame(_periAnimId);
        _periAnimId = null;
    }
    _periAnimStart = null;
    clearPeripheralLayer();
}
function buildPeripheralDots(node, stimSize) {
    clearPeripheralLayer();
    if (!node.periEnabled) return;
    const layer = getPeripheralLayer();
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    const count = Math.max(1, Math.min(12, node.periCount || 4));
    const dCalc = currentDistanceMeters || node.stimDistance || 1;
    const pCalc = node.stimPPI || screenPPI || 96;
    const sizePx = acuityToSizePx(node.periAcuity || 0.3, dCalc, pCalc);
    const half = Math.min(aw, ah) / 2;
    const rMin = ((node.periRadiusMinPct ?? 60) / 100) * half;
    const rMax = ((node.periRadiusMaxPct ?? 90) / 100) * half;
    const color = node.periColor || { r: 0, g: 255, b: 100 };
    const colorStr = `rgb(${color.r},${color.g},${color.b})`;
    const baseAngles = [];
    for (let i = 0; i < count; i++)
        baseAngles.push(node.periRandomAngles ? Math.random() * Math.PI * 2 : (i / count) * Math.PI * 2);
    const radii = baseAngles.map(() => rMin + Math.random() * (rMax - rMin));
    const cx = aw / 2,
        cy = ah / 2;
    function drawAt(t) {
        layer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            let angle = baseAngles[i];
            let scale = 1;
            if (node.periMotion === 'rotate') {
                const speed = Math.max(0.02, Math.min(2, node.periSpeed || 0.3));
                angle += (t / 1000) * speed * Math.PI * 2;
            } else if (node.periMotion === 'pulse') {
                const speed = Math.max(0.5, Math.min(5, node.periSpeed || 1));
                scale = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(angle * 3 + (t / 1000) * speed * Math.PI * 2));
            }
            const x = cx + Math.cos(angle) * radii[i];
            const y = cy + Math.sin(angle) * radii[i];
            const d = document.createElement('div');
            const s = Math.max(2, sizePx * scale);
            d.style.cssText = `position:absolute;left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;border-radius:50%;background:${colorStr};box-shadow:0 0 6px rgba(0,0,0,0.4);`;
            layer.appendChild(d);
        }
    }
    drawAt(0);
    if (node.periMotion === 'static') return;
    _periAnimStart = null;
    function tick(now) {
        if (!playerRunning || isPaused) {
            _periAnimId = null;
            return;
        }
        if (_periAnimStart === null) _periAnimStart = now;
        drawAt(now - _periAnimStart);
        _periAnimId = requestAnimationFrame(tick);
    }
    _periAnimId = requestAnimationFrame(tick);
}

// ==================== ДЕФОКУС ====================
function buildDefocusFrame(node, stimSize, stimHtml, stimDirection) {
    if (!node.dfEnabled) return null;
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return null;
    const pCalc = node.stimPPI || screenPPI || 96;
    const rMm = Math.max(5, node.dfCenterRadiusMm || 13);
    const rPx = Math.round((rMm * pCalc) / 25.4 / (window.devicePixelRatio || 1));
    const diameter = rPx * 2;
    const per = node.dfPeriBg || { r: 0, g: 71, b: 171 };
    const cb = node.dfCenterBg || { r: 204, g: 0, b: 0 };
    const sc = node.dfStimColor || { r: 0, g: 0, b: 0 };
    const blur = Math.max(0, Math.min(100, node.dfPeriBlur || 0));
    const periStyle =
        blur > 0
            ? `radial-gradient(circle at center, rgb(${per.r},${per.g},${per.b}) 0%, rgb(${per.r},${per.g},${per.b}) ${100 - blur}%, rgba(${per.r},${per.g},${per.b},0) 100%)`
            : `rgb(${per.r},${per.g},${per.b})`;
    const blackHtml = stimHtml
        .replace(/fill="rgb\(\d+,\d+,\d+\)"/g, `fill="rgb(${sc.r},${sc.g},${sc.b})"`)
        .replace(/stroke="rgb\(\d+,\d+,\d+\)"/g, `stroke="rgb(${sc.r},${sc.g},${sc.b})"`);
    const frame = document.createElement('div');
    frame.id = 'defocus-frame';
    frame.style.cssText = `position:absolute;inset:0;background:${periStyle};display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:1;`;
    const center = document.createElement('div');
    center.style.cssText = `width:${diameter}px;height:${diameter}px;border-radius:50%;background:rgb(${cb.r},${cb.g},${cb.b});display:flex;align-items:center;justify-content:center;`;
    center.innerHTML = blackHtml;
    frame.appendChild(center);
    return { html: frame, diameter };
}

// ==================== СЕТКА ОДИНОЧНОГО СТИМУЛА ====================
function removeSingleGridLines() {
    if (!stimArea) return;
    stimArea.querySelectorAll('.single-grid-overlay').forEach((el) => el.remove());
}
function drawSingleGridLines(gx, gy) {
    if (!stimArea) return;
    removeSingleGridLines();
    if (gx <= 1 && gy <= 1) return;
    const o = document.createElement('div');
    o.className = 'single-grid-overlay';
    o.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;';
    const imgs = [],
        sizes = [];
    if (gx > 1) {
        imgs.push('linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px)');
        sizes.push(`${100 / gx}% 100%`);
    }
    if (gy > 1) {
        imgs.push('linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)');
        sizes.push(`100% ${100 / gy}%`);
    }
    o.style.backgroundImage = imgs.join(', ');
    o.style.backgroundSize = sizes.join(', ');
    o.style.backgroundRepeat = 'repeat';
    if (getComputedStyle(stimArea).position === 'static') stimArea.style.position = 'relative';
    stimArea.appendChild(o);
}
function applySingleGridPosition(size, gx, gy, row, col, showLines) {
    if (!stimArea || !stimDisplay) return;
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    gx = Math.max(1, parseInt(gx) || 1);
    gy = Math.max(1, parseInt(gy) || 1);
    row = Math.max(0, Math.min(gy - 1, parseInt(row) || 0));
    col = Math.max(0, Math.min(gx - 1, parseInt(col) || 0));
    const cw = aw / gx,
        ch = ah / gy;
    const tx = (col + 0.5) * cw,
        ty = (row + 0.5) * ch;
    const dx = tx - aw / 2,
        dy = ty - ah / 2;
    const svg = stimDisplay.querySelector('svg');
    if (svg) svg.style.transform = `translate(${dx}px, ${dy}px)`;
    if (showLines) drawSingleGridLines(gx, gy);
    else removeSingleGridLines();
}
function pickSingleGridCell(gx, gy, randomCell, avoidRepeat, fixedRow, fixedCol, selectedCells) {
    gx = Math.max(1, parseInt(gx) || 1);
    gy = Math.max(1, parseInt(gy) || 1);
    let allowed = [];
    if (Array.isArray(selectedCells) && selectedCells.length > 0) {
        allowed = selectedCells.filter(
            (c) =>
                c &&
                typeof c.row === 'number' &&
                typeof c.col === 'number' &&
                c.row >= 0 &&
                c.row < gy &&
                c.col >= 0 &&
                c.col < gx
        );
    }
    if (allowed.length === 0) {
        for (let r = 0; r < gy; r++) for (let c = 0; c < gx; c++) allowed.push({ row: r, col: c });
    }
    if (!randomCell) {
        const wr = Math.max(0, Math.min(gy - 1, parseInt(fixedRow) || 0));
        const wc = Math.max(0, Math.min(gx - 1, parseInt(fixedCol) || 0));
        return allowed.find((c) => c.row === wr && c.col === wc) || allowed[0];
    }
    if (allowed.length === 1) return allowed[0];
    let cell,
        attempts = 0;
    do {
        cell = allowed[Math.floor(Math.random() * allowed.length)];
        attempts++;
    } while (
        avoidRepeat &&
        attempts < 25 &&
        cell.row === currentSingleCell.row &&
        cell.col === currentSingleCell.col &&
        allowed.length > 1
    );
    return cell;
}
function applyRandomStimulusPosition(size) {
    if (!stimArea || !stimDisplay) return;
    const aw = stimArea.clientWidth,
        ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    const p = 20;
    const dxM = Math.max(0, (aw - size) / 2 - p),
        dyM = Math.max(0, (ah - size) / 2 - p);
    if (dxM <= 0 && dyM <= 0) return;
    const dx = (Math.random() * 2 - 1) * dxM,
        dy = (Math.random() * 2 - 1) * dyM;
    const svg = stimDisplay.querySelector('svg');
    if (svg) svg.style.transform = `translate(${dx}px, ${dy}px)`;
}

// ==================== ДИНАМИКА ЦВЕТА ====================
function startSingleStimAnimation(params) {
    stopSingleStimAnimation();
    if (!stimDisplay) return;
    const phases = buildGenericDynamicPhases(
        params.singleStimColor1,
        params.singleStimMidEnabled,
        params.singleStimColor3,
        params.singleStimColor2,
        params.singleStimReverse
    );
    const phaseCount = phases.length;
    if (phaseCount === 0) return;
    const totalTime = Math.max(200, params.singleStimDuration || 10000);
    const phaseDuration = totalTime / phaseCount;
    const shouldLoop = params.singleStimLoop === true;
    const cycleDurationMs = phaseDuration * phaseCount;
    const first = phases[0].from;
    setStimColorRGB(first.r, first.g, first.b);
    singleStimAnimStart = null;
    function tick(now) {
        if (!playerRunning || isPaused) {
            singleStimAnimId = null;
            return;
        }
        if (singleStimAnimStart === null) singleStimAnimStart = now;
        let elapsed = Math.max(0, now - singleStimAnimStart);
        let cycleT = elapsed / cycleDurationMs;
        if (cycleT >= 1) {
            if (shouldLoop) {
                singleStimAnimStart += Math.floor(cycleT) * cycleDurationMs;
                elapsed = Math.max(0, now - singleStimAnimStart);
                cycleT = elapsed / cycleDurationMs;
            } else {
                const last = phases[phaseCount - 1].to;
                setStimColorRGB(last.r, last.g, last.b);
                singleStimAnimId = null;
                return;
            }
        }
        cycleT = Math.max(0, cycleT);
        const phaseIdx = Math.max(0, Math.min(phaseCount - 1, Math.floor(cycleT * phaseCount)));
        const phaseProgress = Math.max(0, Math.min(1, cycleT * phaseCount - phaseIdx));
        const phase = phases[phaseIdx];
        if (!phase) {
            singleStimAnimId = null;
            return;
        }
        const cur = lerpColor(phase.from, phase.to, phaseProgress);
        setStimColorRGB(cur.r, cur.g, cur.b);
        singleStimAnimId = requestAnimationFrame(tick);
    }
    singleStimAnimId = requestAnimationFrame(tick);
}
function stopSingleStimAnimation() {
    if (singleStimAnimId) {
        cancelAnimationFrame(singleStimAnimId);
        singleStimAnimId = null;
    }
}
function startSingleBgAnimation(params) {
    stopSingleBgAnimation();
    if (!stimArea) return;
    const phases = buildGenericDynamicPhases(
        params.singleBgColor1,
        params.singleBgMidEnabled,
        params.singleBgColor3,
        params.singleBgColor2,
        params.singleBgReverse
    );
    const phaseCount = phases.length;
    if (phaseCount === 0) return;
    const totalTime = Math.max(200, params.singleBgDuration || 10000);
    const phaseDuration = totalTime / phaseCount;
    const shouldLoop = params.singleBgLoop === true;
    const cycleDurationMs = phaseDuration * phaseCount;
    const first = phases[0].from;
    stimArea.style.backgroundColor = `rgb(${first.r},${first.g},${first.b})`;
    singleBgAnimStart = null;
    function tick(now) {
        if (!playerRunning || isPaused) {
            singleBgAnimId = null;
            return;
        }
        if (singleBgAnimStart === null) singleBgAnimStart = now;
        let elapsed = Math.max(0, now - singleBgAnimStart);
        let cycleT = elapsed / cycleDurationMs;
        if (cycleT >= 1) {
            if (shouldLoop) {
                singleBgAnimStart += Math.floor(cycleT) * cycleDurationMs;
                elapsed = Math.max(0, now - singleBgAnimStart);
                cycleT = elapsed / cycleDurationMs;
            } else {
                const last = phases[phaseCount - 1].to;
                stimArea.style.backgroundColor = `rgb(${last.r},${last.g},${last.b})`;
                singleBgAnimId = null;
                return;
            }
        }
        cycleT = Math.max(0, cycleT);
        const phaseIdx = Math.max(0, Math.min(phaseCount - 1, Math.floor(cycleT * phaseCount)));
        const phaseProgress = Math.max(0, Math.min(1, cycleT * phaseCount - phaseIdx));
        const phase = phases[phaseIdx];
        if (!phase) {
            singleBgAnimId = null;
            return;
        }
        const cur = lerpColor(phase.from, phase.to, phaseProgress);
        stimArea.style.backgroundColor = `rgb(${cur.r},${cur.g},${cur.b})`;
        singleBgAnimId = requestAnimationFrame(tick);
    }
    singleBgAnimId = requestAnimationFrame(tick);
}
function stopSingleBgAnimation() {
    if (singleBgAnimId) {
        cancelAnimationFrame(singleBgAnimId);
        singleBgAnimId = null;
    }
}

// ==================== ФИЗИОЛОГИЧЕСКАЯ ШКАЛА ====================
const PHYSIOLOGICAL_PHASES = window.AppGenerator.PHYSIOLOGICAL_PHASES;

// ==================== ОБЁРТКИ APP-EDITOR (§A2-v3) ====================
function generateId() { return window.AppEditor.generateId(); }
function getNode(id) { return window.AppEditor.getNode(id); }
function canAddConnection(fromId, toId, isLoop) { return window.AppEditor.canAddConnection(fromId, toId, isLoop); }
function buildPlayQueue() { return window.AppEditor.buildPlayQueue(); }
function nodeToReadingParams(node) { return window.AppEditor.nodeToReadingParams(node); }
function defaultCompareCellParams() { return window.AppEditor.defaultCompareCellParams(); }
function createNewNode(type, x, y) { return window.AppEditor.createNewNode(type, x, y); }
function deleteNode(id) { return window.AppEditor.deleteNode(id); }
function selectNode(id) { return window.AppEditor.selectNode(id); }
function requestRenderGraph() { return window.AppEditor.requestRenderGraph(); }
function renderGraph() { return window.AppEditor.renderGraph(); }
function clearTempLine() { return window.AppEditor.clearTempLine(); }
function createNodeElement(node) { return window.AppEditor.createNodeElement(node); }
function fillReadingNodeInfo(b, d, v, f, node) { return window.AppEditor.fillReadingNodeInfo(b, d, v, f, node); }
function fillStimulusNodeInfo(a, mm, px, dst, srs, dyn, node) { return window.AppEditor.fillStimulusNodeInfo(a, mm, px, dst, srs, dyn, node); }
function fillCompareNodeInfo(m, g, s, t, node) { return window.AppEditor.fillCompareNodeInfo(m, g, s, t, node); }
function updateNodeElement(el, node) { return window.AppEditor.updateNodeElement(el, node); }
function startConnection(sourceId, isLoop) { return window.AppEditor.startConnection(sourceId, isLoop); }
function cancelConnection() { return window.AppEditor.cancelConnection(); }
function getNodeEdgePoint(node, tx, ty) { return window.AppEditor.getNodeEdgePoint(node, tx, ty); }
function createConnectionElements(conn) { return window.AppEditor.createConnectionElements(conn); }
function updateConnectionElements(els, conn) { return window.AppEditor.updateConnectionElements(els, conn); }
function onDragMove(e) { return window.AppEditor.onDragMove(e); }
function onDragEnd() { return window.AppEditor.onDragEnd(); }
function onResizeMove(e) { return window.AppEditor.onResizeMove(e); }
function onResizeEnd() { return window.AppEditor.onResizeEnd(); }
function showConnectionMenu(e, conn) { return window.AppEditor.showConnectionMenu(e, conn); }
function hideConnectionMenu() { return window.AppEditor.hideConnectionMenu(); }
// ==================== ИНСПЕКТОР: ДИСПЕТЧЕР ====================
// ==================== РЕЖИМ ЧТЕНИЯ (служебное) ====================
function showReadingToolbar() {
    const tb = document.getElementById('reading-toolbar');
    if (tb) tb.style.display = 'flex';
}
function hideReadingToolbar() {
    const tb = document.getElementById('reading-toolbar');
    if (tb) tb.style.display = 'none';
    const timer = document.getElementById('reading-timer');
    if (timer) timer.style.display = 'none';
}
function applyReadingFontForNode(node) {
    if (!readingContentEl) return;
    const family = (node.readingFontFamily && node.readingFontFamily.trim()) || 'Segoe UI';
    const safe = family.replace(/['"]/g, '');
    readingContentEl.style.fontFamily =
        safe.toLowerCase() === 'sivtsev'
            ? `'Sivtsev', 'Segoe UI', sans-serif`
            : `'${safe}', 'Segoe UI', Tahoma, sans-serif`;
    readingContentEl.style.fontWeight = node.readingFontWeight || 'normal';
}
function setupReadingColumns() {
    if (!readingViewportEl || !readingContentEl) return;
    const vw = readingViewportEl.clientWidth;
    if (vw <= 0) return;
    const sp = 80,
        tw = Math.max(200, vw - sp);
    readingContentEl.style.columnWidth = tw + 'px';
    readingContentEl.style.columnGap = sp + 'px';
}
function calcReadingTotalPages() {
    if (!readingViewportEl || !readingContentEl) return 1;
    const W = readingViewportEl.clientWidth;
    if (W <= 0) return 1;
    return Math.max(1, Math.round(readingContentEl.scrollWidth / W));
}
function scrollReadingToPage(page) {
    if (!readingViewportEl) return;
    readingTotalPages = calcReadingTotalPages();
    readingPage = Math.max(0, Math.min(page, readingTotalPages - 1));
    readingViewportEl.scrollLeft = readingPage * readingViewportEl.clientWidth;
    const info = document.getElementById('reading-page-info');
    if (info) info.textContent = `Стр. ${readingPage + 1} / ${readingTotalPages}`;
}
function prevReadingPage() {
    if (readingPage > 0) scrollReadingToPage(readingPage - 1);
}
function nextReadingPage() {
    if (readingPage < readingTotalPages - 1) scrollReadingToPage(readingPage + 1);
}
function toggleReadingPause() {
    if (!readingContentEl) return;
    readingPaused = !readingPaused;
    const b = document.getElementById('reading-play-pause');
    if (readingPaused) {
        readingContentEl.style.opacity = '0';
        if (b) b.textContent = '▶ Чтение';
    } else {
        readingContentEl.style.opacity = '1';
        if (b) b.textContent = '⏸ Пауза';
    }
}
function saveReadingBookmark() {
    if (!window._currentReadingBookId) {
        VissortDialog.alert('Нет книги');
        return;
    }
    localStorage.setItem(
        bookmarkKeyFor(window._currentReadingBookId),
        JSON.stringify({ page: readingPage, updatedAt: new Date().toISOString() })
    );
    VissortDialog.alert(`🔖 Закладка (страница ${readingPage + 1} из ${readingTotalPages})`);
}
function openReadingBookmark() {
    if (!window._currentReadingBookId) {
        VissortDialog.alert('Нет книги');
        return;
    }
    const s = localStorage.getItem(bookmarkKeyFor(window._currentReadingBookId));
    if (!s) {
        VissortDialog.alert('Закладка не найдена');
        return;
    }
    try {
        scrollReadingToPage(JSON.parse(s).page);
    } catch (e) {
        VissortDialog.alert('Ошибка');
    }
}
function changeAcuityByStep(delta) {
    if (!window._currentReadingNodeId) return;
    const node = getNode(window._currentReadingNodeId);
    if (!node || node.nodeType !== 'READING') return;
    const nV = Math.max(0.1, Math.min(2.0, Math.round((node.readingAcuity + delta) * 10) / 10));
    if (Math.abs(nV - node.readingAcuity) < 0.001) return;
    node.readingAcuity = nV;
    const d = currentDistanceMeters || node.readingDistance || readingDistance || 1;
    if (readingContentEl)
        readingContentEl.style.fontSize =
            acuityToFontSizePx(node.readingAcuity, d, node.readingPPI || screenPPI) + 'px';
    setTimeout(() => {
        readingTotalPages = calcReadingTotalPages();
        scrollReadingToPage(0);
    }, 60);
}
function updateReadingFontIndicator() {
    const f = document.getElementById('reading-font-input');
    if (f) f.value = readingFontFamily;
    const b = document.getElementById('reading-bold-toggle');
    if (b) b.classList.toggle('active', readingFontWeight === 'bold');
}
function saveCurrentReadingBookmarkSilently() {
    if (!window._currentReadingBookId) return;
    try {
        localStorage.setItem(
            bookmarkKeyFor(window._currentReadingBookId),
            JSON.stringify({ page: readingPage, updatedAt: new Date().toISOString() })
        );
        window._currentReadingPage = readingPage;
    } catch (e) {}
}

// ==================== ДИНАМИЧЕСКИЙ ФОН ЧТЕНИЯ ====================
let readingBgAnimId = null,
    readingBgAnimStart = null,
    readingBgAnimPausedAt = null;
function buildPhysiologicalPhases(step) { return window.AppGenerator.buildPhysiologicalPhases(step); }
function buildDynamicPhases(p) { return window.AppGenerator.buildDynamicPhases(p); }
function updatePhysioIndicator(meta, p) {
    const i = document.getElementById('physio-indicator');
    if (!i) return;
    if (p && p.dynamicShowLabel === false) {
        i.style.display = 'none';
        return;
    }
    if (!meta) {
        i.style.display = 'none';
        return;
    }
    i.textContent = `${meta.diopters >= 0 ? '+' : ''}${meta.diopters.toFixed(1)} дптр • ${meta.wavelength_nm} нм • ${meta.name}`;
    i.style.display = 'block';
}
function startDynamicReadingBackground(p) {
    stopDynamicReadingBackground();
    if (!readingViewportEl) return;
    const m = p.dynamicMode || 'simple',
        phases = buildDynamicPhases(p),
        cnt = phases.length;
    const rgb = m === 'rgb',
        phys = m === 'physiological',
        rev = p.dynamicReverse === true;
    const cycleMs = phys
        ? Math.max(100, p.dynamicStepDuration || 1000) * cnt
        : Math.max(100, p.dynamicDuration || 10000);
    const loop = p.dynamicLoop === true || rgb || rev || phys;
    const first = phases[0].from;
    readingViewportEl.style.background = `rgb(${first.r},${first.g},${first.b})`;
    if (phys) updatePhysioIndicator(phases[0].metaFrom, p);
    else updatePhysioIndicator(null, p);
    readingBgAnimStart = null;
    readingBgAnimPausedAt = null;
    function tick(now) {
        if (readingPaused) {
            if (readingBgAnimPausedAt === null) readingBgAnimPausedAt = now;
            readingBgAnimId = requestAnimationFrame(tick);
            return;
        }
        if (readingBgAnimPausedAt !== null) {
            readingBgAnimStart += now - readingBgAnimPausedAt;
            readingBgAnimPausedAt = null;
        }
        if (readingBgAnimStart === null) readingBgAnimStart = now;
        let el = Math.max(0, now - readingBgAnimStart),
            t = el / cycleMs;
        if (t >= 1) {
            if (loop) {
                readingBgAnimStart += Math.floor(t) * cycleMs;
                el = Math.max(0, now - readingBgAnimStart);
                t = el / cycleMs;
            } else {
                const l = phases[cnt - 1].to;
                readingViewportEl.style.background = `rgb(${l.r},${l.g},${l.b})`;
                if (phys && phases[cnt - 1].metaTo) updatePhysioIndicator(phases[cnt - 1].metaTo, p);
                readingBgAnimId = null;
                return;
            }
        }
        t = Math.max(0, t);
        const pi = Math.max(0, Math.min(cnt - 1, Math.floor(t * cnt))),
            pp = Math.max(0, Math.min(1, t * cnt - pi));
        const ph = phases[pi];
        if (!ph) {
            readingBgAnimId = null;
            return;
        }
        const c = lerpColor(ph.from, ph.to, pp);
        readingViewportEl.style.background = `rgb(${c.r},${c.g},${c.b})`;
        if (phys && (ph.metaFrom || ph.metaTo)) updatePhysioIndicator(pp < 0.5 ? ph.metaFrom : ph.metaTo, p);
        readingBgAnimId = requestAnimationFrame(tick);
    }
    readingBgAnimId = requestAnimationFrame(tick);
}
function stopDynamicReadingBackground() {
    if (readingBgAnimId) {
        cancelAnimationFrame(readingBgAnimId);
        readingBgAnimId = null;
    }
    readingBgAnimPausedAt = null;
    const i = document.getElementById('physio-indicator');
    if (i) i.style.display = 'none';
}
function applyReadingBackground(p) {
    if (!readingViewportEl) return;
    const m = p.bgMode || 'solid';
    stopDynamicReadingBackground();
    if (m === 'split') {
        const lw = Math.max(0, Math.min(100, p.splitLeftWidthPercent ?? 50));
        const lc = p.splitLeftColor || { r: 0, g: 0, b: 0 },
            rc = p.splitRightColor || { r: 0, g: 0, b: 0 };
        readingViewportEl.style.background = `linear-gradient(to right, rgb(${lc.r},${lc.g},${lc.b}) 0%, rgb(${lc.r},${lc.g},${lc.b}) ${lw}%, rgb(${rc.r},${rc.g},${rc.b}) ${lw}%, rgb(${rc.r},${rc.g},${rc.b}) 100%)`;
        return;
    }
    if (m === 'gradient') {
        const lc = p.gradientLeftColor || { r: 255, g: 255, b: 255 },
            rc = p.gradientRightColor || { r: 0, g: 0, b: 0 };
        if (p.gradientMidEnabled !== false) {
            const mc = p.gradientMidColor || { r: 204, g: 204, b: 204 },
                mp = Math.max(0, Math.min(100, p.gradientMidPosition ?? 50));
            readingViewportEl.style.background = `linear-gradient(to right, rgb(${lc.r},${lc.g},${lc.b}) 0%, rgb(${mc.r},${mc.g},${mc.b}) ${mp}%, rgb(${rc.r},${rc.g},${rc.b}) 100%)`;
        } else
            readingViewportEl.style.background = `linear-gradient(to right, rgb(${lc.r},${lc.g},${lc.b}) 0%, rgb(${rc.r},${rc.g},${rc.b}) 100%)`;
        return;
    }
    if (m === 'dynamic') {
        startDynamicReadingBackground(p);
        return;
    }
    const bg = p.bgColor || { r: 255, g: 255, b: 255 };
    readingViewportEl.style.background = `rgb(${bg.r},${bg.g},${bg.b})`;
}
function collectFontList() {
    const base = [
        'Sivtsev',
        'Segoe UI',
        'Arial',
        'Times New Roman',
        'Calibri',
        'Verdana',
        'Georgia',
        'Tahoma',
        'Trebuchet MS',
        'Consolas',
        'Courier New',
        'Cambria',
        'Garamond',
        'Palatino Linotype',
        'Comic Sans MS',
        'Bookman Old Style',
        'Franklin Gothic Medium',
        'Century Gothic',
        'Lucida Console',
        'MS Sans Serif'
    ];
    const seen = new Set(base.map((f) => f.toLowerCase()));
    const dl = document.getElementById('reading-font-list');
    if (dl)
        for (const o of dl.options) {
            const v = o.value;
            if (v && !seen.has(v.toLowerCase())) {
                seen.add(v.toLowerCase());
                base.push(v);
            }
        }
    return base;
}
function renderFontPickerList(filter) {
    const c = document.getElementById('font-picker-list');
    if (!c) return;
    const fonts = collectFontList();
    const f = (filter || '').trim().toLowerCase();
    const list = f ? fonts.filter((x) => x.toLowerCase().includes(f)) : fonts;
    c.innerHTML = '';
    if (list.length === 0) {
        c.innerHTML = '<div class="font-picker-empty">Ничего не найдено</div>';
        return;
    }
    const cur = (readingFontFamily || '').toLowerCase();
    list.forEach((name) => {
        const item = document.createElement('div');
        item.className = 'font-picker-item' + (name.toLowerCase() === cur ? ' active' : '');
        const l = document.createElement('span');
        l.textContent = name;
        l.style.fontFamily = `'${name.replace(/['"]/g, '')}', 'Segoe UI', sans-serif`;
        item.appendChild(l);
        const p = document.createElement('span');
        p.className = 'preview';
        p.textContent = 'АаБб 123';
        p.style.fontFamily = `'${name.replace(/['"]/g, '')}', 'Segoe UI', sans-serif`;
        item.appendChild(p);
        item.addEventListener('click', () => {
            const node = getNode(window._currentReadingNodeId);
            if (node && node.nodeType === 'READING') {
                node.readingFontFamily = name;
                applyReadingFontForNode(node);
                requestRenderGraph();
            } else {
                readingFontFamily = name;
                if (readingContentEl)
                    readingContentEl.style.fontFamily = `'${name.replace(/['"]/g, '')}', 'Segoe UI', sans-serif`;
            }
            saveUserSettings();
            closeFontPicker();
            setTimeout(() => {
                setupReadingColumns();
                readingTotalPages = calcReadingTotalPages();
                scrollReadingToPage(0);
            }, 60);
        });
        c.appendChild(item);
    });
}
function openFontPicker() {
    const m = document.getElementById('font-picker-modal');
    if (!m) return;
    const s = document.getElementById('font-picker-search');
    if (s) s.value = '';
    renderFontPickerList('');
    m.classList.add('visible');
    setTimeout(() => s?.focus(), 50);
}
function closeFontPicker() {
    const m = document.getElementById('font-picker-modal');
    if (m) m.classList.remove('visible');
}

// === Плеер-превью: обёртки на app-player-preview.js (2026-10-15) ===
function displayStimulus(html, bgColor) { return window.AppPlayerPreview.displayStimulus(html, bgColor); }
function hideStimulus() { return window.AppPlayerPreview.hideStimulus(); }
function updateCounters() { return window.AppPlayerPreview.updateCounters(); }
function startPlayer() { return window.AppPlayerPreview.startPlayer(); }
function startAutoTraining() { return window.AppPlayerPreview.startAutoTraining(); }
function playNodesSequence() { return window.AppPlayerPreview.playNodesSequence(); }
function playNextQueuedNode() { return window.AppPlayerPreview.playNextQueuedNode(); }
function playCompareNodeSeries(node) { return window.AppPlayerPreview.playCompareNodeSeries(node); }
function playNextCompareRound(node) { return window.AppPlayerPreview.playNextCompareRound(node); }
function finishCompareNodeSeries(node) { return window.AppPlayerPreview.finishCompareNodeSeries(node); }
function playStimulusNodeSeries(node) { return window.AppPlayerPreview.playStimulusNodeSeries(node); }
function finishStimulusNodeSeries(node) { return window.AppPlayerPreview.finishStimulusNodeSeries(node); }
function playReadingNode(node) { return window.AppPlayerPreview.playReadingNode(node); }
function finishReadingNodeAuto() { return window.AppPlayerPreview.finishReadingNodeAuto(); }
function finishReadingNode() { return window.AppPlayerPreview.finishReadingNode(); }
function startReadingNodeTimer(sec) { return window.AppPlayerPreview.startReadingNodeTimer(sec); }
function stopReadingNodeTimer() { return window.AppPlayerPreview.stopReadingNodeTimer(); }
function startReadingModeAuto() { return window.AppPlayerPreview.startReadingModeAuto(); }
function showNextStimulus() { return window.AppPlayerPreview.showNextStimulus(); }
function finishSeries() { return window.AppPlayerPreview.finishSeries(); }
function showNextComparison() { return window.AppPlayerPreview.showNextComparison(); }
function showDirectionComparison() { return window.AppPlayerPreview.showDirectionComparison(); }
function showFindSameComparison() { return window.AppPlayerPreview.showFindSameComparison(); }
function showFindSameComparisonInternal(pc) { return window.AppPlayerPreview.showFindSameComparisonInternal(pc); }
function handleFindSameClick(idx) { return window.AppPlayerPreview.handleFindSameClick(idx); }
function createCellElement(cell, params, direction, idx) { return window.AppPlayerPreview.createCellElement(cell, params, direction, idx); }
function defaultCellParams() { return window.AppPlayerPreview.defaultCellParams(); }
function processComparisonAnswer(isCorrect) { return window.AppPlayerPreview.processComparisonAnswer(isCorrect); }
function handleDirectionAnswer(direction) { return window.AppPlayerPreview.handleDirectionAnswer(direction); }
function handleCompareDirectionAnswer(answer) { return window.AppPlayerPreview.handleCompareDirectionAnswer(answer); }
function stopPlayer() { return window.AppPlayerPreview.stopPlayer(); }
function togglePause() { return window.AppPlayerPreview.togglePause(); }
function pauseTraining() { return window.AppPlayerPreview.pauseTraining(); }
function resumeTraining() { return window.AppPlayerPreview.resumeTraining(); }
function exitTrainingFromPause() { return window.AppPlayerPreview.exitTrainingFromPause(); }

function switchMode(mode) {
    currentMode = mode;
    const countersEl = document.getElementById('counters');
    const headerEl = document.querySelector('header');
    if (mode === 'nodes') {
        canvas.style.display = '';
        stimArea.style.display = 'none';
        btnModeToggle.textContent = '🎯 Узлы';
        if (countersEl) countersEl.style.display = 'none';
        if (headerEl) headerEl.classList.remove('stimuli-mode');
        requestRenderGraph();
    } else {
        canvas.style.display = 'none';
        stimArea.style.display = 'flex';
        btnModeToggle.textContent = '🖼️ Стимулы';
        if (countersEl) countersEl.style.display = 'inline-flex';
        if (headerEl) headerEl.classList.add('stimuli-mode');
        if (inspectorEl) inspectorEl.style.display = 'none';
    }
}

// ==================== ГЕНЕРАТОР: UI-СЕКЦИИ ====================
function ensureSingleGridGeneratorUI() { return window.AppGenerator.ensureSingleGridGeneratorUI(); }
function ensureDistanceGeneratorUI() { return window.AppGenerator.ensureDistanceGeneratorUI(); }
function ensureBlinkGeneratorUI() { return window.AppGenerator.ensureBlinkGeneratorUI(); }
function ensureCircleGeneratorUI() { return window.AppGenerator.ensureCircleGeneratorUI(); }
function ensurePeripheralGeneratorUI() { return window.AppGenerator.ensurePeripheralGeneratorUI(); }
function ensureDefocusGeneratorUI() { return window.AppGenerator.ensureDefocusGeneratorUI(); }
function ensureBlinkAnimationGeneratorUI() { return window.AppGenerator.ensureBlinkAnimationGeneratorUI(); }
function renderGridPreview() { return window.AppGenerator.renderGridPreview(); }
function generateCellParamsFields() { return window.AppGenerator.generateCellParamsFields(); }
function collectCompareParams() { return window.AppGenerator.collectCompareParams(); }
function buildModeParamsFromUI() { return window.AppGenerator.buildModeParamsFromUI(); }
function modeParamsToNode(modeParams) { return window.AppGenerator.modeParamsToNode(modeParams); }
function modeParamsToReadingNode(modeParams) { return window.AppGenerator.modeParamsToReadingNode(modeParams); }

async function loadUsers() {
    const us = document.getElementById('selected-user');
    if (!us) return;
    us.innerHTML = '<option>Загрузка…</option>';
    try {
        const users = await window.Data.getUsers();
        us.innerHTML = '';
        if (users.length === 0) us.innerHTML = '<option value="">— нет пользователей —</option>';
        else
            users.forEach((p) => {
                const o = document.createElement('option');
                o.value = p.id;
                o.textContent = (p.email || '(без email)') + (p.full_name ? ' (' + p.full_name + ')' : '');
                us.appendChild(o);
            });
        const sc = document.getElementById('selected-scenario');
        sc.innerHTML = '<option>Загрузка…</option>';
        const scenarios = await window.Data.getScenariosLocal();
        sc.innerHTML = '';
        if (scenarios.length === 0) sc.innerHTML = '<option value="">— нет сценариев —</option>';
        else
            scenarios.forEach((s) => {
                const o = document.createElement('option');
                o.value = s.id;
                o.textContent = s.name || '(без имени)';
                sc.appendChild(o);
            });
    } catch (e) {
        us.innerHTML = '<option value="">Ошибка: ' + escapeHtml(e.message) + '</option>';
    }
}
async function assignScenario() {
    const u = document.getElementById('selected-user').value;
    const s = document.getElementById('selected-scenario').value;
    if (!u || !s) {
        VissortDialog.alert('Выберите пользователя и сценарий');
        return;
    }
    await window.Data.assignScenario(u, s, 'ready');
    VissortDialog.alert('✅ Назначено');
}

// ==================== БЛОКИ ====================
function renderBlockList() {
    blockListDiv.innerHTML = '';
    blockList.forEach((b, i) => {
        const t = document.createElement('span');
        t.className = 'block-tag';
        t.innerHTML = `${escapeHtml(b.name)} (${escapeHtml(b.type)}) <span class="remove-block" data-index="${i}">✕</span>`;
        t.querySelector('.remove-block').addEventListener('click', function (e) {
            e.stopPropagation();
            blockList.splice(parseInt(this.dataset.index), 1);
            renderBlockList();
        });
        blockListDiv.appendChild(t);
    });
    blockCountSpan.textContent = `Блоков: ${blockList.length}`;
    blockListDiv.style.display = blockList.length > 0 ? 'block' : 'none';
}
async function addBlock() {
    const type = blockSelect.value,
        name = blockNameInput.value.trim() || 'Блок';
    let p = {};
    if (type === 'warmup') p = { count: 5, size: 200, duration: 1000 };
    else if (type === 'complex') p = { count: 10, size: 80, duration: 500 };
    else if (type === 'random') p = { count: 8, size: 150, duration: 800 };
    else if (type === 'custom') {
        const c = await VissortDialog.prompt('Количество:', '5');
        p = { count: parseInt(c) || 5, size: 120, duration: 700 };
    }
    blockList.push({ type, params: p, name });
    renderBlockList();
    blockNameInput.value = '';
}
function clearBlocks() {
    blockList = [];
    renderBlockList();
}
function generateSequenceFromBlocks() {
    if (blockList.length === 0) {
        VissortDialog.alert('Список пуст');
        return;
    }
    nodes = [];
    connections = [];
    activeNodeId = null;
    inspectorEl.style.display = 'none';
    updateInspector();
    let prevId = null;
    blockList.forEach((b, i) => {
        const x = 100 + i * 300,
            y = 100;
        const nid = createNewNode('STIMULUS', x, y);
        const n = getNode(nid);
        n.name = b.name || 'Блок ' + (i + 1);
        n.duration = b.params.duration || 1000;
        if (prevId)
            connections.push({
                fromId: prevId,
                toId: nid,
                isLoop: false,
                loopMode: 'TIME',
                loopLimit: 1,
                lifeTime: 0,
                initiateByAnswer: true,
                condition: 'none',
                inheritSize: false,
                inheritSpeed: false
            });
        prevId = nid;
    });
    activeNodeId = nodes.length > 0 ? nodes[0].id : null;
    if (activeNodeId) {
        inspectorEl.style.display = 'block';
        updateInspector();
    }
    requestRenderGraph();
    VissortDialog.alert('Последовательность создана.');
}

// ==================== AUTH ====================
function initSupabase() {
    supabaseClient = window.supabase.createClient(
        (window.VissortEnv && window.VissortEnv.SUPABASE_URL) || 'https://hzvypwdpdhsjzaclxmbm.supabase.co',
        (window.VissortEnv && window.VissortEnv.SUPABASE_ANON_KEY) ||
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6dnlwd2RwZGhzanphY2x4bWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjIyNTIsImV4cCI6MjEwNDE5ODI1Mn0.HK0VE9KdzS8c7WoMCIlvOUn02vSOQEN0ahGPgsYzKac'
    );
    window.supabaseClient = supabaseClient;
    supabaseClient.auth.getSession().then(({ data }) => {
        if (data?.session) {
            currentUser = data.session.user;
            window.Data.setAuth(data.session.access_token, data.session.user.id);
            updateAuthUI();
        } else showAuthModal('signin');
    });
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        if (session?.access_token) window.Data.setAuth(session.access_token, session.user.id);
        else if (event === 'SIGNED_OUT') window.Data.clearAuth();
        updateAuthUI();
        if (event === 'SIGNED_OUT') showAuthModal('signin');
    });
}
async function signIn(email, password) {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) VissortDialog.alert('Ошибка: ' + error.message);
    else document.getElementById('auth-modal').style.display = 'none';
}
async function signUp(email, password, fullName) {
    const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
    });
    if (error) VissortDialog.alert('Ошибка: ' + error.message);
    else document.getElementById('auth-modal').style.display = 'none';
}
async function signOut() {
    await supabaseClient.auth.signOut();
}
function updateAuthUI() {
    if (currentUser) {
        if (!ADMIN_EMAILS.includes(currentUser.email)) {
            window.location.href = 'user.html';
            return;
        }
        btnAuth.textContent = 'Выйти';
        userEmailSpan.textContent = currentUser.email;
        userEmailSpan.style.display = 'inline-flex';
        document.getElementById('main-layout').style.display = 'flex';
    } else {
        btnAuth.textContent = 'Войти';
        userEmailSpan.textContent = '';
        userEmailSpan.style.display = 'none';
        document.getElementById('main-layout').style.display = 'none';
    }
}
function showAuthModal(mode) {
    authMode = mode;
    const t = document.getElementById('auth-title'),
        nl = document.getElementById('auth-name-label'),
        ni = document.getElementById('auth-name'),
        tb = document.getElementById('auth-toggle'),
        sb = document.getElementById('auth-submit');
    if (mode === 'signin') {
        t.textContent = 'Вход';
        nl.style.display = 'none';
        ni.style.display = 'none';
        tb.textContent = 'Нет аккаунта? Регистрация';
        sb.textContent = 'Войти';
    } else {
        t.textContent = 'Регистрация';
        nl.style.display = 'block';
        ni.style.display = 'block';
        tb.textContent = 'Уже есть аккаунт? Войти';
        sb.textContent = 'Зарегистрироваться';
    }
    document.getElementById('auth-modal').style.display = 'flex';
}

// ==================== SERVICE WORKER ====================
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (IS_DEV) {
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
        return;
    }
    window.addEventListener('load', async () => {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            if (reg.waiting) showSWUpdateBanner(reg);
            reg.addEventListener('updatefound', () => {
                const nw = reg.installing;
                if (!nw) return;
                nw.addEventListener('statechange', () => {
                    if (nw.state === 'installed' && navigator.serviceWorker.controller)
                        showSWUpdateBanner(reg);
                });
            });
        } catch (err) {
            console.error('[SW]', err);
        }
    });
    let refreshing = false,
        hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) {
            hadController = true;
            return;
        }
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}
function showSWUpdateBanner(reg) {
    if (document.getElementById('sw-update-banner')) return;
    const el = document.createElement('div');
    el.id = 'sw-update-banner';
    el.style.cssText =
        'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#10b981;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;z-index:10000;display:flex;gap:10px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,0.4);font-family:"Segoe UI",Tahoma,sans-serif;';
    el.innerHTML =
        '<span>Доступна новая версия</span><button style="background:#fff;color:#10b981;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-weight:bold;font-family:inherit;">Обновить</button>';
    el.querySelector('button').addEventListener('click', () => {
        try {
            reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
        } catch (_) {}
        el.remove();
    });
    document.body.appendChild(el);
}

// ==================== INIT ====================
function init() {
    readingViewportEl = document.getElementById('reading-viewport');
    readingContentEl = document.getElementById('reading-content');
    readingToolbarEl = document.getElementById('reading-toolbar');
    window._books = window._books || {};
    if (!window._currentScenarioKey) window._currentScenarioKey = generateScenarioKey();
    loadUserSettings();
    loadSivtsevFont();
    initScreenCalibration();
    initSupabase();
    initInspectorEvents();
    ensureSingleGridGeneratorUI();
    ensureDistanceGeneratorUI();
    ensureBlinkGeneratorUI();
    ensureCircleGeneratorUI();
    ensurePeripheralGeneratorUI();
    ensureDefocusGeneratorUI();
    ensureBlinkAnimationGeneratorUI();
    ensureBlinkCalibrationUI();
    const sfn = localStorage.getItem('selectedFolderName');
    if (sfn) folderStatus.textContent = '📁 ' + sfn;
    btnSelectFolder.addEventListener('click', selectFolder);
    if (btnSelectTemplatesFolder) btnSelectTemplatesFolder.addEventListener('click', loadTemplatesFolder);
    btnPlayer.addEventListener('click', startPlayer);
    // Кнопка теста в player.html (?test=1)
    document.getElementById('btn-test')?.addEventListener('click', () => {
        const payload = {
            graph: {
                nodes: JSON.parse(JSON.stringify(nodes)),
                connections: JSON.parse(JSON.stringify(connections)),
                books: JSON.parse(JSON.stringify(window._books || {}))
            },
            trainingType: trainingNode?.params?.trainingType || 'single',
            distances: {
                general: generalDistance,
                reading: readingDistance,
                incTol: distanceToleranceIncreasePct,
                decTol: distanceToleranceDecreasePct,
                timeout: distanceRestoreTimeoutSec
            },
            blink: {
                enabled: blinkEnabled,
                threshold: blinkThreshold,
                minRate: blinkMinRate,
                window: blinkWindowSec,
                lockShow: blinkLockShow
            }
        };
        try {
            localStorage.setItem('vissort_test_scenario', JSON.stringify(payload));
            VLog.log('[test] scenario saved, opening user.html?test=1');
            window.open('/user.html?test=1', '_blank');
        } catch (e) {
            VissortDialog.alert('Не удалось: ' + e.message);
        }
    });
    VLog.log('[test] btn-test handler installed');
    btnPlayerStop.addEventListener('click', stopPlayer);
    btnPlayerPause.addEventListener('click', togglePause);
    btnModeToggle.addEventListener('click', () => switchMode(currentMode === 'nodes' ? 'stimuli' : 'nodes'));
    btnAddStim.addEventListener('click', () => createNewNode('STIMULUS'));
    btnAddLogic.addEventListener('click', () => createNewNode('LOGIC_IF'));
    btnAddDynamic.addEventListener('click', () => createNewNode('DYNAMIC'));
    btnAddReading.addEventListener('click', () => createNewNode('READING'));
    if (btnAddCompare) btnAddCompare.addEventListener('click', () => createNewNode('COMPARE'));
    if (btnCalibrateScreen) btnCalibrateScreen.addEventListener('click', openScreenCalibModal);
    if (btnScenarioTime) btnScenarioTime.addEventListener('click', showScenarioTimeReport);
    document.getElementById('scenario-time-close')?.addEventListener('click', () => {
        document.getElementById('scenario-time-modal').style.display = 'none';
    });
    document
        .getElementById('screen-calib-cancel')
        ?.addEventListener(
            'click',
            () => (document.getElementById('screen-calib-modal').style.display = 'none')
        );
    document.getElementById('screen-calib-apply')?.addEventListener('click', applyScreenCalib);
    document.getElementById('book-picker-close')?.addEventListener('click', closeBookPicker);
    document.getElementById('book-picker-detach')?.addEventListener('click', detachBookFromActiveNode);
    document.getElementById('book-picker-file')?.addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (f) await handleBookPickerFileUpload(f);
        e.target.value = '';
    });
    document.getElementById('book-picker-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'book-picker-modal') closeBookPicker();
    });
    document.getElementById('reading-prev')?.addEventListener('click', prevReadingPage);
    document.getElementById('reading-next')?.addEventListener('click', nextReadingPage);
    document.getElementById('reading-play-pause')?.addEventListener('click', toggleReadingPause);
    document.getElementById('reading-bookmark')?.addEventListener('click', saveReadingBookmark);
    document.getElementById('reading-open-bookmark')?.addEventListener('click', openReadingBookmark);
    document.getElementById('reading-not-see')?.addEventListener('click', () => changeAcuityByStep(-0.1));
    document.getElementById('reading-see-well')?.addEventListener('click', () => changeAcuityByStep(+0.1));
    document.getElementById('reading-finish')?.addEventListener('click', finishReadingNode);
    document.getElementById('reading-font-input')?.addEventListener('change', (e) => {
        const n = (e.target.value || '').trim();
        if (!n) return;
        const node = getNode(window._currentReadingNodeId);
        if (node && node.nodeType === 'READING') {
            node.readingFontFamily = n;
            applyReadingFontForNode(node);
            requestRenderGraph();
        } else {
            readingFontFamily = n;
            if (readingContentEl)
                readingContentEl.style.fontFamily = `'${n.replace(/['"]/g, '')}', 'Segoe UI', sans-serif`;
        }
        saveUserSettings();
        setTimeout(() => {
            setupReadingColumns();
            readingTotalPages = calcReadingTotalPages();
            scrollReadingToPage(0);
        }, 60);
    });
    document.getElementById('reading-font-picker')?.addEventListener('click', openFontPicker);
    document.getElementById('font-picker-close')?.addEventListener('click', closeFontPicker);
    document
        .getElementById('font-picker-search')
        ?.addEventListener('input', (e) => renderFontPickerList(e.target.value));
    document.getElementById('font-picker-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'font-picker-modal') closeFontPicker();
    });
    document.getElementById('reading-font-sivtsev')?.addEventListener('click', () => {
        const node = getNode(window._currentReadingNodeId);
        if (node && node.nodeType === 'READING') {
            node.readingFontFamily = 'Sivtsev';
            applyReadingFontForNode(node);
            requestRenderGraph();
        } else {
            readingFontFamily = 'Sivtsev';
            if (readingContentEl) readingContentEl.style.fontFamily = `'Sivtsev', 'Segoe UI', sans-serif`;
        }
        const i = document.getElementById('reading-font-input');
        if (i) i.value = 'Sivtsev';
        saveUserSettings();
        setTimeout(() => {
            setupReadingColumns();
            readingTotalPages = calcReadingTotalPages();
            scrollReadingToPage(0);
        }, 60);
    });
    const fontFileBtn = document.getElementById('reading-font-file');
    const fontFileInput = document.getElementById('reading-font-file-input');
    if (fontFileBtn && fontFileInput) {
        fontFileBtn.addEventListener('click', () => fontFileInput.click());
        fontFileInput.addEventListener('change', async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            try {
                const buf = await f.arrayBuffer();
                const familyName =
                    f.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9\u0400-\u04FF_ -]/g, '_') ||
                    'CustomFont';
                const font = new FontFace(familyName, buf);
                await font.load();
                document.fonts.add(font);
                const node = getNode(window._currentReadingNodeId);
                if (node && node.nodeType === 'READING') {
                    node.readingFontFamily = familyName;
                    applyReadingFontForNode(node);
                    requestRenderGraph();
                } else {
                    readingFontFamily = familyName;
                    if (readingContentEl)
                        readingContentEl.style.fontFamily = `'${familyName.replace(/['"]/g, '')}', 'Segoe UI', sans-serif`;
                }
                const i = document.getElementById('reading-font-input');
                if (i) i.value = familyName;
                saveUserSettings();
                setTimeout(() => {
                    setupReadingColumns();
                    readingTotalPages = calcReadingTotalPages();
                    scrollReadingToPage(0);
                }, 60);
            } catch (err) {
                VissortDialog.alert('Не удалось загрузить шрифт: ' + err.message);
            }
            fontFileInput.value = '';
        });
    }
    document.getElementById('reading-font-system')?.addEventListener('click', async () => {
        if (!('queryLocalFonts' in window)) {
            VissortDialog.alert('Браузер не поддерживает список системных шрифтов.');
            return;
        }
        try {
            const fonts = await window.queryLocalFonts();
            const fams = [...new Set(fonts.map((f) => f.family))].sort((a, b) => a.localeCompare(b, 'ru'));
            const list = document.getElementById('reading-font-list');
            list.innerHTML = '';
            const first = document.createElement('option');
            first.value = 'Sivtsev';
            first.textContent = 'Сивцев';
            list.appendChild(first);
            const pref = ['Segoe UI', 'Arial', 'Times New Roman', 'Calibri', 'Verdana', 'Georgia', 'Tahoma'];
            const ordered = [
                ...pref.filter((p) => fams.includes(p)),
                ...fams.filter((f) => !pref.includes(f) && f.toLowerCase() !== 'sivtsev')
            ];
            for (const fam of ordered) {
                const o = document.createElement('option');
                o.value = fam;
                list.appendChild(o);
            }
            VissortDialog.alert(`Загружено ${fams.length} шрифтов.`);
        } catch (err) {
            VissortDialog.alert('Ошибка: ' + err.message);
        }
    });
    document.getElementById('reading-bold-toggle')?.addEventListener('click', () => {
        const node = getNode(window._currentReadingNodeId);
        if (node && node.nodeType === 'READING') {
            node.readingFontWeight = node.readingFontWeight === 'bold' ? 'normal' : 'bold';
            applyReadingFontForNode(node);
            requestRenderGraph();
        } else {
            readingFontWeight = readingFontWeight === 'bold' ? 'normal' : 'bold';
            if (readingContentEl) readingContentEl.style.fontWeight = readingFontWeight;
        }
        const b = document.getElementById('reading-bold-toggle');
        if (b) {
            const isB = (node ? node.readingFontWeight : readingFontWeight) === 'bold';
            b.classList.toggle('active', isB);
        }
        saveUserSettings();
        setTimeout(() => {
            setupReadingColumns();
            readingTotalPages = calcReadingTotalPages();
            scrollReadingToPage(0);
        }, 60);
    });
    if (readingViewportEl) {
        let t = null;
        readingViewportEl.addEventListener('scroll', () => {
            if (readingViewportEl.style.display === 'none' || t) return;
            t = setTimeout(() => {
                t = null;
                const W = readingViewportEl.clientWidth;
                if (W <= 0) return;
                const np = Math.round(readingViewportEl.scrollLeft / W);
                if (np !== readingPage) {
                    readingPage = Math.max(0, Math.min(np, readingTotalPages - 1));
                    window._currentReadingPage = readingPage;
                    const i = document.getElementById('reading-page-info');
                    if (i) i.textContent = `Стр. ${readingPage + 1} / ${readingTotalPages}`;
                }
            }, 100);
        });
    }
    if (readingFileInput) {
        readingFileInput.addEventListener('change', async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            const n = (f.name || '').toLowerCase();
            if (!(n.endsWith('.txt') || n.endsWith('.fb2') || n.endsWith('.epub'))) {
                VissortDialog.alert('Поддерживаются .txt, .fb2, .epub');
                readingFileInput.value = '';
                return;
            }
            if (readingFileName) readingFileName.textContent = '⏳ Загрузка: ' + f.name;
            try {
                const t = await parseReadingFile(f);
                const clean = (t || '')
                    .replace(/\r\n/g, '\n')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();
                if (!clean) {
                    VissortDialog.alert('Файл пуст');
                    return;
                }
                const ta = document.getElementById('gen-reading-text');
                if (ta) ta.value = clean;
                if (readingFileName) readingFileName.textContent = `✅ ${f.name} (${clean.length} символов)`;
            } catch (err) {
                VissortDialog.alert('Ошибка: ' + err.message);
            }
            readingFileInput.value = '';
        });
    }
    btnGenerator.addEventListener('click', () => {
        modal.style.display = 'flex';
        selectedCells = [];
        const dgX = parseInt(document.getElementById('gen-grid-x').value) || 3,
            dgY = parseInt(document.getElementById('gen-grid-y').value) || 3;
        if (dgX * dgY >= 2) {
            selectedCells.push({ row: 0, col: 0 });
            if (dgX > 1) selectedCells.push({ row: 0, col: 1 });
            else selectedCells.push({ row: 1, col: 0 });
        }
        renderGridPreview();
        generateCellParamsFields();
        document.getElementById('gen-threshold').value = getThreshold(
            parseInt(document.getElementById('gen-series-size').value)
        );
        const p = document.getElementById('gen-ppi');
        if (p) p.value = screenPPI;
        if (readingFileName) readingFileName.textContent = '';
        const gdEl = document.getElementById('gen-general-distance');
        if (gdEl) gdEl.value = generalDistance;
        const rdEl = document.getElementById('gen-reading-distance');
        if (rdEl) rdEl.value = readingDistance;
        const tiEl = document.getElementById('gen-tol-inc');
        if (tiEl) tiEl.value = distanceToleranceIncreasePct;
        const tdEl = document.getElementById('gen-tol-dec');
        if (tdEl) tdEl.value = distanceToleranceDecreasePct;
        const ttEl = document.getElementById('gen-tol-timeout');
        if (ttEl) ttEl.value = distanceRestoreTimeoutSec;
        const beEl = document.getElementById('gen-blink-enabled');
        if (beEl) beEl.checked = blinkEnabled;
        const bmrEl = document.getElementById('gen-blink-min-rate');
        if (bmrEl) bmrEl.value = blinkMinRate;
        const bwEl = document.getElementById('gen-blink-window');
        if (bwEl) bwEl.value = blinkWindowSec;
        const blsEl = document.getElementById('gen-blink-lock-show');
        if (blsEl) blsEl.checked = blinkLockShow;
        updateGeneratorVisibility();
        updateBgModeVisibility();
        updateGradientMidVisibility();
        updateDynamicMidVisibility();
        updateDynamicModeVisibility();
        updatePhysioListHint();
        updateSingleStimDynamicVisibility();
        updateSingleStimMidVisibility();
        updateSingleBgDynamicVisibility();
        updateSingleBgMidVisibility();
    });
    document.getElementById('gen-cancel').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    document.getElementById('gen-series-size').addEventListener('change', function () {
        document.getElementById('gen-threshold').value = getThreshold(parseInt(this.value));
    });
    document.getElementById('gen-to-node').addEventListener('click', () => {
        const tt = document.getElementById('gen-training-type').value;
        const mp = buildModeParamsFromUI();
        modal.style.display = 'none';
        if (tt === 'reading') {
            modeParamsToReadingNode(mp);
            VissortDialog.alert('📌 Узел «Чтение» создан.');
        } else if (tt === 'single') {
            modeParamsToNode(mp);
            VissortDialog.alert('📌 Узел создан.');
        } else VissortDialog.alert('Сравнение пока не переносится в узел.');
    });
    document.getElementById('gen-apply').addEventListener('click', () => {
        modal.style.display = 'none';
        trainingNode = { id: 'training_node', params: buildModeParamsFromUI() };
        window._pendingGeneratorMode = true;
        VissortDialog.alert('Тренировка готова. Нажмите «Плеер».');
    });
    document.getElementById('gen-training-type').addEventListener('change', function () {
        updateGeneratorVisibility();
        if (this.value === 'compare') {
            renderGridPreview();
            generateCellParamsFields();
        }
    });
    document.getElementById('gen-reading-bg-mode')?.addEventListener('change', updateBgModeVisibility);
    document
        .getElementById('gen-reading-gradient-mid-enabled')
        ?.addEventListener('change', updateGradientMidVisibility);
    document
        .getElementById('gen-reading-dynamic-mid-enabled')
        ?.addEventListener('change', updateDynamicMidVisibility);
    document
        .getElementById('gen-reading-dynamic-mode')
        ?.addEventListener('change', updateDynamicModeVisibility);
    document.getElementById('gen-reading-dynamic-step')?.addEventListener('change', updatePhysioListHint);
    document
        .getElementById('gen-single-stim-dynamic-enabled')
        ?.addEventListener('change', updateSingleStimDynamicVisibility);
    document
        .getElementById('gen-single-stim-mid-enabled')
        ?.addEventListener('change', updateSingleStimMidVisibility);
    document
        .getElementById('gen-single-bg-dynamic-enabled')
        ?.addEventListener('change', updateSingleBgDynamicVisibility);
    document
        .getElementById('gen-single-bg-mid-enabled')
        ?.addEventListener('change', updateSingleBgMidVisibility);
    function updateGeneratorVisibility() { return window.AppGenerator.updateGeneratorVisibility(); }
    function updateBgModeVisibility() { return window.AppGenerator.updateBgModeVisibility(); }
    function updateGradientMidVisibility() { return window.AppGenerator.updateGradientMidVisibility(); }
    function updateDynamicMidVisibility() { return window.AppGenerator.updateDynamicMidVisibility(); }
    function updateDynamicModeVisibility() { return window.AppGenerator.updateDynamicModeVisibility(); }
    function updatePhysioListHint() { return window.AppGenerator.updatePhysioListHint(); }
    function updateSingleStimDynamicVisibility() { return window.AppGenerator.updateSingleStimDynamicVisibility(); }
    function updateSingleStimMidVisibility() { return window.AppGenerator.updateSingleStimMidVisibility(); }
    function updateSingleBgDynamicVisibility() { return window.AppGenerator.updateSingleBgDynamicVisibility(); }
    function updateSingleBgMidVisibility() { return window.AppGenerator.updateSingleBgMidVisibility(); }
    btnEnableCamera.addEventListener('click', enableCamera);
    btnDisableCamera.addEventListener('click', disableCamera);
    btnCalibrate.addEventListener('click', openCalibrationModal);
    document.getElementById('calibrate-confirm').addEventListener('click', calibrateFocalLength);
    document
        .getElementById('calibrate-cancel')
        .addEventListener(
            'click',
            () => (document.getElementById('calibration-modal').style.display = 'none')
        );
    btnInspector.addEventListener('click', () => {
        const h = !inspectorEl.style.display || inspectorEl.style.display === 'none';
        inspectorEl.style.display = h ? 'block' : 'none';
    });
    btnSave.addEventListener('click', saveGraph);
    btnOpen.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) loadGraph(e.target.files[0]);
        e.target.value = '';
    });
    if (folderInput) {
        folderInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files && files.length) {
                const list = Array.from(files);
                let imported = 0;
                for (const f of list) {
                    if (!/\.json$/i.test(f.name)) continue;
                    try {
                        const text = await f.text();
                        const parsed = JSON.parse(text);
                        const data = parsed.graph || parsed;
                        if (!data || !Array.isArray(data.nodes)) continue;
                        const key = parsed.scenarioKey || generateScenarioKey();
                        const id = 'local_' + key;
                        await window.Data.saveScenario({
                            id,
                            name: f.name.replace(/\.json$/i, ''),
                            training_type: parsed.trainingType || 'single',
                            params: {
                                graph: {
                                    nodes: data.nodes,
                                    connections: data.connections || [],
                                    books: data.books || {}
                                },
                                scenarioKey: key
                            }
                        });
                        imported++;
                    } catch (_) {}
                }
                folderStatus.textContent = '📁 ' + (list[0].webkitRelativePath.split('/')[0] || 'папка');
                VissortDialog.alert(`📁 Импортировано сценариев: ${imported}`);
            }
            folderInput.value = '';
        });
    }
    if (templatesFolderInput) {
        templatesFolderInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files && files.length) await importTemplatesFromFileList(files);
            templatesFolderInput.value = '';
        });
    }
    btnAddBlock.addEventListener('click', addBlock);
    btnClearBlocks.addEventListener('click', clearBlocks);
    btnGenerateSequence.addEventListener('click', generateSequenceFromBlocks);
    btnLibrary.addEventListener('click', () => {
        document.getElementById('library-modal').style.display = 'flex';
        loadScenarioList();
    });
    document
        .getElementById('btn-library-close')
        .addEventListener('click', () => (document.getElementById('library-modal').style.display = 'none'));
    document.getElementById('btn-save-current-scenario').addEventListener('click', saveCurrentScenario);
    btnUsers.addEventListener('click', () => {
        document.getElementById('users-modal').style.display = 'flex';
        loadUsers();
    });
    document
        .getElementById('btn-users-close')
        .addEventListener('click', () => (document.getElementById('users-modal').style.display = 'none'));
    document.getElementById('btn-assign-scenario').addEventListener('click', assignScenario);
    document.addEventListener('click', (e) => {
        const m = document.getElementById('connection-menu');
        if (m.style.display === 'block' && !m.contains(e.target)) hideConnectionMenu();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
        if (e.target === canvas) {
            activeNodeId = null;
            updateInspector();
            inspectorEl.style.display = 'none';
            requestRenderGraph();
            if (window._pendingConnectionHandler) cancelConnection();
        }
    });
    document.getElementById('pause-continue').addEventListener('click', resumeTraining);
    document.getElementById('pause-exit').addEventListener('click', exitTrainingFromPause);
    btnAuth.addEventListener('click', () => {
        if (currentUser) signOut();
        else showAuthModal('signin');
    });
    document
        .getElementById('auth-toggle')
        .addEventListener('click', () => showAuthModal(authMode === 'signin' ? 'signup' : 'signin'));
    // auth-submit обрабатывается через форму (bindAuthForm)
    window.addEventListener('resize', () => {
        if (readingViewportEl && readingViewportEl.style.display !== 'none') {
            const sp = readingPage;
            setupReadingColumns();
            setTimeout(() => {
                readingTotalPages = calcReadingTotalPages();
                scrollReadingToPage(Math.min(sp, readingTotalPages - 1));
            }, 60);
        }
    });
    window.addEventListener('beforeunload', () => {
        saveCurrentReadingBookmarkSilently();
        window.Voice?.stopReading();
    });
    // Пустой холст при старте
    switchMode('nodes');
    (async () => {
        await restoreFolderHandle();
        await restoreTemplatesFolderHandle();
        if (templatesFolderHandle) {
            try {
                await importTemplatesFromFolder(templatesFolderHandle);
            } catch (_) {}
        }
    })();
    registerServiceWorker();
}

// ==================== МОСТ ДЛЯ APP-EDITOR (§A2-v3) ====================
window.updateInspector = updateInspector;
window.saveNodeAsTemplate = saveNodeAsTemplate;
window.openBookPicker = openBookPicker;
window.saveUserSettings = saveUserSettings;
window.safeVal = safeVal;
window.safeChecked = safeChecked;
window.setLastBookId = setLastBookId;
window.generateScenarioKey = generateScenarioKey;
window.bookmarkKeyFor = bookmarkKeyFor;
window.getLastBookId = getLastBookId;

// ==================== START ====================
init();


// ==================== §A2-v6: ОБЁРТКИ (app-scenarios.js) ====================
function saveNodeAsTemplate(nodeId) { return window.AppScenarios.saveNodeAsTemplate(nodeId); }
function applyTemplateToCanvas(templateId, x, y) { return window.AppScenarios.applyTemplateToCanvas(templateId, x, y); }
function loadTemplatesFolder() { return window.AppScenarios.loadTemplatesFolder(); }
function importTemplatesFromFolder(handle) { return window.AppScenarios.importTemplatesFromFolder(handle); }
function importTemplatesFromFileList(fileList) { return window.AppScenarios.importTemplatesFromFileList(fileList); }
function refreshTemplatesIfOpen() { return window.AppScenarios.refreshTemplatesIfOpen(); }
function renderTemplatesList(filter = '') { return window.AppScenarios.renderTemplatesList(filter); }
function openTemplatesModal() { return window.AppScenarios.openTemplatesModal(); }
function exportAllTemplates() { return window.AppScenarios.exportAllTemplates(); }
function openBookPicker() { return window.AppScenarios.openBookPicker(); }
function closeBookPicker() { return window.AppScenarios.closeBookPicker(); }
function renderBookPickerList() { return window.AppScenarios.renderBookPickerList(); }
function applyBookSelection(bookId) { return window.AppScenarios.applyBookSelection(bookId); }
function detachBookFromActiveNode() { return window.AppScenarios.detachBookFromActiveNode(); }
function handleBookPickerFileUpload(file) { return window.AppScenarios.handleBookPickerFileUpload(file); }
function restoreFolderHandle() { return window.AppScenarios.restoreFolderHandle(); }
function restoreTemplatesFolderHandle() { return window.AppScenarios.restoreTemplatesFolderHandle(); }
function selectFolder() { return window.AppScenarios.selectFolder(); }
function scanScenariosFolder() { return window.AppScenarios.scanScenariosFolder(); }
function saveGraph() { return window.AppScenarios.saveGraph(); }
function buildScenarioPayloadFromCurrent() { return window.AppScenarios.buildScenarioPayloadFromCurrent(); }
function migrateScenario(data) { return window.AppScenarios.migrateScenario(data); }
function loadGraph(file) { return window.AppScenarios.loadGraph(file); }
function loadScenarioList() { return window.AppScenarios.loadScenarioList(); }
function saveCurrentScenario() { return window.AppScenarios.saveCurrentScenario(); }
// ==================== §A2-v7: ОБЁРТКИ (app-blink-camera.js) ====================
function startBlinkAnimation(opts) { return window.AppBlinkCamera.startBlinkAnimation(opts); }
function stopBlinkAnimation() { return window.AppBlinkCamera.stopBlinkAnimation(); }
function computeEAR(eyePoints) { return window.AppBlinkCamera.computeEAR(eyePoints); }
function getBlinkWarningEl() { return window.AppBlinkCamera.getBlinkWarningEl(); }
function showBlinkWarning() { return window.AppBlinkCamera.showBlinkWarning(); }
function hideBlinkWarning() { return window.AppBlinkCamera.hideBlinkWarning(); }
function resetBlinkState() { return window.AppBlinkCamera.resetBlinkState(); }
function processBlinkFrame(earL, earR) { return window.AppBlinkCamera.processBlinkFrame(earL, earR); }
function isBlinkResponseBlocked() { return window.AppBlinkCamera.isBlinkResponseBlocked(); }
function areEyesClosedNow() { return window.AppBlinkCamera.areEyesClosedNow(); }
function ensureBlinkCalibrationUI() { return window.AppBlinkCamera.ensureBlinkCalibrationUI(); }
function startBlinkCalibration() { return window.AppBlinkCamera.startBlinkCalibration(); }
function runBlinkCalibrationPhase(phase) { return window.AppBlinkCamera.runBlinkCalibrationPhase(phase); }
function finishBlinkCalibration() { return window.AppBlinkCamera.finishBlinkCalibration(); }
function cancelBlinkCalibration() { return window.AppBlinkCamera.cancelBlinkCalibration(); }
function buildBlinkReport() { return window.AppBlinkCamera.buildBlinkReport(); }
function loadFaceApiModels() { return window.AppBlinkCamera.loadFaceApiModels(); }
function enableCamera() { return window.AppBlinkCamera.enableCamera(); }
function disableCamera() { return window.AppBlinkCamera.disableCamera(); }
function recalcSizesForNewDistance() { return window.AppBlinkCamera.recalcSizesForNewDistance(); }
function processVideoFrame() { return window.AppBlinkCamera.processVideoFrame(); }
function openCalibrationModal() { return window.AppBlinkCamera.openCalibrationModal(); }
function calibrateFocalLength() { return window.AppBlinkCamera.calibrateFocalLength(); }


// ==================== AUTH: SAVE + PREFILL + FOCUS ====================
const LS_LAST_EMAIL = 'vissort_last_email';
const LS_LAST_PASS = 'vissort_last_pass';

function encodeCred(s) {
    try {
        return btoa(unescape(encodeURIComponent(s)));
    } catch (_) {
        return '';
    }
}
function decodeCred(s) {
    try {
        return decodeURIComponent(escape(atob(s)));
    } catch (_) {
        return '';
    }
}
function saveAuthCreds(email, password) {
    try {
        localStorage.setItem(LS_LAST_EMAIL, email);
        localStorage.setItem(LS_LAST_PASS, encodeCred(password));
    } catch (_) {}
}
function prefillAuthCreds() {
    try {
        const email = localStorage.getItem(LS_LAST_EMAIL);
        const pass = localStorage.getItem(LS_LAST_PASS);
        const eEl = document.getElementById('auth-email');
        const pEl = document.getElementById('auth-password');
        if (email && eEl && !eEl.value) eEl.value = email;
        if (pass && pEl && !pEl.value) pEl.value = decodeCred(pass);
    } catch (_) {}
}
function focusAuthField() {
    const emailEl = document.getElementById('auth-email');
    const passEl = document.getElementById('auth-password');
    if (!emailEl || !passEl) return;
    setTimeout(() => {
        try {
            if (emailEl.value) {
                passEl.focus();
                passEl.select();
            } else {
                emailEl.focus();
                emailEl.select();
            }
        } catch (_) {}
    }, 150);
}
function bindAuthForm() {
    const form = document.getElementById('auth-form');
    if (!form || form._authBound) return;
    form._authBound = true;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof handleAuthSubmit === 'function') handleAuthSubmit();
    });
    VLog.log('[app] auth form привязана');
}
async function handleAuthSubmit() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value.trim();
    if (!email || !password) {
        VissortDialog.alert('Введите email и пароль');
        return;
    }
    saveAuthCreds(email, password);
    if (authMode === 'signin') await signIn(email, password);
    else await signUp(email, password, name);
    document.getElementById('auth-modal').style.display = 'none';
}
(function installAuthObserver() {
    function attach() {
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        bindAuthForm();
        const obs = new MutationObserver(() => {
            if (modal.style.display === 'flex' || modal.classList.contains('open')) {
                bindAuthForm();
                prefillAuthCreds();
                focusAuthField();
            }
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
        if (modal.style.display === 'flex') {
            prefillAuthCreds();
            focusAuthField();
        }
        VLog.log('[app] auth observer установлен');
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
})();

// ==================== Масштаб холста ====================
(function installZoom() {
    var ZOOM_KEY = 'vissort_canvas_zoom';
    var MIN_ZOOM = 0.3;
    var MAX_ZOOM = 2.0;
    var STEP = 0.1;

    var canvasEl = document.getElementById('canvas');
    if (!canvasEl) {
        VLog.warn('[zoom] canvas not found');
        return;
    }

    var zoomLevel = parseFloat(localStorage.getItem(ZOOM_KEY)) || 1.0;
    window.__vissort_zoom = zoomLevel;

    var btnIn = document.getElementById('btn-zoom-in');
    var btnOut = document.getElementById('btn-zoom-out');
    var btnReset = document.getElementById('btn-zoom-reset');

    function applyZoom() {
        zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel));
        zoomLevel = Math.round(zoomLevel * 100) / 100;
        window.__vissort_zoom = zoomLevel;
        canvasEl.style.zoom = zoomLevel;
        if (btnReset) btnReset.textContent = Math.round(zoomLevel * 100) + '%';
        try {
            localStorage.setItem(ZOOM_KEY, String(zoomLevel));
        } catch (_) {}
    }

    function zoomBy(delta) {
        zoomLevel = Math.round((zoomLevel + delta) * 100) / 100;
        applyZoom();
    }

    if (btnIn)
        btnIn.addEventListener('click', function () {
            zoomBy(STEP);
        });
    if (btnOut)
        btnOut.addEventListener('click', function () {
            zoomBy(-STEP);
        });
    if (btnReset)
        btnReset.addEventListener('click', function () {
            zoomLevel = 1.0;
            applyZoom();
        });

    document.addEventListener('keydown', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        var t = e.target;
        if (t && /input|textarea|select/i.test(t.tagName)) return;
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            zoomBy(STEP);
        } else if (e.key === '-') {
            e.preventDefault();
            zoomBy(-STEP);
        } else if (e.key === '0') {
            e.preventDefault();
            zoomLevel = 1.0;
            applyZoom();
        }
    });

    // Ctrl + колесо мыши — масштаб
    canvasEl.addEventListener(
        'wheel',
        function (e) {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            var delta = e.deltaY > 0 ? -STEP : STEP;
            zoomBy(delta);
        },
        { passive: false }
    );

    applyZoom();
    VLog.log('[zoom] installed, level =', zoomLevel, '');
})();

// ==================== Новый сценарий ====================
(function installNewScenario() {
    var btn = document.getElementById('btn-new');
    if (!btn) {
        VLog.warn('[new] btn-new not found');
        return;
    }

    async function doNew() {
        var hasContent =
            (typeof nodes !== 'undefined' && nodes.length > 0) ||
            (typeof connections !== 'undefined' && connections.length > 0);
        if (hasContent) {
            if (!(await VissortDialog.confirm('Начать новый сценарий? Несохранённые изменения будут потеряны.'))) return;
        }

        nodes.length = 0;
        connections.length = 0;
        window._books = {};
        window._currentScenarioKey = generateScenarioKey();
        window._currentScenarioId = null;
        window._currentScenarioFileName = null;
        activeNodeId = null;

        if (typeof inspectorEl !== 'undefined' && inspectorEl) inspectorEl.style.display = 'none';

        if (typeof nodeElements !== 'undefined' && nodeElements) nodeElements.clear();
        if (typeof connectionElements !== 'undefined' && connectionElements) connectionElements.clear();

        var canvasEl = document.getElementById('canvas');
        if (canvasEl) {
            var allNodes = canvasEl.querySelectorAll('.scenario-node');
            for (var i = 0; i < allNodes.length; i++) allNodes[i].remove();
            var allLines = canvasEl.querySelectorAll('.html-graph-line, .line-arrow');
            for (var j = 0; j < allLines.length; j++) allLines[j].remove();
        }

        requestRenderGraph();
        updateInspector();

        // Пустой холст — узлы не создаются
        if (typeof switchMode === 'function' && currentMode !== 'nodes') switchMode('nodes');

        VLog.log('[new] new scenario created, key =', window._currentScenarioKey);
    }

    btn.addEventListener('click', doNew);
    window.__vissort_newScenario = doNew;
    VLog.log('[new] installed');
})();
// ==================== ОБЁРТКИ APP-INSPECTOR (§A2-v4) ====================
function updateInspector() { return window.AppInspector.updateInspector(); }
function renderInspectorGridPreview() { return window.AppInspector.renderInspectorGridPreview(); }
function renderPeriInspectorSection(node) { return window.AppInspector.renderPeriInspectorSection(node); }
function renderDefocusInspectorSection(node) { return window.AppInspector.renderDefocusInspectorSection(node); }
function renderBlinkAnimationInspectorSection(node) { return window.AppInspector.renderBlinkAnimationInspectorSection(node); }
function updateStimulusInspector(node) { return window.AppInspector.updateStimulusInspector(node); }
function updateLogicInspector(node) { return window.AppInspector.updateLogicInspector(node); }
function updateCompareInspector(node) { return window.AppInspector.updateCompareInspector(node); }
function updateReadingInspector(node) { return window.AppInspector.updateReadingInspector(node); }
function initInspectorEvents() { return window.AppInspector.initInspectorEvents(); }
function applyInspectorChanges() { return window.AppInspector.applyInspectorChanges(); }
function applyPeriInspectorChanges(node) { return window.AppInspector.applyPeriInspectorChanges(node); }
function applyDefocusInspectorChanges(node) { return window.AppInspector.applyDefocusInspectorChanges(node); }
function applyBlinkAnimationInspectorChanges(node) { return window.AppInspector.applyBlinkAnimationInspectorChanges(node); }
function applyStimulusInspectorChanges(node) { return window.AppInspector.applyStimulusInspectorChanges(node); }
function applyCompareInspectorChanges(node) { return window.AppInspector.applyCompareInspectorChanges(node); }
function applyReadingInspectorChanges(node) { return window.AppInspector.applyReadingInspectorChanges(node); }
