# Vissort — TODO

> Статус: Фазы 0, 1, 2, 3 закрыты. Фаза 4 частично. Все P0/P1 закрыты (2026-10-11)
> Связанные: PROJECT-MAP.md (карта), PLAN.md

## ✅ ЗАКРЫТО

### Фаза 0 — фундамент

- [x] Playwright: 28 тестов + CI
- [x] schemaVersion: 2 + migrateScenario
- [x] README + ARCHITECTURE + DEPLOY

### Фаза 1 — рефакторинг player-runtime.js

- [x] player-state.js (93 переменные)
- [x] player-utils.js (rate-limit, validation, distance)
- [x] player-dist-warning.js (UI дистанции)
- [x] player-reading.js (фон чтения)
- [x] player-camera.js (камера, callbacks)
- [x] player-animation.js (анимации, callbacks)
- [x] player-invalid-detection.js (детекция наклона)
- Граф оставлен в player-runtime.js (осознанно — «дирижёр» плеера)

### Фаза 2 — чистка кода

- [x] Убрать PATCH* / BUG-* (228 вхождений)
- [x] Prettier: все файлы отформатированы, .prettierignore настроен
- [x] ESLint: 0 errors (978 → 0)
- [x] Фикс багов разметки: </form></div> в auth-модалке (3 HTML)
- [x] Фикс дубликата ключа response в app.js
- [x] Фикс getNode → gGetNode в player-runtime.js (callback onGetNode падал)

---

## 🚧 В РАБОТЕ

- [ ] Устранить дублирование app.js ↔ player-runtime.js (~3000 строк, §8 PROJECT-MAP.md)
- [ ] P2-баги (§12.3 PROJECT-MAP.md): 5 пунктов техдолга
- [ ] Техдолг (§13 PROJECT-MAP.md): 23 пункта
- [ ] Уборка корня (patch*.ps1, _test_graph.json, diff.txt)

---

## ✅ ФАЗА 3 — доработки (закрыта 2026-10-10)

- [ ] ESLint: 45 warnings — перенесено в P2 (§12.3, §13 PROJECT-MAP.md)
- [ ] ESLint: убрать временные globals (stimArea/stimDisplay/dir/direction/answer) после рефакторинга player-runtime.js
- [ ] player-runtime.js: разобрать пустые ветки чтения (строки 2472, 2481)
- [ ] H: убрать мусорный typeof direction в _logAnswer — перенесено в P2 (§12.3)
- [x] Два режима контроля дистанции (авто-пересчёт / возврат) — закрыто 09.10.2026
- [x] Reaction time → test_results (в БД) — подтверждено 2026-10-09
- [x] Порог дистанции в админке — закрыто 09.10.2026 (tolNearCm/tolFarCm в инспекторе узла)
- [x] Landmarks для моргания (EAR) — закрыто 10.10.2026 (коммит 932a702)
- [x] Порог устойчивости в редакторе — закрыто 09.10.2026 (коммит 670eb66)

### ✅ Синхронизация калибровки (закрыта 2026-10-10)

- [x] Fingerprint persist в localStorage — коммит 40f46e8
- [x] Калибровка привязана к fp|userId — коммит 78e7fb2
- [x] setCurrent передаёт userId — коммит a1964d6
- [x] Пропустить — только на сессию (sessionStorage) — коммит cbe55e3
- [x] Кнопка 📐 в player.html — коммит 899f609
- [x] Кнопка 📐 в user.html — коммит 19599c4
- [x] Убран askAboutDevice — не подставляем чужую калибровку — коммит d3bf370

---

## 🔊 ГОЛОС — техдолг

- [x] **Кеш фраз голоса через mp3-файлы** (путь A) — СДЕЛАНО 2026-10-24: 21 mp3 в `assets/voice/`, `sayKey` играет через `new Audio()`, fallback TTS.
      Проблема: Online-голоса Microsoft (Светлана/Дмитрий Natural) стриминговые — глотают начало/конец коротких фраз («Приготовьтесь» → «гот...»). Удлинение фразы не помогло (проверено 2026-10-24). Локальных русских голосов в системе нет (`local: false` у обоих).
      Решение: 8 mp3 в `assets/voice/` (`ready.mp3`, `look.mp3`, `correct.mp3`, `wrong.mp3`, `timeout.mp3`, `blink.mp3`, `moveBack.mp3`, `moveUp.mp3`). В `voice.js` `sayKey(key)` — если файл есть, `new Audio('assets/voice/<key>.mp3')`, иначе fallback на `speechSynthesis`. Плюсы: нет стриминга, нет задержки, работает офлайн, кешируется SW.
      Статус: отложено 2026-10-24, временно — путь B (прогрев + отложенный старт).
