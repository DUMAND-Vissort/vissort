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
const HAS_FS_ACCESS = typeof window.showDirectoryPicker === 'function';
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

let _blinkState = createEmptyBlinkState();
let _blinkResponseBlockUntil = 0;
let _blinkCalibration = null;
let _waitingForOpenEyes = false;

function createEmptyBlinkState() {
    return {
        lastEAR: 0.3,
        lastEarL: 0.3,
        lastEarR: 0.3,
        isClosed: false,
        closeStartMs: 0,
        blinks: [],
        totalBlinks: 0,
        longBlinks: 0,
        asymBlinks: 0,
        lastBlinkMs: 0,
        warningShownAt: 0,
        sessionStartMs: 0,
        minRateObserved: null
    };
}

// Переменные диапазона 175..209 перенесены в app-state.js (2026-10-15).

window._pendingGeneratorMode = false;
window._books = window._books || {};
window._currentScenarioKey = window._currentScenarioKey || null;
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
function startBlinkAnimation(opts) {
    stopBlinkAnimation();
    if (!opts) return;
    const target = opts.target || 'stim';
    const A = opts.colorA || { r: 255, g: 0, b: 0 };
    const B = opts.colorB || { r: 0, g: 0, b: 255 };
    const intervalMs = Math.max(50, opts.intervalMs || 500);
    const duty = Math.max(0.05, Math.min(0.95, opts.duty ?? 0.5));
    const count = Math.max(0, opts.count || 0);
    _blinkStateLocal = { tick: 0, current: 'A' };
    function apply(color) {
        if (target === 'stim' || target === 'both') setStimColorRGB(color.r, color.g, color.b);
        if (target === 'bg' || target === 'both')
            stimArea.style.backgroundColor = `rgb(${color.r},${color.g},${color.b})`;
    }
    function tick() {
        if (!playerRunning || isPaused) {
            _blinkTimerId = null;
            return;
        }
        const isA = _blinkStateLocal.current === 'A';
        apply(isA ? A : B);
        _blinkStateLocal.tick++;
        if (count > 0 && _blinkStateLocal.tick >= count) {
            _blinkTimerId = null;
            return;
        }
        const nextIsA = !isA;
        const delay = nextIsA ? intervalMs * duty : intervalMs * (1 - duty);
        _blinkStateLocal.current = nextIsA ? 'A' : 'B';
        _blinkTimerId = setTimeout(tick, Math.max(20, delay));
    }
    _blinkTimerId = setTimeout(tick, 0);
}
function stopBlinkAnimation() {
    if (_blinkTimerId) {
        clearTimeout(_blinkTimerId);
        _blinkTimerId = null;
    }
    _blinkStateLocal = { tick: 0, current: 'A' };
}

