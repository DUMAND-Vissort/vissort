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

---

## 2026-10-18 — §A2-v8: утилиты → app-utils.js

### Решение: 29 функций → отдельный модуль (681 строка)

**Контекст:**
- §A2-v9 закрыт 18.10 (app.js 2441 → 1846? нет, 2441 → 1846 после §A2-v8).
- Утилиты: scenario time (487–595), distance warning (597–651), scheduleVoiceCountdown (654–684), animations (685–1115).

**Решение:** вынести в app-utils.js:
- Scenario time (3): estimateScenarioDurationMs, formatDurationMs, showScenarioTimeReport.
- Distance warning (8): updateLiveDistanceIndicator, hideLiveDistanceIndicator, getDistanceWarningEl, showDistanceWarning, hideDistanceWarning, resetDistanceTracking, setDistanceBaselineIfNeeded, evaluateDistanceDeviation.
- scheduleVoiceCountdown (1, мёртвая).
- Animations (17): setStimColorRGB, startCircleAnimation, stopCircleAnimation, getPeripheralLayer, clearPeripheralLayer, stopPeripheralAnimation, buildPeripheralDots, buildDefocusFrame, removeSingleGridLines, drawSingleGridLines, applySingleGridPosition, pickSingleGridCell, applyRandomStimulusPosition, startSingleStimAnimation, stopSingleStimAnimation, startSingleBgAnimation, stopSingleBgAnimation.
- Circle state (8 let): _circleAnimId, _circleAnimStart, _circleInnerPhases, _circleOuterPhases, _circleInnerDurationMs, _circleOuterDurationMs, _circleInnerLoop, _circleOuterLoop.

**Как:**
- Экспорт window.AppUtils (29 методов).
- 29 тонких обёрток в app.js перед §A2-v9: ОБЁРТКИ.
- 8 мостов для app-player-preview.js: startSingleStimAnimation, stopSingleStimAnimation, startSingleBgAnimation, stopSingleBgAnimation, startCircleAnimation, stopCircleAnimation, buildPeripheralDots, buildDefocusFrame + resetDistanceTracking, hideLiveDistanceIndicator.
- 5 мостов для app-blink-camera.js: hideDistanceWarning, updateLiveDistanceIndicator, setDistanceBaselineIfNeeded, evaluateDistanceDeviation, showDistanceWarning.
- switchMode (1520) — ОСТАЁТСЯ в app.js (редактор, 3 вызова).
- PHYSIOLOGICAL_PHASES (1116) — ОСТАЁТСЯ в app.js (алиас).

**Результат:**
- app.js: 2441 → 1846 (−595).
- app-utils.js: 681 строка (новый).
- admin.html: <script src="app-utils.js"> после app-auth.js.
- sw.js: precache '/app-utils.js'.
- Тесты: 28 passed.
- Коммит: cae7e5c.

**Фикс (не §A2-v8):**
- app-generator.js: 4 функции (renderGridPreview, generateCellParamsFields, collectCompareParams, buildModeParamsFromUI) вынесены за `})();` при §A2-v5 — state не видна. Фикс: `const state = window.AppState;` в начало каждой + acuityToSizeMm/acuityToSizePx/hexToRgb из VissortCore.

**Следующее:** §A2-v9b (init + 32 DOM → app-init.js) — отложен (высокий риск). app.js ~1846 — приемлемо.

---

## 2026-10-18 — Фаза 6 MVP: clinic.html + clinic.js

### Решение: клинический редактор (одна клиника, без мультитенантности)

**Контекст:**
- Фаза 5 закрыта 18.10 (app.js 7900 → 1845).
- Цель Фазы 6 — врач задаёт протокол → тренажёр строит сценарий → превью.
- **Мультитенантность не делаем** (пилот — 1 клиника, без `tenants`/`tenant_id`). После пилота — Фаза 7.

**Решение:**
- `clinic.html` (3043) — копия `admin.html` + `#clinic-header` + `#protocol-panel` (5 полей: диоптрии, возраст, тип, время, моргание). **Ничего не удаляли** (AI-генератор, `#btn-test`, sync — как у админа).
- `clinic.js` (107) — header (email врача), «Сгенерировать» → `AppEditor.createNewNode` (STIMULUS / READING) + `node.params`, «Сохранить» → `Data.saveScenario({ doctor_id, ... })`, «Пользователи» → `#users-modal` → `Data.assignScenario`.
- `sw.js` — precache `'/clinic.html'`, `'/clinic.js'`.

