# Vissort — журнал решений

> Сюда пишем **принятые решения** — почему сделали так, а не иначе.
> Формат: дата → контекст → решение → почему.
> НЕ заменяет `TODO.md` — там активные задачи.

---

## 2026-10-12 — TODO(phase3) в app.js / player-runtime.js

### Решение: заменить TODO на пояснение, не унифицировать

**Контекст:**
- `window.stimDisplay` / `window.stimArea` ставит player-runtime.js (экспорт в window).
- В app.js — свои const stimDisplay / stimArea. ESLint видит коллизию имён.
- Фаза 3 закрыта 2026-10-10, TODO(phase3) остался в 5 местах.

**Решение:** заменить `TODO(phase3)` на актуальное пояснение.

**Почему не унифицировать:**
- app.js (admin.html) и player-runtime.js (player.html) — разные entry.
- Вместе не загружаются. Коллизия имён иллюзорна.
- Унификация — 10+ правок в app.js, риск. Ноль функциональной пользы.

**Файлы:** app.js (219, 221), player-runtime.js (183, 185), eslint.config.js (77–80).

---

## 2026-10-12 — Авто-bump SW cache

### Решение: через GitHub Actions (не npm-скрипт)

**Контекст:**
- `CACHE_VERSION` в sw.js — хардкод `vissort-v34`. Менялся вручную.
- Прод — GitHub Pages, деплой из main.

**Решение:** workflow `.github/workflows/bump-sw.yml` — при push в main (изменения `.html`/`.js`) заменяет `CACHE_VERSION` на `vissort-YYYYMMDD-<git-hash>`, коммитит с `[skip ci]`.

**Почему не npm-скрипт:** «можно забыть». Автоматизация надёжнее.

**Почему не цикл:** коммит бота содержит `[skip ci]`, workflow пропускает.

**Файлы:** `.github/workflows/bump-sw.yml`, `sw.js`.

---

## 2026-10-12 — Роли doctor / developer (§11.3)

### Решение: doctor с doctor_id в user_scenarios; developer без медданных

**Контекст:**
- Изначально только admin + patient. Врач и разработчик — не предусмотрены.
- При добавлении ролей — вопрос: developer видит медданные?

**Решение:**
- `admin` — всё.
- `developer` — только системные (без медданных).
- `doctor` — свои сценарии/пациенты через `doctor_patients`.
- `user_scenarios.doctor_id` — nullable, только doctor ставит свой id.

**Почему doctor_id, а не через doctor_patients:** нужна атрибуция «кто назначил».

**Файлы:** `docs/RLS-AUDIT.md`, миграция SQL.

---

## 2026-10-12 — TODO.md + PROJECT-MAP §13 + inline TODO

### Правило: TODO.md — центральный; inline — минимум

- **TODO.md** — активные задачи по фазам.
- **PROJECT-MAP §13** — техдолг (что не так, но не критично).
- **Inline TODO** — только для локальных мелочей, чистить раз в квартал.
- **NOTES.md** (этот файл) — решения + почему.

**Почему:** TODO.md не ловит inline; NOTES.md — журнал «почему».

---

## 2026-10-12 — §13.3.3: унификация модалок в app.js

### Решение: 74 диалога → VissortDialog (3 коммита)

**Контекст:**
- В app.js — 67 alert, 2 confirm, 5 prompt (нативные).
- Проблемы нативных: чужеродно на проде, нельзя стилизовать, блокируют UI.
- В проекте уже есть `vissort-dialog.js` (используется в player.html / user.html).

**Решение:** заменить все нативные диалоги в app.js на VissortDialog:
- ч.1: 67 alert → VissortDialog.alert (коммит 69ff3fd).
- ч.2: 2 confirm → VissortDialog.confirm + async (коммит ef6431c).
- ч.3: 5 prompt → VissortDialog.prompt + async (коммит 7b5b739).

**Почему confirm/prompt требуют async:**
- Нативные — синхронные, возвращают значение сразу.
- VissortDialog.* — Promise.
- Функции: renderTemplatesList (async), doNew (сделана async), saveNodeAsTemplate (async), saveGraph (async), saveCurrentScenario (async), addBlock (сделана async).
- Вызывающие — через addEventListener (async event-handler не ломается).

**Побочные правки тестов:**
- login.spec.js:33 — page.waitForEvent('dialog') → waitForSelector('#vissort-dialog[open]').
- editor.spec.js:131 — то же.

