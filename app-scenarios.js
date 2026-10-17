/* app-scenarios.js — сохранение, загрузка, библиотека, шаблоны, book picker
 * §A2-v6 (Фаза 5). Экспорт: window.AppScenarios
 * Зависимости: window.Data, VissortDialog, window.AppEditor, VLog,
 *              window.generateScenarioKey, window.bookmarkKeyFor,
 *              window.getLastBookId, window.setLastBookId
 */
(function () {

  const VLog = window.VLog;
  const Data = window.Data;
  const HAS_FS_ACCESS = typeof window.showDirectoryPicker === 'function';

  // Ленивые мосты — app.js устанавливает их в footer, порядок загрузки не критичен
  const generateScenarioKey = (...a) => window.generateScenarioKey(...a);
  const bookmarkKeyFor     = (...a) => window.bookmarkKeyFor(...a);
  const getLastBookId      = (...a) => window.getLastBookId(...a);
  const setLastBookId      = (...a) => window.setLastBookId(...a);

  // === TEMPLATES (было app.js 1685–1900) ===
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


  // === BOOK PICKER (было app.js 1902–1988) ===
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
  // === FOLDER HANDLE (было app.js 2398–2486) ===

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


  // === SAVE / LOAD GRAPH (было app.js 2487–2780) ===
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


  // === LIBRARY (было app.js 2781–2860) ===
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

  window.AppScenarios = {
    saveNodeAsTemplate, applyTemplateToCanvas, loadTemplatesFolder,
    importTemplatesFromFolder, importTemplatesFromFileList,
    refreshTemplatesIfOpen, renderTemplatesList, openTemplatesModal,
    exportAllTemplates,
    openBookPicker, closeBookPicker, renderBookPickerList,
    applyBookSelection, detachBookFromActiveNode, handleBookPickerFileUpload,
    restoreFolderHandle, restoreTemplatesFolderHandle, selectFolder,
    scanScenariosFolder, saveGraph, buildScenarioPayloadFromCurrent,
    migrateScenario, loadGraph,
    loadScenarioList, saveCurrentScenario,
  };

  VLog.log('[app-scenarios] loaded, methods:', Object.keys(window.AppScenarios).length);
})();
