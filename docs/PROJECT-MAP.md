# Vissort — карта проекта (PROJECT-MAP)

> Полная карта архитектуры после Фаз 0–4.
> Актуально на: 2026-10-11.
> Связанные документы: HOW-TO-NEW-CHAT.md, PLAN.md, TODO.md, DEPLOY.md.
> Устаревшее: ARCHITECTURE.md (до Фазы 1), HANDOFF.md (до 10.10.2026).

---

## Оглавление

- §1. Оглавление модулей
- §2. Архитектура (графы зависимостей)
- §3. Реестр модулей
- §4. Публичные API (`window.*`)
- §5. Callbacks-контракты
- §6. Реестр глобалов и ad-hoc состояния
- §7. Три системы дистанции
- §8. Дублирование кода
- §9. Порядок загрузки скриптов
- §10. Различия user/player/admin
- §11. Хвосты миграции Фазы 4
- §12. Критические баги
- §13. Техдолг
- §14. Покрытие тестами
- §15. План Фаз 5–6
- §16. История исправлений (сессия после Фазы 4)
- Приложение А. Сводная таблица файлов

---
## §1. Оглавление модулей

### Ядро
| # | Файл | Размер | Строк |
|---|---|---|---|
| 1 | `vissort-core.js` | 16.5 KB | ~440 |
| 2 | `voice.js` | 25.4 KB | ~750 |
| 3 | `data-layer.js` | 40.2 KB | ~1030 |

### Модули плеера (Фаза 1)
| # | Файл | Размер | Строк |
|---|---|---|---|
| 4 | `player-state.js` | ~5 KB | ~180 |
| 5 | `player-utils.js` | ~3 KB | ~90 |
| 6 | `player-dist-warning.js` | ~2 KB | ~60 |
| 7 | `player-reading.js` | ~5 KB | ~180 |
| 8 | `player-camera.js` | ~14 KB | ~480 |
| 9 | `player-animation.js` | ~18 KB | ~530 |
| 10 | `player-invalid-detection.js` | ~8 KB | ~180 |

### Онбординг / device / AI
| # | Файл | Размер | Строк |
|---|---|---|---|
| 11 | `vissort-onboarding.js` | ~12 KB | ~330 |
| 12 | `vissort-device.js` | ~10 KB | ~290 |
| 13 | `vissort-ai-generator.js` | ~12 KB | ~300 |
| 14 | `header-drag.js` | ~4 KB | ~150 |
| 15 | `keepalive.js` | ~5 KB | ~180 |
| 16 | `sw.js` | 9 KB | ~290 |

### Плеер (главный)
| # | Файл | Размер | Строк |
|---|---|---|---|
| 17 | `player-runtime.js` | 116.2 KB | 2978 |

### Редактор
| # | Файл | Размер | Строк |
|---|---|---|---|
| 18 | `app.js` | ~250 KB | 4690 |

### HTML + entry
| # | Файл | Размер | Строк |
|---|---|---|---|
| 19 | `user.html` | ~30 KB | ~700 |
| 20 | `player.html` | ~32 KB | ~740 |
| 21 | `admin.html` | ~184 KB | 3020 |
| 22 | `user.js` | 0.15 KB | 2 |
| 23 | `player.js` | 0.15 KB | 2 |

### Тесты
| # | Файл | Тестов |
|---|---|---|
| 24 | `tests/camera.spec.js` | 4 |
| 25 | `tests/editor.spec.js` | 5 |
| 26 | `tests/login.spec.js` | 3 |
| 27 | `tests/offline.spec.js` | 5 |
| 28 | `tests/player.spec.js` | 4 |
| 29 | `tests/reading.spec.js` | 5 |
| 30 | `tests/schema.spec.js` | 2 |

**Итого:** 30 JS/HTML-файлов + 7 spec-файлов = **37 файлов**, ~400 KB JS.

---
## §2. Архитектура (графы зависимостей)

ASCII-графы вместо mermaid — устойчивы к копипасту.
Для mermaid-версии см. `docs/ARCHITECTURE-DIAGRAMS.md`.

### §2.1 Общий граф загрузки
┌──────────────────────────────────────────────────┐
│ HTML │
│ user.html player.html admin.html │
└──────┬───────────┬────────────┬──────────────────┘
│ │ │
▼ ▼ ▼
user.js player.js app.js
│ │ │
└─────┬─────┘ │
▼ │
┌──────────────────────┐ │
│ Ядро │ │
│ vissort-core.js │◄─────┤
│ voice.js │ │
│ data-layer.js │ │
└──────────┬───────────┘ │
│ │
▼ ▼
┌──────────────────────┐ ┌──────────────────┐
│ Плеер │ │ Редактор │
│ player-state.js │ │ header-drag.js │
│ player-camera.js │ │ keepalive.js │
│ player-animation.js │ │ ai-generator.js │
│ player-invalid-.js │ └──────────────────┘
│ player-utils.js │
│ player-dist-.js │
│ player-reading.js │
│ player-runtime.js │
└──────────────────────┘
│
▼
┌──────────────────────┐
│ sw.js (Service W.) │
└──────────────────────┘
│
▼ HTTPS
┌──────────────────────┐
│ Supabase │
│ Auth · PostgreSQL │
│ Edge Functions │
└──────────────────────┘

text

### §2.2 Граф плеера
player.html / user.html
│
▼
vissort-core.js ◄───────┐
│ │
▼ │
player-state.js │
│ │
┌────┼────┬────┬────┐ │
▼ ▼ ▼ ▼ ▼ │
PC PA PI PU PD
│ │ │ │
└────┼────┘ │
│ callbacks │
▼ │
player-runtime.js ──────┘
│
┌────┼────┬────┐
▼ ▼ ▼ ▼
DL Voice O V

Обозначения:
PC = player-camera.js
PA = player-animation.js
PI = player-invalid-detection.js
PU = player-utils.js
PD = player-dist-warning.js
DL = data-layer.js
O = vissort-onboarding.js
V = vissort-device.js

text

### §2.3 Граф редактора
admin.html
│
├──► vissort-core.js
├──► data-layer.js
├──► voice.js
├──► keepalive.js
│
└──► app.js
│
├──► header-drag.js
│
└──► window.AppEditorCore
│
▼
vissort-ai-generator.js
│
▼
Edge: generate-scenario
│
▼
DeepSeek API

text

### §2.4 Внешние сервисы
┌──────────────────────────────────────────┐
│ Клиент браузера │
└───┬────────────┬────────────┬────────────┘
│ │ │
│ HTTPS │ tunnel │ POST JWT
▼ ▼ ▼
┌────────┐ ┌──────────┐ ┌───────────────┐
│Supabase│ │sentry- │ │generate- │
│ │ │proxy │ │scenario │
│ Auth │ └────┬─────┘ └──────┬────────┘
│ PG │ │ │
│ Edge │ ▼ ▼
│Realtime│ sentry.io DeepSeek API
└────────┘

CDN (cdn.jsdelivr.net):

face-api.js (weights)

@supabase/supabase-js

jszip

Sivtsev OTF (шрифт)
## §3. Реестр модулей