**Файлы:** app.js (74 замены), tests/login.spec.js, tests/editor.spec.js.

---

*Составлено: 2026-10-12.*

---

## 2026-10-16 — §A2-v4: вынос инспектора в app-inspector.js

### Решение: 17 функций инспектора → отдельный модуль (926 строк)

**Контекст:**
- §A2-v3 закрыт 16.10 (app.js 6569 → 5546).
- Инспектор — следующий по размеру блок: 17 функций, ~876 строк (1920–2795).
- Цель Фазы 5: app.js → ~1000 строк (bootstrap + init + auth).

**Решение:** вынести в `app-inspector.js`:
- `updateInspector`, `updateStimulusInspector`, `updateLogicInspector`, `updateCompareInspector`, `updateReadingInspector`
- `renderInspectorGridPreview`, `renderPeriInspectorSection`, `renderDefocusInspectorSection`, `renderBlinkAnimationInspectorSection`
- `initInspectorEvents`, `applyInspectorChanges` + 7×`apply*InspectorChanges`

**Как:**
- Экспорт `window.AppInspector` (17 методов).
- 17 обёрток в `app.js`.
- Импорт из `VissortCore`: `acuityToSizeMm`, `acuityToSizePx`, `getStimulusSVG`, `rgbToHex`, `hexToRgb`, `escapeHtml`, `detectUnit`, `msToUnit`, `unitToMs`.
- Хелперы из `AppEditor`: `getNode`, `getNodeComputedSize`, `getNodeComputedSizeMm`, `requestRenderGraph`, `defaultCompareCellParams`.
- Мост в app.js: `window.openBookPicker`, `window.saveUserSettings`.

**Результат:**
- `app.js`: 5546 → 4690 (−856).
- `app-inspector.js`: 926 строк (новый).
- `admin.html`: подключён `<script src="app-inspector.js">`.
- `sw.js`: precache добавлены `app-state.js`, `app-player-preview.js`, `app-editor.js`, `app-inspector.js`.
- Тесты: 28 passed.
- Коммит: `02aed43`.

**Проблемы по ходу:**
- PS 7.6.6 падал на больших скриптах → обход через `Add-Content` + `.tmp`.
- Дубль `requestRenderGraph` в шапке (после повторного патча) → удалён.
- Лишняя `}` от приблизительной версии (вставили неточный код) → удалена после `node --check`.
- `app-editor.js` потерял `updateInspector` для AI-генератора → добавлен в экспорт.

**Следующее:** §A2-v5 (генератор → `app-generator.js`, ~658 строк).


---

## 2026-10-16 — §A2-v4: вынос инспектора в app-inspector.js

### Решение: 17 функций инспектора → отдельный модуль (926 строк)

**Контекст:**
- §A2-v3 закрыт 16.10 (app.js 6569 → 5546).
- Инспектор — следующий по размеру блок: 17 функций, ~876 строк (1920–2795).
- Цель Фазы 5: app.js → ~1000 строк (bootstrap + init + auth).

**Решение:** вынести в `app-inspector.js`:
- updateInspector, updateStimulusInspector, updateLogicInspector, updateCompareInspector, updateReadingInspector
- renderInspectorGridPreview, renderPeriInspectorSection, renderDefocusInspectorSection, renderBlinkAnimationInspectorSection
- initInspectorEvents, applyInspectorChanges + 7 apply*InspectorChanges

**Как:**
- Экспорт window.AppInspector (17 методов).
- 17 обёрток в app.js.
- Импорт из VissortCore: acuityToSizeMm, acuityToSizePx, getStimulusSVG, rgbToHex, hexToRgb, escapeHtml, detectUnit, msToUnit, unitToMs.
- Хелперы из AppEditor: getNode, getNodeComputedSize, getNodeComputedSizeMm, requestRenderGraph, defaultCompareCellParams.
- Мост в app.js: window.openBookPicker, window.saveUserSettings.

**Результат:**
- app.js: 5546 → 4690 (−856).
- app-inspector.js: 926 строк (новый).
- admin.html: подключён app-inspector.js.
- sw.js: precache добавлены app-state.js, app-player-preview.js, app-editor.js, app-inspector.js.
- Тесты: 28 passed.
- Коммит: 02aed43.

**Проблемы по ходу:**
- PS 7.6.6 падал на больших скриптах → обход через Add-Content + .tmp.
- Дубль requestRenderGraph в шапке → удалён.
- Лишняя } от приблизительной версии → удалена после node --check.
- app-editor.js потерял updateInspector для AI-генератора → добавлен в экспорт.