**Результат:**
- Коммит: `586f883`.
- Тесты: 34 passed (28 + 6 clinic).

**Проблемы по ходу:**
- `scheduleVoiceCountdown` — удалён в §A2-v8 как «мёртвый», но вызывался из `app-player-preview.js:418`. Восстановлен (коммит `ad95574`).
- Структура `clinic-header` / `protocol-panel` — сначала сломан `</div>` (форма внутри заголовка). Исправлено в `33b5ed8`.

**Следующее:** Space = Play/Pause + max acuity 1.0, tests clinic, мультитенантность (Фаза 7, после пилота).

---

## 2026-10-18 — Space = Play/Pause, max acuity 1.0

### Решение: клавиша Space + ограничение остроты 1.0

**Контекст:**
- В плеерах стрелки (ArrowLeft/Right/Up/Down) — ответы. Play/Pause — нет.
- Острота зрения: max 2.0 / 1.5 (визуально нереалистично). Договорённость — 1.0.

**Решение:**
- `player-runtime.js` (607–612) — `if (e.key === ' ') togglePause()` **до** `if (!PlayerState.responsePhaseActive) return` (работает на паузе).
- `app-player-preview.js` (1089–1097) — Space: если `_readingNodeWaiting` → `toggleReadingPause()`, иначе → `window.AppPlayerPreview.togglePause()`.
- Max acuity 1.0 (было 2.0/1.5) — 7 мест: `app.js:170, 615`, `app-generator.js:750`, `app-player-preview.js:819, 821`, `player-runtime.js:783`.
- **Не трогали:** `MAX_ZOOM = 2.0` (зум), `diopters: 1.5` (диоптрии — не острота).

**Результат:**
- Коммит: `66e6ef7`.
- Тесты: 34 passed.

**Следующее:** tests clinic, мультитенантность (Фаза 7).

---

## 2026-10-18 — tests/clinic.spec.js (6 тестов)

### Решение: Playwright для clinic.html

**Контекст:**
- `clinic.html` (3043) — Фаза 6 MVP. Тестов не было.
- 28 тестов покрывали `admin`, `player`, `user`, `login`, `schema`, `camera`.

**Решение:** `tests/clinic.spec.js` (121, 6 тестов):
- `clinic-header виден`
- `форма протокола видна`
- `сгенерировать → узел на холсте` (`.scenario-node`)
- `сохранить → сценарий в IndexedDB` (`vissort-db`, store `scenarios`)
- `пользователи → модалка`
- `Space = пауза в превью`

**Мок auth (`mockClinicLogin`)** — как в `editor.spec.js`:
- `localStorage.setItem('sb-<ref>-auth-token', session)` — **ключевой** (без него `getSession()` → null → `#auth-modal` открыт → click перехвачен).
- `page.route('**/auth/v1/**')` + `page.route('**/rest/v1/**')`.
- Калибровка в `vissort_device_calib` (`test-fp`).
- `waitForSelector('#main-layout')` (не `#clinic-header`).

**Фикс `login.spec.js:33`** (`неверный пароль`):
- Мок auth (400 `invalid_grant`).
- `page.goto('/admin.html', { waitUntil: 'domcontentloaded', timeout: 60000 })`.

**Результат:**
- Коммит: `8386699`.
- Тесты: **34 passed** (28 + 6).
- `login.spec.js` — 3 passed (было 1 failed timeout).

**Следующее:** мультитенантность (Фаза 7, после пилота).

---

## 2026-10-18 — авто-дерево Vissort/Сценарии (папка primary)

### Решение: сохранять в папку primary, IndexedDB — кэш, облако — синхронизация

**Контекст:**
- Пилот с врачом → нужна предсказуемая папка (D:\\Vissort\\Сценарии).
- Сейчас: `btn-select-folder` → `showDirectoryPicker` → `selectedFolderHandle` → `writeFileToFolder`.
- Проблема: врач выбирает папку вручную каждый раз (или забывает). Файлы разбросаны.

