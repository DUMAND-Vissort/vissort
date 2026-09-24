// ============================================================
// vissort-device.js
// Идентификация устройства + калибровка (PPI, focal length).
// Хранение: localStorage + Supabase (device_calibrations).
// ============================================================
(function installDevice(global) {
    'use strict';

    const LS_KEY = 'vissort_device_calib';

    async function hashString(s) {
        const buf = new TextEncoder().encode(s);
        const hb = await crypto.subtle.digest('SHA-1', buf);
        return Array.from(new Uint8Array(hb))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    function gpuRenderer() {
        try {
            const c = document.createElement('canvas');
            const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
            if (!gl) return 'no-webgl';
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            if (!dbg) return 'no-dbg';
            return gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || 'unknown';
        } catch (_) {
            return 'err';
        }
    }

    async function getFingerprint() {
        const parts = [
            navigator.userAgent || '',
            screen.width + 'x' + screen.height,
            window.devicePixelRatio || 1,
            navigator.hardwareConcurrency || 0,
            navigator.language || '',
            gpuRenderer()
        ];
        return await hashString(parts.join('|'));
    }

    function getDeviceLabel() {
        const ua = navigator.userAgent || '';
        let browser = 'Браузер';
        if (/Edg\//.test(ua)) browser = 'Edge';
        else if (/Chrome\//.test(ua)) browser = 'Chrome';
        else if (/Firefox\//.test(ua)) browser = 'Firefox';
        else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';

        let os = 'ОС';
        if (/Windows/.test(ua)) os = 'Windows';
        else if (/Mac OS X/.test(ua)) os = 'macOS';
        else if (/Android/.test(ua)) os = 'Android';
        else if (/iPhone|iPad/.test(ua)) os = 'iOS';
        else if (/Linux/.test(ua)) os = 'Linux';

        return browser + ' / ' + os;
    }

    function loadLocal() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return {};
            return JSON.parse(raw) || {};
        } catch (_) {
            return {};
        }
    }

    function saveLocal(fp, data) {
        try {
            const all = loadLocal();
            all[fp] = Object.assign({}, data, {
                savedAt: new Date().toISOString(),
                deviceLabel: getDeviceLabel()
            });
            localStorage.setItem(LS_KEY, JSON.stringify(all));
        } catch (e) {
            console.warn('[device] saveLocal:', e);
        }
    }

    function getForCurrent() {
        const fp = sessionStorage.getItem('vissort_fp');
        if (!fp) return null;
        const all = loadLocal();
        return all[fp] || null;
    }

    function setCurrent(fp) {
        sessionStorage.setItem('vissort_fp', fp);
    }

    async function saveCloud(client, userId, fp, data) {
        if (!client || !userId) return false;
        try {
            const row = {
                user_id: userId,
                fingerprint: fp,
                device_label: getDeviceLabel(),
                ppi: Math.round(data.ppi),
                focal_length_px: data.focalLengthPx,
                calibrated_at: new Date().toISOString()
            };
            const { error } = await client
                .from('device_calibrations')
                .upsert(row, { onConflict: 'user_id,fingerprint' });
            if (error) {
                console.warn('[device] saveCloud:', error.message);
                return false;
            }
            return true;
        } catch (e) {
            console.warn('[device] saveCloud error:', e);
            return false;
        }
    }

    async function listCloud(client, userId) {
        if (!client || !userId) return [];
        try {
            const { data, error } = await client
                .from('device_calibrations')
                .select('fingerprint, device_label, ppi, focal_length_px, calibrated_at')
                .eq('user_id', userId)
                .order('calibrated_at', { ascending: false });
            if (error) return [];
            return data || [];
        } catch (_) {
            return [];
        }
    }

    async function loadCloudByFingerprint(client, userId, fp) {
        if (!client || !userId) return null;
        try {
            const { data, error } = await client
                .from('device_calibrations')
                .select('ppi, focal_length_px, calibrated_at')
                .eq('user_id', userId)
                .eq('fingerprint', fp)
                .maybeSingle();
            if (error || !data) return null;
            return data;
        } catch (_) {
            return null;
        }
    }

    async function deleteCloud(client, userId, fp) {
        if (!client || !userId) return false;
        try {
            const { error } = await client
                .from('device_calibrations')
                .delete()
                .eq('user_id', userId)
                .eq('fingerprint', fp);
            return !error;
        } catch (_) {
            return false;
        }
    }

    const Device = {
        getFingerprint,
        getDeviceLabel,
        loadLocal,
        saveLocal,
        getForCurrent,
        setCurrent,
        saveCloud,
        listCloud,
        loadCloudByFingerprint,
        deleteCloud,

        apply(data) {
            if (!data) return;
            if (typeof data.ppi === 'number' && data.ppi > 0) {
                localStorage.setItem('screenPPI', String(Math.round(data.ppi)));
                localStorage.setItem('screenPPICalibrated', 'true');
            }
            if (typeof data.focalLengthPx === 'number' && data.focalLengthPx > 0) {
                localStorage.setItem('focalLengthPx', String(data.focalLengthPx));
            }
        },

        hasCalibrationForCurrent() {
            const d = getForCurrent();
            return !!(d && d.ppi > 0 && d.focalLengthPx > 0);
        },

        clearCurrent() {
            const fp = sessionStorage.getItem('vissort_fp');
            if (!fp) return;
            const all = loadLocal();
            delete all[fp];
            localStorage.setItem(LS_KEY, JSON.stringify(all));
            localStorage.removeItem('focalLengthPx');
            localStorage.removeItem('screenPPI');
            localStorage.removeItem('screenPPICalibrated');
        }
    };

    global.VissortDevice = Device;
    console.log('[device] модуль установлен');
})(window);