// ==================== app.js: Начало части 1 из 3 ====================

// ==================== НАСТРОЙКИ ====================
const SUPABASE_URL = 'https://hzvypwdpdhsjzaclxmbm.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6dnlwd2RwZGhzanphY2x4bWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjIyNTIsImV4cCI6MjEwNDE5ODI1Mn0.' +
    'HK0VE9KdzS8c7WoMCIlvOUn02vSOQEN0ahGPgsYzKac';
const ADMIN_EMAILS = ['dumand@gmail.com', 'eremeevap@gmail.com'];
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
let supabaseClient = null, currentUser = null, currentSessionId = null, authMode = 'signin';
let nodes = [], connections = [], activeNodeId = null;
let dragNodeId = null, offsetX = 0, offsetY = 0;
let resizeNodeId = null, startW = 0, startH = 0, startMouseX = 0, startMouseY = 0;
let currentMode = 'nodes', renderScheduled = false;
const nodeElements = new Map(), connectionElements = new Map();
let tempLineElement = null, tempLineMoveHandler = null, currentConnectionForMenu = null;
let playQueue = [], playIndex = 0;
let singleStimAnimId = null, singleBgAnimId = null, singleStimAnimStart = null, singleBgAnimStart = null;
let currentSingleCell = { row: 0, col: 0 };
let playerRunning = false, isPaused = false;
let phaseTimers = [], currentShowTimer = null;
let responsePhaseActive = false, responseStartTime = 0;
let lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
let currentCorrectDirection = null, lastDirection = null;
let completedSeries = 0, successfulSeries = 0, failedSeries = 0;
let seriesCorrect = 0, seriesIncorrect = 0, seriesNoAnswer = 0;
let seriesStep = 0, noAnswerSeriesStreak = 0;
let currentSize = 27, currentDuration = 2550;
let currentStimColor = { r: 0, g: 255, b: 0 };
let currentBgColor = { r: 0, g: 0, b: 0 };
let compareMode = 'direction', gridX = 3, gridY = 3;
let activeCells = [], cellParams = [], currentCompareAnswer = null;
let selectedCells = [], singleGridX = 1, singleGridY = 1;
let currentCompareNode = null, _findSameState = null;

let readingDistance = 1, generalDistance = 1;
let distanceToleranceIncreasePct = 15, distanceToleranceDecreasePct = 10, distanceRestoreTimeoutSec = 3;
let _distanceBaseline = null, _distanceOutOfBoundsSince = 0, _distanceWarningKind = null, _distanceRecalcScheduled = false;

let _periAnimId = null;
let _periAnimStart = null;

// --- МОРГАНИЕ ---
let _blinkTimerId = null;
let _blinkStateLocal = { tick: 0, current: 'A' };

let blinkEnabled = true;
let blinkThreshold = 0.21;
let blinkMinRate = 8;
let blinkWindowSec = 30;
let blinkLockShow = true;
const BLINK_BLOCK_MS = 200;
const BLINK_AUTOPAUSE_MS = 800;
const BLINK_SHORT_MS = 100;
const BLINK_LONG_MS = 400;
const BLINK_ASYM_RATIO = 0.45;

let _blinkState = createEmptyBlinkState();
let _blinkResponseBlockUntil = 0;
let _blinkCalibration = null;
let _waitingForOpenEyes = false;

function createEmptyBlinkState() {
    return {
        lastEAR: 0.3,
        lastEarL: 0.3, lastEarR: 0.3,
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

let videoStream = null, cameraActive = false;
let videoFrameId = null;
let focalLengthPx = localStorage.getItem('focalLengthPx') || null;
const realIPD_MM = 63;
let currentDistanceMeters = null, lastEyeDistancePx = null;
let distanceLog = [], distanceMin = null, distanceMax = null;
let distanceSum = 0, distanceCount = 0, distanceLastUpdate = 0;
let currentAcuity = 1.0, screenPPI = 96, trainingDistance = 1;

let readingViewportEl = null, readingContentEl = null, readingToolbarEl = null;
let readingPage = 0, readingTotalPages = 1, readingPaused = false;
let readingFontFamily = 'Segoe UI', readingFontWeight = 'normal';
let readingCurrentNode = null;

let db = null, trainingNode = null, blockList = [], selectedFolderHandle = null;
let currentPlayingNodeId = null, nodeAcuityCurrent = 1.0;

let _saveGraphInFlight = false;

window._pendingGeneratorMode = false;
window._books = window._books || {};
window._currentScenarioKey = window._currentScenarioKey || null;
window._currentScenarioFileName = window._currentScenarioFileName || null;

// ==================== DOM-ССЫЛКИ ====================
const canvas = document.getElementById('canvas');
const stimDisplay = document.getElementById('stim');
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
const folderStatus = document.getElementById('folder-status');
const readingFileInput = document.getElementById('reading-file-input');
const readingFileName = document.getElementById('reading-file-name');

// ==================== ФОРМУЛЫ ОСТРОТЫ ====================
function acuityToSizeMm(acuity, distanceMeters) {
    const d = (distanceMeters && distanceMeters > 0) ? distanceMeters : 1;
    const V = Math.max(0.01, acuity || 1.0);
    return d * 1.454 / V;
}
function acuityToSizePx(acuity, distanceMeters, ppi) {
    const sizeMm = acuityToSizeMm(acuity, distanceMeters);
    const dpr = window.devicePixelRatio || 1;
    const physicalPx = sizeMm * (ppi || 96) / 25.4;
    return Math.round(Math.max(1, Math.min(3000, physicalPx / dpr)));
}
function getNodeComputedSizeMm(node) {
    return acuityToSizeMm(node.stimAcuity || 1.0, node.stimDistance || trainingNode?.params?.distanceMeters || 1);
}
function getNodeComputedSize(node) {
    return acuityToSizePx(node.stimAcuity || 1.0,
        node.stimDistance || trainingNode?.params?.distanceMeters || 1,
        node.stimPPI || trainingNode?.params?.ppi || screenPPI || 96);
}
function acuityToFontSizePx(acuity, distanceMeters, ppi) {
    const xHeightMm = acuityToSizeMm(acuity, distanceMeters);
    const fontSizeMm = xHeightMm / 0.5;
    const dpr = window.devicePixelRatio || 1;
    const physicalPx = fontSizeMm * (ppi || 96) / 25.4;
    return Math.round(Math.max(8, Math.min(2000, physicalPx / dpr)));
}

// ==================== УТИЛИТЫ ====================
const TIME_UNITS = { ms: 1, s: 1000, min: 60000 };
function msToUnit(ms, unit) { return ms / TIME_UNITS[unit]; }
function unitToMs(v, unit) { return v * TIME_UNITS[unit]; }
function detectUnit(ms) {
    if (ms >= 60000 && ms % 60000 === 0) return 'min';
    if (ms >= 1000 && ms % 1000 === 0) return 's';
    if (ms === 0) return 's';
    return 'ms';
}
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function safeVal(id, defVal, parser) {
    const el = document.getElementById(id);
    if (!el) return defVal;
    const v = parser ? parser(el.value) : el.value;
    return (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) ? defVal : v;
}
function safeChecked(id, defVal) { const el = document.getElementById(id); return el ? el.checked === true : defVal; }
function hashCode(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; } return Math.abs(h).toString(36); }
async function sha1(str) {
    if (!window.crypto || !window.crypto.subtle) return 'weak-' + hashCode(str);
    const buf = new TextEncoder().encode(str);
    const hb = await window.crypto.subtle.digest('SHA-1', buf);
    return Array.from(new Uint8Array(hb)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : { r:0,g:0,b:0 };
}
function rgbToHex(r,g,b) {
    const s = (c) => Math.min(255, Math.max(0, c || 0));
    return '#' + [s(r), s(g), s(b)].map(c => c.toString(16).padStart(2,'0')).join('');
}
function lerpColor(from, to, t) {
    return { r: Math.round(from.r + (to.r - from.r) * t), g: Math.round(from.g + (to.g - from.g) * t), b: Math.round(from.b + (to.b - from.b) * t) };
}

// ==================== SCENARIO KEY / BOOKMARKS ====================
function generateScenarioKey() { return 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
function bookmarkKeyFor(bookId) { return 'vissort_bookmark_' + (window._currentScenarioKey || 'default') + '_' + bookId; }
function getLastBookId() {
    try { const k = 'vissort_lastBookId_' + (window._currentScenarioKey || 'default'); const id = localStorage.getItem(k); if (id && window._books && window._books[id]) return id; } catch (_) {}
    return null;
}
function setLastBookId(id) {
    try { const k = 'vissort_lastBookId_' + (window._currentScenarioKey || 'default'); if (id) localStorage.setItem(k, id); else localStorage.removeItem(k); } catch (_) {}
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
    const it = parseFloat(localStorage.getItem(LS_KEYS.distIncTol)); if (!isNaN(it) && it >= 0 && it <= 100) distanceToleranceIncreasePct = it;
    const dt = parseFloat(localStorage.getItem(LS_KEYS.distDecTol)); if (!isNaN(dt) && dt >= 0 && dt <= 100) distanceToleranceDecreasePct = dt;
    const to = parseFloat(localStorage.getItem(LS_KEYS.distTimeout)); if (!isNaN(to) && to >= 0 && to <= 60) distanceRestoreTimeoutSec = to;
    const be = localStorage.getItem(LS_KEYS.blinkEnabled); if (be !== null) blinkEnabled = be === 'true';
    const bt = parseFloat(localStorage.getItem(LS_KEYS.blinkThreshold)); if (!isNaN(bt) && bt > 0.05 && bt < 0.5) blinkThreshold = bt;
    const bm = parseFloat(localStorage.getItem(LS_KEYS.blinkMinRate)); if (!isNaN(bm) && bm >= 0 && bm <= 60) blinkMinRate = bm;
    const bw = parseFloat(localStorage.getItem(LS_KEYS.blinkWindow)); if (!isNaN(bw) && bw >= 5 && bw <= 120) blinkWindowSec = bw;
    const bls = localStorage.getItem(LS_KEYS.blinkLockShow); if (bls !== null) blinkLockShow = bls === 'true';
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
    } catch (e) { console.warn('save settings:', e); }
}

// ==================== КОДИРОВКИ / ШРИФТ / ПАРСИНГ ====================
function decodeTextBuffer(buf) {
    const b = new Uint8Array(buf);
    if (b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return new TextDecoder('utf-8').decode(b);
    if (b.length >= 2 && b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b);
    if (b.length >= 2 && b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
    catch (e) { try { return new TextDecoder('windows-1251').decode(b); } catch (e2) { return new TextDecoder('utf-8').decode(b); } }
}
async function decodeTextFile(file) { return decodeTextBuffer(await file.arrayBuffer()); }
async function loadSivtsevFont() {
    const FONT_URL = 'https://cdn.jsdelivr.net/gh/shoorick/sivtsev-font@master/Sivtsev-Eye-Chart.otf';
    const KEY = 'sivtsevFontLoaded';
    if (localStorage.getItem(KEY) === 'true') return;
    let loaded = false;
    if (document.fonts && document.fonts.forEach) {
        document.fonts.forEach(f => { if (f.family === 'Sivtsev' && f.status === 'loaded') loaded = true; });
    }
    if (loaded) { localStorage.setItem(KEY, 'true'); return; }
    try {
        const font = new FontFace('Sivtsev', `url(${FONT_URL}) format('opentype')`, { style: 'normal', weight: 'normal' });
        await font.load(); document.fonts.add(font); localStorage.setItem(KEY, 'true');
    } catch (err) { console.error('Sivtsev:', err); }
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
    if (xmlText.charCodeAt(0) === 0xFEFF) xmlText = xmlText.slice(1);
    xmlText = xmlText.replace(/<!DOCTYPE[^>\[]*(\[[\s\S]*?\])?[^>]*>/gi, '').replace(/<\?xml[^?]*\?>/i, '<?xml version="1.0" encoding="UTF-8"?>');
    xmlText = xmlText.replace(/&nbsp;/g, '\u00A0').replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013').replace(/&hellip;/g, '\u2026').replace(/&laquo;/g, '\u00AB').replace(/&raquo;/g, '\u00BB').replace(/&ldquo;/g, '\u201C').replace(/&rdquo;/g, '\u201D').replace(/&lsquo;/g, '\u2018').replace(/&rsquo;/g, '\u2019').replace(/&copy;/g, '\u00A9').replace(/&reg;/g, '\u00AE').replace(/&trade;/g, '\u2122');
    const parser = new DOMParser();
    let doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) doc = parser.parseFromString(xmlText, 'text/html');
    const bodies = doc.querySelectorAll('body');
    if (bodies.length === 0) return extractFb2TextByRegex(xmlText);
    const result = [];
    bodies.forEach(body => {
        const bn = (body.getAttribute?.('name') || '').toLowerCase();
        if (bn === 'notes' || bn === 'comments') return;
        body.querySelectorAll('title, subtitle, p, v, text-author, empty-line, poem, epigraph, cite').forEach(node => {
            if (node.tagName.toLowerCase() === 'empty-line') { result.push(''); return; }
            const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
            if (t) result.push(t);
        });
    });
    return result.length === 0 ? '' : result.join('\n');
}
function extractFb2TextByRegex(xmlText) {
    let t = xmlText.replace(/<[!?][^>]*>/g, ' ').replace(/<binary[\s\S]*?<\/binary>/gi, ' ').replace(/<empty-line\s*\/?>/gi, '\n').replace(/<\/(p|title|subtitle|v|text-author|section|poem|epigraph|cite)>/gi, '\n').replace(/<[^>]+>/g, '');
    t = t.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    return t.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
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
    if (!opfPath) zip.forEach((p) => { if (!opfPath && /\.opf$/i.test(p)) opfPath = p; });
    if (!opfPath) return await extractAllHtmlFromZip(zip);
    const opfFile = zip.file(opfPath);
    if (!opfFile) return await extractAllHtmlFromZip(zip);
    const opfDoc = new DOMParser().parseFromString(await opfFile.async('string'), 'application/xml');
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
    const manifest = {};
    opfDoc.querySelectorAll('manifest > item').forEach(item => {
        const id = item.getAttribute('id'), href = item.getAttribute('href'), mt = item.getAttribute('media-type') || '';
        if (id && href) manifest[id] = { href, mediaType: mt };
    });
    const spine = [];
    opfDoc.querySelectorAll('spine > itemref').forEach(ref => {
        const idref = ref.getAttribute('idref');
        if (idref && manifest[idref]) spine.push(manifest[idref].href);
    });
    if (spine.length === 0) Object.values(manifest).forEach(m => { if (/html|xhtml/i.test(m.mediaType) || /\.x?html?$/i.test(m.href)) spine.push(m.href); });
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
        if (part === '..') stack.pop(); else stack.push(part);
    }
    return stack.join('/');
}
function extractTextFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc.body) return '';
    doc.body.querySelectorAll('script, style, nav').forEach(el => el.remove());
    const blocks = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, li');
    const texts = [];
    if (blocks.length > 0) blocks.forEach(el => { const t = (el.textContent || '').replace(/\s+/g, ' ').trim(); if (t) texts.push(t); });
    else { const t = (doc.body.textContent || '').replace(/\s+/g, ' ').trim(); if (t) texts.push(t); }
    return texts.join('\n');
}
async function extractAllHtmlFromZip(zip) {
    const files = [];
    zip.forEach((p, e) => { if (!e.dir && /\.(x?html?|htm)$/i.test(p)) files.push({ p, e }); });
    files.sort((a, b) => a.p.localeCompare(b.p));
    const result = [];
    for (const { e } of files) { const t = extractTextFromHtml(await e.async('string')); if (t) result.push(t); }
    return result.join('\n\n');
}

// ==================== КАЛИБРОВКА ЭКРАНА ====================
const CALIB_BAR_PX = 400;
function detectDeviceType() {
    const ua = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';
    if (/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua)) return 'mobile';
    return 'desktop';
}
function detectPPIHeuristic() {
    const type = detectDeviceType(), dpr = window.devicePixelRatio || 1;
    if (type === 'mobile') { if (dpr >= 3.5) return 500; if (dpr >= 3) return 460; if (dpr >= 2.75) return 400; if (dpr >= 2) return 320; return 220; }
    if (type === 'tablet') return dpr >= 2 ? 264 : 160;
    return Math.round(96 * dpr);
}
function ppiFromMeasuredMm(mm) { if (!mm || mm <= 0) return null; return Math.round(CALIB_BAR_PX * (window.devicePixelRatio || 1) * 25.4 / mm); }
function savePPI(ppi) { localStorage.setItem('screenPPI', String(ppi)); localStorage.setItem('screenPPICalibrated', 'true'); }
function loadPPI() { const s = localStorage.getItem('screenPPI'); return (s && !isNaN(parseInt(s))) ? parseInt(s) : detectPPIHeuristic(); }
function initScreenCalibration() { screenPPI = loadPPI(); }
function openScreenCalibModal() {
    const modalEl = document.getElementById('screen-calib-modal');
    if (!modalEl) return;
    const bar = document.getElementById('screen-calib-bar');
    if (bar) bar.style.width = CALIB_BAR_PX + 'px';
    const initialPPI = loadPPI(), dpr = window.devicePixelRatio || 1;
    const mmInput = document.getElementById('screen-calib-mm');
    if (!mmInput) return;
    mmInput.value = Math.round((CALIB_BAR_PX * dpr / initialPPI) * 25.4 * 2) / 2;
    const resultEl = document.getElementById('screen-calib-result');
    const detailEl = document.getElementById('screen-calib-detail');
    const autoEl = document.getElementById('screen-calib-auto');
    const update = () => {
        const ppi = ppiFromMeasuredMm(parseFloat(mmInput.value) || 0);
        if (resultEl) resultEl.textContent = ppi ? ppi : '—';
        if (detailEl) detailEl.textContent = ppi ? `${CALIB_BAR_PX * dpr} физ. px = ${(CALIB_BAR_PX * dpr / ppi * 25.4).toFixed(1)} мм` : '';
    };
    mmInput.oninput = update; update();
    if (autoEl) { const info = { w: Math.round(window.screen.width * dpr), h: Math.round(window.screen.height * dpr) };
        autoEl.textContent = `${detectDeviceType()}, DPR: ${dpr}, ${info.w}×${info.h}, эвристика: ${detectPPIHeuristic()} PPI`; }
    modalEl.style.display = 'flex';
}
function applyScreenCalib() {
    const mmInput = document.getElementById('screen-calib-mm');
    const modalEl = document.getElementById('screen-calib-modal');
    if (!mmInput || !modalEl) return;
    const mm = parseFloat(mmInput.value);
    if (!mm || mm < 5 || mm > 500) { alert('Введите длину в мм (5..500)'); return; }
    const ppi = ppiFromMeasuredMm(mm);
    if (!ppi || ppi < 20 || ppi > 2000) { alert('PPI вне разумных пределов'); return; }
    savePPI(ppi); screenPPI = ppi;
    if (activeNodeId) {
        const node = getNode(activeNodeId);
        if (node && (node.nodeType === 'STIMULUS' || node.nodeType === 'DYNAMIC')) {
            node.stimPPI = ppi; node.stimSize = getNodeComputedSize(node);
            requestRenderGraph(); updateInspector();
        } else if (node && node.nodeType === 'READING') {
            node.readingPPI = ppi;
            requestRenderGraph(); updateInspector();
        }
    }
    alert(`✅ PPI сохранён: ${ppi}`);
    modalEl.style.display = 'none';
}

// ==================== ОЦЕНКА ВРЕМЕНИ СЦЕНАРИЯ ====================
function estimateScenarioDurationMs(){
    if (!nodes || nodes.length === 0) return 0;
    const visited = new Set();
    let total = 0;
    const startNode = nodes.find(n => n.isStart === true) || nodes[0];
    if (!startNode) return 0;

    function nodeDuration(node){
        const delay1 = node.delay1 || 0;
        const duration = node.duration || 1000;
        const delay2 = node.delay2 || 1000;
        const seriesCount = node.seriesCount || 1;
        const seriesSize = node.seriesSize || 1;

        if (node.nodeType === 'READING'){
            return (node.duration || 60000) + (node.delay1 || 0) + (node.delay2 || 0);
        }
        if (node.nodeType === 'COMPARE'){
            return (delay1 + duration + delay2) * seriesCount * seriesSize;
        }
        let perNode = (delay1 + duration + delay2) * seriesCount * seriesSize;
        if (node.singleStimDynamicEnabled){
            perNode = Math.max(perNode, (delay1 + (node.singleStimDuration || 10000) + delay2) * seriesCount * seriesSize);
        }
        if (node.singleBgDynamicEnabled){
            perNode = Math.max(perNode, (delay1 + (node.singleBgDuration || 10000) + delay2) * seriesCount * seriesSize);
        }
        return perNode;
    }

    function visit(nodeId){
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        const node = getNode(nodeId);
        if (!node) return;
        if (node.isActive === false && node.nodeType !== 'LOGIC_IF') return;

        total += nodeDuration(node);

        connections
            .filter(c => c.fromId === nodeId && !c.isLoop)
            .forEach(c => visit(c.toId));

        connections
            .filter(c => c.fromId === nodeId && c.isLoop && c.toId !== nodeId)
            .forEach(c => {
                const lim = Math.max(1, c.loopLimit || 1);
                const target = getNode(c.toId);
                const source = getNode(c.fromId);
                if (!target) return;
                total += nodeDuration(target) * lim;
                if (source && source.id !== target.id) {
                    total += nodeDuration(source) * lim;
                }
            });
    }

    visit(startNode.id);
    return total;
}

