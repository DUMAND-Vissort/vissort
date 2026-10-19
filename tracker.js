// tracker.js — отправка статистики посещений в Supabase
(function() {
    'use strict';

    // Скрипт подключен в конце body, DOM уже готов
    const pagePath = window.location.pathname;
    const referrer = document.referrer || null;

    let fingerprint = null;
    if (window.VissortDevice && typeof window.VissortDevice.getFingerprint === 'function') {
        try { fingerprint = window.VissortDevice.getFingerprint(); } catch(e) {}
    }

    let userId = null;
    if (window.Data && typeof window.Data.getCurrentUserId === 'function') {
        userId = window.Data.getCurrentUserId();
    }

    if (window.VissortEnv && window.VissortEnv.SUPABASE_URL && window.VissortEnv.SUPABASE_ANON_KEY) {
        const url = `${window.VissortEnv.SUPABASE_URL}/functions/v1/track-page-view`;
        
        console.log('[tracker] Отправка данных на', url); // Для отладки

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.VissortEnv.SUPABASE_ANON_KEY}`,
                'apikey': window.VissortEnv.SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                page_path: pagePath,
                user_id: userId,
                fingerprint: fingerprint,
                referrer: referrer
            })
        })
        .then(res => {
            if (!res.ok) console.warn('[tracker] Ошибка:', res.status);
            else console.log('[tracker] Успех! Данные отправлены');
        })
        .catch(err => console.error('[tracker] Ошибка сети:', err));
    } else {
        console.warn('[tracker] Нет VissortEnv, отправка отменена');
    }
})();