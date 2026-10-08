// ============================================================
// player-dist-warning.js
// UI-предупреждения о дистанции: мягкий баннер, жёсткий баннер.
// Не зависит от состояния камеры — только DOM + Voice.
// ============================================================
(function (global) {
    'use strict';

    function showDistWarning() {
        var el = document.getElementById('dist-warning');
        if (!el) {
            el = document.createElement('div');
            el.id = 'dist-warning';
            el.style.cssText =
                'position:fixed;top:60px;left:50%;transform:translateX(-50%);padding:14px 26px;background:rgba(234,88,12,0.95);color:#fff;font-size:16px;font-weight:bold;border-radius:10px;z-index:10001;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,0.5);font-family:Segoe UI,sans-serif;';
            document.body.appendChild(el);
        }
        el.textContent = '⚠️ Уменьшите дистанцию — не видно лица';
        el.style.display = 'block';
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(function () {
            el.style.display = 'none';
        }, 4500);
        if (global.Voice && global.Voice.say) {
            global.Voice.say('Уменьшите дистанцию, не видно лица', { cancel: true });
        }
    }

    function showDistHardBanner() {
        var el = document.getElementById('dist-hard-banner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'dist-hard-banner';
            el.style.cssText =
                'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:20px 40px;background:rgba(30,30,40,0.95);color:#fff;font-size:20px;font-weight:bold;border-radius:12px;z-index:10002;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.7);font-family:Segoe UI,sans-serif;line-height:1.4;border:2px solid #f59e0b;';
            document.body.appendChild(el);
        }
        el.innerHTML = '📏 Уменьшите дистанцию — не видно лица';
        el.style.display = 'block';
    }

    function hideDistHardBanner() {
        var el = document.getElementById('dist-hard-banner');
        if (el) el.style.display = 'none';
    }

    global.PlayerDistWarning = {
        showDistWarning,
        showDistHardBanner,
        hideDistHardBanner
    };

    console.log('[player-dist-warning] module installed');
})(window);