function formatDurationMs(ms){
    if (!ms || ms <= 0) return '0 с';
    const totalSec = Math.round(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h} ч ${m} мин ${s} с`;
    if (m > 0) return `${m} мин ${s} с`;
    return `${s} с`;
}

function showScenarioTimeReport(){
    const modalEl = document.getElementById('scenario-time-modal');
    const body = document.getElementById('scenario-time-body');
    if (!modalEl || !body) return;

    const totalMs = estimateScenarioDurationMs();
    const nodesCount = nodes.length;
    const connsCount = connections.length;

    const rows = nodes
        .filter(n => n.isActive !== false)
        .map(n => {
            const name = (n.name || '').replace(/</g, '&lt;');
            const type = n.nodeType || 'STIMULUS';
            const d1 = n.delay1 || 0;
            const dur = n.duration || 1000;
            const d2 = n.delay2 || 1000;
            const sc = n.seriesCount || 1;
            const ss = n.seriesSize || 1;
            let oneRoundMs;
            let totalNodeMs;
            if (type === 'READING'){
                oneRoundMs = (n.duration || 60000) + d1 + d2;
                totalNodeMs = oneRoundMs;
            } else {
                oneRoundMs = d1 + dur + d2;
                totalNodeMs = oneRoundMs * sc * ss;
            }
            return {
                name, type, oneRoundMs, totalNodeMs,
                shows: (type === 'READING') ? 1 : (sc * ss)
            };
        });

    let html = `
        <div style="margin-bottom:10px;">
            <div>Узлов: <b>${nodesCount}</b> · Связей: <b>${connsCount}</b></div>
            <div style="font-size:22px;color:#a5b4fc;font-weight:800;margin-top:6px;">
                ${formatDurationMs(totalMs)}
            </div>
            <div style="color:#888;font-size:11px;">${Math.round(totalMs/1000)} секунд · ${Math.round(totalMs/60000*10)/10} минут</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
                <tr style="border-bottom:1px solid #3f3f46;color:#94a3b8;">
                    <th style="text-align:left;padding:6px 4px;">Узел</th>
                    <th style="text-align:right;padding:6px 4px;">Показов</th>
                    <th style="text-align:right;padding:6px 4px;">1 показ</th>
                    <th style="text-align:right;padding:6px 4px;">Всего</th>
                </tr>
            </thead>
            <tbody>
    `;
    rows.forEach(r => {
        html += `
            <tr style="border-bottom:1px solid #1e1e24;">
                <td style="padding:6px 4px;">${r.name}</td>
                <td style="text-align:right;padding:6px 4px;">${r.shows}</td>
                <td style="text-align:right;padding:6px 4px;color:#94a3b8;">${formatDurationMs(r.oneRoundMs)}</td>
                <td style="text-align:right;padding:6px 4px;color:#a5b4fc;font-weight:600;">${formatDurationMs(r.totalNodeMs)}</td>
            </tr>
        `;
    });
    if (rows.length === 0){
        html += `<tr><td colspan="4" style="text-align:center;padding:20px;color:#666;">Нет активных узлов</td></tr>`;
    }
    html += `</tbody></table>`;
    html += `<div style="margin-top:12px;font-size:11px;color:#666;line-height:1.5;">
        Расчёт: delay1 + показ + delay2 × серии × размер серии.<br>
        Петли учитываются как заход туда-обратно × количество циклов.
    </div>`;

    body.innerHTML = html;
    modalEl.style.display = 'flex';
}

// ==================== ИНДИКАТОРЫ / ПРЕДУПРЕЖДЕНИЯ ====================
function updateLiveDistanceIndicator() {
    const indicator = document.getElementById('live-distance-indicator');
    if (!indicator) return;
    if (currentDistanceMeters == null || !isFinite(currentDistanceMeters)) { indicator.style.display = 'none'; return; }
    indicator.textContent = `📏 ${currentDistanceMeters.toFixed(2)} м`;
    indicator.style.display = 'block';
}
function hideLiveDistanceIndicator() { const i = document.getElementById('live-distance-indicator'); if (i) i.style.display = 'none'; }

function getDistanceWarningEl() {
    let el = document.getElementById('distance-warning');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'distance-warning';
    el.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); padding: 22px 40px; background: rgba(220,38,38,0.92); color: #fff; font-size: 44px; font-weight: bold; border-radius: 14px; z-index: 99999; display: none; pointer-events: none; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.6); font-family: "Segoe UI",Tahoma,sans-serif; letter-spacing: 1px;';
    document.body.appendChild(el);
    return el;
}
function showDistanceWarning(kind) {
    const el = getDistanceWarningEl();
    const text = kind === 'up' ? 'Не отклоняйтесь' : 'Не приближайтесь';
    el.textContent = text;
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
    _distanceBaseline = null; _distanceOutOfBoundsSince = 0; _distanceWarningKind = null; _distanceRecalcScheduled = false;
    hideDistanceWarning();
}
function setDistanceBaselineIfNeeded() {
    if (_distanceBaseline == null && currentDistanceMeters != null && isFinite(currentDistanceMeters)) _distanceBaseline = currentDistanceMeters;
}
function evaluateDistanceDeviation() {
    if (_distanceBaseline == null || currentDistanceMeters == null || !isFinite(currentDistanceMeters)) return 'ok';
    const dev = (currentDistanceMeters - _distanceBaseline) / _distanceBaseline * 100;
    if (dev > distanceToleranceIncreasePct) return 'up';
    if (dev < -distanceToleranceDecreasePct) return 'down';
    return 'ok';
}

// ==================== МОРГАНИЕ (анимация) ====================
function startBlinkAnimation(opts){
    stopBlinkAnimation();
    if (!opts) return;
    const target = opts.target || 'stim';
    const A = opts.colorA || { r: 255, g: 0, b: 0 };
    const B = opts.colorB || { r: 0, g: 0, b: 255 };
    const intervalMs = Math.max(50, opts.intervalMs || 500);
    const duty = Math.max(0.05, Math.min(0.95, opts.duty ?? 0.5));
    const count = Math.max(0, opts.count || 0);

    _blinkStateLocal = { tick: 0, current: 'A' };

    function apply(color){
        if (target === 'stim' || target === 'both') setStimColorRGB(color.r, color.g, color.b);
        if (target === 'bg'   || target === 'both') stimArea.style.backgroundColor = `rgb(${color.r},${color.g},${color.b})`;
    }

    function tick(){
        if (!playerRunning || isPaused){ _blinkTimerId = null; return; }

        const isA = _blinkStateLocal.current === 'A';
        apply(isA ? A : B);

        _blinkStateLocal.tick++;
        if (count > 0 && _blinkStateLocal.tick >= count){
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

function stopBlinkAnimation(){
    if (_blinkTimerId){ clearTimeout(_blinkTimerId); _blinkTimerId = null; }
    _blinkStateLocal = { tick: 0, current: 'A' };
}

// ==================== BLINK: EAR ====================
function computeEAR(eyePoints) {
    if (!Array.isArray(eyePoints) || eyePoints.length < 6) return 0.3;
    const [p1, p2, p3, p4, p5, p6] = eyePoints;
    const v1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
    const v2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
    const h  = Math.hypot(p1.x - p4.x, p1.y - p4.y);
    if (h < 1) return 0.3;
    return (v1 + v2) / (2 * h);
}

function getBlinkWarningEl() {
    let el = document.getElementById('blink-warning');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'blink-warning';
    el.style.cssText = 'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); padding: 12px 28px; background: rgba(14,165,233,0.92); color: #fff; font-size: 22px; font-weight: bold; border-radius: 10px; z-index: 99998; display: none; pointer-events: none; text-align: center; box-shadow: 0 6px 24px rgba(0,0,0,0.5); font-family: "Segoe UI",Tahoma,sans-serif;';
    el.textContent = 'Поморгайте';
    document.body.appendChild(el);
    return el;
}
function showBlinkWarning() {
    const el = getBlinkWarningEl();
    el.style.display = 'block';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
    if (window.Voice) window.Voice.sayKey('blink', { cancel: true });
}
function hideBlinkWarning() { const el = document.getElementById('blink-warning'); if (el) el.style.display = 'none'; }

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
            const kind = duration > BLINK_LONG_MS ? 'long' : (isAsym ? 'asym' : 'normal');
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
    _blinkState.blinks = _blinkState.blinks.filter(b => b.ts >= windowStart);
    if (playerRunning && !isPaused) {
        const elapsedInWindowSec = Math.min(blinkWindowSec, (now - _blinkState.sessionStartMs) / 1000);
        if (elapsedInWindowSec > blinkWindowSec / 2) {
            const expectedSoFar = blinkMinRate * (elapsedInWindowSec / 60);
            if (_blinkState.blinks.length < expectedSoFar) {
                if (now - _blinkState.warningShownAt > 12000) { showBlinkWarning(); _blinkState.warningShownAt = now; }
            }
            const observedRate = _blinkState.blinks.length / Math.max(1, elapsedInWindowSec) * 60;
            if (_blinkState.minRateObserved == null || observedRate < _blinkState.minRateObserved) _blinkState.minRateObserved = observedRate;
        }
    }
}

function isBlinkResponseBlocked() { return performance.now() < _blinkResponseBlockUntil; }
function areEyesClosedNow() { return blinkEnabled && _blinkState.isClosed === true; }

function ensureBlinkCalibrationUI() {
    let btn = document.getElementById('btn-calibrate-blink');
    if (!btn) {
        const anchor = document.getElementById('btn-calibrate-camera');
        if (anchor && anchor.parentNode) {
            btn = document.createElement('button');
            btn.className = 'btn btn-warning';
            btn.id = 'btn-calibrate-blink';
            btn.disabled = true;
            btn.textContent = '👁️ Калибровка моргания';
            anchor.parentNode.insertBefore(btn, anchor.nextSibling);
            btn.addEventListener('click', startBlinkCalibration);
        }
    }
    if (!document.getElementById('blink-calibration-modal')) {
        const m = document.createElement('div');
        m.className = 'modal';
        m.id = 'blink-calibration-modal';
        m.innerHTML = `
            <div class="modal-content" style="width: 480px; text-align: center;">
                <h3>👁️ Калибровка моргания</h3>
                <p style="font-size: 13px; color: #ccc;">Смотрите прямо в камеру. Две фазы по 3 секунды.</p>
                <div id="blink-calib-phase" style="font-size: 20px; font-weight: bold; color: #38bdf8; margin: 16px 0;">Приготовьтесь…</div>
                <div id="blink-calib-countdown" style="font-size: 64px; font-weight: bold; color: #fff; margin: 16px 0;">—</div>
                <div id="blink-calib-result" style="font-size: 13px; color: #94a3b8; margin-top: 10px;">Текущий порог EAR: ${blinkThreshold.toFixed(3)}</div>
                <div class="modal-footer" style="justify-content: center;">
                    <button class="btn btn-secondary" id="blink-calib-cancel">Отмена</button>
                </div>
            </div>
        `;
        document.body.appendChild(m);
        document.getElementById('blink-calib-cancel').addEventListener('click', cancelBlinkCalibration);
    }
}
function startBlinkCalibration() {
    if (!cameraActive) { alert('Включите камеру'); return; }
    ensureBlinkCalibrationUI();
    _blinkCalibration = { phase: 'open', phaseStartMs: performance.now(), openSamples: [], closedSamples: [] };
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
    if (phase === 'open') { phaseEl.textContent = 'Смотрите прямо, глаза ОТКРЫТЫ'; phaseEl.style.color = '#22c55e'; }
    else { phaseEl.textContent = 'Закройте глаза (как при моргании)'; phaseEl.style.color = '#ef4444'; }
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
    if (openSamples.length < 5 || closedSamples.length < 5) { alert('Недостаточно данных с камеры. Убедитесь, что лицо видно, и повторите.'); cancelBlinkCalibration(); return; }
    const meanOpen = openSamples.reduce((a, b) => a + b, 0) / openSamples.length;
    const meanClosed = closedSamples.reduce((a, b) => a + b, 0) / closedSamples.length;
    if (meanOpen <= meanClosed) { alert('Значения нелогичны. Повторите калибровку.'); cancelBlinkCalibration(); return; }
    let th = (meanOpen + meanClosed) / 2;
    th = Math.max(0.12, Math.min(0.35, th));
    blinkThreshold = Math.round(th * 1000) / 1000;
    saveUserSettings();
    const r = document.getElementById('blink-calib-result');
    if (r) r.innerHTML = `Открытые: <b>${meanOpen.toFixed(3)}</b> · Закрытые: <b>${meanClosed.toFixed(3)}</b><br>Новый порог EAR: <b style="color:#22c55e;">${blinkThreshold.toFixed(3)}</b>`;
    _blinkCalibration = null;
    setTimeout(() => { document.getElementById('blink-calibration-modal').style.display = 'none'; }, 1800);
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
    const avgRate = s.totalBlinks / durSec * 60;
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
        timers.push(setTimeout(() => { if (!responsePhaseActive || isPaused) return; window.Voice.sayKey('countdown5'); }, durationMs - 5000));
    }
    [3, 2, 1].forEach(s => {
        const at = durationMs - s * 1000;
        if (at > 0) timers.push(setTimeout(() => { if (!responsePhaseActive || isPaused) return; window.Voice.sayKey('countdown' + s); }, at));
    });
    const watcher = setInterval(() => { if (!responsePhaseActive) { timers.forEach(t => clearTimeout(t)); clearInterval(watcher); } }, 200);
}

// ==================== app.js: Конец части 1 из 3 ====================
// ==================== app.js: Начало части 2 из 3 ====================

// ==================== SERVICE WORKER ====================
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (IS_DEV) { navigator.serviceWorker.getRegistrations().then(regs => { regs.forEach(r => r.unregister()); }); return; }
    window.addEventListener('load', async () => {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            if (reg.waiting) showSWUpdateBanner(reg);
            reg.addEventListener('updatefound', () => {
                const nw = reg.installing;
                if (!nw) return;
                nw.addEventListener('statechange', () => {
                    if (nw.state === 'installed' && navigator.serviceWorker.controller) showSWUpdateBanner(reg);
                });
            });
        } catch (err) { console.error('[SW]', err); }
    });
    let refreshing = false, hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) { hadController = true; return; }
        if (refreshing) return; refreshing = true; window.location.reload();
    });
}
function showSWUpdateBanner(reg) {
    if (document.getElementById('sw-update-banner')) return;
    const el = document.createElement('div');
    el.id = 'sw-update-banner';
    el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#10b981;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;z-index:10000;display:flex;gap:10px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,0.4);font-family:"Segoe UI",Tahoma,sans-serif;';
    el.innerHTML = '<span>Доступна новая версия</span><button style="background:#fff;color:#10b981;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-weight:bold;font-family:inherit;">Обновить</button>';
    el.querySelector('button').addEventListener('click', () => {
        try { reg.waiting?.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {}
        el.remove();
    });
    document.body.appendChild(el);
}

// ==================== INDEXEDDB ====================
const DB_NAME = 'vissort-db', DB_VERSION = 2;

function openDatabase() {
    return new Promise((res, rej) => {
        const r = indexedDB.open(DB_NAME, DB_VERSION);
        r.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains('scenarios'))
                d.createObjectStore('scenarios', { keyPath: 'id' });
            if (!d.objectStoreNames.contains('results'))
                d.createObjectStore('results', { autoIncrement: true, keyPath: 'localId' });
            if (!d.objectStoreNames.contains('syncQueue'))
                d.createObjectStore('syncQueue', { autoIncrement: true, keyPath: 'id' });
            if (!d.objectStoreNames.contains('settings'))
                d.createObjectStore('settings', { keyPath: 'key' });
            if (!d.objectStoreNames.contains('scenarioFileIndex'))
                d.createObjectStore('scenarioFileIndex', { keyPath: 'id' });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
}

function idbTx(store, mode, fn) {
    return new Promise((res, rej) => {
        try {
            const tx = db.transaction(store, mode);
            const s = tx.objectStore(store);
            const out = fn(s);
            tx.oncomplete = () => res(out);
            tx.onerror = () => rej(tx.error);
        } catch (e) { rej(e); }
    });
}
function idbPut(store, value)   { return idbTx(store, 'readwrite', s => s.put(value)); }
function idbDelete(store, key)  { return idbTx(store, 'readwrite', s => s.delete(key)); }
function idbGet(store, key) {
    return new Promise((res, rej) => {
        try {
            const tx = db.transaction(store, 'readonly');
            const r = tx.objectStore(store).get(key);
            r.onsuccess = () => res(r.result);
            r.onerror  = () => rej(r.error);
        } catch (e) { rej(e); }
    });
}
function idbGetAll(store) {
    return new Promise((res) => {
        try {
            const tx = db.transaction(store, 'readonly');
            const r = tx.objectStore(store).getAll();
            r.onsuccess = () => res(r.result || []);
            r.onerror  = () => res([]);
        } catch (_) { res([]); }
    });
}

function saveScenarioToLocal(s) { if (!db) return Promise.reject('DB'); return idbPut('scenarios', s); }
function getScenarioFromLocal(id) { if (!db) return Promise.reject('DB'); return idbGet('scenarios', id); }

async function syncPendingResults() {
    if (!db || !supabaseClient || !currentUser || !navigator.onLine) return;
    const all = await idbGetAll('syncQueue');
    for (const rec of all) {
        const { error } = await supabaseClient.from('test_results').insert({
            user_id: currentUser.id,
            session_id: rec.session_id, node_id: rec.node_id,
            response_time_ms: rec.response_time_ms, is_correct: rec.is_correct,
            created_at: rec.created_at
        });
        if (!error) await idbDelete('syncQueue', rec.id);
    }
}

// ==================== SETTINGS (IDB) ====================
async function loadSetting(key) {
    if (!db) return null;
    try { const r = await idbGet('settings', key); return r?.value ?? null; } catch (_) { return null; }
}
async function saveSetting(key, value) {
    if (!db) return;
    try { await idbPut('settings', { key, value }); } catch (_) {}
}
async function deleteSetting(key) {
    if (!db) return;
    try { await idbDelete('settings', key); } catch (_) {}
}

// ==================== ХЕНДЛ ПАПКИ ====================
async function saveFolderHandle(h) { return saveSetting('folderHandle', h); }
async function loadFolderHandle()  { return loadSetting('folderHandle'); }

async function ensureFolderPermission(handle, mode) {
    if (!handle) return false;
    try {
        let perm = await handle.queryPermission({ mode });
        if (perm === 'granted') return true;
        perm = await handle.requestPermission({ mode });
        return perm === 'granted';
    } catch (_) { return false; }
}

async function restoreFolderHandle() {
    if (!HAS_FS_ACCESS) return false;
    try {
        const h = await loadFolderHandle();
        if (!h) return false;
        selectedFolderHandle = h;
        folderStatus.textContent = 'Папка: ' + h.name;
        const perm = await h.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
            folderStatus.textContent = 'Папка: ' + h.name + ' (нужно разрешение)';
            return false;
        }
        return true;
    } catch (_) { return false; }
}

async function selectFolder() {
    if (HAS_FS_ACCESS) {
        try {
            const newHandle = await window.showDirectoryPicker();
            const oldName = selectedFolderHandle?.name;
            selectedFolderHandle = newHandle;
            folderStatus.textContent = 'Папка: ' + newHandle.name;
            localStorage.setItem('selectedFolderName', newHandle.name);
            await saveFolderHandle(newHandle);
            if (oldName && oldName !== newHandle.name) {
                console.log('[sync] папка изменилась:', oldName, '→', newHandle.name);
            }
            syncFolderWithCloudEnsured('manual-select');
        } catch (err) {
            if (err.name !== 'AbortError') console.error(err);
        }
    } else {
        if (!folderInput) { alert('Браузер не поддерживает выбор папки.'); return; }
        folderInput.value = '';
        folderInput.click();
    }
}

// ==================== SUPABASE ====================
function initSupabase() {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabaseClient.auth.getSession().then(({ data }) => {
        if (data?.session) { currentUser = data.session.user; updateAuthUI(); }
        else showAuthModal('signin');
    });
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        updateAuthUI();
        if (event === 'SIGNED_OUT') showAuthModal('signin');
        if (event === 'SIGNED_IN') setTimeout(() => {
            syncFolderWithCloudEnsured('signed-in');
        }, 800);
    });
}
async function signIn(email, password) { const { error } = await supabaseClient.auth.signInWithPassword({ email, password }); if (error) alert('Ошибка: ' + error.message); else document.getElementById('auth-modal').style.display = 'none'; }
async function signUp(email, password, fullName) { const { error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: fullName } } }); if (error) alert('Ошибка: ' + error.message); else document.getElementById('auth-modal').style.display = 'none'; }
async function signOut() { await supabaseClient.auth.signOut(); }
function updateAuthUI() {
    if (currentUser) {
        if (!ADMIN_EMAILS.includes(currentUser.email)) { window.location.href = 'user.html'; return; }
        btnAuth.textContent = 'Выйти';
        userEmailSpan.textContent = currentUser.email;
        document.getElementById('main-layout').style.display = 'flex';
        setTimeout(() => { syncFolderWithCloudEnsured('auth-ui'); }, 800);
    } else {
        btnAuth.textContent = 'Войти';
        userEmailSpan.textContent = '';
        document.getElementById('main-layout').style.display = 'none';
    }
}
function showAuthModal(mode) {
    authMode = mode;
    const t = document.getElementById('auth-title'), nl = document.getElementById('auth-name-label'), ni = document.getElementById('auth-name'), tb = document.getElementById('auth-toggle'), sb = document.getElementById('auth-submit');
    if (mode === 'signin') {
        t.textContent = 'Вход'; nl.style.display = 'none'; ni.style.display = 'none';
        tb.textContent = 'Нет аккаунта? Регистрация'; sb.textContent = 'Войти';
    } else {
        t.textContent = 'Регистрация'; nl.style.display = 'block'; ni.style.display = 'block';
        tb.textContent = 'Уже есть аккаунт? Войти'; sb.textContent = 'Зарегистрироваться';
    }
    document.getElementById('auth-modal').style.display = 'flex';
}

// ==================== CLOUD SYNC (multi-file) ====================
let _syncInFlight = false;
let _autoSyncInFlight = false;
let _autoSyncRetryTimer = null;

function getSyncStatusEl() {
    let el = document.getElementById('sync-status');
    if (!el) {
        el = document.createElement('span');
        el.id = 'sync-status';
        el.className = 'status-chip';
        el.style.display = 'none';
        const headerRight = document.querySelector('.header-right');
        if (headerRight) headerRight.appendChild(el);
    }
    return el;
}
function setSyncStatus(state, text) {
    const el = getSyncStatusEl();
    if (!el) return;
    if (state === 'hidden') { el.style.display = 'none'; return; }
    el.style.display = 'inline-flex';
    el.textContent = text || '';
    el.style.color = ({ok:'#22c55e', busy:'#38bdf8', warn:'#f59e0b', err:'#ef4444'}[state]) || '#aaa';
}

function buildScenarioPayloadFromCurrent() {
    return {
        scenarioKey: window._currentScenarioKey || generateScenarioKey(),
        trainingType: trainingNode?.params?.trainingType || 'single',
        graph: {
            nodes: JSON.parse(JSON.stringify(nodes || [])),
            connections: JSON.parse(JSON.stringify(connections || [])),
            books: JSON.parse(JSON.stringify(window._books || {}))
        },
        distances: {
            general: generalDistance, reading: readingDistance,
            incTol: distanceToleranceIncreasePct,
            decTol: distanceToleranceDecreasePct,
            timeout: distanceRestoreTimeoutSec
        },
        blink: {
            enabled: blinkEnabled, threshold: blinkThreshold,
            minRate: blinkMinRate, window: blinkWindowSec, lockShow: blinkLockShow
        }
    };
}

async function pushScenarioToCloud(payload, opts) {
    opts = opts || {};
    if (!supabaseClient || !currentUser) return { ok: false, reason: 'no-auth' };
    if (!navigator.onLine) return { ok: false, reason: 'offline' };

    const key = payload.scenarioKey || generateScenarioKey();
    payload.scenarioKey = key;
    const name = opts.name || ('Сценарий ' + new Date().toLocaleString('ru-RU'));

    const cloudParams = JSON.parse(JSON.stringify(payload));
    delete cloudParams.scenarioKey;
    delete cloudParams.trainingType;

    const row = {
        name,
        training_type: payload.trainingType || 'single',
        params: cloudParams,
        created_by: currentUser.id,
        scenario_key: key,
        updated_at: new Date().toISOString()
    };

    try {
        const { data: found } = await supabaseClient
            .from('scenarios').select('id').eq('scenario_key', key).limit(1);

        if (found && found.length) {
            const { error } = await supabaseClient
                .from('scenarios')
                .update({ name, training_type: row.training_type, params: row.params, updated_at: row.updated_at })
                .eq('id', found[0].id);
            if (error) return { ok: false, reason: error.message };
            return { ok: true, id: found[0].id, name, updated: true };
        } else {
            const { data, error } = await supabaseClient
                .from('scenarios')
                .insert([{ ...row, created_at: new Date().toISOString() }])
                .select().single();
            if (error) return { ok: false, reason: error.message };
            return { ok: true, id: data.id, name, updated: false };
        }
    } catch (e) {
        return { ok: false, reason: String(e) };
    }
}

async function deleteScenarioFromCloud(scenarioKey) {
    if (!supabaseClient || !currentUser) return { ok: false, reason: 'no-auth' };
    if (!navigator.onLine) return { ok: false, reason: 'offline' };
    try {
        const { error } = await supabaseClient
            .from('scenarios').delete().eq('scenario_key', scenarioKey);
        if (error) return { ok: false, reason: error.message };
        return { ok: true };
    } catch (e) { return { ok: false, reason: String(e) }; }
}

async function processSyncEntries(entries, folderName) {
    const currentFiles = new Map();
    for (const { name, text } of entries) {
        try {
            const payload = JSON.parse(text);
            if (!payload || (typeof payload !== 'object')) continue;
            const hasNodes = Array.isArray(payload.nodes) || Array.isArray(payload?.graph?.nodes);
            if (!hasNodes && !payload.scenarioKey) continue;
            if (!payload.scenarioKey) payload.scenarioKey = generateScenarioKey();
            const hash = await sha1(text);
            currentFiles.set(name, { payload, hash, scenarioKey: payload.scenarioKey });
        } catch (_) {
            console.warn('[sync] пропущен файл:', name);
        }
    }

    const presentKeys = new Set([...currentFiles.values()].map(f => f.scenarioKey));

    const allIndex = await idbGetAll('scenarioFileIndex');
    const index = allIndex.filter(e => e.folderName === folderName);
    const indexByFile = new Map(index.map(e => [e.fileName, e]));

    let deletedCount = 0;
    for (const entry of index) {
        const fileStillExists = currentFiles.has(entry.fileName);
        const keyStillPresent = presentKeys.has(entry.scenarioKey);

        if (fileStillExists) {
            const cur = currentFiles.get(entry.fileName);
            if (cur.scenarioKey !== entry.scenarioKey) {
                await idbDelete('scenarioFileIndex', entry.id);
            }
            continue;
        }

        if (!keyStillPresent) {
            const res = await deleteScenarioFromCloud(entry.scenarioKey);
            if (res.ok) deletedCount++;
            await idbDelete('scenarioFileIndex', entry.id);
        } else {
            await idbDelete('scenarioFileIndex', entry.id);
        }
    }

    let pushedCount = 0;
    for (const [fileName, info] of currentFiles) {
        const entry = indexByFile.get(fileName);
        if (entry && entry.scenarioKey === info.scenarioKey && entry.lastLocalHash === info.hash) {
            continue;
        }
        const prettyName = fileName.replace(/\.json$/i, '');
        const res = await pushScenarioToCloud(info.payload, { name: prettyName });
        if (res.ok) {
            pushedCount++;
            await idbPut('scenarioFileIndex', {
                id: folderName + '/' + fileName,
                folderName,
                fileName,
                scenarioKey: info.scenarioKey,
                lastLocalHash: info.hash,
                cloudId: res.id,
                lastSyncedAt: Date.now()
            });
        } else {
            console.warn('[sync] push error:', fileName, res.reason);
        }
    }

    setSyncStatus('ok', `☁️ ${pushedCount}↑ ${deletedCount}✕`);
    console.log(`[sync] папка «${folderName}»: загружено ${pushedCount}, удалено ${deletedCount}, всего файлов ${currentFiles.size}`);
}

async function syncFolderWithCloud() {
    if (_syncInFlight) return;
    if (!db || !selectedFolderHandle || !supabaseClient || !currentUser) return;
    if (!navigator.onLine) { setSyncStatus('warn', '📡 офлайн'); return; }

    let perm;
    try { perm = await selectedFolderHandle.queryPermission({ mode: 'read' }); }
    catch (_) { perm = 'denied'; }
    if (perm !== 'granted') {
        console.warn('[sync] нет разрешения на чтение папки — синк пропущен');
        setSyncStatus('warn', '📁 нет доступа');
        return;
    }

    _syncInFlight = true;
    try {
        setSyncStatus('busy', '☁️ синк…');
        const folderName = selectedFolderHandle.name;
        const entries = [];
        try {
            for await (const [name, handle] of selectedFolderHandle.entries()) {
                if (handle.kind !== 'file') continue;
                if (!/\.json$/i.test(name)) continue;
                try {
                    const file = await handle.getFile();
                    entries.push({ name, text: await file.text() });
                } catch (_) {
                    console.warn('[sync] пропущен файл:', name);
                }
            }
        } catch (e) {
            console.error('[sync] обход папки:', e);
            setSyncStatus('err', '☁️ ошибка');
            return;
        }
        await processSyncEntries(entries, folderName);
    } catch (e) {
        console.error('[sync]', e);
        setSyncStatus('err', '☁️ ошибка');
    } finally {
        _syncInFlight = false;
    }
}

async function syncFromFileList(fileList) {
    if (_syncInFlight) return;
    if (!db || !supabaseClient || !currentUser) return;
    if (!navigator.onLine) { setSyncStatus('warn', '📡 офлайн'); return; }

    const files = Array.from(fileList || []).filter(f => /\.json$/i.test(f.name));
    if (!files.length) { alert('В выбранной папке нет .json-файлов.'); return; }

    const rel = files[0].webkitRelativePath || '';
    const folderName = rel.split('/')[0] || 'folder';
    localStorage.setItem('selectedFolderName', folderName);
    folderStatus.textContent = 'Папка: ' + folderName;

    _syncInFlight = true;
    try {
        setSyncStatus('busy', '☁️ синк…');
        const entries = await Promise.all(files.map(async f => ({ name: f.name, text: await f.text() })));
        await processSyncEntries(entries, folderName);
    } catch (e) {
        console.error('[sync] fallback:', e);
        setSyncStatus('err', '☁️ ошибка');
    } finally {
        _syncInFlight = false;
    }
}

async function syncFolderWithCloudEnsured(reason) {
    if (_autoSyncInFlight) return;
    if (!navigator.onLine) { setSyncStatus('warn', '📡 офлайн'); return; }
    if (!supabaseClient || !currentUser) return;
    if (!db) { scheduleAutoSyncRetry(reason, 2000); return; }

    if (HAS_FS_ACCESS) {
        if (!selectedFolderHandle) await restoreFolderHandle();
        if (!selectedFolderHandle) return;

        let perm;
        try { perm = await selectedFolderHandle.queryPermission({ mode: 'read' }); }
        catch (_) { perm = 'denied'; }

        if (perm === 'prompt') { showFolderAccessBanner(reason); return; }
        if (perm !== 'granted') { setSyncStatus('warn', '📁 нет доступа'); return; }

        _autoSyncInFlight = true;
        try { await syncFolderWithCloud(); } finally { _autoSyncInFlight = false; }
    } else {
        showManualSyncBanner(reason);
    }
}

function scheduleAutoSyncRetry(reason, delay) {
    if (_autoSyncRetryTimer) return;
    _autoSyncRetryTimer = setTimeout(() => {
        _autoSyncRetryTimer = null;
        syncFolderWithCloudEnsured(reason + ' (retry)');
    }, delay);
}

function showFolderAccessBanner(reason) {
    if (document.getElementById('folder-access-banner')) return;
    const el = document.createElement('div');
    el.id = 'folder-access-banner';
    el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#0ea5e9;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;z-index:10001;display:flex;gap:10px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,0.4);font-family:"Segoe UI",Tahoma,sans-serif;max-width:92vw;flex-wrap:wrap;';
    el.innerHTML = '<span>☁️ Разрешите доступ к папке — синхронизируем сценарии в облако</span>' +
        '<button id="fab-allow" style="background:#fff;color:#0ea5e9;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-weight:bold;font-family:inherit;">Разрешить</button>' +
        '<button id="fab-later" style="background:transparent;color:#fff;border:1px solid #fff;border-radius:4px;padding:5px 10px;cursor:pointer;font-family:inherit;">Позже</button>';
    el.querySelector('#fab-allow').addEventListener('click', async () => {
        try {
            const res = await selectedFolderHandle.requestPermission({ mode: 'readwrite' });
            if (res === 'granted') {
                el.remove();
                await syncFolderWithCloudEnsured('user-granted');
            } else {
                setSyncStatus('warn', '📁 доступ отклонён');
            }
        } catch (e) { console.error('[sync] requestPermission:', e); }
    });
    el.querySelector('#fab-later').addEventListener('click', () => el.remove());
    document.body.appendChild(el);
}

function showManualSyncBanner(reason) {
    if (document.getElementById('manual-sync-banner')) return;
    const el = document.createElement('div');
    el.id = 'manual-sync-banner';
    el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#0ea5e9;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;z-index:10001;display:flex;gap:10px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,0.4);font-family:"Segoe UI",Tahoma,sans-serif;max-width:92vw;flex-wrap:wrap;';
    el.innerHTML = '<span>☁️ Синхронизировать сценарии с облаком? Выберите папку.</span>' +
        '<button id="msb-sync" style="background:#fff;color:#0ea5e9;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-weight:bold;font-family:inherit;">Выбрать папку</button>' +
        '<button id="msb-later" style="background:transparent;color:#fff;border:1px solid #fff;border-radius:4px;padding:5px 10px;cursor:pointer;font-family:inherit;">Позже</button>';
    el.querySelector('#msb-sync').addEventListener('click', () => {
        el.remove();
        if (folderInput) { folderInput.value = ''; folderInput.click(); }
    });
    el.querySelector('#msb-later').addEventListener('click', () => el.remove());
    document.body.appendChild(el);
}

// ==================== КАМЕРА ====================
async function loadFaceApiModels() { const M = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'; await faceapi.nets.tinyFaceDetector.loadFromUri(M); await faceapi.nets.faceLandmark68Net.loadFromUri(M); }
async function enableCamera() {
    if (cameraActive) return;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } });
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
    } catch (err) { alert('Ошибка камеры: ' + err.message); }
}
async function disableCamera() {
    if (videoFrameId) { cancelAnimationFrame(videoFrameId); videoFrameId = null; }
    if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; }
    document.getElementById('hidden-video').srcObject = null;
    cameraActive = false;
    document.getElementById('camera-status').textContent = 'Камера выключена';
    const fs = document.getElementById('face-status'); fs.textContent = '—'; fs.className = 'face-missing';
    document.getElementById('distance-display').textContent = '—';
    btnCalibrate.disabled = true;
    const bc = document.getElementById('btn-calibrate-blink'); if (bc) bc.disabled = true;
    btnEnableCamera.style.display = 'inline-block';
    btnDisableCamera.style.display = 'none';
    hideLiveDistanceIndicator(); hideDistanceWarning(); hideBlinkWarning();
}

function recalcSizesForNewDistance() {
    if (currentDistanceMeters == null || !isFinite(currentDistanceMeters)) return;
    _distanceBaseline = currentDistanceMeters; _distanceOutOfBoundsSince = 0; hideDistanceWarning();
    if (!playerRunning) return;
    if (currentPlayingNodeId) {
        const node = getNode(currentPlayingNodeId);
        if (node && node.nodeType === 'STIMULUS') {
            const ppi = node.stimPPI || screenPPI || 96;
            const ns = acuityToSizePx(nodeAcuityCurrent, currentDistanceMeters, ppi);
            currentSize = ns;
            const svg = stimDisplay.querySelector('svg');
            if (svg) { svg.setAttribute('width', ns); svg.setAttribute('height', ns); svg.setAttribute('viewBox', `0 0 ${ns} ${ns}`); }
        }
        return;
    }
    if (trainingNode?.params?.trainingType === 'single') {
        currentSize = acuityToSizePx(currentAcuity, currentDistanceMeters, screenPPI);
        const svg = stimDisplay.querySelector('svg');
        if (svg) { svg.setAttribute('width', currentSize); svg.setAttribute('height', currentSize); svg.setAttribute('viewBox', `0 0 ${currentSize} ${currentSize}`); }
        return;
    }
    if (readingViewportEl && readingViewportEl.style.display === 'block' && readingContentEl) {
        const node = readingCurrentNode || getNode(window._currentReadingNodeId);
        const V = node?.readingAcuity || currentAcuity || 1.0;
        const ppi = node?.readingPPI || screenPPI || 96;
        readingContentEl.style.fontSize = acuityToFontSizePx(V, currentDistanceMeters, ppi) + 'px';
        setTimeout(() => { setupReadingColumns(); readingTotalPages = calcReadingTotalPages(); scrollReadingToPage(readingPage); }, 60);
    }
}

async function processVideoFrame() {
    if (!cameraActive) { videoFrameId = null; return; }
    const v = document.getElementById('hidden-video');
    if (v.readyState >= 2 && v.videoWidth > 0 && !v.paused) {
        try {
            const det = await faceapi.detectSingleFace(v, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
            const faceStatus = document.getElementById('face-status');
            const calibInd = document.getElementById('calib-face-indicator');
            if (det && det.landmarks) {
                const le = det.landmarks.getLeftEye(), re = det.landmarks.getRightEye();
                const lc = { x: (le[0].x + le[3].x) / 2, y: (le[0].y + le[3].y) / 2 };
                const rc = { x: (re[0].x + re[3].x) / 2, y: (re[0].y + re[3].y) / 2 };
                const ipd = Math.sqrt((rc.x - lc.x) ** 2 + (rc.y - lc.y) ** 2);
                lastEyeDistancePx = ipd;
                faceStatus.textContent = '✅ Лицо'; faceStatus.className = 'face-detected';
                if (calibInd) { calibInd.textContent = '✅ Лицо'; calibInd.className = 'calib-face-indicator detected'; }
                const earL = computeEAR(le), earR = computeEAR(re);
                processBlinkFrame(earL, earR);
                if (ipd > 0 && focalLengthPx) {
                    currentDistanceMeters = ((realIPD_MM * focalLengthPx) / ipd) / 1000;
                    document.getElementById('distance-display').textContent = currentDistanceMeters.toFixed(2) + ' м';
                    if (distanceMin === null || currentDistanceMeters < distanceMin) distanceMin = currentDistanceMeters;
                    if (distanceMax === null || currentDistanceMeters > distanceMax) distanceMax = currentDistanceMeters;
                    distanceSum += currentDistanceMeters; distanceCount++;
                    const now = performance.now();
                    if (now - distanceLastUpdate > 1000) { distanceLog.push({ time: new Date().toISOString(), meters: currentDistanceMeters }); if (distanceLog.length > MAX_DISTANCE_LOG) distanceLog.splice(0, distanceLog.length - MAX_DISTANCE_LOG); distanceLastUpdate = now; }
                    if (playerRunning) updateLiveDistanceIndicator();
                    if (playerRunning && !isPaused) {
                        setDistanceBaselineIfNeeded();
                        const state = evaluateDistanceDeviation();
                        if (state === 'ok') { _distanceOutOfBoundsSince = 0; if (_distanceWarningKind) hideDistanceWarning(); _distanceRecalcScheduled = false; }
                        else {
                            if (_distanceWarningKind !== state) { showDistanceWarning(state); _distanceWarningKind = state; _distanceOutOfBoundsSince = performance.now(); _distanceRecalcScheduled = false; }
                            const el = (performance.now() - _distanceOutOfBoundsSince) / 1000;
                            if (distanceRestoreTimeoutSec > 0 && el >= distanceRestoreTimeoutSec && !_distanceRecalcScheduled) { _distanceRecalcScheduled = true; recalcSizesForNewDistance(); }
                        }
                    }
                } else { document.getElementById('distance-display').textContent = focalLengthPx ? '—' : 'Требуется калибровка'; }
            } else {
                faceStatus.textContent = '❌ Нет лица'; faceStatus.className = 'face-missing';
                if (calibInd) { calibInd.textContent = '❌ Нет лица'; calibInd.className = 'calib-face-indicator missing'; }
                document.getElementById('distance-display').textContent = '—';
                _blinkState.isClosed = false; _blinkState.closeStartMs = 0;
            }
        } catch (e) { console.error(e); }
    }
    if (cameraActive) videoFrameId = requestAnimationFrame(processVideoFrame); else videoFrameId = null;
}
function openCalibrationModal() { if (!cameraActive) { alert('Включите камеру'); return; } document.getElementById('calibration-video').srcObject = videoStream; document.getElementById('calibration-modal').style.display = 'flex'; }
function calibrateFocalLength() { if (!cameraActive) { alert('Камера не включена'); return; } if (!lastEyeDistancePx) { alert('Лицо не найдено'); return; } const cm = parseFloat(document.getElementById('calib-distance').value); if (isNaN(cm) || cm <= 0) { alert('Неверное расстояние'); return; } focalLengthPx = (lastEyeDistancePx * cm * 10) / realIPD_MM; localStorage.setItem('focalLengthPx', focalLengthPx); alert('Калибровка камеры завершена!'); document.getElementById('calibration-modal').style.display = 'none'; }

// ==================== SVG-СТИМУЛЫ ====================
function generateLetterE(size, r, g, b, angle = 0) { const t = size / 5; const path = `M 0 0 H ${size} V ${t} H ${t} V ${2*t} H ${size - t} V ${3*t} H ${t} V ${4*t} H ${size} V ${size} H 0 Z`; return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><g transform="rotate(${angle}, ${size/2}, ${size/2})"><path d="${path}" fill="rgb(${r},${g},${b})"/></g></svg>`; }
function generateLandoltRing(diameter, gapDirection, r, g, b, bgR, bgG, bgB) { const sw = diameter * 0.2, gw = diameter * 0.2, gl = diameter * 0.23, sm = Math.max(1, sw * 0.1); const or_ = diameter / 2, cx = diameter / 2, cy = diameter / 2; let rx, ry, rw, rh; if (gapDirection === 'вверх' || gapDirection === 'вниз') { rw = gw; rh = gl + sm; rx = cx - rw / 2; ry = gapDirection === 'вверх' ? cy - or_ - sm : cy + or_ - rh + sm; } else { rw = gl + sm; rh = gw; ry = cy - rh / 2; rx = gapDirection === 'вправо' ? cx + or_ - rw + sm : cx - or_ - sm; } return `<svg width="${diameter}" height="${diameter}" viewBox="0 0 ${diameter} ${diameter}" xmlns="http://www.w3.org/2000/svg"><circle cx="${cx}" cy="${cy}" r="${or_ - sw/2}" fill="none" stroke="rgb(${r},${g},${b})" stroke-width="${sw}"/><rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="rgb(${bgR},${bgG},${bgB})"/></svg>`; }

function getCircleStimulusSVG(node, size) {
    const uid = 'cg_' + Math.random().toString(36).slice(2, 8);
    const cx = size / 2, cy = size / 2, r = size / 2;
    const innerEnabled = node.circleInnerEnabled !== false;
    const outerEnabled = node.circleOuterEnabled !== false;
    const innerR = Math.max(5, Math.min(95, node.circleInnerRadiusPct ?? 40));
    const innerFr = innerR / 100;
    const iA = node.circleInnerColor1 || { r: 255, g: 0, b: 0 };
    const iB = node.circleInnerColor2 || { r: 0, g: 0, b: 255 };
    const iMid = node.circleInnerMidEnabled ? (node.circleInnerColor3 || { r: 255, g: 255, b: 0 }) : null;
    const innerStops = [];
    if (iMid) {
        innerStops.push(`<stop offset="0%" stop-color="rgb(${iA.r},${iA.g},${iA.b})"/>`);
        innerStops.push(`<stop offset="50%" stop-color="rgb(${iMid.r},${iMid.g},${iMid.b})"/>`);
        innerStops.push(`<stop offset="100%" stop-color="rgb(${iB.r},${iB.g},${iB.b})"/>`);
    } else {
        innerStops.push(`<stop offset="0%" stop-color="rgb(${iA.r},${iA.g},${iA.b})"/>`);
        innerStops.push(`<stop offset="100%" stop-color="rgb(${iB.r},${iB.g},${iB.b})"/>`);
    }
    const oA = node.circleOuterColor1 || { r: 0, g: 255, b: 0 };
    const oB = node.circleOuterColor2 || { r: 0, g: 128, b: 255 };
    const oMid = node.circleOuterMidEnabled ? (node.circleOuterColor3 || { r: 0, g: 255, b: 255 }) : null;
    const outerStops = [];
    outerStops.push(`<stop offset="0%" stop-color="rgb(${oA.r},${oA.g},${oA.b})" stop-opacity="0"/>`);
    outerStops.push(`<stop offset="${innerR}%" stop-color="rgb(${oA.r},${oA.g},${oA.b})" stop-opacity="1"/>`);
    if (oMid) outerStops.push(`<stop offset="${(innerR + 100) / 2}%" stop-color="rgb(${oMid.r},${oMid.g},${oMid.b})"/>`);
    outerStops.push(`<stop offset="100%" stop-color="rgb(${oB.r},${oB.g},${oB.b})"/>`);
    const innerCircle = innerEnabled ? `<circle cx="${cx}" cy="${cy}" r="${r * innerFr}" fill="url(#${uid}_i)"/>` : '';
    const outerCircle = outerEnabled ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${uid}_o)"/>` : '';
    const html = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${uid}_o" cx="50%" cy="50%" r="50%">${outerStops.join('')}</radialGradient><radialGradient id="${uid}_i" cx="50%" cy="50%" r="50%">${innerStops.join('')}</radialGradient></defs>${outerCircle}${innerCircle}</svg>`;
    return { html, bgColor: `rgb(${node.bgR || 0},${node.bgG || 0},${node.bgB || 0})`, size, uid, innerR, outerEnabled, innerEnabled };
}

function getStimulusSVG(node, size) {
    if (node.singleCircleEnabled) return getCircleStimulusSVG(node, size);
    const r = node.stimR || 255, g = node.stimG || 255, b = node.stimB || 255;
    let html;
    if (node.stimType === 'LANDOLT') html = generateLandoltRing(size, node.stimDirection || 'вверх', r, g, b, node.bgR || 0, node.bgG || 0, node.bgB || 0);
    else { const am = { 'вверх': 270, 'вправо': 0, 'вниз': 90, 'влево': 180 }; html = generateLetterE(size, r, g, b, am[node.stimDirection] || 0); }
    return { html, bgColor: `rgb(${node.bgR || 0},${node.bgG || 0},${node.bgB || 0})`, size };
}
function setStimColorRGB(r, g, b) { if (!stimDisplay) return; const svg = stimDisplay.querySelector('svg'); if (!svg) return; const color = `rgb(${r},${g},${b})`; const p = svg.querySelector('path'); if (p) p.setAttribute('fill', color); const c = svg.querySelector('circle'); if (c) c.setAttribute('stroke', color); }

let _circleAnimId = null, _circleAnimStart = null;
let _circleInnerPhases = null, _circleOuterPhases = null;
let _circleInnerDurationMs = 10000, _circleOuterDurationMs = 10000;
let _circleInnerLoop = true, _circleOuterLoop = true;

function buildCirclePhases(colorA, midEnabled, colorMid, colorB, reverse) {
    let base;
    if (midEnabled && colorMid) base = [{ from: colorA, to: colorMid }, { from: colorMid, to: colorB }];
    else base = [{ from: colorA, to: colorB }];
    if (reverse === true) return base.concat(base.slice().reverse().map(ph => ({ from: ph.to, to: ph.from })));
    return base;
}

function startCircleAnimation(node) {
    stopCircleAnimation();
    if (!stimDisplay) return;
    const svg = stimDisplay.querySelector('svg'); if (!svg) return;
    const grads = svg.querySelectorAll('radialGradient');
    if (grads.length < 2) return;
    const outerGrad = grads[0], innerGrad = grads[1];
    _circleInnerPhases = buildCirclePhases(node.circleInnerColor1, node.circleInnerMidEnabled, node.circleInnerColor3, node.circleInnerColor2, node.circleInnerReverse);
    _circleOuterPhases = buildCirclePhases(node.circleOuterColor1, node.circleOuterMidEnabled, node.circleOuterColor3, node.circleOuterColor2, node.circleOuterReverse);
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
        const pp = Math.max(0, Math.min(1, (t * count) - pi));
        const ph = phases[pi]; if (!ph) return;
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
        if (!playerRunning || isPaused) { _circleAnimId = null; return; }
        if (_circleAnimStart === null) _circleAnimStart = now;
        const elapsed = now - _circleAnimStart;
        const innerDone = !_circleInnerLoop && elapsed > _circleInnerDurationMs;
        const outerDone = !_circleOuterLoop && elapsed > _circleOuterDurationMs;
        if (innerDone && outerDone) { _circleAnimId = null; return; }
        if (!innerDone) paintGradient(innerGrad, _circleInnerPhases, _circleInnerDurationMs, elapsed);
        if (!outerDone) paintGradient(outerGrad, _circleOuterPhases, _circleOuterDurationMs, elapsed);
        _circleAnimId = requestAnimationFrame(tick);
    }
    _circleAnimId = requestAnimationFrame(tick);
}
function stopCircleAnimation() { if (_circleAnimId) { cancelAnimationFrame(_circleAnimId); _circleAnimId = null; } _circleInnerPhases = null; _circleOuterPhases = null; }

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
function clearPeripheralLayer() { const layer = document.getElementById('peri-layer'); if (layer) layer.innerHTML = ''; }
function stopPeripheralAnimation() { if (_periAnimId) { cancelAnimationFrame(_periAnimId); _periAnimId = null; } _periAnimStart = null; clearPeripheralLayer(); }
function buildPeripheralDots(node, stimSize) {
    clearPeripheralLayer();
    if (!node.periEnabled) return;
    const layer = getPeripheralLayer();
    const aw = stimArea.clientWidth, ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    const count = Math.max(1, Math.min(12, node.periCount || 4));
    const dCalc = currentDistanceMeters || node.stimDistance || 1;
    const pCalc = node.stimPPI || screenPPI || 96;
    const sizePx = acuityToSizePx(node.periAcuity || 0.3, dCalc, pCalc);
    const half = Math.min(aw, ah) / 2;
    const rMin = (node.periRadiusMinPct ?? 60) / 100 * half;
    const rMax = (node.periRadiusMaxPct ?? 90) / 100 * half;
    const color = node.periColor || { r: 0, g: 255, b: 100 };
    const colorStr = `rgb(${color.r},${color.g},${color.b})`;
    const baseAngles = [];
    for (let i = 0; i < count; i++) baseAngles.push(node.periRandomAngles ? Math.random() * Math.PI * 2 : (i / count) * Math.PI * 2);
    const radii = baseAngles.map(() => rMin + Math.random() * (rMax - rMin));
    const cx = aw / 2, cy = ah / 2;
    function drawAt(t) {
        layer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            let angle = baseAngles[i];
            let scale = 1;
            if (node.periMotion === 'rotate') {
                const speed = Math.max(0.02, Math.min(2, node.periSpeed || 0.3));
                angle += t / 1000 * speed * Math.PI * 2;
            } else if (node.periMotion === 'pulse') {
                const speed = Math.max(0.5, Math.min(5, node.periSpeed || 1));
                scale = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(angle * 3 + t / 1000 * speed * Math.PI * 2));
            }
            const x = cx + Math.cos(angle) * radii[i];
            const y = cy + Math.sin(angle) * radii[i];
            const d = document.createElement('div');
            const s = Math.max(2, sizePx * scale);
            d.style.cssText = `position:absolute;left:${x - s/2}px;top:${y - s/2}px;width:${s}px;height:${s}px;border-radius:50%;background:${colorStr};box-shadow:0 0 6px rgba(0,0,0,0.4);`;
            layer.appendChild(d);
        }
    }
    drawAt(0);
    if (node.periMotion === 'static') return;
    _periAnimStart = null;
    function tick(now) {
        if (!playerRunning || isPaused) { _periAnimId = null; return; }
        if (_periAnimStart === null) _periAnimStart = now;
        drawAt(now - _periAnimStart);
        _periAnimId = requestAnimationFrame(tick);
    }
    _periAnimId = requestAnimationFrame(tick);
}

function buildDefocusFrame(node, stimSize, stimHtml, stimDirection) {
    if (!node.dfEnabled) return null;
    const aw = stimArea.clientWidth, ah = stimArea.clientHeight;
    if (aw <= 0 || ah <= 0) return null;
    const pCalc = node.stimPPI || screenPPI || 96;
    const rMm = Math.max(5, node.dfCenterRadiusMm || 13);
    const rPx = Math.round(rMm * pCalc / 25.4 / (window.devicePixelRatio || 1));
    const diameter = rPx * 2;
    const per = node.dfPeriBg || { r: 0, g: 71, b: 171 };
    const cb = node.dfCenterBg || { r: 204, g: 0, b: 0 };
    const sc = node.dfStimColor || { r: 0, g: 0, b: 0 };
    const blur = Math.max(0, Math.min(100, node.dfPeriBlur || 0));
    const periStyle = blur > 0
        ? `radial-gradient(circle at center, rgb(${per.r},${per.g},${per.b}) 0%, rgb(${per.r},${per.g},${per.b}) ${100-blur}%, rgba(${per.r},${per.g},${per.b},0) 100%)`
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

// ==================== УТИЛИТЫ ГРАФА ====================
function generateId() { return 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2,4); }
function getNode(id) { return nodes.find(n => n.id === id); }
function getThreshold(size) { switch(size){ case 4: return 3; case 5: return 4; case 6: return 4; case 7: return 5; case 8: return 6; default: return Math.ceil(size/2); } }
function randomDirection() { const d = ['вверх','вниз','влево','вправо']; return d[Math.floor(Math.random()*d.length)]; }
function canAddConnection(fromId, toId, isLoop) { if (fromId === toId) return isLoop; if (isLoop) return !connections.some(c => ((c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId)) && (c.isLoop || false) === true); return !connections.some(c => c.fromId === fromId && c.toId === toId && (c.isLoop || false) === false); }
function buildPlayQueue() { playQueue = []; if (nodes.length === 0) return; const startNode = nodes.find(n => n.isStart === true) || nodes[0]; const visited = new Set(); function visit(nodeId, connection = null, fromNodeId = null) { if (visited.has(nodeId)) return; visited.add(nodeId); playQueue.push({ nodeId, connection, fromNodeId }); connections.filter(c => c.fromId === nodeId && c.isLoop && c.toId !== nodeId).forEach(loop => { const lim = loop.loopLimit || 1; for (let i = 0; i < lim; i++) { playQueue.push({ nodeId: loop.toId, connection: loop, fromNodeId: nodeId }); playQueue.push({ nodeId: nodeId, connection: loop, fromNodeId: loop.toId }); } }); connections.filter(c => c.fromId === nodeId && !c.isLoop && c.toId !== nodeId).forEach(conn => visit(conn.toId, conn, nodeId)); } visit(startNode.id, null, null); }

// ==================== ФИЗИОЛОГИЧЕСКАЯ ШКАЛА ====================
const PHYSIOLOGICAL_PHASES = [
    { diopters: 0.0, wavelength_nm: 670, name: 'Глубокий карминно-красный', rgb: [180, 0, 0] },
    { diopters: 0.1, wavelength_nm: 648, name: 'Классический красный', rgb: [235, 0, 0] },
    { diopters: 0.2, wavelength_nm: 627, name: 'Алый / насыщенный красный', rgb: [255, 35, 0] },
    { diopters: 0.3, wavelength_nm: 610, name: 'Огненно-оранжевый', rgb: [255, 90, 0] },
    { diopters: 0.4, wavelength_nm: 593, name: 'Оранжево-жёлтый', rgb: [255, 145, 0] },
    { diopters: 0.5, wavelength_nm: 578, name: 'Янтарно-жёлтый', rgb: [215, 215, 0] },
    { diopters: 0.6, wavelength_nm: 564, name: 'Жёлто-зелёный (лайм)', rgb: [155, 245, 0] },
    { diopters: 0.7, wavelength_nm: 551, name: 'Салатовый', rgb: [90, 240, 0] },
    { diopters: 0.8, wavelength_nm: 538, name: 'Изумрудно-зелёный', rgb: [0, 230, 60] },
    { diopters: 0.9, wavelength_nm: 525, name: 'Ярко-зелёный (мятный)', rgb: [0, 235, 110] },
    { diopters: 1.0, wavelength_nm: 511, name: 'Мятно-бирюзовый', rgb: [0, 240, 160] },
    { diopters: 1.1, wavelength_nm: 498, name: 'Морская волна', rgb: [0, 210, 210] },
    { diopters: 1.2, wavelength_nm: 484, name: 'Яркий голубой', rgb: [0, 175, 255] },
    { diopters: 1.3, wavelength_nm: 469, name: 'Васильково-голубой', rgb: [0, 115, 255] },
    { diopters: 1.4, wavelength_nm: 454, name: 'Королевский синий', rgb: [0, 50, 255] },
    { diopters: 1.5, wavelength_nm: 438, name: 'Ультрамарин / тёмно-синий', rgb: [35, 0, 230] },
    { diopters: 1.6, wavelength_nm: 421, name: 'Фиолетово-синий', rgb: [90, 0, 190] }
];