// ==================== BLINK: EAR ====================
function computeEAR(eyePoints) {
    if (!Array.isArray(eyePoints) || eyePoints.length < 6) return 0.3;
    const [p1, p2, p3, p4, p5, p6] = eyePoints;
    const v1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
    const v2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
    const h = Math.hypot(p1.x - p4.x, p1.y - p4.y);
    if (h < 1) return 0.3;
    return (v1 + v2) / (2 * h);
}
function getBlinkWarningEl() {
    let el = document.getElementById('blink-warning');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'blink-warning';
    el.style.cssText =
        'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); padding: 12px 28px; background: rgba(14,165,233,0.92); color: #fff; font-size: 22px; font-weight: bold; border-radius: 10px; z-index: 99998; display: none; pointer-events: none; text-align: center; box-shadow: 0 6px 24px rgba(0,0,0,0.5); font-family: "Segoe UI",Tahoma,sans-serif;';
    el.textContent = 'Поморгайте';
    document.body.appendChild(el);
    return el;
}
function showBlinkWarning() {
    const el = getBlinkWarningEl();
    el.style.display = 'block';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
        el.style.display = 'none';
    }, 3500);
    if (window.Voice) window.Voice.sayKey('blink', { cancel: true });
}
function hideBlinkWarning() {
    const el = document.getElementById('blink-warning');
    if (el) el.style.display = 'none';
}
function resetBlinkState() {
    _blinkState = createEmptyBlinkState();
    _blinkState.sessionStartMs = performance.now();
    _blinkResponseBlockUntil = 0;
    _waitingForOpenEyes = false;
    hideBlinkWarning();
}
function processBlinkFrame(earL, earR) {
    if (!cameraActive) return;
    if (_blinkCalibration && _blinkCalibration.phase !== 'done') {
        const ear = (earL + earR) / 2;
        if (_blinkCalibration.phase === 'open') _blinkCalibration.openSamples.push(ear);
        else if (_blinkCalibration.phase === 'closed') _blinkCalibration.closedSamples.push(ear);
        return;
    }
    if (!blinkEnabled) return;
    const now = performance.now();
    const ear = (earL + earR) / 2;
    _blinkState.lastEAR = ear;
    _blinkState.lastEarL = earL;
    _blinkState.lastEarR = earR;
    const closedNow = ear < blinkThreshold;
    if (_waitingForOpenEyes && !closedNow) _waitingForOpenEyes = false;
    if (closedNow && !_blinkState.isClosed) {
        _blinkState.isClosed = true;
        _blinkState.closeStartMs = now;
    } else if (!closedNow && _blinkState.isClosed) {
        const duration = now - _blinkState.closeStartMs;
        const minL = Math.min(earL, _blinkState.lastEarL);
        const minR = Math.min(earR, _blinkState.lastEarR);
        _blinkState.isClosed = false;
        _blinkState.closeStartMs = 0;
        if (duration >= BLINK_SHORT_MS && duration <= BLINK_AUTOPAUSE_MS) {
            const maxEar = Math.max(minL, minR, 0.01);
            const minEar = Math.min(minL, minR);
            const asym = minEar / maxEar;
            const isAsym = asym < BLINK_ASYM_RATIO;
            const kind = duration > BLINK_LONG_MS ? 'long' : isAsym ? 'asym' : 'normal';
            _blinkState.blinks.push({ ts: now, durationMs: duration, earL: minL, earR: minR, asym, kind });
            _blinkState.totalBlinks++;
            if (kind === 'long') _blinkState.longBlinks++;
            if (kind === 'asym') _blinkState.asymBlinks++;
            _blinkState.lastBlinkMs = now;
            _blinkResponseBlockUntil = now + BLINK_BLOCK_MS;
        }
    }
    if (_blinkState.isClosed && _blinkState.closeStartMs > 0) {
        const closedDur = now - _blinkState.closeStartMs;
        if (closedDur > BLINK_AUTOPAUSE_MS && playerRunning && !isPaused) {
            _blinkState.isClosed = false;
            _blinkState.closeStartMs = 0;
            pauseTraining();
            return;
        }
    }
    const windowStart = now - blinkWindowSec * 1000;
    _blinkState.blinks = _blinkState.blinks.filter((b) => b.ts >= windowStart);
    if (playerRunning && !isPaused) {
        const elapsedInWindowSec = Math.min(blinkWindowSec, (now - _blinkState.sessionStartMs) / 1000);
        if (elapsedInWindowSec > blinkWindowSec / 2) {
            const expectedSoFar = blinkMinRate * (elapsedInWindowSec / 60);
            if (_blinkState.blinks.length < expectedSoFar) {
                if (now - _blinkState.warningShownAt > 12000) {
                    showBlinkWarning();
                    _blinkState.warningShownAt = now;
                }
            }
            const observedRate = (_blinkState.blinks.length / Math.max(1, elapsedInWindowSec)) * 60;
            if (_blinkState.minRateObserved == null || observedRate < _blinkState.minRateObserved)
                _blinkState.minRateObserved = observedRate;
        }
    }
}
function isBlinkResponseBlocked() {
    return performance.now() < _blinkResponseBlockUntil;
}
function areEyesClosedNow() {
    return blinkEnabled && _blinkState.isClosed === true;
}
function ensureBlinkCalibrationUI() {
    let btn = document.getElementById('btn-calibrate-blink');
    if (!btn) {
        const anchor = document.getElementById('btn-calibrate-camera');
        if (anchor && anchor.parentNode) {
            btn = document.createElement('button');
            btn.className = 'btn btn-warning btn-icon';
            btn.id = 'btn-calibrate-blink';
            btn.title = 'Калибровка моргания';
            btn.disabled = true;
            btn.textContent = '👁️';
            anchor.parentNode.insertBefore(btn, anchor.nextSibling);
            btn.addEventListener('click', startBlinkCalibration);
        }
    }
    if (!document.getElementById('blink-calibration-modal')) {
        const m = document.createElement('div');
        m.className = 'modal';
        m.id = 'blink-calibration-modal';
        m.innerHTML = `<div class="modal-content" style="width: 480px; text-align: center;">
            <h3>👁️ Калибровка моргания</h3>
            <p style="font-size: 13px; color: #ccc;">Смотрите прямо в камеру. Две фазы по 3 секунды.</p>
            <div id="blink-calib-phase" style="font-size: 20px; font-weight: bold; color: #38bdf8; margin: 16px 0;">Приготовьтесь…</div>
            <div id="blink-calib-countdown" style="font-size: 64px; font-weight: bold; color: #fff; margin: 16px 0;">—</div>
            <div id="blink-calib-result" style="font-size: 13px; color: #94a3b8; margin-top: 10px;">Текущий порог EAR: ${blinkThreshold.toFixed(3)}</div>
            <div class="modal-footer" style="justify-content: center;">
                <button class="btn btn-secondary" id="blink-calib-cancel">Отмена</button>
            </div></div>`;
        document.body.appendChild(m);
        document.getElementById('blink-calib-cancel').addEventListener('click', cancelBlinkCalibration);
    }
}
function startBlinkCalibration() {
    if (!cameraActive) {
        VissortDialog.alert('Включите камеру');
        return;
    }
    ensureBlinkCalibrationUI();
    _blinkCalibration = {
        phase: 'open',
        phaseStartMs: performance.now(),
        openSamples: [],
        closedSamples: []
    };
    document.getElementById('blink-calibration-modal').style.display = 'flex';
    document.getElementById('blink-calib-result').textContent = 'Собираем данные…';
    runBlinkCalibrationPhase('open');
}
function runBlinkCalibrationPhase(phase) {
    const phaseEl = document.getElementById('blink-calib-phase');
    const countEl = document.getElementById('blink-calib-countdown');
    const PHASE_MS = 3000;
    const startMs = performance.now();
    _blinkCalibration.phase = phase;
    if (phase === 'open') {
        phaseEl.textContent = 'Смотрите прямо, глаза ОТКРЫТЫ';
        phaseEl.style.color = '#22c55e';
    } else {
        phaseEl.textContent = 'Закройте глаза (как при моргании)';
        phaseEl.style.color = '#ef4444';
    }
    function tick() {
        if (!_blinkCalibration) return;
        const elapsed = performance.now() - startMs;
        countEl.textContent = Math.max(0, Math.ceil((PHASE_MS - elapsed) / 1000));
        if (elapsed >= PHASE_MS) {
            if (phase === 'open') runBlinkCalibrationPhase('closed');
            else finishBlinkCalibration();
            return;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}
function finishBlinkCalibration() {
    if (!_blinkCalibration) return;
    const { openSamples, closedSamples } = _blinkCalibration;
    if (openSamples.length < 5 || closedSamples.length < 5) {
        VissortDialog.alert('Недостаточно данных с камеры. Убедитесь, что лицо видно, и повторите.');
        cancelBlinkCalibration();
        return;
    }
    const meanOpen = openSamples.reduce((a, b) => a + b, 0) / openSamples.length;
    const meanClosed = closedSamples.reduce((a, b) => a + b, 0) / closedSamples.length;
    if (meanOpen <= meanClosed) {
        VissortDialog.alert('Значения нелогичны. Повторите калибровку.');
        cancelBlinkCalibration();
        return;
    }
    let th = (meanOpen + meanClosed) / 2;
    th = Math.max(0.12, Math.min(0.35, th));
    blinkThreshold = Math.round(th * 1000) / 1000;
    saveUserSettings();
    const r = document.getElementById('blink-calib-result');
    if (r)
        r.innerHTML = `Открытые: <b>${meanOpen.toFixed(3)}</b> · Закрытые: <b>${meanClosed.toFixed(3)}</b><br>Новый порог EAR: <b style="color:#22c55e;">${blinkThreshold.toFixed(3)}</b>`;
    _blinkCalibration = null;
    setTimeout(() => {
        document.getElementById('blink-calibration-modal').style.display = 'none';
    }, 1800);
}
function cancelBlinkCalibration() {
    _blinkCalibration = null;
    const m = document.getElementById('blink-calibration-modal');
    if (m) m.style.display = 'none';
}
function buildBlinkReport() {
    if (!blinkEnabled || !cameraActive) return '';
    const s = _blinkState;
    const durSec = Math.max(1, (performance.now() - s.sessionStartMs) / 1000);
    const avgRate = (s.totalBlinks / durSec) * 60;
    const avgDur = s.blinks.length > 0 ? s.blinks.reduce((a, b) => a + b.durationMs, 0) / s.blinks.length : 0;
    const lines = [
        `👁️ Моргания: всего ${s.totalBlinks}`,
        `Средняя частота: ${avgRate.toFixed(1)}/мин`,
        `Минимум: ${s.minRateObserved != null ? s.minRateObserved.toFixed(1) : '—'}/мин`
    ];
    if (s.longBlinks > 0) lines.push(`Долгих (>${BLINK_LONG_MS} мс): ${s.longBlinks}`);
    if (s.asymBlinks > 0) lines.push(`Асимметричных: ${s.asymBlinks}`);
    if (avgDur > 0) lines.push(`Средняя длительность: ${avgDur.toFixed(0)} мс`);
    return '\n\n' + lines.join('\n');
}
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
async function loadFaceApiModels() {
    if (faceapi.tf) {
        try {
            await faceapi.tf.setBackend('cpu');
            await faceapi.tf.ready();
        } catch (e) {}
    }
    const M = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
    await faceapi.nets.tinyFaceDetector.loadFromUri(M);
    await faceapi.nets.faceLandmark68Net.loadFromUri(M);
}
async function enableCamera() {
    if (cameraActive) return;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } }
        });
        const h = document.getElementById('hidden-video');
        h.srcObject = videoStream;
        await h.play();
        cameraActive = true;
        await loadFaceApiModels();
        document.getElementById('camera-status').textContent = 'Камера включена';
        btnCalibrate.disabled = false;
        const bc = document.getElementById('btn-calibrate-blink');
        if (bc) bc.disabled = false;
        btnEnableCamera.style.display = 'none';
        btnDisableCamera.style.display = 'inline-block';
        if (videoFrameId) cancelAnimationFrame(videoFrameId);
        videoFrameId = requestAnimationFrame(processVideoFrame);
    } catch (err) {
        VissortDialog.alert('Ошибка камеры: ' + err.message);
    }
}
async function disableCamera() {
    if (videoFrameId) {
        cancelAnimationFrame(videoFrameId);
        videoFrameId = null;
    }
    if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
        videoStream = null;
    }
    document.getElementById('hidden-video').srcObject = null;
    cameraActive = false;
    document.getElementById('camera-status').textContent = 'Камера выключена';
    const fs = document.getElementById('face-status');
    fs.textContent = '—';
    fs.className = 'face-missing';
    document.getElementById('distance-display').textContent = '—';
    btnCalibrate.disabled = true;
    const bc = document.getElementById('btn-calibrate-blink');
    if (bc) bc.disabled = true;
    btnEnableCamera.style.display = 'inline-block';
    btnDisableCamera.style.display = 'none';
    hideLiveDistanceIndicator();
    hideDistanceWarning();
    hideBlinkWarning();
}
function recalcSizesForNewDistance() {
    if (currentDistanceMeters == null || !isFinite(currentDistanceMeters)) return;
    _distanceBaseline = currentDistanceMeters;
    _distanceOutOfBoundsSince = 0;
    hideDistanceWarning();
    if (!playerRunning) return;
    if (currentPlayingNodeId) {
        const node = getNode(currentPlayingNodeId);
        if (node && node.nodeType === 'STIMULUS') {
            const ppi = node.stimPPI || screenPPI || 96;
            const ns = acuityToSizePx(nodeAcuityCurrent, currentDistanceMeters, ppi);
            currentSize = ns;
            const svg = stimDisplay.querySelector('svg');
            if (svg) {
                svg.setAttribute('width', ns);
                svg.setAttribute('height', ns);
                svg.setAttribute('viewBox', `0 0 ${ns} ${ns}`);
            }
        }
        return;
    }
    if (trainingNode?.params?.trainingType === 'single') {
        currentSize = acuityToSizePx(currentAcuity, currentDistanceMeters, screenPPI);
        const svg = stimDisplay.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', currentSize);
            svg.setAttribute('height', currentSize);
            svg.setAttribute('viewBox', `0 0 ${currentSize} ${currentSize}`);
        }
        return;
    }
    if (readingViewportEl && readingViewportEl.style.display === 'block' && readingContentEl) {
        const node = readingCurrentNode || getNode(window._currentReadingNodeId);
        const V = node?.readingAcuity || currentAcuity || 1.0;
        const ppi = node?.readingPPI || screenPPI || 96;
        readingContentEl.style.fontSize = acuityToFontSizePx(V, currentDistanceMeters, ppi) + 'px';
        setTimeout(() => {
            setupReadingColumns();
            readingTotalPages = calcReadingTotalPages();
            scrollReadingToPage(readingPage);
        }, 60);
    }
}
let _frameSkipCounter = 0;
async function processVideoFrame() {
    if (!cameraActive) {
        videoFrameId = null;
        return;
    }
    if ((_frameSkipCounter = (_frameSkipCounter + 1) % 2) !== 0) {
        videoFrameId = requestAnimationFrame(processVideoFrame);
        return;
    }
    const v = document.getElementById('hidden-video');
    if (v.readyState >= 2 && v.videoWidth > 0 && !v.paused) {
        try {
            const det = await faceapi
                .detectSingleFace(
                    v,
                    new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
                )
                .withFaceLandmarks();
            const faceStatus = document.getElementById('face-status');
            const calibInd = document.getElementById('calib-face-indicator');
            if (det && det.landmarks) {
                const le = det.landmarks.getLeftEye(),
                    re = det.landmarks.getRightEye();
                const lc = { x: (le[0].x + le[3].x) / 2, y: (le[0].y + le[3].y) / 2 };
                const rc = { x: (re[0].x + re[3].x) / 2, y: (re[0].y + re[3].y) / 2 };
                const ipd = Math.sqrt((rc.x - lc.x) ** 2 + (rc.y - lc.y) ** 2);
                lastEyeDistancePx = ipd;
                faceStatus.textContent = '✅ Лицо';
                faceStatus.className = 'face-detected';
                if (calibInd) {
                    calibInd.textContent = '✅ Лицо';
                    calibInd.className = 'calib-face-indicator detected';
                }
                const earL = computeEAR(le),
                    earR = computeEAR(re);
                processBlinkFrame(earL, earR);
                if (ipd > 0 && focalLengthPx) {
                    currentDistanceMeters = (realIPD_MM * focalLengthPx) / ipd / 1000;
                    document.getElementById('distance-display').textContent =
                        currentDistanceMeters.toFixed(2) + ' м';
                    if (distanceMin === null || currentDistanceMeters < distanceMin)
                        distanceMin = currentDistanceMeters;
                    if (distanceMax === null || currentDistanceMeters > distanceMax)
                        distanceMax = currentDistanceMeters;
                    distanceSum += currentDistanceMeters;
                    distanceCount++;
                    const now = performance.now();
                    if (now - distanceLastUpdate > 1000) {
                        distanceLog.push({ time: new Date().toISOString(), meters: currentDistanceMeters });
                        if (distanceLog.length > MAX_DISTANCE_LOG)
                            distanceLog.splice(0, distanceLog.length - MAX_DISTANCE_LOG);
                        distanceLastUpdate = now;
                    }
                    if (playerRunning) updateLiveDistanceIndicator();
                    if (playerRunning && !isPaused) {
                        setDistanceBaselineIfNeeded();
                        const state = evaluateDistanceDeviation();
                        if (state === 'ok') {
                            _distanceOutOfBoundsSince = 0;
                            if (_distanceWarningKind) hideDistanceWarning();
                            _distanceRecalcScheduled = false;
                        } else {
                            if (_distanceWarningKind !== state) {
                                showDistanceWarning(state);
                                _distanceWarningKind = state;
                                _distanceOutOfBoundsSince = performance.now();
                                _distanceRecalcScheduled = false;
                            }
                            const el = (performance.now() - _distanceOutOfBoundsSince) / 1000;
                            if (
                                distanceRestoreTimeoutSec > 0 &&
                                el >= distanceRestoreTimeoutSec &&
                                !_distanceRecalcScheduled
                            ) {
                                _distanceRecalcScheduled = true;
                                recalcSizesForNewDistance();
                            }
                        }
                    }
                } else {
                    document.getElementById('distance-display').textContent = focalLengthPx
                        ? '—'
                        : 'Требуется калибровка';
                }
            } else {
                faceStatus.textContent = '❌ Нет лица';
                faceStatus.className = 'face-missing';
                if (calibInd) {
                    calibInd.textContent = '❌ Нет лица';
                    calibInd.className = 'calib-face-indicator missing';
                }
                document.getElementById('distance-display').textContent = '—';
                _blinkState.isClosed = false;
                _blinkState.closeStartMs = 0;
            }
        } catch (e) {
            console.error(e);
        }
    }
    if (cameraActive) videoFrameId = requestAnimationFrame(processVideoFrame);
    else videoFrameId = null;
}
function openCalibrationModal() {
    if (!cameraActive) {
        VissortDialog.alert('Включите камеру');
        return;
    }
    document.getElementById('calibration-video').srcObject = videoStream;
    document.getElementById('calibration-modal').style.display = 'flex';
}
function calibrateFocalLength() {
    if (!cameraActive) {
        VissortDialog.alert('Камера не включена');
        return;
    }
    if (!lastEyeDistancePx) {
        VissortDialog.alert('Лицо не найдено');
        return;
    }
    const cm = parseFloat(document.getElementById('calib-distance').value);
    if (isNaN(cm) || cm <= 0) {
        VissortDialog.alert('Неверное расстояние');
        return;
    }
    focalLengthPx = (lastEyeDistancePx * cm * 10) / realIPD_MM;
    localStorage.setItem('focalLengthPx', focalLengthPx);
    VissortDialog.alert('Калибровка камеры завершена!');
    document.getElementById('calibration-modal').style.display = 'none';
}