## 🔊 ГОЛОС — техдолг

- [x] **Кеш фраз голоса через mp3-файлы** (путь A) — СДЕЛАНО 2026-10-24: 21 mp3 в `assets/voice/`, `sayKey` играет через `new Audio()`, fallback TTS.
      Проблема: Online-голоса Microsoft (Светлана/Дмитрий Natural) стриминговые — глотают начало/конец коротких фраз («Приготовьтесь» → «гот...»). Удлинение фразы не помогло (проверено 2026-10-24). Локальных русских голосов в системе нет (`local: false` у обоих).
      Решение: 8 mp3 в `assets/voice/` (`ready.mp3`, `look.mp3`, `correct.mp3`, `wrong.mp3`, `timeout.mp3`, `blink.mp3`, `moveBack.mp3`, `moveUp.mp3`). В `voice.js` `sayKey(key)` — если файл есть, `new Audio('assets/voice/<key>.mp3')`, иначе fallback на `speechSynthesis`. Плюсы: нет стриминга, нет задержки, работает офлайн, кешируется SW.
      Статус: отложено 2026-10-24, временно — путь B (прогрев + отложенный старт).
## 🐛 ИЗВЕСТНЫЕ БАГИ

- [x] NotAllowedError при отказе от камеры — закрыто 09.10.2026 (коммит 8af761b)

---

## ✅ P0/P1 закрыты (2026-10-11)

См. PROJECT-MAP.md §16 «История исправлений».

- [x] P0 #1: handleDirectionAnswer — продвижение серии (34f8659)
- [x] P0 #2: focalLengthPx — правильный ключ LS (f8a82a9)
- [x] P0 #3: showAuthModal — удалён мёртвый код (9475205)
- [x] P1 #1: CSP admin.html — frame-ancestors (303a093)
- [x] P1 #2: SW precache — 16 новых URL (6a7cdf1)
- [x] P1 #3: Sentry-регекспы — удалены (47c8732)
- [x] P1 #4: deleteNode — точная проверка границ id (b3eaf99)
- [x] P1 #5: showFindSame — не подтверждён (бага нет)
- [x] P1 #6: physiological — режим добавлен в player-reading.js (4d0095a)
- [x] P1 #7: btn-response/btn-resp — унифицированы (24e42c0)
- [x] Refactor: createCellElement fallback = -1 (a0080d7)
- [x] PROJECT-MAP.md — 16 разделов + Прил. А (04db57d)
- [x] ARCHITECTURE-DIAGRAMS.md — 4 mermaid-диаграммы (39435a8)

---

## 📋 ФАЗА 4 — безопасность и надёжность

- [x] RLS-аудит Supabase — §11.3 (FIXED 2026-10-12: docs/RLS-AUDIT.md, миграция doctor/developer)
- [ ] Логирование Edge Functions — §11.4
- [x] Бэкап БД (cron + Storage) — §11.5 (FIXED 2026-10-12: GitHub Actions + pg_dump 17)
- [x] Убрать eremeevap@gmail.com из ADMIN_EMAILS в app.js — §11.1 (FIXED 08d4c0f)
- [x] Ротировать SUPABASE_ANON_KEY — §11.2 (FIXED 2026-10-11: vissort-env.js, коммиты c7ebfee…f61da92)

---

## 📋 ФАЗА 5 — производительность

- [ ] Аудит app.js
- [ ] Кэш SW — авто-bump версии
- [ ] Sentry performance (tracesSampleRate 0.1)

---

## 📋 ФАЗА 6 — клинический редактор

- [ ] Модель данных (organizations, methods, courses, audit_log)
- [ ] Библиотека методик (5 базовых)
- [ ] Интерфейс врача
- [ ] Интерфейс пациента
- [ ] Версионирование методик
- [ ] Аудит + PDF
- [ ] Мультитенантность

---

## 📋 ФАЗА 6.5 — новые упражнения

- [ ] **Упражнение «Чёткий / нечёткий стимул»** (blur-тренировка аккомодации)
      - Механика: стимул плавно размывается и возвращается к резкости по циклу
      - Цель: снятие спазма аккомодации через тренировку фокусировки
      - Параметры: степень размытия (blur px), длительность цикла, режим (градиент / переключение)
      - Тип узла: TBD (новый BLUR или расширение стимульного узла)
      - Ответ пациента: TBD (кнопка «вижу» / направление / молчаливое наблюдение)
      - Связь: новый узел в редакторе + логика в player-animation.js
      - Статус: идея, ТЗ не проработано