// ==================== ДИНАМИКА ЦВЕТА ====================
function buildGenericDynamicPhases(color1, midEnabled, color3, color2, reverse) { const A = color1 || { r: 255, g: 0, b: 0 }, B = color2 || { r: 0, g: 0, b: 255 }; let base; if (midEnabled && color3) base = [{ from: A, to: color3 }, { from: color3, to: B }]; else base = [{ from: A, to: B }]; if (reverse === true) return base.concat(base.slice().reverse().map(ph => ({ from: ph.to, to: ph.from }))); return base; }
function startSingleStimAnimation(params) { stopSingleStimAnimation(); if (!stimDisplay) return; const phases = buildGenericDynamicPhases(params.singleStimColor1, params.singleStimMidEnabled, params.singleStimColor3, params.singleStimColor2, params.singleStimReverse); const phaseCount = phases.length; if (phaseCount === 0) return; const totalTime = Math.max(200, params.singleStimDuration || 10000); const phaseDuration = totalTime / phaseCount; const shouldLoop = params.singleStimLoop === true; const cycleDurationMs = phaseDuration * phaseCount; const first = phases[0].from; setStimColorRGB(first.r, first.g, first.b); singleStimAnimStart = null; function tick(now) { if (!playerRunning || isPaused) { singleStimAnimId = null; return; } if (singleStimAnimStart === null) singleStimAnimStart = now; let elapsed = Math.max(0, now - singleStimAnimStart); let cycleT = elapsed / cycleDurationMs; if (cycleT >= 1) { if (shouldLoop) { singleStimAnimStart += Math.floor(cycleT) * cycleDurationMs; elapsed = Math.max(0, now - singleStimAnimStart); cycleT = elapsed / cycleDurationMs; } else { const last = phases[phaseCount - 1].to; setStimColorRGB(last.r, last.g, last.b); singleStimAnimId = null; return; } } cycleT = Math.max(0, cycleT); const phaseIdx = Math.max(0, Math.min(phaseCount - 1, Math.floor(cycleT * phaseCount))); const phaseProgress = Math.max(0, Math.min(1, (cycleT * phaseCount) - phaseIdx)); const phase = phases[phaseIdx]; if (!phase) { singleStimAnimId = null; return; } const cur = lerpColor(phase.from, phase.to, phaseProgress); setStimColorRGB(cur.r, cur.g, cur.b); singleStimAnimId = requestAnimationFrame(tick); } singleStimAnimId = requestAnimationFrame(tick); }
function stopSingleStimAnimation() { if (singleStimAnimId) { cancelAnimationFrame(singleStimAnimId); singleStimAnimId = null; } }
function startSingleBgAnimation(params) { stopSingleBgAnimation(); if (!stimArea) return; const phases = buildGenericDynamicPhases(params.singleBgColor1, params.singleBgMidEnabled, params.singleBgColor3, params.singleBgColor2, params.singleBgReverse); const phaseCount = phases.length; if (phaseCount === 0) return; const totalTime = Math.max(200, params.singleBgDuration || 10000); const phaseDuration = totalTime / phaseCount; const shouldLoop = params.singleBgLoop === true; const cycleDurationMs = phaseDuration * phaseCount; const first = phases[0].from; stimArea.style.backgroundColor = `rgb(${first.r},${first.g},${first.b})`; singleBgAnimStart = null; function tick(now) { if (!playerRunning || isPaused) { singleBgAnimId = null; return; } if (singleBgAnimStart === null) singleBgAnimStart = now; let elapsed = Math.max(0, now - singleBgAnimStart); let cycleT = elapsed / cycleDurationMs; if (cycleT >= 1) { if (shouldLoop) { singleBgAnimStart += Math.floor(cycleT) * cycleDurationMs; elapsed = Math.max(0, now - singleBgAnimStart); cycleT = elapsed / cycleDurationMs; } else { const last = phases[phaseCount - 1].to; stimArea.style.backgroundColor = `rgb(${last.r},${last.g},${last.b})`; singleBgAnimId = null; return; } } cycleT = Math.max(0, cycleT); const phaseIdx = Math.max(0, Math.min(phaseCount - 1, Math.floor(cycleT * phaseCount))); const phaseProgress = Math.max(0, Math.min(1, (cycleT * phaseCount) - phaseIdx)); const phase = phases[phaseIdx]; if (!phase) { singleBgAnimId = null; return; } const cur = lerpColor(phase.from, phase.to, phaseProgress); stimArea.style.backgroundColor = `rgb(${cur.r},${cur.g},${cur.b})`; singleBgAnimId = requestAnimationFrame(tick); } singleBgAnimId = requestAnimationFrame(tick); }
function stopSingleBgAnimation() { if (singleBgAnimId) { cancelAnimationFrame(singleBgAnimId); singleBgAnimId = null; } }
function applyRandomStimulusPosition(size) { if (!stimArea || !stimDisplay) return; const aw = stimArea.clientWidth, ah = stimArea.clientHeight; if (aw <= 0 || ah <= 0) return; const p = 20; const dxM = Math.max(0, (aw - size) / 2 - p), dyM = Math.max(0, (ah - size) / 2 - p); if (dxM <= 0 && dyM <= 0) return; const dx = (Math.random() * 2 - 1) * dxM, dy = (Math.random() * 2 - 1) * dyM; const svg = stimDisplay.querySelector('svg'); if (svg) svg.style.transform = `translate(${dx}px, ${dy}px)`; }

// ==================== СЕТКА ОДИНОЧНОГО СТИМУЛА ====================
function removeSingleGridLines() { if (!stimArea) return; stimArea.querySelectorAll('.single-grid-overlay').forEach(el => el.remove()); }
function drawSingleGridLines(gx, gy) { if (!stimArea) return; removeSingleGridLines(); if (gx <= 1 && gy <= 1) return; const o = document.createElement('div'); o.className = 'single-grid-overlay'; o.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;'; const imgs = [], sizes = []; if (gx > 1) { imgs.push('linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px)'); sizes.push(`${100 / gx}% 100%`); } if (gy > 1) { imgs.push('linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)'); sizes.push(`100% ${100 / gy}%`); } o.style.backgroundImage = imgs.join(', '); o.style.backgroundSize = sizes.join(', '); o.style.backgroundRepeat = 'repeat'; if (getComputedStyle(stimArea).position === 'static') stimArea.style.position = 'relative'; stimArea.appendChild(o); }
function applySingleGridPosition(size, gx, gy, row, col, showLines) { if (!stimArea || !stimDisplay) return; const aw = stimArea.clientWidth, ah = stimArea.clientHeight; if (aw <= 0 || ah <= 0) return; gx = Math.max(1, parseInt(gx) || 1); gy = Math.max(1, parseInt(gy) || 1); row = Math.max(0, Math.min(gy - 1, parseInt(row) || 0)); col = Math.max(0, Math.min(gx - 1, parseInt(col) || 0)); const cw = aw / gx, ch = ah / gy; const tx = (col + 0.5) * cw, ty = (row + 0.5) * ch; const dx = tx - aw / 2, dy = ty - ah / 2; const svg = stimDisplay.querySelector('svg'); if (svg) svg.style.transform = `translate(${dx}px, ${dy}px)`; if (showLines) drawSingleGridLines(gx, gy); else removeSingleGridLines(); }
function pickSingleGridCell(gx, gy, randomCell, avoidRepeat, fixedRow, fixedCol, selectedCells) { gx = Math.max(1, parseInt(gx) || 1); gy = Math.max(1, parseInt(gy) || 1); let allowed = []; if (Array.isArray(selectedCells) && selectedCells.length > 0) allowed = selectedCells.filter(c => c && typeof c.row === 'number' && typeof c.col === 'number' && c.row >= 0 && c.row < gy && c.col >= 0 && c.col < gx); if (allowed.length === 0) for (let r = 0; r < gy; r++) for (let c = 0; c < gx; c++) allowed.push({ row: r, col: c }); if (!randomCell) { const wr = Math.max(0, Math.min(gy - 1, parseInt(fixedRow) || 0)), wc = Math.max(0, Math.min(gx - 1, parseInt(fixedCol) || 0)); return allowed.find(c => c.row === wr && c.col === wc) || allowed[0]; } if (allowed.length === 1) return allowed[0]; let cell, attempts = 0; do { cell = allowed[Math.floor(Math.random() * allowed.length)]; attempts++; } while (avoidRepeat && attempts < 25 && cell.row === currentSingleCell.row && cell.col === currentSingleCell.col && allowed.length > 1); return cell; }

// ==================== КНИГИ ====================
function nodeToReadingParams(node) { return { bgMode: node.readingBgMode || 'solid', bgColor: node.readingBgColor || { r: 255, g: 255, b: 255 }, splitLeftWidthPercent: node.readingSplitLeftWidthPercent ?? 50, splitLeftColor: node.readingSplitLeftColor || { r: 0, g: 0, b: 0 }, splitRightColor: node.readingSplitRightColor || { r: 255, g: 255, b: 255 }, gradientMidEnabled: node.readingGradientMidEnabled !== false, gradientLeftColor: node.readingGradientLeftColor || { r: 255, g: 255, b: 255 }, gradientMidColor: node.readingGradientMidColor || { r: 204, g: 204, b: 204 }, gradientMidPosition: node.readingGradientMidPosition ?? 50, gradientRightColor: node.readingGradientRightColor || { r: 0, g: 0, b: 0 }, dynamicMode: node.readingDynamicMode || 'simple', dynamicReverse: node.readingDynamicReverse === true, dynamicMidEnabled: node.readingDynamicMidEnabled === true, dynamicStartColor: node.readingDynamicStartColor || { r: 255, g: 0, b: 0 }, dynamicMidColor: node.readingDynamicMidColor || { r: 255, g: 255, b: 0 }, dynamicEndColor: node.readingDynamicEndColor || { r: 0, g: 0, b: 255 }, dynamicDuration: node.readingDynamicDuration || 10000, dynamicLoop: node.readingDynamicLoop === true, dynamicStep: node.readingDynamicStep || 0.1, dynamicStepDuration: node.readingDynamicStepDuration || 1000, dynamicShowLabel: node.readingDynamicShowLabel !== false }; }

// ==================== СОЗДАНИЕ УЗЛА ====================
function defaultCompareCellParams() { const d = trainingNode?.params?.distanceMeters || generalDistance || 1; const ppi = trainingNode?.params?.ppi || screenPPI || 96; return { size: acuityToSizePx(1.0, d, ppi), acuity: 1.0, distance: d, ppi, stimR: 255, stimG: 255, stimB: 255, bgR: 0, bgG: 0, bgB: 0, duration: 2000 }; }
function createNewNode(type, x, y) {
    const id = generateId();
    const dd = trainingNode?.params?.distanceMeters || generalDistance || 1;
    const dp = trainingNode?.params?.ppi || screenPPI || 96;
    let node;
    if (type === 'READING') {
        node = { id, nodeType: 'READING', x: x || (100 + Math.random()*300), y: y || (100 + Math.random()*200), width: 300, height: 260, name: 'Чтение', bookId: null, bookName: '', continueFromBookmark: true, autoSaveBookmark: true, readingFontFamily: 'Segoe UI', readingFontWeight: 'normal', readingAcuity: 1.0, readingDistance: readingDistance || 1, readingTextColor: { r: 0, g: 0, b: 0 }, readingBgMode: 'solid', readingBgColor: { r: 255, g: 255, b: 255 }, readingSplitLeftWidthPercent: 50, readingSplitLeftColor: { r: 0, g: 0, b: 0 }, readingSplitRightColor: { r: 255, g: 255, b: 255 }, readingGradientMidEnabled: true, readingGradientLeftColor: { r: 255, g: 255, b: 255 }, readingGradientMidColor: { r: 204, g: 204, b: 204 }, readingGradientMidPosition: 50, readingGradientRightColor: { r: 0, g: 0, b: 0 }, readingDynamicMode: 'simple', readingDynamicReverse: false, readingDynamicMidEnabled: false, readingDynamicStartColor: { r: 255, g: 0, b: 0 }, readingDynamicMidColor: { r: 255, g: 255, b: 0 }, readingDynamicEndColor: { r: 0, g: 0, b: 255 }, readingDynamicDuration: 10000, readingDynamicLoop: false, readingDynamicStep: 0.1, readingDynamicStepDuration: 1000, readingDynamicShowLabel: true, duration: 60000, isActive: true, isStart: false };
    } else if (type === 'COMPARE') {
        node = { id, nodeType: 'COMPARE', x: x || (100 + Math.random()*300), y: y || (100 + Math.random()*200), width: 340, height: 320, name: 'Сравнение', compareMode: 'direction', pairsCount: 2, gridX: 3, gridY: 3, activeCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }], cellParams: [defaultCompareCellParams(), defaultCompareCellParams()], seriesCount: 5, seriesSize: 6, seriesThreshold: 4, delay1: 1000, duration: 2000, delay2: 1000, isActive: true, isStart: false };
    } else {
        node = { id, nodeType: type, x: x || (100 + Math.random()*300), y: y || (100 + Math.random()*200), width: 300, height: 300,
            name: type === 'STIMULUS' ? 'Стимул' : (type === 'LOGIC_IF' ? 'Логика' : 'Динамика'),
            stimType: 'LETTER_E', stimDirection: 'вверх', stimR: 255, stimG: 255, stimB: 255, bgR: 11, bgG: 11, bgB: 13,
            stimAcuity: 1.0, endAcuity: 1.0, acuityStep: 0.1, stimDistance: dd, stimPPI: dp, stimSize: 40, stimDirectionFixed: 'вверх',
            seriesCount: 5, seriesSize: 6, seriesThreshold: 4, isActive: true, singleRandomPos: false,
            singleGridEnabled: false, singleGridX: 3, singleGridY: 3, singleGridShowLines: false, singleGridRandomCell: true,
            singleGridAvoidRepeat: true, singleGridFixedRow: 0, singleGridFixedCol: 0, singleGridCells: [],
            singleStimDynamicEnabled: false, singleStimColor1: { r: 255, g: 0, b: 0 }, singleStimMidEnabled: false,
            singleStimColor3: { r: 255, g: 255, b: 0 }, singleStimColor2: { r: 0, g: 0, b: 255 }, singleStimDuration: 10000,
            singleStimLoop: false, singleStimReverse: false,
            singleBgDynamicEnabled: false, singleBgColor1: { r: 255, g: 0, b: 0 }, singleBgMidEnabled: false,
            singleBgColor3: { r: 255, g: 255, b: 0 }, singleBgColor2: { r: 0, g: 0, b: 255 }, singleBgDuration: 10000,
            singleBgLoop: false, singleBgReverse: false,
            singleCircleEnabled: false,
            circleInnerEnabled: true, circleInnerRadiusPct: 40,
            circleInnerColor1: { r: 255, g: 0, b: 0 },
            circleInnerMidEnabled: false, circleInnerColor3: { r: 255, g: 255, b: 0 },
            circleInnerColor2: { r: 0, g: 0, b: 255 },
            circleInnerDuration: 10000, circleInnerLoop: true, circleInnerReverse: false,
            circleOuterEnabled: true,
            circleOuterColor1: { r: 0, g: 255, b: 0 },
            circleOuterMidEnabled: false, circleOuterColor3: { r: 0, g: 255, b: 255 },
            circleOuterColor2: { r: 0, g: 128, b: 255 },
            circleOuterDuration: 10000, circleOuterLoop: true, circleOuterReverse: false,
            periEnabled: false, periCount: 4, periAcuity: 0.3, periRadiusMinPct: 60, periRadiusMaxPct: 90,
            periColor: { r: 0, g: 255, b: 100 }, periMotion: 'static', periSpeed: 0.3, periRandomAngles: true,
            dfEnabled: false, dfCenterRadiusMm: 13, dfCenterBg: { r: 204, g: 0, b: 0 },
            dfStimColor: { r: 0, g: 0, b: 0 }, dfPeriBg: { r: 0, g: 71, b: 171 }, dfPeriBlur: 0,
            blinkEnabled: false,
            blinkColorA: { r: 255, g: 0, b: 0 },
            blinkColorB: { r: 0, g: 0, b: 255 },
            blinkIntervalMs: 500,
            blinkDuty: 0.5,
            blinkCount: 0,
            blinkTarget: 'stim',
            delay1: 1000, duration: 1000, response: 1000, delay2: 1000, isStart: false };
        node.stimSize = getNodeComputedSize(node);
    }
    nodes.push(node); activeNodeId = id; window._pendingGeneratorMode = false;
    requestRenderGraph(); updateInspector();
    inspectorEl.style.display = 'block';
    return id;
}
function deleteNode(id) { nodes = nodes.filter(n => n.id !== id); connections = connections.filter(c => c.fromId !== id && c.toId !== id); if (activeNodeId === id) { activeNodeId = null; inspectorEl.style.display = 'none'; updateInspector(); } if (nodeElements.has(id)) { nodeElements.get(id).remove(); nodeElements.delete(id); } for (const [k, els] of connectionElements) if (k.includes(id)) { els.line.remove(); els.arrow.remove(); connectionElements.delete(k); } if (window._pendingConnectionHandler) { canvas.removeEventListener('click', window._pendingConnectionHandler); window._pendingConnectionHandler = null; clearTempLine(); } requestRenderGraph(); }
function selectNode(id) { activeNodeId = id; window._pendingGeneratorMode = false; inspectorEl.style.display = 'block'; requestRenderGraph(); updateInspector(); }

// ==================== РЕНДЕР ГРАФА ====================
function requestRenderGraph() { if (renderScheduled) return; renderScheduled = true; requestAnimationFrame(() => { renderScheduled = false; renderGraph(); }); }
function renderGraph() {
    if (currentMode === 'stimuli') return;
    nodes.forEach(node => {
        let el = nodeElements.get(node.id);
        if (!el) { el = createNodeElement(node); nodeElements.set(node.id, el); canvas.appendChild(el); }
        else updateNodeElement(el, node);
    });
    const ids = new Set(nodes.map(n => n.id));
    for (const [id, el] of nodeElements) if (!ids.has(id)) { el.remove(); nodeElements.delete(id); }
    const cm = new Map(); connections.forEach(c => cm.set(c.fromId + '_' + c.toId, c));
    for (const [k, els] of connectionElements) if (!cm.has(k)) { els.line.remove(); els.arrow.remove(); connectionElements.delete(k); }
    connections.forEach(c => {
        const k = c.fromId + '_' + c.toId;
        if (!connectionElements.has(k)) { const { line, arrow } = createConnectionElements(c); if (line && arrow) { connectionElements.set(k, { line, arrow }); canvas.appendChild(line); canvas.appendChild(arrow); } }
        else updateConnectionElements(connectionElements.get(k), c);
    });
}
function clearTempLine() { if (tempLineElement) { tempLineElement.remove(); tempLineElement = null; } if (tempLineMoveHandler) { canvas.removeEventListener('mousemove', tempLineMoveHandler); tempLineMoveHandler = null; } }

// ==================== РЕНДЕР УЗЛА ====================
function createNodeElement(node) {
    const el = document.createElement('div');
    el.className = 'scenario-node';
    if (node.nodeType === 'READING') el.classList.add('reading-node');
    if (node.nodeType === 'COMPARE') el.classList.add('compare-node');
    el.dataset.nodeId = node.id;
    el.style.cssText = `left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;`;
    if (node.id === activeNodeId) el.classList.add('active');

    const header = document.createElement('div');
    header.className = 'node-header';
    if (node.nodeType === 'READING') header.classList.add('reading-header');
    if (node.nodeType === 'COMPARE') header.classList.add('compare-header');
    const title = document.createElement('span'); title.textContent = node.name;
    const startCb = document.createElement('input');
    startCb.type = 'checkbox'; startCb.className = 'start-checkbox'; startCb.checked = node.isStart === true;
    startCb.addEventListener('change', (e) => { e.stopPropagation(); if (startCb.checked) { nodes.forEach(n => { if (n.id !== node.id) n.isStart = false; }); node.isStart = true; } else node.isStart = false; requestRenderGraph(); updateInspector(); });
    header.appendChild(title); header.appendChild(startCb); el.appendChild(header);

    const content = document.createElement('div'); content.className = 'node-content';
    if (node.nodeType === 'READING') {
        const p = document.createElement('div'); p.className = 'node-preview-area'; p.style.background = '#0b0b14';
        p.innerHTML = '<div style="text-align:center;"><div class="node-reading-icon">📖</div></div>';
        content.appendChild(p);
        const info = document.createElement('div'); info.className = 'node-info';
        const b = document.createElement('div'); b.className = 'node-reading-book'; info.appendChild(b);
        const d = document.createElement('div'); d.className = 'node-reading-sub'; info.appendChild(d);
        const v = document.createElement('div'); v.className = 'node-reading-sub'; info.appendChild(v);
        const f = document.createElement('div'); f.className = 'node-reading-sub'; info.appendChild(f);
        content.appendChild(info); fillReadingNodeInfo(b, d, v, f, node);
    } else if (node.nodeType === 'COMPARE') {
        const p = document.createElement('div'); p.className = 'node-preview-area'; p.style.background = '#1a0a02';
        p.innerHTML = '<div class="node-compare-icon">⚖️</div>';
        content.appendChild(p);
        const info = document.createElement('div'); info.className = 'node-info';
        const m = document.createElement('div'); m.className = 'node-compare-sub'; info.appendChild(m);
        const g = document.createElement('div'); g.className = 'node-compare-sub'; info.appendChild(g);
        const s = document.createElement('div'); s.className = 'node-compare-sub'; info.appendChild(s);
        const t = document.createElement('div'); t.className = 'node-compare-sub'; info.appendChild(t);
        content.appendChild(info); fillCompareNodeInfo(m, g, s, t, node);
    } else {
        const p = document.createElement('div'); p.className = 'node-preview-area';
        const cs = Math.min(120, getNodeComputedSize(node));
        const { html, bgColor } = getStimulusSVG(node, cs);
        p.style.background = bgColor;
        const c = document.createElement('div');
        c.style.cssText = `width:${cs}px;height:${cs}px;margin:0 auto;`;
        c.innerHTML = html; p.appendChild(c); content.appendChild(p);
        const info = document.createElement('div'); info.className = 'node-info';
        const a = document.createElement('div'); a.className = 'node-acuity'; info.appendChild(a);
        const mm = document.createElement('div'); mm.className = 'node-size-mm'; info.appendChild(mm);
        const px = document.createElement('div'); px.className = 'node-size-px'; info.appendChild(px);
        const dst = document.createElement('div'); dst.className = 'node-distance'; info.appendChild(dst);
        const srs = document.createElement('div'); srs.className = 'node-inherit'; srs.style.color = '#a855f7'; info.appendChild(srs);
        const dyn = document.createElement('div'); dyn.className = 'node-inherit'; dyn.style.color = '#f59e0b'; info.appendChild(dyn);
        content.appendChild(info); fillStimulusNodeInfo(a, mm, px, dst, srs, dyn, node);
    }
    el.appendChild(content);

    const body = document.createElement('div'); body.className = 'node-body';
    const cb = document.createElement('button'); cb.className = 'node-btn btn-node-connect'; cb.textContent = '🔗 Связать';
    cb.addEventListener('click', e => { e.stopPropagation(); startConnection(node.id, false); });
    const lb = document.createElement('button'); lb.className = 'node-btn btn-node-loop'; lb.textContent = '🔄 Петля';
    lb.addEventListener('click', e => { e.stopPropagation(); startConnection(node.id, true); });
    const db = document.createElement('button'); db.className = 'node-btn btn-node-del'; db.textContent = '✕ Удалить';
    db.addEventListener('click', e => { e.stopPropagation(); deleteNode(node.id); });
    body.appendChild(cb); body.appendChild(lb); body.appendChild(db); el.appendChild(body);

    const resize = document.createElement('div'); resize.className = 'node-resize-handle'; el.appendChild(resize);

    header.addEventListener('mousedown', e => { if (e.button !== 0 || window._pendingConnectionHandler) return; dragNodeId = node.id; const r = canvas.getBoundingClientRect(); offsetX = e.clientX - r.left - node.x; offsetY = e.clientY - r.top - node.y; document.removeEventListener('mousemove', onDragMove); document.removeEventListener('mouseup', onDragEnd); document.addEventListener('mousemove', onDragMove); document.addEventListener('mouseup', onDragEnd); });
    resize.addEventListener('mousedown', e => { e.stopPropagation(); resizeNodeId = node.id; startW = node.width; startH = node.height; startMouseX = e.clientX; startMouseY = e.clientY; document.removeEventListener('mousemove', onResizeMove); document.removeEventListener('mouseup', onResizeEnd); document.addEventListener('mousemove', onResizeMove); document.addEventListener('mouseup', onResizeEnd); });
    el.addEventListener('click', e => { if (window._pendingConnectionHandler) return; if (e.target.closest('.node-btn') || e.target.closest('.start-checkbox') || e.target.closest('.node-resize-handle')) return; selectNode(node.id); });
    return el;
}
function fillReadingNodeInfo(b, d, v, f, node) { if (b) { if (node.bookId && window._books[node.bookId]) { b.textContent = `📖 ${node.bookName || '(без имени)'}`; b.style.color = '#7dd3fc'; } else if (node.bookName) { b.textContent = `📖 ${node.bookName} ⚠`; b.style.color = '#f59e0b'; } else { b.textContent = '📖 книга из сессии'; b.style.color = '#94a3b8'; } } if (d) { d.textContent = node.duration > 0 ? `⏱ ${(node.duration/1000).toFixed(0)} с` : '⏱ до кнопки'; d.style.color = '#64748b'; } if (v) { v.textContent = `V = ${(node.readingAcuity || 1.0).toFixed(1)}`; v.style.color = '#64748b'; } if (f) { f.textContent = node.readingFontFamily || 'Segoe UI'; f.style.color = '#64748b'; } }
function fillStimulusNodeInfo(a, mm, px, dst, srs, dyn, node) {
    if (a) { a.textContent = `V = ${(node.stimAcuity || 1.0).toFixed(1)}`; if (node.endAcuity != null && Math.abs(node.endAcuity - node.stimAcuity) > 0.001) a.textContent += `→${node.endAcuity.toFixed(1)}`; }
    if (mm) mm.textContent = `${getNodeComputedSizeMm(node).toFixed(2)} мм`;
    if (px) px.textContent = `≈ ${getNodeComputedSize(node)}px @ ${node.stimPPI || screenPPI || 96} PPI`;
    if (dst) dst.textContent = `📏 ${(node.stimDistance || 1).toFixed(2)} м`;
    if (srs) srs.textContent = `📊 ${node.seriesCount || 5}×${node.seriesSize || 6}`;
    if (dyn) {
        const parts = [];
        if (node.singleCircleEnabled) parts.push('🎯 Круги');
        if (node.periEnabled) parts.push('🟢 Точки');
        if (node.dfEnabled) parts.push('🔴 Дефокус');
        if (node.blinkEnabled) parts.push('🔦 Моргание');
        if (node.singleGridEnabled && !node.singleCircleEnabled) { const cnt = Array.isArray(node.singleGridCells) && node.singleGridCells.length > 0 ? node.singleGridCells.length : (node.singleGridX || 1) * (node.singleGridY || 1); parts.push(`🔲${node.singleGridX || 1}×${node.singleGridY || 1}(${cnt})`); }
        if (node.singleStimDynamicEnabled && !node.singleCircleEnabled) parts.push('🎨');
        if (node.singleBgDynamicEnabled) parts.push('🖼️');
        if (node.singleRandomPos && !node.singleGridEnabled && !node.singleCircleEnabled) parts.push('🎲');
        dyn.textContent = parts.join(' ');
    }
}
function fillCompareNodeInfo(m, g, s, t, node) { if (m) { m.textContent = node.compareMode === 'find_same' ? `🔍 Найти пары ×${node.pairsCount || 2}` : '↔️ Сравнить направления'; m.style.color = '#f97316'; m.style.fontWeight = 'bold'; } if (g) { const n = (node.activeCells || []).length; g.textContent = `🔲 ${node.gridX || 3}×${node.gridY || 3} (${n} кл.)`; } if (s) s.textContent = `📊 ${node.seriesCount || 5}×${node.seriesSize || 6}`; if (t) t.textContent = `⏱ ${((node.duration || 0)/1000).toFixed(1)} с`; }
function updateNodeElement(el, node) {
    el.style.cssText = `left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;`;
    el.querySelector('.node-header span').textContent = node.name;
    el.classList.toggle('active', node.id === activeNodeId);
    el.classList.toggle('reading-node', node.nodeType === 'READING');
    el.classList.toggle('compare-node', node.nodeType === 'COMPARE');
    const sc = el.querySelector('.start-checkbox'); if (sc) sc.checked = node.isStart === true;
    if (node.nodeType === 'READING') { const p = el.querySelector('.node-preview-area'); if (p) p.style.background = '#0b0b14'; const b = el.querySelector('.node-reading-book'); const subs = el.querySelectorAll('.node-reading-sub'); fillReadingNodeInfo(b, subs[0], subs[1], subs[2], node); return; }
    if (node.nodeType === 'COMPARE') { const subs = el.querySelectorAll('.node-compare-sub'); fillCompareNodeInfo(subs[0], subs[1], subs[2], subs[3], node); return; }
    const cs = Math.min(120, getNodeComputedSize(node));
    const p = el.querySelector('.node-preview-area');
    if (p) { const { html, bgColor } = getStimulusSVG(node, cs); p.style.background = bgColor; p.innerHTML = ''; const c = document.createElement('div'); c.style.cssText = `width:${cs}px;height:${cs}px;margin:0 auto;`; c.innerHTML = html; p.appendChild(c); }
    const a = el.querySelector('.node-acuity'), mm = el.querySelector('.node-size-mm'), px = el.querySelector('.node-size-px');
    const dst = el.querySelector('.node-distance'); const inh = el.querySelectorAll('.node-inherit');
    fillStimulusNodeInfo(a, mm, px, dst, inh[0], inh[1], node);
}

// ==================== СОЗДАНИЕ СВЯЗИ ====================
function startConnection(sourceId, isLoop) { if (window._pendingConnectionHandler) { canvas.removeEventListener('click', window._pendingConnectionHandler); clearTempLine(); nodeElements.forEach(el => el.classList.remove('connection-source')); } const handler = ev => { if (ev.target.closest('.node-btn')) return; const tel = ev.target.closest('.scenario-node'); if (!tel) { cancelConnection(); return; } const tid = tel.dataset.nodeId; if (tid === sourceId) { cancelConnection(); return; } if (canAddConnection(sourceId, tid, isLoop)) { connections.push({ fromId: sourceId, toId: tid, isLoop, loopMode: 'TIME', loopLimit: 1, lifeTime: 0, initiateByAnswer: true, condition: 'none', inheritSize: false, inheritSpeed: false }); const nc = connections[connections.length - 1]; cancelConnection(); setTimeout(() => showConnectionMenu({ clientX: ev.clientX, clientY: ev.clientY, preventDefault: () => {}, stopPropagation: () => {} }, nc), 100); } else { alert('Такая связь уже существует или превышен лимит.'); cancelConnection(); } }; window._pendingConnectionHandler = handler; canvas.addEventListener('click', handler); nodeElements.forEach(el => el.classList.remove('connection-source')); nodeElements.get(sourceId)?.classList.add('connection-source'); clearTempLine(); tempLineElement = document.createElement('div'); tempLineElement.id = 'temp-line'; tempLineElement.style.cssText = 'position:absolute;transform-origin:top left;z-index:4;pointer-events:none;height:0;border-top:3px dashed #f59e0b;'; canvas.appendChild(tempLineElement); tempLineMoveHandler = ev => { const r = canvas.getBoundingClientRect(); const mx = ev.clientX - r.left, my = ev.clientY - r.top; const sn = getNode(sourceId); if (!sn) return; const fx = sn.x + sn.width / 2, fy = sn.y + sn.height / 2; const dx = mx - fx, dy = my - fy; const len = Math.sqrt(dx*dx + dy*dy); const ang = Math.atan2(dy, dx) * (180 / Math.PI); tempLineElement.style.width = len + 'px'; tempLineElement.style.left = fx + 'px'; tempLineElement.style.top = fy + 'px'; tempLineElement.style.transform = `rotate(${ang}deg)`; }; canvas.addEventListener('mousemove', tempLineMoveHandler); requestRenderGraph(); }
function cancelConnection() { if (window._pendingConnectionHandler) { canvas.removeEventListener('click', window._pendingConnectionHandler); window._pendingConnectionHandler = null; } clearTempLine(); nodeElements.forEach(el => el.classList.remove('connection-source')); requestRenderGraph(); }

// ==================== РЕНДЕР СВЯЗЕЙ ====================
function getNodeEdgePoint(node, tx, ty) { const cx = node.x + node.width/2, cy = node.y + node.height/2; const dx = tx - cx, dy = ty - cy; if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy }; const s = Math.min((node.width/2)/Math.abs(dx), (node.height/2)/Math.abs(dy)); return { x: cx + dx*s, y: cy + dy*s }; }
function createConnectionElements(conn) {
    const fn = getNode(conn.fromId), tn = getNode(conn.toId);
    if (!fn || !tn) return { line: null, arrow: null };
    if (conn.fromId === conn.toId) { const cx = fn.x + fn.width/2, cy = fn.y + fn.height/2, ls = 30; const div = document.createElement('div'); div.className = 'html-graph-line line-dashed'; div.style.cssText = `left:${cx - ls/2}px;top:${cy - ls/2}px;width:${ls}px;height:${ls}px;border:3px dashed #a855f7;border-radius:50%;position:absolute;z-index:5;pointer-events:auto;cursor:pointer;`; div.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); showConnectionMenu(e, conn); }); const arrow = document.createElement('div'); arrow.className = 'line-arrow loop-arrow'; arrow.textContent = '↻'; arrow.style.cssText = `left:${cx + ls/2 - 5}px;top:${cy + ls/2 - 10}px;color:#a855f7;z-index:1000;cursor:pointer;`; arrow.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); showConnectionMenu(e, conn); }); return { line: div, arrow }; }
    const fp = getNodeEdgePoint(fn, tn.x + tn.width/2, tn.y + tn.height/2);
    const tp = getNodeEdgePoint(tn, fn.x + fn.width/2, fn.y + fn.height/2);
    const dx = tp.x - fp.x, dy = tp.y - fp.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len < 2) return { line: null, arrow: null };
    const ang = Math.atan2(dy, dx) * (180 / Math.PI);
    const isLoop = conn.isLoop || false;
    const color = isLoop ? '#a855f7' : '#10b981';
    const line = document.createElement('div');
    line.className = 'html-graph-line ' + (isLoop ? 'line-dashed' : 'line-solid');
    if (!isLoop) line.style.background = color; else line.style.borderTopColor = color;
    line.style.cssText = `width:${len}px;left:${fp.x}px;top:${fp.y}px;transform:rotate(${ang}deg);pointer-events:auto;cursor:pointer;`;
    line.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); showConnectionMenu(e, conn); });
    const ax = fp.x + (dx/len) * 35 - 10, ay = fp.y + (dy/len) * 35 - 10;
    const arrow = document.createElement('div');
    arrow.className = 'line-arrow' + (isLoop ? ' loop-arrow' : ''); arrow.textContent = '▶';
    arrow.style.cssText = `left:${ax}px;top:${ay}px;color:${color};transform:rotate(${ang}deg);position:absolute;display:flex;align-items:center;justify-content:center;width:20px;height:20px;font-size:16px;z-index:1000;cursor:pointer;pointer-events:auto;`;
    arrow.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); showConnectionMenu(e, conn); });
    return { line, arrow };
}
function updateConnectionElements(els, conn) { const fn = getNode(conn.fromId), tn = getNode(conn.toId); if (!fn || !tn) return; if (conn.fromId === conn.toId) { const cx = fn.x + fn.width/2, cy = fn.y + fn.height/2, ls = 30; els.line.style.left = (cx - ls/2) + 'px'; els.line.style.top = (cy - ls/2) + 'px'; els.arrow.style.left = (cx + ls/2 - 5) + 'px'; els.arrow.style.top = (cy + ls/2 - 10) + 'px'; return; } const fp = getNodeEdgePoint(fn, tn.x + tn.width/2, tn.y + tn.height/2); const tp = getNodeEdgePoint(tn, fn.x + fn.width/2, fn.y + fn.height/2); const dx = tp.x - fp.x, dy = tp.y - fp.y; const len = Math.sqrt(dx*dx + dy*dy); if (len < 2) return; const ang = Math.atan2(dy, dx) * (180 / Math.PI); const isLoop = conn.isLoop || false; const color = isLoop ? '#a855f7' : '#10b981'; els.line.style.width = len + 'px'; els.line.style.left = fp.x + 'px'; els.line.style.top = fp.y + 'px'; els.line.style.transform = `rotate(${ang}deg)`; els.arrow.style.left = (fp.x + (dx/len) * 35 - 10) + 'px'; els.arrow.style.top = (fp.y + (dy/len) * 35 - 10) + 'px'; els.arrow.style.transform = `rotate(${ang}deg)`; els.arrow.style.color = color; }

// ==================== DRAG / RESIZE ====================
function onDragMove(e) { if (!dragNodeId) return; if (e.buttons === 0) { onDragEnd(); return; } const node = getNode(dragNodeId); if (node) { const r = canvas.getBoundingClientRect(); node.x = e.clientX - r.left - offsetX; node.y = e.clientY - r.top - offsetY; updateNodeElement(nodeElements.get(node.id), node); connections.forEach(c => { if (c.fromId === node.id || c.toId === node.id) updateConnectionElements(connectionElements.get(c.fromId + '_' + c.toId), c); }); } }
function onDragEnd() { dragNodeId = null; document.removeEventListener('mousemove', onDragMove); document.removeEventListener('mouseup', onDragEnd); }
function onResizeMove(e) { if (!resizeNodeId) return; if (e.buttons === 0) { onResizeEnd(); return; } const node = getNode(resizeNodeId); if (node) { node.width = Math.max(200, startW + e.clientX - startMouseX); node.height = Math.max(180, startH + e.clientY - startMouseY); updateNodeElement(nodeElements.get(node.id), node); connections.forEach(c => { if (c.fromId === node.id || c.toId === node.id) updateConnectionElements(connectionElements.get(c.fromId + '_' + c.toId), c); }); } }
function onResizeEnd() { resizeNodeId = null; document.removeEventListener('mousemove', onResizeMove); document.removeEventListener('mouseup', onResizeEnd); }

