// player-scenarios.js — сценарии пользователя + история (§15.1.2 ч.5/7).
// Зависит: VLog, VissortCore.escapeHtml.
(function (global) {
    'use strict';

    function _el(id) { return document.getElementById(id); }
    function _esc(s) {
        var esc = (global.VissortCore && global.VissortCore.escapeHtml);
        if (esc) return esc(s);
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // ==== Загрузка сценариев ====
    async function loadUserScenarios(client, userId) {
        if (!client || !userId) return [];
        var r1 = await client
            .from('user_scenarios')
            .select('scenario_id')
            .eq('user_id', userId);
        if (r1.error) {
            VLog.error('[scenarios] user_scenarios:', r1.error);
            return [];
        }
        var assigns = r1.data;
        if (!assigns || !assigns.length) return [];
        var ids = assigns.map(function (a) { return a.scenario_id; });
        var r2 = await client
            .from('scenarios')
            .select('id,name,training_type,params')
            .in('id', ids);
        if (r2.error) {
            VLog.error('[scenarios] scenarios:', r2.error);
            return [];
        }
        return (r2.data || []).map(function (s) {
            return {
                id: s.id,
                name: s.name,
                params: s.params || {},
                trainingType: s.training_type
            };
        });
    }

    // ==== Picker (список сценариев) ====
    function openPicker(scenarios, onSelect) {
        var list = _el('scenario-list');
        if (!list) return;
        list.innerHTML = '';
        scenarios.forEach(function (s) {
            var el = document.createElement('div');
            el.className = 'scenario-item';
            el.innerHTML =
                '<div><div style="font-weight:600">' + _esc(s.name) + '</div>' +
                '<div style="font-size:11px;color:#9ca3af">' + _esc(s.trainingType || 'single') + '</div></div>' +
                '<div>\u25b6</div>';
            el.addEventListener('click', function () {
                if (typeof onSelect === 'function') onSelect(s);
            });
            list.appendChild(el);
        });
        var modal = _el('scenario-modal');
        if (modal) modal.classList.add('open');
    }

    // ==== История ====
    async function openHistory(client, userId) {
        var modal = _el('history-modal');
        if (modal) modal.classList.add('open');
        var body = _el('history-body');
        if (!body) return;
        body.textContent = '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026';

        if (!client || !userId) {
            body.innerHTML = '<div>\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u043e\u0432.</div>';
            return;
        }

        var r = await client
            .from('test_results')
            .select('session_id,node_id,response_time_ms,is_correct,created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(200);
        if (r.error) {
            body.innerHTML = '<div style="color:#dc2626">\u041e\u0448\u0438\u0431\u043a\u0430: ' + _esc(r.error.message) + '</div>';
            return;
        }
        var data = r.data;
        if (!data || !data.length) {
            body.innerHTML = '<div>\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u043e\u0432.</div>';
            return;
        }
        var groups = {};
        data.forEach(function (row) {
            var k = row.session_id || '\u2014';
            if (!groups[k]) groups[k] = { total: 0, ok: 0, when: row.created_at };
            groups[k].total++;
            if (row.is_correct) groups[k].ok++;
        });
        var rows = Object.entries(groups).slice(0, 30).map(function (entry) {
            var sid = entry[0], g = entry[1];
            var d = new Date(g.when);
            var when = d.toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            var pct = Math.round((g.ok / g.total) * 100);
            return '<tr><td>' + when + '</td><td>' + g.ok + '/' + g.total + '</td><td>' + pct + '%</td>' +
                '<td style="color:#6b7280;font-size:11px">' + _esc(String(sid).slice(0, 14)) + '\u2026</td></tr>';
        }).join('');
        body.innerHTML = '<table class="res-table"><thead><tr>' +
            '<th>\u041a\u043e\u0433\u0434\u0430</th><th>\u0412\u0435\u0440\u043d\u043e</th><th>%</th><th>\u0421\u0435\u0441\u0441\u0438\u044f</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    global.PlayerScenarios = {
        loadUserScenarios: loadUserScenarios,
        openPicker: openPicker,
        openHistory: openHistory
    };

    VLog.log('[player-scenarios] module installed');
})(window);