// ==================== SVG-СТИМУЛЫ ====================
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
// ==================== ЗАГОТОВКИ (TEMPLATES) ====================
async function saveNodeAsTemplate(nodeId) {
    const node = getNode(nodeId);
    if (!node) return;
    const defaultName = node.name || 'Заготовка';
    const name = await VissortDialog.prompt('Название заготовки:', defaultName);
    if (!name) return;
    const description = (await VissortDialog.prompt('Описание (необязательно):', '')) || '';
    const payload = JSON.parse(JSON.stringify(node));
    delete payload.x;
    delete payload.y;
    delete payload.id;
    delete payload.isStart;
    try {
        await window.Data.saveTemplate({ name, description, kind: 'node', payload });
        VissortDialog.alert(
            `✅ Заготовка «${name}» сохранена${window.Data.isOnline() ? ' и отправляется в облако' : ' локально (отправится при появлении интернета)'}.`
        );
        refreshTemplatesIfOpen();
    } catch (e) {
        VissortDialog.alert('Ошибка сохранения заготовки: ' + e.message);
    }
}
async function applyTemplateToCanvas(templateId, position) {
    const templates = await window.Data.getTemplatesLocal();
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) {
        VissortDialog.alert('Заготовка не найдена');
        return;
    }
    const x = position?.x ?? canvas.scrollLeft + 200 + Math.random() * 200;
    const y = position?.y ?? canvas.scrollTop + 150 + Math.random() * 150;
    if (tpl.kind === 'group' && tpl.payload?.nodes) {
        const idMap = new Map();
        const newNodes = tpl.payload.nodes.map((n) => {
            const newId = generateId();
            idMap.set(n.id, newId);
            const clone = JSON.parse(JSON.stringify(n));
            clone.id = newId;
            clone.x = x + (clone.x || 0);
            clone.y = y + (clone.y || 0);
            clone.isStart = false;
            return clone;
        });
        newNodes.forEach((n) => nodes.push(n));
        (tpl.payload.connections || []).forEach((c) => {
            const fromId = idMap.get(c.fromId);
            const toId = idMap.get(c.toId);
            if (fromId && toId) connections.push({ ...c, fromId, toId });
        });
        VissortDialog.alert(`✅ Импортировано ${newNodes.length} узлов из заготовки «${tpl.name}»`);
    } else if (tpl.payload) {
        const clone = JSON.parse(JSON.stringify(tpl.payload));
        clone.id = generateId();
        clone.x = x;
        clone.y = y;
        clone.isStart = false;
        nodes.push(clone);
        activeNodeId = clone.id;
        VissortDialog.alert(`✅ Узел «${tpl.name}» добавлен на холст`);
    }
    requestRenderGraph();
    updateInspector();
    inspectorEl.style.display = 'block';
}
async function loadTemplatesFolder() {
    if (!HAS_FS_ACCESS) {
        if (templatesFolderInput) {
            templatesFolderInput.value = '';
            templatesFolderInput.click();
        }
        return;
    }
    try {
        const handle = await window.showDirectoryPicker();
        templatesFolderHandle = handle;
        await window.Data.saveFolderHandle('templatesFolderHandle', handle);
        if (templatesFolderStatus) templatesFolderStatus.textContent = '📋 ' + handle.name;
        await importTemplatesFromFolder(handle);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            VissortDialog.alert('Ошибка выбора папки заготовок: ' + err.message);
        }
    }
}
async function importTemplatesFromFolder(handle) {
    if (!handle) return;
    const ok = await window.Data.ensurePermission(handle, 'read');
    if (!ok) {
        VissortDialog.alert('Нет доступа к папке заготовок');
        return;
    }
    const files = await window.Data.scanFolder(handle, '.json');
    if (files.length === 0) {
        VissortDialog.alert('В папке заготовок нет .json файлов');
        return;
    }
    const res = await window.Data.bulkImportTemplates(files, { source: 'folder' });
    if (res.added + res.updated > 0) {
        VissortDialog.alert(`📋 Заготовки:\nДобавлено: ${res.added}\nОбновлено: ${res.updated}\nПропущено: ${res.skipped}`);
    }
    refreshTemplatesIfOpen();
}
async function importTemplatesFromFileList(fileList) {
    const files = Array.from(fileList || []).filter((f) => /\.json$/i.test(f.name));
    if (!files.length) {
        VissortDialog.alert('Не выбрано ни одного .json');
        return;
    }
    const entries = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
    const res = await window.Data.bulkImportTemplates(entries, { source: 'files' });
    VissortDialog.alert(`📋 Заготовки:\nДобавлено: ${res.added}\nОбновлено: ${res.updated}\nПропущено: ${res.skipped}`);
    refreshTemplatesIfOpen();
}
async function refreshTemplatesIfOpen() {
    const modal = document.getElementById('templates-modal');
    if (modal && modal.style.display === 'flex') await renderTemplatesList();
}
async function renderTemplatesList(filter = '') {
    const container = document.getElementById('templates-list');
    if (!container) return;
    const list = await window.Data.getTemplatesLocal();
    const q = filter.toLowerCase().trim();
    const filtered = q
        ? list.filter(
              (t) =>
                  (t.name || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
          )
        : list;
    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML =
            '<div style="padding:20px;color:#666;text-align:center;font-style:italic;">Пока нет заготовок. Сохраните узел через 💾 или импортируйте папку.</div>';
        return;
    }
    filtered.forEach((tpl) => {
        const item = document.createElement('div');
        item.style.cssText =
            'padding:10px 12px;background:#16161a;border:1px solid #2a2a3a;border-radius:6px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;';
        const kindLabel =
            tpl.kind === 'group' ? `👥 группа (${(tpl.payload?.nodes || []).length} узлов)` : '🎯 узел';
        const dirty = tpl._dirty ? ' <span style="color:#f59e0b;font-size:10px;">● локально</span>' : '';
        item.innerHTML = `
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;color:#7dd3fc;margin-bottom:2px;">${escapeHtml(tpl.name)}${dirty}</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:2px;">${kindLabel}</div>
                ${tpl.description ? `<div style="font-size:11px;color:#64748b;">${escapeHtml(tpl.description)}</div>` : ''}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0;">
                <button class="tpl-apply" style="background:#10b981;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:600;">➕ На холст</button>
                <button class="tpl-del" style="background:#dc2626;color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;font-weight:600;">✕</button>
            </div>
        `;
        item.querySelector('.tpl-apply').addEventListener('click', () => applyTemplateToCanvas(tpl.id));
        item.querySelector('.tpl-del').addEventListener('click', async () => {
            if (!(await VissortDialog.confirm(`Удалить заготовку «${tpl.name}»?`))) return;
            await window.Data.deleteTemplate(tpl.id);
            await renderTemplatesList(filter);
        });
        container.appendChild(item);
    });
}
function openTemplatesModal() {
    let modalEl = document.getElementById('templates-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.className = 'modal';
        modalEl.id = 'templates-modal';
        modalEl.innerHTML = `
            <div class="modal-content" style="width:560px;">
                <h3>📋 Заготовки элементов</h3>
                <p style="font-size:12px;color:#94a3b8;margin:0 0 10px;">Готовые узлы и группы узлов. Сохраните узел через кнопку 💾 на узле — он появится здесь.</p>
                <input type="text" id="templates-search" placeholder="Поиск…" style="width:100%;padding:8px 10px;background:#22222a;color:#fff;border:1px solid #3f3f46;border-radius:4px;font-size:13px;margin-bottom:10px;">
                <div id="templates-list" style="max-height:400px;overflow-y:auto;"></div>
                <div class="modal-footer" style="justify-content:space-between;">
                    <div>
                        <button class="btn btn-secondary" id="templates-import-folder">📁 Импорт из папки</button>
                        <button class="btn btn-secondary" id="templates-export-all">💾 Экспорт всех</button>
                    </div>
                    <button class="btn btn-secondary" id="templates-close">Закрыть</button>
                </div>
            </div>`;
        document.body.appendChild(modalEl);
        document
            .getElementById('templates-close')
            .addEventListener('click', () => (modalEl.style.display = 'none'));
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) modalEl.style.display = 'none';
        });
        document
            .getElementById('templates-search')
            .addEventListener('input', (e) => renderTemplatesList(e.target.value));
        document.getElementById('templates-import-folder').addEventListener('click', loadTemplatesFolder);
        document.getElementById('templates-export-all').addEventListener('click', exportAllTemplates);
    }
    modalEl.style.display = 'flex';
    renderTemplatesList();
}
async function exportAllTemplates() {
    const list = await window.Data.getTemplatesLocal();
    if (!list.length) {
        VissortDialog.alert('Нет заготовок для экспорта');
        return;
    }
    const blob = new Blob([JSON.stringify({ templates: list }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vissort-templates-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== ИНСПЕКТОР: ДИСПЕТЧЕР ====================
function openBookPicker() {
    const n = getNode(activeNodeId);
    if (!n || n.nodeType !== 'READING') return;
    renderBookPickerList();
    const f = document.getElementById('book-picker-file-name');
    if (f) f.textContent = '';
    const i = document.getElementById('book-picker-file');
    if (i) i.value = '';
    document.getElementById('book-picker-modal').style.display = 'flex';
}
function closeBookPicker() {
    document.getElementById('book-picker-modal').style.display = 'none';
}
function renderBookPickerList() {
    const c = document.getElementById('book-picker-list');
    if (!c) return;
    const node = getNode(activeNodeId),
        cur = node?.bookId || null;
    const ids = Object.keys(window._books);
    if (ids.length === 0) {
        c.innerHTML = '<div class="book-picker-empty">Пока нет книг.</div>';
        return;
    }
    ids.sort((a, b) =>
        (window._books[a].name || '').toLowerCase().localeCompare((window._books[b].name || '').toLowerCase())
    );
    c.innerHTML = '';
    ids.forEach((id) => {
        const bk = window._books[id];
        const item = document.createElement('div');
        item.className = 'book-picker-item' + (id === cur ? ' active' : '');
        const kb = Math.round((bk.text || '').length / 1024);
        item.innerHTML = `<div><div class="name">${escapeHtml(bk.name || '(без имени)')}</div><div class="meta">${kb} КБ · ID ${id.slice(0, 8)}…</div></div><div style="color:#7dd3fc;font-size:12px;">${id === cur ? '✓' : 'Выбрать'}</div>`;
        item.addEventListener('click', () => applyBookSelection(id));
        c.appendChild(item);
    });
}
function applyBookSelection(bookId) {
    const node = getNode(activeNodeId);
    if (!node || node.nodeType !== 'READING') return;
    const bk = window._books[bookId];
    if (!bk) {
        VissortDialog.alert('Книга не найдена');
        return;
    }
    node.bookId = bookId;
    node.bookName = bk.name || '(без имени)';
    setLastBookId(bookId);
    closeBookPicker();
    requestRenderGraph();
    updateInspector();
}
function detachBookFromActiveNode() {
    const node = getNode(activeNodeId);
    if (!node || node.nodeType !== 'READING') return;
    node.bookId = null;
    node.bookName = '';
    closeBookPicker();
    requestRenderGraph();
    updateInspector();
}
async function handleBookPickerFileUpload(file) {
    if (!file) return;
    const n = (file.name || '').toLowerCase();
    if (!(n.endsWith('.txt') || n.endsWith('.fb2') || n.endsWith('.epub'))) {
        VissortDialog.alert('Поддерживаются .txt, .fb2, .epub');
        return;
    }
    const f = document.getElementById('book-picker-file-name');
    if (f) f.textContent = '⏳ Загрузка: ' + file.name;
    try {
        const text = await parseReadingFile(file);
        const clean = (text || '')
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        if (!clean) {
            VissortDialog.alert('Не удалось извлечь текст.');
            return;
        }
        const id = await sha1(clean);
        if (!window._books[id]) window._books[id] = { name: file.name, text: clean };
        if (f) f.textContent = `✅ ${file.name} (${clean.length} символов)`;
        applyBookSelection(id);
    } catch (err) {
        VissortDialog.alert('Ошибка: ' + err.message);
    }
}
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

// ==================== ПАПКИ ====================
async function restoreFolderHandle() {
    if (!HAS_FS_ACCESS) return false;
    try {
        const h = await window.Data.getFolderHandle('scenariosFolderHandle');
        if (!h) return false;
        selectedFolderHandle = h;
        folderStatus.textContent = '📁 ' + h.name;
        const perm = await h.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
            folderStatus.textContent = '📁 ' + h.name + ' (нужно разрешение)';
            return false;
        }
        return true;
    } catch (_) {
        return false;
    }
}
async function restoreTemplatesFolderHandle() {
    if (!HAS_FS_ACCESS) return false;
    try {
        const h = await window.Data.getFolderHandle('templatesFolderHandle');
        if (!h) return false;
        templatesFolderHandle = h;
        if (templatesFolderStatus) templatesFolderStatus.textContent = '📋 ' + h.name;
        return true;
    } catch (_) {
        return false;
    }
}
async function selectFolder() {
    if (HAS_FS_ACCESS) {
        try {
            const newHandle = await window.showDirectoryPicker();
            selectedFolderHandle = newHandle;
            folderStatus.textContent = '📁 ' + newHandle.name;
            localStorage.setItem('selectedFolderName', newHandle.name);
            await window.Data.saveFolderHandle('scenariosFolderHandle', newHandle);
            await scanScenariosFolder();
        } catch (err) {
            if (err.name !== 'AbortError') console.error(err);
        }
    } else {
        if (!folderInput) {
            VissortDialog.alert('Браузер не поддерживает выбор папки.');
            return;
        }
        folderInput.value = '';
        folderInput.click();
    }
}
async function scanScenariosFolder() {
    if (!selectedFolderHandle) return;
    const ok = await window.Data.ensurePermission(selectedFolderHandle, 'read');
    if (!ok) {
        VLog.warn('[scenarios] нет доступа к папке');
        return;
    }
    const files = await window.Data.scanFolder(selectedFolderHandle, '.json');
    if (files.length === 0) return;
    let imported = 0;
    for (const f of files) {
        try {
            const parsed = JSON.parse(f.text);
            const data = parsed.graph || parsed;
            if (!data || !Array.isArray(data.nodes)) continue;
            const key = parsed.scenarioKey || generateScenarioKey();
            const id = 'local_' + key;
            await window.Data.saveScenario({
                id,
                name: (f.name || '').replace(/\.json$/i, ''),
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
        } catch (e) {
            VLog.warn('[scenarios] пропущен файл:', f.name, e.message);
        }
    }
    if (imported > 0) VLog.log(`[scenarios] импортировано из папки: ${imported}`);
}

// ==================== СОХРАНЕНИЕ / ЗАГРУЗКА ГРАФА ====================
async function saveGraph() {
    if (_saveGraphInFlight) {
        VLog.warn('[saveGraph] уже сохраняется');
        return;
    }
    _saveGraphInFlight = true;
    try {
        if (!window._currentScenarioKey) window._currentScenarioKey = generateScenarioKey();
        const payload = buildScenarioPayloadFromCurrent();
        const jsonStr = JSON.stringify(payload, null, 2);
        if (HAS_FS_ACCESS && selectedFolderHandle) {
            try {
                const ok = await window.Data.ensurePermission(selectedFolderHandle, 'readwrite');
                if (ok) {
                    let fileName = window._currentScenarioFileName;
                    if (!fileName) {
                        const ans = await VissortDialog.prompt(
                            'Имя файла сценария (без пути):',
                            'scenario_' + new Date().toISOString().slice(0, 10) + '.json'
                        );
                        if (!ans) return;
                        fileName = /\.json$/i.test(ans) ? ans : ans + '.json';
                        window._currentScenarioFileName = fileName;
                    }
                    await window.Data.writeFileToFolder(selectedFolderHandle, fileName, jsonStr);
                    VissortDialog.alert('📁 Файл сохранён: ' + fileName);
                }
            } catch (err) {
                VLog.warn('[saveGraph] папка:', err);
            }
        } else {
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = window._currentScenarioFileName || 'scenario.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        const record = {
            id: window._currentScenarioId || 'local_' + window._currentScenarioKey,
            name: window._currentScenarioFileName
                ? window._currentScenarioFileName.replace(/\.json$/i, '')
                : 'Сценарий ' + new Date().toLocaleString('ru-RU'),
            training_type: trainingNode?.params?.trainingType || 'single',
            params: {
                graph: {
                    nodes: JSON.parse(JSON.stringify(nodes)),
                    connections: JSON.parse(JSON.stringify(connections)),
                    books: JSON.parse(JSON.stringify(window._books))
                },
                ppi: screenPPI || 96,
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
                },
                scenarioKey: window._currentScenarioKey
            }
        };
        const saved = await window.Data.saveScenario(record);
        window._currentScenarioId = saved.id;
        VLog.log('[saveGraph] сохранено локально, id:', saved.id);
    } finally {
        _saveGraphInFlight = false;
    }
}
function buildScenarioPayloadFromCurrent() {
    return {
        scenarioKey: window._currentScenarioKey || generateScenarioKey(),
        schemaVersion: 2,
        trainingType: trainingNode?.params?.trainingType || 'single',
        graph: {
            nodes: JSON.parse(JSON.stringify(nodes || [])),
            connections: JSON.parse(JSON.stringify(connections || [])),
            books: JSON.parse(JSON.stringify(window._books || {}))
        },
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
}
const SCHEMA_VERSION = 2;

function migrateScenario(data) {
    const version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 1;
    if (version === SCHEMA_VERSION) return data;
    if (version === 1) {
        VLog.log('[migrate] scenario v1 -> v2');
        data.schemaVersion = 2;
        // Миграции v1 -> v2 уже выполняются дальше в loadGraph (per-node defaults),
        // тут фиксируем только номер версии.
    }
    return data;
}

function loadGraph(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            let data = JSON.parse(e.target.result);
            data = migrateScenario(data);
            if (file && file.name) window._currentScenarioFileName = file.name;
            const g = data.graph || data;
            nodes = g.nodes || [];
            connections = g.connections || [];
            window._books = g.books || {};
            if (data.scenarioKey && typeof data.scenarioKey === 'string')
                window._currentScenarioKey = data.scenarioKey;
            else window._currentScenarioKey = generateScenarioKey();
            if (data.distances) {
                if (typeof data.distances.general === 'number') generalDistance = data.distances.general;
                if (typeof data.distances.reading === 'number') readingDistance = data.distances.reading;
                if (typeof data.distances.incTol === 'number')
                    distanceToleranceIncreasePct = data.distances.incTol;
                if (typeof data.distances.decTol === 'number')
                    distanceToleranceDecreasePct = data.distances.decTol;
                if (typeof data.distances.timeout === 'number')
                    distanceRestoreTimeoutSec = data.distances.timeout;
            }
            if (data.blink) {
                if (typeof data.blink.enabled === 'boolean') blinkEnabled = data.blink.enabled;
                if (typeof data.blink.threshold === 'number') blinkThreshold = data.blink.threshold;
                if (typeof data.blink.minRate === 'number') blinkMinRate = data.blink.minRate;
                if (typeof data.blink.window === 'number') blinkWindowSec = data.blink.window;
                if (typeof data.blink.lockShow === 'boolean') blinkLockShow = data.blink.lockShow;
            }
            saveUserSettings();
            connections.forEach((c) => {
                if (c.inheritSize === undefined) c.inheritSize = false;
                if (c.inheritSpeed === undefined) c.inheritSpeed = false;
                delete c.inheritBook;
                delete c.inheritPosition;
            });
            nodes.forEach((node) => {
                if (
                    (node.nodeType === 'STIMULUS' || node.nodeType === 'DYNAMIC') &&
                    node.stimAcuity === undefined
                ) {
                    const d = generalDistance || 1,
                        ppi = screenPPI || 96;
                    const oldS = node.stimSize || 40;
                    const sizeMm = (oldS * 25.4) / ppi;
                    const V = (d * 1.454) / Math.max(0.01, sizeMm);
                    node.stimAcuity = Math.max(0.1, Math.min(2.0, Math.round(V * 10) / 10));
                    node.stimDistance = d;
                    node.stimPPI = ppi;
                    node.stimSize = getNodeComputedSize(node);
                }
                if (node.nodeType === 'STIMULUS' || node.nodeType === 'DYNAMIC') {
                    if (node.endAcuity === undefined) node.endAcuity = node.stimAcuity || 1.0;
                    if (node.acuityStep === undefined) node.acuityStep = 0.1;
                    if (node.seriesCount === undefined) node.seriesCount = 5;
                    if (node.seriesSize === undefined) node.seriesSize = 6;
                    if (node.seriesThreshold === undefined) node.seriesThreshold = 4;
                    if (node.adaptiveAcuity === undefined) node.adaptiveAcuity = true; // серий всего
                    if (node.singleRandomPos === undefined) node.singleRandomPos = false;
                    if (node.singleGridEnabled === undefined) node.singleGridEnabled = false;
                    if (node.singleGridX === undefined) node.singleGridX = 3;
                    if (node.singleGridY === undefined) node.singleGridY = 3;
                    if (node.singleGridShowLines === undefined) node.singleGridShowLines = false;
                    if (node.singleGridRandomCell === undefined) node.singleGridRandomCell = true;
                    if (node.singleGridAvoidRepeat === undefined) node.singleGridAvoidRepeat = true;
                    if (node.singleGridFixedRow === undefined) node.singleGridFixedRow = 0;
                    if (node.singleGridFixedCol === undefined) node.singleGridFixedCol = 0;
                    if (!Array.isArray(node.singleGridCells)) node.singleGridCells = [];
                    if (node.singleStimDynamicEnabled === undefined) node.singleStimDynamicEnabled = false;
                    if (node.singleStimColor1 === undefined) node.singleStimColor1 = { r: 255, g: 0, b: 0 };
                    if (node.singleStimMidEnabled === undefined) node.singleStimMidEnabled = false;
                    if (node.singleStimColor3 === undefined) node.singleStimColor3 = { r: 255, g: 255, b: 0 };
                    if (node.singleStimColor2 === undefined) node.singleStimColor2 = { r: 0, g: 0, b: 255 };
                    if (node.singleStimDuration === undefined) node.singleStimDuration = 10000;
                    if (node.singleStimLoop === undefined) node.singleStimLoop = false;
                    if (node.singleStimReverse === undefined) node.singleStimReverse = false;
                    if (node.singleBgDynamicEnabled === undefined) node.singleBgDynamicEnabled = false;
                    if (node.singleBgColor1 === undefined) node.singleBgColor1 = { r: 255, g: 0, b: 0 };
                    if (node.singleBgMidEnabled === undefined) node.singleBgMidEnabled = false;
                    if (node.singleBgColor3 === undefined) node.singleBgColor3 = { r: 255, g: 255, b: 0 };
                    if (node.singleBgColor2 === undefined) node.singleBgColor2 = { r: 0, g: 0, b: 255 };
                    if (node.singleBgDuration === undefined) node.singleBgDuration = 10000;
                    if (node.singleBgLoop === undefined) node.singleBgLoop = false;
                    if (node.singleBgReverse === undefined) node.singleBgReverse = false;
                    if (node.singleCircleEnabled === undefined) node.singleCircleEnabled = false;
                    if (node.circleInnerEnabled === undefined) node.circleInnerEnabled = true;
                    if (node.circleInnerRadiusPct === undefined) node.circleInnerRadiusPct = 40;
                    if (node.circleInnerColor1 === undefined) node.circleInnerColor1 = { r: 255, g: 0, b: 0 };
                    if (node.circleInnerMidEnabled === undefined) node.circleInnerMidEnabled = false;
                    if (node.circleInnerColor3 === undefined)
                        node.circleInnerColor3 = { r: 255, g: 255, b: 0 };
                    if (node.circleInnerColor2 === undefined) node.circleInnerColor2 = { r: 0, g: 0, b: 255 };
                    if (node.circleInnerDuration === undefined) node.circleInnerDuration = 10000;
                    if (node.circleInnerLoop === undefined) node.circleInnerLoop = true;
                    if (node.circleInnerReverse === undefined) node.circleInnerReverse = false;
                    if (node.circleOuterEnabled === undefined) node.circleOuterEnabled = true;
                    if (node.circleOuterColor1 === undefined) node.circleOuterColor1 = { r: 0, g: 255, b: 0 };
                    if (node.circleOuterMidEnabled === undefined) node.circleOuterMidEnabled = false;
                    if (node.circleOuterColor3 === undefined)
                        node.circleOuterColor3 = { r: 0, g: 255, b: 255 };
                    if (node.circleOuterColor2 === undefined)
                        node.circleOuterColor2 = { r: 0, g: 128, b: 255 };
                    if (node.circleOuterDuration === undefined) node.circleOuterDuration = 10000;
                    if (node.circleOuterLoop === undefined) node.circleOuterLoop = true;
                    if (node.circleOuterReverse === undefined) node.circleOuterReverse = false;
                    if (node.periEnabled === undefined) node.periEnabled = false;
                    if (node.periCount === undefined) node.periCount = 4;
                    if (node.periAcuity === undefined) node.periAcuity = 0.3;
                    if (node.periRadiusMinPct === undefined) node.periRadiusMinPct = 60;
                    if (node.periRadiusMaxPct === undefined) node.periRadiusMaxPct = 90;
                    if (node.periColor === undefined) node.periColor = { r: 0, g: 255, b: 100 };
                    if (node.periMotion === undefined) node.periMotion = 'static';
                    if (node.periSpeed === undefined) node.periSpeed = 0.3;
                    if (node.periRandomAngles === undefined) node.periRandomAngles = true;
                    if (node.dfEnabled === undefined) node.dfEnabled = false;
                    if (node.dfCenterRadiusMm === undefined) node.dfCenterRadiusMm = 13;
                    if (node.dfCenterBg === undefined) node.dfCenterBg = { r: 204, g: 0, b: 0 };
                    if (node.dfStimColor === undefined) node.dfStimColor = { r: 0, g: 0, b: 0 };
                    if (node.dfPeriBg === undefined) node.dfPeriBg = { r: 0, g: 71, b: 171 };
                    if (node.dfPeriBlur === undefined) node.dfPeriBlur = 0;
                    if (node.blinkEnabled === undefined) node.blinkEnabled = false;
                    if (node.blinkColorA === undefined) node.blinkColorA = { r: 255, g: 0, b: 0 };
                    if (node.blinkColorB === undefined) node.blinkColorB = { r: 0, g: 0, b: 255 };
                    if (node.blinkIntervalMs === undefined) node.blinkIntervalMs = 500;
                    if (node.blinkDuty === undefined) node.blinkDuty = 0.5;
                    if (node.blinkCount === undefined) node.blinkCount = 0;
                    if (node.blinkTarget === undefined) node.blinkTarget = 'stim';
                }
                if (node.nodeType === 'READING') {
                    if (node.readingFontFamily === undefined) node.readingFontFamily = 'Segoe UI';
                    if (node.readingFontWeight === undefined) node.readingFontWeight = 'normal';
                    if (node.readingAcuity === undefined) node.readingAcuity = 1.0;
                    if (node.readingDistance === undefined) node.readingDistance = readingDistance || 1;
                    if (node.readingPPI === undefined) node.readingPPI = screenPPI || 96;
                    if (node.readingTextColor === undefined) node.readingTextColor = { r: 0, g: 0, b: 0 };
                    if (node.readingBgColor === undefined) node.readingBgColor = { r: 255, g: 255, b: 255 };
                    if (node.readingBgMode === undefined) node.readingBgMode = 'solid';
                    if (node.duration === undefined) node.duration = 60000;
                    if (node.autoSaveBookmark === undefined) node.autoSaveBookmark = true;
                    if (node.continueFromBookmark === undefined) node.continueFromBookmark = true;
                }
                if (node.nodeType === 'COMPARE') {
                    if (!node.compareMode) node.compareMode = 'direction';
                    if (node.pairsCount === undefined) node.pairsCount = 2;
                    if (!node.gridX) node.gridX = 3;
                    if (!node.gridY) node.gridY = 3;
                    if (!Array.isArray(node.activeCells) || node.activeCells.length < 2)
                        node.activeCells = [
                            { row: 0, col: 0 },
                            { row: 0, col: 1 }
                        ];
                    if (!Array.isArray(node.cellParams)) node.cellParams = [];
                    while (node.cellParams.length < node.activeCells.length)
                        node.cellParams.push(defaultCompareCellParams());
                    if (node.seriesCount === undefined) node.seriesCount = 5;
                    if (node.seriesSize === undefined) node.seriesSize = 6;
                    if (node.seriesThreshold === undefined) node.seriesThreshold = 4;

                    if (node.delay1 === undefined) node.delay1 = 1000;
                    if (node.duration === undefined) node.duration = 2000;
                    if (node.delay2 === undefined) node.delay2 = 1000;
                }
            });
            requestRenderGraph();
            updateInspector();
        } catch (err) {
            VissortDialog.alert('Ошибка загрузки');
            console.error(err);
        }
    };
    reader.readAsText(file);
}

// ==================== БИБЛИОТЕКА СЦЕНАРИЕВ ====================
async function loadScenarioList() {
    const list = document.getElementById('scenario-list');
    if (!list) return;
    list.innerHTML = '<div style="padding:20px;color:#666;text-align:center;">Загрузка…</div>';
    try {
        const scenarios = await window.Data.getScenarios();
        list.innerHTML = '';
        if (scenarios.length === 0) {
            list.innerHTML =
                '<div style="padding:20px;color:#666;text-align:center;font-style:italic;">Пока нет сценариев.</div>';
            return;
        }
        scenarios.forEach((sc) => {
            const div = document.createElement('div');
            div.style.cssText = 'border-bottom:1px solid #333;padding:8px 4px;';
            const nodeCount = sc.params?.graph?.nodes?.length || 0;
            const connCount = sc.params?.graph?.connections?.length || 0;
            const dirty = sc._dirty ? ' <span style="color:#f59e0b;font-size:10px;">● локально</span>' : '';
            div.innerHTML = `<b>${escapeHtml(sc.name || '(без имени)')}</b>${dirty} <span style="color:#94a3b8;font-size:11px;">(${escapeHtml(sc.training_type || 'single')})</span><br><span style="font-size:11px;color:#94a3b8;">Узлов: ${nodeCount}, связей: ${connCount}</span><br><button class="btn btn-secondary btn-load-scenario" data-id="${escapeHtml(sc.id)}" style="margin-top:4px;font-size:11px;padding:3px 10px;">Загрузить</button>`;
            list.appendChild(div);
        });
        list.querySelectorAll('.btn-load-scenario').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const sc = await window.Data.getScenarioById(id);
                if (!sc) {
                    VissortDialog.alert('Сценарий не найден');
                    return;
                }
                trainingNode = { params: sc.params };
                window._pendingGeneratorMode = true;
                const graph = sc.params?.graph || sc.params;
                if (graph?.nodes) {
                    nodes = graph.nodes;
                    connections = graph.connections || [];
                    window._books = graph.books || {};
                    if (sc.params?.scenarioKey) window._currentScenarioKey = sc.params.scenarioKey;
                    window._currentScenarioId = id;
                    window._currentScenarioFileName = (sc.name || 'scenario') + '.json';
                    requestRenderGraph();
                    VissortDialog.alert('Сценарий загружен в граф.');
                } else VissortDialog.alert('Сценарий загружен. Нажмите «Плеер».');
                document.getElementById('library-modal').style.display = 'none';
            });
        });
    } catch (e) {
        list.innerHTML = `<div style="padding:20px;color:#dc2626;">Ошибка: ${escapeHtml(e.message)}</div>`;
    }
}
async function saveCurrentScenario() {
    if (!window.Data || !window.Data.getCurrentUserId()) {
        VissortDialog.alert('Войдите');
        return;
    }
    if (!trainingNode || !trainingNode.params) {
        VissortDialog.alert('Нет тренировки');
        return;
    }
    const name = await VissortDialog.prompt('Название:');
    if (!name) return;
    const record = {
        id: window.Data.uuid(),
        name,
        training_type: trainingNode.params.trainingType || 'single',
        params: {
            graph: {
                nodes: JSON.parse(JSON.stringify(nodes)),
                connections: JSON.parse(JSON.stringify(connections)),
                books: JSON.parse(JSON.stringify(window._books))
            },
            scenarioKey: window._currentScenarioKey || generateScenarioKey()
        }
    };
    await window.Data.saveScenario(record);
    VissortDialog.alert('Сохранено: ' + name);
    loadScenarioList();
}

// ==================== ПОЛЬЗОВАТЕЛИ И НАЗНАЧЕНИЯ ====================
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

// ==================== START ====================
init();


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