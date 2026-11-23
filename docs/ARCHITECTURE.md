# Vissort — Архитектура (актуальная карта)

> Составлено: 23.11.2026 (после HANDOFF 20.11.2026 и правок init/яркость/ЖС).
> Источники: `docs/PROJECT-MAP.md`, `docs/CONTEXT.md`, `docs/NOTES.md`, `HANDOFF.md` + ревизия кода.
> Назначение: единая точка входа «что где лежит и кто кого вызывает».

---

## 1. Что такое Vissort

Веб-платформа тренировки зрительного анализатора. Браузер, офлайн-first. Три задачи: повышение остроты, снятие спазма аккомодации, снятие астенопии. Преемник ColorEyesKeeper.

**Стек:** Vanilla JS + HTML + CSS; Service Worker (офлайн); Web Speech API (голос); face-api.js (камера); Supabase (PostgreSQL + Auth + Edge Functions); DeepSeek через Edge `generate-scenario` (rate-limit 20/час); Sentry через Supabase-прокси.

---

## 2. Точки входа (HTML)

| Файл | Роль | Ключевое |
|---|---|---|
| `admin.html` | Редактор сценариев (врач/методист) | граф узлов, инспектор, генератор, sync, auth |
| `clinic.html` | Клинический редактор (Фаза 6 MVP) | копия admin + `#protocol-panel` (5 полей) + `clinic.js` |
| `user.html` | Плеер пациента | вход, выбор сценария, тренировка, история |
| `player.html` | Плеер разработчика | `?test=1`, `requireDomain: true`, dev-индикаторы |
| `index.html` / `features.html` | Лендинг / фичи | маркетинг |
| `pyatnashki.html`, `differences-wolf.html` | Игры | отдельные мини-приложения |
| `gabor-test.html` | Стенд Габора | SF, ориентация, контраст, σ, γ, дрейф, изолюминантность, кольцевой фланкер |
| `sandbox.html` / `sandbox.js` | Песочница ЖС | эксперименты с цветом/яркостью |

---

## 3. Порядок загрузки (критичен)

**Базовое ядро всегда первым:** `vissort-logger.js` (VLog) → `vissort-env.js` (SUPABASE_URL/ANON_KEY/RELEASE) → `vissort-dialog.js` (VissortDialog) → `vissort-core.js` (VissortCore).

### 3.1 admin.html / clinic.html (sync, без defer)
`logger → env → dialog → core → data-layer → voice → keepalive → app-state → app-player-preview → app-editor → app-inspector → app-generator → app-scenarios → app-blink-camera → app-auth → app-utils → app.js → clinic.js (только clinic) → header-drag → vissort-ai-generator → inline installSyncUI`

`app.js` вызывает `init()` сразу (он в конце body). `installZoom` / `installNewScenario` идут **после** `init()` — поэтому `init()` обёрнут в try/catch.

### 3.2 user.html / player.html (defer)
`onboarding → device → voice → user.js/player.js (sync) → logger → env → dialog → core → player-state → player-auth → player-scenarios → player-distance → player-camera → player-animation → player-invalid-detection → player-utils → player-dist-warning → player-reading → player-reading-mode → player-graph → player-session → player-single → player-installers → player-overlay → player-runtime`

### 3.3 Service Worker
`sw.js` регистрируется только в admin/clinic (через `registerServiceWorker` в `init()`). В user/player — **нет** (TODO). На localhost SW не работает (`IS_DEV`).

---

## 4. Реестр модулей (кто что экспортирует)

Модули оформлены как IIFE `(function(global){...})(window)` и пишут `window.X = ...`.

### 4.1 Ядро (общее)
| Файл | Экспорт | Назначение |
|---|---|---|
| `vissort-logger.js` | `VLog` | логгер (no-op в проде, `?debug=1`) |
| `vissort-env.js` | `VissortEnv` | `SUPABASE_URL`, `ANON_KEY`, `RELEASE` |
| `vissort-dialog.js` | `VissortDialog` | `alert/confirm/prompt` (стилизованные, Promise) |
| `vissort-core.js` | `VissortCore` | acuity/time/colors/phases/SVG/utils + `playDynamicStimulus` + `colorTable` |
| `data-layer.js` | `Data` | IndexedDB (9 stores) + Supabase REST + syncQueue (48 методов) |
| `voice.js` | `Voice` | Web Speech + mp3-фразы (`say`, `sayKey`, `readText`…) |
| `vissort-device.js` | `VissortDevice` | fingerprint + калибровка (`vissort_device_calib`) |
| `vissort-onboarding.js` | `Onboarding` | мастер калибровки (PPI + камера) |
| `vissort-ai-generator.js` | `AIGenerator` | DeepSeek через Edge `generate-scenario` |
| `header-drag.js` | — | перетаскивание кнопок шапки (ПКМ) |
| `keepalive.js` | — | кнопка 📡, пинг Supabase |
| `tracker.js` | — | аналитика |
| `sw.js` | — | Service Worker (кэш + precache) |