**Решение:**
- `ensureVissortTree()` (app-scenarios.js, 360) — 1 раз выбирает корень (D:) → создаёт `Vissort/Сценарии` (`getDirectoryHandle('Vissort', { create: true })` → `getDirectoryHandle('Сценарии', { create: true })`) → handle в IndexedDB (`vissortRootHandle`).
- `saveGraph` (447) — папка primary (через `ensureVissortTree`), потом `Data.saveScenario` (IndexedDB + syncQueue → облако). Fallback — `<a download>` (если папки нет / FS Access не поддерживается).
- `btn-select-folder` / `btn-select-templates-folder` / `#folder-status` / `#templates-folder-status` — скрыты CSS (display: none).

**Результат:**
- Коммиты: `0608403` (saveGraph), `c43c3d5` (CSS clinic).
- Тесты: 36 passed + 1 skipped.

**Проблемы по ходу:**
- Патч по номерам строк сломал `scanScenariosFolder` (вставился не туда). Правило: искать функцию (`async function saveGraph`), внутри неё — anchor. Не по номерам.
- `let savedToFolder` — вставка в чужую функцию → SyntaxError. Откат + патч по функции — сработал.

**Следующее:** `loadScenarioList` (папка primary), `restoreFolderHandle` (vissortRootHandle).

---

## 2026-10-18 — скрытие кнопок (btn-open, btn-select-folder) + импорт в Библиотеку

### Решение: одна кнопка «Библиотека» — хаб (список + импорт)

**Контекст:**
- Дубли: `btn-open` (📂 файл) vs `btn-select-folder` (📁 папка) vs `btn-library` (📚 список).
- Врачу непонятно: три кнопки → три источника сценариев.

**Решение:**
- `btn-open` — скрыт (CSS `display: none`, admin + clinic).
- `btn-select-folder` / `btn-select-templates-folder` / `folder-status` / `templates-folder-status` — скрыты (CSS).
- `#btn-library-import` — добавлена в `#library-modal` → `fileInput.click()` (импорт файла в модалке).
- `#library-modal` — единая точка входа: список (IndexedDB + облако) + импорт файла.

**Результат:**
- Коммит: `2c01ff6` (admin + clinic + app.js).
- Тесты: 36 passed + 1 skipped.

**Следующее:** `loadScenarioList` (папка primary) — следующий шаг.

---

## 2026-10-18 — фикс Библиотеки: загрузка сценария → холст

### Решение: `switchMode('nodes')` + `requestRenderGraph` + `updateInspector`

**Контекст:**
- «Библиотека» → «Загрузить» — сценарий загружался в `trainingNode` + `nodes` / `connections`, но холст не обновлялся.
- Причина: не было `switchMode('nodes')` (если был режим «Стимулы» — холст скрыт) + не было `updateInspector()` (инспектор пуст).

**Решение:**
- `loadScenarioList` (app-scenarios.js, 774–789) — после загрузки узлов:
  - `switchMode('nodes')` — переключить в режим узлов.
  - `requestRenderGraph()` — отрисовать.
  - `updateInspector()` — обновить инспектор.

**Результат:**
- Коммит: `927be46`.
- Тесты: 36 passed + 1 skipped.

**Проверка локально:** `clinic.html?nocache=1` → Создать узел → Сохранить → Новый → Библиотека → Загрузить → холст обновился.

**Следующее:** `loadScenarioList` (папка primary) — следующий шаг.

---

## 2026-10-18 — закрытие авто-дерева: restoreFolderHandle + loadScenarioList

### Решение: primary-папка читается и при загрузке списка, не только при сохранении

**Контекст:**
- §vissort-tree: saveGraph писал в Vissort/Сценарии (vissortRootHandle).
- restoreFolderHandle (330) читал старый ключ scenariosFolderHandle → selectedFolderHandle указывал не туда.
- loadScenarioList брал только Data.getScenarios() — файлы из папки не попадали в список, пока их не импортировали вручную.

