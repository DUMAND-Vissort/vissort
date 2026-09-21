// ============================================================
// data-layer.js
// Единая прослойка между UI и источниками данных.
//   • IndexedDB (кэш, офлайн-хранилище)
//   • Supabase REST (облако)
//   • Очередь изменений (syncQueue) для офлайна
//   • Автосинхронизация при появлении сети
// ============================================================
(function installDataLayer(global) {
    'use strict';

    // ============================================================
    // КОНСТАНТЫ
    // ============================================================
    const SUPABASE_URL = 'https://hzvypwdpdhsjzaclxmbm.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6dnlwd2RwZGhzanphY2x4bWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjIyNTIsImV4cCI6MjEwNDE5ODI1Mn0.HK0VE9KdzS8c7WoMCIlvOUn02vSOQEN0ahGPgsYzKac';
    const DB_NAME = 'vissort-db';
    const DB_VERSION = 3;
    const STORES = {
        scenarios: 'scenarios',
        templates: 'templates',
        users: 'users',
        assignments: 'assignments',
        results: 'results',
        syncQueue: 'syncQueue',
        settings: 'settings',
        scenarioFileIndex: 'scenarioFileIndex',
        templatesFileIndex: 'templatesFileIndex'
    };
    const MAX_RETRIES = 5;
    const QUEUE_BATCH = 10;
    const AUTO_SYNC_INTERVAL = 30000;

    // ============================================================
    // СОСТОЯНИЕ
    // ============================================================
    let db = null;
    let authToken = null;
    let currentUserId = null;
    let autoSyncTimer = null;
    let processingQueue = false;
    const listeners = [];

    // ============================================================
    // УТИЛИТЫ
    // ============================================================
    function log(...args) {
        console.log('%c[Data]', 'color:#8b5cf6;font-weight:bold;', ...args);
    }
    function warn(...args) {
        console.warn('%c[Data]', 'color:#f59e0b;font-weight:bold;', ...args);
    }
    function uuid() {
        if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    function now() { return Date.now(); }
    function nowIso() { return new Date().toISOString(); }
    function isUuid(v) {
        return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    }
    function stripLocalFlags(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        const { _dirty, _syncedAt, _cachedAt, _source, ...clean } = obj;
        return clean;
    }

    // ============================================================
    // INDEXEDDB
    // ============================================================
    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = e => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains(STORES.scenarios))
                    d.createObjectStore(STORES.scenarios, { keyPath: 'id' });
                if (!d.objectStoreNames.contains(STORES.templates))
                    d.createObjectStore(STORES.templates, { keyPath: 'id' });
                if (!d.objectStoreNames.contains(STORES.users))
                    d.createObjectStore(STORES.users, { keyPath: 'id' });
                if (!d.objectStoreNames.contains(STORES.assignments))
                    d.createObjectStore(STORES.assignments, { keyPath: 'id' });
                if (!d.objectStoreNames.contains(STORES.results))
                    d.createObjectStore(STORES.results, { autoIncrement: true, keyPath: 'localId' });
                if (!d.objectStoreNames.contains(STORES.syncQueue))
                    d.createObjectStore(STORES.syncQueue, { autoIncrement: true, keyPath: 'id' });
                if (!d.objectStoreNames.contains(STORES.settings))
                    d.createObjectStore(STORES.settings, { keyPath: 'key' });
                if (!d.objectStoreNames.contains(STORES.scenarioFileIndex))
                    d.createObjectStore(STORES.scenarioFileIndex, { keyPath: 'id' });
                if (!d.objectStoreNames.contains(STORES.templatesFileIndex))
                    d.createObjectStore(STORES.templatesFileIndex, { keyPath: 'id' });
            };
            req.onsuccess = () => { db = req.result; resolve(db); };
            req.onerror = () => reject(req.error);
        });
    }

    function idb(store, mode, fn) {
        return new Promise((resolve, reject) => {
            if (!db) return reject(new Error('IndexedDB не открыта'));
            try {
                const tx = db.transaction(store, mode);
                const s = tx.objectStore(store);
                const result = fn(s);
                tx.oncomplete = () => resolve(result);
                tx.onerror = () => reject(tx.error);
            } catch (e) { reject(e); }
        });
    }
    function idbPut(store, value) { return idb(store, 'readwrite', s => s.put(value)); }
    function idbDelete(store, key) { return idb(store, 'readwrite', s => s.delete(key)); }
    function idbClear(store) { return idb(store, 'readwrite', s => s.clear()); }
    function idbGet(store, key) {
        return new Promise((resolve, reject) => {
            if (!db) return reject(new Error('IndexedDB не открыта'));
            try {
                const tx = db.transaction(store, 'readonly');
                const r = tx.objectStore(store).get(key);
                r.onsuccess = () => resolve(r.result);
                r.onerror = () => reject(r.error);
            } catch (e) { reject(e); }
        });
    }
    function idbGetAll(store) {
        return new Promise((resolve, reject) => {
            if (!db) return reject(new Error('IndexedDB не открыта'));
            try {
                const tx = db.transaction(store, 'readonly');
                const r = tx.objectStore(store).getAll();
                r.onsuccess = () => resolve(r.result || []);
                r.onerror = () => reject(r.error);
            } catch (e) { reject(e); }
        });
    }

    // ============================================================
    // SUPABASE REST-КЛИЕНТ
    // ============================================================
    function getHeaders(extra = {}) {
        return {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + (authToken || SUPABASE_ANON_KEY),
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            ...extra
        };
    }

    async function sbFetch(path, opts = {}) {
        const url = SUPABASE_URL + '/rest/v1/' + path;
        const res = await fetch(url, {
            ...opts,
            headers: getHeaders(opts.headers || {})
        });
        if (!res.ok) {
            let body = '';
            try { body = await res.text(); } catch (_) {}
            throw new Error(`Supabase HTTP ${res.status}: ${body.slice(0, 300)}`);
        }
        if (res.status === 204) return null;
        const text = await res.text();
        if (!text) return null;
        try { return JSON.parse(text); } catch (_) { return text; }
    }

    // ============================================================
    // ПУБЛИЧНОЕ СОСТОЯНИЕ
    // ============================================================
    function isOnline() { return global.navigator && global.navigator.onLine !== false; }

    function emit(type, payload) {
        listeners.forEach(cb => {
            try { cb(type, payload); } catch (e) { warn('listener error:', e); }
        });
    }

    function isAuthError(msg) {
        return /HTTP (401|403)/.test(msg) || /permission denied/i.test(msg);
    }

    // ============================================================
    // ОЧЕРЕДЬ СИНХРОНИЗАЦИИ
    // ============================================================
    async function queueAdd(entry) {
        const record = {
            type: entry.type,
            action: entry.action,
            entityId: entry.entityId,
            localId: entry.localId || null,   // локальный id (для маппинга после создания)
            payload: entry.payload || null,
            createdAt: now(),
            retries: 0,
            lastError: null
        };
        await idbPut(STORES.syncQueue, record);
        emit('queue-changed', { size: await queueSize() });
        return record;
    }
    async function queueSize() {
        const all = await idbGetAll(STORES.syncQueue);
        return all.length;
    }
    async function queueGetAll() {
        return await idbGetAll(STORES.syncQueue);
    }
    async function queueDelete(id) {
        await idbDelete(STORES.syncQueue, id);
        emit('queue-changed', { size: await queueSize() });
    }
    async function queueUpdate(id, patch) {
        const rec = await idbGet(STORES.syncQueue, id);
        if (!rec) return;
        await idbPut(STORES.syncQueue, { ...rec, ...patch });
    }
    async function queueClear() {
        await idbClear(STORES.syncQueue);
        emit('queue-changed', { size: 0 });
    }

    // ============================================================
    // ОТПРАВКА В SUPABASE
    // ============================================================
    async function pushToCloud(entry) {
        const { type, action, entityId, localId, payload } = entry;

        // --- SCENARIO ---
        if (type === 'scenario') {
            if (action === 'delete') {
                // Удаление — только для валидных UUID (облачных)
                if (isUuid(entityId)) {
                    await sbFetch(`scenarios?id=eq.${encodeURIComponent(entityId)}`, { method: 'DELETE' });
                }
                return;
            }

            // Готовим payload для Supabase
            const cloudPayload = stripLocalFlags({ ...payload });
            // Если id локальный — удаляем, чтобы Supabase сгенерировал свой UUID
            if (cloudPayload.id && !isUuid(cloudPayload.id)) {
                delete cloudPayload.id;
            }

            const result = await sbFetch('scenarios', {
                method: 'POST',
                headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
                body: JSON.stringify([cloudPayload])
            });

            // Если это был локальный сценарий — сохраняем полученный UUID в локальный IndexedDB
            const cloudId = Array.isArray(result) && result[0] ? result[0].id : null;
            if (cloudId && localId && localId !== cloudId) {
                const localRec = await idbGet(STORES.scenarios, localId);
                if (localRec) {
                    const oldId = localRec.id;
                    localRec.id = cloudId;
                    localRec.cloudId = cloudId;
                    await idbPut(STORES.scenarios, localRec);
                    await idbDelete(STORES.scenarios, oldId);
                    log(`[scenario] локальный id ${localId} → облачный ${cloudId}`);
                    emit('scenarios-changed', { id: cloudId, renamed: true });
                }
            }
            return;
        }

        // --- TEMPLATE ---
        if (type === 'template') {
            if (action === 'delete') {
                if (isUuid(entityId)) {
                    await sbFetch(`templates?id=eq.${encodeURIComponent(entityId)}`, { method: 'DELETE' });
                }
                return;
            }
            const cloudPayload = stripLocalFlags({ ...payload });
            if (cloudPayload.id && !isUuid(cloudPayload.id)) {
                delete cloudPayload.id;
            }
            const result = await sbFetch('templates', {
                method: 'POST',
                headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
                body: JSON.stringify([cloudPayload])
            });
            const cloudId = Array.isArray(result) && result[0] ? result[0].id : null;
            if (cloudId && localId && localId !== cloudId) {
                const localRec = await idbGet(STORES.templates, localId);
                if (localRec) {
                    const oldId = localRec.id;
                    localRec.id = cloudId;
                    localRec.cloudId = cloudId;
                    await idbPut(STORES.templates, localRec);
                    await idbDelete(STORES.templates, oldId);
                    emit('templates-changed', { id: cloudId, renamed: true });
                }
            }
            return;
        }

        // --- ASSIGNMENT ---
        if (type === 'assignment') {
            if (action === 'delete') {
                if (isUuid(entityId)) {
                    await sbFetch(`user_scenarios?id=eq.${encodeURIComponent(entityId)}`, { method: 'DELETE' });
                }
                return;
            }
            const cleanPayload = { ...payload };
            delete cleanPayload.id;
            delete cleanPayload._dirty;
            delete cleanPayload._syncedAt;
            await sbFetch('user_scenarios', {
                method: 'POST',
                headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
                body: JSON.stringify([cleanPayload])
            });
            return;
        }

        // --- RESULT ---
        if (type === 'result') {
            const cleanPayload = { ...payload };
            delete cleanPayload.localId;
            delete cleanPayload._dirty;
            delete cleanPayload._syncedAt;
            await sbFetch('test_results', {
                method: 'POST',
                body: JSON.stringify([cleanPayload])
            });
            return;
        }

        throw new Error('Неизвестный тип очереди: ' + type);
    }

    // ============================================================
    // ОБРАБОТКА ОЧЕРЕДИ
    // ============================================================
    async function processQueue() {
        if (processingQueue) return { processed: 0, failed: 0 };
        if (!isOnline()) { warn('processQueue: офлайн'); return { processed: 0, failed: 0 }; }
        if (!currentUserId) { warn('processQueue: нет пользователя'); return { processed: 0, failed: 0 }; }

        processingQueue = true;
        emit('sync-start', {});
        let processed = 0, failed = 0;

        try {
            while (true) {
                const all = await queueGetAll();
                if (all.length === 0) break;
                const batch = all.slice(0, QUEUE_BATCH);

                for (const entry of batch) {
                    try {
                        await pushToCloud(entry);
                        await queueDelete(entry.id);
                        processed++;

                        if (entry.type === 'scenario' && entry.entityId) {
                            const local = await idbGet(STORES.scenarios, entry.entityId);
                            if (local) await idbPut(STORES.scenarios, { ...local, _dirty: false, _syncedAt: now() });
                        }
                        if (entry.type === 'template' && entry.entityId) {
                            const local = await idbGet(STORES.templates, entry.entityId);
                            if (local) await idbPut(STORES.templates, { ...local, _dirty: false, _syncedAt: now() });
                        }
                    } catch (err) {
                        failed++;
                        warn('push failed:', entry.type, entry.action, err.message);
                        const retries = (entry.retries || 0) + 1;
                        const patch = { retries, lastError: err.message };
                        if (retries >= MAX_RETRIES || isAuthError(err.message)) patch.problematic = true;
                        await queueUpdate(entry.id, patch);
                    }
                }
                if (batch.length < QUEUE_BATCH) break;
            }
        } finally {
            processingQueue = false;
            const size = await queueSize();
            emit('sync-end', { processed, failed, size });
        }
        return { processed, failed };
    }

    function startAutoSync() {
        if (autoSyncTimer) return;
        autoSyncTimer = setInterval(() => {
            if (isOnline() && currentUserId) processQueue();
        }, AUTO_SYNC_INTERVAL);
    }
    function stopAutoSync() {
        if (autoSyncTimer) { clearInterval(autoSyncTimer); autoSyncTimer = null; }
    }

    // ============================================================
    // СИНХРОНИЗАЦИЯ ТОКЕНА АВТОРИЗАЦИИ
    // ============================================================
    function syncAuthFromStorage() {
        try {
            const projectRef = 'hzvypwdpdhsjzaclxmbm';
            const keys = Object.keys(localStorage).filter(k => k.includes(projectRef));
            for (const k of keys) {
                const raw = localStorage.getItem(k);
                if (!raw) continue;
                try {
                    const parsed = JSON.parse(raw);
                    const token = parsed?.access_token || parsed?.currentSession?.access_token;
                    const uid = parsed?.user?.id || parsed?.currentSession?.user?.id;
                    if (token) {
                        authToken = token;
                        currentUserId = uid || null;
                        log('токен авторизации подхвачен из localStorage');
                        return true;
                    }
                } catch (_) {}
            }
        } catch (e) { warn('syncAuthFromStorage:', e); }
        return false;
    }

    function setAuth(token, userId) {
        authToken = token || null;
        currentUserId = userId || null;
        log('auth обновлён, userId =', currentUserId);
    }
    function clearAuth() {
        authToken = null;
        currentUserId = null;
        log('auth сброшен');
    }

    // ============================================================
    // ПУБЛИЧНЫЙ API
    // ============================================================
    const Data = {};

    // ---------- СЛУЖЕБНОЕ ----------
    Data.isOnline = isOnline;
    Data.onChange = (cb) => {
        listeners.push(cb);
        return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
    };
    Data.setAuth = setAuth;
    Data.clearAuth = clearAuth;
    Data.getCurrentUserId = () => currentUserId;
    Data.flush = processQueue;
    Data.getQueue = queueGetAll;
    Data.getQueueSize = queueSize;
    Data.clearQueue = queueClear;
    Data.removeQueueItem = queueDelete;
    Data.getDb = () => db;
    Data.uuid = uuid;
    Data.now = now;
    Data.nowIso = nowIso;
    Data.stripLocalFlags = stripLocalFlags;

    // ---------- SETTINGS ----------
    Data.setSetting = async (key, value) => { await idbPut(STORES.settings, { key, value }); };
    Data.getSetting = async (key) => { const r = await idbGet(STORES.settings, key); return r ? r.value : null; };
    Data.deleteSetting = async (key) => { await idbDelete(STORES.settings, key); };

    // ---------- СЦЕНАРИИ ----------
    Data.getScenariosLocal = async () => {
        const all = await idbGetAll(STORES.scenarios);
        return all.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
    };

    Data.getScenarios = async ({ forceCloud = false } = {}) => {
        if (isOnline() && currentUserId) {
            try {
                const cloud = await sbFetch('scenarios?select=*&order=updated_at.desc');
                if (Array.isArray(cloud)) {
                    // Очищаем локальный кэш и заливаем свежее из облака
                    const local = await idbGetAll(STORES.scenarios);
                    const cloudIds = new Set(cloud.map(s => s.id));
                    for (const s of cloud) {
                        await idbPut(STORES.scenarios, { ...s, _dirty: false, _syncedAt: now() });
                    }
                    // Удаляем локальные записи, которых нет в облаке И которые не _dirty
                    for (const l of local) {
                        if (!cloudIds.has(l.id) && !l._dirty) {
                            await idbDelete(STORES.scenarios, l.id);
                        }
                    }
                    log(`getScenarios: загружено из облака ${cloud.length}`);
                }
            } catch (e) {
                warn('getScenarios: облако недоступно, отдаём кэш.', e.message);
            }
        }
        const local = await Data.getScenariosLocal();
        emit('scenarios-changed', { count: local.length });
        return local;
    };

    Data.getScenarioById = async (id) => idbGet(STORES.scenarios, id);

    Data.saveScenario = async (scenario) => {
        // Локальный id: если задан валидный uuid — используем его, иначе генерируем свой
        const id = scenario.id || uuid();
        const existing = await idbGet(STORES.scenarios, id);
        const record = {
            ...scenario,
            id,
            updated_at: scenario.updated_at || nowIso(),
            created_at: (existing && existing.created_at) || scenario.created_at || nowIso(),
            created_by: scenario.created_by || currentUserId,
            _dirty: true,
            _syncedAt: null
        };
        await idbPut(STORES.scenarios, record);
        await queueAdd({
            type: 'scenario',
            action: existing ? 'update' : 'create',
            entityId: id,
            localId: id,
            payload: stripLocalFlags(record)
        });
        if (isOnline() && currentUserId) processQueue();
        emit('scenarios-changed', { id });
        return record;
    };

    Data.deleteScenario = async (id) => {
        await idbDelete(STORES.scenarios, id);
        await queueAdd({ type: 'scenario', action: 'delete', entityId: id, payload: null });
        if (isOnline() && currentUserId) processQueue();
        emit('scenarios-changed', { id, deleted: true });
    };

    // ---------- ЗАГОТОВКИ ----------
    Data.getTemplatesLocal = async () => {
        const all = await idbGetAll(STORES.templates);
        return all.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
    };

    Data.getTemplates = async ({ forceCloud = false } = {}) => {
        if (isOnline() && currentUserId) {
            try {
                const cloud = await sbFetch('templates?select=*&order=name.asc');
                if (Array.isArray(cloud)) {
                    for (const t of cloud) {
                        await idbPut(STORES.templates, { ...t, _dirty: false, _syncedAt: now() });
                    }
                    log(`getTemplates: загружено из облака ${cloud.length}`);
                }
            } catch (e) {
                warn('getTemplates: облако недоступно, отдаём кэш.', e.message);
            }
        }
        const local = await Data.getTemplatesLocal();
        emit('templates-changed', { count: local.length });
        return local;
    };

    Data.saveTemplate = async (template) => {
        const id = template.id || uuid();
        const existing = await idbGet(STORES.templates, id);
        const record = {
            ...template,
            id,
            kind: template.kind || 'node',
            payload: template.payload || {},
            updated_at: template.updated_at || nowIso(),
            created_at: (existing && existing.created_at) || template.created_at || nowIso(),
            created_by: template.created_by || currentUserId,
            _dirty: true,
            _syncedAt: null
        };
        await idbPut(STORES.templates, record);
        await queueAdd({
            type: 'template',
            action: existing ? 'update' : 'create',
            entityId: id,
            localId: id,
            payload: stripLocalFlags(record)
        });
        if (isOnline() && currentUserId) processQueue();
        emit('templates-changed', { id });
        return record;
    };

    Data.deleteTemplate = async (id) => {
        await idbDelete(STORES.templates, id);
        await queueAdd({ type: 'template', action: 'delete', entityId: id, payload: null });
        if (isOnline() && currentUserId) processQueue();
        emit('templates-changed', { id, deleted: true });
    };

    // ---------- ПОЛЬЗОВАТЕЛИ ----------
    Data.getUsers = async () => {
        if (isOnline() && currentUserId) {
            try {
                const cloud = await sbFetch('profiles?select=id,email,full_name');
                if (Array.isArray(cloud)) {
                    for (const u of cloud) await idbPut(STORES.users, { ...u, _cachedAt: now() });
                    log(`getUsers: загружено ${cloud.length}`);
                }
            } catch (e) {
                warn('getUsers: облако недоступно, отдаём кэш.', e.message);
            }
        }
        const local = await idbGetAll(STORES.users);
        return local.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    };
    Data.getUsersLocal = async () => idbGetAll(STORES.users);

    // ---------- НАЗНАЧЕНИЯ ----------
    Data.getAssignments = async () => {
        if (isOnline() && currentUserId) {
            try {
                const cloud = await sbFetch('user_scenarios?select=*');
                if (Array.isArray(cloud)) {
                    await idbClear(STORES.assignments);
                    for (const a of cloud) await idbPut(STORES.assignments, { ...a, _cachedAt: now() });
                    log(`getAssignments: загружено ${cloud.length}`);
                }
            } catch (e) {
                warn('getAssignments: облако недоступно, отдаём кэш.', e.message);
            }
        }
        return await idbGetAll(STORES.assignments);
    };

    Data.assignScenario = async (userId, scenarioId, status = 'ready') => {
        const localId = `${userId}:${scenarioId}`;
        const record = {
            id: localId,
            user_id: userId,
            scenario_id: scenarioId,
            status,
            _dirty: true,
            _syncedAt: null
        };
        await idbPut(STORES.assignments, record);
        await queueAdd({
            type: 'assignment',
            action: 'create',
            entityId: localId,
            payload: { user_id: userId, scenario_id: scenarioId, status }
        });
        if (isOnline() && currentUserId) processQueue();
        emit('assignments-changed', { userId, scenarioId });
        return record;
    };

    // ---------- РЕЗУЛЬТАТЫ ----------
    Data.saveResult = async (result) => {
        const record = {
            ...result,
            user_id: result.user_id || currentUserId,
            created_at: result.created_at || nowIso()
        };
        await idbPut(STORES.results, record);
        await queueAdd({ type: 'result', action: 'create', entityId: null, payload: record });
        if (isOnline() && currentUserId) processQueue();
    };
    Data.getResultsLocal = async () => idbGetAll(STORES.results);

    // ---------- ПАПКИ ----------
    Data.saveFolderHandle = async (key, handle) => { await idbPut(STORES.settings, { key, value: handle }); };
    Data.getFolderHandle = async (key) => { const r = await idbGet(STORES.settings, key); return r ? r.value : null; };
    Data.scanFolder = async (handle, filterExt = '.json') => {
        if (!handle) return [];
        const out = [];
        try {
            for await (const [name, entry] of handle.entries()) {
                if (entry.kind !== 'file') continue;
                if (filterExt && !name.toLowerCase().endsWith(filterExt)) continue;
                try {
                    const file = await entry.getFile();
                    out.push({ name, text: await file.text() });
                } catch (_) {}
            }
        } catch (e) { warn('scanFolder:', e); }
        return out;
    };
    Data.writeFileToFolder = async (handle, name, text) => {
        if (!handle) throw new Error('Папка не выбрана');
        const fh = await handle.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(text);
        await w.close();
    };
    Data.ensurePermission = async (handle, mode = 'readwrite') => {
        if (!handle) return false;
        try {
            let perm = await handle.queryPermission({ mode });
            if (perm === 'granted') return true;
            perm = await handle.requestPermission({ mode });
            return perm === 'granted';
        } catch (_) { return false; }
    };

    // ============================================================
    // МИГРАЦИИ И ДОРАБОТКИ
    // ============================================================
    async function migrateFromV2() {
        const flag = await idbGet(STORES.settings, 'migrated_v2_v3');
        if (flag && flag.value === true) return;
        log('миграция v2→v3: помечаем все scenarios как _dirty');
        const scenarios = await idbGetAll(STORES.scenarios);
        for (const s of scenarios) {
            if (s._dirty === undefined) await idbPut(STORES.scenarios, { ...s, _dirty: true, _syncedAt: null });
        }
        await idbPut(STORES.settings, { key: 'migrated_v2_v3', value: true });
    }

    Data.getDirtyCount = async () => {
        const sc = await idbGetAll(STORES.scenarios);
        const tp = await idbGetAll(STORES.templates);
        const s = sc.filter(x => x._dirty).length;
        const t = tp.filter(x => x._dirty).length;
        return { scenarios: s, templates: t, total: s + t };
    };

    Data.getStatus = async () => {
        const [queue, dirty] = await Promise.all([queueGetAll(), Data.getDirtyCount()]);
        const problematic = queue.filter(q => q.problematic).length;
        return {
            online: isOnline(),
            userId: currentUserId,
            queueSize: queue.length,
            problematic,
            dirty,
            processing: processingQueue
        };
    };

    Data.resetQueueItem = async (id) => {
        await queueUpdate(id, { retries: 0, problematic: false, lastError: null });
        emit('queue-changed', { size: await queueSize() });
    };

    Data.getQueueItem = async (id) => idbGet(STORES.syncQueue, id);

    Data.exportAll = async () => {
        const [scenarios, templates, users, assignments, results, queue] = await Promise.all([
            idbGetAll(STORES.scenarios),
            idbGetAll(STORES.templates),
            idbGetAll(STORES.users),
            idbGetAll(STORES.assignments),
            idbGetAll(STORES.results),
            idbGetAll(STORES.syncQueue)
        ]);
        return { exportedAt: nowIso(), version: DB_VERSION, data: { scenarios, templates, users, assignments, results, queue } };
    };

    Data.importAll = async (bundle) => {
        if (!bundle || !bundle.data) throw new Error('Некорректный формат');
        const d = bundle.data;
        const pairs = [
            [STORES.scenarios, d.scenarios], [STORES.templates, d.templates],
            [STORES.users, d.users], [STORES.assignments, d.assignments],
            [STORES.results, d.results], [STORES.syncQueue, d.queue]
        ];
        for (const [store, arr] of pairs) {
            if (!Array.isArray(arr)) continue;
            for (const item of arr) { try { await idbPut(store, item); } catch (_) {} }
        }
        emit('imported', {});
    };

    Data.bulkImportTemplates = async (files, { source = 'folder' } = {}) => {
        let added = 0, updated = 0, skipped = 0;
        for (const f of files) {
            try {
                const parsed = JSON.parse(f.text);
                if (!parsed || typeof parsed !== 'object') { skipped++; continue; }
                if (!parsed.name) { skipped++; continue; }
                if (!parsed.node && !parsed.nodes) { skipped++; continue; }

                const all = await idbGetAll(STORES.templates);
                const existing = all.find(t => t.name === parsed.name);

                const record = {
                    id: existing ? existing.id : uuid(),
                    name: parsed.name,
                    description: parsed.description || '',
                    kind: parsed.kind || (parsed.nodes ? 'group' : 'node'),
                    payload: parsed.node ? parsed.node : { nodes: parsed.nodes, connections: parsed.connections || [] },
                    created_by: currentUserId,
                    created_at: existing ? existing.created_at : nowIso(),
                    updated_at: nowIso(),
                    _dirty: true,
                    _syncedAt: null,
                    _source: source
                };
                await idbPut(STORES.templates, record);
                await queueAdd({
                    type: 'template',
                    action: existing ? 'update' : 'create',
                    entityId: record.id,
                    localId: record.id,
                    payload: stripLocalFlags(record)
                });
                existing ? updated++ : added++;
            } catch (e) { warn('bulkImportTemplates: пропущен', f.name, e.message); skipped++; }
        }
        if (isOnline() && currentUserId) processQueue();
        emit('templates-changed', { added, updated, skipped });
        return { added, updated, skipped };
    };

    Data.pingCloud = async () => {
        if (!isOnline()) return false;
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(SUPABASE_URL + '/rest/v1/', {
                method: 'HEAD',
                headers: { 'apikey': SUPABASE_ANON_KEY },
                signal: controller.signal
            });
            clearTimeout(t);
            return res.ok || res.status === 404 || res.status === 401;
        } catch (_) { return false; }
    };

    // ============================================================
    // СОБЫТИЯ ONLINE / OFFLINE
    // ============================================================
    function wireOnlineEvents() {
        global.addEventListener('online', () => {
            log('сеть появилась — синхронизация');
            emit('online', {});
            if (currentUserId) processQueue();
        });
        global.addEventListener('offline', () => {
            log('сеть пропала — работаем локально');
            emit('offline', {});
        });
    }

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    async function init() {
        try {
            await openDB();
            log('IndexedDB открыта, версия', DB_VERSION);
        } catch (e) {
            console.error('[Data] не удалось открыть IndexedDB:', e);
            throw e;
        }
        syncAuthFromStorage();
        wireOnlineEvents();
        startAutoSync();
        try { await migrateFromV2(); } catch (e) { warn('migrateFromV2:', e); }
        log('готов к работе, очередь:', await queueSize());
        emit('ready', await Data.getStatus());
        return Data;
    }

    Data.init = init;
    global.Data = Data;
    Data.ready = init();
    log('модуль установлен');
})(window);