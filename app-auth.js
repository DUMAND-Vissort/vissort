/* app-auth.js — auth + SW
 * §A2-v9 (Фаза 5). Экспорт: window.AppAuth
 * Зависимости: VLog, VissortDialog, VissortEnv, window.Data, supabase
 */
(function () {
  const VLog = window.VLog;

  // === КОНСТАНТЫ (было app.js 41, 42, 2404–2405) ===
  const ADMIN_EMAILS = ['dumand@gmail.com'];
  const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  // supabaseClient — локальная (было implicit global в app.js)
  let supabaseClient = null;

  // === AUTH-ЯДРО + SW (было app.js 1677–1807) ===
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


  // === AUTH-HELPERS (было app.js 2403–2501) ===
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

  window.AppAuth = {
    initSupabase, signIn, signUp, signOut,
    updateAuthUI, showAuthModal,
    registerServiceWorker, showSWUpdateBanner,
    encodeCred, decodeCred, saveAuthCreds, prefillAuthCreds,
    focusAuthField, bindAuthForm, handleAuthSubmit,
    ADMIN_EMAILS, IS_DEV
  };

  VLog.log('[app-auth] loaded, methods:', Object.keys(window.AppAuth).length);
})();