**Следующее:** §A2-v5 (генератор → app-generator.js, ~658 строк).


---

## 2026-10-17 — §A2-v5: вынос генератора в app-generator.js

### Решение: 26 функций генератора → отдельный модуль (875 строк)

**Контекст:**
- §A2-v4 закрыт 16.10 (app.js 5546 → 4690).
- Генератор — следующий блок: 26 функций в 4 местах.

**Решение:** вынести в `app-generator.js` (3 кластера):
- A: PHYSIOLOGICAL_PHASES + buildPhysiologicalPhases + buildDynamicPhases
- B: 7× ensure*GeneratorUI, renderGridPreview, generateCellParamsFields, collectCompareParams, buildModeParamsFromUI, modeParamsToNode, modeParamsToReadingNode
- C: 10× update*Visibility + updatePhysioListHint

**Как:**
- Экспорт window.AppGenerator (26 методов + PHYSIOLOGICAL_PHASES).
- 26 обёрток в app.js + const PHYSIOLOGICAL_PHASES = window.AppGenerator.PHYSIOLOGICAL_PHASES.
- Мост: window.safeVal, window.safeChecked, window.setLastBookId.
- Импорт из VissortCore: getThreshold, hexToRgb, unitToMs, acuityToSizeMm, acuityToSizePx, sha1.
- Хелперы из AppEditor: createNewNode, getNode, getNodeComputedSize, canAddConnection, requestRenderGraph.
- Хелпер из AppInspector: updateInspector.

**Результат:**
- app.js: 4693 → 3903 (−790).
- app-generator.js: 875 строк (новый).
- admin.html: подключён app-generator.js.
- sw.js: precache app-generator.js.
- Тесты: 28 passed.
- Коммит: 5b6e9a8.

**Проблемы по ходу:**
- Первый скрипт (с [char]96 + конкатенацией) вставил сломанный ensureSingleGridGeneratorUI → удалили (103–126).
- 4c (renderGridPreview + collectCompareParams + buildModeParamsFromUI) случайно пропустили → добавили после footer (hoisting сработал).
- vissort-dialog.js: showModal() не ставит [open] → добавили setAttribute('open', '') для тестов.

**Правило (подтверждено):**
- Here-string @'...'@ работает для JS с backtick, если внутри нет [char]96 и конкатенаций.
- Длинные блоки — через here-string + WriteAllText.

**Следующее:** §A2-v6 (сохранение + библиотека → app-scenarios.js, ~780 строк).


---

## 2026-10-17 — §A2-v6: сохранение + библиотека → app-scenarios.js

### Решение: 25 функций → отдельный модуль (811 строк)

**Контекст:**
- §A2-v5 закрыт 17.10 (app.js 4693 → 3903).
- Следующий блок — сохранение/загрузка + библиотека + шаблоны + book picker.

**Решение:** вынести в `app-scenarios.js` (5 регионов):
- TEMPLATES (9): saveNodeAsTemplate, applyTemplateToCanvas, loadTemplatesFolder, importTemplatesFromFolder, importTemplatesFromFileList, refreshTemplatesIfOpen, renderTemplatesList, openTemplatesModal, exportAllTemplates.
- BOOK PICKER (6): openBookPicker, closeBookPicker, renderBookPickerList, applyBookSelection, detachBookFromActiveNode, handleBookPickerFileUpload.
- FOLDER HANDLE (4): restoreFolderHandle, restoreTemplatesFolderHandle, selectFolder, scanScenariosFolder.
- SAVE/LOAD (4): saveGraph, buildScenarioPayloadFromCurrent, migrateScenario, loadGraph.
- LIBRARY (2): loadScenarioList, saveCurrentScenario.

**Как:**
- Экспорт `window.AppScenarios` (25 методов).
- 25 тонких обёрток в app.js перед `// AUTH: SAVE + PREFILL`.
- Мосты: `window.generateScenarioKey`, `window.bookmarkKeyFor`, `window.getLastBookId` (SCENARIO KEY / BOOKMARKS **остался в app.js**, 4 функции — используются в READING-регионе).
- `templatesFolderHandle` / `selectedFolderHandle` / `_saveGraphInFlight` — **уже в AppState** (aliases 185, 187). Работают через шим `window.*` → `AppState.*`.
- `HAS_FS_ACCESS` — удалён из app.js, объявлен в модуле.
- `'use strict'` в модуле **убран** — иначе присваивание к `window.*` через шим AppState даёт ReferenceError (strict запрещает запись в undeclared variable, даже если она есть на window).

