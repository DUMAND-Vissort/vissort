// vissort-dialog.js — единая модалка для alert/confirm/prompt.
// Заменяет нативные window.alert / window.confirm / window.prompt.
// API: VissortDialog.alert(msg) → Promise<void>
//      VissortDialog.confirm(msg) → Promise<boolean>
//      VissortDialog.prompt(msg, default) → Promise<string|null>
(function (global) {
    'use strict';

    var _el = null;

    function ensureDialog() {
        if (_el) return _el;
        _el = document.createElement('dialog');
        _el.id = 'vissort-dialog';
        _el.style.cssText =
            'padding:0;border:none;border-radius:12px;background:#1a1a1f;color:#eee;' +
            'max-width:480px;width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.6);';
        _el.innerHTML =
            '<form method="dialog" style="padding:24px;">' +
            '<div id="vd-msg" style="font-size:15px;line-height:1.5;margin-bottom:20px;white-space:pre-wrap;"></div>' +
            '<input id="vd-input" type="text" style="display:none;width:100%;padding:8px 12px;margin-bottom:20px;background:#0b0b12;color:#eee;border:1px solid #3f3f46;border-radius:6px;font-size:14px;box-sizing:border-box;" />' +
            '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
            '<button id="vd-cancel" type="button" class="btn btn-secondary" style="display:none;">Отмена</button>' +
            '<button id="vd-ok" type="submit" class="btn btn-primary">ОК</button>' +
            '</div>' +
            '</form>';
        document.body.appendChild(_el);
        return _el;
    }

    function show(opts) {
        return new Promise(function (resolve) {
            var el = ensureDialog();
            var msg = el.querySelector('#vd-msg');
            var input = el.querySelector('#vd-input');
            var cancel = el.querySelector('#vd-cancel');
            var ok = el.querySelector('#vd-ok');

            msg.textContent = opts.message || '';
            input.style.display = opts.type === 'prompt' ? 'block' : 'none';
            input.value = opts.defaultValue || '';
            cancel.style.display = opts.type === 'alert' ? 'none' : 'inline-block';
            ok.textContent = opts.okText || 'ОК';
            cancel.textContent = opts.cancelText || 'Отмена';

            function cleanup() {
                ok.removeEventListener('click', onOk);
                cancel.removeEventListener('click', onCancel);
                el.removeEventListener('cancel', onCancel);
            }
            function onOk(e) {
                e.preventDefault();
                cleanup();
                try {
                    el.close();
                } catch (_) {}
                if (opts.type === 'prompt') resolve(input.value);
                else resolve(true);
            }
            function onCancel(e) {
                if (e) e.preventDefault();
                cleanup();
                try {
                    el.close();
                } catch (_) {}
                if (opts.type === 'prompt') resolve(null);
                else resolve(false);
            }

            ok.addEventListener('click', onOk);
            cancel.addEventListener('click', onCancel);
            el.addEventListener('cancel', onCancel);

            try {
                el.showModal();
            } catch (_) {
                // Fallback, если showModal недоступен (старый браузер)
                el.setAttribute('open', '');
            }
            if (opts.type === 'prompt')
                setTimeout(function () {
                    input.focus();
                }, 50);
        });
    }

    global.VissortDialog = {
        alert: function (msg, opts) {
            return show(Object.assign({ type: 'alert', message: msg }, opts || {}));
        },
        confirm: function (msg, opts) {
            return show(Object.assign({ type: 'confirm', message: msg }, opts || {}));
        },
        prompt: function (msg, defaultValue, opts) {
            return show(
                Object.assign({ type: 'prompt', message: msg, defaultValue: defaultValue || '' }, opts || {})
            );
        }
    };

    VLog.log('[VissortDialog] installed');
})(window);