// ==================== МЕНЮ СВЯЗИ ====================
function showConnectionMenu(e, conn) {
    e.preventDefault(); e.stopPropagation();
    currentConnectionForMenu = conn;
    const menu = document.getElementById('connection-menu');
    menu.style.display = 'block'; menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px'; menu.innerHTML = '';
    const title = document.createElement('div'); title.textContent = 'Наследование'; title.style.cssText = 'font-weight:bold;margin-bottom:4px;'; menu.appendChild(title);
    const sL = document.createElement('label'); sL.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:4px;'; const sC = document.createElement('input'); sC.type = 'checkbox'; sC.checked = conn.inheritSize === true; sC.addEventListener('change', ev => { conn.inheritSize = ev.target.checked; requestRenderGraph(); }); sL.appendChild(sC); sL.appendChild(document.createTextNode('Острота зрения (размер)')); menu.appendChild(sL);
    const spL = document.createElement('label'); spL.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:4px;'; const spC = document.createElement('input'); spC.type = 'checkbox'; spC.checked = conn.inheritSpeed === true; spC.addEventListener('change', ev => { conn.inheritSpeed = ev.target.checked; requestRenderGraph(); }); spL.appendChild(spC); spL.appendChild(document.createTextNode('Скорость')); menu.appendChild(spL);
    const hint = document.createElement('div'); hint.style.cssText = 'font-size:10px;color:#94a3b8;margin-top:6px;padding-top:6px;border-top:1px solid #3f3f46;line-height:1.3;'; hint.textContent = 'Книга в узлах чтения наследуется автоматически.'; menu.appendChild(hint);
    if (conn.isLoop) {
        const sep = document.createElement('hr'); sep.style.margin = '4px 0'; menu.appendChild(sep);
        const lt = document.createElement('div'); lt.textContent = 'Параметры петли'; lt.style.cssText = 'font-weight:bold;margin-bottom:4px;'; menu.appendChild(lt);
        const lcl = document.createElement('label'); lcl.style.cssText = 'display:block;margin-bottom:4px;'; lcl.textContent = 'Кол-во циклов';
        const lci = document.createElement('input'); lci.type = 'number'; lci.min = '1'; lci.value = conn.loopLimit || 1; lci.style.width = '100%'; lci.addEventListener('change', ev => { conn.loopLimit = parseInt(ev.target.value) || 1; requestRenderGraph(); }); lcl.appendChild(lci); menu.appendChild(lcl);
    }
    const sep2 = document.createElement('hr'); sep2.style.margin = '4px 0'; menu.appendChild(sep2);
    const db = document.createElement('button'); db.className = 'btn btn-danger'; db.style.width = '100%'; db.textContent = '✕ Удалить связь';
    db.addEventListener('click', () => { connections = connections.filter(c => c !== conn); hideConnectionMenu(); requestRenderGraph(); });
    menu.appendChild(db);
}
function hideConnectionMenu() { document.getElementById('connection-menu').style.display = 'none'; currentConnectionForMenu = null; }

// ==================== UI ГЕНЕРАТОРА ====================
function ensureSingleGridGeneratorUI() { const container = document.getElementById('single-grid-settings'); if (!container || document.getElementById('gen-single-grid-block')) return; const block = document.createElement('div'); block.id = 'gen-single-grid-block'; block.style.cssText = 'margin-top:10px;padding:8px;background:#0a1a10;border:1px solid #22c55e;border-radius:4px;'; block.innerHTML = `<label style="color:#4ade80;font-weight:bold;display:block;margin-bottom:4px;">🔲 Сетка положения стимула</label><label><input type="checkbox" id="gen-single-grid-enabled"> Включить сетку</label><div id="gen-single-grid-settings" style="display:none;margin-top:6px;"><label>Столбцов (X)</label><input type="number" id="gen-single-grid-x" value="3" min="1" max="10" step="1"><label>Строк (Y)</label><input type="number" id="gen-single-grid-y" value="3" min="1" max="10" step="1"><label><input type="checkbox" id="gen-single-grid-show-lines"> Показывать линии</label><label><input type="checkbox" id="gen-single-grid-random" checked> Случайная клетка</label><label><input type="checkbox" id="gen-single-grid-avoid-repeat" checked> Избегать повтора</label></div>`; container.appendChild(block); const cb = document.getElementById('gen-single-grid-enabled'), set = document.getElementById('gen-single-grid-settings'); cb.addEventListener('change', () => { set.style.display = cb.checked ? 'block' : 'none'; }); }
function ensureDistanceGeneratorUI() { const typeSel = document.getElementById('gen-training-type'); if (!typeSel || document.getElementById('gen-distance-block')) return; const firstCol = typeSel.closest('.modal-col'); if (!firstCol) return; const block = document.createElement('div'); block.id = 'gen-distance-block'; block.style.cssText = 'margin-top:12px;padding:8px;background:#0a1020;border:1px solid #0ea5e9;border-radius:4px;'; block.innerHTML = `<label style="color:#38bdf8;font-weight:bold;display:block;margin-bottom:6px;">📏 Дистанции</label><label>Общая (стимулы), м</label><input type="number" id="gen-general-distance" value="${generalDistance}" min="0.1" max="20" step="0.1"><label>Чтение, м</label><input type="number" id="gen-reading-distance" value="${readingDistance}" min="0.1" max="20" step="0.1"><div style="margin-top:8px;padding-top:6px;border-top:1px dashed #0ea5e9;"><label style="color:#38bdf8;font-weight:bold;display:block;margin-bottom:4px;">Допуски (камера)</label><label>Увеличение, %</label><input type="number" id="gen-tol-inc" value="${distanceToleranceIncreasePct}" min="0" max="100" step="1"><label>Уменьшение, %</label><input type="number" id="gen-tol-dec" value="${distanceToleranceDecreasePct}" min="0" max="100" step="1"><label>Таймаут до пересчёта, с</label><input type="number" id="gen-tol-timeout" value="${distanceRestoreTimeoutSec}" min="0" max="60" step="0.5"></div>`; firstCol.appendChild(block); }
function ensureBlinkGeneratorUI() { const typeSel = document.getElementById('gen-training-type'); if (!typeSel || document.getElementById('gen-blink-block')) return; const firstCol = typeSel.closest('.modal-col'); if (!firstCol) return; const block = document.createElement('div'); block.id = 'gen-blink-block'; block.style.cssText = 'margin-top:12px;padding:8px;background:#0a1a1a;border:1px solid #14b8a6;border-radius:4px;'; block.innerHTML = `<label style="color:#2dd4bf;font-weight:bold;display:block;margin-bottom:6px;">👁️ Blink-контроль</label><label><input type="checkbox" id="gen-blink-enabled" ${blinkEnabled ? 'checked' : ''}> Включить</label><label>Минимум морганий/мин</label><input type="number" id="gen-blink-min-rate" value="${blinkMinRate}" min="0" max="60" step="1"><label>Окно подсчёта, с</label><input type="number" id="gen-blink-window" value="${blinkWindowSec}" min="5" max="120" step="1"><label><input type="checkbox" id="gen-blink-lock-show" ${blinkLockShow ? 'checked' : ''}> Ждать открытых глаз</label><div style="font-size:10px;color:#94a3b8;margin-top:4px;">Порог EAR: <b style="color:#22c55e;">${blinkThreshold.toFixed(3)}</b></div>`; firstCol.appendChild(block); document.getElementById('gen-blink-enabled').addEventListener('change', e => { blinkEnabled = e.target.checked; saveUserSettings(); }); document.getElementById('gen-blink-min-rate').addEventListener('change', e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0 && v <= 60) { blinkMinRate = v; saveUserSettings(); } }); document.getElementById('gen-blink-window').addEventListener('change', e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 5 && v <= 120) { blinkWindowSec = v; saveUserSettings(); } }); document.getElementById('gen-blink-lock-show').addEventListener('change', e => { blinkLockShow = e.target.checked; saveUserSettings(); }); }
function ensureCircleGeneratorUI() {
    const container = document.getElementById('single-grid-settings');
    if (!container || document.getElementById('gen-circle-block')) return;
    const block = document.createElement('div');
    block.id = 'gen-circle-block';
    block.style.cssText = 'margin-top:10px;padding:8px;background:#1a0a15;border:1px solid #ec4899;border-radius:4px;';
    block.innerHTML = `
        <label style="color:#f472b6;font-weight:bold;display:block;margin-bottom:4px;">🎯 Динамика Круг</label>
        <label><input type="checkbox" id="gen-circle-enabled"> Включить режим кругов</label>
        <div id="gen-circle-settings" style="display:none;margin-top:8px;">
            <div style="border-top:1px dashed #ec4899;padding-top:6px;">
                <label style="color:#f9a8d4;font-weight:bold;">Внутренний круг</label>
                <label>Радиус (% от общего)</label>
                <input type="number" id="gen-ci-radius" value="40" min="5" max="95" step="1">
                <label>Цвет 1 (центр)</label><input type="color" id="gen-ci-c1" value="#ff0000">
                <label><input type="checkbox" id="gen-ci-mid-enabled"> Использовать цвет 3</label>
                <div id="gen-ci-mid-row" style="display:none;"><label>Цвет 3</label><input type="color" id="gen-ci-c3" value="#ffff00"></div>
                <label>Цвет 2 (край)</label><input type="color" id="gen-ci-c2" value="#0000ff">
                <label>Время (с)</label><input type="number" id="gen-ci-duration" value="10" min="0.1" step="0.1">
                <label><input type="checkbox" id="gen-ci-loop" checked> Повторять</label>
                <label><input type="checkbox" id="gen-ci-reverse"> Пинг-понг</label>
            </div>
            <div style="border-top:1px dashed #ec4899;margin-top:6px;padding-top:6px;">
                <label style="color:#f9a8d4;font-weight:bold;">Внешнее кольцо</label>
                <label>Цвет 1 (у диска)</label><input type="color" id="gen-co-c1" value="#00ff00">
                <label><input type="checkbox" id="gen-co-mid-enabled"> Использовать цвет 3</label>
                <div id="gen-co-mid-row" style="display:none;"><label>Цвет 3</label><input type="color" id="gen-co-c3" value="#00ffff"></div>
                <label>Цвет 2 (край)</label><input type="color" id="gen-co-c2" value="#0080ff">
                <label>Время (с)</label><input type="number" id="gen-co-duration" value="10" min="0.1" step="0.1">
                <label><input type="checkbox" id="gen-co-loop" checked> Повторять</label>
                <label><input type="checkbox" id="gen-co-reverse"> Пинг-понг</label>
            </div>
        </div>`;
    container.appendChild(block);
    const cb = document.getElementById('gen-circle-enabled'), set = document.getElementById('gen-circle-settings');
    cb.addEventListener('change', () => { set.style.display = cb.checked ? 'block' : 'none'; });
    const ciM = document.getElementById('gen-ci-mid-enabled'), ciMR = document.getElementById('gen-ci-mid-row');
    ciM.addEventListener('change', () => { ciMR.style.display = ciM.checked ? 'block' : 'none'; });
    const coM = document.getElementById('gen-co-mid-enabled'), coMR = document.getElementById('gen-co-mid-row');
    coM.addEventListener('change', () => { coMR.style.display = coM.checked ? 'block' : 'none'; });
}
function ensurePeripheralGeneratorUI() {
    const container = document.getElementById('single-grid-settings');
    if (!container || document.getElementById('gen-peri-block')) return;
    const block = document.createElement('div');
    block.id = 'gen-peri-block';
    block.style.cssText = 'margin-top:10px;padding:8px;background:#0a1a15;border:1px solid #10b981;border-radius:4px;';
    block.innerHTML = `
        <label style="color:#34d399;font-weight:bold;display:block;margin-bottom:4px;">🟢 Периферийные точки</label>
        <label><input type="checkbox" id="gen-peri-enabled"> Включить точки</label>
        <div id="gen-peri-settings" style="display:none;margin-top:6px;">
            <label>Количество (1–12)</label><input type="number" id="gen-peri-count" value="4" min="1" max="12">
            <label>V размера (острота)</label><input type="number" id="gen-peri-acuity" value="0.3" min="0.1" max="1.0" step="0.1">
            <label>Радиус min (%)</label><input type="number" id="gen-peri-rmin" value="60" min="20" max="100">
            <label>Радиус max (%)</label><input type="number" id="gen-peri-rmax" value="90" min="20" max="100">
            <label>Цвет точки</label><input type="color" id="gen-peri-color" value="#00ff64">
            <label>Движение</label>
            <select id="gen-peri-motion">
                <option value="static" selected>Статично</option>
                <option value="rotate">Вращение</option>
                <option value="pulse">Пульс</option>
            </select>
            <label>Скорость (об/с или Гц)</label><input type="number" id="gen-peri-speed" value="0.3" min="0.02" max="5" step="0.05">
            <label><input type="checkbox" id="gen-peri-random" checked> Случайные углы</label>
        </div>`;
    container.appendChild(block);
    const cb = document.getElementById('gen-peri-enabled');
    const set = document.getElementById('gen-peri-settings');
    cb.addEventListener('change', () => { set.style.display = cb.checked ? 'block' : 'none'; });
}
function ensureDefocusGeneratorUI() {
    const container = document.getElementById('single-grid-settings');
    if (!container || document.getElementById('gen-df-block')) return;
    const block = document.createElement('div');
    block.id = 'gen-df-block';
    block.style.cssText = 'margin-top:10px;padding:8px;background:#1a0a0a;border:1px solid #dc2626;border-radius:4px;';
    block.innerHTML = `
        <label style="color:#f87171;font-weight:bold;display:block;margin-bottom:4px;">🔴 Цифровой дефокус</label>
        <label><input type="checkbox" id="gen-df-enabled"> Включить дефокус</label>
        <div id="gen-df-settings" style="display:none;margin-top:6px;">
            <label>Радиус центра (мм)</label><input type="number" id="gen-df-radius-mm" value="13" min="3" max="50" step="1">
            <label>Фон центра (красный)</label><input type="color" id="gen-df-center-bg" value="#cc0000">
            <label>Цвет стимула в центре (чёрный)</label><input type="color" id="gen-df-stim-color" value="#000000">
            <label>Фон периферии (синий)</label><input type="color" id="gen-df-peri-bg" value="#0047ab">
            <label>Размытие к краю (%)</label><input type="number" id="gen-df-blur" value="0" min="0" max="100" step="5">
            <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Дефокус заменяет букву/круг: центр — красный диск с чёрным стимулом, периферия — синяя.</div>
        </div>`;
    container.appendChild(block);
    const cb = document.getElementById('gen-df-enabled');
    const set = document.getElementById('gen-df-settings');
    cb.addEventListener('change', () => { set.style.display = cb.checked ? 'block' : 'none'; });
}
function ensureBlinkAnimationGeneratorUI() {
    const container = document.getElementById('single-grid-settings');
    if (!container || document.getElementById('gen-blink-anim-block')) return;
    const block = document.createElement('div');
    block.id = 'gen-blink-anim-block';
    block.style.cssText = 'margin-top:10px;padding:8px;background:#1a0a05;border:1px solid #f97316;border-radius:4px;';
    block.innerHTML = `
        <label style="color:#fb923c;font-weight:bold;display:block;margin-bottom:4px;">🔦 Моргание</label>
        <label><input type="checkbox" id="gen-blink-anim-enabled"> Включить моргание</label>
        <div id="gen-blink-anim-settings" style="display:none;margin-top:6px;">
            <label>Цель</label>
            <select id="gen-blink-anim-target">
                <option value="stim" selected>Только стимул</option>
                <option value="bg">Только фон</option>
                <option value="both">Стимул + фон</option>
            </select>
            <label>Цвет A</label><input type="color" id="gen-blink-anim-cA" value="#ff0000">
            <label>Цвет B</label><input type="color" id="gen-blink-anim-cB" value="#0000ff">
            <label>Период (мс)</label><input type="number" id="gen-blink-anim-interval" value="500" min="50" max="5000" step="50">
            <label>Доля A</label><input type="number" id="gen-blink-anim-duty" value="0.5" min="0.05" max="0.95" step="0.05">
            <label>Количество (0 = ∞)</label><input type="number" id="gen-blink-anim-count" value="0" min="0" max="9999">
        </div>`;
    container.appendChild(block);
    const cb = document.getElementById('gen-blink-anim-enabled');
    const set = document.getElementById('gen-blink-anim-settings');
    cb.addEventListener('change', () => { set.style.display = cb.checked ? 'block' : 'none'; });
}

// ==================== app.js: Конец части 2 из 3 ====================
// ==================== app.js: Начало части 3 из 3 ====================

// ==================== ИНСПЕКТОР ====================
function updateInspector() {
    const node = getNode(activeNodeId);
    if (!node) { inspectorEl.innerHTML = '<h2>Инспектор</h2><p>Нет выбранного узла</p>'; return; }
    if (node.nodeType === 'READING') { updateReadingInspector(node); return; }
    if (node.nodeType === 'LOGIC_IF') { updateLogicInspector(node); return; }
    if (node.nodeType === 'COMPARE') { updateCompareInspector(node); return; }
    updateStimulusInspector(node);
}
function renderInspectorGridPreview() {
    const p = document.getElementById('insp-grid-preview'); if (!p) return;
    const gx = Math.max(1, Math.min(10, parseInt(document.getElementById('inp-grid-x')?.value) || 3));
    const gy = Math.max(1, Math.min(10, parseInt(document.getElementById('inp-grid-y')?.value) || 3));
    let sel = []; try { sel = JSON.parse(p.dataset.selected || '[]'); } catch (_) { sel = []; }
    sel = sel.filter(c => c && c.row >= 0 && c.row < gy && c.col >= 0 && c.col < gx);
    p.style.gridTemplateColumns = `repeat(${gx}, 30px)`; p.innerHTML = '';
    for (let r = 0; r < gy; r++) for (let c = 0; c < gx; c++) {
        const isSel = sel.some(x => x.row === r && x.col === c);
        const cell = document.createElement('div');
        cell.style.cssText = `width:30px;height:30px;border:1px solid #444;border-radius:2px;cursor:pointer;transition:background 0.15s;background:${isSel ? '#22c55e' : '#1a1a1a'};`;
        cell.dataset.row = r; cell.dataset.col = c; cell.dataset.selected = isSel ? '1' : '0';
        cell.addEventListener('click', () => {
            const was = cell.dataset.selected === '1';
            cell.dataset.selected = was ? '0' : '1';
            cell.style.background = was ? '#1a1a1a' : '#22c55e';
            const list = [];
            p.querySelectorAll('[data-selected="1"]').forEach(e2 => list.push({ row: parseInt(e2.dataset.row), col: parseInt(e2.dataset.col) }));
            p.dataset.selected = JSON.stringify(list);
            const h = document.getElementById('insp-grid-preview-hint');
            if (h) h.textContent = list.length === 0 ? 'Пусто = все клетки.' : `Выбрано: ${list.length}`;
        });
        p.appendChild(cell);
    }
    // dataset.selected ведётся обработчиками кликов — здесь НЕ перезаписываем
}

function renderPeriInspectorSection(node) {
    return `
        <div class="panel-section" style="background:#0a1a15;border-color:#10b981;">
            <h3 style="color:#34d399;border-color:#10b981;">🟢 Периферийные точки</h3>
            <label><input type="checkbox" id="inp-peri-enabled" ${node.periEnabled ? 'checked' : ''}> Включить точки</label>
            <div id="insp-peri-settings" style="display:${node.periEnabled ? 'block' : 'none'};margin-top:6px;">
                <label>Количество (1–12)</label>
                <input type="number" id="inp-peri-count" value="${node.periCount || 4}" min="1" max="12">
                <label>V размера</label>
                <input type="number" id="inp-peri-acuity" value="${node.periAcuity ?? 0.3}" min="0.1" max="1.0" step="0.1">
                <label>Радиус min (%)</label>
                <input type="number" id="inp-peri-rmin" value="${node.periRadiusMinPct ?? 60}" min="20" max="100">
                <label>Радиус max (%)</label>
                <input type="number" id="inp-peri-rmax" value="${node.periRadiusMaxPct ?? 90}" min="20" max="100">
                <label>Цвет точки</label>
                <input type="color" id="inp-peri-color" value="${rgbToHex(node.periColor?.r, node.periColor?.g, node.periColor?.b)}">
                <label>Движение</label>
                <select id="inp-peri-motion">
                    <option value="static" ${(node.periMotion||'static')==='static'?'selected':''}>Статично</option>
                    <option value="rotate" ${node.periMotion==='rotate'?'selected':''}>Вращение</option>
                    <option value="pulse" ${node.periMotion==='pulse'?'selected':''}>Пульс</option>
                </select>
                <label>Скорость</label>
                <input type="number" id="inp-peri-speed" value="${node.periSpeed ?? 0.3}" min="0.02" max="5" step="0.05">
                <label><input type="checkbox" id="inp-peri-random" ${node.periRandomAngles !== false ? 'checked' : ''}> Случайные углы</label>
            </div>
        </div>`;
}
function renderDefocusInspectorSection(node) {
    return `
        <div class="panel-section" style="background:#1a0a0a;border-color:#dc2626;">
            <h3 style="color:#f87171;border-color:#dc2626;">🔴 Цифровой дефокус</h3>
            <label><input type="checkbox" id="inp-df-enabled" ${node.dfEnabled ? 'checked' : ''}> Включить дефокус</label>
            <div id="insp-df-settings" style="display:${node.dfEnabled ? 'block' : 'none'};margin-top:6px;">
                <label>Радиус центра (мм)</label>
                <input type="number" id="inp-df-radius-mm" value="${node.dfCenterRadiusMm || 13}" min="3" max="50" step="1">
                <label>Фон центра</label>
                <input type="color" id="inp-df-center-bg" value="${rgbToHex(node.dfCenterBg?.r, node.dfCenterBg?.g, node.dfCenterBg?.b)}">
                <label>Цвет стимула</label>
                <input type="color" id="inp-df-stim-color" value="${rgbToHex(node.dfStimColor?.r, node.dfStimColor?.g, node.dfStimColor?.b)}">
                <label>Фон периферии</label>
                <input type="color" id="inp-df-peri-bg" value="${rgbToHex(node.dfPeriBg?.r, node.dfPeriBg?.g, node.dfPeriBg?.b)}">
                <label>Размытие к краю (%)</label>
                <input type="number" id="inp-df-blur" value="${node.dfPeriBlur || 0}" min="0" max="100" step="5">
                <div class="acuity-hint">Центр — красный диск с чёрным стимулом; периферия — синяя заливка.</div>
            </div>
        </div>`;
}
function renderBlinkAnimationInspectorSection(node) {
    return `
        <div class="panel-section" style="background:#1a0a05;border-color:#f97316;">
            <h3 style="color:#fb923c;border-color:#f97316;">🔦 Моргание</h3>
            <div class="acuity-hint">Резкая смена цвета без плавного перехода. Отличается от «Динамики».</div>
            <label><input type="checkbox" id="inp-blink-enabled" ${node.blinkEnabled ? 'checked' : ''}> Включить моргание</label>
            <div id="insp-blink-settings" style="display:${node.blinkEnabled ? 'block' : 'none'};margin-top:6px;">
                <label>Цель</label>
                <select id="inp-blink-target">
                    <option value="stim" ${(node.blinkTarget||'stim')==='stim'?'selected':''}>Только стимул</option>
                    <option value="bg" ${node.blinkTarget==='bg'?'selected':''}>Только фон</option>
                    <option value="both" ${node.blinkTarget==='both'?'selected':''}>Стимул + фон</option>
                </select>
                <label>Цвет A</label>
                <input type="color" id="inp-blink-cA" value="${rgbToHex(node.blinkColorA?.r, node.blinkColorA?.g, node.blinkColorA?.b)}">
                <label>Цвет B</label>
                <input type="color" id="inp-blink-cB" value="${rgbToHex(node.blinkColorB?.r, node.blinkColorB?.g, node.blinkColorB?.b)}">
                <label>Период (мс)</label>
                <input type="number" id="inp-blink-interval" value="${node.blinkIntervalMs || 500}" min="50" max="5000" step="50">
                <label>Доля A (0.05–0.95)</label>
                <input type="number" id="inp-blink-duty" value="${node.blinkDuty ?? 0.5}" min="0.05" max="0.95" step="0.05">
                <label>Количество морганий (0 = ∞)</label>
                <input type="number" id="inp-blink-count" value="${node.blinkCount || 0}" min="0" max="9999" step="1">
            </div>
        </div>`;
}

function updateStimulusInspector(node) {
    const mm = getNodeComputedSizeMm(node), px = getNodeComputedSize(node);
    const cir = !!node.singleCircleEnabled;
    let html = '<h2>Инспектор</h2><div class="insp-cols">';

    html += '<div class="panel-section"><h3>📋 Информация</h3>';
    html += `<label>Название узла</label><input type="text" id="inp-name" value="${escapeHtml(node.name)}">`;
    html += `<label>Тип стимула</label><select id="inp-type">
        <option value="LETTER_E" ${node.stimType==='LETTER_E'?'selected':''}>Буква Е</option>
        <option value="LANDOLT" ${node.stimType==='LANDOLT'?'selected':''}>Кольцо Ландольта</option></select>`;
    html += `<label><input type="checkbox" id="inp-circle-enabled" ${cir?'checked':''}> 🎯 Режим «Динамика Круг»</label>`;
    html += '<div class="acuity-hint">Вкл: вместо буквы показывается двухслойный круг (внутренний диск + внешнее кольцо), оба динамически меняют цвет.</div>';
    html += `<label><input type="checkbox" id="inp-active" ${node.isActive?'checked':''}> Активная тренировка</label></div>`;

    let acOpts = '';
    for (let i = 1; i <= 20; i++) { const v = i/10; const m = acuityToSizeMm(v, 1); acOpts += `<option value="${v.toFixed(1)}">${v.toFixed(1)} — ${m.toFixed(2)} мм</option>`; }
    const sV = (node.stimAcuity || 1.0).toFixed(1);
    const eV = (node.endAcuity != null ? node.endAcuity : node.stimAcuity || 1.0).toFixed(1);

    html += '<div class="panel-section" style="background:#101a10;border-color:#00aa55;">';
    html += '<h3 style="color:#00ff88;border-color:#00aa55;">👁️ Острота зрения</h3>';
    html += `<label>V старт</label><select id="inp-acuity">${acOpts.replace(`value="${sV}"`, `value="${sV}" selected`)}</select>`;
    html += `<label>V цель</label><select id="inp-end-acuity">${acOpts.replace(`value="${eV}"`, `value="${eV}" selected`)}</select>`;
    html += `<label>Шаг V за успешную серию</label><input type="number" id="inp-acuity-step" value="${node.acuityStep || 0.1}" min="0.05" max="1" step="0.05">`;
    html += `<label>Дистанция (м)</label><input type="number" id="inp-distance" value="${(node.stimDistance || 1).toFixed(1)}" min="0.1" max="20" step="0.1">`;
    html += `<label>PPI экрана (авто: ${screenPPI})</label><input type="number" id="inp-ppi" value="${node.stimPPI || screenPPI || 96}" min="20" max="1200" step="1">`;
    html += `<div style="margin-top:6px;padding:6px;background:#000;border-radius:3px;text-align:center;">
        <div style="color:#ffcc00;font-size:13px;font-weight:bold;" id="preview-mm">📐 ${mm.toFixed(2)} мм</div>
        <div style="color:#888;font-size:10px;" id="preview-px">≈ ${px}px @ ${node.stimPPI || screenPPI || 96} PPI</div></div></div>`;

    html += '<div class="panel-section" style="background:#1a0a1a;border-color:#a855f7;">';
    html += '<h3 style="color:#c084fc;border-color:#a855f7;">📊 Серии</h3>';
    html += `<label>Серий</label><input type="number" id="inp-series-count" value="${node.seriesCount || 5}" min="1" max="50">`;
    html += `<label>Размер серии</label><input type="number" id="inp-series-size" value="${node.seriesSize || 6}" min="1" max="20">`;
    html += `<label>Порог правильных</label><input type="number" id="inp-series-threshold" value="${node.seriesThreshold || 4}" min="1" max="20"></div>`;

    html += '<div class="panel-section" style="background:#1a1a0a;border-color:#eab308;">';
    html += '<h3 style="color:#fde047;border-color:#eab308;">🎨 Цвета</h3>';
    html += `<label>Цвет стимула (для буквы)</label><input type="color" id="inp-color" value="${rgbToHex(node.stimR,node.stimG,node.stimB)}">`;
    html += `<label>Цвет фона</label><input type="color" id="inp-bg" value="${rgbToHex(node.bgR,node.bgG,node.bgB)}"></div>`;

    html += '<div class="panel-section" style="background:#0a1a20;border-color:#0ea5e9;">';
    html += '<h3 style="color:#38bdf8;border-color:#0ea5e9;">🎲 Случайность</h3>';
    html += `<label><input type="checkbox" id="inp-random-pos" ${node.singleRandomPos?'checked':''}> Случайное положение</label>`;
    html += '<div class="acuity-hint">Работает и для буквы, и для круга.</div></div>';

    html += '<div class="panel-section" style="background:#0a1a10;border-color:#22c55e;">';
    html += '<h3 style="color:#4ade80;border-color:#22c55e;">🔲 Сетка положения</h3>';
    html += `<label><input type="checkbox" id="inp-grid-enabled" ${node.singleGridEnabled?'checked':''}> Включить сетку</label>`;
    html += `<div id="insp-grid-settings" style="display:${node.singleGridEnabled?'block':'none'};margin-top:6px;">`;
    html += `<label>Столбцов (X)</label><input type="number" id="inp-grid-x" value="${node.singleGridX || 3}" min="1" max="10" step="1">`;
    html += `<label>Строк (Y)</label><input type="number" id="inp-grid-y" value="${node.singleGridY || 3}" min="1" max="10" step="1">`;
    html += `<label><input type="checkbox" id="inp-grid-show-lines" ${node.singleGridShowLines?'checked':''}> Показывать линии</label>`;
    html += `<label><input type="checkbox" id="inp-grid-random" ${node.singleGridRandomCell!==false?'checked':''}> Случайная клетка</label>`;
    html += `<label><input type="checkbox" id="inp-grid-avoid-repeat" ${node.singleGridAvoidRepeat!==false?'checked':''}> Избегать повтора</label>`;
    const cells = Array.isArray(node.singleGridCells) ? node.singleGridCells : [];
    html += `<div style="margin-top:10px;padding-top:8px;border-top:1px dashed #22c55e;">`;
    html += `<label style="color:#4ade80;">Активные клетки</label>`;
    html += `<div style="font-size:10px;color:#94a3b8;margin-bottom:6px;" id="insp-grid-preview-hint">${cells.length === 0 ? 'Пусто = все клетки.' : `Выбрано: ${cells.length}`}</div>`;
    html += `<div id="insp-grid-preview" style="display:grid;gap:3px;"></div></div></div></div>`;

    html += '<div class="panel-section" style="background:#1a0a15;border-color:#ec4899;">';
    html += '<h3 style="color:#f472b6;border-color:#ec4899;">🎯 Динамика Круг</h3>';
    html += '<div class="acuity-hint">Внутренний диск и внешнее кольцо меняют цвет независимо. По радиусу: от центра к краю.</div>';
    html += `<div id="insp-circle-settings" style="display:${cir?'block':'none'};margin-top:6px;">`;
    html += '<div style="border-top:1px dashed #ec4899;padding-top:6px;">';
    html += '<label style="color:#f9a8d4;font-weight:bold;">Внутренний круг</label>';
    html += `<label><input type="checkbox" id="inp-ci-enabled" ${node.circleInnerEnabled !== false ? 'checked' : ''}> Показывать внутренний круг</label>`;
    html += `<label>Радиус внутреннего (% от общего)</label><input type="number" id="inp-ci-radius" value="${node.circleInnerRadiusPct ?? 40}" min="5" max="95" step="1">`;
    html += `<label>Цвет 1 (центр)</label><input type="color" id="inp-ci-c1" value="${rgbToHex(node.circleInnerColor1?.r, node.circleInnerColor1?.g, node.circleInnerColor1?.b)}">`;
    html += `<label><input type="checkbox" id="inp-ci-mid-enabled" ${node.circleInnerMidEnabled?'checked':''}> Использовать цвет 3 (середина радиуса)</label>`;
    html += `<div id="insp-ci-mid-row" style="display:${node.circleInnerMidEnabled?'block':'none'};"><label>Цвет 3</label><input type="color" id="inp-ci-c3" value="${rgbToHex(node.circleInnerColor3?.r, node.circleInnerColor3?.g, node.circleInnerColor3?.b)}"></div>`;
    html += `<label>Цвет 2 (край диска)</label><input type="color" id="inp-ci-c2" value="${rgbToHex(node.circleInnerColor2?.r, node.circleInnerColor2?.g, node.circleInnerColor2?.b)}">`;
    html += `<label>Время изменения (с)</label><input type="number" id="inp-ci-duration" value="${(node.circleInnerDuration||10000)/1000}" min="0.1" step="0.1">`;
    html += `<label><input type="checkbox" id="inp-ci-loop" ${node.circleInnerLoop !== false?'checked':''}> Повторять цикл</label>`;
    html += `<label><input type="checkbox" id="inp-ci-reverse" ${node.circleInnerReverse?'checked':''}> Пинг-понг (A→B→A)</label></div>`;
    html += '<div style="border-top:1px dashed #ec4899;margin-top:8px;padding-top:8px;">';
    html += '<label style="color:#f9a8d4;font-weight:bold;">Внешнее кольцо</label>';
    html += `<label><input type="checkbox" id="inp-co-enabled" ${node.circleOuterEnabled !== false ? 'checked' : ''}> Показывать внешнее кольцо</label>`;
    html += `<label>Цвет 1 (у границы диска)</label><input type="color" id="inp-co-c1" value="${rgbToHex(node.circleOuterColor1?.r, node.circleOuterColor1?.g, node.circleOuterColor1?.b)}">`;
    html += `<label><input type="checkbox" id="inp-co-mid-enabled" ${node.circleOuterMidEnabled?'checked':''}> Использовать цвет 3 (середина кольца)</label>`;
    html += `<div id="insp-co-mid-row" style="display:${node.circleOuterMidEnabled?'block':'none'};"><label>Цвет 3</label><input type="color" id="inp-co-c3" value="${rgbToHex(node.circleOuterColor3?.r, node.circleOuterColor3?.g, node.circleOuterColor3?.b)}"></div>`;
    html += `<label>Цвет 2 (край экрана)</label><input type="color" id="inp-co-c2" value="${rgbToHex(node.circleOuterColor2?.r, node.circleOuterColor2?.g, node.circleOuterColor2?.b)}">`;
    html += `<label>Время изменения (с)</label><input type="number" id="inp-co-duration" value="${(node.circleOuterDuration||10000)/1000}" min="0.1" step="0.1">`;
    html += `<label><input type="checkbox" id="inp-co-loop" ${node.circleOuterLoop !== false?'checked':''}> Повторять цикл</label>`;
    html += `<label><input type="checkbox" id="inp-co-reverse" ${node.circleOuterReverse?'checked':''}> Пинг-понг (A→B→A)</label></div></div></div>`;

    html += renderPeriInspectorSection(node);
    html += renderDefocusInspectorSection(node);
    html += renderBlinkAnimationInspectorSection(node);

    const tf = [
        { id: 'delay1', label: 'Задержка 1', value: node.delay1 || 0 },
        { id: 'duration', label: 'Время показа', value: node.duration || 0 },
        { id: 'response', label: 'Ожидание ответа', value: node.response || 0 },
        { id: 'delay2', label: 'Задержка 2', value: node.delay2 || 0 }
    ];
    html += '<div class="panel-section" style="background:#1a1000;border-color:#f59e0b;">';
    html += '<h3 style="color:#fbbf24;border-color:#f59e0b;">⏱ Время</h3>';
    tf.forEach(f => {
        const u = detectUnit(f.value), dv = msToUnit(f.value, u);
        html += `<label>${f.label}</label><div class="time-group">
            <input type="number" id="inp-${f.id}" value="${dv}" step="any" min="0">
            <select id="inp-${f.id}-unit"><option value="ms" ${u==='ms'?'selected':''}>мс</option><option value="s" ${u==='s'?'selected':''}>с</option><option value="min" ${u==='min'?'selected':''}>мин</option></select></div>`;
    });
    html += '</div>';

    html += '<div class="panel-section" style="background:#100a1a;border-color:#8b5cf6;">';
    html += '<h3 style="color:#a78bfa;border-color:#8b5cf6;">🎨 Динамика буквы</h3>';
    html += `<label><input type="checkbox" id="inp-stim-dyn-enabled" ${node.singleStimDynamicEnabled?'checked':''}> Включить</label>`;
    html += `<div id="insp-sti-dyn-settings" style="display:${node.singleStimDynamicEnabled?'block':'none'};margin-top:6px;">`;
    html += `<label>Цвет 1</label><input type="color" id="inp-sti-color1" value="${rgbToHex(node.singleStimColor1?.r,node.singleStimColor1?.g,node.singleStimColor1?.b)}">`;
    html += `<label><input type="checkbox" id="inp-sti-mid-enabled" ${node.singleStimMidEnabled?'checked':''}> Цвет 3</label>`;
    html += `<div id="insp-sti-mid-row" style="display:${node.singleStimMidEnabled?'block':'none'};"><label>Цвет 3</label><input type="color" id="inp-sti-color3" value="${rgbToHex(node.singleStimColor3?.r,node.singleStimColor3?.g,node.singleStimColor3?.b)}"></div>`;
    html += `<label>Цвет 2</label><input type="color" id="inp-sti-color2" value="${rgbToHex(node.singleStimColor2?.r,node.singleStimColor2?.g,node.singleStimColor2?.b)}">`;
    html += `<label>Время (с)</label><input type="number" id="inp-sti-duration" value="${(node.singleStimDuration||10000)/1000}" min="0.1" step="0.1">`;
    html += `<label><input type="checkbox" id="inp-sti-loop" ${node.singleStimLoop?'checked':''}> Повторять</label>`;
    html += `<label><input type="checkbox" id="inp-sti-reverse" ${node.singleStimReverse?'checked':''}> Пинг-понг</label></div></div>`;

    html += '<div class="panel-section" style="background:#1a0a10;border-color:#ec4899;">';
    html += '<h3 style="color:#f472b6;border-color:#ec4899;">🖼️ Динамика фона</h3>';
    html += `<label><input type="checkbox" id="inp-bg-dyn-enabled" ${node.singleBgDynamicEnabled?'checked':''}> Включить</label>`;
    html += `<div id="insp-bg-dyn-settings" style="display:${node.singleBgDynamicEnabled?'block':'none'};margin-top:6px;">`;
    html += `<label>Цвет 1</label><input type="color" id="inp-bg-color1" value="${rgbToHex(node.singleBgColor1?.r,node.singleBgColor1?.g,node.singleBgColor1?.b)}">`;
    html += `<label><input type="checkbox" id="inp-bg-mid-enabled" ${node.singleBgMidEnabled?'checked':''}> Цвет 3</label>`;
    html += `<div id="insp-bg-mid-row" style="display:${node.singleBgMidEnabled?'block':'none'};"><label>Цвет 3</label><input type="color" id="inp-bg-color3" value="${rgbToHex(node.singleBgColor3?.r,node.singleBgColor3?.g,node.singleBgColor3?.b)}"></div>`;
    html += `<label>Цвет 2</label><input type="color" id="inp-bg-color2" value="${rgbToHex(node.singleBgColor2?.r,node.singleBgColor2?.g,node.singleBgColor2?.b)}">`;
    html += `<label>Время (с)</label><input type="number" id="inp-bg-duration" value="${(node.singleBgDuration||10000)/1000}" min="0.1" step="0.1">`;
    html += `<label><input type="checkbox" id="inp-bg-loop" ${node.singleBgLoop?'checked':''}> Повторять</label>`;
    html += `<label><input type="checkbox" id="inp-bg-reverse" ${node.singleBgReverse?'checked':''}> Пинг-понг</label></div></div>`;

    html += '</div>';
    html += '<button class="btn btn-success" id="inp-apply" style="width:100%;margin-top:6px;">💾 Применить</button>';
    inspectorEl.innerHTML = html;

    const p = document.getElementById('insp-grid-preview');
    if (p) { p.dataset.selected = JSON.stringify(cells); renderInspectorGridPreview(); }

    const ai = document.getElementById('inp-acuity'), di = document.getElementById('inp-distance'), pp = document.getElementById('inp-ppi');
    const upd = () => {
        const v = parseFloat(ai?.value) || 1.0, d = parseFloat(di?.value) || 1, ppi = parseInt(pp?.value) || screenPPI || 96;
        const m = document.getElementById('preview-mm'); if (m) m.textContent = `📐 ${acuityToSizeMm(v, d).toFixed(2)} мм`;
        const x = document.getElementById('preview-px'); if (x) x.textContent = `≈ ${acuityToSizePx(v, d, ppi)}px @ ${ppi} PPI`;
    };
    if (ai) ai.addEventListener('change', upd); if (di) di.addEventListener('input', upd); if (pp) pp.addEventListener('input', upd);

    const bind = (id, target) => { const c = document.getElementById(id), t = document.getElementById(target); if (c && t) c.addEventListener('change', () => { t.style.display = c.checked ? 'block' : 'none'; }); };
    bind('inp-stim-dyn-enabled', 'insp-sti-dyn-settings');
    bind('inp-bg-dyn-enabled', 'insp-bg-dyn-settings');
    bind('inp-grid-enabled', 'insp-grid-settings');
    bind('inp-circle-enabled', 'insp-circle-settings');
    bind('inp-ci-mid-enabled', 'insp-ci-mid-row');
    bind('inp-co-mid-enabled', 'insp-co-mid-row');
    bind('inp-peri-enabled', 'insp-peri-settings');
    bind('inp-df-enabled', 'insp-df-settings');
    bind('inp-blink-enabled', 'insp-blink-settings');
    const sM = document.getElementById('inp-sti-mid-enabled'), sMR = document.getElementById('insp-sti-mid-row');
    if (sM && sMR) sM.addEventListener('change', () => { sMR.style.display = sM.checked ? 'block' : 'none'; });
    const bM = document.getElementById('inp-bg-mid-enabled'), bMR = document.getElementById('insp-bg-mid-row');
    if (bM && bMR) bM.addEventListener('change', () => { bMR.style.display = bM.checked ? 'block' : 'none'; });
    const gxI = document.getElementById('inp-grid-x'), gyI = document.getElementById('inp-grid-y');
    if (gxI) gxI.addEventListener('input', renderInspectorGridPreview);
    if (gyI) gyI.addEventListener('input', renderInspectorGridPreview);
}