**Результат:**
- app.js: 3903 → **3165** (−738).
- app-scenarios.js: **811** строк (новый).
- admin.html: подключён `<script src="app-scenarios.js">` после `app-generator.js`.
- sw.js: precache `'/app-scenarios.js'`.
- Тесты: 28 passed.
- Коммит: `af83010`.

**Проблемы по ходу (важно для §A2-v7–v9):**
- **Границы регионов — по функциям, не по заголовкам.** Регион «ПАПКИ» (2398–2486, restoreFolderHandle…scanScenariosFolder) идёт **до** `// === СОХРАНЕНИЕ ===` (2487). При первом проходе `2487..2860` его пропустил → node --check падал.
- **handleBookPickerFileUpload недобрал `}`** (1989 — последняя строка, `-First 87` взял до 1988). Фикс: +1 `}` перед FOLDER HANDLE.
- **`'use strict'` в модуле ломает шим AppState.** Убран.
- **Регрессия §A2-v2:** `responseButtons` не был перенесён в app-player-preview.js. Проявился, когда app.js удалили регион, где она ещё была. Фикс: `const responseButtons = document.getElementById('response-buttons')`.
- **Регрессия §A2-v3:** `AppEditorCore.state` имел `get activeNodeId`, но без `set`. AI-генератор (`S.activeNodeId = created[0]`) падал. Фикс: `set activeNodeId(v) { state.activeNodeId = v; }`.


---

## 2026-10-18 — §A2-v7: моргание + камера → app-blink-camera.js

### Решение: 24 функции → отдельный модуль (572 строки)

**Контекст:**
- §A2-v6 закрыт 17.10 (app.js 3903 → 3165).
- BLINK (17 функций, 680–956) + CAMERA (7 функций, 988–1221).

**Решение:** вынести в app-blink-camera.js:
- createEmptyBlinkState (68–90).
- BLINK (17): startBlinkAnimation, stopBlinkAnimation, computeEAR, getBlinkWarningEl, showBlinkWarning, hideBlinkWarning, resetBlinkState, processBlinkFrame, isBlinkResponseBlocked, areEyesClosedNow, ensureBlinkCalibrationUI, startBlinkCalibration, runBlinkCalibrationPhase, finishBlinkCalibration, cancelBlinkCalibration, buildBlinkReport.
- CAMERA (7): loadFaceApiModels, enableCamera, disableCamera, recalcSizesForNewDistance, processVideoFrame, openCalibrationModal, calibrateFocalLength.
- Переменные: _blinkState, _blinkResponseBlockUntil, _blinkCalibration, _waitingForOpenEyes.

**Как:**
- Экспорт window.AppBlinkCamera (24 метода).
- 23 обёртки в app.js + 1 прямая (createEmptyBlinkState на строке 63).
- _blinkState / _blinkResponseBlockUntil / _blinkCalibration / _waitingForOpenEyes — только в BLINK/CAMERA → в модуль.
- _blinkStateLocal — НЕ путать: в AppState (alias 175), отдельная переменная.
- scheduleVoiceCountdown (957–987) — НЕ наш, остаётся в app.js (между BLINK и CAMERA).
- AppPlayerPreview не вызывается из CAMERA — мосты не нужны.

**Результат:**
- app.js: 3165 → 2653 (−512).
- app-blink-camera.js: 572 строки (новый).
- admin.html: <script src="app-blink-camera.js"> после app-scenarios.js.
- sw.js: precache '/app-blink-camera.js'.
- Тесты: 28 passed.
- Коммит: 6189ca5.

**Проблемы по ходу:**
- _blinkState = null в модуле → TypeError: Cannot set properties of null (setting 'lastEAR'). Фикс: let _blinkState = createEmptyBlinkState(); (hoisting function declaration в IIFE работает).
- realIPD_MM is not defined — потеряна при §A1. Фикс: const realIPD_MM = 63; в модуле.
- MAX_DISTANCE_LOG is not defined — потеряна при §A1. Фикс: const MAX_DISTANCE_LOG = 2000; в модуле.
- PowerShell here-string с кириллицей через Set-Content — кракозябры (ANSI). Решение: ASCII-комментарии или .tmp + WriteAllText.

**Следующее:** §A2-v8 (утилиты → app-utils.js).