### 4.2 Редактор (`app-*.js`, вход admin/clinic)
| Файл | Экспорт | Назначение |
|---|---|---|
| `app-state.js` | `AppState` | 90+ полей состояния редактора + шим `window.* ↔ AppState.*` |
| `app-player-preview.js` | `AppPlayerPreview` | плеер-превью внутри редактора (адаптивная острота, blink) |
| `app-editor.js` | `AppEditor` (+ алиас `AppEditorCore`) | граф: узлы, связи, drag/resize, ветвление, порты ✅❌⏱ |
| `app-inspector.js` | `AppInspector` | инспектор узла (стимул/сравнение/чтение/логика + Цвета/Яркость/Анимация) |
| `app-generator.js` | `AppGenerator` | генератор режимов (сетки, круги, периферия, дефокус…) |
| `app-scenarios.js` | `AppScenarios` | сохранение/загрузка, Библиотека, шаблоны, book picker, папки |
| `app-blink-camera.js` | `AppBlinkCamera` | моргание (EAR) + камера редактора |
| `app-auth.js` | `AppAuth` | Supabase auth + SW + `ADMIN_EMAILS` |
| `app-utils.js` | `AppUtils` | утилиты + анимации редактора (дублируют PlayerAnimation) |
| `app.js` | `updateInspector`, `switchMode`, обёртки | bootstrap + `init()` + мосты |

### 4.3 Плеер (`player-*.js`, вход user/player)
| Файл | Экспорт | Назначение |
|---|---|---|
| `player-state.js` | `PlayerState` | ~150 полей состояния плеера (плоский) |
| `player-utils.js` | `PlayerUtils` | rate-limit 100/мин, validateScenario, дистанция |
| `player-dist-warning.js` | `PlayerDistWarning` | баннеры дистанции (мягкий/жёсткий) |
| `player-distance.js` | `PlayerDistance` | check/baseline/effectiveTolerance |
| `player-reading.js` | `PlayerReading` | фон чтения (solid/split/gradient/dynamic) |
| `player-camera.js` | `PlayerCamera` | камера, face-api, EAR, дистанция |
| `player-animation.js` | `PlayerAnimation` | 7 типов анимаций |
| `player-invalid-detection.js` | `PlayerInvalidDetection` | детекция наклона/аннулирование |
| `player-overlay.js` | `PlayerOverlay` | HUD-оверлей |
| `player-installers.js` | `PlayerInstallers` | install* функции |
| `player-single.js` | `PlayerSingle` | плоский + сравнительный режимы |
| `player-graph.js` | `PlayerGraph` | плеер графа (ветвление по outcome) |
| `player-session.js` | `PlayerSession` | start/stop/saveResult |
| `player-reading-mode.js` | `PlayerReadingMode` | режим чтения |
| `player-auth.js` | `PlayerAuth` | auth плеера |
| `player-scenarios.js` | `PlayerScenarios` | загрузка сценариев |
| `player-runtime.js` | `PlayerRuntime` | bootstrap плеера + обёртки + мосты `window._*` |
| `player-core.js` | `PlayerCore` | тонкая обёртка `playDynamicStimulus` |
| `player.js` / `user.js` | `VissortPlayerOptions` | `{requireDomain, showGamesMenu}` |

> Примечание: `app-player.js` (v10) — отдельный, самодостаточный плеер ветвления для редактора (`global.AppPlayer.startPlayer`), со своими кнопками-стрелками и кнопкой «Выйти в редактор».

### 4.4 Клиника
| Файл | Экспорт | Назначение |
|---|---|---|
| `clinic.js` | `VissortClinicOptions` | генерация узлов, сохранение с `doctor_id`, назначение |

---

## 5. Потоки данных