function updateLogicInspector(node) {
    let html = '<h2>Инспектор</h2><div class="panel-section"><h3>🧠 Логика</h3>';
    html += `<label>Название узла</label><input type="text" id="inp-name" value="${escapeHtml(node.name)}">`;
    html += '<div class="acuity-hint">Логика условных переходов появится позже.</div></div>';
    html += '<button class="btn btn-success" id="inp-apply" style="width:100%;">💾 Применить</button>';
    inspectorEl.innerHTML = html;
}
function updateCompareInspector(node) {
    let html = '<h2>Инспектор</h2><div class="insp-cols">';
    html += '<div class="panel-section"><h3>📋 Информация</h3>';
    html += `<label>Название узла</label><input type="text" id="inp-name" value="${escapeHtml(node.name)}">`;
    html += `<label><input type="checkbox" id="inp-active" ${node.isActive !== false ? 'checked' : ''}> Активный узел</label></div>`;
    html += '<div class="panel-section" style="background:#1a0a1a;border-color:#a855f7;">';
    html += '<h3 style="color:#c084fc;border-color:#a855f7;">⚖️ Режим</h3>';
    html += `<label>Тип</label><select id="inp-cmp-mode">
        <option value="direction" ${(node.compareMode || 'direction') === 'direction' ? 'selected' : ''}>Сравнить направления (Да/Нет)</option>
        <option value="find_same" ${node.compareMode === 'find_same' ? 'selected' : ''}>Найти одинаковые (клик по парам)</option></select>`;
    html += `<div id="insp-cmp-pairs-block" style="display:${node.compareMode === 'find_same' ? 'block' : 'none'};margin-top:6px;">`;
    html += `<label>Количество пар</label><input type="number" id="inp-cmp-pairs" value="${node.pairsCount || 2}" min="1" max="20"></div></div>`;
    html += '<div class="panel-section" style="background:#0a1a10;border-color:#22c55e;">';
    html += '<h3 style="color:#4ade80;border-color:#22c55e;">🔲 Сетка</h3>';
    html += `<label>Столбцов (X)</label><input type="number" id="inp-cmp-gx" value="${node.gridX || 3}" min="2" max="6">`;
    html += `<label>Строк (Y)</label><input type="number" id="inp-cmp-gy" value="${node.gridY || 3}" min="1" max="6">`;
    html += '<div id="insp-cmp-grid" class="cmp-grid-preview"></div></div>';
    html += '<div class="panel-section" style="background:#1a1a0a;border-color:#eab308;">';
    html += '<h3 style="color:#fde047;border-color:#eab308;">🎨 Параметры клеток</h3><div id="insp-cmp-cells"></div></div>';
    html += '<div class="panel-section" style="background:#1a1000;border-color:#f59e0b;">';
    html += '<h3 style="color:#fbbf24;border-color:#f59e0b;">📊 Серии и время</h3>';
    html += `<label>Серий</label><input type="number" id="inp-cmp-sc" value="${node.seriesCount || 5}" min="1" max="50">`;
    html += `<label>Размер серии</label><input type="number" id="inp-cmp-ss" value="${node.seriesSize || 6}" min="1" max="20">`;
    html += `<label>Порог правильных</label><input type="number" id="inp-cmp-st" value="${node.seriesThreshold || 4}" min="1" max="20">`;
    html += `<label>Задержка 1 (мс)</label><input type="number" id="inp-cmp-d1" value="${node.delay1 || 1000}" min="0" step="50">`;
    html += `<label>Время показа (мс)</label><input type="number" id="inp-cmp-dur" value="${node.duration || 2000}" min="200" step="50">`;
    html += `<label>Задержка 2 (мс)</label><input type="number" id="inp-cmp-d2" value="${node.delay2 || 1000}" min="0" step="50"></div>`;
    html += '</div><button class="btn btn-success" id="inp-apply" style="width:100%;margin-top:6px;">💾 Применить</button>';
    inspectorEl.innerHTML = html;

    const previewEl = document.getElementById('insp-cmp-grid');
    previewEl.dataset.selected = JSON.stringify(node.activeCells || []);
    function renderGrid() {
        const gx = Math.max(2, Math.min(6, parseInt(document.getElementById('inp-cmp-gx')?.value) || 3));
        const gy = Math.max(1, Math.min(6, parseInt(document.getElementById('inp-cmp-gy')?.value) || 3));
        let sel = []; try { sel = JSON.parse(previewEl.dataset.selected || '[]'); } catch (_) { sel = []; }
        sel = sel.filter(c => c && c.row < gy && c.col < gx);
        if (sel.length < 2) sel = [{ row: 0, col: 0 }, { row: 0, col: 1 }].filter(c => c.row < gy && c.col < gx);
        previewEl.dataset.selected = JSON.stringify(sel);
        previewEl.style.gridTemplateColumns = `repeat(${gx}, 42px)`;
        previewEl.innerHTML = '';
        for (let r = 0; r < gy; r++) for (let c = 0; c < gx; c++) {
            const on = sel.some(x => x.row === r && x.col === c);
            const cEl = document.createElement('div');
            cEl.className = 'cmp-grid-cell' + (on ? ' active' : '');
            cEl.textContent = `${r + 1},${c + 1}`;
            cEl.dataset.row = r; cEl.dataset.col = c; cEl.dataset.on = on ? '1' : '0';
            cEl.addEventListener('click', () => {
                const cur = JSON.parse(previewEl.dataset.selected || '[]');
                const was = cEl.dataset.on === '1';
                if (was && cur.length <= 2) { alert('Нужно минимум 2 активные клетки'); return; }
                cEl.dataset.on = was ? '0' : '1';
                cEl.classList.toggle('active', !was);
                const list = [];
                previewEl.querySelectorAll('[data-on="1"]').forEach(e2 => list.push({ row: parseInt(e2.dataset.row), col: parseInt(e2.dataset.col) }));
                previewEl.dataset.selected = JSON.stringify(list);
                renderCells();
            });
            previewEl.appendChild(cEl);
        }
        renderCells();
    }
    function readCells() {
        const c = document.getElementById('insp-cmp-cells'); if (!c) return [];
        const res = [];
        c.querySelectorAll('.cmp-cell-block').forEach(div => {
            const V = parseFloat(div.querySelector('.cmp-a').value) || 1.0;
            const sc = hexToRgb(div.querySelector('.cmp-sc').value);
            const bc = hexToRgb(div.querySelector('.cmp-bg').value);
            const d = parseInt(div.querySelector('.cmp-d').value) || 2000;
            const dist = node.stimDistance || trainingNode?.params?.distanceMeters || generalDistance || 1;
            const ppi = node.stimPPI || screenPPI || 96;
            res.push({ acuity: V, distance: dist, ppi, size: acuityToSizePx(V, dist, ppi), stimR: sc.r, stimG: sc.g, stimB: sc.b, bgR: bc.r, bgG: bc.g, bgB: bc.b, duration: d });
        });
        return res;
    }
    function renderCells() {
        const c = document.getElementById('insp-cmp-cells'); if (!c) return;
        const saved = readCells(); c.innerHTML = '';
        let sel = []; try { sel = JSON.parse(previewEl.dataset.selected || '[]'); } catch (_) { sel = []; }
        sel.forEach((cell, idx) => {
            const p = saved[idx] || saved[saved.length - 1] || defaultCompareCellParams();
            const div = document.createElement('div'); div.className = 'cmp-cell-block';
            let opts = '';
            for (let i = 1; i <= 20; i++) { const v = i / 10; opts += `<option value="${v.toFixed(1)}" ${Math.abs((p.acuity || 1) - v) < 0.001 ? 'selected' : ''}>${v.toFixed(1)}</option>`; }
            div.innerHTML = `<label><b>Клетка (${cell.row + 1}, ${cell.col + 1})</b></label>
                <label>V</label><select class="cmp-a">${opts}</select>
                <label>Цвет стимула</label><input type="color" class="cmp-sc" value="${rgbToHex(p.stimR, p.stimG, p.stimB)}">
                <label>Цвет фона</label><input type="color" class="cmp-bg" value="${rgbToHex(p.bgR, p.bgG, p.bgB)}">
                <label>Время (мс)</label><input type="number" class="cmp-d" value="${p.duration || 2000}" min="200" max="5000">`;
            c.appendChild(div);
        });
    }
    inspectorEl._cmpReadCells = readCells;
    inspectorEl._cmpReadGrid = () => JSON.parse(previewEl.dataset.selected || '[]');
    renderGrid();
    document.getElementById('inp-cmp-gx')?.addEventListener('input', renderGrid);
    document.getElementById('inp-cmp-gy')?.addEventListener('input', renderGrid);
    document.getElementById('inp-cmp-mode')?.addEventListener('change', e => {
        const b = document.getElementById('insp-cmp-pairs-block');
        if (b) b.style.display = e.target.value === 'find_same' ? 'block' : 'none';
    });
}
function updateReadingInspector(node) {
    const hasOwn = !!(node.bookId && window._books[node.bookId]);
    let bookHtml;
    if (hasOwn) bookHtml = `<span style="color:#7dd3fc;">${escapeHtml(node.bookName || '(без имени)')}</span>`;
    else if (node.bookName) bookHtml = `<span style="color:#f59e0b;">${escapeHtml(node.bookName)} ⚠</span>`;
    else bookHtml = `<span style="color:#94a3b8;">Книга из сессии</span>`;
    let html = '<h2>Инспектор</h2><div class="insp-cols">';
    html += '<div class="panel-section"><h3>📖 Чтение</h3>';
    html += `<label>Название узла</label><input type="text" id="inp-name" value="${escapeHtml(node.name)}">`;
    html += `<label>Книга</label><div style="padding:6px 8px;background:#0b0b14;border-radius:3px;font-size:11px;margin-bottom:4px;">${bookHtml}</div>`;
    html += `<button class="btn btn-reading" id="inp-reading-choose-book" style="width:100%;margin-bottom:4px;">📚 ${hasOwn ? 'Сменить книгу' : 'Задать книгу'}</button></div>`;
    html += '<div class="panel-section" style="background:#0a1020;border-color:#0ea5e9;">';
    html += '<h3 style="color:#38bdf8;border-color:#0ea5e9;">Отображение</h3>';
    html += `<label>Шрифт</label><input type="text" id="inp-reading-font" value="${escapeHtml(node.readingFontFamily || 'Segoe UI')}">`;
    html += `<label><input type="checkbox" id="inp-reading-bold" ${node.readingFontWeight === 'bold' ? 'checked' : ''}> Жирный</label>`;
    let acOpts = '';
    for (let i = 1; i <= 20; i++) {
        const v = i / 10, m = acuityToSizeMm(v, 1);
        acOpts += `<option value="${v.toFixed(1)}" ${Math.abs((node.readingAcuity || 1.0) - v) < 0.001 ? 'selected' : ''}>${v.toFixed(1)} — ${m.toFixed(2)} мм</option>`;
    }
    html += `<label>Острота зрения V</label><select id="inp-reading-acuity">${acOpts}</select>`;
    html += `<label>Дистанция чтения (м)</label><input type="number" id="inp-reading-distance" value="${(node.readingDistance || readingDistance || 1).toFixed(1)}" min="0.1" max="20" step="0.1">`;
    html += `<label>Цвет текста</label><input type="color" id="inp-reading-text-color" value="${rgbToHex(node.readingTextColor?.r, node.readingTextColor?.g, node.readingTextColor?.b)}"></div>`;
    html += '<div class="panel-section" style="background:#0a1a1a;border-color:#14b8a6;">';
    html += '<h3 style="color:#2dd4bf;border-color:#14b8a6;">Фон</h3>';
    html += `<label>Тип фона</label><select id="inp-reading-bg-mode">
        <option value="solid" ${(node.readingBgMode||'solid')==='solid'?'selected':''}>Сплошной</option>
        <option value="split" ${node.readingBgMode==='split'?'selected':''}>Две половины</option>
        <option value="gradient" ${node.readingBgMode==='gradient'?'selected':''}>Градиент</option>
        <option value="dynamic" ${node.readingBgMode==='dynamic'?'selected':''}>Динамический</option></select>`;
    html += `<div id="insp-rd-solid" style="display:${(node.readingBgMode||'solid')==='solid'?'block':'none'};margin-top:6px;"><label>Цвет фона</label><input type="color" id="inp-rd-bg-color" value="${rgbToHex(node.readingBgColor?.r, node.readingBgColor?.g, node.readingBgColor?.b)}"></div>`;
    html += `<div id="insp-rd-split" style="display:${node.readingBgMode==='split'?'block':'none'};margin-top:6px;"><label>Ширина левой (%)</label><input type="number" id="inp-rd-split-left-width" value="${node.readingSplitLeftWidthPercent ?? 50}" min="0" max="100"><label>Цвет левой</label><input type="color" id="inp-rd-split-left-color" value="${rgbToHex(node.readingSplitLeftColor?.r, node.readingSplitLeftColor?.g, node.readingSplitLeftColor?.b)}"><label>Цвет правой</label><input type="color" id="inp-rd-split-right-color" value="${rgbToHex(node.readingSplitRightColor?.r, node.readingSplitRightColor?.g, node.readingSplitRightColor?.b)}"></div>`;
    html += `<div id="insp-rd-gradient" style="display:${node.readingBgMode==='gradient'?'block':'none'};margin-top:6px;"><label><input type="checkbox" id="inp-rd-grad-mid-enabled" ${node.readingGradientMidEnabled !== false ? 'checked' : ''}> Цвет 3</label><label>Цвет 1</label><input type="color" id="inp-rd-grad-left-color" value="${rgbToHex(node.readingGradientLeftColor?.r, node.readingGradientLeftColor?.g, node.readingGradientLeftColor?.b)}"><div id="insp-rd-grad-mid-row" style="display:${node.readingGradientMidEnabled !== false ? 'block':'none'};"><label>Цвет 3</label><input type="color" id="inp-rd-grad-mid-color" value="${rgbToHex(node.readingGradientMidColor?.r, node.readingGradientMidColor?.g, node.readingGradientMidColor?.b)}"><label>Позиция (%)</label><input type="number" id="inp-rd-grad-mid-pos" value="${node.readingGradientMidPosition ?? 50}" min="0" max="100"></div><label>Цвет 2</label><input type="color" id="inp-rd-grad-right-color" value="${rgbToHex(node.readingGradientRightColor?.r, node.readingGradientRightColor?.g, node.readingGradientRightColor?.b)}"></div>`;
    html += `<div id="insp-rd-dynamic" style="display:${node.readingBgMode==='dynamic'?'block':'none'};margin-top:6px;"><label>Режим динамики</label><select id="inp-rd-dyn-mode"><option value="simple" ${(node.readingDynamicMode||'simple')==='simple'?'selected':''}>A→B</option><option value="rgb" ${node.readingDynamicMode==='rgb'?'selected':''}>RGB</option><option value="physiological" ${node.readingDynamicMode==='physiological'?'selected':''}>Физиологический</option></select><label>Цвет A</label><input type="color" id="inp-rd-dyn-start" value="${rgbToHex(node.readingDynamicStartColor?.r, node.readingDynamicStartColor?.g, node.readingDynamicStartColor?.b)}"><label>Цвет B</label><input type="color" id="inp-rd-dyn-end" value="${rgbToHex(node.readingDynamicEndColor?.r, node.readingDynamicEndColor?.g, node.readingDynamicEndColor?.b)}"><label>Время цикла (с)</label><input type="number" id="inp-rd-dyn-duration" value="${(node.readingDynamicDuration||10000)/1000}" min="0.1" step="0.1"><label><input type="checkbox" id="inp-rd-dyn-loop" ${node.readingDynamicLoop?'checked':''}> Повторять</label><label><input type="checkbox" id="inp-rd-dyn-reverse" ${node.readingDynamicReverse?'checked':''}> Пинг-понг</label></div></div>`;
    html += '<div class="panel-section" style="background:#0a1a0a;border-color:#10b981;">';
    html += '<h3 style="color:#34d399;border-color:#10b981;">⏱ Время показа</h3>';
    const du = detectUnit(node.duration || 0), dv = node.duration > 0 ? msToUnit(node.duration, du) : 0;
    html += `<div class="time-group"><input type="number" id="inp-reading-duration" value="${dv}" step="any" min="0"><select id="inp-reading-duration-unit"><option value="ms" ${du==='ms'?'selected':''}>мс</option><option value="s" ${du==='s'?'selected':''}>с</option><option value="min" ${du==='min'?'selected':''}>мин</option></select></div>`;
    html += `<div class="acuity-hint" style="margin-top:4px;">0 = до кнопки</div>`;
    html += `<label><input type="checkbox" id="inp-reading-autosave" ${node.autoSaveBookmark !== false ? 'checked' : ''}> Автосохранение</label>`;
    html += `<label><input type="checkbox" id="inp-active" ${node.isActive !== false ? 'checked' : ''}> Активный узел</label></div></div>`;
    html += '<button class="btn btn-success" id="inp-apply" style="width:100%;margin-top:6px;">💾 Применить</button>';
    inspectorEl.innerHTML = html;
    const bgModeSel = document.getElementById('inp-reading-bg-mode');
    if (bgModeSel) bgModeSel.addEventListener('change', () => {
        const m = bgModeSel.value;
        document.getElementById('insp-rd-solid').style.display = m === 'solid' ? 'block' : 'none';
        document.getElementById('insp-rd-split').style.display = m === 'split' ? 'block' : 'none';
        document.getElementById('insp-rd-gradient').style.display = m === 'gradient' ? 'block' : 'none';
        document.getElementById('insp-rd-dynamic').style.display = m === 'dynamic' ? 'block' : 'none';
    });
    const gmc = document.getElementById('inp-rd-grad-mid-enabled');
    if (gmc) gmc.addEventListener('change', () => { document.getElementById('insp-rd-grad-mid-row').style.display = gmc.checked ? 'block' : 'none'; });
}

function initInspectorEvents() { inspectorEl.addEventListener('click', e => { if (e.target.id === 'inp-apply') applyInspectorChanges(); else if (e.target.id === 'inp-reading-choose-book') openBookPicker(); }); }
function applyInspectorChanges() {
    if (!activeNodeId) return;
    const node = getNode(activeNodeId);
    if (!node) return;
    if (node.nodeType === 'READING') { applyReadingInspectorChanges(node); requestRenderGraph(); updateInspector(); return; }
    if (node.nodeType === 'LOGIC_IF') { const n = document.getElementById('inp-name'); if (n) node.name = n.value; requestRenderGraph(); updateInspector(); return; }
    if (node.nodeType === 'COMPARE') { applyCompareInspectorChanges(node); requestRenderGraph(); updateInspector(); return; }
    applyStimulusInspectorChanges(node);
    requestRenderGraph(); updateInspector();
}
function applyPeriInspectorChanges(node) {
    const v = id => document.getElementById(id);
    if (v('inp-peri-enabled')) node.periEnabled = v('inp-peri-enabled').checked;
    if (v('inp-peri-count')) node.periCount = Math.max(1, Math.min(12, parseInt(v('inp-peri-count').value) || 4));
    if (v('inp-peri-acuity')) node.periAcuity = Math.max(0.1, Math.min(1.0, parseFloat(v('inp-peri-acuity').value) || 0.3));
    if (v('inp-peri-rmin')) node.periRadiusMinPct = Math.max(20, Math.min(100, parseInt(v('inp-peri-rmin').value) || 60));
    if (v('inp-peri-rmax')) node.periRadiusMaxPct = Math.max(20, Math.min(100, parseInt(v('inp-peri-rmax').value) || 90));
    if (v('inp-peri-color')) node.periColor = hexToRgb(v('inp-peri-color').value);
    if (v('inp-peri-motion')) node.periMotion = v('inp-peri-motion').value;
    if (v('inp-peri-speed')) node.periSpeed = Math.max(0.02, Math.min(5, parseFloat(v('inp-peri-speed').value) || 0.3));
    if (v('inp-peri-random')) node.periRandomAngles = v('inp-peri-random').checked;
}
function applyDefocusInspectorChanges(node) {
    const v = id => document.getElementById(id);
    if (v('inp-df-enabled')) node.dfEnabled = v('inp-df-enabled').checked;
    if (v('inp-df-radius-mm')) node.dfCenterRadiusMm = Math.max(3, Math.min(50, parseFloat(v('inp-df-radius-mm').value) || 13));
    if (v('inp-df-center-bg')) node.dfCenterBg = hexToRgb(v('inp-df-center-bg').value);
    if (v('inp-df-stim-color')) node.dfStimColor = hexToRgb(v('inp-df-stim-color').value);
    if (v('inp-df-peri-bg')) node.dfPeriBg = hexToRgb(v('inp-df-peri-bg').value);
    if (v('inp-df-blur')) node.dfPeriBlur = Math.max(0, Math.min(100, parseInt(v('inp-df-blur').value) || 0));
}
function applyBlinkAnimationInspectorChanges(node) {
    const v = id => document.getElementById(id);
    const el = v('inp-blink-enabled');
    if (el) node.blinkEnabled = el.checked;
    const t = v('inp-blink-target'); if (t) node.blinkTarget = t.value;
    const cA = v('inp-blink-cA'); if (cA) node.blinkColorA = hexToRgb(cA.value);
    const cB = v('inp-blink-cB'); if (cB) node.blinkColorB = hexToRgb(cB.value);
    const iv = v('inp-blink-interval'); if (iv) node.blinkIntervalMs = Math.max(50, Math.min(5000, parseInt(iv.value) || 500));
    const dt = v('inp-blink-duty'); if (dt) node.blinkDuty = Math.max(0.05, Math.min(0.95, parseFloat(dt.value) || 0.5));
    const cn = v('inp-blink-count'); if (cn) node.blinkCount = Math.max(0, parseInt(cn.value) || 0);
}
function applyStimulusInspectorChanges(node) {
    const v = id => document.getElementById(id);
    if (v('inp-name')) node.name = v('inp-name').value;
    if (v('inp-type')) node.stimType = v('inp-type').value;
    if (v('inp-active')) node.isActive = v('inp-active').checked;
    if (v('inp-acuity')) node.stimAcuity = parseFloat(v('inp-acuity').value) || 1.0;
    if (v('inp-end-acuity')) node.endAcuity = parseFloat(v('inp-end-acuity').value) || node.stimAcuity;
    if (v('inp-acuity-step')) node.acuityStep = parseFloat(v('inp-acuity-step').value) || 0.1;
    if (v('inp-distance')) node.stimDistance = parseFloat(v('inp-distance').value) || 1;
    if (v('inp-ppi')) node.stimPPI = parseInt(v('inp-ppi').value) || screenPPI || 96;
    node.stimSize = getNodeComputedSize(node);
    if (v('inp-color')) { const c = hexToRgb(v('inp-color').value); node.stimR = c.r; node.stimG = c.g; node.stimB = c.b; }
    if (v('inp-bg')) { const c = hexToRgb(v('inp-bg').value); node.bgR = c.r; node.bgG = c.g; node.bgB = c.b; }
    if (v('inp-series-count')) node.seriesCount = Math.max(1, parseInt(v('inp-series-count').value) || 5);
    if (v('inp-series-size')) node.seriesSize = Math.max(1, parseInt(v('inp-series-size').value) || 6);
    if (v('inp-series-threshold')) node.seriesThreshold = Math.max(1, parseInt(v('inp-series-threshold').value) || 4);
    if (v('inp-random-pos')) node.singleRandomPos = v('inp-random-pos').checked;
    if (v('inp-grid-enabled')) node.singleGridEnabled = v('inp-grid-enabled').checked;
    if (v('inp-grid-x')) node.singleGridX = Math.max(1, Math.min(10, parseInt(v('inp-grid-x').value) || 3));
    if (v('inp-grid-y')) node.singleGridY = Math.max(1, Math.min(10, parseInt(v('inp-grid-y').value) || 3));
    if (v('inp-grid-show-lines')) node.singleGridShowLines = v('inp-grid-show-lines').checked;
    if (v('inp-grid-random')) node.singleGridRandomCell = v('inp-grid-random').checked;
    if (v('inp-grid-avoid-repeat')) node.singleGridAvoidRepeat = v('inp-grid-avoid-repeat').checked;
    const prev = document.getElementById('insp-grid-preview');
    if (prev) {
        try {
            const cells = JSON.parse(prev.dataset.selected || '[]');
            const gx = node.singleGridX || 3, gy = node.singleGridY || 3;
            node.singleGridCells = cells.filter(c => c && typeof c.row === 'number' && typeof c.col === 'number' && c.row >= 0 && c.row < gy && c.col >= 0 && c.col < gx);
        } catch (_) { node.singleGridCells = []; }
    }
    if (v('inp-stim-dyn-enabled')) node.singleStimDynamicEnabled = v('inp-stim-dyn-enabled').checked;
    if (v('inp-sti-mid-enabled')) node.singleStimMidEnabled = v('inp-sti-mid-enabled').checked;
    if (v('inp-sti-color1')) node.singleStimColor1 = hexToRgb(v('inp-sti-color1').value);
    if (v('inp-sti-color3')) node.singleStimColor3 = hexToRgb(v('inp-sti-color3').value);
    if (v('inp-sti-color2')) node.singleStimColor2 = hexToRgb(v('inp-sti-color2').value);
    if (v('inp-sti-duration')) node.singleStimDuration = Math.max(200, (parseFloat(v('inp-sti-duration').value) || 10) * 1000);
    if (v('inp-sti-loop')) node.singleStimLoop = v('inp-sti-loop').checked;
    if (v('inp-sti-reverse')) node.singleStimReverse = v('inp-sti-reverse').checked;
    if (v('inp-bg-dyn-enabled')) node.singleBgDynamicEnabled = v('inp-bg-dyn-enabled').checked;
    if (v('inp-bg-mid-enabled')) node.singleBgMidEnabled = v('inp-bg-mid-enabled').checked;
    if (v('inp-bg-color1')) node.singleBgColor1 = hexToRgb(v('inp-bg-color1').value);
    if (v('inp-bg-color3')) node.singleBgColor3 = hexToRgb(v('inp-bg-color3').value);
    if (v('inp-bg-color2')) node.singleBgColor2 = hexToRgb(v('inp-bg-color2').value);
    if (v('inp-bg-duration')) node.singleBgDuration = Math.max(200, (parseFloat(v('inp-bg-duration').value) || 10) * 1000);
    if (v('inp-bg-loop')) node.singleBgLoop = v('inp-bg-loop').checked;
    if (v('inp-bg-reverse')) node.singleBgReverse = v('inp-bg-reverse').checked;
    if (v('inp-circle-enabled')) node.singleCircleEnabled = v('inp-circle-enabled').checked;
    if (v('inp-ci-enabled')) node.circleInnerEnabled = v('inp-ci-enabled').checked;
    if (v('inp-ci-radius')) node.circleInnerRadiusPct = Math.max(5, Math.min(95, parseInt(v('inp-ci-radius').value) || 40));
    if (v('inp-ci-c1')) node.circleInnerColor1 = hexToRgb(v('inp-ci-c1').value);
    if (v('inp-ci-mid-enabled')) node.circleInnerMidEnabled = v('inp-ci-mid-enabled').checked;
    if (v('inp-ci-c3')) node.circleInnerColor3 = hexToRgb(v('inp-ci-c3').value);
    if (v('inp-ci-c2')) node.circleInnerColor2 = hexToRgb(v('inp-ci-c2').value);
    if (v('inp-ci-duration')) node.circleInnerDuration = Math.max(200, (parseFloat(v('inp-ci-duration').value) || 10) * 1000);
    if (v('inp-ci-loop')) node.circleInnerLoop = v('inp-ci-loop').checked;
    if (v('inp-ci-reverse')) node.circleInnerReverse = v('inp-ci-reverse').checked;
    if (v('inp-co-enabled')) node.circleOuterEnabled = v('inp-co-enabled').checked;
    if (v('inp-co-c1')) node.circleOuterColor1 = hexToRgb(v('inp-co-c1').value);
    if (v('inp-co-mid-enabled')) node.circleOuterMidEnabled = v('inp-co-mid-enabled').checked;
    if (v('inp-co-c3')) node.circleOuterColor3 = hexToRgb(v('inp-co-c3').value);
    if (v('inp-co-c2')) node.circleOuterColor2 = hexToRgb(v('inp-co-c2').value);
    if (v('inp-co-duration')) node.circleOuterDuration = Math.max(200, (parseFloat(v('inp-co-duration').value) || 10) * 1000);
    if (v('inp-co-loop')) node.circleOuterLoop = v('inp-co-loop').checked;
    if (v('inp-co-reverse')) node.circleOuterReverse = v('inp-co-reverse').checked;
    applyPeriInspectorChanges(node);
    applyDefocusInspectorChanges(node);
    applyBlinkAnimationInspectorChanges(node);
    ['delay1', 'duration', 'response', 'delay2'].forEach(f => {
        const ni = document.getElementById('inp-' + f), us = document.getElementById('inp-' + f + '-unit');
        if (ni && us) node[f] = unitToMs(parseFloat(ni.value) || 0, us.value);
    });
}
function applyCompareInspectorChanges(node) {
    const v = id => document.getElementById(id);
    if (v('inp-name')) node.name = v('inp-name').value;
    if (v('inp-active')) node.isActive = v('inp-active').checked;
    if (v('inp-cmp-mode')) node.compareMode = v('inp-cmp-mode').value;
    if (v('inp-cmp-pairs')) node.pairsCount = Math.max(1, Math.min(20, parseInt(v('inp-cmp-pairs').value) || 2));
    if (v('inp-cmp-gx')) node.gridX = Math.max(2, Math.min(6, parseInt(v('inp-cmp-gx').value) || 3));
    if (v('inp-cmp-gy')) node.gridY = Math.max(1, Math.min(6, parseInt(v('inp-cmp-gy').value) || 3));
    if (typeof inspectorEl._cmpReadGrid === 'function') {
        const cells = inspectorEl._cmpReadGrid();
        if (Array.isArray(cells) && cells.length >= 2) node.activeCells = cells;
    }
    if (typeof inspectorEl._cmpReadCells === 'function') {
        const params = inspectorEl._cmpReadCells();
        if (Array.isArray(params) && params.length > 0) {
            while (params.length < (node.activeCells || []).length) params.push(params[params.length - 1]);
            node.cellParams = params.slice(0, node.activeCells.length);
        }
    }
    if (v('inp-cmp-sc')) node.seriesCount = Math.max(1, parseInt(v('inp-cmp-sc').value) || 5);
    if (v('inp-cmp-ss')) node.seriesSize = Math.max(1, parseInt(v('inp-cmp-ss').value) || 6);
    if (v('inp-cmp-st')) node.seriesThreshold = Math.max(1, parseInt(v('inp-cmp-st').value) || 4);
    if (v('inp-cmp-d1')) node.delay1 = Math.max(0, parseInt(v('inp-cmp-d1').value) || 1000);
    if (v('inp-cmp-dur')) node.duration = Math.max(200, parseInt(v('inp-cmp-dur').value) || 2000);
    if (v('inp-cmp-d2')) node.delay2 = Math.max(0, parseInt(v('inp-cmp-d2').value) || 1000);
}
function applyReadingInspectorChanges(node) {
    const v = id => document.getElementById(id);
    if (v('inp-name')) node.name = v('inp-name').value;
    if (v('inp-reading-font')) node.readingFontFamily = v('inp-reading-font').value || 'Segoe UI';
    if (v('inp-reading-bold')) node.readingFontWeight = v('inp-reading-bold').checked ? 'bold' : 'normal';
    if (v('inp-reading-acuity')) node.readingAcuity = parseFloat(v('inp-reading-acuity').value) || 1.0;
    const rdEl = v('inp-reading-distance');
    if (rdEl) { const n = parseFloat(rdEl.value); if (!isNaN(n) && n > 0) { node.readingDistance = n; readingDistance = n; saveUserSettings(); } }
    if (v('inp-reading-text-color')) node.readingTextColor = hexToRgb(v('inp-reading-text-color').value);
    if (v('inp-reading-bg-mode')) node.readingBgMode = v('inp-reading-bg-mode').value;
    if (v('inp-rd-bg-color')) node.readingBgColor = hexToRgb(v('inp-rd-bg-color').value);
    if (v('inp-rd-split-left-width')) node.readingSplitLeftWidthPercent = parseInt(v('inp-rd-split-left-width').value) || 50;
    if (v('inp-rd-split-left-color')) node.readingSplitLeftColor = hexToRgb(v('inp-rd-split-left-color').value);
    if (v('inp-rd-split-right-color')) node.readingSplitRightColor = hexToRgb(v('inp-rd-split-right-color').value);
    if (v('inp-rd-grad-mid-enabled')) node.readingGradientMidEnabled = v('inp-rd-grad-mid-enabled').checked;
    if (v('inp-rd-grad-left-color')) node.readingGradientLeftColor = hexToRgb(v('inp-rd-grad-left-color').value);
    if (v('inp-rd-grad-mid-color')) node.readingGradientMidColor = hexToRgb(v('inp-rd-grad-mid-color').value);
    if (v('inp-rd-grad-mid-pos')) node.readingGradientMidPosition = parseInt(v('inp-rd-grad-mid-pos').value) || 50;
    if (v('inp-rd-grad-right-color')) node.readingGradientRightColor = hexToRgb(v('inp-rd-grad-right-color').value);
    if (v('inp-rd-dyn-mode')) node.readingDynamicMode = v('inp-rd-dyn-mode').value;
    if (v('inp-rd-dyn-start')) node.readingDynamicStartColor = hexToRgb(v('inp-rd-dyn-start').value);
    if (v('inp-rd-dyn-end')) node.readingDynamicEndColor = hexToRgb(v('inp-rd-dyn-end').value);
    if (v('inp-rd-dyn-duration')) node.readingDynamicDuration = Math.max(200, (parseFloat(v('inp-rd-dyn-duration').value) || 10) * 1000);
    if (v('inp-rd-dyn-loop')) node.readingDynamicLoop = v('inp-rd-dyn-loop').checked;
    if (v('inp-rd-dyn-reverse')) node.readingDynamicReverse = v('inp-rd-dyn-reverse').checked;
    const durEl = v('inp-reading-duration'), durU = v('inp-reading-duration-unit');
    if (durEl && durU) { const val = parseFloat(durEl.value) || 0; node.duration = val > 0 ? unitToMs(val, durU.value) : 0; }
    if (v('inp-reading-autosave')) node.autoSaveBookmark = v('inp-reading-autosave').checked;
    if (v('inp-active')) node.isActive = v('inp-active').checked;
}