**Решение:**
- restoreFolderHandle (330–363): primary — vissortRootHandle → getDirectoryHandle('Vissort') → getDirectoryHandle('Сценарии'); fallback — scenariosFolderHandle (legacy). selectedFolderHandle = конечная папка. folderStatus = "📁 Сценарии".
- loadScenarioList (~761): перед Data.getScenarios() — if (HAS_FS_ACCESS && selectedFolderHandle) await scanScenariosFolder(). scanScenariosFolder импортирует .json в IDB (id = 'local_' + key), дальше getScenarios() отдаёт объединённый список (папка + IndexedDB + облако).

**Почему не меняли scanScenariosFolder:** side-effect на IDB уже корректен (id local_<key> — тот же, что даёт buildScenarioPayloadFromCurrent). Дедуп делает Data.saveScenario по id.

**Грабли (для следующих правок):**
- После P1 файл вырос на 16 строк — старые номера строк (745/750) устарели → P2 отрезал живые функции. Правило: после каждого патча перепроверять Select-String по anchors, а не по номерам.
- node --check не понимает .tmp (ERR_UNKNOWN_FILE_EXTENSION) — копировать в .check.js.
- await в не-async — верный признак, что async function ... попал в отрезанный диапазон.

**Результат:**
- Коммиты: 7a22322 (restore), 60d4eb9 (loadScenarioList).
- Тесты: 36 passed + 1 skipped.
- Файлы: app-scenarios.js (+22/−6, +8/−0).

**Следующее:** мультитенантность (Фаза 7, после пилота).

---

## 2026-10-19 — сессия: P0 preview, ?test=1, TDZ, флак, PLAYER-UNIFY-PLAN закрыт

### P0: handleDirectionAnswer в preview не продвигает серию (af6b918)

**Контекст:** preview-плеер (app-player-preview.js) ≠ prod (player-single.js). В preview не было finishSeries/showNextStimulus в хвосте handleDirectionAnswer.

**Решение:** добавить продвижение серии, saveResult, очистку таймеров, гашение анимаций.

**Почему P0 клинический:** врач тестирует протокол → ответ не принимается → «залипает» → ложное впечатление, что методика не работает.

**Результат:** 36 passed + 1 skipped.

### P0: ?test=1 не стартовал превью из клиники (9114a84)

**Контекст:** onLoggedIn в ?test=1 требовал currentUser → guard падал.

**Решение:** фиктивный currentUser + guard в onLoggedIn.

**Почему:** клиника не могла прогнать протокол без реальной сессии.

**Грабли:** ?test=1 работает только в player.html (requireDomain: false), не в admin.html/clinic.html. Проверять на player.html?test=1.

### P1: restoreFolderHandle падал при старте (0ba47ae)

**Контекст:** getDirectoryHandle(..., { create: true }) при старте без user gesture → SecurityError/NotAllowedError.

**Решение:** не создавать папку при старте — только восстанавливать; create — по user gesture.

**Грабли:** create требует user gesture — неочевидно из MDN, выяснилось через консоль.

### P1: app-inspector.js TDZ (d5ac185)

**Контекст:** const v объявлена после использования (после §A2-v4).

**Решение:** переместить const v до первого использования.

**Грабли:** TDZ невидим для node --check — проявляется в рантайме при первом вызове.

### P2: флак ai-generator.spec.js (03331fc)

**Контекст:** count() возвращает 0 до рендера.

**Решение:** waitForFunction + expect.poll.

**Правило:** не count() в assertions — expect.poll с таймаутом.
### PLAYER-UNIFY-PLAN — создан и закрыт (ed21222…3be760a, af6b918)

**Контекст:** дублирование app-player-preview.js ↔ player-single.js, 10 функций-кандидатов.

**Разведка 2026-10-19:** 0 функций к унификации — все специфика платформы (AppState vs PlayerState).

- showNextStimulus, finishSeries в preview — специфика (blinkLockShow, buildBlinkReport, адаптивная острота).
- displayStimulus/hideStimulus — идентичны, дублирование безвредно.
- createCellElement/defaultCellParams — адаптация state.
- Группа сравнения (showDirectionComparison/showFindSameComparison/handleFindSameClick) — by design.

**Итог:** единственный реальный баг — handleDirectionAnswer — закрыт af6b918.