---

## ✅ §15.1.2 — рефакторинг player-runtime.js (ЗАКРЫТО 2026-10-15)

**Итог:** `player-runtime.js` 3002 → **899** строк (−70%).

### Модули

| Файл | Строк |
|---|---|
| `player-reading-mode.js` | 254 |
| `player-auth.js` | 254 |
| `player-scenarios.js` | ~190 |
| `player-graph.js` | 803 |
| `player-session.js` | 328 |
| `player-single.js` | 608 |

### Коммиты §15.1.2 ч.7/7

- ч.3/7 `player-reading-mode.js`
- ч.4/7 `player-auth.js`
- ч.5/7 `player-scenarios.js`
- ч.6/7 `player-graph.js`
- ч.7/7 `player-session.js` + `player-single.js` (3a, 3b, 3c)
- Префаксы: `window.responseButtons/updateCounters/removeSingleGridLines`

### Что осталось

- §13.3.3 ✅ закрыто (2026-10-15): нативных alert/confirm/prompt в app.js нет (все через VissortDialog); в остальных файлах — только fallback'и под `if (VissortDialog)`
- Фаза 5: разбить app.js (7900 строк), устранить дублирование app.js ↔ player-single.js

---

## ✅ §A1 (Фаза 5) — AppState для app.js (ЗАКРЫТО 2026-10-15)

**Итог:** 90 глобальных переменных вынесены в `app-state.js` (шим через `window.AppState`).

### Что сделано

- `app-state.js` — новый файл, 90 переменных + шим `Object.defineProperty`.
- `app.js` — удалены объявления диапазонов 62–150 и 175–209 (124 строки).
- `admin.html` — подключён `app-state.js` перед `app.js`.
- Оставлены в `app.js`: `_blinkState`, `_blinkResponseBlockUntil`, `_blinkCalibration`, `_waitingForOpenEyes`, `createEmptyBlinkState()`, `BLINK_*`.
- Тесты: 28 passed.

### Коммит

- `818ee24` §A1 (Фаза 5): вынести 90 глобальных переменных в app-state.js

---

## ✅ §A2-v2 (Фаза 5) — плеер-превью (ЗАКРЫТО 2026-10-15)

**Итог:** `app.js` 7756 → **6569** (−15.3%).

### Что сделано

- `app-player-preview.js` — новый файл, 34 функции, 1277 строк, экспорт `window.AppPlayerPreview`.
- Плеер-превью отличается от прод-плеера (`player-single.js`): адаптивная острота, `blinkLockShow`, `sessionId`, `buildBlinkReport`.
- `app.js` — удалён блок 4270–5519, добавлены 34 обёртки.
- `AppEditorCore` дополнен `buildPlayQueue` + `nodeToReadingParams`.
- `switchMode` оставлен в `app.js` (это редактор, не плеер).
- `admin.html` — подключён `app-player-preview.js` между `app-state.js` и `app.js`.
- Тесты: 28 passed.

### Коммит

- `c4cc5b1` §A2-v2 (Фаза 5): вынести плеер-превью (34 функции, 1277 строк)


---

## ⚠️ Уроки сессии 2026-10-14

1. **Коммит после каждого под-шага** — `git checkout` снесёт всё незакоммиченное.
2. **`$('...')` в PowerShell-патчах — экранировать** как `` `$('...') ``.
3. **Проверки границ (idx) перед записью** — если сдвиг, файл не портится.
4. **`pull --rebase` при отказе push** (bump-бот каждые 1–2 мин).
5. **При патче `};` — пропускать только заменяемую строку**, не блок.
6. **Тонкие обёртки — не модули.** Если функция = одна строка `return window.X.y()`, не выносить в отдельный модуль. Оставлять в runtime или удалять отдельной задачей.

_Обновлять после каждой сессии._

---

## 📋 НОВЫЕ ФИЧИ (Идеи / Отложено)

### 1. Загрузка внешних картинок как стимулов (IMAGE)
- **Что:** Добавить тип стимула IMAGE. В инспекторе (режим "Стимул") выбрать "Картинка" -> кнопка "Загрузить" (PNG, JPG, SVG).
- **Где хранить:** Лучше в IndexedDB (новый store images) + в JSON сценария только imageId. При экспорте сценария — упаковывать в ZIP.
- **ЖС (Живой стимул):** Для картинок (PNG/JPG) перекраска невозможна. Применять только яркость (ilter: brightness()) и фон. Для SVG — можно красить через ill.
- **Валидация:** Только безопасные форматы, SVG санитизировать (убрать <script>).
- **Статус:** Идея, ждет реализации.