// ==================== BOOK PICKER ====================
function openBookPicker() { const n = getNode(activeNodeId); if (!n || n.nodeType !== 'READING') return; renderBookPickerList(); const f = document.getElementById('book-picker-file-name'); if (f) f.textContent = ''; const i = document.getElementById('book-picker-file'); if (i) i.value = ''; document.getElementById('book-picker-modal').style.display = 'flex'; }
function closeBookPicker() { document.getElementById('book-picker-modal').style.display = 'none'; }
function renderBookPickerList() {
    const c = document.getElementById('book-picker-list'); if (!c) return;
    const node = getNode(activeNodeId), cur = node?.bookId || null;
    const ids = Object.keys(window._books);
    if (ids.length === 0) { c.innerHTML = '<div class="book-picker-empty">Пока нет книг.</div>'; return; }
    ids.sort((a, b) => (window._books[a].name || '').toLowerCase().localeCompare((window._books[b].name || '').toLowerCase()));
    c.innerHTML = '';
    ids.forEach(id => {
        const bk = window._books[id];
        const item = document.createElement('div');
        item.className = 'book-picker-item' + (id === cur ? ' active' : '');
        const kb = Math.round((bk.text || '').length / 1024);
        item.innerHTML = `<div><div class="name">${escapeHtml(bk.name || '(без имени)')}</div><div class="meta">${kb} КБ · ID ${id.slice(0,8)}…</div></div><div style="color:#7dd3fc;font-size:12px;">${id === cur ? '✓' : 'Выбрать'}</div>`;
        item.addEventListener('click', () => applyBookSelection(id));
        c.appendChild(item);
    });
}
function applyBookSelection(bookId) { const node = getNode(activeNodeId); if (!node || node.nodeType !== 'READING') return; const bk = window._books[bookId]; if (!bk) { alert('Книга не найдена'); return; } node.bookId = bookId; node.bookName = bk.name || '(без имени)'; setLastBookId(bookId); closeBookPicker(); requestRenderGraph(); updateInspector(); }
function detachBookFromActiveNode() { const node = getNode(activeNodeId); if (!node || node.nodeType !== 'READING') return; node.bookId = null; node.bookName = ''; closeBookPicker(); requestRenderGraph(); updateInspector(); }
async function handleBookPickerFileUpload(file) {
    if (!file) return;
    const n = (file.name || '').toLowerCase();
    if (!(n.endsWith('.txt') || n.endsWith('.fb2') || n.endsWith('.epub'))) { alert('Поддерживаются .txt, .fb2, .epub'); return; }
    const f = document.getElementById('book-picker-file-name'); if (f) f.textContent = '⏳ Загрузка: ' + file.name;
    try {
        const text = await parseReadingFile(file);
        const clean = (text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        if (!clean) { alert('Не удалось извлечь текст.'); return; }
        const id = await sha1(clean);
        if (!window._books[id]) window._books[id] = { name: file.name, text: clean };
        if (f) f.textContent = `✅ ${file.name} (${clean.length} символов)`;
        applyBookSelection(id);
    } catch (err) { alert('Ошибка: ' + err.message); }
}

// ==================== РЕЖИМ ЧТЕНИЯ ====================
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

function applyReadingFontForNode(node) { if (!readingContentEl) return; const family = (node.readingFontFamily && node.readingFontFamily.trim()) || 'Segoe UI'; const safe = family.replace(/['"]/g, ''); readingContentEl.style.fontFamily = safe.toLowerCase() === 'sivtsev' ? `'Sivtsev', 'Segoe UI', sans-serif` : `'${safe}', 'Segoe UI', Tahoma, sans-serif`; readingContentEl.style.fontWeight = node.readingFontWeight || 'normal'; }
function setupReadingColumns() { if (!readingViewportEl || !readingContentEl) return; const vw = readingViewportEl.clientWidth; if (vw <= 0) return; const sp = 80, tw = Math.max(200, vw - sp); readingContentEl.style.columnWidth = tw + 'px'; readingContentEl.style.columnGap = sp + 'px'; }
function calcReadingTotalPages() { if (!readingViewportEl || !readingContentEl) return 1; const W = readingViewportEl.clientWidth; if (W <= 0) return 1; return Math.max(1, Math.round(readingContentEl.scrollWidth / W)); }
function scrollReadingToPage(page) { if (!readingViewportEl) return; readingTotalPages = calcReadingTotalPages(); readingPage = Math.max(0, Math.min(page, readingTotalPages - 1)); readingViewportEl.scrollLeft = readingPage * readingViewportEl.clientWidth; const info = document.getElementById('reading-page-info'); if (info) info.textContent = `Стр. ${readingPage + 1} / ${readingTotalPages}`; }
function prevReadingPage() { if (readingPage > 0) scrollReadingToPage(readingPage - 1); }
function nextReadingPage() { if (readingPage < readingTotalPages - 1) scrollReadingToPage(readingPage + 1); }
function toggleReadingPause() { if (!readingContentEl) return; readingPaused = !readingPaused; const b = document.getElementById('reading-play-pause'); if (readingPaused) { readingContentEl.style.opacity = '0'; if (b) b.textContent = '▶ Чтение'; } else { readingContentEl.style.opacity = '1'; if (b) b.textContent = '⏸ Пауза'; } }
function saveReadingBookmark() { if (!window._currentReadingBookId) { alert('Нет книги'); return; } localStorage.setItem(bookmarkKeyFor(window._currentReadingBookId), JSON.stringify({ page: readingPage, updatedAt: new Date().toISOString() })); alert(`🔖 Закладка (страница ${readingPage + 1} из ${readingTotalPages})`); }
function openReadingBookmark() { if (!window._currentReadingBookId) { alert('Нет книги'); return; } const s = localStorage.getItem(bookmarkKeyFor(window._currentReadingBookId)); if (!s) { alert('Закладка не найдена'); return; } try { scrollReadingToPage(JSON.parse(s).page); } catch (e) { alert('Ошибка'); } }
function changeAcuityByStep(delta) { if (!window._currentReadingNodeId) return; const node = getNode(window._currentReadingNodeId); if (!node || node.nodeType !== 'READING') return; const nV = Math.max(0.1, Math.min(2.0, Math.round((node.readingAcuity + delta) * 10) / 10)); if (Math.abs(nV - node.readingAcuity) < 0.001) return; node.readingAcuity = nV; const d = currentDistanceMeters || node.readingDistance || readingDistance || 1; if (readingContentEl) readingContentEl.style.fontSize = acuityToFontSizePx(node.readingAcuity, d, node.readingPPI || screenPPI) + 'px'; setTimeout(() => { readingTotalPages = calcReadingTotalPages(); scrollReadingToPage(0); }, 60); }
function updateReadingFontIndicator() { const f = document.getElementById('reading-font-input'); if (f) f.value = readingFontFamily; const b = document.getElementById('reading-bold-toggle'); if (b) b.classList.toggle('active', readingFontWeight === 'bold'); }
function saveCurrentReadingBookmarkSilently() { if (!window._currentReadingBookId) return; try { localStorage.setItem(bookmarkKeyFor(window._currentReadingBookId), JSON.stringify({ page: readingPage, updatedAt: new Date().toISOString() })); window._currentReadingPage = readingPage; } catch (e) {} }
let readingBgAnimId = null, readingBgAnimStart = null, readingBgAnimPausedAt = null;
function buildPhysiologicalPhases(step) { const sd = Math.max(0.1, parseFloat(step) || 0.1); const sel = []; for (const p of PHYSIOLOGICAL_PHASES) { const r = p.diopters / sd; if (Math.abs(r - Math.round(r)) < 1e-6) sel.push(p); } const last = PHYSIOLOGICAL_PHASES[PHYSIOLOGICAL_PHASES.length - 1]; if (sel.length === 0 || sel[sel.length - 1] !== last) sel.push(last); const ph = []; for (let i = 0; i < sel.length - 1; i++) { const a = sel[i], b = sel[i + 1]; ph.push({ from: { r: a.rgb[0], g: a.rgb[1], b: a.rgb[2] }, to: { r: b.rgb[0], g: b.rgb[1], b: b.rgb[2] }, metaFrom: a, metaTo: b }); } return ph; }
function buildDynamicPhases(p) { const m = p.dynamicMode || 'simple', rev = p.dynamicReverse === true; let base; if (m === 'physiological') base = buildPhysiologicalPhases(p.dynamicStep || 0.1); else if (m === 'rgb') base = [{ from: { r: 255, g: 0, b: 0 }, to: { r: 255, g: 255, b: 0 } }, { from: { r: 255, g: 255, b: 0 }, to: { r: 0, g: 255, b: 0 } }, { from: { r: 0, g: 255, b: 0 }, to: { r: 0, g: 255, b: 255 } }, { from: { r: 0, g: 255, b: 255 }, to: { r: 0, g: 0, b: 255 } }]; else { const A = p.dynamicStartColor || { r: 255, g: 0, b: 0 }, B = p.dynamicEndColor || { r: 0, g: 0, b: 255 }; base = (p.dynamicMidEnabled && p.dynamicMidColor) ? [{ from: A, to: p.dynamicMidColor }, { from: p.dynamicMidColor, to: B }] : [{ from: A, to: B }]; } if (rev) return base.concat(base.slice().reverse().map(ph => ({ from: ph.to, to: ph.from, metaFrom: ph.metaTo, metaTo: ph.metaFrom }))); return base; }
function updatePhysioIndicator(meta, p) { const i = document.getElementById('physio-indicator'); if (!i) return; if (p && p.dynamicShowLabel === false) { i.style.display = 'none'; return; } if (!meta) { i.style.display = 'none'; return; } i.textContent = `${meta.diopters >= 0 ? '+' : ''}${meta.diopters.toFixed(1)} дптр • ${meta.wavelength_nm} нм • ${meta.name}`; i.style.display = 'block'; }
function startDynamicReadingBackground(p) {
    stopDynamicReadingBackground(); if (!readingViewportEl) return;
    const m = p.dynamicMode || 'simple', phases = buildDynamicPhases(p), cnt = phases.length;
    const rgb = m === 'rgb', phys = m === 'physiological', rev = p.dynamicReverse === true;
    const cycleMs = phys ? Math.max(100, p.dynamicStepDuration || 1000) * cnt : Math.max(100, p.dynamicDuration || 10000);
    const loop = p.dynamicLoop === true || rgb || rev || phys;
    const first = phases[0].from; readingViewportEl.style.background = `rgb(${first.r},${first.g},${first.b})`;
    if (phys) updatePhysioIndicator(phases[0].metaFrom, p); else updatePhysioIndicator(null, p);
    readingBgAnimStart = null; readingBgAnimPausedAt = null;
    function tick(now) {
        if (readingPaused) { if (readingBgAnimPausedAt === null) readingBgAnimPausedAt = now; readingBgAnimId = requestAnimationFrame(tick); return; }
        if (readingBgAnimPausedAt !== null) { readingBgAnimStart += (now - readingBgAnimPausedAt); readingBgAnimPausedAt = null; }
        if (readingBgAnimStart === null) readingBgAnimStart = now;
        let el = Math.max(0, now - readingBgAnimStart), t = el / cycleMs;
        if (t >= 1) { if (loop) { readingBgAnimStart += Math.floor(t) * cycleMs; el = Math.max(0, now - readingBgAnimStart); t = el / cycleMs; } else { const l = phases[cnt - 1].to; readingViewportEl.style.background = `rgb(${l.r},${l.g},${l.b})`; if (phys && phases[cnt - 1].metaTo) updatePhysioIndicator(phases[cnt - 1].metaTo, p); readingBgAnimId = null; return; } }
        t = Math.max(0, t);
        const pi = Math.max(0, Math.min(cnt - 1, Math.floor(t * cnt))), pp = Math.max(0, Math.min(1, (t * cnt) - pi));
        const ph = phases[pi]; if (!ph) { readingBgAnimId = null; return; }
        const c = lerpColor(ph.from, ph.to, pp);
        readingViewportEl.style.background = `rgb(${c.r},${c.g},${c.b})`;
        if (phys && (ph.metaFrom || ph.metaTo)) updatePhysioIndicator(pp < 0.5 ? ph.metaFrom : ph.metaTo, p);
        readingBgAnimId = requestAnimationFrame(tick);
    }
    readingBgAnimId = requestAnimationFrame(tick);
}
function stopDynamicReadingBackground() { if (readingBgAnimId) { cancelAnimationFrame(readingBgAnimId); readingBgAnimId = null; } readingBgAnimPausedAt = null; const i = document.getElementById('physio-indicator'); if (i) i.style.display = 'none'; }
function applyReadingBackground(p) {
    if (!readingViewportEl) return;
    const m = p.bgMode || 'solid';
    stopDynamicReadingBackground();
    if (m === 'split') { const lw = Math.max(0, Math.min(100, p.splitLeftWidthPercent ?? 50)); const lc = p.splitLeftColor || { r: 0, g: 0, b: 0 }, rc = p.splitRightColor || { r: 0, g: 0, b: 0 }; readingViewportEl.style.background = `linear-gradient(to right, rgb(${lc.r},${lc.g},${lc.b}) 0%, rgb(${lc.r},${lc.g},${lc.b}) ${lw}%, rgb(${rc.r},${rc.g},${rc.b}) ${lw}%, rgb(${rc.r},${rc.g},${rc.b}) 100%)`; return; }
    if (m === 'gradient') { const lc = p.gradientLeftColor || { r: 255, g: 255, b: 255 }, rc = p.gradientRightColor || { r: 0, g: 0, b: 0 }; if (p.gradientMidEnabled !== false) { const mc = p.gradientMidColor || { r: 204, g: 204, b: 204 }, mp = Math.max(0, Math.min(100, p.gradientMidPosition ?? 50)); readingViewportEl.style.background = `linear-gradient(to right, rgb(${lc.r},${lc.g},${lc.b}) 0%, rgb(${mc.r},${mc.g},${mc.b}) ${mp}%, rgb(${rc.r},${rc.g},${rc.b}) 100%)`; } else readingViewportEl.style.background = `linear-gradient(to right, rgb(${lc.r},${lc.g},${lc.b}) 0%, rgb(${rc.r},${rc.g},${rc.b}) 100%)`; return; }
    if (m === 'dynamic') { startDynamicReadingBackground(p); return; }
    const bg = p.bgColor || { r: 255, g: 255, b: 255 };
    readingViewportEl.style.background = `rgb(${bg.r},${bg.g},${bg.b})`;
}
function collectFontList() { const base = ['Sivtsev','Segoe UI','Arial','Times New Roman','Calibri','Verdana','Georgia','Tahoma','Trebuchet MS','Consolas','Courier New','Cambria','Garamond','Palatino Linotype','Comic Sans MS','Bookman Old Style','Franklin Gothic Medium','Century Gothic','Lucida Console','MS Sans Serif']; const seen = new Set(base.map(f => f.toLowerCase())); const dl = document.getElementById('reading-font-list'); if (dl) for (const o of dl.options) { const v = o.value; if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); base.push(v); } } return base; }
function renderFontPickerList(filter) { const c = document.getElementById('font-picker-list'); if (!c) return; const fonts = collectFontList(); const f = (filter || '').trim().toLowerCase(); const list = f ? fonts.filter(x => x.toLowerCase().includes(f)) : fonts; c.innerHTML = ''; if (list.length === 0) { c.innerHTML = '<div class="font-picker-empty">Ничего не найдено</div>'; return; } const cur = (readingFontFamily || '').toLowerCase(); list.forEach(name => { const item = document.createElement('div'); item.className = 'font-picker-item' + (name.toLowerCase() === cur ? ' active' : ''); const l = document.createElement('span'); l.textContent = name; l.style.fontFamily = `'${name.replace(/['"]/g, '')}', 'Segoe UI', sans-serif`; item.appendChild(l); const p = document.createElement('span'); p.className = 'preview'; p.textContent = 'АаБб 123'; p.style.fontFamily = `'${name.replace(/['"]/g, '')}', 'Segoe UI', sans-serif`; item.appendChild(p); item.addEventListener('click', () => { const node = getNode(window._currentReadingNodeId); if (node && node.nodeType === 'READING') { node.readingFontFamily = name; applyReadingFontForNode(node); requestRenderGraph(); } else { readingFontFamily = name; if (readingContentEl) readingContentEl.style.fontFamily = `'${name.replace(/['"]/g, '')}', 'Segoe UI', sans-serif`; } saveUserSettings(); closeFontPicker(); setTimeout(() => { setupReadingColumns(); readingTotalPages = calcReadingTotalPages(); scrollReadingToPage(0); }, 60); }); c.appendChild(item); }); }
function openFontPicker() { const m = document.getElementById('font-picker-modal'); if (!m) return; const s = document.getElementById('font-picker-search'); if (s) s.value = ''; renderFontPickerList(''); m.classList.add('visible'); setTimeout(() => s?.focus(), 50); }
function closeFontPicker() { const m = document.getElementById('font-picker-modal'); if (m) m.classList.remove('visible'); }

// ==================== COMPARE ====================
function showNextComparison() { if (!playerRunning || isPaused) return; if (seriesStep >= (trainingNode?.params?.seriesSize || 6)) { finishSeries(); return; } removeSingleGridLines(); stimDisplay.innerHTML = ''; stimArea.style.background = '#000'; responsePhaseActive = true; responseStartTime = performance.now(); lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null }; if (compareMode === 'direction') showDirectionComparison(); else if (compareMode === 'find_same') showFindSameComparison(); const dur = cellParams[0]?.duration || currentDuration; currentShowTimer = setTimeout(() => { if (responsePhaseActive) { lastResponse = { answered: false, isCorrect: false }; processComparisonAnswer(false); } }, dur); phaseTimers.push(currentShowTimer); }
function showDirectionComparison() { if (activeCells.length < 2) return; const sh = activeCells.slice().sort(() => Math.random() - 0.5); const cA = sh[0], cB = sh[1]; const d1 = randomDirection(), d2 = randomDirection(); currentCompareAnswer = (d1 === d2); createCellElement(cA, cellParams[0] || defaultCellParams(), d1, 0); createCellElement(cB, cellParams[1] || defaultCellParams(), d2, 1); document.querySelectorAll('.btn-response[data-dir]').forEach(b => b.style.display = 'none'); document.querySelectorAll('.btn-response[data-answer]').forEach(b => b.style.display = 'flex'); responseButtons.style.display = 'flex'; }
function showFindSameComparison() { const pc = Math.max(1, Math.min(20, parseInt(currentCompareNode?.pairsCount || trainingNode?.params?.pairsCount || 2))); const need = pc * 2; if (activeCells.length < need) { const maxP = Math.floor(activeCells.length / 2); if (maxP < 1) { processComparisonAnswer(false); return; } return showFindSameComparisonInternal(maxP); } showFindSameComparisonInternal(pc); }
function showFindSameComparisonInternal(pc) { const need = pc * 2; const sh = activeCells.slice().sort(() => Math.random() - 0.5); const chosen = sh.slice(0, need); const pairs = []; for (let i = 0; i < pc; i++) pairs.push({ cells: [chosen[i * 2], chosen[i * 2 + 1]], direction: randomDirection(), found: false }); _findSameState = { pairs, firstSelectedIdx: null, foundCells: new Set(), cells: chosen, pairsCount: pc }; chosen.forEach((cell, idx) => { const pi = Math.floor(idx / 2); const dir = pairs[pi].direction; const params = cellParams[idx] || cellParams[cellParams.length - 1] || defaultCellParams(); createCellElement(cell, params, dir, idx); }); responseButtons.style.display = 'none'; document.querySelectorAll('.grid-cell').forEach(el => { el.onclick = () => handleFindSameClick(parseInt(el.dataset.index)); }); }
function handleFindSameClick(idx) { if (!responsePhaseActive || !_findSameState || isNaN(idx)) return; const st = _findSameState; const cell = st.cells[idx]; const key = `${cell.row},${cell.col}`; if (st.foundCells.has(key)) return; if (st.firstSelectedIdx === null) { st.firstSelectedIdx = idx; flashCell(idx, 'selected'); return; } const fi = st.firstSelectedIdx; if (fi === idx) { st.firstSelectedIdx = null; flashCell(idx, 'unselect'); return; } const fp = Math.floor(fi / 2), sp = Math.floor(idx / 2); if (fp === sp) { const a = st.cells[fi], b = st.cells[idx]; st.foundCells.add(`${a.row},${a.col}`); st.foundCells.add(`${b.row},${b.col}`); st.pairs[fp].found = true; flashCell(fi, 'found'); flashCell(idx, 'found'); st.firstSelectedIdx = null; if (st.pairs.every(p => p.found)) { lastResponse = { answered: true, isCorrect: true, reactionTimeMs: performance.now() - responseStartTime }; responsePhaseActive = false; processComparisonAnswer(true); } } else { flashCell(fi, 'unselect'); flashCell(idx, 'wrong'); st.firstSelectedIdx = null; } }
function flashCell(idx, kind) { const el = document.querySelector(`.grid-cell[data-index="${idx}"]`); if (!el) return; const ob = el.style.border, os = el.style.boxShadow; if (kind === 'selected') { el.style.border = '3px solid #38bdf8'; el.style.boxShadow = '0 0 12px #38bdf8'; } else if (kind === 'found') { el.style.border = '4px solid #22c55e'; el.style.boxShadow = '0 0 20px #22c55e'; } else if (kind === 'wrong') { el.style.border = '4px solid #ef4444'; el.style.boxShadow = '0 0 20px #ef4444'; setTimeout(() => { el.style.border = ob; el.style.boxShadow = os; }, 400); } else if (kind === 'unselect') { el.style.border = ob; el.style.boxShadow = os; } }
function createCellElement(cell, params, direction, idx) { const cw = stimDisplay.offsetWidth / gridX, ch = stimDisplay.offsetHeight / gridY; const el = document.createElement('div'); el.className = 'grid-cell'; el.style.cssText = `left:${cell.col*cw}px;top:${cell.row*ch}px;width:${cw}px;height:${ch}px;display:flex;align-items:center;justify-content:center;background:rgb(${params.bgR||0},${params.bgG||0},${params.bgB||0});position:absolute;box-sizing:border-box;border:3px solid transparent;`; el.dataset.index = idx !== undefined ? idx : activeCells.indexOf(cell); const size = params.size || currentSize; const svgData = getStimulusSVG({ stimType: trainingNode?.params?.type || 'LETTER_E', stimDirection: direction, stimR: params.stimR || 255, stimG: params.stimG || 255, stimB: params.stimB || 255, bgR: params.bgR || 0, bgG: params.bgG || 0, bgB: params.bgB || 0 }, size); el.innerHTML = svgData.html; stimDisplay.appendChild(el); }
function processComparisonAnswer(isCorrect) {
    if (!playerRunning || isPaused) return;
    if (currentShowTimer) { clearTimeout(currentShowTimer); currentShowTimer = null; }
    if (currentCompareNode) {
        if (isCorrect) seriesCorrect++; else seriesIncorrect++;
        seriesStep++; updateCounters();
        const n = currentCompareNode;
        phaseTimers.push(setTimeout(() => { if (playerRunning && !isPaused) playNextCompareRound(n); }, n.delay2 || 1000));
        return;
    }
    if (isCorrect) seriesCorrect++; else seriesIncorrect++;
    seriesStep++; updateCounters();
    phaseTimers.push(setTimeout(() => { if (playerRunning && !isPaused) showNextComparison(); }, trainingNode?.params?.delay2 || 1000));
}
function defaultCellParams() { return { size: currentSize, stimR: currentStimColor.r, stimG: currentStimColor.g, stimB: currentStimColor.b, bgR: currentBgColor.r, bgG: currentBgColor.g, bgB: currentBgColor.b, duration: currentDuration }; }

// ==================== ОТВЕТЫ ====================
function handleDirectionAnswer(direction) { if (!responsePhaseActive) return; if (isBlinkResponseBlocked()) return; const ok = direction === currentCorrectDirection; lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: performance.now() - responseStartTime }; responsePhaseActive = false; if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true }); document.body.style.backgroundColor = ok ? '#0a0' : '#a00'; setTimeout(() => document.body.style.backgroundColor = '#111', 200); }
function handleCompareDirectionAnswer(answer) { if (!responsePhaseActive) return; if (isBlinkResponseBlocked()) return; const ok = (answer === currentCompareAnswer); lastResponse = { answered: true, isCorrect: ok, reactionTimeMs: performance.now() - responseStartTime }; responsePhaseActive = false; if (window.Voice) window.Voice.sayKey(ok ? 'correct' : 'wrong', { cancel: true }); document.body.style.backgroundColor = ok ? '#0a0' : '#a00'; setTimeout(() => document.body.style.backgroundColor = '#111', 200); processComparisonAnswer(ok); }
responseButtons.addEventListener('click', e => { const btn = e.target.closest('.btn-response'); if (!btn || !responsePhaseActive) return; if (btn.dataset.dir) handleDirectionAnswer(btn.dataset.dir); else if (btn.dataset.answer === 'да' || btn.dataset.answer === 'нет') { const inCmp = (currentCompareNode && currentCompareNode.compareMode === 'direction') || (!currentCompareNode && compareMode === 'direction' && trainingNode?.params?.trainingType === 'compare'); if (inCmp) handleCompareDirectionAnswer(btn.dataset.answer === 'да'); } });
document.addEventListener('keydown', e => {
    if (readingViewportEl && readingViewportEl.style.display === 'block') {
        if (e.key === 'ArrowLeft') { e.preventDefault(); prevReadingPage(); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); nextReadingPage(); return; }
        if (e.key === ' ') { e.preventDefault(); toggleReadingPause(); return; }
        if (e.key === 'Escape' && window._readingNodeWaiting) { e.preventDefault(); finishReadingNode(); return; }
    }
    if (!responsePhaseActive) return;
    const map = { 'ArrowUp':'вверх', 'ArrowDown':'вниз', 'ArrowLeft':'влево', 'ArrowRight':'вправо' };
    if (map[e.key]) {
        e.preventDefault();
        const inCmp = (currentCompareNode && currentCompareNode.compareMode === 'direction') || (!currentCompareNode && compareMode === 'direction' && trainingNode?.params?.trainingType === 'compare');
        if (inCmp) { if (e.key === 'ArrowLeft') handleCompareDirectionAnswer(true); else if (e.key === 'ArrowRight') handleCompareDirectionAnswer(false); }
        else handleDirectionAnswer(map[e.key]);
    }
});

// ==================== СЛУЖЕБНЫЕ ====================
function displayStimulus(html, bgColor) { stimDisplay.innerHTML = html; stimArea.style.backgroundColor = `rgb(${bgColor.r},${bgColor.g},${bgColor.b})`; }
function hideStimulus() { stopSingleStimAnimation(); stopSingleBgAnimation(); stopCircleAnimation(); stopPeripheralAnimation(); stopBlinkAnimation(); removeSingleGridLines(); stimDisplay.innerHTML = ''; stimDisplay.style.fontSize = ''; stimDisplay.style.color = ''; stimDisplay.style.backgroundColor = ''; stimDisplay.style.background = ''; stimArea.style.backgroundColor = ''; }
function updateCounters() { cntCompleted.textContent = completedSeries; cntSuccess.textContent = successfulSeries; cntFailed.textContent = failedSeries; cntSeriesCorrect.textContent = seriesCorrect; cntSeriesIncorrect.textContent = seriesIncorrect; cntSeriesNoAnswer.textContent = seriesNoAnswer; }
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

