// ============================================================
// keepalive.js — кнопка «📡 Keepalive» для Supabase.
// Использует существующую таблицу training_sessions (GET, limit=1),
// чтобы не зависеть от PGRST205 у новых таблиц.
// Раз в 2-3 дня нажать — активность для Supabase, чтобы free-проект
// не ушёл в паузу.
// ============================================================
(function installKeepalive() {
    'use strict';

    const KEEPALIVE_URL =
        'https://hzvypwdpdhsjzaclxmbm.supabase.co/rest/v1/training_sessions?select=id&limit=1';
    const KEEPALIVE_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6dnlwd2RwZGhzanphY2x4bWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjIyNTIsImV4cCI6MjEwNDE5ODI1Mn0.HK0VE9KdzS8c7WoMCIlvOUn02vSOQEN0ahGPgsYzKac';
    const LS_KEY = 'vissort_keepalive_ts';
    const WARN_DAYS = 2.5;

    function init() {
        const btn = ensureButton();
        if (!btn) return;
        ensureStyle();
        ensureBadge(btn);
        bindEvents(btn);
        refreshLabel(btn);
        autoPingIfStale(btn);
        setInterval(() => refreshLabel(btn), 30 * 60 * 1000);
        console.log(
            '[keepalive] установлен. Последняя активность:',
            isFinite(daysSinceLast()) ? daysSinceLast().toFixed(1) + ' дн. назад' : 'никогда'
        );
    }

    function ensureButton() {
        let btn = document.getElementById('btn-keepalive');
        if (btn) return btn;
        const anchor = document.getElementById('btn-voice') || document.getElementById('btn-auth');
        if (!anchor || !anchor.parentNode) {
            console.warn('[keepalive] не найден #btn-auth. Кнопка не создана.');
            return null;
        }
        btn = document.createElement('button');
        btn.id = 'btn-keepalive';
        btn.className = 'btn btn-secondary btn-icon';
        btn.type = 'button';
        btn.style.position = 'relative';
        btn.title = 'Отправить сигнал активности в Supabase, чтобы проект не ушёл в паузу';
        anchor.parentNode.insertBefore(btn, anchor);
        return btn;
    }

    function ensureStyle() {
        if (document.getElementById('keepalive-style')) return;
        const st = document.createElement('style');
        st.id = 'keepalive-style';
        st.textContent =
            '@keyframes keepalivePulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.6)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}';
        document.head.appendChild(st);
    }

    function ensureBadge(btn) {
        if (document.getElementById('keepalive-badge')) return;
        const b = document.createElement('span');
        b.id = 'keepalive-badge';
        b.style.cssText =
            'position:absolute;top:-4px;right:-4px;background:#64748b;color:#fff;border-radius:8px;font-size:9px;padding:1px 5px;font-weight:bold;pointer-events:none;';
        btn.appendChild(b);
    }

    function daysSinceLast() {
        const last = parseInt(localStorage.getItem(LS_KEY) || '0');
        if (!last) return Infinity;
        return (Date.now() - last) / 86400000;
    }

    function refreshLabel(btn) {
        const badge = document.getElementById('keepalive-badge');
        if (!badge) return;
        btn.textContent = '📡';
        btn.appendChild(badge);
        const d = daysSinceLast();
        if (!isFinite(d)) {
            badge.textContent = '—';
            badge.style.background = '#64748b';
            btn.style.animation = '';
            return;
        }
        badge.textContent = d < 1 ? '0д' : Math.floor(d) + 'д';
        if (d >= WARN_DAYS) {
            badge.style.background = '#ef4444';
            btn.style.animation = 'keepalivePulse 1.6s ease-in-out infinite';
        } else if (d >= 1) {
            badge.style.background = '#f59e0b';
            btn.style.animation = '';
        } else {
            badge.style.background = '#10b981';
            btn.style.animation = '';
        }
    }

    async function sendKeepalive(btn, silent) {
        btn.disabled = true;
        btn.textContent = '⏳ Отправляю…';
        try {
            const res = await fetch(KEEPALIVE_URL, {
                method: 'GET',
                headers: {
                    apikey: KEEPALIVE_KEY,
                    Authorization: 'Bearer ' + KEEPALIVE_KEY
                }
            });
            if (res.ok) {
                localStorage.setItem(LS_KEY, String(Date.now()));
                refreshLabel(btn);
                if (!silent) flashButton(btn, '✅ Активность отправлена', '#10b981');
            } else {
                const txt = await res.text().catch(() => '');
                console.warn('[keepalive] HTTP', res.status, txt);
                if (!silent) {
                    if (res.status === 404)
                        alert(
                            'Таблица training_sessions не найдена через API.\n\nВозможно, RLS блокирует доступ. Проверьте политику SELECT для anon.'
                        );
                    else if (res.status === 401 || res.status === 403)
                        alert(
                            'Доступ запрещён (' +
                                res.status +
                                ').\n\nПроверьте anon-ключ и RLS-политику для training_sessions.'
                        );
                    else alert('Ошибка Supabase: ' + res.status);
                }
                refreshLabel(btn);
            }
        } catch (e) {
            console.warn('[keepalive] сеть:', e);
            if (!silent) alert('Сеть недоступна: ' + e.message);
            refreshLabel(btn);
        } finally {
            btn.disabled = false;
        }
    }

    function flashButton(btn, text, color) {
        const oldBg = btn.style.background;
        const oldColor = btn.style.color;
        btn.textContent = text;
        btn.style.background = color;
        btn.style.color = '#fff';
        setTimeout(() => {
            btn.style.background = oldBg;
            btn.style.color = oldColor;
            refreshLabel(btn);
        }, 1800);
    }

    function bindEvents(btn) {
        btn.addEventListener('click', () => sendKeepalive(btn, false));
    }

    function autoPingIfStale(btn) {
        if (daysSinceLast() >= WARN_DAYS) {
            setTimeout(() => sendKeepalive(btn, true), 3000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