### 5.1 Редактор → сценарий → плеер
1. `app-editor.js` создаёт узлы/связи в `AppState.nodes/connections` (типы: `STIMULUS`, `COMPARE`, `READING`, `LOGIC_IF`; ветвление через `node.branching.outcomes = {correct,wrong,timeout}`).
2. `app-scenarios.js` сериализует в `{graph:{nodes,connections,books}, trainingType, ...}` с `schemaVersion: 2` (`migrateScenario` при загрузке).
3. Сохранение: папка `Vissort/Сценарии` (File System Access) + IndexedDB + syncQueue → Supabase.
4. Плеер (`player-single.js`/`player-graph.js`/`player-reading-mode.js`, а в редакторе — `app-player-preview.js` или `app-player.js` v10) читает граф и проигрывает узлы по связям (outcome-переходы).

### 5.2 Результаты
`saveResult` → IndexedDB → syncQueue → Supabase (`test_results`, `training_sessions`). Реакции/калибровка синхронизируются по `fingerprint|userId`.

---

## 6. Состояние и глобалы

- **Редактор:** `window.AppState` (единый объект, ~90 полей) + шим `window.xxx ↔ AppState.xxx` (в `app-state.js`).
- **Плеер:** `window.PlayerState` (плоский объект, ~150 полей).
- **Ad-hoc глобалы:** ~30 `window._*` (книги, сценарий, мосты камеры/детекции) — задокументированы в PROJECT-MAP §6.
- **Zoom:** `window.__vissort_zoom` (читает `app-editor.js`), `window.__vissort_newScenario` (debug).

---

## 7. Ключевые паттерны и грабли

1. **IIFE-модули** пишут `window.X = ...` через `(function(global){...})(window)`.
2. **Тонкие обёртки — не модули** (`function f() { return window.X.y(); }`).
3. **Порядок загрузки критичен** — `VLog`/`VissortEnv`/`VissortDialog`/`VissortCore` до всех.
4. **Callbacks-контракты** (`PlayerCamera/PlayerAnimation/PlayerInvalidDetection.setCallbacks`) — вложены тройкой, задокументированы в PROJECT-MAP §5.
5. **Дублирование** ~3000 строк между `app-*.js` и `player-*.js` — признано адаптацией к state, не баг (PROJECT-MAP §8).
6. **Три системы дистанции** (редактор / плеер / наклон) — частично унифицированы через `player-distance.js` (PROJECT-MAP §7).
7. **Кириллица UTF-8 без BOM**; `.tmp` для больших PowerShell-патчей; `node --check` не ест `.tmp`.

---

## 8. Актуальный статус и известные проблемы (23.11.2026)

### Сделано в последней сессии
- Починен `init()` в `app.js`: падал на `btnModeToggle` (кнопка `btn-mode-toggle` закомментирована) → `switchMode` обёрнут; `init()` в try/catch → «Новый сценарий» и зум снова работают.
- Яркость стимула/фона (%) добавлена в инспектор и применяется в `getStimulusSVG` + `app-player.js`.
- ЖС переехал в инспектор: панель «🎬 Анимация» (режим, шаг, D start/end, яркость start/end); убран отдельный блок `AppStimulusEditor.render` и конфликтующий `hideExtraInspectorBlocks`.
- `app-player.js`: убрана двойная кодировка (кракозябры) — направления теперь из локальной `DIR` (`\u`-эскейпы, как в `vissort-core.js`), кнопки-стрелки и «Выйти в редактор» читаемы, ориентация буквы E / кольца Ландольта в плеере снова корректна.
- Убрано предупреждение `[DOM] … autocomplete`: в `admin.html`/`clinic.html` полям входа добавлены `autocomplete="email"` / `autocomplete="current-password"`.

### Известные хвосты (не закрыты)
- Калибровка и изолюминантность для ЖС — не реализованы.
- Контраст (ползунок) — не реализован.
- Периферийные точки — в инспекторе есть, в `app-player.js` (v10) не отрисованы.
- Габор — только стенд `gabor-test.html`, в основной редактор не перенесён.

### Техдолг (из PROJECT-MAP §12–13)
- P1: SW не precache'ит все модули; CSP без `frame-ancestors` (закрыто), дубли кода, мёртвые функции/константы, магические числа, смешение языков.

---

## 9. Тесты

`tests/*.spec.js` (9 файлов, ~37 тестов, Playwright): ai-generator, camera, clinic, editor, login, offline, player, reading, schema. Запуск: `npx playwright test`. Локальный стенд: `npx --yes http-server -p 5500 -c-1`.

---

*Составлено по `docs/PROJECT-MAP.md` (2026-10-19) + ревизия кода 23.11.2026.*