**Полная унификация** (preview → PlayerState, подключение player-single.js в admin/clinic) — Фаза 8, отдельно.
### Грабли сессии (сводка)

- serve редиректит .html → 404. http-server для локального стенда (npx --yes http-server -p 5500 -c-1).
- Номера строк после патча сдвигаются → anchors (Select-String), не номера.
- node --check не ест .tmp → .check.js.
- expect.poll / waitForFunction вместо count().
- Here-string @'...'@ в PS 7.6.6 зависает на длинных текстах → Add-Content блоками по 20–30 строк.
### Отложено (с причиной)

- **§A2-v9b** (init → app-init.js) — высокий риск, init() (524 строки, 32 DOM-константы) не покрыт тестами. app.js ~1850 — приемлемо.
- **Фаза 7** (мультитенантность) — продуктовое решение, не техническая опасность. Пилот — 1 клиника. Триггер — второй заказчик.
### §7/§13.1.3 — уточнение по дистанции (разведка 2026-10-19)

Не «три системы дистанции», а «2 системы дистанции + 1 система наклона»:

- **PlayerDistance** (player-distance.js:91) — единый для плеера/камеры (player-camera.js:196, 464, 480; player-single.js:115; player-graph.js).
- **app.js:1606–1607** (setDistanceBaselineIfNeeded, evaluateDistanceDeviation) — своя, редактор.
- **player-invalid-detection.js:77** (_recordDeviation, _deviationHistory) — наклон, не дистанция.

§13.1.3 — «частично закрыто: PlayerDistance создан, плеер/камера используют; app.js — нет (низкий приоритет); PlayerInvalidDetection — отдельно (наклон)».

---

## 2026-10-24 — Живой стимул (v19): палитра + голос (mp3)

### Решение: colorTable в плеере + mp3-фразы + _speaking + startWhenVoiceDone

**Контекст:**
- «Живой стимул» (node.params.stimulusDynamic) в preview-плеере (app-player-preview.js) показывал красный → зелёный, а редактор — жёлтый → синий (colorTable OKLCH). Палитры разные.
- Голос «Приготовьтесь» обрывался («приг», «гот», «приго») — Online-голоса Microsoft (Светлана/Дмитрий Natural) стриминговые, глотают короткие фразы. speechSynthesis.speaking зависает в true навсегда, onend не срабатывает.

**Решение:**
1. **Палитра:** в playDynamicStimulus (app-player-preview.js) заменить линейный RGB на интерполяцию window.AppStimulusEditor.colorTable (плавно между соседними индексами, i0/i1/frac).
2. **Голос (путь A):** 21 mp3 в assets/voice/<key>.mp3 (Google Translate TTS, tl=ru). В voice.js sayKey(key) играет mp3 через new Audio(), fallback на speechSynthesis (только onerror/play().catch, без setTimeout(300) — он давал race: TTS перебивал mp3).
3. **Флаг _speaking:** в voice.js say() ставит _speaking = true перед speak, onend/onerror/setTimeout(2500) → false. В sayKey mp3: onplay → true, onended → false.
4. **startWhenVoiceDone** (app-player-preview.js): ждёт !window.Voice._speaking (вместо зависшего speechSynthesis.speaking), guard 3000 мс. animateColor запускается после голоса.

**Почему mp3, а не TTS:** Online-голоса стриминговые, глотают короткие фразы, зависают в speaking: true. Локальных русских SAPI-голосов нет (local: false у обоих). mp3 — офлайн, без стриминга, без задержки, кешируется SW.

**Результат:** preview-плеер: цвет жёлтый → синий (colorTable), время 20 сек, «Приготовьтесь» стабильно (mp3), круг после голоса. Тесты 36+1.

**Не сделано (следующее):**
- player-graph.js (player.html) — там упрощённая версия без colorTable/startWhenVoiceDone.
- sw.js — precache assets/voice/*.mp3.
- Несколько кадров (frames.length > 1), repeats, step, mode — играет только frames[0].

**Файлы:** app-player-preview.js, voice.js, assets/voice/*.mp3 (21), docs/TODO.md (техдолг закрыт).

---
*Составлено: 2026-10-19. HEAD: ec72341. Тесты: 36 passed + 1 skipped.*