// ==================== ПЛЕЕР ====================
function startPlayer() { if (window._pendingGeneratorMode && trainingNode && trainingNode.params) { startAutoTraining(); return; } if (nodes.length > 0) { playNodesSequence(); return; } if (trainingNode && trainingNode.params) { startAutoTraining(); return; } alert('Создайте узел или настройте Режим'); }
function startAutoTraining() {
    if (currentMode === 'nodes') switchMode('stimuli');
    playerRunning = true; isPaused = false;
    completedSeries = successfulSeries = failedSeries = 0; seriesCorrect = seriesIncorrect = seriesNoAnswer = 0;
    noAnswerSeriesStreak = seriesStep = 0; lastDirection = null; currentSingleCell = { row: 0, col: 0 };
    currentCompareNode = null; readingCurrentNode = null;
    window._currentReadingBookId = null; window._currentReadingPage = 0; window._currentReadingNodeId = null;
    resetDistanceTracking(); resetBlinkState();
    screenPPI = trainingNode.params.ppi || screenPPI || 96;
    trainingDistance = trainingNode.params.distanceMeters || generalDistance || 1;
    const tt = trainingNode.params.trainingType || 'single';
    if (tt !== 'reading') currentAcuity = trainingNode.params.startAcuity || 0.5;
    currentSize = acuityToSizePx(currentAcuity, trainingDistance, screenPPI);
    distanceLog = []; distanceMin = distanceMax = null; distanceSum = distanceCount = 0; currentDuration = 2550;
    currentStimColor = trainingNode.params.startStimColor ? { ...trainingNode.params.startStimColor } : { r: 0, g: 255, b: 0 };
    currentBgColor = trainingNode.params.startBgColor ? { ...trainingNode.params.startBgColor } : { r: 0, g: 0, b: 0 };
    updateCounters();
    btnPlayer.disabled = true; btnPlayerStop.disabled = false; btnPlayerPause.disabled = false;
    btnPlayerPause.textContent = '⏸ Пауза';
    if (window.Voice) window.Voice.sayKey('ready', { cancel: true });
    if (tt === 'reading') { btnPlayerPause.disabled = true; startReadingModeAuto(); }
    else if (tt === 'compare') { compareMode = trainingNode.params.compareMode || 'direction'; gridX = trainingNode.params.gridX || 3; gridY = trainingNode.params.gridY || 3; activeCells = trainingNode.params.activeCells || []; cellParams = trainingNode.params.cellParams || []; if (activeCells.length === 0) activeCells = [{ row: 0, col: 0 }, { row: 0, col: 1 }]; if (cellParams.length < activeCells.length) cellParams = activeCells.map(() => defaultCellParams()); showNextComparison(); }
    else showNextStimulus();
}
function playNodesSequence() {
    buildPlayQueue(); if (playQueue.length === 0) { stopPlayer(); return; }
    if (currentMode === 'nodes') switchMode('stimuli');
    playerRunning = true; isPaused = false;
    completedSeries = successfulSeries = failedSeries = 0; seriesCorrect = seriesIncorrect = seriesNoAnswer = 0;
    noAnswerSeriesStreak = seriesStep = 0; currentSingleCell = { row: 0, col: 0 };
    currentCompareNode = null; readingCurrentNode = null;
    window._currentReadingBookId = null; window._currentReadingPage = 0; window._currentReadingNodeId = null;
    currentPlayingNodeId = null;
    resetDistanceTracking(); resetBlinkState();
    btnPlayer.disabled = true; btnPlayerStop.disabled = false; btnPlayerPause.disabled = false;
    btnPlayerPause.textContent = '⏸ Пауза';
    if (window.Voice) window.Voice.sayKey('ready', { cancel: true });
    playIndex = 0; playNextQueuedNode();
}
function playNextQueuedNode() {
    if (!playerRunning || isPaused) return;
    if (playIndex >= playQueue.length) { stopPlayer(); alert('Проигрывание узлов завершено.'); return; }
    const item = playQueue[playIndex]; const node = getNode(item.nodeId);
    if (!node) { playIndex++; playNextQueuedNode(); return; }
    if (node.isActive === false && node.nodeType !== 'LOGIC_IF') { playIndex++; playNextQueuedNode(); return; }
    if (item.connection) { const c = item.connection, fn = getNode(item.fromNodeId); if (fn) { if (c.inheritSize) { node.stimAcuity = fn.stimAcuity; node.endAcuity = fn.endAcuity; node.stimDistance = fn.stimDistance; node.stimPPI = fn.stimPPI; node.stimSize = getNodeComputedSize(node); } if (c.inheritSpeed) node.duration = fn.duration; } }
    if (node.nodeType === 'READING') { playReadingNode(node); return; }
    if (node.nodeType === 'COMPARE') { playCompareNodeSeries(node); return; }
    currentPlayingNodeId = node.id;
    completedSeries = successfulSeries = failedSeries = 0; seriesCorrect = seriesIncorrect = seriesNoAnswer = 0;
    seriesStep = 0; noAnswerSeriesStreak = 0; lastDirection = null;
    currentSingleCell = { row: 0, col: 0 }; nodeAcuityCurrent = node.stimAcuity || 1.0;
    updateCounters(); hideStimulus(); responseButtons.style.display = 'none';
    phaseTimers.push(setTimeout(() => { if (!playerRunning || isPaused) return; playStimulusNodeSeries(node); }, node.delay1 || 0));
}
function playCompareNodeSeries(node) {
    if (!playerRunning || isPaused) return;
    currentCompareNode = node; currentPlayingNodeId = node.id;
    completedSeries = successfulSeries = failedSeries = 0; seriesCorrect = seriesIncorrect = seriesNoAnswer = 0;
    seriesStep = 0; noAnswerSeriesStreak = 0;
    compareMode = node.compareMode || 'direction';
    gridX = Math.max(2, Math.min(6, parseInt(node.gridX) || 3));
    gridY = Math.max(1, Math.min(6, parseInt(node.gridY) || 3));
    activeCells = (node.activeCells || []).slice(); cellParams = (node.cellParams || []).slice();
    if (activeCells.length < 2) activeCells = [{ row: 0, col: 0 }, { row: 0, col: 1 }];
    while (cellParams.length < activeCells.length) cellParams.push(defaultCompareCellParams());
    updateCounters(); hideStimulus(); responseButtons.style.display = 'none';
    phaseTimers.push(setTimeout(() => { if (!playerRunning || isPaused) return; playNextCompareRound(node); }, node.delay1 || 0));
}
function playNextCompareRound(node) {
    if (!playerRunning || isPaused) return;
    if (seriesStep >= (node.seriesSize || 6)) { finishCompareNodeSeries(node); return; }
    if (blinkLockShow && areEyesClosedNow()) { phaseTimers.push(setTimeout(() => { if (!playerRunning || isPaused) return; playNextCompareRound(node); }, 100)); return; }
    removeSingleGridLines(); stimDisplay.innerHTML = ''; stimArea.style.background = '#000';
    responsePhaseActive = true; responseStartTime = performance.now();
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    if (compareMode === 'direction') showDirectionComparison(); else if (compareMode === 'find_same') showFindSameComparison();
    const dur = cellParams[0]?.duration || node.duration || currentDuration;
    currentShowTimer = setTimeout(() => { if (responsePhaseActive) { lastResponse = { answered: false, isCorrect: false }; processComparisonAnswer(false); } }, dur);
    phaseTimers.push(currentShowTimer);
}
function finishCompareNodeSeries(node) {
    const th = node.seriesThreshold || getThreshold(node.seriesSize || 6); const ok = seriesCorrect >= th;
    if (seriesNoAnswer === (node.seriesSize || 6)) noAnswerSeriesStreak++; else noAnswerSeriesStreak = 0;
    completedSeries++; if (ok) successfulSeries++; else failedSeries++;
    seriesCorrect = seriesIncorrect = seriesNoAnswer = seriesStep = 0; updateCounters();
    if (noAnswerSeriesStreak >= 3) { pauseTraining(); return; }
    if (completedSeries >= (node.seriesCount || 5)) { currentCompareNode = null; playIndex++; playNextQueuedNode(); return; }
    phaseTimers.push(setTimeout(() => { if (!playerRunning || isPaused) return; playNextCompareRound(node); }, node.delay2 || 500));
}
function playStimulusNodeSeries(node) {
    if (!playerRunning || isPaused) return;
    if (completedSeries >= (node.seriesCount || 5)) { playIndex++; playNextQueuedNode(); return; }
    if (seriesStep >= (node.seriesSize || 6)) { finishStimulusNodeSeries(node); return; }
    if (blinkLockShow && areEyesClosedNow()) { phaseTimers.push(setTimeout(() => { if (!playerRunning || isPaused) return; playStimulusNodeSeries(node); }, 100)); return; }
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    let dir;
    if (node.isActive) { const d = ['вверх','вниз','влево','вправо']; do { dir = d[Math.floor(Math.random()*d.length)]; } while (dir === lastDirection); }
    else dir = node.stimDirectionFixed || 'вверх';
    lastDirection = dir; currentCorrectDirection = dir;
    const dCalc = currentDistanceMeters || node.stimDistance || 1;
    const pCalc = node.stimPPI || screenPPI || 96;
    const eff = acuityToSizePx(nodeAcuityCurrent, dCalc, pCalc);
    currentSize = eff;
    let sc = { r: node.stimR, g: node.stimG, b: node.stimB };
    if (node.singleStimDynamicEnabled && node.singleStimColor1 && !node.singleCircleEnabled) sc = node.singleStimColor1;
    let svgData;
    if (node.singleCircleEnabled) svgData = getCircleStimulusSVG(node, eff);
    else svgData = getStimulusSVG({ stimType: node.stimType || 'LETTER_E', stimDirection: dir, stimR: sc.r, stimG: sc.g, stimB: sc.b, bgR: node.bgR || 0, bgG: node.bgG || 0, bgB: node.bgB || 0 }, eff);
    if (node.dfEnabled) {
        const frame = buildDefocusFrame(node, eff, svgData.html, dir);
        if (frame) { stimDisplay.innerHTML = ''; stimDisplay.appendChild(frame.html); stimArea.style.backgroundColor = `rgb(${node.dfPeriBg.r},${node.dfPeriBg.g},${node.dfPeriBg.b})`; }
        else displayStimulus(svgData.html, { r: node.bgR || 0, g: node.bgG || 0, b: node.bgB || 0 });
    } else displayStimulus(svgData.html, { r: node.bgR || 0, g: node.bgG || 0, b: node.bgB || 0 });
    if (node.singleGridEnabled) { const gx = node.singleGridX || 1, gy = node.singleGridY || 1; const cell = pickSingleGridCell(gx, gy, node.singleGridRandomCell !== false, node.singleGridAvoidRepeat !== false, node.singleGridFixedRow || 0, node.singleGridFixedCol || 0, node.singleGridCells || []); currentSingleCell = cell; applySingleGridPosition(eff, gx, gy, cell.row, cell.col, node.singleGridShowLines === true); }
    else if (node.singleRandomPos) applyRandomStimulusPosition(eff);
    buildPeripheralDots(node, eff);
    stopBlinkAnimation();
    if (node.singleCircleEnabled) { startCircleAnimation(node); stopSingleStimAnimation(); }
    else { stopCircleAnimation(); if (node.singleStimDynamicEnabled) startSingleStimAnimation({ singleStimColor1: node.singleStimColor1, singleStimMidEnabled: node.singleStimMidEnabled, singleStimColor3: node.singleStimColor3, singleStimColor2: node.singleStimColor2, singleStimReverse: node.singleStimReverse, singleStimLoop: node.singleStimLoop, singleStimDuration: node.singleStimDuration }); else stopSingleStimAnimation(); }
    if (node.singleBgDynamicEnabled) startSingleBgAnimation({ singleBgColor1: node.singleBgColor1, singleBgMidEnabled: node.singleBgMidEnabled, singleBgColor3: node.singleBgColor3, singleBgColor2: node.singleBgColor2, singleBgReverse: node.singleBgReverse, singleBgLoop: node.singleBgLoop, singleBgDuration: node.singleBgDuration }); else stopSingleBgAnimation();
    if (node.blinkEnabled){
        startBlinkAnimation({
            target:     node.blinkTarget || 'stim',
            colorA:     node.blinkColorA || { r: 255, g: 0, b: 0 },
            colorB:     node.blinkColorB || { r: 0, g: 0, b: 255 },
            intervalMs: node.blinkIntervalMs || 500,
            duty:       node.blinkDuty ?? 0.5,
            count:      node.blinkCount || 0
        });
    }
    responsePhaseActive = true; responseStartTime = performance.now();
    document.querySelectorAll('.btn-response[data-dir]').forEach(b => b.style.display = 'flex');
    document.querySelectorAll('.btn-response[data-answer]').forEach(b => b.style.display = 'none');
    responseButtons.style.display = 'flex';
    if (window.Voice) window.Voice.sayKey('look', { cancel: true });
    let sd = node.duration || 1000;
    if (node.singleStimDynamicEnabled) sd = Math.max(sd, node.singleStimDuration || 0);
    if (node.singleBgDynamicEnabled) sd = Math.max(sd, node.singleBgDuration || 0);
    if (node.singleCircleEnabled) { const ci = node.circleInnerEnabled !== false ? (node.circleInnerDuration || 0) : 0; const co = node.circleOuterEnabled !== false ? (node.circleOuterDuration || 0) : 0; sd = Math.max(sd, ci, co); }
    scheduleVoiceCountdown(sd, node);
    currentShowTimer = setTimeout(() => {
        hideStimulus(); responsePhaseActive = false;
        stopSingleStimAnimation(); stopSingleBgAnimation(); stopCircleAnimation(); stopPeripheralAnimation(); stopBlinkAnimation();
        if (lastResponse.answered) { if (lastResponse.isCorrect) seriesCorrect++; else seriesIncorrect++; } else { seriesNoAnswer++; if (window.Voice) window.Voice.sayKey('timeout', { cancel: true }); }
        seriesStep++; updateCounters();
        const d2 = node.delay2 || 1000;
        phaseTimers.push(setTimeout(() => { if (!playerRunning || isPaused) return; playStimulusNodeSeries(node); }, d2));
    }, sd);
    phaseTimers.push(currentShowTimer);
}
function finishStimulusNodeSeries(node) {
    const th = node.seriesThreshold || getThreshold(node.seriesSize || 6); const ok = seriesCorrect >= th;
    const allNo = seriesNoAnswer === (node.seriesSize || 6);
    if (allNo) noAnswerSeriesStreak++; else noAnswerSeriesStreak = 0;
    completedSeries++; if (ok) successfulSeries++; else failedSeries++;
    if (ok) { const eA = node.endAcuity != null ? node.endAcuity : (node.stimAcuity || 1.0); if (nodeAcuityCurrent < eA) nodeAcuityCurrent = Math.min(eA, Math.round((nodeAcuityCurrent + (node.acuityStep || 0.1)) * 10) / 10); }
    else { const sA = node.stimAcuity || 1.0; if (nodeAcuityCurrent > sA) nodeAcuityCurrent = Math.max(sA, Math.round((nodeAcuityCurrent - (node.acuityStep || 0.1)) * 10) / 10); }
    seriesCorrect = seriesIncorrect = seriesNoAnswer = seriesStep = 0; lastDirection = null; updateCounters();
    if (noAnswerSeriesStreak >= 3) { pauseTraining(); return; }
    if (completedSeries >= (node.seriesCount || 5)) { playIndex++; playNextQueuedNode(); return; }
    phaseTimers.push(setTimeout(() => { if (!playerRunning || isPaused) return; playStimulusNodeSeries(node); }, node.delay2 || 500));
}
function startReadingModeAuto() {
    if (!readingViewportEl) readingViewportEl = document.getElementById('reading-viewport');
    if (!readingContentEl) readingContentEl = document.getElementById('reading-content');
    if (!readingViewportEl || !readingContentEl) return;
    const p = trainingNode.params;
    const text = p.text || '';
    const pars = text.split(/\n+/).map(x => x.trim()).filter(x => x.length > 0);
    readingContentEl.innerHTML = pars.map(x => `<p>${escapeHtml(x)}</p>`).join('');
    readingViewportEl.style.color = p.textColor ? `rgb(${p.textColor.r},${p.textColor.g},${p.textColor.b})` : '#000';
    const c = document.getElementById('counters'); if (c) c.style.display = 'none';
    applyReadingBackground(p);
    stimDisplay.style.display = 'none'; responseButtons.style.display = 'none';
    readingViewportEl.style.display = 'block'; readingViewportEl.scrollLeft = 0;
    readingPaused = false; const pp = document.getElementById('reading-play-pause'); if (pp) pp.textContent = '⏸ Пауза';
    readingContentEl.style.opacity = '1';
    applyReadingFontForNode({ readingFontFamily: 'Segoe UI', readingFontWeight: 'normal' });
    setupReadingColumns();
    const dCalc = currentDistanceMeters || readingDistance || p.readingDistance || 1;
    readingContentEl.style.fontSize = acuityToFontSizePx(currentAcuity, dCalc, screenPPI) + 'px';
    setTimeout(() => { readingTotalPages = calcReadingTotalPages(); readingPage = 0; scrollReadingToPage(0); }, 80);
    showReadingToolbar(); updateReadingFontIndicator();
}
function showNextStimulus() {
    if (!playerRunning || isPaused) return;
    if (seriesStep >= (trainingNode?.params?.seriesSize || 6)) { finishSeries(); return; }
    if (blinkLockShow && areEyesClosedNow()) { phaseTimers.push(setTimeout(() => { if (!playerRunning || isPaused) return; showNextStimulus(); }, 100)); return; }
    lastResponse = { answered: false, isCorrect: false, reactionTimeMs: null };
    const p = trainingNode?.params || {};
    let dir;
    if (p.isActive) { const d = ['вверх','вниз','влево','вправо']; do { dir = d[Math.floor(Math.random()*d.length)]; } while (dir === lastDirection); }
    else dir = 'вверх';
    lastDirection = dir; currentCorrectDirection = dir;
    const dCalc = currentDistanceMeters || generalDistance || trainingDistance;
    const eff = acuityToSizePx(currentAcuity, dCalc, screenPPI);
    currentSize = eff;
    let sc = currentStimColor;
    if (p.singleStimDynamicEnabled && p.singleStimColor1 && !p.singleCircleEnabled) sc = p.singleStimColor1;
    let svgData;
    if (p.singleCircleEnabled) svgData = getCircleStimulusSVG(p, eff);
    else svgData = getStimulusSVG({ stimType: p.type || 'LETTER_E', stimDirection: dir, stimR: sc.r, stimG: sc.g, stimB: sc.b, bgR: currentBgColor.r, bgG: currentBgColor.g, bgB: currentBgColor.b }, eff);
    if (p.dfEnabled) {
        const frame = buildDefocusFrame(p, eff, svgData.html, dir);
        if (frame) { stimDisplay.innerHTML = ''; stimDisplay.appendChild(frame.html); stimArea.style.backgroundColor = `rgb(${p.dfPeriBg.r},${p.dfPeriBg.g},${p.dfPeriBg.b})`; }
        else displayStimulus(svgData.html, currentBgColor);
    } else displayStimulus(svgData.html, currentBgColor);
    if (p.singleGridEnabled) { const gx = p.singleGridX || 1, gy = p.singleGridY || 1; const cell = pickSingleGridCell(gx, gy, p.singleGridRandomCell !== false, p.singleGridAvoidRepeat !== false, p.singleGridFixedRow || 0, p.singleGridFixedCol || 0, p.singleGridCells || []); currentSingleCell = cell; applySingleGridPosition(eff, gx, gy, cell.row, cell.col, p.singleGridShowLines === true); }
    else if (p.singleRandomPos) applyRandomStimulusPosition(eff);
    buildPeripheralDots(p, eff);
    stopBlinkAnimation();
    if (p.singleCircleEnabled) { startCircleAnimation(p); stopSingleStimAnimation(); }
    else { stopCircleAnimation(); if (p.singleStimDynamicEnabled) startSingleStimAnimation(p); else stopSingleStimAnimation(); }
    if (p.singleBgDynamicEnabled) startSingleBgAnimation(p); else stopSingleBgAnimation();
    if (p.blinkEnabled){
        startBlinkAnimation({
            target:     p.blinkTarget || 'stim',
            colorA:     p.blinkColorA || { r: 255, g: 0, b: 0 },
            colorB:     p.blinkColorB || { r: 0, g: 0, b: 255 },
            intervalMs: p.blinkIntervalMs || 500,
            duty:       p.blinkDuty ?? 0.5,
            count:      p.blinkCount || 0
        });
    }
    responsePhaseActive = true; responseStartTime = performance.now();
    document.querySelectorAll('.btn-response[data-dir]').forEach(b => b.style.display = 'flex');
    document.querySelectorAll('.btn-response[data-answer]').forEach(b => b.style.display = 'none');
    responseButtons.style.display = 'flex';
    if (window.Voice) window.Voice.sayKey('look', { cancel: true });
    let sd = currentDuration;
    if (p.singleStimDynamicEnabled) sd = Math.max(sd, p.singleStimDuration || 0);
    if (p.singleBgDynamicEnabled) sd = Math.max(sd, p.singleBgDuration || 0);
    if (p.singleCircleEnabled) { const ci = p.circleInnerEnabled !== false ? (p.circleInnerDuration || 0) : 0; const co = p.circleOuterEnabled !== false ? (p.circleOuterDuration || 0) : 0; sd = Math.max(sd, ci, co); }
    scheduleVoiceCountdown(sd, p);
    currentShowTimer = setTimeout(() => {
        hideStimulus(); responsePhaseActive = false;
        stopSingleStimAnimation(); stopSingleBgAnimation(); stopCircleAnimation(); stopPeripheralAnimation(); stopBlinkAnimation();
        if (!lastResponse.answered) { lastResponse = { answered: false, isCorrect: false }; if (window.Voice) window.Voice.sayKey('timeout', { cancel: true }); if (supabaseClient && currentUser && currentSessionId) supabaseClient.from('test_results').insert({ session_id: currentSessionId, node_id: 'training_node', response_time_ms: null, is_correct: false, created_at: new Date().toISOString() }); }
        else if (supabaseClient && currentUser && currentSessionId) supabaseClient.from('test_results').insert({ session_id: currentSessionId, node_id: 'training_node', response_time_ms: lastResponse.reactionTimeMs, is_correct: lastResponse.isCorrect, created_at: new Date().toISOString() });
        if (lastResponse.answered) { if (lastResponse.isCorrect) seriesCorrect++; else seriesIncorrect++; } else seriesNoAnswer++;
        seriesStep++; updateCounters();
        phaseTimers.push(setTimeout(() => showNextStimulus(), p.delay2 || 1000));
    }, sd);
    phaseTimers.push(currentShowTimer);
}
function finishSeries() {
    const th = trainingNode?.params?.seriesThreshold || getThreshold(trainingNode?.params?.seriesSize || 6); const ok = seriesCorrect >= th;
    if (seriesNoAnswer === (trainingNode?.params?.seriesSize || 6)) noAnswerSeriesStreak++; else noAnswerSeriesStreak = 0;
    completedSeries++; if (ok) successfulSeries++; else failedSeries++;
    if (ok) { if (currentAcuity < (trainingNode?.params?.endAcuity || 2.0)) currentAcuity = Math.min(trainingNode?.params?.endAcuity || 2.0, Math.round((currentAcuity + (trainingNode?.params?.acuityStep || 0.1)) * 10) / 10); }
    else { if (currentAcuity > (trainingNode?.params?.startAcuity || 0.5)) currentAcuity = Math.max(trainingNode?.params?.startAcuity || 0.5, Math.round((currentAcuity - (trainingNode?.params?.acuityStep || 0.1)) * 10) / 10); }
    const dCalc = currentDistanceMeters || generalDistance || trainingDistance;
    currentSize = acuityToSizePx(currentAcuity, dCalc, screenPPI);
    seriesCorrect = seriesIncorrect = seriesNoAnswer = seriesStep = 0; lastDirection = null; updateCounters();
    if (noAnswerSeriesStreak >= 3) { pauseTraining(); return; }
    if (completedSeries >= (trainingNode?.params?.seriesCount || 5)) {
        trainingNode.params.finalAcuity = currentAcuity;
        let distRep = '';
        if (distanceCount > 0) { const avg = distanceSum / distanceCount; distRep = `\n\n📏 Дистанция: ср=${avg.toFixed(2)} м, мин=${distanceMin.toFixed(2)}, макс=${distanceMax.toFixed(2)}`; }
        const blinkRep = buildBlinkReport();
        alert(`Тренировка завершена!\nУспешных: ${successfulSeries}\nНеуспешных: ${failedSeries}\nV = ${currentAcuity.toFixed(1)}${distRep}${blinkRep}`);
        stopPlayer();
    } else { const tt = trainingNode?.params?.trainingType || 'single'; if (tt === 'compare') showNextComparison(); else showNextStimulus(); }
}
function playReadingNode(node) {
    if (!readingViewportEl) readingViewportEl = document.getElementById('reading-viewport');
    if (!readingContentEl) readingContentEl = document.getElementById('reading-content');
    if (!readingViewportEl || !readingContentEl) { playIndex++; playNextQueuedNode(); return; }
    readingCurrentNode = node;
    let bid = node.bookId, page = 0, inherit = false;
    if (!bid) { if (window._currentReadingBookId && window._books[window._currentReadingBookId]) { bid = window._currentReadingBookId; inherit = true; } else { const l = getLastBookId(); if (l) { bid = l; inherit = true; } } }
    if (inherit && window._currentReadingBookId === bid) page = window._currentReadingPage || 0;
    else if (node.continueFromBookmark && bid) { const s = localStorage.getItem(bookmarkKeyFor(bid)); if (s) { try { page = JSON.parse(s).page || 0; } catch (_) {} } }
    window._currentReadingNodeId = node.id; window._currentReadingBookId = bid || null;
    if (bid) setLastBookId(bid);
    const bk = bid ? window._books[bid] : null;
    if (!bk) {
        const ph = (!node.bookId && !window._currentReadingBookId && !getLastBookId()) ? `📖 ${escapeHtml(node.name)}\n\nКнига не задана.` : `📖 ${escapeHtml(node.name)}\n\nКнига не найдена.`;
        readingContentEl.innerHTML = ph.split('\n').map(l => `<p>${l}</p>`).join('');
        readingContentEl.style.color = rgbToHex(node.readingTextColor?.r, node.readingTextColor?.g, node.readingTextColor?.b);
        readingContentEl.style.fontSize = '32px';
        const bg = node.readingBgColor || { r: 255, g: 255, b: 255 };
        readingViewportEl.style.background = `rgb(${bg.r},${bg.g},${bg.b})`;
    } else {
        const pars = (bk.text || '').split(/\n+/).map(x => x.trim()).filter(x => x.length > 0);
        readingContentEl.innerHTML = pars.map(x => `<p>${escapeHtml(x)}</p>`).join('');
        readingContentEl.style.color = rgbToHex(node.readingTextColor?.r, node.readingTextColor?.g, node.readingTextColor?.b);
        applyReadingFontForNode(node);
        const dCalc = currentDistanceMeters || node.readingDistance || readingDistance || 1;
        readingContentEl.style.fontSize = acuityToFontSizePx(node.readingAcuity || 1.0, dCalc, screenPPI) + 'px';
        applyReadingBackground(nodeToReadingParams(node));
    }
    stimDisplay.style.display = 'none'; responseButtons.style.display = 'none';
    readingViewportEl.style.display = 'block'; readingContentEl.style.opacity = '1';
    readingPaused = false;
    const pp = document.getElementById('reading-play-pause'); if (pp) pp.textContent = '⏸ Пауза';
    showReadingToolbar(); setupReadingColumns();
    setTimeout(() => { readingTotalPages = calcReadingTotalPages(); scrollReadingToPage(page); }, 100);
    if (node.duration > 0) { startReadingNodeTimer(Math.ceil(node.duration / 1000)); currentShowTimer = setTimeout(() => finishReadingNodeAuto(), node.duration); phaseTimers.push(currentShowTimer); }
    else window._readingNodeWaiting = true;
}
function finishReadingNodeAuto() { window.Voice?.stopReading(); saveCurrentReadingBookmarkSilently(); hideReadingToolbar(); stopReadingNodeTimer(); if (readingContentEl) readingContentEl.innerHTML = ''; window._readingNodeWaiting = false; readingCurrentNode = null; playIndex++; playNextQueuedNode(); }
function finishReadingNode() { window.Voice?.stopReading(); saveCurrentReadingBookmarkSilently(); window._readingNodeWaiting = false; hideReadingToolbar(); stopReadingNodeTimer(); if (readingContentEl) readingContentEl.innerHTML = ''; readingCurrentNode = null; playIndex++; playNextQueuedNode(); }
let readingNodeTimerInterval = null;
function startReadingNodeTimer(sec) { stopReadingNodeTimer(); const el = document.getElementById('reading-timer'); if (!el) return; let s = sec; el.textContent = `⏱ ${s} с`; el.style.display = 'block'; readingNodeTimerInterval = setInterval(() => { s--; if (s <= 0) { stopReadingNodeTimer(); return; } el.textContent = `⏱ ${s} с`; }, 1000); }
function stopReadingNodeTimer() { if (readingNodeTimerInterval) { clearInterval(readingNodeTimerInterval); readingNodeTimerInterval = null; } const el = document.getElementById('reading-timer'); if (el) el.style.display = 'none'; }
function stopPlayer() {
    phaseTimers.forEach(t => clearTimeout(t)); phaseTimers = [];
    if (currentShowTimer) clearTimeout(currentShowTimer);
    stopSingleStimAnimation(); stopSingleBgAnimation(); stopCircleAnimation(); stopPeripheralAnimation(); stopBlinkAnimation(); stopReadingNodeTimer();
    window.Voice?.stopReading();
    saveCurrentReadingBookmarkSilently(); resetDistanceTracking(); hideBlinkWarning();
    window._readingNodeWaiting = false;
    window._currentReadingNodeId = null; window._currentReadingBookId = null; window._currentReadingPage = 0;
    currentPlayingNodeId = null; currentCompareNode = null; readingCurrentNode = null; _findSameState = null;
    playerRunning = false; isPaused = false; responsePhaseActive = false;
    hideStimulus(); responseButtons.style.display = 'none';
    document.querySelectorAll('.btn-response').forEach(b => b.style.display = 'none');
    btnPlayer.disabled = false; btnPlayerStop.disabled = true; btnPlayerPause.disabled = true;
    document.body.style.backgroundColor = '#111'; pauseModal.style.display = 'none';
    hideReadingToolbar();
    if (readingContentEl) { readingContentEl.style.opacity = '1'; readingContentEl.innerHTML = ''; }
    stimDisplay.style.display = ''; hideLiveDistanceIndicator();
    if (currentSessionId && supabaseClient) { const avgDist = distanceCount > 0 ? distanceSum / distanceCount : null; supabaseClient.from('training_sessions').update({ ended_at: new Date().toISOString(), distance_avg: avgDist, distance_min: distanceMin, distance_max: distanceMax }).eq('id', currentSessionId); currentSessionId = null; }
    if (currentMode === 'stimuli') switchMode('nodes');
    currentCorrectDirection = null; playQueue = []; playIndex = 0;
}
function togglePause() {
    if (!playerRunning) return;
    isPaused = !isPaused;
    if (isPaused) { btnPlayerPause.textContent = '▶ Продолжить'; phaseTimers.forEach(t => clearTimeout(t)); phaseTimers = []; if (currentShowTimer) clearTimeout(currentShowTimer); stopSingleStimAnimation(); stopSingleBgAnimation(); stopCircleAnimation(); stopPeripheralAnimation(); stopBlinkAnimation(); stopReadingNodeTimer(); hideStimulus(); responseButtons.style.display = 'none'; }
    else {
        btnPlayerPause.textContent = '⏸ Пауза';
        if (currentCompareNode) { playNextCompareRound(currentCompareNode); return; }
        if (currentPlayingNodeId) { const node = getNode(currentPlayingNodeId); if (node) { playStimulusNodeSeries(node); return; } }
        if (trainingNode?.params?.trainingType === 'compare') showNextComparison();
        else if (trainingNode?.params) showNextStimulus();
        else if (playIndex < playQueue.length) playNextQueuedNode();
        else stopPlayer();
    }
}
function pauseTraining() { phaseTimers.forEach(t => clearTimeout(t)); phaseTimers = []; if (currentShowTimer) clearTimeout(currentShowTimer); stopSingleStimAnimation(); stopSingleBgAnimation(); stopCircleAnimation(); stopPeripheralAnimation(); stopBlinkAnimation(); stopReadingNodeTimer(); responsePhaseActive = false; hideStimulus(); responseButtons.style.display = 'none'; isPaused = true; btnPlayerPause.disabled = true; pauseModal.style.display = 'flex'; }
function resumeTraining() { pauseModal.style.display = 'none'; isPaused = false; noAnswerSeriesStreak = 0; btnPlayerPause.disabled = false; if (currentCompareNode) { playNextCompareRound(currentCompareNode); return; } if (currentPlayingNodeId) { const node = getNode(currentPlayingNodeId); if (node) { playStimulusNodeSeries(node); return; } } if (trainingNode?.params?.trainingType === 'compare') showNextComparison(); else if (trainingNode?.params) showNextStimulus(); }
function exitTrainingFromPause() { pauseModal.style.display = 'none'; stopPlayer(); }

// ==================== ГЕНЕРАТОР ====================
function renderGridPreview() { const gX = parseInt(document.getElementById('gen-grid-x').value) || 3; const gY = parseInt(document.getElementById('gen-grid-y').value) || 3; const c = document.getElementById('grid-preview'); c.style.gridTemplateColumns = `repeat(${gX}, 40px)`; c.innerHTML = ''; if (selectedCells.length > gX * gY) selectedCells = selectedCells.slice(0, gX * gY); for (let row = 0; row < gY; row++) for (let col = 0; col < gX; col++) { const el = document.createElement('div'); el.className = 'grid-cell'; el.dataset.row = row; el.dataset.col = col; if (selectedCells.some(sc => sc.row === row && sc.col === col)) el.style.background = '#8b5cf6'; el.addEventListener('click', () => { const i = selectedCells.findIndex(sc => sc.row === row && sc.col === col); if (i === -1) selectedCells.push({ row, col }); else selectedCells.splice(i, 1); renderGridPreview(); generateCellParamsFields(); }); c.appendChild(el); } }
function generateCellParamsFields() { const c = document.getElementById('cell-params-container'); c.innerHTML = ''; selectedCells.forEach(cell => { const div = document.createElement('div'); div.style.cssText = 'border:1px solid #444;padding:6px;margin-top:6px;'; let opts = ''; for (let i = 1; i <= 20; i++) { const v = i/10; const mm = acuityToSizeMm(v, 1); opts += `<option value="${v.toFixed(1)}">${v.toFixed(1)} — ${mm.toFixed(2)} мм</option>`; } div.innerHTML = `<label><b>Клетка (${cell.row+1}, ${cell.col+1})</b></label>
<label>V</label><select class="cell-acuity">${opts}</select>
<label>Цвет стимула</label><input type="color" class="cell-stim-color" value="#ffffff">
<label>Цвет фона</label><input type="color" class="cell-bg-color" value="#000000">
<label>Время (мс)</label><input type="number" class="cell-duration" value="1000" min="100" max="5000">`; c.appendChild(div); }); }
function collectCompareParams() { const gX = parseInt(document.getElementById('gen-grid-x').value) || 3; const gY = parseInt(document.getElementById('gen-grid-y').value) || 3; const cm = document.getElementById('gen-compare-mode').value; const d = parseFloat(document.getElementById('gen-distance').value) || generalDistance || 1; const ppi = parseInt(document.getElementById('gen-ppi').value) || screenPPI || 96; const cp = []; document.querySelectorAll('#cell-params-container > div').forEach(div => { const V = parseFloat(div.querySelector('.cell-acuity').value) || 1.0; const sc = hexToRgb(div.querySelector('.cell-stim-color').value); const bc = hexToRgb(div.querySelector('.cell-bg-color').value); const dur = parseInt(div.querySelector('.cell-duration').value) || 1000; cp.push({ size: acuityToSizePx(V, d, ppi), acuity: V, distance: d, ppi, stimR: sc.r, stimG: sc.g, stimB: sc.b, bgR: bc.r, bgG: bc.g, bgB: bc.b, duration: dur }); }); return { compareMode: cm, gridX: gX, gridY: gY, activeCells: selectedCells.slice(), cellParams: cp }; }
function buildModeParamsFromUI() {
    const ss = parseInt(document.getElementById('gen-series-size').value) || 6;
    const tt = document.getElementById('gen-training-type').value;
    const gdEl = document.getElementById('gen-general-distance'); if (gdEl) { const v = parseFloat(gdEl.value); if (!isNaN(v) && v > 0) { generalDistance = v; saveUserSettings(); } }
    const rdEl = document.getElementById('gen-reading-distance'); if (rdEl) { const v = parseFloat(rdEl.value); if (!isNaN(v) && v > 0) { readingDistance = v; saveUserSettings(); } }
    const tiEl = document.getElementById('gen-tol-inc'); if (tiEl) { const v = parseFloat(tiEl.value); if (!isNaN(v) && v >= 0 && v <= 100) { distanceToleranceIncreasePct = v; saveUserSettings(); } }
    const tdEl = document.getElementById('gen-tol-dec'); if (tdEl) { const v = parseFloat(tdEl.value); if (!isNaN(v) && v >= 0 && v <= 100) { distanceToleranceDecreasePct = v; saveUserSettings(); } }
    const ttEl = document.getElementById('gen-tol-timeout'); if (ttEl) { const v = parseFloat(ttEl.value); if (!isNaN(v) && v >= 0 && v <= 60) { distanceRestoreTimeoutSec = v; saveUserSettings(); } }
    const p = {
        mode: safeVal('gen-mode', 'общая'), trainingType: tt,
        seriesCount: safeVal('gen-series', 5, parseInt), seriesSize: ss,
        seriesThreshold: safeVal('gen-threshold', getThreshold(ss), parseInt),
        type: safeVal('gen-type', 'LETTER_E'),
        startAcuity: safeVal('gen-start-acuity', 0.5, parseFloat),
        endAcuity: safeVal('gen-end-acuity', 2.0, parseFloat),
        acuityStep: safeVal('gen-acuity-step', 0.1, parseFloat),
        distanceMeters: generalDistance, readingDistance,
        distanceToleranceIncreasePct, distanceToleranceDecreasePct, distanceRestoreTimeoutSec,
        ppi: safeVal('gen-ppi', screenPPI || 96, parseInt),
        startStimColor: hexToRgb(safeVal('gen-start-color', '#00ff00')),
        endStimColor: hexToRgb(safeVal('gen-end-color', '#ff0000')),
        startBgColor: hexToRgb(safeVal('gen-start-bg', '#00ff00')),
        endBgColor: hexToRgb(safeVal('gen-end-bg', '#000000')),
        delay1: unitToMs(safeVal('gen-delay1', 1, parseFloat), safeVal('gen-delay1-unit', 's')),
        delay2: unitToMs(safeVal('gen-delay2', 1, parseFloat), safeVal('gen-delay2-unit', 's')),
        isActive: safeChecked('gen-active', false), response: 1000
    };
    p.startDuration = p.delay2;
    if (tt === 'single') {
        p.singleRandomPos = safeChecked('gen-single-random-pos', false);
        p.singleGridEnabled = safeChecked('gen-single-grid-enabled', false);
        p.singleGridX = safeVal('gen-single-grid-x', 3, parseInt);
        p.singleGridY = safeVal('gen-single-grid-y', 3, parseInt);
        p.singleGridShowLines = safeChecked('gen-single-grid-show-lines', false);
        p.singleGridRandomCell = safeChecked('gen-single-grid-random', true);
        p.singleGridAvoidRepeat = safeChecked('gen-single-grid-avoid-repeat', true);
        p.singleGridFixedRow = 0; p.singleGridFixedCol = 0; p.singleGridCells = [];
        p.singleStimDynamicEnabled = safeChecked('gen-single-stim-dynamic-enabled', false);
        p.singleStimColor1 = hexToRgb(safeVal('gen-single-stim-color1', '#ff0000'));
        p.singleStimMidEnabled = safeChecked('gen-single-stim-mid-enabled', false);
        p.singleStimColor3 = hexToRgb(safeVal('gen-single-stim-color3', '#ffff00'));
        p.singleStimColor2 = hexToRgb(safeVal('gen-single-stim-color2', '#0000ff'));
        p.singleStimDuration = unitToMs(safeVal('gen-single-stim-duration', 10, parseFloat), safeVal('gen-single-stim-duration-unit', 's'));
        p.singleStimLoop = safeChecked('gen-single-stim-loop', false);
        p.singleStimReverse = safeChecked('gen-single-stim-reverse', false);
        p.singleBgDynamicEnabled = safeChecked('gen-single-bg-dynamic-enabled', false);
        p.singleBgColor1 = hexToRgb(safeVal('gen-single-bg-color1', '#ff0000'));
        p.singleBgMidEnabled = safeChecked('gen-single-bg-mid-enabled', false);
        p.singleBgColor3 = hexToRgb(safeVal('gen-single-bg-color3', '#ffff00'));
        p.singleBgColor2 = hexToRgb(safeVal('gen-single-bg-color2', '#0000ff'));
        p.singleBgDuration = unitToMs(safeVal('gen-single-bg-duration', 10, parseFloat), safeVal('gen-single-bg-duration-unit', 's'));
        p.singleBgLoop = safeChecked('gen-single-bg-loop', false);
        p.singleBgReverse = safeChecked('gen-single-bg-reverse', false);
        p.singleCircleEnabled = safeChecked('gen-circle-enabled', false);
        p.circleInnerEnabled = true;
        p.circleInnerRadiusPct = safeVal('gen-ci-radius', 40, parseInt);
        p.circleInnerColor1 = hexToRgb(safeVal('gen-ci-c1', '#ff0000'));
        p.circleInnerMidEnabled = safeChecked('gen-ci-mid-enabled', false);
        p.circleInnerColor3 = hexToRgb(safeVal('gen-ci-c3', '#ffff00'));
        p.circleInnerColor2 = hexToRgb(safeVal('gen-ci-c2', '#0000ff'));
        p.circleInnerDuration = unitToMs(safeVal('gen-ci-duration', 10, parseFloat), 's');
        p.circleInnerLoop = safeChecked('gen-ci-loop', true);
        p.circleInnerReverse = safeChecked('gen-ci-reverse', false);
        p.circleOuterEnabled = true;
        p.circleOuterColor1 = hexToRgb(safeVal('gen-co-c1', '#00ff00'));
        p.circleOuterMidEnabled = safeChecked('gen-co-mid-enabled', false);
        p.circleOuterColor3 = hexToRgb(safeVal('gen-co-c3', '#00ffff'));
        p.circleOuterColor2 = hexToRgb(safeVal('gen-co-c2', '#0080ff'));
        p.circleOuterDuration = unitToMs(safeVal('gen-co-duration', 10, parseFloat), 's');
        p.circleOuterLoop = safeChecked('gen-co-loop', true);
        p.circleOuterReverse = safeChecked('gen-co-reverse', false);
        p.periEnabled = safeChecked('gen-peri-enabled', false);
        p.periCount = safeVal('gen-peri-count', 4, parseInt);
        p.periAcuity = safeVal('gen-peri-acuity', 0.3, parseFloat);
        p.periRadiusMinPct = safeVal('gen-peri-rmin', 60, parseInt);
        p.periRadiusMaxPct = safeVal('gen-peri-rmax', 90, parseInt);
        p.periColor = hexToRgb(safeVal('gen-peri-color', '#00ff64'));
        p.periMotion = safeVal('gen-peri-motion', 'static');
        p.periSpeed = safeVal('gen-peri-speed', 0.3, parseFloat);
        p.periRandomAngles = safeChecked('gen-peri-random', true);
        p.dfEnabled = safeChecked('gen-df-enabled', false);
        p.dfCenterRadiusMm = safeVal('gen-df-radius-mm', 13, parseFloat);
        p.dfCenterBg = hexToRgb(safeVal('gen-df-center-bg', '#cc0000'));
        p.dfStimColor = hexToRgb(safeVal('gen-df-stim-color', '#000000'));
        p.dfPeriBg = hexToRgb(safeVal('gen-df-peri-bg', '#0047ab'));
        p.dfPeriBlur = safeVal('gen-df-blur', 0, parseInt);
        p.blinkEnabled = safeChecked('gen-blink-anim-enabled', false);
        p.blinkTarget = safeVal('gen-blink-anim-target', 'stim');
        p.blinkColorA = hexToRgb(safeVal('gen-blink-anim-cA', '#ff0000'));
        p.blinkColorB = hexToRgb(safeVal('gen-blink-anim-cB', '#0000ff'));
        p.blinkIntervalMs = safeVal('gen-blink-anim-interval', 500, parseInt);
        p.blinkDuty = safeVal('gen-blink-anim-duty', 0.5, parseFloat);
        p.blinkCount = safeVal('gen-blink-anim-count', 0, parseInt);
    }
    if (tt === 'compare') { Object.assign(p, collectCompareParams()); p.pairsCount = 2; }
    if (tt === 'reading') {
        p.text = safeVal('gen-reading-text', 'Пример.');
        p.textColor = hexToRgb(safeVal('gen-reading-text-color', '#000000'));
        p.bgMode = safeVal('gen-reading-bg-mode', 'solid');
        p.bgColor = hexToRgb(safeVal('gen-reading-bg-color', '#ffffff'));
        p.splitLeftWidthPercent = safeVal('gen-reading-split-left-width', 50, parseInt);
        p.splitLeftColor = hexToRgb(safeVal('gen-reading-left-color', '#000000'));
        p.splitRightColor = hexToRgb(safeVal('gen-reading-right-color', '#ffffff'));
        p.gradientMidEnabled = safeChecked('gen-reading-gradient-mid-enabled', true);
        p.gradientLeftColor = hexToRgb(safeVal('gen-reading-gradient-left-color', '#ffffff'));
        p.gradientMidColor = hexToRgb(safeVal('gen-reading-gradient-mid-color', '#cccccc'));
        p.gradientMidPosition = safeVal('gen-reading-gradient-mid-position', 50, parseInt);
        p.gradientRightColor = hexToRgb(safeVal('gen-reading-gradient-right-color', '#000000'));
        p.dynamicMode = safeVal('gen-reading-dynamic-mode', 'simple');
        p.dynamicReverse = safeChecked('gen-reading-dynamic-reverse', false);
        p.dynamicMidEnabled = safeChecked('gen-reading-dynamic-mid-enabled', false);
        p.dynamicStartColor = hexToRgb(safeVal('gen-reading-dynamic-start-color', '#ff0000'));
        p.dynamicMidColor = hexToRgb(safeVal('gen-reading-dynamic-mid-color', '#ffff00'));
        p.dynamicEndColor = hexToRgb(safeVal('gen-reading-dynamic-end-color', '#0000ff'));
        p.dynamicDuration = unitToMs(safeVal('gen-reading-dynamic-duration', 10, parseFloat), safeVal('gen-reading-dynamic-duration-unit', 's'));
        p.dynamicLoop = safeChecked('gen-reading-dynamic-loop', false);
        p.dynamicStep = safeVal('gen-reading-dynamic-step', 0.1, parseFloat);
        p.dynamicStepDuration = unitToMs(safeVal('gen-reading-dynamic-step-duration', 1, parseFloat), safeVal('gen-reading-dynamic-step-duration-unit', 's'));
        p.dynamicShowLabel = safeChecked('gen-reading-dynamic-show-label', true);
    }
    return p;
}
function modeParamsToNode(modeParams) {
    const prevId = activeNodeId;
    const id = createNewNode('STIMULUS');
    const node = getNode(id);
    node.name = modeParams.singleCircleEnabled ? 'Динамика Круг' : 'Стимул';
    node.stimType = modeParams.type || 'LETTER_E';
    node.stimAcuity = modeParams.startAcuity || 1.0;
    node.endAcuity = modeParams.endAcuity || modeParams.startAcuity || 1.0;
    node.acuityStep = modeParams.acuityStep || 0.1;
    node.stimDistance = modeParams.distanceMeters || generalDistance || 1;
    node.stimPPI = modeParams.ppi || screenPPI || 96;
    node.stimR = modeParams.startStimColor?.r ?? 255; node.stimG = modeParams.startStimColor?.g ?? 255; node.stimB = modeParams.startStimColor?.b ?? 255;
    node.bgR = modeParams.startBgColor?.r ?? 0; node.bgG = modeParams.startBgColor?.g ?? 0; node.bgB = modeParams.startBgColor?.b ?? 0;
    node.seriesCount = modeParams.seriesCount || 5; node.seriesSize = modeParams.seriesSize || 6; node.seriesThreshold = modeParams.seriesThreshold || 4;
    node.isActive = modeParams.isActive !== false;
    node.singleRandomPos = modeParams.singleRandomPos === true;
    node.singleGridEnabled = modeParams.singleGridEnabled === true;
    node.singleGridX = Math.max(1, Math.min(10, modeParams.singleGridX || 1));
    node.singleGridY = Math.max(1, Math.min(10, modeParams.singleGridY || 1));
    node.singleGridShowLines = modeParams.singleGridShowLines === true;
    node.singleGridRandomCell = modeParams.singleGridRandomCell !== false;
    node.singleGridAvoidRepeat = modeParams.singleGridAvoidRepeat !== false;
    node.singleGridFixedRow = modeParams.singleGridFixedRow || 0;
    node.singleGridFixedCol = modeParams.singleGridFixedCol || 0;
    node.singleGridCells = Array.isArray(modeParams.singleGridCells) ? modeParams.singleGridCells.slice() : [];
    node.singleStimDynamicEnabled = modeParams.singleStimDynamicEnabled === true;
    node.singleStimColor1 = modeParams.singleStimColor1 || { r: 255, g: 0, b: 0 };
    node.singleStimMidEnabled = modeParams.singleStimMidEnabled === true;
    node.singleStimColor3 = modeParams.singleStimColor3 || { r: 255, g: 255, b: 0 };
    node.singleStimColor2 = modeParams.singleStimColor2 || { r: 0, g: 0, b: 255 };
    node.singleStimDuration = modeParams.singleStimDuration || 10000;
    node.singleStimLoop = modeParams.singleStimLoop === true;
    node.singleStimReverse = modeParams.singleStimReverse === true;
    node.singleBgDynamicEnabled = modeParams.singleBgDynamicEnabled === true;
    node.singleBgColor1 = modeParams.singleBgColor1 || { r: 255, g: 0, b: 0 };
    node.singleBgMidEnabled = modeParams.singleBgMidEnabled === true;
    node.singleBgColor3 = modeParams.singleBgColor3 || { r: 255, g: 255, b: 0 };
    node.singleBgColor2 = modeParams.singleBgColor2 || { r: 0, g: 0, b: 255 };
    node.singleBgDuration = modeParams.singleBgDuration || 10000;
    node.singleBgLoop = modeParams.singleBgLoop === true;
    node.singleBgReverse = modeParams.singleBgReverse === true;
    node.singleCircleEnabled = modeParams.singleCircleEnabled === true;
    node.circleInnerEnabled = modeParams.circleInnerEnabled !== false;
    node.circleInnerRadiusPct = modeParams.circleInnerRadiusPct ?? 40;
    node.circleInnerColor1 = modeParams.circleInnerColor1 || { r: 255, g: 0, b: 0 };
    node.circleInnerMidEnabled = modeParams.circleInnerMidEnabled === true;
    node.circleInnerColor3 = modeParams.circleInnerColor3 || { r: 255, g: 255, b: 0 };
    node.circleInnerColor2 = modeParams.circleInnerColor2 || { r: 0, g: 0, b: 255 };
    node.circleInnerDuration = modeParams.circleInnerDuration || 10000;
    node.circleInnerLoop = modeParams.circleInnerLoop !== false;
    node.circleInnerReverse = modeParams.circleInnerReverse === true;
    node.circleOuterEnabled = modeParams.circleOuterEnabled !== false;
    node.circleOuterColor1 = modeParams.circleOuterColor1 || { r: 0, g: 255, b: 0 };
    node.circleOuterMidEnabled = modeParams.circleOuterMidEnabled === true;
    node.circleOuterColor3 = modeParams.circleOuterColor3 || { r: 0, g: 255, b: 255 };
    node.circleOuterColor2 = modeParams.circleOuterColor2 || { r: 0, g: 128, b: 255 };
    node.circleOuterDuration = modeParams.circleOuterDuration || 10000;
    node.circleOuterLoop = modeParams.circleOuterLoop !== false;
    node.circleOuterReverse = modeParams.circleOuterReverse === true;
    node.periEnabled = modeParams.periEnabled === true;
    node.periCount = modeParams.periCount || 4;
    node.periAcuity = modeParams.periAcuity ?? 0.3;
    node.periRadiusMinPct = modeParams.periRadiusMinPct ?? 60;
    node.periRadiusMaxPct = modeParams.periRadiusMaxPct ?? 90;
    node.periColor = modeParams.periColor || { r: 0, g: 255, b: 100 };
    node.periMotion = modeParams.periMotion || 'static';
    node.periSpeed = modeParams.periSpeed ?? 0.3;
    node.periRandomAngles = modeParams.periRandomAngles !== false;
    node.dfEnabled = modeParams.dfEnabled === true;
    node.dfCenterRadiusMm = modeParams.dfCenterRadiusMm ?? 13;
    node.dfCenterBg = modeParams.dfCenterBg || { r: 204, g: 0, b: 0 };
    node.dfStimColor = modeParams.dfStimColor || { r: 0, g: 0, b: 0 };
    node.dfPeriBg = modeParams.dfPeriBg || { r: 0, g: 71, b: 171 };
    node.dfPeriBlur = modeParams.dfPeriBlur || 0;
    node.blinkEnabled = modeParams.blinkEnabled === true;
    node.blinkTarget = modeParams.blinkTarget || 'stim';
    node.blinkColorA = modeParams.blinkColorA || { r: 255, g: 0, b: 0 };
    node.blinkColorB = modeParams.blinkColorB || { r: 0, g: 0, b: 255 };
    node.blinkIntervalMs = modeParams.blinkIntervalMs || 500;
    node.blinkDuty = modeParams.blinkDuty ?? 0.5;
    node.blinkCount = modeParams.blinkCount || 0;
    node.delay1 = modeParams.delay1 || 1000; node.duration = modeParams.startDuration || 1000;
    node.response = modeParams.response || 1000; node.delay2 = modeParams.delay2 || 1000;
    node.stimSize = getNodeComputedSize(node);
    const pn = prevId ? getNode(prevId) : null;
    if (pn && pn.id !== node.id) { node.x = pn.x + 340; node.y = pn.y; if (canAddConnection(pn.id, node.id, false)) connections.push({ fromId: pn.id, toId: node.id, isLoop: false, loopMode: 'TIME', loopLimit: 1, lifeTime: 0, initiateByAnswer: true, condition: 'none', inheritSize: false, inheritSpeed: false }); }
    requestRenderGraph(); updateInspector();
}
function modeParamsToReadingNode(modeParams) {
    const prevId = activeNodeId;
    const id = createNewNode('READING');
    const node = getNode(id);
    node.name = 'Чтение'; node.readingFontFamily = 'Segoe UI';
    node.readingAcuity = modeParams.startAcuity || 1.0;
    node.readingDistance = modeParams.readingDistance || readingDistance || 1;
    node.readingTextColor = modeParams.textColor || { r: 0, g: 0, b: 0 };
    node.readingBgMode = modeParams.bgMode || 'solid';
    node.readingBgColor = modeParams.bgColor || { r: 255, g: 255, b: 255 };
    node.readingSplitLeftWidthPercent = modeParams.splitLeftWidthPercent ?? 50;
    node.readingSplitLeftColor = modeParams.splitLeftColor; node.readingSplitRightColor = modeParams.splitRightColor;
    node.readingGradientMidEnabled = modeParams.gradientMidEnabled !== false;
    node.readingGradientLeftColor = modeParams.gradientLeftColor; node.readingGradientMidColor = modeParams.gradientMidColor;
    node.readingGradientMidPosition = modeParams.gradientMidPosition ?? 50; node.readingGradientRightColor = modeParams.gradientRightColor;
    node.readingDynamicMode = modeParams.dynamicMode || 'simple';
    node.readingDynamicReverse = modeParams.dynamicReverse === true;
    node.readingDynamicMidEnabled = modeParams.dynamicMidEnabled === true;
    node.readingDynamicStartColor = modeParams.dynamicStartColor; node.readingDynamicMidColor = modeParams.dynamicMidColor;
    node.readingDynamicEndColor = modeParams.dynamicEndColor;
    node.readingDynamicDuration = modeParams.dynamicDuration || 10000;
    node.readingDynamicLoop = modeParams.dynamicLoop === true;
    node.readingDynamicStep = modeParams.dynamicStep || 0.1;
    node.readingDynamicStepDuration = modeParams.dynamicStepDuration || 1000;
    node.readingDynamicShowLabel = modeParams.dynamicShowLabel !== false;
    node.duration = 60000;
    const text = (modeParams.text || '').trim();
    if (text) (async () => { const bid = await sha1(text); if (!window._books[bid]) window._books[bid] = { name: 'Текст из Режимов', text }; node.bookId = bid; node.bookName = window._books[bid].name; setLastBookId(bid); requestRenderGraph(); updateInspector(); })();
    const pn = prevId ? getNode(prevId) : null;
    if (pn && pn.id !== node.id) { node.x = pn.x + 340; node.y = pn.y; if (canAddConnection(pn.id, node.id, false)) connections.push({ fromId: pn.id, toId: node.id, isLoop: false, loopMode: 'TIME', loopLimit: 1, lifeTime: 0, initiateByAnswer: true, condition: 'none', inheritSize: false, inheritSpeed: false }); }
    requestRenderGraph(); updateInspector();
}

