# Vissort — архитектура

> Карта модулей и потоков данных.
> Связанные: PLAN.md, HANDOFF.md

## Общая схема

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│ Браузер (клиент) │
│ │
│ admin.html ─────┐ │
│ ├──> app.js ──────┐ │
│ user.html ──────┤ │ │
│ player.html ────┤ ├──> vissort-core.js │
│ ├──> player-runtime.js │
│ │ │ │
│ │ ├──> data-layer.js │
│ │ │ │ │
│ │ ├──> voice.js │
│ │ │ │
│ └─────────────────┴──> sw.js (Service Worker) │
│ │
└─────────────────────────────────────────────────────────────────┘
│
│ HTTPS
▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase (облако) │
│ │
│ Auth ◄──────► PostgreSQL ◄──────► Edge Functions │
│ │ │ │
│ │ ├─> generate-scenario (DeepSeek)
│ │ ├─> sentry-proxy
│ │ └─> backup (в планах)
│ │ │
│ RLS-политики │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

## Модули

### vissort-core.js

**Назначение:** общие утилиты без DOM-зависимостей. Загружается первым.

**Что экспортирует** (через \`window.VissortCore\`):

- Формулы остроты: \`acuityToSizeMm\`, \`acuityToSizePx\`, \`acuityToFontSizePx\`
- Цвета: \`hexToRgb\`, \`rgbToHex\`, \`lerpColor\`
- SVG: \`generateLetterE\`, \`generateLandoltRing\`, \`getStimulusSVG\`, \`getCircleStimulusSVG\`
- Фазы динамики: \`buildGenericDynamicPhases\`, \`buildCirclePhases\`
- Утилиты: \`escapeHtml\`, \`getThreshold\`, \`randomDirection\`, \`hashCode\`, \`sha1\`

**Зависимости:** нет.

**Кто использует:** \`app.js\`, \`player-runtime.js\`.

### data-layer.js

**Назначение:** единая прослойка между UI и источниками данных. IndexedDB + Supabase REST + очередь синхронизации.

**Что экспортирует** (через \`window.Data\`):

- Сценарии: \`getScenarios\`, \`getScenariosLocal\`, \`saveScenario\`, \`deleteScenario\`
- Шаблоны: \`getTemplates\`, \`saveTemplate\`, \`bulkImportTemplates\`
- Пользователи: \`getUsers\`
- Назначения: \`getAssignments\`, \`assignScenario\`
- Результаты: \`saveResult\`
- Очередь: \`getQueue\`, \`flush\`, \`clearQueue\`, \`getStatus\`
- Папки: \`saveFolderHandle\`, \`scanFolder\`

**Зависимости:** Supabase JS, IndexedDB.

**Кто использует:** \`app.js\`, \`player-runtime.js\`.

### app.js (366 KB)

**Назначение:** редактор сценариев + auth + все UI-модалки.

**Ключевые функции:**

- Граф: \`createNewNode\`, \`deleteNode\`, \`startConnection\`, \`renderGraph\`
- Инспектор: \`updateStimulusInspector\`, \`updateReadingInspector\`, \`updateCompareInspector\`
- Плеер (для тестов из редактора): \`playNodesSequence\`, \`playStimulusNodeSeries\`
- Auth: \`initSupabase\`, \`signIn\`, \`signUp\`, \`updateAuthUI\`
- Миграции: \`migrateScenario\` (schemaVersion 1 → 2)
- Сохранение: \`buildScenarioPayloadFromCurrent\`, \`loadGraph\`
- AI: экспорт \`window.AppEditorCore\` для \`vissort-ai-generator.js\`

**Зависимости:** vissort-core, data-layer, voice, face-api.

**Проблема:** 366 KB, монолит. В перспективе — разбить на модули.

### player-runtime.js (145 KB)

**Назначение:** логика плеера — всё, что происходит после «Старт».

**Ключевые функции:**

- Запуск: \`startPlayer\`, \`playNextGraphNode\`, \`playGraphStimulus\`
- Плоский режим: \`showNextStimulus\`, \`finishSeries\`
- Чтение: \`playGraphReading\`, \`applyReadingBackground\`
- Сравнение: \`showDirectionComparison\`, \`showFindSameComparison\`
- Камера: \`enableCamera\`, \`processCamFrame\`, \`evaluateDistance\`
- Устойчивость: \`_pushDetection\`, \`_updateDetectUI\`, \`_faceEmoji\`
- Hard limit: \`_checkHardLimit\`, \`_showDistHardBanner\`
- Динамика: \`startSingleStimAnimation\`, \`startCircleAnimation\`

**Зависимости:** vissort-core, data-layer, voice.

**Проблема:** 145 KB / 5100 строк, монолит. **Фаза 1 — разбить на 5 модулей:**

- \`player-state.js\` — единое состояние
- \`player-camera.js\` — камера, face-api, устойчивость
- \`player-graph.js\` — граф и очередь узлов
- \`player-flat.js\` — плоский режим (автотренировка)
- \`player-reading.js\` — чтение

### voice.js

**Назначение:** голосовое сопровождение через Web Speech API.

**Что экспортирует** (через \`window.Voice\`):

- \`say(text, opts)\`, \`sayKey(key)\`, \`mute(flag)\`, \`toggle()\`
- Чтение вслух: \`readText\`, \`pauseReading\`, \`resumeReading\`, \`stopReading\`

**Зависимости:** Web Speech API.

### sw.js

**Назначение:** Service Worker. Офлайн-режим.

**Стратегии:**

- HTML — network-first с fallback на кэш
- JS/CSS — stale-while-revalidate
- Supabase REST — stale-while-revalidate

**Версионирование:** \`CACHE_VERSION = 'vissort-v34'\`. Меняется вручную при обновлениях.

### supabase/functions/*

**generate-scenario/index.ts:**

- Проксирует запросы к DeepSeek API
- Auth: JWT + whitelist админов
- Rate-limit: 20 запросов/час на user_id (через \`check_ai_rate_limit\` RPC)
- Возвращает \`{ ok, data }\` или \`{ ok: false, error }\`

**sentry-proxy/index.ts:**

- Пересылает envelope от Sentry SDK в Sentry
- Обходит гео-блокировку
- Принимает \`text/plain\` (Sentry SDK избегает preflight)

## Потоки данных

### Сохранение сценария

\`\`\`
admin.html → app.js (buildScenarioPayloadFromCurrent)
→ Data.saveScenario
→ IndexedDB (локально)
→ syncQueue (очередь)
→ Supabase REST (когда онлайн)
\`\`\`

### Загрузка сценария

\`\`\`
player.html → player-runtime.js (loadUserScenarios)
→ Data.getScenarios
→ Supabase REST (или локальный кэш)
→ onLoggedIn
→ userScenario.params
→ startPlayer
\`\`\`

### Тренировка (стимул)

\`\`\`
startPlayer → playNextGraphNode → playGraphStimulus
→ getStimulusSVG (vissort-core)
→ displayStimulus
→ камера (processCamFrame) → face-api
→ _pushDetection → _updateDetectUI
→ ответ стрелкой → handleGraphDirectionAnswer
→ saveResult → Data.saveResult → Supabase
\`\`\`

## Версионирование схемы

Текущая версия: **schemaVersion = 2**

- v1 (до 2026-10-05) — без номера, старые сценарии
- v2 (с 2026-10-05) — добавлен \`schemaVersion: 2\`, миграция через \`migrateScenario\`

При загрузке сценария в \`loadGraph\`:

1. \`JSON.parse\`
2. \`migrateScenario(data)\` — если нет версии, считаем v1, добавляем 2
3. Per-node defaults — восстанавливают отсутствующие поля

## Точки расширения

**Что легко добавить:**

- Новый тип узла — в \`createNewNode\`, \`updateInspector\`, \`playGraph*\`
- Новый тип стимула — в \`getStimulusSVG\`
- Новая методика — в библиотеке (Фаза 6)

**Что сложно:**

- Изменение формата сценария (нужна миграция)
- Изменение структуры БД (нужна RLS-миграция)
- Изменение плеера (нужен рефакторинг)

## Известные проблемы

1. **player-runtime.js — монолит (5100 строк).** Риск при правках. Решение — Фаза 1.
2. **app.js — монолит (366 KB).** Второй по размеру. Возможно, разбить позже.
3. **Дублирование кода** между app.js и player-runtime.js (например, функции динамики).
4. **Комментарии PATCH*** — исторический мусор. Убрать в Фазе 2.

---

_Дата: 2026-10-05_
