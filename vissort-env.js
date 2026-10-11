// vissort-env.js — единый источник env-констант.
// Загружается ПЕРВЫМ, до всех модулей.
// После §11.2 — 5 копий SUPABASE_ANON_KEY сведены сюда.
(function () {
    'use strict';

    var SUPABASE_URL = 'https://hzvypwdpdhsjzaclxmbm.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6dnlwd2RwZGhzanphY2x4bWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjIyNTIsImV4cCI6MjEwNDE5ODI1Mn0.HK0VE9KdzS8c7WoMCIlvOUn02vSOQEN0ahGPgsYzKac';

    var RELEASE = 'vissort-2.0.0';

    window.VissortEnv = {
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
        RELEASE: RELEASE
    };

    VLog.log('[VissortEnv] loaded', {
        url: SUPABASE_URL,
        keyLen: SUPABASE_ANON_KEY.length
    });
})();