Формат: **файл → назначение → публичный интерфейс → блок разбора (#N)**.

### 3.1 Ядро

**`vissort-core.js`** — общие утилиты без DOM. Экспорт: `window.VissortCore`. Ключевые группы: acuity (3 функции), time (3), colors (3), phases (2), SVG (4), utils (6). Зависит только от `window`, `document`, `localStorage`. Используют: `app.js`, `player-runtime.js`, все модули плеера. **Блок #1.**

**`voice.js`** — Web Speech API. Экспорт: `window.Voice`. Публичное: `say`, `sayKey`, `mute`, `toggle`, `setRate/Voice/Volume`, `readText`, `pauseReading`, `stopReading`. Автосоздаёт `#btn-voice` и `#voice-reading-bar`. Зависит от `speechSynthesis`, LS. **Блок #2.**

**`data-layer.js`** — IndexedDB + Supabase REST + syncQueue. Экспорт: `window.Data`. 9 stores в IDB. REST-клиент `sbFetch`. Очередь с авто-синхронизацией каждые 30 с. `MAX_RETRIES=5`, `QUEUE_BATCH=10`. **Блок #3.**

### 3.2 Модули плеера

**`player-state.js`** — единый объект `window.PlayerState`. ~150 полей. Плоский, без методов. Три IIFE-инициализатора: `loadPPI`, `_minDetectPct`, `focalLengthPx`. **Блок #4.**

**`player-utils.js`** — `checkRateLimit`, `validateScenario`, `effectiveDistance`, `smoothDistance`. Экспорт: `window.PlayerUtils`. Rate-limit 100/мин. `window._distEMA` — глобальная переменная. **Блок #5.**

**`player-dist-warning.js`** — два баннера дистанции: `#dist-warning` (мягкий, 4.5 с) и `#dist-hard-banner` (жёсткий). Публичное: `showDistWarning`, `showDistHardBanner`, `hideDistHardBanner`. **Блок #6.**

**`player-reading.js`** — фон чтения (solid/split/gradient/dynamic). Экспорт: `window.PlayerReading`. Приватное состояние `_state` в замыкании. **Дублирует `PlayerState.readingBgAnimId`.** **Режим `physiological` НЕ поддерживается** (в отличие от `app.js`). **Блок #7.**

**`player-camera.js`** — камера, face-api, EAR, дистанция. Экспорт: `window.PlayerCamera`. Callbacks: `onStimulusHide`, `onAbortStimulus`, `onResume`, `onRecalcSize`. Глобалы: `camStats`, `_camDetecting`, `_faceLostSince`, `_fastLeanAt`, `_baselineWaitStart`. Backend: WASM → CPU fallback. TinyFaceDetector inputSize=320, scoreThreshold=0.25. **Блок #8.**

**`player-animation.js`** — 7 типов анимаций: stim, bg, blink, circle, peripheral, defocus, grid. Экспорт: `window.PlayerAnimation`. Callback: `onSetStimColor`. **RAF-анимации не восстанавливаются после паузы.** **Нет `stopAll()`.** **Блок #9.**

**`player-invalid-detection.js`** — детекция наклона и аннулирование. Экспорт: `window.PlayerInvalidDetection`. Callbacks: `onHideStimulus`, `onPlayGraphStimulus`, `onPlayGraphCompareRound`, `onShowNextStimulus`, `onGetNode`. Глобалы: `_deviationHistory`, `_invalidAnswerCount`, `_lastLeanLogAt`. **3 мёртвые константы.** **Блок #10.**

### 3.3 Онбординг / device / AI

**`vissort-onboarding.js`** — мастер калибровки в 2 шага (PPI + камера). Экспорт: `window.Onboarding.start(opts)` / `restart()`. Работает через `window.VissortDevice`. **`ensureDevice()` не защищён** → TypeError при отсутствии. **Блок #11.**

**`vissort-device.js`** — fingerprint (SHA-1) + калибровка. Экспорт: `window.VissortDevice`. Ключ LS: `vissort_device_calib`, составной `fp|userId`. Облако: `device_calibrations` с `onConflict: 'user_id,fingerprint'`. **Блок #12.**

**`vissort-ai-generator.js`** — DeepSeek через Edge Function. Экспорт: `window.AIGenerator`. Публичное: `openModal`, `generate`, `buildPrompt`, `createNodesFromAI`. Требует `window.AppEditorCore`. Лимит 20/час на user_id (на стороне Edge). **Блок #13.**

**`header-drag.js`** — перетаскивание кнопок шапки ПКМ. LS: `vissort_header_order`. **Порядок между секциями не сохраняется.** Только mouse, без touch. **Блок #14.**

**`keepalive.js`** — кнопка 📡 для Supabase. GET `training_sessions?select=id&limit=1`. LS: `vissort_keepalive_ts`. Авто-пинг при простое ≥2.5 дней. **5-я копия anon-ключа.** **Блок #15.**

**`sw.js`** — Service Worker. `CACHE_VERSION = 'vissort-v34'`. Три кэша: static, runtime, supabase. **Не precache'ит `vissort-core.js` и модули плеера** → офлайн сразу после install сломан. **Sentry-паттерны в `NEVER_CACHE_PATTERNS` мертвы** (проверка pathname вместо hostname). **Блок #16.**

### 3.4 Плеер (главный)

**`player-runtime.js`** — вся логика плеера. 2978 строк, 2 части. Экспорт: `window.PlayerState` (использование), `window.AppEditorCore` НЕТ (это app.js). Внутри IIFE. Функции: `initSupabase`, `onLoggedIn`, `loadUserScenarios`, `startPlayer`, `playNextGraphNode`, `playGraphStimulus`, `playGraphReading`, `playGraphCompare`, `handleDirectionAnswer`, `handleCompareAnswer`, `saveResult`, `scheduleVoiceCountdown`, `init`. **Блоки #17 (ч.1), #18 (ч.2).**

### 3.5 Редактор

**`app.js`** — редактор сценариев. 7877 строк, 4 части. Экспорт: `window.AppEditorCore` (в конце), `window.VissortPlayerOptions` (читает). Функции: `createNewNode`, `deleteNode`, `requestRenderGraph`, `updateInspector`, `applyReadingBackground`, `startPlayer`, `playNodesSequence`, `saveGraph`, `loadGraph`, `migrateScenario`, `initSupabase`, `updateAuthUI`, `init`. **Блоки #19–22.**

### 3.6 HTML / entry

**`user.html`** — плеер пациента. CSP строгая, `frame-ancestors 'none'`. `user.js` без `defer`. Модули плеера с `defer`. `.btn-resp`. **Нет `#auth-name`**. **SW не регистрируется.** **Блок #23.**

**`player.html`** — плеер для разработчика. CSP строже (`Referrer-Policy: no-referrer`, `form-action 'none'`, `img-src` без `https:`). `player.js` с `requireDomain: true`. **`#v-detect`, `#stim-cam-block`** — dev-индикаторы. Меню игр управляется `showGamesMenu`. **Блок #24.**

**`admin.html`** — редактор. CSP **без `frame-ancestors 'none'`**. **Все скрипты без `defer`.** Модалки через `style.display`. **`.btn-response`**. `#auth-name`, `#btn-test`, `#btn-ai-generator`, `#ai-generator-modal`, `#sync-chip`, `#sync-banner`, `#queue-modal`, `#font-picker-modal` — **только здесь**. **Блоки #26, #27.**

**`user.js`** — `window.VissortPlayerOptions = { requireDomain: false, showGamesMenu: true }`. **Блок #25.**

**`player.js`** — `{ requireDomain: true, showGamesMenu: false }`. **Инверсия относительно user.** **Блок #25.**

### 3.7 Тесты

7 spec-файлов, **28 тестов**, покрытие **~35 % реального**. **Блок #28.**

---
## §4. Публичные API (`window.*`)

### §4.1 Глобальные неймспейсы

| Неймспейс | Файл | Назначение |
|---|---|---|
| `window.VissortEnv` | `vissort-env.js` | SUPABASE_URL, ANON_KEY — единый источник |
| `window.VissortCore` | `vissort-core.js` | 24 функции утилит |
| `window.Voice` | `voice.js` | Web Speech API |
| `window.Data` | `data-layer.js` | IndexedDB + Supabase + очередь |
| `window.PlayerState` | `player-state.js` | ~150 полей состояния плеера |
| `window.PlayerUtils` | `player-utils.js` | 4 функции плеера |
| `window.PlayerCamera` | `player-camera.js` | камера и face-api |
| `window.PlayerAnimation` | `player-animation.js` | 7 типов анимаций |
| `window.PlayerDistWarning` | `player-dist-warning.js` | баннеры дистанции |
| `window.PlayerInvalidDetection` | `player-invalid-detection.js` | детекция наклона |
| `window.PlayerReading` | `player-reading.js` | фон чтения |
| `window.VissortDevice` | `vissort-device.js` | fingerprint + калибровка |
| `window.Onboarding` | `vissort-onboarding.js` | мастер калибровки |
| `window.AIGenerator` | `vissort-ai-generator.js` | DeepSeek-генератор |
| `window.AppEditorCore` | `app.js` | API редактора для AI |
| `window.VissortPlayerOptions` | `user.js` / `player.js` | конфиг плеера |

### §4.1.1 `window.VissortEnv`

- **Назначение:** единый источник env-констант (URL и anon-ключ Supabase).
- **Загружается:** первым, до `vissort-core.js` (в `admin.html` — sync, в `user.html` / `player.html` — defer).
- **Поля:** `SUPABASE_URL` (string), `SUPABASE_ANON_KEY` (string).
- **История:** §11.2 — замена 5 копий ключа на один источник.
### §4.2 `window.VissortCore`

- **Константы:** `TIME_UNITS`, `DIR`
- **Acuity:** `acuityToSizeMm`, `acuityToSizePx`, `acuityToFontSizePx`, `detectDeviceType`, `detectPPIHeuristic`, `loadPPI`
- **Time:** `msToUnit`, `unitToMs`, `detectUnit`
- **Colors:** `hexToRgb`, `rgbToHex`, `lerpColor`
- **Phases:** `buildGenericDynamicPhases`, `buildCirclePhases`
- **SVG:** `generateLetterE`, `generateLandoltRing`, `getCircleStimulusSVG`, `getStimulusSVG`
- **Utils:** `escapeHtml`, `getThreshold`, `randomDirection`, `hashCode`, `sha1`, `flashCell`
### §4.3 `window.Data`

- **Служебное:** `init`, `ready` (Promise), `onChange`, `setAuth`, `clearAuth`, `getCurrentUserId`, `getStatus`, `getDb`, `uuid`, `now`, `nowIso`, `stripLocalFlags`, `isOnline`, `pingCloud`
- **Очередь:** `flush`, `getQueue`, `getQueueSize`, `clearQueue`, `removeQueueItem`, `getQueueItem`, `resetQueueItem`
- **Settings:** `setSetting`, `getSetting`, `deleteSetting`
- **Scenarios:** `getScenarios`, `getScenariosLocal`, `getScenarioById`, `saveScenario`, `deleteScenario`
- **Templates:** `getTemplates`, `getTemplatesLocal`, `saveTemplate`, `deleteTemplate`, `bulkImportTemplates`
- **Users:** `getUsers`, `getUsersLocal`
- **Assignments:** `getAssignments`, `assignScenario`
- **Results:** `saveResult`, `getResultsLocal`
- **Folders:** `saveFolderHandle`, `getFolderHandle`, `scanFolder`, `writeFileToFolder`, `ensurePermission`
- **Export/Import:** `exportAll`, `importAll`, `getDirtyCount`
### §4.4 `window.Voice`

- **Состояние:** `enabled`, `voiceName`, `rate`, `volume`, `readingRate`, `reading`
- **Речь:** `say(text, opts)`, `sayKey(key, opts)`, `cancel()`
- **Настройки:** `mute`, `toggle`, `setVoice`, `setRate`, `setVolume`, `setReadingRate`, `listVoices`
- **Чтение:** `readText`, `pauseReading`, `resumeReading`, `stopReading`, `nextSentence`, `prevSentence`, `jumpToSentence`, `isReading`, `isReadingPaused`, `readReadingContent`
### §4.5 `window.PlayerState`

Плоский объект, ~150 полей. Группы: чтение, экран/дистанция, auth, управление плеером, ответы, face detection, стабилизация, моргание, граф, камера, чтение (состояние), анимации стимула/круга/периферии/моргания, сравнение, текущий стимул, серия. **Методов нет.**
### §4.6 `window.PlayerCamera`

- `setCallbacks(cb)` — контракт: `{onStimulusHide, onAbortStimulus, onResume, onRecalcSize}`
- `enableCamera`, `disableCamera`, `startCamLoop`, `processCamFrame`, `evaluateDistance`, `_checkHardLimit`
- Экспортированные внутренние: `_faceEmoji`, `_pushDetection`, `_updateDetectUI`, `_detectRatePct`, `_isBlinkFromLandmarks`, `_calcEAR`
### §4.7 `window.PlayerAnimation`

- `setCallbacks(cb)` — контракт: `{onSetStimColor(r,g,b)}`
- `startSingleStimAnimation`, `stopSingleStimAnimation`
- `startSingleBgAnimation`, `stopSingleBgAnimation`
- `startBlinkAnimation`, `stopBlinkAnimation`
- `startCircleAnimation`, `stopCircleAnimation`
- `stopPeripheralAnimation`, `buildPeripheralDots`
- `buildDefocusFrame`
- `removeSingleGridLines`, `drawSingleGridLines`, `applySingleGridPosition`, `pickSingleGridCell`, `applyRandomStimulusPosition`
### §4.8 `window.PlayerInvalidDetection`

- `setCallbacks(cb)` — контракт: `{onHideStimulus, onPlayGraphStimulus, onPlayGraphCompareRound, onShowNextStimulus, onGetNode}`
- `_abortCurrentStimulus(reason)`
- `_resumeAfterStable()`
- `_recordDeviation(pct)`
- `_isAnswerInvalid()` → `'fast_lean' | 'off_distance' | null`
- `_markAnswerInvalid(reason)`
- `_updateStimulusDim()`
- `_showInvalidToast(text)`
### §4.9 `window.PlayerReading`

- `applyBackground(p, viewportEl)`
- `startDynamicBg(p, viewportEl, isPausedGetter)`
- `stopDynamicBg()`
### §4.10 `window.PlayerUtils`

- `checkRateLimit()` → bool (лимит 100/мин)
- `validateScenario(scenario)` → bool
- `effectiveDistance(declared, curDist)` → number
- `smoothDistance(raw)` → number (EMA α=0.5, состояние в `window._distEMA`)
### §4.11 `window.VissortDevice`

- `getFingerprint()` → Promise<string>
- `getDeviceLabel()` → string
- `loadLocal`, `saveLocal`, `getForCurrent`, `setCurrent`, `getCurrentUserId`, `hasCalibrationForCurrent`, `clearCurrent`, `apply`
- `saveCloud`, `listCloud`, `loadCloudByFingerprint`, `deleteCloud`
### §4.12 `window.Onboarding`

- `start({client, userId, onDone})` → Promise
- `restart()` → Promise
### §4.13 `window.AIGenerator`

- `openModal()`
- `generate()` → Promise
- `buildPrompt(p)` → string
- `createNodesFromAI(data)` → number
### §4.14 `window.AppEditorCore`

Экспортируется в `app.js` после `init()`:
- `createNewNode(type, x, y)` → id
- `getNode(id)` → node | undefined
- `requestRenderGraph()`
- `updateInspector()`
- `defaultCompareCellParams()` → object
- `state` — геттеры `nodes`, `connections`, `activeNodeId`; сеттер `activeNodeId`
### §4.15 `window.VissortPlayerOptions`

Устанавливается в `user.js` / `player.js`:
FORMAT: requireDomain (boolean), showGamesMenu (boolean)

user.js:   requireDomain=false, showGamesMenu=true
player.js: requireDomain=true,  showGamesMenu=false

---
## §5. Callbacks-контракты

Три модуля плеера взаимодействуют с `player-runtime.js` через `setCallbacks`. Контракт не задокументирован в коде — только в этом документе.

### §5.1 `PlayerCamera.setCallbacks`

Регистрируется в `player-runtime.js` (ч.2, `init()`, ~строка 2530).

| Callback | Сигнатура | Кто вызывает в `player-camera.js` |
|---|---|---|
| `onStimulusHide` | `() => void` | при отклонении дистанции от baseline |
| `onAbortStimulus` | `(reason) => void` | `face_lost` / `deviation_near` / `deviation_far` |
| `onResume` | `() => void` | после стабилизации дистанции (5 кадров, разброс < 3 %, 1 с) |
| `onRecalcSize` | `() => void` | при `distControlMode === auto` |

Реализация в runtime:

    window.PlayerCamera.setCallbacks({
        onStimulusHide: hideStimulus,
        onAbortStimulus: (reason) => _abortCurrentStimulus(reason),
        onResume: () => _resumeAfterStable(),
        onRecalcSize: () => _recalcStimulusSize()
    });

Хрупкость: регистрация вложена в проверку `PlayerCamera.setCallbacks`. Если `PlayerCamera` не загружен — `PlayerAnimation` и `PlayerInvalidDetection` тоже не получат callbacks.

### §5.2 `PlayerAnimation.setCallbacks`

| Callback | Сигнатура | Кто вызывает |
|---|---|---|
| `onSetStimColor` | `(r, g, b) => void` | `startSingleStimAnimation`, `startBlinkAnimation` |

Реализация в runtime:

    window.PlayerAnimation.setCallbacks({
        onSetStimColor: setStimColorRGB
    });

Хрупкость: если callback не зарегистрирован — `startSingleStimAnimation` не перекрашивает стимул. Тихий отказ.

### §5.3 `PlayerInvalidDetection.setCallbacks`

| Callback | Сигнатура | Кто вызывает |
|---|---|---|
| `onHideStimulus` | `() => void` | не вызывается (мёртвая связь) |
| `onPlayGraphStimulus` | `(node) => void` | в `_resumeAfterStable()` |
| `onPlayGraphCompareRound` | `(node) => void` | в `_resumeAfterStable()` для COMPARE |
| `onShowNextStimulus` | `() => void` | fallback в `_resumeAfterStable()` |
| `onGetNode` | `(id) => node или null` | в `_resumeAfterStable()` |

Реализация в runtime:

    window.PlayerInvalidDetection.setCallbacks({
        onHideStimulus: hideStimulus,
        onPlayGraphStimulus: (node) => playGraphStimulus(node),
        onPlayGraphCompareRound: (node) => playGraphCompareRound(node),
        onShowNextStimulus: () => showNextStimulus(),
        onGetNode: (id) => gGetNode(id)
    });

Хрупкость: контракт `onHideStimulus` объявлен, но не вызывается — мёртвая связь, вводит в заблуждение.

### §5.4 Мосты через window

Помимо `setCallbacks`, есть ad-hoc мосты через глобалы:

| Глобал | Пишет | Читает | Назначение |
|---|---|---|---|
| `window._recordDeviation` | `player-runtime.js` (прокси) | `player-camera.js` | запись отклонения дистанции |
| `window._updateStimulusDim` | `player-runtime.js` (прокси) | `player-camera.js` | притухание стимула |
| `window._isAnswerInvalid` | `player-runtime.js` (прокси) | `player-runtime.js` | проверка валидности |
| `window._markAnswerInvalid` | `player-runtime.js` (прокси) | `player-runtime.js` | инкремент счётчика |
| `window._logAnswer` | `player-runtime.js` (определение) | — | логирование ответа |

Проблема: эти мосты не описаны ни в одном контракте. Связь ломается при переименовании.

---
## §6. Реестр глобалов и ad-hoc состояния

Помимо неймспейсов (`VissortCore`, `Data` и т. д.), проект активно использует ad-hoc глобалы в `window`. Единой карты не было. Здесь — полный реестр.

### §6.1 Глобалы `window._*` — служебные

| Глобал | Тип | Пишет | Читает | Назначение |
|---|---|---|---|---|
| `window._distEMA` | number | `player-utils.js` | `player-utils.js` | EMA-фильтр дистанции |
| `window._recordDeviation` | function | `player-runtime.js` | `player-camera.js` | мост отклонения |
| `window._updateStimulusDim` | function | `player-runtime.js` | `player-camera.js` | мост притухания |
| `window._isAnswerInvalid` | function | `player-runtime.js` | `player-runtime.js` | проверка ответа |
| `window._markAnswerInvalid` | function | `player-runtime.js` | `player-runtime.js` | инкремент счётчика |
| `window._logAnswer` | function | `player-runtime.js` | — | логирование |
| `window._reactionLog` | array | `player-runtime.js` | — | лог ответов (растёт без ограничений) |
| `window._reactionReport` | function | `player-runtime.js` | — | отчёт реакций |
| `window._reactionTimes` | array | `player-runtime.js` | `player-runtime.js` | массив RT |
| `window._books` | object | `app.js`, `player-runtime.js` | `app.js`, `player-runtime.js` | книги по id (sha1) |
| `window._camDetecting` | bool | `player-camera.js` | `player-camera.js` | защита от реентрантности |
| `window._faceLostSince` | number | `player-camera.js` | `player-camera.js`, `player-runtime.js` | timestamp потери лица |
| `window._fastLeanAt` | number | `player-camera.js`, `player-invalid-detection.js` | `player-invalid-detection.js` | timestamp быстрого наклона |
| `window._baselineWaitStart` | number | `player-camera.js` | `player-camera.js` | таймер baseline |
| `window._deviationHistory` | array | `player-camera.js`, `player-invalid-detection.js` | `player-invalid-detection.js` | скользящее окно 2 с |
| `window._invalidAnswerCount` | number | `player-invalid-detection.js` | `player-invalid-detection.js` | счётчик (пишется в `#cnt-invalid`) |
| `window._lastLeanLogAt` | number | `player-invalid-detection.js` | `player-invalid-detection.js` | антиспам лога |
| `window._faceLostPause` | bool | `player-runtime.js` (installFaceLostPause) | `player-runtime.js` | флаг паузы при потере лица |
| `window._pendingGeneratorMode` | bool | `app.js` | `app.js` | режим автотренировки |
| `window._currentScenarioKey` | string | `app.js` | `app.js` | ключ сценария |
| `window._currentScenarioFileName` | string | `app.js` | `app.js` | имя файла |
| `window._currentScenarioId` | string | `app.js` | `app.js` | id в облаке |
| `window._currentReadingBookId` | string | `player-runtime.js` | `player-runtime.js` | текущая книга |
| `window._currentReadingPage` | number | `player-runtime.js` | `player-runtime.js` | текущая страница |
| `window._currentReadingNodeId` | string | `player-runtime.js` | `player-runtime.js` | текущий узел |
| `window._readingNodeWaiting` | bool | `player-runtime.js` | `player-runtime.js` | ожидание кнопки «Закончить» |
| `window._pendingConnectionHandler` | function | `app.js` | `app.js` | pending connection |
| `window._saveGraphInFlight` | bool | `app.js` | `app.js` | защита от двойного save |
| `window._camPreviewKey` | string | `player-runtime.js` (installCamPreview) | `player-runtime.js` | ключ LS |
| `window.__vissort_zoom` | number | `app.js` (installZoom) | `app.js` | уровень зума холста |
| `window.__vissort_newScenario` | function | `app.js` (installNewScenario) | — | отладочный хук |

### §6.2 Диагностика камеры

Диагностика камеры в `player-camera.js`:

- `window.camStats` — объект со счётчиками (`frames`, `detections`, `fails`, `avgDetectMs`, `fps`, `fpsSamples`, `backend`)
- `window.camReport()` — печатает статистику в консоль

### §6.3 Глобальные ссылки на DOM

| Глобал | Пишет | Читает |
|---|---|---|
| `window.stimDisplay` | `player-runtime.js` | `player-animation.js` |
| `window.stimArea` | `player-runtime.js` | `player-animation.js` |

Проблема: `player-animation.js` использует их как implicit globals — если `player-runtime.js` не загружен раньше, будет ReferenceError.

### §6.4 Итог по глобалам

- ~35 ad-hoc глобалов в `window`, не описанных нигде.
- 5 мостов между модулями через `window._*`.
- Нет единого reset() — при сбросе плеера каждый глобал сбрасывается вручную (в `stopPlayer` в `player-runtime.js`).
- Риск: переименование модуля или функции молча ломает связи.

---
## §7. Три системы дистанции

В проекте три независимые реализации контроля дистанции, которые плохо согласованы.

### §7.1 Система A — редактор (app.js)

Где: `app.js`, раздел «индикаторы/предупреждения».

Поля:

- `_distanceBaseline`
- `_distanceOutOfBoundsSince`
- `_distanceWarningKind`
- `_distanceRecalcScheduled`

Пороги:

- `distanceToleranceIncreasePct` (default 15)
- `distanceToleranceDecreasePct` (default 10)
- `distanceRestoreTimeoutSec` (default 3)

UI:

- `#distance-warning` — своя модалка (не `#dist-warning`)
- `#live-distance-indicator`
- `#physio-indicator`
- `#reading-timer`

Поведение: при превышении порога — показать предупреждение; через `distanceRestoreTimeoutSec` — `recalcSizesForNewDistance()` (авто-пересчёт).

Функции: `setDistanceBaselineIfNeeded`, `evaluateDistanceDeviation`, `resetDistanceTracking`, `recalcSizesForNewDistance`.

### §7.2 Система B — плеер (player-camera.js + PlayerState)

Где: `player-camera.js` + `PlayerState`.

Поля:

- `PlayerState.camBaseline`
- `PlayerState.curDistanceM`
- `PlayerState._waitingStable`
- `PlayerState._stableSince`
- `PlayerState._stableBuf`
- `PlayerState._tolNearCm` (default 10)
- `PlayerState._tolFarCm` (default 15)
- `PlayerState._distControlMode` (`return` или `auto`)
- `PlayerState._stimulusDistance`

Пороги:

- `PS._tolNearCm / _tolFarCm` — отмена стимула
- `userScenario.params.distanceToleranceIncreasePct / DecreasePct` — UI-предупреждение
- Hard limit: 1.0 м (не настраивается)

UI:

- `#dist-warning` (через `player-dist-warning.js`)
- `#dist-hard-banner`
- `#cam-indicator`

Функции: `evaluateDistance`, `_checkHardLimit`, `_recalcStimulusSize`.

### §7.3 Система C — invalid detection (player-invalid-detection.js)

Где: `player-invalid-detection.js`.

Константы:

- `_LEAN_DROP_PCT = 15` — порог отклонения
- `_LEAN_FAST_MS = 800` — не используется
- `_LEAN_WINDOW_MS = 4000` — не используется
- `_DEVIATION_HISTORY_MS = 2000` — скользящее окно
- `_LEAN_CONSECUTIVE_FRAMES = 3` — не используется

Поля: `window._deviationHistory`, `window._fastLeanAt`.

Пороги: |pct| > 15 — сброс `_fastLeanAt`; velocity > 8 % между кадрами — тоже.

### §7.4 Рассинхрон между системами

| Что | A (editor) | B (player) | C (invalid) |
|---|---|---|---|
| Baseline | `_distanceBaseline` | `PlayerState.camBaseline` | — |
| Порог отклонения | 10–15 % | 10/15 см от baseline | 15 % |
| Hard limit | нет | 1.0 м | нет |
| UI-модалка | `#distance-warning` | `#dist-warning` + `#dist-hard-banner` | `#invalid-toast` |
| Авто-пересчёт | `recalcSizesForNewDistance` | `_recalcStimulusSize` | — |
| Пауза до стабилизации | нет | `_waitingStable` + `_stableBuf` | `_waitingStable` |

Проблема: врач настраивает пороги в одном месте (инспектор, `PS._tolNearCm`), тренировка реагирует по-разному в редакторе и в плеере. UI-предупреждения в редакторе показываются по одной границе, а отмена стимула — по другой.

### §7.5 Сводка функций по дистанции

- `player-camera.js`: `evaluateDistance`, `_checkHardLimit`, `recalcSizesForNewDistance`
- `player-utils.js`: `effectiveDistance(declared, curDist)`, `smoothDistance(raw)`
- `app.js`: `setDistanceBaselineIfNeeded`, `evaluateDistanceDeviation`, `resetDistanceTracking`, `recalcSizesForNewDistance`, `updateLiveDistanceIndicator`
- `player-dist-warning.js`: `showDistWarning`, `showDistHardBanner`, `hideDistHardBanner`
- `player-invalid-detection.js`: `_recordDeviation`, `_isAnswerInvalid`, `_updateStimulusDim`

Кандидат на унификацию: единый модуль `player-distance.js` с параметрами из `PlayerState`.

---
## §8. Дублирование кода

Фаза 2 (Prettier + ESLint) этого не вычистила. Каталог пар функций, реализованных дважды.

### §8.1 escapeHtml — 5 копий

| Файл | Комментарий |
|---|---|
| `vissort-core.js` | оригинал |
| `app.js` | дубль |
| `player-runtime.js` | дубль |
| `admin.html` inline installSyncUI | дубль |
| `player-invalid-detection.js` | использует `document.createElement` |

### §8.2 Ядро ↔ редактор

В `app.js` используется `window.VissortCore` через импорт — реального дублирования нет.

Импортируются и используются: `acuityToSizeMm / Px / FontSizePx`, `hexToRgb / rgbToHex / lerpColor`, `generateLetterE / generateLandoltRing`, `getStimulusSVG / getCircleStimulusSVG`.

### §8.3 player-animation.js ↔ app.js

Критичный класс — `app.js` содержит свои реализации функций анимации:

| Функция | player-animation.js | app.js |
|---|---|---|
| `setStimColorRGB` | через callback | своя |
| `startCircleAnimation` | да | своя |
| `stopCircleAnimation` | да | своя |
| `getPeripheralLayer` | да | своя |
| `buildPeripheralDots` | да | своя (другая сигнатура) |
| `buildDefocusFrame` | да, возвращает HTMLElement | своя, возвращает {html, diameter} |
| `removeSingleGridLines` | да | своя |
| `drawSingleGridLines` | да | своя |
| `applySingleGridPosition` | да | своя |
| `pickSingleGridCell` | да | своя |
| `applyRandomStimulusPosition` | да | своя |
| `startSingleStimAnimation` | да | своя (другая формула) |
| `startSingleBgAnimation` | да | своя |
| `startBlinkAnimation` | да | своя |
| `stopBlinkAnimation` | да | своя |
| `scheduleVoiceCountdown` | в runtime | своя |

Оценка: ~700 строк дублирования. Не совпадают даже сигнатуры.

### §8.4 player-camera.js ↔ app.js

| Функция | player-camera.js | app.js |
|---|---|---|
| `loadFaceApi` | да, wasm → cpu | своя, cpu only |
| `enableCamera` | да | своя |
| `disableCamera` | да | своя |
| `processVideoFrame` | да, interval | своя, RAF |
| `recalcSizesForNewDistance` | да | своя |
| `computeEAR` | `_calcEAR` | своя |
| `_isBlinkFromLandmarks` | да | своя |

Другие параметры: `inputSize: 320 / scoreThreshold: 0.25` (player) vs `inputSize: 224 / scoreThreshold: 0.5` (app).

### §8.5 player-runtime.js ↔ app.js

| Функция | player-runtime.js | app.js |
|---|---|---|
| `showDirectionComparison` | да | своя |
| `showFindSameComparison` | да | своя |
| `showFindSameComparisonInternal` | да | своя |
| `handleFindSameClick` | да | своя |
| `createCellElement` | да | своя |
| `defaultCellParams` | да, в ч.2 | своя, в ч.3 |
| `defaultCompareCellParams` | нет | своя, в ч.1 |
| `processComparisonAnswer / processCompareAnswer` | да | своя |
| `displayStimulus` | да | своя |
| `hideStimulus` | да | своя |
| `updateCounters` | да, 5 счётчиков | своя, 6 счётчиков |
| `startPlayer` | да | своя |
| `stopPlayer` | да | своя |
| `togglePause` | да | своя |
| `pauseTraining` | да | своя |
| `resumeTraining` | да | своя |
| `handleDirectionAnswer` | да | своя |
| `handleCompareAnswer` | да | своя |

Оценка: ~1500 строк дублирования. `player-runtime.js` и `app.js` параллельно реализуют один и тот же плеер для двух страниц.

### §8.6 player-reading.js ↔ app.js

| Функция | player-reading.js | app.js |
|---|---|---|
| `applyBackground` | да | своя, в ч.3 |
| `startDynamicBg` | да | своя, `startDynamicReadingBackground` |
| `buildDynamicPhases` | нет | своя |
| `buildPhysiologicalPhases` | нет | своя |

Ключевое отличие: в `app.js` реализован режим `physiological` (шкала диаптера), которого нет в `player-reading.js`. При воспроизведении сценария с этой шкалой в плеере — fallback на `simple`.

### §8.7 Auth-код — двойное дублирование

| Функция | player-runtime.js | app.js |
|---|---|---|
| `installAuthObserver` | да | да |
| `bindForm / bindAuthForm` | да | да |
| `focusFirstField / focusAuthField` | да | да |
| `saveAuthCreds` | да | да |
| `encodeCred / decodeCred` | да | да |
| `prefillAuthEmail / prefillAuthCreds` | да | да |
| `doAuth / handleAuthSubmit` | да | да |

Разные источники правды: `authMode` (глобальная `let` в `app.js`) vs `PlayerState.authMode`.

### §8.8 mockUserLogin / mockAdminLogin в тестах

5 копий в `tests/*.spec.js`. Нет общего helper-а.

### §8.9 Сводка

| Пара | Строк дублирования | Приоритет |
|---|---|---|
| player-runtime.js ↔ app.js | ~1500 | P1 |
| player-animation.js ↔ app.js | ~700 | P1 |
| player-camera.js ↔ app.js | ~250 | P1 |
| Auth-код | ~200 | P1 |
| player-reading.js ↔ app.js | ~150 | P2 |
| Тесты | ~150 | P2 |
| Итого | ~3000 строк | — |

Решение (Фаза 5): вынести общее в модули, оставить только UI-адаптеры.

---
## §9. Порядок загрузки скриптов

Три HTML-файла грузят скрипты по-разному. Ошибочный порядок ломает функциональность (`VissortCore not loaded`).

### §9.1 user.html

Порядок в head (defer):

1. face-api.js (defer, CDN)
2. @supabase/supabase-js@2 (sync, CDN)

Порядок в конце body:

| # | Скрипт | defer |
|---|---|---|
| 1 | vissort-onboarding.js | да |
| 2 | vissort-device.js | да |
| 3 | voice.js | да |
| 4 | user.js | НЕТ |
| 5 | vissort-core.js | да |
| 6 | player-state.js | да |
| 7 | player-camera.js | да |
| 8 | player-animation.js | да |
| 9 | player-invalid-detection.js | да |
| 10 | player-utils.js | да |
| 11 | player-dist-warning.js | да |
| 12 | player-reading.js | да |
| 13 | player-runtime.js | да |

Порядок исполнения:

- user.js (sync) — сразу при парсинге.
- face-api.js (defer) — после парсинга.
- Остальные (defer) — после парсинга в порядке регистрации.

Проблема: user.js синхронный, остальные — defer. user.js не использует VissortCore, но это хрупко.

### §9.2 player.html

Порядок идентичен user.html, кроме:

- player.js вместо user.js.
- CSP строже.

### §9.3 admin.html

Порядок в head:

| # | Скрипт | defer |
|---|---|---|
| 1 | face-api.js | да |
| 2 | @supabase/supabase-js@2 | НЕТ |
| 3 | jszip@3.10.1 | НЕТ |
| 4 | sentry.min.js (локальный) | НЕТ |
| 5 | Inline Sentry init | — |

Порядок в конце body:

| # | Скрипт | defer |
|---|---|---|
| 1 | vissort-core.js | НЕТ |
| 2 | data-layer.js | НЕТ |
| 3 | voice.js | НЕТ |
| 4 | keepalive.js | НЕТ |
| 5 | app.js | НЕТ |
| 6 | header-drag.js | НЕТ |
| 7 | vissort-ai-generator.js | НЕТ |
| 8 | Inline installSyncUI() | — |

Порядок исполнения (строгий): все без defer, сверху вниз.

Проблемы:

- app.js вызывает init() сразу при выполнении — до DOMContentLoaded. Работает, потому что app.js в конце body, все DOM-элементы уже есть.
- window.AppEditorCore экспортируется в конце app.js — до vissort-ai-generator.js.
- #ai-generator-modal идёт ПОСЛЕ script vissort-ai-generator.js в HTML, но AIGenerator.bind() откладывается до DOMContentLoaded. Хрупко.
- face-api.js (defer) загружается ПОСЛЕ app.js (sync). app.js не должен использовать faceapi синхронно. Сейчас не использует — только по клику.

### §9.4 Service Worker

| HTML | Регистрация SW |
|---|---|
| admin.html | да, через app.js (registerServiceWorker в init) |
| user.html | не найдена |
| player.html | не найдена |

Проблема: SW регистрируется только для редактора. Плеер офлайн-первый по дизайну, но без SW. Возможно, регистрация где-то ещё — но user.js и player.js содержат только 2 строки, там её нет. Хвост: либо добавить регистрацию в player-runtime.js, либо в HTML user/player.

Условие регистрации (в app.js): if (IS_DEV) — unregister, else register. IS_DEV = localhost или 127.0.0.1. Значит, на localhost SW не работает по дизайну.

### §9.5 SKIP_WAITING

Единственное место: app.js ч.4, showSWUpdateBanner, кнопка «Обновить»:

    reg.waiting?.postMessage({ type: 'SKIP_WAITING' });

Вызывается только при явном клике пользователя. Авто-обновления нет.

### §9.6 Зависимости порядка

Критичные пары:

- vissort-core.js ДО player-state.js (loadPPI).
- vissort-core.js ДО player-animation.js (деструктуризация в начале).
- vissort-core.js ДО player-reading.js (деструктуризация lerpColor).
- player-state.js ДО player-camera.js (throw при отсутствии).
- app.js ДО vissort-ai-generator.js (window.AppEditorCore).
- data-layer.js ДО app.js (window.Data).
- voice.js ДО app.js (window.Voice).
- vissort-device.js ДО vissort-onboarding.js (ensureDevice).

В user/player: user.js синхронный, но vissort-core.js — defer. Это работает, потому что user.js только устанавливает VissortPlayerOptions, не использует core.

---
## §10. Различия user/player/admin

### §10.1 HTML — общая таблица

| Аспект | user.html | player.html | admin.html |
|---|---|---|---|
| Entry-скрипт | user.js (sync) | player.js (sync) | нет |
| requireDomain | false | true | — |
| showGamesMenu | true | false | — |
| Модули плеера | defer | defer | без defer |
| vissort-core.js | defer | defer | без defer |
| Порядок скриптов | core → player-* | core → player-* | core → data → voice → keepalive → app → header-drag → ai |
| CSP frame-ancestors | none | none | отсутствует |
| CSP img-src | https: | без https: | https: |
| CSP form-action | self | none | self |
| CSP Referrer-Policy | strict-origin | no-referrer | strict-origin |
| Модалки | classList | classList | style.display |
| CSS-класс кнопок ответа | .btn-resp | .btn-resp | .btn-response |
| auth-name | нет | нет | да |
| auth-name-label | нет | нет | да |
| btn-test | нет | нет | да |
| btn-ai-generator | нет | нет | да |
| ai-generator-modal | нет | нет | да |
| font-picker-modal | нет | нет | да |
| v-detect | нет | да | нет |
| stim-cam-block | нет | да | нет |
| stim-cam-preview | нет | да (мёртвый) | нет |
| sync-chip, sync-banner | нет | нет | да |
| queue-modal | нет | нет | да |
| generator-modal | нет | нет | да |
| canvas, inspector | нет | нет | да |
| block-panel | нет | нет | да |
| SW регистрация | не найдена | не найдена | да, через app.js |
| Manifest | site.webmanifest | player.webmanifest | site.webmanifest |
| Заголовок title | Тренировка | Тренировка | Администратор |
| PWA-мета iOS | нет | да | нет |

### §10.2 JS — общая таблица

| Аспект | user.js / player.js | player-runtime.js | app.js |
|---|---|---|---|
| Auth UI | — | PlayerState.authMode | локальная authMode |
| auth-name | — | не используется | используется при регистрации |
| Кнопки ответа | — | .btn-resp | .btn-response |
| Плеер | — | полноценный (граф + плоский + чтение + сравнение) | параллельный (для тестов из редактора) |
| Камера | — | PlayerCamera.* | своя (enableCamera в app.js) |
| Анимации | — | через PlayerAnimation.* | свои (дублируют) |
| Моргание (EAR) | — | _calcEAR | своя computeEAR |
| inputSize face-api | — | 320 / 0.25 | 224 / 0.5 |
| Sync UI | — | нет | installSyncUI() |
| Zoom холста | — | нет | installZoom() |
| New scenario | — | нет | installNewScenario() |
| Счётчики | — | 5 (cnt-*) | 6 (cnt-completed/success/failed/*) |

### §10.3 Примеры несовместимости

1. showAuthModal в player-runtime.js использует auth-name-label и auth-name, которых нет в user/player. Функция падает при вызове. Сейчас не вызывается — используется updateAuthModal (без name-полей). Мёртвый код.

2. #response-buttons содержит .btn-response в admin и .btn-resp в player/user. Оба стиля описаны только в своих HTML. Если перенести разметку — кнопки станут невидимыми.

3. Модалки через style.display (admin) и classList (user/player). pauseModal.style.display = none (admin) vs pauseModal.classList.remove(open) (player). При копипасте кода между файлами — несовместимо.

4. auth-modal: в admin — style.display = flex, в user/player — classList.add(open). Разные методы.

### §10.4 Единые точки

Что одинаково во всех трёх HTML:

- hdr-scenario, hdr-user, btn-player, btn-player-pause, btn-player-stop, btn-logout.
- stim-display, stim, reading-viewport, reading-content, reading-toolbar, response-buttons.
- status-overlay, pause-modal.
- CSS-переменные (--hdr-h, --btn-h, --gap).
- Sentry-init (DSN, tunnel, release vissort-2.0.0).

### §10.5 Что менять с осторожностью

| Что менять | Где менять | Где не забыть |
|---|---|---|
| Кнопки ответа | player.html, user.html — .btn-resp; admin.html — .btn-response | CSS в обоих HTML |
| Модалки (pause, auth) | admin.html — style.display; user/player — classList | JS в app.js vs player-runtime.js |
| auth-name | только admin.html | showAuthModal в player падает если вызвать |
| btn-test | только admin.html | app.js использует ?. — ок |
| Порядок скриптов | admin — без defer; user/player — с defer | зависимости между модулями |
| CSP | три разных политики | при добавлении CDN — во все три |

---
## §11. Хвосты миграции Фазы 4

Фаза 4 (RLS-аудит, логирование Edge Functions, бэкап БД) выполнена не полностью. Ниже — что осталось.

### §11.1 ADMIN_EMAILS — расширенный список

Ключевое место — `app.js`, константа `ADMIN_EMAILS`:

    const ADMIN_EMAILS = ['dumand@gmail.com'];  // было: + eremeevap@gmail.com (удалён 08d4c0f)

Используется в `updateAuthUI()`:

    if (!ADMIN_EMAILS.includes(currentUser.email)) {
        window.location.href = 'user.html';
        return;
    }

**Проблема (была):** до 2026-10-11 пользователь eremeevap был в ADMIN_EMAILS в app.js — сохранял доступ к редактору (в обход Edge Function whitelist).

**СТАТУС: FIXED** — коммит 08d4c0f (удалён из ADMIN_EMAILS).

### §11.2 SUPABASE_ANON_KEY — 5 копий → 1 источник ✅ ЗАКРЫТО

**Было:** anon-ключ Supabase захардкожен в 5 файлах (data-layer.js, vissort-ai-generator.js, keepalive.js, player-runtime.js, app.js inline).
Ротация = правка в 5 файлах.

**Стало:** единый источник `window.VissortEnv.SUPABASE_ANON_KEY` в новом `vissort-env.js`.
Все 5 модулей читают из `VissortEnv` с fallback на прежнюю строку.

**Коммиты:**
- `c7ebfee` — vissort-env.js + подключение в 3 HTML (первым, до vissort-core.js)
- `3c55acc` — data-layer.js, vissort-ai-generator.js, player-runtime.js
- `9c379b2` — keepalive.js
- `63aba3d` — app.js (inline в initSupabase)
- `518ae11` — sw.js: precache vissort-env.js

**Что осталось (в план Фазы 5):** ротация самого ключа — отдельной задачей.
**Молчаливая страховка:** fallback снят не будет, пока не подтвердится, что все клиенты подхватили VissortEnv.

### §11.3 RLS-политики ✅ ПРОЙДЕНО (2026-10-12)

Аудит пройден. Детали: `docs/RLS-AUDIT.md`.

Итог:
- Все 8 таблиц с RLS.
- anon не читает данные (тест с anon-ключом: все `200 []`).
- Роли: `admin`, `developer`, `doctor`, `patient`.
- Функции: `is_admin`, `is_developer`, `is_admin_or_developer`, `current_role`, `is_my_patient`.
- Политики для `doctor`: `scenarios`, `templates`, `test_results`, `training_sessions`, `profiles`, `user_scenarios`, `doctor_patients`.
- `user_scenarios.doctor_id` — новый столбец (2026-10-12).
- Разделение `admin` / `developer` — `developer` без медданных.

Что осталось (Фаза 6): UI регистрации врача, привязки пациентов, дашборд.
### §11.4 Edge Functions — не аудированы

generate-scenario:

- Проверка JWT — есть ли явный whitelist админов?
- Rate-limit 20/час — работает через RPC check_ai_rate_limit.
- Логирование ошибок — есть ли Sentry-хук?
- Обработка DeepSeek 429 / 500 — есть ли retry?

sentry-proxy:

- Проверка origin запроса — есть ли whitelist?
- Ограничение размера envelope — есть ли?

Действие: открыть обе функции, проверить код.

### §11.5 Бэкап БД ✅ НАСТРОЕНО (2026-10-12)

Автобэкап через GitHub Actions: `.github/workflows/backup-db.yml`.

- Расписание: ежедневно 03:00 UTC (`cron: 0 3 * * *`).
- Ручной запуск: Actions → Backup Database → Run workflow.
- `pg_dump --format=custom --compress=9` через Session pooler.
- Артефакт: `db-backup-YYYY-MM-DD` (retention 90 дней).
- Первый успешный запуск: 2026-10-12 (1m 5s).
- Детали: `docs/BACKUP.md`.
### §11.6 Чек-лист Фазы 4

- [x] Убрать eremeevap@gmail.com из ADMIN_EMAILS в app.js — FIXED 08d4c0f
- [x] Ротировать anon-ключ и вынести в единую константу — FIXED §11.2 (коммиты c7ebfee…518ae11)
- [x] Аудит RLS на всех таблицах — FIXED §11.3 (docs/RLS-AUDIT.md)
- [x] Логирование Edge Functions — FIXED §11.4 (Sentry-хук, CORS whitelist, retry)
- [x] Автобэкап БД — FIXED §11.5 (backup-db.yml, первый запуск 2026-10-12)

---
## §12. Критические баги

Каталог с приоритетами: P0 — ломает прод / краш / security; P1 — реальный UX-баг; P2 — улучшение.

### §12.1 P0 — критические

#### §12.1.1 handleDirectionAnswer не продвигает серию (player-runtime.js)

Где: player-runtime.js ч.2, функция handleDirectionAnswer.

Проблема: после ответа пользователя (стрелка) функция сохраняет lastResponse, вызывает saveResult, но НЕ вызывает showNextStimulus и НЕ вызывает finishSeries. currentShowTimer очищается в начале функции, а новый таймер не создаётся. Плоский режим «залипает» после первого ответа.

Сравнение: handleGraphDirectionAnswer (граф) продвигает серию — вызывается finishGraphStimulusSeries или playGraphStimulus. Асимметрия между обработчиками.

Также: в app.js аналогичная функция handleDirectionAnswer реализована так же — не продвигает серию. Но там currentShowTimer не очищается, поэтому следующий стимул показывается через sd мс (с задержкой), а не сразу через delay2.

Действие: в handleDirectionAnswer (player-runtime.js) добавить в конце продвижение серии: если seriesStep >= seriesSize — finishSeries; иначе setTimeout(() => showNextStimulus(), delay2).
**СТАТУС: FIXED** — коммит 34f8659

#### §12.1.2 focalLengthPx — неверный ключ LS

Где: player-runtime.js ч.2, функция startPlayer.

Проблема: попытка восстановить focalLengthPx из LS:

    var _lsF2 = parseFloat(localStorage.getItem('PlayerState.focalLengthPx') || '0');

Ключ с префиксом PlayerState. — такого ключа в LS никогда не было. Реальный ключ — focalLengthPx (пишет vissort-device.js через apply, пишет app.js через calibrateFocalLength). Значит, ветка мёртвая — если focalLengthPx потерян из PlayerState, он не восстановится.

Действие: заменить 'PlayerState.focalLengthPx' на 'focalLengthPx'.
**СТАТУС: FIXED** — коммит f8a82a9

#### §12.1.3 showAuthModal падает при отсутствии #auth-name

Где: player-runtime.js ч.1, функция showAuthModal.

Проблема: showAuthModal ссылается на auth-name-label и auth-name, которых нет в user.html и player.html (есть только в admin.html). При вызове: nl.style.display — TypeError.

Сейчас функция не вызывается (используется updateAuthModal), но код мёртвый и опасный — при попытке вызвать в плеере упадёт.

Действие: либо убрать showAuthModal из player-runtime.js, либо добавить защиту через ?. или проверку на null.
**СТАТУС: FIXED** — коммит 9475205

### §12.2 P1 — важные

#### §12.2.1 CSP admin.html без frame-ancestors

Где: admin.html, meta Content-Security-Policy.

Проблема: в CSP user.html и player.html есть frame-ancestors 'none'. В admin.html он отсутствует. Значит, admin.html можно встроить в iframe с любого домена. Возможна clickjacking-атака (например, на кнопку «Назначить сценарий» или «Применить»).

Действие: добавить frame-ancestors 'none' в CSP admin.html.
**СТАТУС: FIXED** — коммит 303a093

#### §12.2.2 sw.js не precache-ит vissort-core.js и модули плеера

Где: sw.js, PRECACHE_URLS.

Проблема: список содержит app.js, data-layer.js, user.js, player.js, voice.js, но не содержит:

- vissort-core.js
- player-state.js, player-utils.js, player-dist-warning.js, player-reading.js
- player-camera.js, player-animation.js, player-invalid-detection.js
- header-drag.js, vissort-ai-generator.js
- vissort-onboarding.js, vissort-device.js

Итог: при офлайне сразу после установки SW плеер не работает — core-модули не в кэше.

Действие: добавить все модули в PRECACHE_URLS.
**СТАТУС: FIXED** — коммит 6a7cdf1

#### §12.2.3 Sentry-паттерны в NEVER_CACHE_PATTERNS мертвы

Где: sw.js, NEVER_CACHE_PATTERNS.

Проблема: содержит /sentry-cdn.com/ и /\.sentry\.io/. Проверяется через url.pathname. То есть в pathname (часть URL после домена) не может быть домена Sentry — эти паттерны никогда не срабатывают.

Действие: либо проверять hostname, либо удалить паттерны (Sentry идёт через tunnel supabase.co, не напрямую).
**СТАТУС: FIXED** — коммит 47c8732

#### §12.2.4 deleteNode удаляет лишние связи

Где: app.js ч.2, функция deleteNode.

Проблема: connectionElements обходится через k.includes(id). Если id узла — node_1, а key — node_10_node_20, то node_1 входит в node_10 как подстрока. Удалит лишние связи.

Действие: заменить на проверку startWith(id + '_') || endsWith('_' + id) || k === id + '_' + id.
**СТАТУС: FIXED** — коммит b3eaf99

#### §12.2.5 showFindSameComparison — ID пар по индексу массива

Где: player-runtime.js ч.3, app.js ч.3.

Проблема: пары формируются по индексу в массиве chosen: idx=0 и idx=1 — пара 0; idx=2 и idx=3 — пара 1. Если клетки в grid визуально перемешаны (активный индекс в data-index не совпадает с порядком), пары могут не совпадать.

Действие: проверить на живом коде, сопоставить data-index и индекс в st.cells.
**СТАТУС: НЕ ПОДТВЕРЖДЁН** — бага нет, data-index совпадает с индексом в st.cells

#### §12.2.6 showAuthModal — TypeError в плеере

Уже описан как P0 §12.1.3.

#### §12.2.7 physiological-режим не работает в плеере

Где: player-reading.js, startDynamicBg.

Проблема: в app.js реализован режим physiological (шкала диаптера). В player-reading.js этот режим не поддерживается — ветки physiological нет, fallback на simple. Если врач сохранил сценарий с physiological, в плеере покажется simple.

Действие: либо перенести buildPhysiologicalPhases из app.js в player-reading.js, либо в app.js не давать сохранять physiological для плеера.
**СТАТУС: FIXED** — коммит 4d0095a

#### §12.2.8 trigger у .btn-response vs .btn-resp

Где: app.js ч.3 vs player-runtime.js ч.3.

Проблема: в admin.html кнопки имеют класс .btn-response, в user.html и player.html — .btn-resp. В app.js используется .btn-response, в player-runtime.js — .btn-resp. Если перенести разметку или код — обработчики не сработают.

Действие: унифицировать. Либо один класс в трёх HTML, либо в JS использовать оба селектора.
**СТАТУС: FIXED** — коммит 24e42c0

### §12.3 P2 — техдолг и улучшения

#### §12.3.1 RAF-анимации плеера не восстанавливаются после паузы

Где: player-animation.js, startSingleStimAnimation и др.

Проблема: при !playerRunning || isPaused — animId = null, return. Возобновления не будет, анимацию надо запускать заново.

Только player-reading.js умеет восстанавливать паузу (isPausedGetter).

Действие: унифицировать логику паузы во всех RAF-анимациях.

#### §12.3.2 Нет stopAll() для анимаций

Где: player-animation.js.

Проблема: нет метода, который останавливает все 7 анимаций сразу. player-invalid-detection._abortCurrentStimulus лезет в PlayerState напрямую — обходит модуль.

Действие: добавить PlayerAnimation.stopAll(), вызывать его из _abortCurrentStimulus.

#### §12.3.3 window._camDetecting может залипнуть

Где: player-camera.js, processCamFrame.

Проблема: window._camDetecting = true ставится в начале try, сбрасывается после try/catch. Если catch выбросит исключение — сброс не выполнится. Цикл залипнет.

Действие: обернуть в try/finally.

#### §12.3.4 after face_lost стимул может не возобновиться

Где: player-camera.js + player-runtime.js.

Проблема: при потере лица > 1500 мс → onAbortStimulus(face_lost). Флаг _waitingStable устанавливается только в _abortCurrentStimulus (в player-invalid-detection.js). Но installFaceLostPause в player-runtime.js не устанавливает его. Может быть рассинхрон.

Действие: явно устанавливать _waitingStable = true при face_lost.

#### §12.3.5 Блок D2 e_s4.txt — финальный хвост без backtick-блоков

Где: PROJECT-MAP.md, §4.15.

Проблема: в §4.15 формат requireDomain/showGamesMenu описан как простой текст (FORMAT: ...), а не как код-блок. Сделано осознанно — чтобы избежать проблем с копипастом.

Действие: при желании заменить на корректный Markdown-код-блок через прямое редактирование файла (не через чат).

### §12.4 Сводка P0

Все закрыты:
- §12.1.1 → коммит 34f8659
- §12.1.2 → коммит f8a82a9
- §12.1.3 → коммит 9475205

### §12.5 Сводка P1

Закрыты (6 из 7):
- §12.2.1 → коммит 303a093
- §12.2.2 → коммит 6a7cdf1
- §12.2.3 → коммит 47c8732
- §12.2.4 → коммит b3eaf99
- §12.2.5 → не подтверждён (бага нет)
- §12.2.7 → коммит 4d0095a
- §12.2.8 → коммит 24e42c0

---
## §13. Техдолг

Список задач по улучшению, не критичных для прода, но накапливающихся.

### §13.1 Архитектура

#### §13.1.1 app.js — монолит (360 KB)

app.js содержит:

- Редактор сценариев (граф, связи, drag).
- Инспектор (4 типа узлов × HTML).
- Auth UI.
- Плеер для тестов (параллельный player-runtime.js).
- Генератор режимов (#generator-modal).
- Sync-UI (installSyncUI).
- Zoom холста (installZoom).
- Новый сценарий (installNewScenario).

Оценка: ~7900 строк в одном файле. Фаза 5 — аудит и разбиение.

Кандидаты на вынос:

- app-editor-graph.js — рендер графа, drag, связи.
- app-inspector.js — все 4 инспектора.
- app-auth.js — auth-логика (дублирует player-runtime.js).
- app-generator.js — модалка генератора.
- app-player.js — плеер для тестов.
- app-init.js — главный init.

#### §13.1.2 player-runtime.js — РАЗБИТ ✅ (2026-10-15)

Итог §15.1.2 ч.7/7: **3002 → 899 строк (−70%)**.

Модули:

| Файл | Строк | Назначение |
|---|---|---|
| `player-runtime.js` | 899 | Bootstrap, init, event-хендлеры, обёртки |
| `player-graph.js` | 803 | Плеер графа |
| `player-single.js` | 608 | Плоский и сравнительный режимы |
| `player-session.js` | 328 | startPlayer/stopPlayer/pauseTraining/saveResult |
| `player-reading-mode.js` | 254 | Режим чтения |
| `player-auth.js` | 254 | Auth-логика плеера |
| `player-scenarios.js` | ~190 | Загрузка сценариев |

Остаток (перенесено в Фазу 5): app.js 7900 строк, дублирование app.js ↔ player-single.js (~3000 строк), player-installers.js (install* функции), единый player-distance.js.

#### §A1 (Фаза 5) — AppState для app.js ✅ (2026-10-15)

90 глобальных переменных из `app.js` вынесены в новый `app-state.js`. Доступ через `window.AppState` (шим `Object.defineProperty`). Все существующие обращения в `app.js` продолжают работать.

Не перенесены (остаются в app.js):

- `_blinkState`, `_blinkResponseBlockUntil`, `_blinkCalibration`, `_waitingForOpenEyes` — зависят от функции `createEmptyBlinkState()`.
- `createEmptyBlinkState()` — функция, не переменная.
- Константы `BLINK_*`, `LS_KEYS`, `MAX_DISTANCE_LOG`.

Коммит: `818ee24`. Тесты: 28 passed.

Далее §A2 — нарезка `app.js` (7756 строк) на модули: `app-editor.js`, `app-player-preview.js`, `app-inspector.js`, `app-generator.js`, `app-scenarios.js`, `app-init.js`.

#### §A2-v2 (Фаза 5) — плеер-превью ✅ (2026-10-15)

34 функции плеера-превью вынесены в `app-player-preview.js` (1277 строк). Экспорт — `window.AppPlayerPreview`.

Отличие от прод-плеера (`player-single.js`):

- Адаптивная острота (`currentAcuity` растёт/падает по `acuityStep`).
- Блокировка показа при моргании (`blinkLockShow`).
- Сохранение результатов с `sessionId` (`window.Data.saveResult`).
- Отчёт с дистанцией и морганием (`buildBlinkReport`).

В `app.js` остались 34 тонкие обёртки. `switchMode` оставлен в `app.js` (редактор, не плеер).

`app.js`: 7756 → **6569** строк. Коммит `c4cc5b1`. Тесты: 28 passed.

Далее §A2-v3 — вынести редактор графа в `app-editor.js`.

#### §A2-v3 (Фаза 5) — редактор графа ✅ (2026-10-16)

30 функций графа (включая size-helpers) вынесены в `app-editor.js` (1073 строк). Экспорт — `window.AppEditor` + алиас `window.AppEditorCore` (для AI-генератора).

Импорт: `acuityToSizeMm`, `acuityToSizePx`, `getStimulusSVG` из `VissortCore`; `state` из `AppState`.

В `app.js` — 29 тонких обёрток. Мост: `window.updateInspector`, `window.saveNodeAsTemplate`.

`app.js`: 6569 → **5546** строк. Коммит `ee30bce`. Тесты: 28 passed.

#### §A2-v4 (Фаза 5) — инспектор ✅ (2026-10-16)

17 функций инспектора (стимул, чтение, логика, сравнение) вынесены в `app-inspector.js` (926 строк). Экспорт — `window.AppInspector`.

Импорт: `acuityToSizeMm`, `acuityToSizePx`, `getStimulusSVG`, `rgbToHex`, `hexToRgb`, `escapeHtml`, `detectUnit`, `msToUnit`, `unitToMs` из `VissortCore`; хелперы из `AppEditor`.

В `app.js` — 17 тонких обёрток. Мост: `window.openBookPicker`, `window.saveUserSettings`.

`app.js`: 5546 → **4690** строк (−856). Коммит `02aed43`. Тесты: 28 passed.

`admin.html`: подключён `<script src="app-inspector.js">`.
`sw.js`: precache добавлены `app-state.js`, `app-player-preview.js`, `app-editor.js`, `app-inspector.js`.

Далее §A2-v5 — вынести генератор в `app-generator.js`.

#### §13.1.3 Три системы дистанции

См. §7. Решение: единый player-distance.js с параметрами из PlayerState, использование во всех модулях.

### §13.2 Производительность

#### §13.2.1 buildPeripheralDots пересоздаёт DOM каждый кадр

player-animation.js: layer.innerHTML = пусто + N createElement на каждый кадр. При 30 fps и 12 точках — 360 операций/с.

Действие: переиспользовать узлы, менять только transform.

#### §13.2.2 installCamPreview setInterval 1000 мс

player-runtime.js: вечный опрос для переключения класса pip-visible.

Действие: перейти на MutationObserver на #hidden-video или на событие создания элемента.

#### §13.2.3 installCamHud setInterval 250 мс

player-runtime.js: парсит #cam-indicator.textContent, вычисляет статус.

Действие: заменить на кастомное событие из player-camera.js.

#### §13.2.4 installFaceLostPause setInterval 300 мс

player-runtime.js: параллельный механизм паузы при потере лица. Дублирует player-camera.js.

Действие: убрать, оставить только player-camera.js.

#### §13.2.5 loadFaceApi не идемпотентна

player-camera.js: при каждом enableCamera — повторная загрузка весов.

Действие: guard if (faceapi.nets.tinyFaceDetector.isLoaded) return.

#### §13.2.6 Двойной детект при моргании

player-camera.js: при отсутствии det повторный detectSingleFace().withFaceLandmarks(). Двойная нагрузка.

Действие: вернуть landmarks из первого прогона, если возможно.

#### §13.2.7 data-layer.js syncAuthFromStorage перебирает все ключи LS

При каждой загрузке страницы: Object.keys(localStorage).filter(k => k.includes(projectRef)), parse каждого.

Действие: читать только известный ключ sb-<projectRef>-auth-token.

### §13.3 Качество кода

#### §13.3.1 Магические числа

Много хардкодных значений без объяснения:

- _LEAN_DROP_PCT = 15, velocity > 8 %.
- 2550 мс — currentDuration.
- 0.85 м — предупреждение о дистанции.
- 1500 мс — потеря лица.
- 2500/3000 мс — логи наклона.
- 1.454 — коэффициент формулы остроты.

Действие: вынести в константы с комментариями.

#### §13.3.2 console.log / warn / error в проде

~30 модулей логируют. Не отключаются.

Действие: единый logger с флагом DEBUG.

#### §13.3.3 Нативные alert / confirm / prompt ✅ ЗАКРЫТО (2026-10-12)

Все нативные диалоги заменены на VissortDialog.

**app.js (74 диалога):**
- 67 `alert` → `VissortDialog.alert` (коммит `69ff3fd`).
- 2 `confirm` → `VissortDialog.confirm` + async (коммит `ef6431c`).
- 5 `prompt` → `VissortDialog.prompt` + async (коммит `7b5b739`).

**Остальные файлы (закрыто ранее):**
- `keepalive.js` — 4 `alert` → `_alert` (§13.3.3 ранее).
- `player-runtime.js` — 5 `alert` → `_alert` (§13.3.3 ранее).
- `vissort-onboarding.js` — 2 `alert` + 1 `confirm` (§13.3.3 ранее).

- **Тесты обновлены:** `login.spec.js:33`, `editor.spec.js:131` — теперь ждут `#vissort-dialog[open]` вместо `page.on('dialog')`.

#### §13.3.4 PATCH* комментарии и исторические маркеры

В admin.html остались стили:

- id="patch14b-compact-nodes"
- id="patch15a-node-buttons"
- PATCH13 в responsive-header
- PATCH14B в комментарии

В app.js: PATCH_TEST_NO_LOGIN, PATCH_CLEAN.

Действие: свести патчи в основной стиль, убрать маркеры.

#### §13.3.5 Исторические комментарии user.js: Начало части N из 4

В player-runtime.js остались маркеры:

- // === user.js: Начало части 1 из 4 ===
- // === user.js: Конец части 1 из 4 ===
- и т. д.

Мусор от старой сборки.

Действие: удалить.

#### §13.3.6 Мёртвые константы

player-invalid-detection.js:

- _LEAN_CONSECUTIVE_FRAMES = 3
- _LEAN_FAST_MS = 800
- _LEAN_WINDOW_MS = 4000

Не используются. Признак недоделанной фичи.

Действие: удалить или реализовать.

#### §13.3.7 Мёртвые функции

- player-camera.js: _checkHardLimit — экспортируется, но не вызывается.
- player-invalid-detection.js: onHideStimulus в callbacks — не вызывается.
- player-runtime.js: loadFaceApi — заглушка.
- admin.html: #user-list — не заполняется в loadUsers.
- player.html: #stim-cam-preview — не подключается к потоку.

Действие: удалить или подключить.

### §13.4 Согласованность

#### §13.4.1 Разные стили кода

- var в player-dist-warning.js, const в остальных.
- function name() в app.js, const name = () => в модулях.
- Разные стили отступов.
- Prettier прогнан неравномерно.

Действие: прогнать Prettier + ESLint по всем файлам.

#### §13.4.2 Смешение языков

- installNewScenario: confirm('Start a new scenario? Unsaved changes will be lost.') — английский в русском UI.
- admin.html: class="modal" с русскими комментариями.
- Sentry DSN и release — английские.

Действие: локализовать UI-строки.

#### §13.4.3 Названия с префиксом _ для экспортируемых функций

- PlayerCamera._faceEmoji, _pushDetection и др.
- PlayerInvalidDetection._abortCurrentStimulus, _resumeAfterStable.

Приватные по имени, публичные по факту.

Действие: либо убрать префикс, либо закрыть в модуль.

### §13.5 Зависимости

#### §13.5.1 JSZip подключается синхронно

admin.html: script src jszip@3.10.1 без defer. Блокирует парсинг.

Действие: defer или async.

#### §13.5.2 Sivtsev грузится по-разному

- app.js: loadSivtsevFont() через FontFace API.
- admin.html: @font-face в CSS.
- player-runtime.js: loadSivtsevFont() через FontFace API.

Два механизма.

Действие: оставить один.

#### §13.5.3 Sentry release хардкод

release: 'vissort-2.0.0' в 3 HTML. Не синхронизируется с CACHE_VERSION = vissort-v34 в sw.js.

Действие: единый источник версии.

### §13.6 Сводка

| Область | Пунктов |
|---|---|
| Архитектура | 3 |
| Производительность | 7 |
| Качество кода | 7 |
| Согласованность | 3 |
| Зависимости | 3 |
| Итого | 23 |

---
## §14. Покрытие тестами

7 spec-файлов, 28 тестов, покрытие ~35 % реального.

### §14.1 Общая таблица

| Файл | Тестов | Реально покрывает |
|---|---|---|
| tests/camera.spec.js | 4 | ~40 % (мок без face-api) |
| tests/editor.spec.js | 5 | ~25 % (нет saveGraph/UI) |
| tests/login.spec.js | 3 | ~50 % (1 тест без мока) |
| tests/offline.spec.js | 5 | ~5 % (SW отключён в IS_DEV) |
| tests/player.spec.js | 4 | ~50 % (критические баги не ловит) |
| tests/reading.spec.js | 5 | ~60 % |
| tests/schema.spec.js | 2 | 0 % (миграция не проверяется) |
| Итого | 28 | ~35 % |

### §14.2 Что покрыто

- Открытие страниц: admin.html, player.html.
- Создание узла в редакторе через кнопку.
- Сохранение и загрузка сценария из IndexedDB (через Data API, не UI).
- Кнопка 🆕 очищает холст.
- Переключение режима Узлы ↔ Стимулы.
- Открытие страницы логина.
- Редирект не-админа на user.html.
- Неверный пароль — ошибка.
- SW содержит OFFLINE_HTML.
- VissortCore загружается.
- Повторный визит быстрее первого.
- Кнопка Старт → появляется SVG-стимул.
- Стрелка обрабатывается без pageerror.
- Кнопка Стоп останавливает плеер.
- Открытие viewport чтения при старте.
- Текст сценария отображается.
- Toolbar чтения видим.
- Кнопка Закончить закрывает чтение.
- schemaVersion 2 сохраняется.
- Старый сценарий без schemaVersion читается.

### §14.3 Что НЕ покрыто

Критические пути (закрыты после Фазы 4, см. §12):

- handleDirectionAnswer не продвигает серию (P0 §12.1.1) — FIXED 34f8659.
- focalLengthPx неверный ключ LS (P0 §12.1.2) — FIXED f8a82a9.
- showAuthModal падает в плеере (P0 §12.1.3) — FIXED 9475205.
- deleteNode удаляет лишние связи (P1 §12.2.4) — FIXED b3eaf99.
- physiological-режим не работает в player-reading.js (P1 §12.2.7) — FIXED 4d0095a.
- btn-response vs btn-resp (P1 §12.2.8) — FIXED 24e42c0.

Модули без единого теста:

- header-drag.js — перетаскивание кнопок шапки.
- keepalive.js — кнопка 📡, авто-пинг.
- voice.js — Web Speech API.
- vissort-onboarding.js — мастер калибровки.
- vissort-device.js — fingerprint, калибровка.
- vissort-ai-generator.js — DeepSeek-генератор.
- player-animation.js — 7 типов анимаций.
- player-invalid-detection.js — детекция наклона.
- player-dist-warning.js — баннеры дистанции.
- sw.js — стратегии кэша (только наличие строки OFFLINE_HTML).

Функциональность без тестов:

- Синхронизация с облаком (syncQueue, online/offline).
- Sync-UI (sync-chip, sync-banner, queue-modal).
- Камера: детекция лица, EAR, дистанция, устойчивость.
- Моргание: детекция, калибровка.
- Чтение: динамический фон, physiological-режим, bookmarks.
- Сравнение: direction, find_same.
- Граф: циклы, inheritSize, inheritSpeed.
- Миграции: schemaVersion 1 → 2.
- AI-генератор: парсинг ответа, создание узлов.
- Zoom холста.
- Новый сценарий (installNewScenario).
- Экспорт/импорт заготовок.
- File System Access (папки сценариев и заготовок).

### §14.4 Моки и фикстуры

Общие в 5 spec-файлах:

- mockUserLogin / mockAdminLogin — устанавливает фейковую сессию Supabase в localStorage.
- addInitScript — мок navigator.mediaDevices.getUserMedia через canvas.captureStream.
- killOnboarding — удаляет vissort-onboarding, ставит фейковую калибровку в sessionStorage и localStorage.
- route для **/auth/v1/** — отдаёт фейковые user и session.
- route для **/rest/v1/** — отдаёт фейковые scenarios, user_scenarios, test_results.

Проблемы моков:

- Мок getUserMedia не даёт настоящего видеотрека, face-api на нём не работает.
- Нет мока Edge Function generate-scenario.
- Нет мока Sentry tunnel.
- Нет мока service worker.

### §14.5 Проблемы тестов

#### §14.5.1 Пароль в открытом виде

tests/login.spec.js содержит:

    process.env.TEST_PASSWORD || '459188@Rape'

Пароль в открытом виде в исходниках. Приватный репозиторий — компромисс, публичный — критично.

#### §14.5.2 Разнобой тестовых email

- test@vissort.com — camera.spec.js, player.spec.js, reading.spec.js.
- dumand@gmail.com — editor.spec.js, schema.spec.js.

Несогласованно.

#### §14.5.3 Тесты без мока Supabase

login.spec.js не мокает Supabase. Зависит от реального бэкенда. Нестабильно в CI без ENV.

#### §14.5.4 Слабые assertion

- offline.spec.js: offlineContent.length > 0 — всегда true.
- offline.spec.js: stillWorks — VissortCore и Data уже в памяти, не проверяет офлайн.
- offline.spec.js: время второго визита < 2× первого + 1000 — flaky.

#### §14.5.5 Не работающие тесты

- offline.spec.js: SW отключён в IS_DEV (app.js). На localhost SW не регистрируется, тесты №2, 4, 5 бессмысленны.
- schema.spec.js: миграция v1 → v2 не проверяется, только сохранение и чтение.

#### §14.5.6 Sleep вместо waitForFunction

page.waitForTimeout(N) используется ~15 раз по всем файлам.

#### §14.5.7 page.on(pageerror) только в 2 тестах

- camera.spec.js: тест №3.
- player.spec.js: тест №3.

В остальных ошибки JS не ловятся.

#### §14.5.8 Дублирование helper-ов

mockUserLogin / mockAdminLogin в 5 копиях. Нет общего helper-а.

### §14.6 Рекомендации

- Убрать пароль из login.spec.js — только ENV.
- Заменить sleep на waitForFunction.
- Добавить мок Edge Function generate-scenario.
- Добавить тест handleDirectionAnswer с проверкой продвижения серии.
- Добавить тест focalLengthPx с проверкой ключа LS.
- Добавить тест player-reading.js с режимом physiological.
- Добавить тест saveGraph через UI, не через Data API.
- Добавить тесты миграции schemaVersion через migrateScenario напрямую.
- Вынести общий test-helpers.js.
- Унифицировать email в тестах.
- Прогнать тесты на staging (не localhost) — SW заработает.

### §14.7 CI

GitHub Actions CI: 28 Playwright-тестов на каждый push. Конфиг в .github/workflows.

Проблемы:

- CI работает на localhost — SW отключён.
- Нет ENV для реальных Supabase-креденшелов (login.spec.js падает).
- Таймауты 15–20 секунд могут быть малы для медленного CI-раннера.

Действие: настроить .env для CI, использовать staging, увеличить таймауты.

---
## §15. План Фаз 5–6

### §15.1 Фаза 5 — аудит и улучшения

Цель: устранить техдолг, зафиксированный в §12 и §13, без ломки прода.

#### §15.1.1 Аудит app.js

- Разбить 7879 строк на 5–6 модулей (см. §13.1.1).
- Убрать дублирующий плеер (см. §8.5).
- Убрать PATCH-комментарии.
- Прогнать Prettier + ESLint 0 errors.

#### §15.1.2 Устранение P0-багов

ЗАКРЫТО (см. §12.1). Все 3 P0 исправлены в сессии после Фазы 4:
- §12.1.1 → коммит 34f8659
- §12.1.2 → коммит f8a82a9
- §12.1.3 → коммит 9475205

#### §15.1.3 Устранение P1-багов

ЗАКРЫТО (см. §12.2). Все P1 исправлены в сессии после Фазы 4:
- §12.2.1 → коммит 303a093
- §12.2.2 → коммит 6a7cdf1
- §12.2.3 → коммит 47c8732
- §12.2.4 → коммит b3eaf99
- §12.2.5 → не подтверждён (бага нет)
- §12.2.7 → коммит 4d0095a
- §12.2.8 → коммит 24e42c0

#### §15.1.4 Авто-bump SW

Проблема: CACHE_VERSION = 'vissort-v34' меняется вручную.

Действие: заменить на дату или хеш коммита через pre-commit hook, или генерировать sw.js в build-скрипте.

#### §15.1.5 Sentry performance

Сейчас tracesSampleRate: 0. Включить на 10 % для production.

#### §15.1.6 Единая константа env

Вынести:

- SUPABASE_URL, SUPABASE_ANON_KEY в единую window.VissortEnv.
- Sentry DSN, tunnel, release.
- ADMIN_EMAILS (или хранить на стороне Edge).

#### §15.1.7 Удалить мёртвое

- PATCH-комментарии.
- Исторические user.js маркеры.
- Мёртвые константы (_LEAN_FAST_MS, _LEAN_WINDOW_MS, _LEAN_CONSECUTIVE_FRAMES).
- Мёртвые функции (_checkHardLimit, onHideStimulus, #user-list, #stim-cam-preview).

#### §15.1.8 Унификация дистанции

Создать player-distance.js. Заменить три системы (см. §7).

### §15.2 Фаза 6 — клинический редактор

Срок: 6 недель.

#### §15.2.1 Цели

- Врач собирает методику из блоков.
- Автоматическая генерация сценария по клиническому протоколу.
- Учёт медицинских параметров: диоптрии, время, острота.
- Экспорт в PDF для отчёта.

#### §15.2.2 Фичи

- Библиотека методик (не отдельные узлы, а сценарии).
- Шаблоны по диагнозу (миопия слабая / средняя / высокая).
- Прогресс пациента в динамике.
- Интеграция с физиологической шкалой диаптера.
- Настройка моргания как клинического параметра.
- Отчёт Sentry по ошибкам плеера для клиники.

#### §15.2.3 Технические задачи

- Перенести physiological-режим из app.js в player-reading.js.
- Унифицировать btn-response vs btn-resp.
- Добавить тесты на критические пути плеера.
- Аудит RLS на всех таблицах.
- Логирование Edge Functions.

---

## §16. История исправлений (сессия после Фазы 4)

Хронология коммитов с 2026-10-11. Все изменения затрагивают только что задокументированные баги из §12.

### §16.1 Коммиты сессии

| # | Коммит | Что | Файлы |
|---|---|---|---|
| 1 | `f535611` | PROJECT-MAP.md — полная карта архитектуры после Фаз 0–4 | docs/PROJECT-MAP.md |
| 2 | `10c9292` | .gitignore — временные файлы (part, backup, _mermaid) | .gitignore |
| 3 | `39435a8` | ARCHITECTURE-DIAGRAMS.md — 4 mermaid-диаграммы | docs/ARCHITECTURE-DIAGRAMS.md |
| 4 | `f8a82a9` | fix(player-runtime): P0 — focalLengthPx из правильного ключа LS | player-runtime.js |
| 5 | `34f8659` | fix(player-runtime): P0 — продвижение серии в handleDirectionAnswer | player-runtime.js |
| 6 | `9475205` | fix(player-runtime): P0 — удалить мёртвый showAuthModal | player-runtime.js |
| 7 | `b3eaf99` | fix(app): P1 — deleteNode проверяет связи по границам id | app.js |
| 8 | `303a093` | fix(admin): P1 — CSP admin.html: frame-ancestors 'none' | admin.html |
| 9 | `47c8732` | fix(sw): P1 — удалить мёртвые Sentry-регекспы | sw.js |
| 10 | `6a7cdf1` | fix(sw): P1 — PRECACHE_URLS: добавить модули и ассеты | sw.js |
| 11 | `4d0095a` | fix(player-reading): P1 — поддержка physiological mode | player-reading.js |
| 12 | `24e42c0` | fix(ui): P1 — унификация .btn-response → .btn-resp | admin.html, app.js |
| 13 | `a0080d7` | refactor(createCellElement): убрать небезопасный fallback | player-runtime.js, app.js |
| 14 | `c7ebfee` | feat(env): вынести SUPABASE_URL/ANON_KEY в vissort-env.js | vissort-env.js, admin.html, user.html, player.html |
| 15 | `3c55acc` | refactor(env): data-layer, ai-generator, player-runtime читают из VissortEnv | 3 файла |
| 16 | `9c379b2` | refactor(env): keepalive.js читает KEEPALIVE_KEY из VissortEnv | keepalive.js |
| 17 | `63aba3d` | refactor(env): app.js читает SUPABASE_URL/ANON_KEY из VissortEnv | app.js |
| 18 | `518ae11` | fix(sw): precache vissort-env.js | sw.js |

### §16.2 Сводка

- **P0 (критические):** 3 закрыто.
- **P1 (важные):** 6 закрыто, 1 не подтверждён.
- **Refactor:** 1 (createCellElement fallback).
- **§11.2 (Фаза 5):** 5 закрыто + 1 финальный.
- **Всего коммитов:** 19.
- **Тесты:** 28 passed после каждого коммита. Ни одной регрессии.

### §16.3 До / После

| Метрика | До сессии | После сессии |
|---|---|---|
| P0-багов | 3 | 0 |
| P1-багов | 7 | 0 (1 не подтверждён) |
| P2-багов | 5 + §11.2 | 4 (план Фазы 5) |
| Тестов проходит | 28 | 28 |
| Документация | ARCHITECTURE.md (устарел) | PROJECT-MAP.md + ARCHITECTURE-DIAGRAMS.md |

---
## Приложение А. Сводная таблица файлов

### А.1 JS-модули

| Файл | Размер | Строк | Статус разбора |
|---|---|---|---|
| vissort-core.js | 16.5 KB | ~440 | #1 |
| voice.js | 25.4 KB | ~750 | #2 |
| data-layer.js | 40.2 KB | ~1030 | #3 |
| player-state.js | ~5 KB | ~180 | #4 |
| player-utils.js | ~3 KB | ~90 | #5 |
| player-dist-warning.js | ~2 KB | ~60 | #6 |
| player-reading.js | ~5 KB | ~180 | #7 |
| player-camera.js | ~14 KB | ~480 | #8 |
| player-animation.js | ~18 KB | ~530 | #9 |
| player-invalid-detection.js | ~8 KB | ~180 | #10 |
| vissort-onboarding.js | ~12 KB | ~330 | #11 |
| vissort-device.js | ~10 KB | ~290 | #12 |
| vissort-ai-generator.js | ~12 KB | ~300 | #13 |
| header-drag.js | ~4 KB | ~150 | #14 |
| keepalive.js | ~5 KB | ~180 | #15 |
| sw.js | 9 KB | ~290 | #16 |
| player-runtime.js | 116.2 KB | 2978 | #17, #18 |
| app.js | 360.3 KB | 7879 | #19–#22 |

### А.2 HTML

| Файл | Размер | Строк | Блок разбора |
|---|---|---|---|
| user.html | ~30 KB | ~700 | #23 |
| player.html | ~32 KB | ~740 | #24 |
| admin.html | ~184 KB | 3020 | #26, #27 |

### А.3 Entry-скрипты

| Файл | Размер | Строк | Блок |
|---|---|---|---|
| user.js | 0.15 KB | 2 | #25 |
| player.js | 0.15 KB | 2 | #25 |

### А.4 Тесты

| Файл | Тестов | Блок |
|---|---|---|
| tests/camera.spec.js | 4 | #28 |
| tests/editor.spec.js | 5 | #28 |
| tests/login.spec.js | 3 | #28 |
| tests/offline.spec.js | 5 | #28 |
| tests/player.spec.js | 4 | #28 |
| tests/reading.spec.js | 5 | #28 |
| tests/schema.spec.js | 2 | #28 |

### А.5 Документы docs

| Файл | Актуален |
|---|---|
| HOW-TO-NEW-CHAT.md | да |
| PLAN.md | да |
| TODO.md | да |
| DEPLOY.md | да |
| VISION.md | да |
| ECONOMICS.md | да |
| GO-TO-MARKET.md | да |
| PARTNERS.md | да |
| SALES-SCENARIOS.md | да |
| MARKETING.md | да |
| PITCH.md | да |
| PITCH-B2C.md | да |
| PITCH-EDITOR.md | да |
| CONTENT-PLAN.md | да |
| PROJECT-MAP.md | этот документ |
| ARCHITECTURE.md | устарел (05.10, до Фазы 1) |
| HANDOFF.md | устарел (10.10, дубль HOW-TO) |

### А.6 Сводка

| Категория | Файлов | Размер |
|---|---|---|
| JS-модули | 18 | ~730 KB |
| HTML | 3 | ~246 KB |
| Entry | 2 | ~0.3 KB |
| Тесты | 7 | — |
| Документы | 17 | ~250 KB |
| Итого | 30 | ~980 KB |

### А.7 Версии

| Что | Значение |
|---|---|
| schemaVersion (сценарии) | 2 |
| CACHE_VERSION (SW) | vissort-v34 |
| release (Sentry) | vissort-2.0.0 |
| DB_VERSION (IndexedDB) | 3 |
| Supabase project | hzvypwdpdhsjzaclxmbm |
| Production | vissort.com |

---

Конец документа.

---

Составлено: 2026-10-11.
Источник: PROJECT-MAP сборка из 16 блоков (A–O).
Разделов: 15 + Приложение А.