// ==================== БЛОКИ ====================
function renderBlockList() { blockListDiv.innerHTML = ''; blockList.forEach((b, i) => { const t = document.createElement('span'); t.className = 'block-tag'; t.innerHTML = `${escapeHtml(b.name)} (${escapeHtml(b.type)}) <span class="remove-block" data-index="${i}">✕</span>`; t.querySelector('.remove-block').addEventListener('click', function (e) { e.stopPropagation(); blockList.splice(parseInt(this.dataset.index), 1); renderBlockList(); }); blockListDiv.appendChild(t); }); blockCountSpan.textContent = `Блоков: ${blockList.length}`; blockListDiv.style.display = blockList.length > 0 ? 'block' : 'none'; }
function addBlock() { const type = blockSelect.value, name = blockNameInput.value.trim() || 'Блок'; let p = {}; if (type === 'warmup') p = { count: 5, size: 200, duration: 1000 }; else if (type === 'complex') p = { count: 10, size: 80, duration: 500 }; else if (type === 'random') p = { count: 8, size: 150, duration: 800 }; else if (type === 'custom') { const c = prompt('Количество:', '5'); p = { count: parseInt(c) || 5, size: 120, duration: 700 }; } blockList.push({ type, params: p, name }); renderBlockList(); blockNameInput.value = ''; }
function clearBlocks() { blockList = []; renderBlockList(); }
function generateSequenceFromBlocks() { if (blockList.length === 0) { alert('Список пуст'); return; } nodes = []; connections = []; activeNodeId = null; inspectorEl.style.display = 'none'; updateInspector(); let prevId = null; blockList.forEach((b, i) => { const x = 100 + i * 300, y = 100; const nid = createNewNode('STIMULUS', x, y); const n = getNode(nid); n.name = b.name || 'Блок ' + (i+1); n.duration = b.params.duration || 1000; if (prevId) connections.push({ fromId: prevId, toId: nid, isLoop: false, loopMode: 'TIME', loopLimit: 1, lifeTime: 0, initiateByAnswer: true, condition: 'none', inheritSize: false, inheritSpeed: false }); prevId = nid; }); activeNodeId = nodes.length > 0 ? nodes[0].id : null; if (activeNodeId) { inspectorEl.style.display = 'block'; updateInspector(); } requestRenderGraph(); alert('Последовательность создана.'); }

// ==================== БИБЛИОТЕКА ====================
async function loadScenarioList() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('scenarios').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    const list = document.getElementById('scenario-list'); list.innerHTML = '';
    (data || []).forEach(sc => { const div = document.createElement('div'); div.style.cssText = 'border-bottom:1px solid #333;padding:6px;'; const nodeCount = sc.params?.graph?.nodes?.length || sc.params?.nodes?.length || 0; const connCount = sc.params?.graph?.connections?.length || sc.params?.connections?.length || 0; div.innerHTML = `<b>${escapeHtml(sc.name)}</b> (${escapeHtml(sc.training_type || '')})<br><span style="font-size:11px;color:#94a3b8;">Узлов: ${nodeCount}, связей: ${connCount}</span><br><button class="btn btn-secondary btn-load-scenario" data-id="${escapeHtml(sc.id)}">Загрузить</button>`; list.appendChild(div); });
    document.querySelectorAll('.btn-load-scenario').forEach(btn => { btn.addEventListener('click', async () => { const id = btn.dataset.id; let sc = await getScenarioFromLocal(id); if (!sc) { const r = await supabaseClient.from('scenarios').select('*').eq('id', id).single(); if (r.error || !r.data) { alert('Ошибка загрузки'); return; } sc = r.data; await saveScenarioToLocal(sc); } trainingNode = { params: sc.params }; window._pendingGeneratorMode = true; const graph = sc.params?.graph || sc.params; if (graph?.nodes) { nodes = graph.nodes; connections = graph.connections || []; window._books = graph.books || {}; if (sc.params?.scenarioKey) window._currentScenarioKey = sc.params.scenarioKey; requestRenderGraph(); alert('Сценарий загружен в граф.'); } else { alert('Сценарий загружен. Нажмите «Плеер».'); } }); });
}
async function saveCurrentScenario() {
    if (!currentUser) { alert('Войдите'); return; }
    if (!trainingNode || !trainingNode.params) { alert('Нет тренировки'); return; }
    const name = prompt('Название:');
    if (!name) return;
    const payload = buildScenarioPayloadFromCurrent();
    payload.trainingType = trainingNode.params.trainingType || payload.trainingType || 'single';
    const data = {
        name,
        training_type: payload.trainingType,
        params: (() => { const c = JSON.parse(JSON.stringify(payload)); delete c.scenarioKey; delete c.trainingType; return c; })(),
        created_by: currentUser.id,
        created_at: new Date().toISOString()
    };
    const { data: res, error } = await supabaseClient.from('scenarios').insert([data]).select().single();
    if (error) { alert('Ошибка: ' + error.message); return; }
    await saveScenarioToLocal(res);
    alert('Сохранено: ' + name + '\nУзлов: ' + payload.graph.nodes.length + ', связей: ' + payload.graph.connections.length);
    loadScenarioList();
}
async function loadUsers() { if (!supabaseClient) return; const { data: profiles } = await supabaseClient.from('profiles').select('id, email, full_name'); const us = document.getElementById('selected-user'); us.innerHTML = ''; (profiles || []).forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.email + (p.full_name ? ' (' + p.full_name + ')' : ''); us.appendChild(o); }); const { data: scenarios } = await supabaseClient.from('scenarios').select('id, name'); const sc = document.getElementById('selected-scenario'); sc.innerHTML = ''; (scenarios || []).forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; sc.appendChild(o); }); }
async function assignScenario() { const u = document.getElementById('selected-user').value, s = document.getElementById('selected-scenario').value; if (!u || !s) { alert('Выберите'); return; } const { error } = await supabaseClient.from('user_scenarios').upsert([{ user_id: u, scenario_id: s, status: 'ready' }], { onConflict: 'user_id' }); if (error) { alert('Ошибка: ' + error.message); return; } alert('Назначено'); }

// ==================== СОХРАНЕНИЕ / ЗАГРУЗКА ГРАФА ====================
async function saveGraph() {
    if (_saveGraphInFlight) { console.warn('[saveGraph] уже сохраняется'); return; }
    _saveGraphInFlight = true;
    try {
        if (!window._currentScenarioKey) window._currentScenarioKey = generateScenarioKey();
        const data = buildScenarioPayloadFromCurrent();
        const jsonStr = JSON.stringify(data, null, 2);

        if (HAS_FS_ACCESS && selectedFolderHandle) {
            try {
                let fileName = window._currentScenarioFileName;
                if (!fileName) {
                    const ans = prompt('Имя файла сценария (без пути):',
                        'scenario_' + new Date().toISOString().slice(0, 10) + '.json');
                    if (!ans) return;
                    fileName = /\.json$/i.test(ans) ? ans : ans + '.json';
                    window._currentScenarioFileName = fileName;
                }
                const fh = await selectedFolderHandle.getFileHandle(fileName, { create: true });
                const w = await fh.createWritable();
                await w.write(jsonStr);
                await w.close();
                alert('Файл сохранён: ' + fileName);
                syncFolderWithCloudEnsured('after-save');
                return;
            } catch (err) {
                console.warn('[saveGraph] запись в папку:', err);
            }
        }

        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = window._currentScenarioFileName || 'scenario.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } finally {
        _saveGraphInFlight = false;
    }
}
function loadGraph(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (file && file.name) window._currentScenarioFileName = file.name;
            const g = data.graph || data;
            nodes = g.nodes || [];
            connections = g.connections || [];
            window._books = g.books || {};
            if (data.scenarioKey && typeof data.scenarioKey === 'string') window._currentScenarioKey = data.scenarioKey;
            else window._currentScenarioKey = generateScenarioKey();
            if (data.distances) { if (typeof data.distances.general === 'number') generalDistance = data.distances.general; if (typeof data.distances.reading === 'number') readingDistance = data.distances.reading; if (typeof data.distances.incTol === 'number') distanceToleranceIncreasePct = data.distances.incTol; if (typeof data.distances.decTol === 'number') distanceToleranceDecreasePct = data.distances.decTol; if (typeof data.distances.timeout === 'number') distanceRestoreTimeoutSec = data.distances.timeout; }
            if (data.blink) { if (typeof data.blink.enabled === 'boolean') blinkEnabled = data.blink.enabled; if (typeof data.blink.threshold === 'number') blinkThreshold = data.blink.threshold; if (typeof data.blink.minRate === 'number') blinkMinRate = data.blink.minRate; if (typeof data.blink.window === 'number') blinkWindowSec = data.blink.window; if (typeof data.blink.lockShow === 'boolean') blinkLockShow = data.blink.lockShow; }
            saveUserSettings();
            connections.forEach(c => { if (c.inheritSize === undefined) c.inheritSize = false; if (c.inheritSpeed === undefined) c.inheritSpeed = false; delete c.inheritBook; delete c.inheritPosition; });
            nodes.forEach(node => {
                if ((node.nodeType === 'STIMULUS' || node.nodeType === 'DYNAMIC') && node.stimAcuity === undefined) {
                    const d = generalDistance || 1, ppi = screenPPI || 96;
                    const oldS = node.stimSize || 40;
                    const sizeMm = oldS * 25.4 / ppi;
                    const V = d * 1.454 / Math.max(0.01, sizeMm);
                    node.stimAcuity = Math.max(0.1, Math.min(2.0, Math.round(V * 10) / 10));
                    node.stimDistance = d; node.stimPPI = ppi; node.stimSize = getNodeComputedSize(node);
                }
                if (node.nodeType === 'STIMULUS' || node.nodeType === 'DYNAMIC') {
                    if (node.endAcuity === undefined) node.endAcuity = node.stimAcuity || 1.0;
                    if (node.acuityStep === undefined) node.acuityStep = 0.1;
                    if (node.seriesCount === undefined) node.seriesCount = 5;
                    if (node.seriesSize === undefined) node.seriesSize = 6;
                    if (node.seriesThreshold === undefined) node.seriesThreshold = 4;
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
                    if (node.circleInnerColor3 === undefined) node.circleInnerColor3 = { r: 255, g: 255, b: 0 };
                    if (node.circleInnerColor2 === undefined) node.circleInnerColor2 = { r: 0, g: 0, b: 255 };
                    if (node.circleInnerDuration === undefined) node.circleInnerDuration = 10000;
                    if (node.circleInnerLoop === undefined) node.circleInnerLoop = true;
                    if (node.circleInnerReverse === undefined) node.circleInnerReverse = false;
                    if (node.circleOuterEnabled === undefined) node.circleOuterEnabled = true;
                    if (node.circleOuterColor1 === undefined) node.circleOuterColor1 = { r: 0, g: 255, b: 0 };
                    if (node.circleOuterMidEnabled === undefined) node.circleOuterMidEnabled = false;
                    if (node.circleOuterColor3 === undefined) node.circleOuterColor3 = { r: 0, g: 255, b: 255 };
                    if (node.circleOuterColor2 === undefined) node.circleOuterColor2 = { r: 0, g: 128, b: 255 };
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
                if (node.nodeType === 'READING') { if (node.readingFontFamily === undefined) node.readingFontFamily = 'Segoe UI'; if (node.readingFontWeight === undefined) node.readingFontWeight = 'normal'; if (node.readingAcuity === undefined) node.readingAcuity = 1.0; if (node.readingDistance === undefined) node.readingDistance = readingDistance || 1; if (node.readingTextColor === undefined) node.readingTextColor = { r: 0, g: 0, b: 0 }; if (node.readingBgColor === undefined) node.readingBgColor = { r: 255, g: 255, b: 255 }; if (node.readingBgMode === undefined) node.readingBgMode = 'solid'; if (node.duration === undefined) node.duration = 60000; if (node.autoSaveBookmark === undefined) node.autoSaveBookmark = true; if (node.continueFromBookmark === undefined) node.continueFromBookmark = true; }
                if (node.nodeType === 'COMPARE') { if (!node.compareMode) node.compareMode = 'direction'; if (node.pairsCount === undefined) node.pairsCount = 2; if (!node.gridX) node.gridX = 3; if (!node.gridY) node.gridY = 3; if (!Array.isArray(node.activeCells) || node.activeCells.length < 2) node.activeCells = [{ row: 0, col: 0 }, { row: 0, col: 1 }]; if (!Array.isArray(node.cellParams)) node.cellParams = []; while (node.cellParams.length < node.activeCells.length) node.cellParams.push(defaultCompareCellParams()); if (node.seriesCount === undefined) node.seriesCount = 5; if (node.seriesSize === undefined) node.seriesSize = 6; if (node.seriesThreshold === undefined) node.seriesThreshold = 4; if (node.delay1 === undefined) node.delay1 = 1000; if (node.duration === undefined) node.duration = 2000; if (node.delay2 === undefined) node.delay2 = 1000; }
            });
            requestRenderGraph(); updateInspector();
        } catch (err) { alert('Ошибка загрузки'); console.error(err); }
    };
    reader.readAsText(file);
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
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
    openDatabase().then(async d => {
        db = d;
        syncPendingResults();
        await restoreFolderHandle();
        setTimeout(() => { syncFolderWithCloudEnsured('startup'); }, 1200);
    }).catch(err => console.error(err));
    registerServiceWorker();
    ensureSingleGridGeneratorUI();
    ensureDistanceGeneratorUI();
    ensureBlinkGeneratorUI();
    ensureCircleGeneratorUI();
    ensurePeripheralGeneratorUI();
    ensureDefocusGeneratorUI();
    ensureBlinkAnimationGeneratorUI();
    ensureBlinkCalibrationUI();
    const sfn = localStorage.getItem('selectedFolderName'); if (sfn) folderStatus.textContent = 'Папка: ' + sfn;

    btnSelectFolder.addEventListener('click', selectFolder);
    if (folderInput) {
        folderInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files && files.length) {
                await syncFromFileList(files);
            }
            folderInput.value = '';
        });
    }
    btnPlayer.addEventListener('click', startPlayer);
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
    document.getElementById('scenario-time-close')?.addEventListener('click', () => { document.getElementById('scenario-time-modal').style.display = 'none'; });
    document.getElementById('screen-calib-cancel')?.addEventListener('click', () => document.getElementById('screen-calib-modal').style.display = 'none');
    document.getElementById('screen-calib-apply')?.addEventListener('click', applyScreenCalib);
    document.getElementById('book-picker-close')?.addEventListener('click', closeBookPicker);
    document.getElementById('book-picker-detach')?.addEventListener('click', detachBookFromActiveNode);
    document.getElementById('book-picker-file')?.addEventListener('change', async e => { const f = e.target.files[0]; if (f) await handleBookPickerFileUpload(f); e.target.value = ''; });
    document.getElementById('book-picker-modal')?.addEventListener('click', e => { if (e.target.id === 'book-picker-modal') closeBookPicker(); });
    document.getElementById('reading-prev')?.addEventListener('click', prevReadingPage);
    document.getElementById('reading-next')?.addEventListener('click', nextReadingPage);
    document.getElementById('reading-play-pause')?.addEventListener('click', toggleReadingPause);
    document.getElementById('reading-bookmark')?.addEventListener('click', saveReadingBookmark);
    document.getElementById('reading-open-bookmark')?.addEventListener('click', openReadingBookmark);
    document.getElementById('reading-not-see')?.addEventListener('click', () => changeAcuityByStep(-0.1));
    document.getElementById('reading-see-well')?.addEventListener('click', () => changeAcuityByStep(+0.1));
    document.getElementById('reading-finish')?.addEventListener('click', finishReadingNode);
    document.getElementById('reading-font-input')?.addEventListener('change', e => { const n = (e.target.value || '').trim(); if (!n) return; const node = getNode(window._currentReadingNodeId); if (node && node.nodeType === 'READING') { node.readingFontFamily = n; applyReadingFontForNode(node); requestRenderGraph(); } else { readingFontFamily = n; if (readingContentEl) readingContentEl.style.fontFamily = `'${n.replace(/['"]/g, '')}', 'Segoe UI', sans-serif`; } saveUserSettings(); setTimeout(() => { setupReadingColumns(); readingTotalPages = calcReadingTotalPages(); scrollReadingToPage(0); }, 60); });
    document.getElementById('reading-font-picker')?.addEventListener('click', openFontPicker);
    document.getElementById('font-picker-close')?.addEventListener('click', closeFontPicker);
    document.getElementById('font-picker-search')?.addEventListener('input', e => renderFontPickerList(e.target.value));
    document.getElementById('font-picker-modal')?.addEventListener('click', e => { if (e.target.id === 'font-picker-modal') closeFontPicker(); });
    document.getElementById('reading-font-sivtsev')?.addEventListener('click', () => { const node = getNode(window._currentReadingNodeId); if (node && node.nodeType === 'READING') { node.readingFontFamily = 'Sivtsev'; applyReadingFontForNode(node); requestRenderGraph(); } else { readingFontFamily = 'Sivtsev'; if (readingContentEl) readingContentEl.style.fontFamily = `'Sivtsev', 'Segoe UI', sans-serif`; } const i = document.getElementById('reading-font-input'); if (i) i.value = 'Sivtsev'; saveUserSettings(); setTimeout(() => { setupReadingColumns(); readingTotalPages = calcReadingTotalPages(); scrollReadingToPage(0); }, 60); });
    const fontFileBtn = document.getElementById('reading-font-file'), fontFileInput = document.getElementById('reading-font-file-input');
    if (fontFileBtn && fontFileInput) { fontFileBtn.addEventListener('click', () => fontFileInput.click()); fontFileInput.addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { const buf = await f.arrayBuffer(); const familyName = f.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9\u0400-\u04FF_ -]/g, '_') || 'CustomFont'; const font = new FontFace(familyName, buf); await font.load(); document.fonts.add(font); const node = getNode(window._currentReadingNodeId); if (node && node.nodeType === 'READING') { node.readingFontFamily = familyName; applyReadingFontForNode(node); requestRenderGraph(); } else { readingFontFamily = familyName; if (readingContentEl) readingContentEl.style.fontFamily = `'${familyName.replace(/['"]/g, '')}', 'Segoe UI', sans-serif`; } const i = document.getElementById('reading-font-input'); if (i) i.value = familyName; saveUserSettings(); setTimeout(() => { setupReadingColumns(); readingTotalPages = calcReadingTotalPages(); scrollReadingToPage(0); }, 60); } catch (err) { alert('Не удалось загрузить шрифт: ' + err.message); } fontFileInput.value = ''; }); }
    document.getElementById('reading-font-system')?.addEventListener('click', async () => { if (!('queryLocalFonts' in window)) { alert('Браузер не поддерживает список системных шрифтов.'); return; } try { const fonts = await window.queryLocalFonts(); const fams = [...new Set(fonts.map(f => f.family))].sort((a, b) => a.localeCompare(b, 'ru')); const list = document.getElementById('reading-font-list'); list.innerHTML = ''; const first = document.createElement('option'); first.value = 'Sivtsev'; first.textContent = 'Сивцев'; list.appendChild(first); const pref = ['Segoe UI','Arial','Times New Roman','Calibri','Verdana','Georgia','Tahoma']; const ordered = [...pref.filter(p => fams.includes(p)), ...fams.filter(f => !pref.includes(f) && f.toLowerCase() !== 'sivtsev')]; for (const fam of ordered) { const o = document.createElement('option'); o.value = fam; list.appendChild(o); } alert(`Загружено ${fams.length} шрифтов.`); } catch (err) { alert('Ошибка: ' + err.message); } });
    document.getElementById('reading-bold-toggle')?.addEventListener('click', () => { const node = getNode(window._currentReadingNodeId); if (node && node.nodeType === 'READING') { node.readingFontWeight = (node.readingFontWeight === 'bold') ? 'normal' : 'bold'; applyReadingFontForNode(node); requestRenderGraph(); } else { readingFontWeight = (readingFontWeight === 'bold') ? 'normal' : 'bold'; if (readingContentEl) readingContentEl.style.fontWeight = readingFontWeight; } const b = document.getElementById('reading-bold-toggle'); if (b) { const isB = (node ? node.readingFontWeight : readingFontWeight) === 'bold'; b.classList.toggle('active', isB); } saveUserSettings(); setTimeout(() => { setupReadingColumns(); readingTotalPages = calcReadingTotalPages(); scrollReadingToPage(0); }, 60); });
    if (readingViewportEl) { let t = null; readingViewportEl.addEventListener('scroll', () => { if (readingViewportEl.style.display === 'none' || t) return; t = setTimeout(() => { t = null; const W = readingViewportEl.clientWidth; if (W <= 0) return; const np = Math.round(readingViewportEl.scrollLeft / W); if (np !== readingPage) { readingPage = Math.max(0, Math.min(np, readingTotalPages - 1)); window._currentReadingPage = readingPage; const i = document.getElementById('reading-page-info'); if (i) i.textContent = `Стр. ${readingPage + 1} / ${readingTotalPages}`; } }, 100); }); }
    if (readingFileInput) { readingFileInput.addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; const n = (f.name || '').toLowerCase(); if (!(n.endsWith('.txt') || n.endsWith('.fb2') || n.endsWith('.epub'))) { alert('Поддерживаются .txt, .fb2, .epub'); readingFileInput.value = ''; return; } if (readingFileName) readingFileName.textContent = '⏳ Загрузка: ' + f.name; try { const t = await parseReadingFile(f); const clean = (t || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); if (!clean) { alert('Файл пуст'); return; } const ta = document.getElementById('gen-reading-text'); if (ta) ta.value = clean; if (readingFileName) readingFileName.textContent = `✅ ${f.name} (${clean.length} символов)`; } catch (err) { alert('Ошибка: ' + err.message); } readingFileInput.value = ''; }); }

    btnGenerator.addEventListener('click', () => {
        modal.style.display = 'flex';
        selectedCells = [];
        const dgX = parseInt(document.getElementById('gen-grid-x').value) || 3, dgY = parseInt(document.getElementById('gen-grid-y').value) || 3;
        if (dgX * dgY >= 2) { selectedCells.push({ row: 0, col: 0 }); if (dgX > 1) selectedCells.push({ row: 0, col: 1 }); else selectedCells.push({ row: 1, col: 0 }); }
        renderGridPreview(); generateCellParamsFields();
        document.getElementById('gen-threshold').value = getThreshold(parseInt(document.getElementById('gen-series-size').value));
        const p = document.getElementById('gen-ppi'); if (p) p.value = screenPPI;
        if (readingFileName) readingFileName.textContent = '';
        const gdEl = document.getElementById('gen-general-distance'); if (gdEl) gdEl.value = generalDistance;
        const rdEl = document.getElementById('gen-reading-distance'); if (rdEl) rdEl.value = readingDistance;
        const tiEl = document.getElementById('gen-tol-inc'); if (tiEl) tiEl.value = distanceToleranceIncreasePct;
        const tdEl = document.getElementById('gen-tol-dec'); if (tdEl) tdEl.value = distanceToleranceDecreasePct;
        const ttEl = document.getElementById('gen-tol-timeout'); if (ttEl) ttEl.value = distanceRestoreTimeoutSec;
        const beEl = document.getElementById('gen-blink-enabled'); if (beEl) beEl.checked = blinkEnabled;
        const bmrEl = document.getElementById('gen-blink-min-rate'); if (bmrEl) bmrEl.value = blinkMinRate;
        const bwEl = document.getElementById('gen-blink-window'); if (bwEl) bwEl.value = blinkWindowSec;
        const blsEl = document.getElementById('gen-blink-lock-show'); if (blsEl) blsEl.checked = blinkLockShow;
        updateGeneratorVisibility(); updateBgModeVisibility(); updateGradientMidVisibility();
        updateDynamicMidVisibility(); updateDynamicModeVisibility(); updatePhysioListHint();
        updateSingleStimDynamicVisibility(); updateSingleStimMidVisibility();
        updateSingleBgDynamicVisibility(); updateSingleBgMidVisibility();
    });
    document.getElementById('gen-cancel').addEventListener('click', () => { modal.style.display = 'none'; });
    document.getElementById('gen-series-size').addEventListener('change', function () { document.getElementById('gen-threshold').value = getThreshold(parseInt(this.value)); });
    document.getElementById('gen-to-node').addEventListener('click', () => { const tt = document.getElementById('gen-training-type').value; const mp = buildModeParamsFromUI(); modal.style.display = 'none'; if (tt === 'reading') { modeParamsToReadingNode(mp); alert('📌 Узел «Чтение» создан.'); } else if (tt === 'single') { modeParamsToNode(mp); alert('📌 Узел создан.'); } else alert('Сравнение пока не переносится в узел.'); });
    document.getElementById('gen-apply').addEventListener('click', () => { modal.style.display = 'none'; trainingNode = { id: 'training_node', params: buildModeParamsFromUI() }; window._pendingGeneratorMode = true; alert('Тренировка готова. Нажмите «Плеер».'); });
    document.getElementById('gen-training-type').addEventListener('change', function () { updateGeneratorVisibility(); if (this.value === 'compare') { renderGridPreview(); generateCellParamsFields(); } });
    document.getElementById('gen-reading-bg-mode')?.addEventListener('change', updateBgModeVisibility);
    document.getElementById('gen-reading-gradient-mid-enabled')?.addEventListener('change', updateGradientMidVisibility);
    document.getElementById('gen-reading-dynamic-mid-enabled')?.addEventListener('change', updateDynamicMidVisibility);
    document.getElementById('gen-reading-dynamic-mode')?.addEventListener('change', updateDynamicModeVisibility);
    document.getElementById('gen-reading-dynamic-step')?.addEventListener('change', updatePhysioListHint);
    document.getElementById('gen-single-stim-dynamic-enabled')?.addEventListener('change', updateSingleStimDynamicVisibility);
    document.getElementById('gen-single-stim-mid-enabled')?.addEventListener('change', updateSingleStimMidVisibility);
    document.getElementById('gen-single-bg-dynamic-enabled')?.addEventListener('change', updateSingleBgDynamicVisibility);
    document.getElementById('gen-single-bg-mid-enabled')?.addEventListener('change', updateSingleBgMidVisibility);

    function updateGeneratorVisibility() { const t = document.getElementById('gen-training-type').value; document.getElementById('single-grid-settings').style.display = t === 'single' ? 'block' : 'none'; document.getElementById('compare-settings').style.display = t === 'compare' ? 'block' : 'none'; document.getElementById('reading-settings').style.display = t === 'reading' ? 'block' : 'none'; }
    function updateBgModeVisibility() { const m = document.getElementById('gen-reading-bg-mode')?.value || 'solid'; const s = document.getElementById('reading-solid-settings'), sp = document.getElementById('reading-split-settings'); const g = document.getElementById('reading-gradient-settings'), d = document.getElementById('reading-dynamic-settings'); if (s) s.style.display = m === 'solid' ? 'block' : 'none'; if (sp) sp.style.display = m === 'split' ? 'block' : 'none'; if (g) g.style.display = m === 'gradient' ? 'block' : 'none'; if (d) d.style.display = m === 'dynamic' ? 'block' : 'none'; }
    function updateGradientMidVisibility() { const cb = document.getElementById('gen-reading-gradient-mid-enabled'); const show = cb ? cb.checked : true; const r = document.getElementById('gradient-mid-row'); const l = document.getElementById('gradient-mid-pos-label'); const i = document.getElementById('gen-reading-gradient-mid-position'); if (r) r.style.display = show ? 'flex' : 'none'; if (l) l.style.display = show ? 'block' : 'none'; if (i) i.style.display = show ? 'block' : 'none'; }
    function updateDynamicMidVisibility() { const cb = document.getElementById('gen-reading-dynamic-mid-enabled'); const s = cb ? cb.checked : false; const r = document.getElementById('dynamic-mid-row'); if (r) r.style.display = s ? 'flex' : 'none'; }
    function updateDynamicModeVisibility() { const m = document.getElementById('gen-reading-dynamic-mode')?.value || 'simple'; const sc = document.getElementById('reading-dynamic-simple-colors'); const ps = document.getElementById('reading-dynamic-physio-settings'); const ds = document.getElementById('reading-dynamic-duration-settings'); if (sc) sc.style.display = m === 'simple' ? 'block' : 'none'; if (ps) ps.style.display = m === 'physiological' ? 'block' : 'none'; if (ds) ds.style.display = m === 'physiological' ? 'none' : 'block'; if (m === 'simple') updateDynamicMidVisibility(); if (m === 'physiological') updatePhysioListHint(); }
    function updatePhysioListHint() { const h = document.getElementById('physio-list-hint'); const ss = document.getElementById('gen-reading-dynamic-step'); const sd = ss ? Math.max(0.1, parseFloat(ss.value) || 0.1) : 0.1; const l = document.getElementById('gen-reading-dynamic-step-duration-label'); if (l) l.textContent = `Длительность шага (${sd.toFixed(1)} дптр)`; if (!h) return; let c = 0; for (const p of PHYSIOLOGICAL_PHASES) { const r = p.diopters / sd; if (Math.abs(r - Math.round(r)) < 1e-6) c++; } const last = PHYSIOLOGICAL_PHASES[PHYSIOLOGICAL_PHASES.length - 1]; const lr = last.diopters / sd; if (Math.abs(lr - Math.round(lr)) > 1e-6) c++; h.textContent = `0.0 → +1.6 дптр • ${c} точек • шаг ${sd.toFixed(1)} • Thibos et al.`; }
    function updateSingleStimDynamicVisibility() { const cb = document.getElementById('gen-single-stim-dynamic-enabled'); const s = cb ? cb.checked : false; const p = document.getElementById('single-stim-dynamic-settings'); if (p) p.style.display = s ? 'block' : 'none'; if (s) updateSingleStimMidVisibility(); }
    function updateSingleStimMidVisibility() { const cb = document.getElementById('gen-single-stim-mid-enabled'); const s = cb ? cb.checked : false; const r = document.getElementById('single-stim-mid-row'); if (r) r.style.display = s ? 'flex' : 'none'; }
    function updateSingleBgDynamicVisibility() { const cb = document.getElementById('gen-single-bg-dynamic-enabled'); const s = cb ? cb.checked : false; const p = document.getElementById('single-bg-dynamic-settings'); if (p) p.style.display = s ? 'block' : 'none'; if (s) updateSingleBgMidVisibility(); }
    function updateSingleBgMidVisibility() { const cb = document.getElementById('gen-single-bg-mid-enabled'); const s = cb ? cb.checked : false; const r = document.getElementById('single-bg-mid-row'); if (r) r.style.display = s ? 'flex' : 'none'; }

    btnEnableCamera.addEventListener('click', enableCamera);
    btnDisableCamera.addEventListener('click', disableCamera);
    btnCalibrate.addEventListener('click', openCalibrationModal);
    document.getElementById('calibrate-confirm').addEventListener('click', calibrateFocalLength);
    document.getElementById('calibrate-cancel').addEventListener('click', () => document.getElementById('calibration-modal').style.display = 'none');
    btnInspector.addEventListener('click', () => { const h = !inspectorEl.style.display || inspectorEl.style.display === 'none'; inspectorEl.style.display = h ? 'block' : 'none'; });
    btnSave.addEventListener('click', saveGraph);
    btnOpen.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => { if (e.target.files[0]) loadGraph(e.target.files[0]); e.target.value = ''; });
    btnAddBlock.addEventListener('click', addBlock);
    btnClearBlocks.addEventListener('click', clearBlocks);
    btnGenerateSequence.addEventListener('click', generateSequenceFromBlocks);
    btnLibrary.addEventListener('click', () => { document.getElementById('library-modal').style.display = 'flex'; loadScenarioList(); });
    document.getElementById('btn-library-close').addEventListener('click', () => document.getElementById('library-modal').style.display = 'none');
    document.getElementById('btn-save-current-scenario').addEventListener('click', saveCurrentScenario);
    btnUsers.addEventListener('click', () => { document.getElementById('users-modal').style.display = 'flex'; loadUsers(); });
    document.getElementById('btn-users-close').addEventListener('click', () => document.getElementById('users-modal').style.display = 'none');
    document.getElementById('btn-assign-scenario').addEventListener('click', assignScenario);
    document.addEventListener('click', e => { const m = document.getElementById('connection-menu'); if (m.style.display === 'block' && !m.contains(e.target)) hideConnectionMenu(); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousedown', e => { if (e.target === canvas) { activeNodeId = null; updateInspector(); inspectorEl.style.display = 'none'; requestRenderGraph(); if (window._pendingConnectionHandler) cancelConnection(); } });
    document.getElementById('pause-continue').addEventListener('click', resumeTraining);
    document.getElementById('pause-exit').addEventListener('click', exitTrainingFromPause);
    btnAuth.addEventListener('click', () => { if (currentUser) signOut(); else showAuthModal('signin'); });
    document.getElementById('auth-toggle').addEventListener('click', () => showAuthModal(authMode === 'signin' ? 'signup' : 'signin'));
    document.getElementById('auth-submit').addEventListener('click', async () => { const e = document.getElementById('auth-email').value.trim(); const p = document.getElementById('auth-password').value; const n = document.getElementById('auth-name').value.trim(); if (authMode === 'signin') await signIn(e, p); else { if (!n) return alert('Введите имя'); await signUp(e, p, n); } document.getElementById('auth-modal').style.display = 'none'; });
    window.addEventListener('resize', () => { if (readingViewportEl && readingViewportEl.style.display !== 'none') { const sp = readingPage; setupReadingColumns(); setTimeout(() => { readingTotalPages = calcReadingTotalPages(); scrollReadingToPage(Math.min(sp, readingTotalPages - 1)); }, 60); } });
    window.addEventListener('beforeunload', () => { saveCurrentReadingBookmarkSilently(); window.Voice?.stopReading(); });

    createNewNode('STIMULUS', 200, 150);
    switchMode('nodes');
    updateGeneratorVisibility(); updateBgModeVisibility(); updateGradientMidVisibility();
    updateDynamicMidVisibility(); updateDynamicModeVisibility(); updatePhysioListHint();
    updateSingleStimDynamicVisibility(); updateSingleStimMidVisibility();
    updateSingleBgDynamicVisibility(); updateSingleBgMidVisibility();
}

// ==================== ONLINE / OFFLINE ====================
window.addEventListener('online', () => {
    syncPendingResults();
    syncFolderWithCloudEnsured('online');
    setSyncStatus('warn', '📡 снова онлайн');
    setTimeout(() => setSyncStatus('ok', '☁️ синх.'), 1500);
});
window.addEventListener('offline', () => setSyncStatus('warn', '📡 офлайн'));

init();

// ==================== app.js: Конец части 3 из 3 ====================