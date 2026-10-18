// clinic.js — entry для clinic.html (Фаза 6 MVP, одна клиника)
window.VissortClinicOptions = {
  requireDomain: false,
  showGamesMenu: false,
  requireRole: 'doctor',
};

document.addEventListener('DOMContentLoaded', () => {
  const docEl = document.getElementById('clinic-doctor');
  if (docEl && window.currentUser) docEl.textContent = window.currentUser.email || '';

  document.getElementById('btn-generate-protocol')?.addEventListener('click', () => {
    if (!window.AppEditor || !window.AppState) return;

    const type = document.getElementById('protocol-training-type').value;
    const diopters = parseFloat(document.getElementById('protocol-diopters').value) || -1;
    const duration = parseInt(document.getElementById('protocol-duration').value) || 10;
    const blink = document.getElementById('protocol-blink').checked;

    window.AppState.nodes.length = 0;
    window.AppState.connections.length = 0;

    const acuity = Math.max(0.1, Math.min(1.0, 0.8 + diopters * 0.1));

    if (type === 'reading') {
      const id = window.AppEditor.createNewNode('READING', 100, 100);
      const node = window.AppEditor.getNode(id);
      if (node) {
        node.readingDistance = 1;
        node.duration = duration * 60 * 1000;
        node.readingAcuity = acuity;
      }
    } else {
      const id = window.AppEditor.createNewNode('STIMULUS', 100, 100);
      const node = window.AppEditor.getNode(id);
      if (node) {
        node.duration = 1000;
        node.seriesCount = Math.max(5, Math.round(duration / 2));
        node.seriesSize = 5;
        node.stimDistance = 1;
        node.stimAcuity = acuity;
        node.stimPPI = window.AppState.screenPPI || 96;
      }
    }

    if (blink && window.AppState) window.blinkEnabled = true;

    window.AppEditor.requestRenderGraph();
    alert('Сценарий сгенерирован. Проверьте превью.');
  });

  document.getElementById('btn-save-protocol')?.addEventListener('click', async () => {
    if (!window.Data || !window.AppState) return;
    const name = prompt('Название протокола:', 'Протокол ' + new Date().toLocaleDateString());
    if (!name) return;

    const scenario = {
      name,
      training_type: document.getElementById('protocol-training-type').value,
      params: {
        graph: {
          nodes: JSON.parse(JSON.stringify(window.AppState.nodes)),
          connections: JSON.parse(JSON.stringify(window.AppState.connections)),
          books: JSON.parse(JSON.stringify(window._books || {}))
        },
        scenarioKey: window._currentScenarioKey || null
      },
      doctor_id: window.currentUser?.id || null,
      created_by: window.currentUser?.id || null
    };

    try {
      await window.Data.saveScenario(scenario);
      alert('Сохранено: ' + name);
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  });

  document.getElementById('btn-users')?.addEventListener('click', async () => {
    document.getElementById('users-modal').style.display = 'flex';
    try {
      const users = await window.Data.getUsers();
      document.getElementById('selected-user').innerHTML = users.map(u => `<option value="${u.id}">${u.email || u.id}</option>`).join('');
      const scenarios = await window.Data.getScenarios();
      document.getElementById('selected-scenario').innerHTML = scenarios.map(s => `<option value="${s.id}">${s.name || s.id}</option>`).join('');
    } catch (e) {
      console.error('[clinic] users load error', e);
    }
  });

  document.getElementById('btn-assign-scenario')?.addEventListener('click', async () => {
    const userId = document.getElementById('selected-user').value;
    const scenarioId = document.getElementById('selected-scenario').value;
    if (!userId || !scenarioId) return;
    try {
      await window.Data.assignScenario(userId, scenarioId);
      alert('Назначено');
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  });

  document.getElementById('btn-users-close')?.addEventListener('click', () => {
    document.getElementById('users-modal').style.display = 'none';
  });
});
