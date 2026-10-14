// player-auth.js — аутентификация (§15.1.2 ч.4/7).
// Зависит: VLog (vissort-logger.js), PlayerState (player-state.js),
//          VissortEnv (vissort-env.js), VissortDialog (vissort-dialog.js).
(function (global) {
    'use strict';

    var SUPABASE_URL = (global.VissortEnv && global.VissortEnv.SUPABASE_URL) || '';
    var SUPABASE_ANON_KEY = (global.VissortEnv && global.VissortEnv.SUPABASE_ANON_KEY) || '';

    function _el(id) { return document.getElementById(id); }
    function _PS() { return global.PlayerState; }
    function _client() { return _PS() && _PS().supabaseClient; }
    function _alert(msg) {
        if (global.VissortDialog && global.VissortDialog.alert) global.VissortDialog.alert(msg);
        else alert(msg);
    }

    var _callbacks = {
        onLoggedIn: function () {},
        onTestMode: function () {},
        onSignOut: function () {},
        onError: function (msg) { _alert(msg); }
    };

    function setCallbacks(cb) {
        _callbacks = Object.assign({}, _callbacks, cb || {});
    }

    // ==== Креды ====
    var LS_LAST_EMAIL = 'vissort_last_email';

    function encodeCred(s) {
        try { return btoa(unescape(encodeURIComponent(s))); } catch (_) { return ''; }
    }
    function decodeCred(s) {
        try { return decodeURIComponent(escape(atob(s))); } catch (_) { return ''; }
    }
    function saveAuthCreds(email, password) {
        try {
            localStorage.setItem(LS_LAST_EMAIL, email);
            localStorage.setItem('vissort_last_pass', encodeCred(password));
        } catch (_) {}
    }
    function prefillAuthEmail() {
        try {
            var saved = localStorage.getItem(LS_LAST_EMAIL);
            var el = _el('auth-email');
            if (saved && el && !el.value) el.value = saved;
            var savedPass = localStorage.getItem('vissort_last_pass');
            var pel = _el('auth-password');
            if (savedPass && pel && !pel.value) pel.value = decodeCred(savedPass);
        } catch (_) {}
    }
    function focusAuthField() {
        var emailEl = _el('auth-email');
        var passEl = _el('auth-password');
        if (!emailEl || !passEl) return;
        setTimeout(function () {
            try {
                if (emailEl.value) { passEl.focus(); passEl.select(); }
                else { emailEl.focus(); emailEl.select(); }
            } catch (_) {}
        }, 150);
    }

    // ==== UI модалки ====
    function promptLogin() {
        if (global.PlayerOverlay && global.PlayerOverlay.hideStatus) global.PlayerOverlay.hideStatus();
        _PS().authMode = 'signin';
        updateAuthModal();
        var modal = _el('auth-modal');
        if (modal) modal.classList.add('open');
        var hu = _el('hdr-user');
        if (hu) hu.textContent = '\u2014';
        var hs = _el('hdr-scenario');
        if (hs) hs.textContent = '\u2014';
        var bp = _el('btn-player');
        if (bp) bp.disabled = true;
        prefillAuthEmail();
        focusAuthField();
    }

    function updateAuthModal() {
        var t = _el('auth-title'), tb = _el('auth-toggle'), sb = _el('auth-submit');
        if (_PS().authMode === 'signin') {
            if (t) t.textContent = '\u0412\u0445\u043e\u0434';
            if (tb) tb.textContent = '\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f';
            if (sb) sb.textContent = '\u0412\u043e\u0439\u0442\u0438';
        } else {
            if (t) t.textContent = '\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f';
            if (tb) tb.textContent = '\u0423\u0436\u0435 \u0435\u0441\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442';
            if (sb) sb.textContent = '\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f';
        }
    }

    // ==== Форма ====
    function bindAuthForm() {
        var form = _el('auth-form');
        if (!form || form._authBound) return;
        form._authBound = true;
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            e.stopPropagation();
            doAuth();
        });
        VLog.log('[auth] форма привязана');
    }

    // ==== Вход/регистрация ====
    async function doAuth() {
        var emailEl = _el('auth-email');
        var passEl = _el('auth-password');
        var email = emailEl ? emailEl.value.trim() : '';
        var password = passEl ? passEl.value : '';
        if (!email || !password) {
            _callbacks.onError('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 email \u0438 \u043f\u0430\u0440\u043e\u043b\u044c');
            return;
        }
        saveAuthCreds(email, password);
        var client = _client();
        if (!client) return;
        if (_PS().authMode === 'signin') {
            var r1 = await client.auth.signInWithPassword({ email: email, password: password });
            if (r1.error) { _callbacks.onError('\u041e\u0448\u0438\u0431\u043a\u0430: ' + r1.error.message); return; }
        } else {
            var r2 = await client.auth.signUp({ email: email, password: password });
            if (r2.error) { _callbacks.onError('\u041e\u0448\u0438\u0431\u043a\u0430: ' + r2.error.message); return; }
        }
        var modal = _el('auth-modal');
        if (modal) modal.classList.remove('open');
    }

    async function signOut() {
        var client = _client();
        if (client) { try { await client.auth.signOut(); } catch (_) {} }
        _PS().currentUser = null;
        _PS().userScenario = null;
        _PS().userScenarios = [];
        _callbacks.onSignOut();
    }

    // ==== Init ====
    function init(cb) {
        if (cb) setCallbacks(cb);

        // Test mode
        if (location.search.indexOf('test=1') !== -1) {
            var _raw = null;
            try { _raw = localStorage.getItem('vissort_test_scenario'); } catch (e) {}
            if (_raw) {
                try {
                    var _td = JSON.parse(_raw);
                    _PS().supabaseClient = null;
                    _PS().currentUser = null;
                    _PS().sessionId = 'test_' + Date.now();
                    _callbacks.onTestMode(_td);
                    return;
                } catch (e) { VLog.warn('[auth] test mode failed:', e); }
            }
        }

        _PS().supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        var _onLoggedInFired = false;
        function _safeOnLoggedIn() {
            if (_onLoggedInFired) return;
            _onLoggedInFired = true;
            _callbacks.onLoggedIn();
        }

        _client().auth.getSession().then(function (r) {
            var data = r && r.data;
            _PS().currentUser = (data && data.session && data.session.user) || null;
            if (_PS().currentUser) _safeOnLoggedIn();
            else promptLogin();
        });

        _client().auth.onAuthStateChange(function (event, session) {
            _PS().currentUser = (session && session.user) || null;
            if (event === 'SIGNED_OUT') {
                _onLoggedInFired = false;
                promptLogin();
                return;
            }
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && _PS().currentUser) {
                _safeOnLoggedIn();
            }
        });

        setTimeout(async function () {
            if (_onLoggedInFired) return;
            try {
                var r = await _client().auth.getSession();
                var data = r && r.data;
                if (data && data.session && data.session.user) {
                    _PS().currentUser = data.session.user;
                    VLog.log('[auth] fallback: сессия найдена');
                    _safeOnLoggedIn();
                }
            } catch (e) {}
        }, 1500);

        // Привязка формы + observer
        bindAuthForm();
        installObserver();
    }

    // ==== Observer ====
    function installObserver() {
        var modal = _el('auth-modal');
        if (!modal) return;
        bindAuthForm();
        var obs = new MutationObserver(function () {
            if (modal.classList.contains('open')) {
                bindAuthForm();
                focusAuthField();
            }
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
        if (modal.classList.contains('open')) {
            bindAuthForm();
            focusAuthField();
        }
        VLog.log('[auth] observer установлен');
    }

    global.PlayerAuth = {
        setCallbacks: setCallbacks,
        init: init,
        promptLogin: promptLogin,
        updateModal: updateAuthModal,
        doAuth: doAuth,
        signOut: signOut,
        prefillEmail: prefillAuthEmail,
        focusField: focusAuthField,
        bindForm: bindAuthForm,
        installObserver: installObserver
    };

    VLog.log('[player-auth] module installed');
})(window);