---

## 2026-10-18 — аудит §A1: восстановление 7 потерянных констант

### Контекст

§A1 (818ee24, 2026-10-15) вынес 90 переменных в app-state.js. При выносе 7 констант потерялись — не попали ни в app.js, ни в AppState (ни в объект state, ни в aliases).

**Проявились только при выносе зависимых регионов (§A2-v7):**
- BLINK_* (5) — при выносе BLINK.
- realIPD_MM — при выносе CAMERA.
- MAX_DISTANCE_LOG — при выносе CAMERA.

**Латентные баги:** processBlinkFrame падал при каждом вызове (но вызывался только при blinkEnabled + камере). distanceLog не обрезался (>2000 рос бесконечно).

### Решение

| Константа | Значение | Где восстановлена | Коммит |
|---|---|---|---|
| BLINK_SHORT_MS | 100 | app-state.js (state + aliases) | 32434bc |
| BLINK_LONG_MS | 400 | app-state.js | 32434bc |
| BLINK_ASYM_RATIO | 0.45 | app-state.js | 32434bc |
| BLINK_AUTOPAUSE_MS | 800 | app-state.js | 32434bc |
| BLINK_BLOCK_MS | 200 | app-state.js | 32434bc |
| realIPD_MM | 63 | app-blink-camera.js | 6189ca5 |
| MAX_DISTANCE_LOG | 2000 | app-blink-camera.js | 249fbde |

**Почему BLINK_* в AppState, а realIPD_MM / MAX_DISTANCE_LOG — в модуле:**
- BLINK_* — клинические пороги, могут настраиваться (через UI) → AppState.
- realIPD_MM / MAX_DISTANCE_LOG — физические/технические константы → в модуль.

**Точные значения** взяты из git show 818ee24^:app.js (до §A1).

### Правило (зафиксировать в PROMPT.md / HOW-TO)

> Аудит констант при выносе региона. Перед выносом — Select-String по всем UPPER_CASE в регионе, проверить, что каждая объявлена в модуле или AppState. Иначе — ReferenceError при первом вызове функции, где константа используется. §A1 потерял 7 констант — проявились через 3 дня при §A2-v7.

**Следующее:** §A2-v8 (утилиты → app-utils.js).

---

## 2026-10-18 — §A2-v9: auth + SW → app-auth.js

### Решение: 15 функций → отдельный модуль (259 строк)

**Контекст:**
- §A2-v7 закрыт 18.10 (app.js 3165 → 2653).
- AUTH (1677–1807) + AUTH-helpers (2403–2501).

**Решение:** вынести в app-auth.js:
- AUTH-ядро (8): initSupabase, signIn, signUp, signOut, updateAuthUI, showAuthModal, registerServiceWorker, showSWUpdateBanner.
- AUTH-helpers (7): encodeCred, decodeCred, saveAuthCreds, prefillAuthCreds, focusAuthField, bindAuthForm, handleAuthSubmit + IIFE installAuthObserver.
- Константы: ADMIN_EMAILS, IS_DEV, LS_LAST_EMAIL, LS_LAST_PASS.
- supabaseClient — локальная в IIFE, window.supabaseClient — мост.

**Как:**
- Экспорт window.AppAuth (15 методов + 2 константы).
- 15 тонких обёрток в app.js перед // START.
- init() (1809–2333) — ОСТАЁТСЯ в app.js (524 строки, 32 DOM-константы, вся инициализация редактора). Вызывает обёртки initSupabase(), registerServiceWorker(), showAuthModal(), signOut().
- window.ADMIN_EMAILS = window.AppAuth.ADMIN_EMAILS — мост.

**Результат:**
- app.js: 2653 → 2441 (−212).
- app-auth.js: 259 строк (новый).
- admin.html: <script src="app-auth.js"> после app-blink-camera.js.
- sw.js: precache '/app-auth.js'.
- Тесты: 28 passed.
- Коммит: c57f8f9.

**Проблемы по ходу:**
- LS_LAST_EMAIL / LS_LAST_PASS — дублировались: в шапке модуля + в AUTH-helpers (2404–2405). Фикс: убрать из шапки, оставить в AUTH-helpers.
- init() — НЕ выносим: 524 строки, 32 DOM-константы, все обработчики редактора, loadUserSettings/loadSivtsevFont/initScreenCalibration (остаются в app.js).

**Следующее:** §A2-v8 (утилиты → app-utils.js).
